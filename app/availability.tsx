import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

type BlockView = { id: string; starts_at: string; ends_at: string; reason: string | null };
type PlanRow = { team_id: string; player_total: number; player_available: number; coach_total: number; coach_available: number };

const toIso = (value: string) => new Date(value).toISOString();
const formatDate = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AvailabilityScreen() {
  const { isLoading: isAuthLoading, session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [blocks, setBlocks] = useState<BlockView[]>([]);
  const [blockStart, setBlockStart] = useState('2026-08-12T17:00');
  const [blockEnd, setBlockEnd] = useState('2026-08-12T20:00');
  const [reason, setReason] = useState('');
  const [windowStart, setWindowStart] = useState('2026-08-12T17:30');
  const [windowEnd, setWindowEnd] = useState('2026-08-12T19:00');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isClubManager = Boolean(activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const coachTeamIds = useMemo(() => activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [], [activeWorkspace]);
  const canPlan = isClubManager || coachTeamIds.length > 0;
  const manageableTeamIds = isClubManager ? activeWorkspace?.teams.map((team) => team.id) ?? [] : coachTeamIds;

  const loadBlocks = useCallback(async () => {
    if (!supabase || !activeWorkspace || !session) return;
    const { data: membership } = await supabase.from('memberships').select('id').eq('club_id', activeWorkspace.clubId).eq('profile_id', session.user.id).maybeSingle();
    if (!membership) return;
    const { data, error: loadError } = await supabase.from('availability_blocks').select('id, starts_at, ends_at, reason').eq('membership_id', membership.id).order('starts_at');
    if (loadError) setError(loadError.message); else setBlocks((data ?? []) as BlockView[]);
  }, [activeWorkspace?.id, session?.user.id]);

  useEffect(() => { void loadBlocks(); }, [loadBlocks]);
  useEffect(() => { if (manageableTeamIds.length && selectedTeams.length === 0) setSelectedTeams(manageableTeamIds); }, [activeWorkspace?.id]);

  const addBlock = async () => {
    if (!supabase || !activeWorkspace) return;
    setIsSubmitting(true); setError(null);
    try {
      const { error: createError } = await supabase.rpc('create_availability_block', {
        target_club_id: activeWorkspace.clubId, block_starts_at: toIso(blockStart), block_ends_at: toIso(blockEnd), block_reason: reason,
      });
      if (createError) throw createError;
      setReason(''); await loadBlocks();
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Sperrzeit konnte nicht gespeichert werden.'); }
    setIsSubmitting(false);
  };

  const removeBlock = async (id: string) => {
    if (!supabase) return;
    const { error: deleteError } = await supabase.rpc('delete_availability_block', { target_block_id: id });
    if (deleteError) setError(deleteError.message); else await loadBlocks();
  };

  const calculate = async () => {
    if (!supabase || !activeWorkspace) return;
    setIsSubmitting(true); setError(null);
    try {
      const { data, error: planError } = await supabase.rpc('plan_team_availability', {
        target_club_id: activeWorkspace.clubId, target_team_ids: selectedTeams,
        window_starts_at: toIso(windowStart), window_ends_at: toIso(windowEnd),
      });
      if (planError) throw planError;
      setPlan((data ?? []).map((row: PlanRow) => ({ ...row, player_total: Number(row.player_total), player_available: Number(row.player_available), coach_total: Number(row.coach_total), coach_available: Number(row.coach_available) })));
    } catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Planung konnte nicht berechnet werden.'); }
    setIsSubmitting(false);
  };

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  return <ScrollView contentContainerStyle={styles.page}><View style={styles.shell}>
    <Text style={styles.eyebrow}>ZEITFENSTERPLANUNG</Text><Text style={styles.title}>Wer kann wann?</Text>
    <Text style={styles.subtitle}>Sperrzeiten fließen ein, bevor ein neuer Termin angelegt wird. So erkennst du geeignete Zeiten für ein oder mehrere Teams.</Text><ContextSwitcher />

    <View style={styles.card}><Text style={styles.cardTitle}>Meine Abwesenheit eintragen</Text><Text style={styles.helper}>Urlaub, Schule, Arbeit, Verletzung oder ein anderer Zeitraum, in dem du nicht verfügbar bist.</Text>
      <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Von</Text><TextInput onChangeText={setBlockStart} style={styles.input} value={blockStart} /></View><View style={styles.column}><Text style={styles.label}>Bis</Text><TextInput onChangeText={setBlockEnd} style={styles.input} value={blockEnd} /></View></View>
      <Text style={styles.label}>Grund (optional)</Text><TextInput onChangeText={setReason} placeholder="z. B. Arbeit" style={styles.input} value={reason} />
      <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={addBlock} style={styles.primaryButton}>{isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Sperrzeit speichern</Text>}</Pressable>
      {blocks.map((block) => <View key={block.id} style={styles.blockRow}><View><Text style={styles.blockTime}>{formatDate(block.starts_at)} – {formatDate(block.ends_at)}</Text><Text style={styles.helper}>{block.reason || 'Ohne Angabe'}</Text></View><Pressable accessibilityRole="button" onPress={() => removeBlock(block.id)} style={styles.deleteButton}><Text style={styles.deleteText}>Entfernen</Text></Pressable></View>)}
    </View>

    {canPlan ? <View style={styles.card}><Text style={styles.cardTitle}>Zeitfenster prüfen</Text><Text style={styles.helper}>Als Trainer kannst du deine Teams prüfen; Bereichs- und Vereinsadmins können alle Teams kombinieren.</Text>
      <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Beginn</Text><TextInput onChangeText={setWindowStart} style={styles.input} value={windowStart} /></View><View style={styles.column}><Text style={styles.label}>Ende</Text><TextInput onChangeText={setWindowEnd} style={styles.input} value={windowEnd} /></View></View>
      <Text style={styles.label}>Teams</Text><View style={styles.choices}>{activeWorkspace?.teams.filter((team) => manageableTeamIds.includes(team.id)).map((team) => { const selected = selectedTeams.includes(team.id); return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={team.id} onPress={() => setSelectedTeams((current) => selected ? current.filter((id) => id !== team.id) : [...current, team.id])} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{team.name}</Text></Pressable>; })}</View>
      <Pressable accessibilityRole="button" disabled={!selectedTeams.length || isSubmitting} onPress={calculate} style={[styles.primaryButton, !selectedTeams.length && styles.disabled]}><Text style={styles.primaryText}>Verfügbarkeit berechnen</Text></Pressable>
      {plan.length ? <View style={styles.planGrid}>{plan.map((row) => { const team = activeWorkspace?.teams.find((item) => item.id === row.team_id); const good = row.player_total > 0 && row.player_available >= Math.min(8, row.player_total) && row.coach_available >= 1; return <View key={row.team_id} style={styles.planCard}><Text style={styles.teamName}>{team?.name}</Text><Text style={styles.planValue}>{row.player_available}/{row.player_total} Spieler</Text><Text style={styles.planValue}>{row.coach_available}/{row.coach_total} Trainer</Text><Text style={[styles.rating, good ? styles.good : styles.warning]}>{good ? 'Gut geeignet' : 'Besetzung prüfen'}</Text></View>; })}</View> : null}
    </View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View></ScrollView>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20, paddingBottom: 48 }, shell: { alignSelf: 'center', maxWidth: 960, width: '100%' }, eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }, title: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 8 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 720 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 }, cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 }, columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, column: { flex: 1, minWidth: 230 }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 16 }, input: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 15, paddingHorizontal: 13, paddingVertical: 12 }, primaryButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, marginTop: 18, minHeight: 48, padding: 14 }, primaryText: { color: colors.surface, fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.38 },
  blockRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14 }, blockTime: { color: colors.ink, fontSize: 13, fontWeight: '800' }, deleteButton: { borderColor: '#fda29b', borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 }, deleteText: { color: '#b42318', fontSize: 11, fontWeight: '800' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, choiceActive: { backgroundColor: colors.blue, borderColor: colors.blue }, choiceText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, choiceTextActive: { color: colors.surface }, planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }, planCard: { backgroundColor: colors.canvas, borderRadius: 13, flex: 1, minWidth: 190, padding: 15 }, teamName: { color: colors.ink, fontSize: 15, fontWeight: '900' }, planValue: { color: colors.muted, fontSize: 13, marginTop: 6 }, rating: { fontSize: 12, fontWeight: '900', marginTop: 10 }, good: { color: colors.green }, warning: { color: colors.orange }, error: { color: '#b42318', fontSize: 13, marginTop: 14 },
});
