import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { TeamNavigation } from '@/components/TeamNavigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/theme/ThemeProvider';

const positionLabels: Record<string, string> = { GK: 'Tor', CB: 'Innenverteidigung', FB: 'Außenverteidigung', DM: 'Defensives Mittelfeld', CM: 'Zentrales Mittelfeld', AM: 'Offensives Mittelfeld', W: 'Flügel', ST: 'Sturm' };
const positions = Object.keys(positionLabels);

type PlayerView = { membershipId: string; name: string; teamIds: string[]; primary: string | null; secondary: string | null };
type TargetRow = { team_id: string; position_code: string; target_count: number };

export default function SquadScreen() {
  const {colors}=useAppTheme(); const styles=useMemo(()=>createStyles(colors),[colors]);
  const { isLoading: isAuthLoading, session } = useAuth();
  const { activeTeamId, activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(activeTeamId);
  const [players, setPlayers] = useState<PlayerView[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [primary, setPrimary] = useState<string | null>(null);
  const [secondary, setSecondary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClubManager = Boolean(activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const coachTeamIds = activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [];
  const canManageSelected = Boolean(selectedTeamId && (isClubManager || coachTeamIds.includes(selectedTeamId)));

  useEffect(() => {
    if (!selectedTeamId && activeWorkspace?.teams[0]) setSelectedTeamId(activeWorkspace.teams[0].id);
  }, [activeWorkspace?.id]);

  const load = useCallback(async () => {
    if (!supabase || !activeWorkspace) return;
    setIsLoading(true); setError(null);
    const { data: membershipRows, error: membershipError } = await supabase.from('memberships').select('id, profile_id, display_name').eq('club_id', activeWorkspace.clubId).eq('status', 'active');
    if (membershipError) { setError(membershipError.message); setIsLoading(false); return; }
    const membershipIds = (membershipRows ?? []).map((row) => row.id);
    const profileIds = (membershipRows ?? []).map((row) => row.profile_id).filter((id): id is string => Boolean(id));
    const [profilesResult, assignmentsResult, positionsResult, targetsResult] = await Promise.all([
      profileIds.length ? supabase.from('profiles').select('id, display_name').in('id', profileIds) : Promise.resolve({ data: [] }),
      membershipIds.length ? supabase.from('team_memberships').select('id, membership_id, team_id, team_membership_roles(role)').in('membership_id', membershipIds) : Promise.resolve({ data: [] }),
      membershipIds.length ? supabase.from('member_positions').select('membership_id, position_code, priority').in('membership_id', membershipIds) : Promise.resolve({ data: [] }),
      supabase.from('team_position_targets').select('team_id, position_code, target_count').in('team_id', activeWorkspace.teams.map((team) => team.id)),
    ]);
    const playerAssignments = (assignmentsResult.data ?? []).filter((row) => ((row.team_membership_roles ?? []) as Array<{ role: string }>).some((role) => role.role === 'player'));
    const playerMembershipIds = new Set(playerAssignments.map((row) => row.membership_id));
    setPlayers((membershipRows ?? []).filter((member) => playerMembershipIds.has(member.id)).map((member) => {
      const memberPositions = (positionsResult.data ?? []).filter((row) => row.membership_id === member.id);
      return {
        membershipId: member.id,
        name: member.display_name ?? (profilesResult.data ?? []).find((profile) => profile.id === member.profile_id)?.display_name ?? 'Unbenannt',
        teamIds: [...new Set(playerAssignments.filter((row) => row.membership_id === member.id && activeWorkspace.teams.some((team) => team.id === row.team_id)).map((row) => row.team_id))],
        primary: memberPositions.find((row) => row.priority === 'primary')?.position_code ?? null,
        secondary: memberPositions.find((row) => row.priority === 'secondary')?.position_code ?? null,
      };
    }));
    setTargets((targetsResult.data ?? []) as TargetRow[]); setIsLoading(false);
  }, [activeWorkspace?.id]);

  useEffect(() => { void load(); }, [load]);
  const selectedTeam = activeWorkspace?.teams.find((team) => team.id === selectedTeamId);
  const teamPlayers = useMemo(() => players.filter((player) => selectedTeamId && player.teamIds.includes(selectedTeamId)), [players, selectedTeamId]);

  const targetFor = (code: string) => targets.find((row) => row.team_id === selectedTeamId && row.position_code === code)?.target_count ?? 1;
  const countFor = (code: string) => teamPlayers.filter((player) => player.primary === code || player.secondary === code).length;

  const beginEdit = (player: PlayerView) => { setEditingId(player.membershipId); setPrimary(player.primary); setSecondary(player.secondary); setError(null); };
  const savePositions = async () => {
    if (!supabase || !editingId || !primary) return;
    setIsSubmitting(true); const { error: saveError } = await supabase.rpc('update_member_positions', { target_membership_id: editingId, primary_position: primary, secondary_position: secondary });
    if (saveError) setError(saveError.message); else { setEditingId(null); await load(); } setIsSubmitting(false);
  };
  const changeTarget = async (code: string, change: number) => {
    if (!supabase || !selectedTeamId) return;
    const next = Math.max(0, Math.min(20, targetFor(code) + change));
    const { error: targetError } = await supabase.rpc('set_team_position_target', { target_team_id: selectedTeamId, target_position_code: code, new_target_count: next });
    if (targetError) setError(targetError.message); else await load();
  };

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  return <ScrollView contentContainerStyle={styles.page}><View style={styles.shell}>
    <Text style={styles.eyebrow}>SAISON-KADERPLANUNG</Text><Text style={styles.title}>Positionen im Blick</Text><Text style={styles.subtitle}>Ein gemeinsamer Spielerpool für beliebig viele Teams. Haupt- und Nebenpositionen zeigen sofort, wo der Kader gut oder dünn besetzt ist.</Text><ContextSwitcher /><TeamNavigation />
    <View style={styles.teamTabs}>{activeWorkspace?.teams.map((team) => <Pressable accessibilityRole="button" key={team.id} onPress={() => setSelectedTeamId(team.id)} style={[styles.teamTab, selectedTeamId === team.id && styles.teamTabActive]}><Text style={[styles.teamTabText, selectedTeamId === team.id && styles.teamTabTextActive]}>{team.name}</Text></Pressable>)}</View>

    <View style={styles.card}><Text style={styles.cardTitle}>Positionsmatrix · {selectedTeam?.name}</Text><Text style={styles.helper}>Ist zählt Haupt- und Nebenpositionen der dem Team zugeordneten Spieler.</Text>
      <View style={styles.matrix}>{positions.map((code) => { const actual = countFor(code); const target = targetFor(code); const status = actual < target ? 'under' : actual > target ? 'over' : 'ok'; return <View key={code} style={styles.positionCard}><Text style={styles.positionCode}>{code}</Text><Text style={styles.positionName}>{positionLabels[code]}</Text><Text style={styles.coverage}>{actual} Ist / {target} Soll</Text><Text style={[styles.status, status === 'ok' ? styles.ok : status === 'under' ? styles.under : styles.over]}>{status === 'ok' ? 'Passend' : status === 'under' ? `${target - actual} fehlt` : `${actual - target} zusätzlich`}</Text>{canManageSelected ? <View style={styles.targetActions}><Pressable accessibilityRole="button" onPress={() => changeTarget(code, -1)} style={styles.smallButton}><Text>−</Text></Pressable><Pressable accessibilityRole="button" onPress={() => changeTarget(code, 1)} style={styles.smallButton}><Text>+</Text></Pressable></View> : null}</View>; })}</View>
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>Gemeinsamer Spielerpool</Text>{isLoading ? <ActivityIndicator color={colors.blue} /> : null}
      {players.map((player) => <View key={player.membershipId} style={styles.playerRow}><View><Text style={styles.playerName}>{player.name}</Text><Text style={styles.playerTeams}>{player.teamIds.map((id) => activeWorkspace?.teams.find((team) => team.id === id)?.name).join(' · ')}</Text></View><View style={styles.playerRight}><Text style={styles.playerPositions}>{player.primary ? `${player.primary}${player.secondary ? ` / ${player.secondary}` : ''}` : 'Position offen'}</Text>{canManageSelected && player.teamIds.includes(selectedTeamId ?? '') ? <Pressable accessibilityRole="button" onPress={() => beginEdit(player)}><Text style={styles.editText}>Positionen bearbeiten</Text></Pressable> : null}</View></View>)}
    </View>

    {editingId ? <View style={styles.card}><Text style={styles.cardTitle}>Spielerpositionen festlegen</Text><Text style={styles.label}>Hauptposition</Text><View style={styles.choices}>{positions.map((code) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: primary === code }} key={`p:${code}`} onPress={() => { setPrimary(code); if (secondary === code) setSecondary(null); }} style={[styles.choice, primary === code && styles.choiceActive]}><Text style={[styles.choiceText, primary === code && styles.choiceTextActive]}>{code}</Text></Pressable>)}</View><Text style={styles.label}>Nebenposition (optional)</Text><View style={styles.choices}>{positions.filter((code) => code !== primary).map((code) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: secondary === code }} key={`s:${code}`} onPress={() => setSecondary(secondary === code ? null : code)} style={[styles.choice, secondary === code && styles.choiceActive]}><Text style={[styles.choiceText, secondary === code && styles.choiceTextActive]}>{code}</Text></Pressable>)}</View><View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => setEditingId(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Abbrechen</Text></Pressable><Pressable accessibilityRole="button" disabled={!primary || isSubmitting} onPress={savePositions} style={[styles.saveButton, !primary && styles.disabled]}>{isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.saveText}>Positionen speichern</Text>}</Pressable></View></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View></ScrollView>;
}

const createStyles=(colors:ReturnType<typeof useAppTheme>['colors'])=>StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20, paddingBottom: 48 }, shell: { alignSelf: 'center', maxWidth: 1040, width: '100%' }, eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }, title: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 8 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 760 }, teamTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }, teamTab: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 }, teamTabActive: { backgroundColor: colors.ink, borderColor: colors.ink }, teamTabText: { color: colors.muted, fontSize: 13, fontWeight: '800' }, teamTabTextActive: { color: colors.surface },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 }, cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, helper: { color: colors.muted, fontSize: 12, marginTop: 5 }, matrix: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 }, positionCard: { backgroundColor: colors.canvas, borderRadius: 12, minWidth: 150, padding: 13, flexGrow: 1, flexBasis: 180 }, positionCode: { color: colors.blue, fontSize: 12, fontWeight: '900' }, positionName: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 3 }, coverage: { color: colors.muted, fontSize: 12, marginTop: 8 }, status: { fontSize: 11, fontWeight: '900', marginTop: 5 }, ok: { color: colors.green }, under: { color: '#b42318' }, over: { color: colors.orange }, targetActions: { flexDirection: 'row', gap: 6, marginTop: 9 }, smallButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 7, borderWidth: 1, height: 28, justifyContent: 'center', width: 32 },
  playerRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingVertical: 14 }, playerName: { color: colors.ink, fontSize: 15, fontWeight: '900' }, playerTeams: { color: colors.muted, fontSize: 12, marginTop: 3 }, playerRight: { alignItems: 'flex-end' }, playerPositions: { color: colors.ink, fontSize: 13, fontWeight: '800' }, editText: { color: colors.blue, fontSize: 12, fontWeight: '800', marginTop: 5 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 8, marginTop: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 }, choiceActive: { backgroundColor: colors.blue, borderColor: colors.blue }, choiceText: { color: colors.muted, fontSize: 12, fontWeight: '900' }, choiceTextActive: { color: colors.surface }, actions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 18 }, cancelButton: { borderColor: colors.border, borderRadius: 11, borderWidth: 1, padding: 13 }, cancelText: { color: colors.ink, fontWeight: '800' }, saveButton: { backgroundColor: colors.ink, borderRadius: 11, minWidth: 180, padding: 13 }, saveText: { color: colors.surface, fontWeight: '900', textAlign: 'center' }, disabled: { opacity: 0.4 }, error: { color: '#b42318', fontSize: 13, marginTop: 14 },
});
