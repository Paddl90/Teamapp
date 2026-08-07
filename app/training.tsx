import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const activityLabels: Record<string, string> = {
  running: 'Laufen', stability: 'Stabilisation', strength: 'Kraft', mobility: 'Beweglichkeit',
  recovery: 'Regeneration', rehab: 'Reha', ball: 'Balltraining',
};
const statusLabels: Record<string, string> = { open: 'Offen', partial: 'Teilweise', completed: 'Erledigt', unable: 'Nicht möglich' };
type Player = { id: string; name: string };
type Entry = { id: string; membership_id: string; activity_type: string; performed_on: string; duration_minutes: number; distance_km: number | null; exertion: number | null; note: string | null; share_with_coaches: boolean };
type Task = { id: string; membership_id: string; title: string; activity_type: string; instructions: string | null; due_on: string; repetitions: number; status: string };

const today = () => new Date().toISOString().slice(0, 10);
const inSevenDays = () => { const date = new Date(); date.setDate(date.getDate() + 7); return date.toISOString().slice(0, 10); };

export default function TrainingScreen() {
  const { isLoading: isAuthLoading, session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [myMembershipId, setMyMembershipId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activityType, setActivityType] = useState('running');
  const [performedOn, setPerformedOn] = useState(today());
  const [duration, setDuration] = useState('30');
  const [distance, setDistance] = useState('');
  const [exertion, setExertion] = useState('5');
  const [note, setNote] = useState('');
  const [shareWithCoaches, setShareWithCoaches] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState('running');
  const [instructions, setInstructions] = useState('');
  const [dueOn, setDueOn] = useState(inSevenDays());
  const [repetitions, setRepetitions] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = Boolean(activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const coachTeamIds = activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [];
  const canManage = Boolean(teamId && (isAdmin || coachTeamIds.includes(teamId)));

  useEffect(() => { if (!teamId && activeWorkspace?.teams[0]) setTeamId(activeWorkspace.teams[0].id); }, [activeWorkspace?.id]);

  const load = useCallback(async () => {
    if (!supabase || !activeWorkspace || !session || !teamId) return;
    setIsLoading(true); setError(null);
    const membershipResult = await supabase.from('memberships').select('id').eq('club_id', activeWorkspace.clubId).eq('profile_id', session.user.id).maybeSingle();
    setMyMembershipId(membershipResult.data?.id ?? null);
    const assignmentResult = await supabase.from('team_memberships').select('membership_id, team_membership_roles(role)').eq('team_id', teamId);
    const playerIds = (assignmentResult.data ?? []).filter((row) => ((row.team_membership_roles ?? []) as Array<{ role: string }>).some((role) => role.role === 'player')).map((row) => row.membership_id);
    const membershipRows = playerIds.length ? await supabase.from('memberships').select('id,profile_id').in('id', playerIds) : { data: [], error: null };
    const profileIds = (membershipRows.data ?? []).map((row) => row.profile_id);
    const profileRows = profileIds.length ? await supabase.from('profiles').select('id,display_name').in('id', profileIds) : { data: [], error: null };
    setPlayers((membershipRows.data ?? []).map((member) => ({ id: member.id, name: profileRows.data?.find((profile) => profile.id === member.profile_id)?.display_name ?? 'Unbekannt' })));
    const [entryResult, taskResult] = await Promise.all([
      supabase.from('individual_training_entries').select('id,membership_id,activity_type,performed_on,duration_minutes,distance_km,exertion,note,share_with_coaches').eq('season_id', activeWorkspace.seasonId).order('performed_on', { ascending: false }),
      supabase.from('training_tasks').select('id,membership_id,title,activity_type,instructions,due_on,repetitions,status').eq('team_id', teamId).order('due_on'),
    ]);
    const firstError = membershipResult.error ?? assignmentResult.error ?? membershipRows.error ?? profileRows.error ?? entryResult.error ?? taskResult.error;
    if (firstError) setError(firstError.message);
    setEntries((entryResult.data ?? []) as Entry[]); setTasks((taskResult.data ?? []) as Task[]); setIsLoading(false);
  }, [activeWorkspace?.id, session?.user.id, teamId]);
  useEffect(() => { void load(); }, [load]);

  const myEntries = useMemo(() => entries.filter((entry) => entry.membership_id === myMembershipId), [entries, myMembershipId]);
  const sharedEntries = useMemo(() => entries.filter((entry) => entry.membership_id !== myMembershipId && players.some((player) => player.id === entry.membership_id)), [entries, myMembershipId, players]);
  const saveActivity = async () => {
    if (!supabase || !activeWorkspace) return;
    setIsSubmitting(true); setError(null);
    const parsedDistance = distance.trim() ? Number(distance.replace(',', '.')) : null;
    const { error: saveError } = await supabase.rpc('log_individual_training', {
      target_club_id: activeWorkspace.clubId, target_season_id: activeWorkspace.seasonId, target_activity_type: activityType,
      target_performed_on: performedOn, target_duration_minutes: Number(duration), target_distance_km: parsedDistance,
      target_exertion: exertion.trim() ? Number(exertion) : null, target_note: note, target_share_with_coaches: shareWithCoaches,
    });
    if (saveError) setError(saveError.message); else { setNote(''); setDistance(''); await load(); }
    setIsSubmitting(false);
  };
  const createTask = async () => {
    if (!supabase || !teamId || !selectedPlayerId) return;
    setIsSubmitting(true); setError(null);
    const { error: taskError } = await supabase.rpc('create_training_task', {
      target_team_id: teamId, target_membership_id: selectedPlayerId, task_title: taskTitle,
      target_activity_type: taskType, task_instructions: instructions, target_due_on: dueOn, target_repetitions: Number(repetitions),
    });
    if (taskError) setError(taskError.message); else { setTaskTitle(''); setInstructions(''); await load(); }
    setIsSubmitting(false);
  };
  const setStatus = async (taskId: string, status: string) => {
    if (!supabase) return; setError(null);
    const { error: statusError } = await supabase.rpc('set_training_task_status', { target_task_id: taskId, new_status: status });
    if (statusError) setError(statusError.message); else await load();
  };

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  return (
    <ScrollView contentContainerStyle={styles.page}><View style={styles.shell}>
      <Text style={styles.eyebrow}>INDIVIDUELLES TRAINING</Text><Text style={styles.title}>Aktivitäten & Vorgaben</Text>
      <Text style={styles.subtitle}>Eigene Einheiten dokumentieren und Trainingsaufgaben nachvollziehbar zwischen Trainer und Spieler abstimmen.</Text>
      <ContextSwitcher />
      <View style={styles.tabs}>{activeWorkspace?.teams.map((team) => <Pressable accessibilityRole="button" key={team.id} onPress={() => setTeamId(team.id)} style={[styles.tab, teamId === team.id && styles.active]}><Text style={[styles.choiceText, teamId === team.id && styles.activeText]}>{team.name}</Text></Pressable>)}</View>
      {isLoading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}

      <View style={styles.card}><Text style={styles.cardTitle}>Eigene Aktivität erfassen</Text>
        <Text style={styles.label}>Art</Text><View style={styles.choices}>{Object.entries(activityLabels).map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: activityType === value }} key={value} onPress={() => setActivityType(value)} style={[styles.choice, activityType === value && styles.active]}><Text style={[styles.choiceText, activityType === value && styles.activeText]}>{label}</Text></Pressable>)}</View>
        <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Datum</Text><TextInput placeholder="2026-08-10" value={performedOn} onChangeText={setPerformedOn} style={styles.input} /></View><View style={styles.column}><Text style={styles.label}>Dauer in Minuten</Text><TextInput placeholder="30" value={duration} onChangeText={setDuration} style={styles.input} /></View></View>
        <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Strecke in km</Text><TextInput placeholder="Optional" value={distance} onChangeText={setDistance} style={styles.input} /></View><View style={styles.column}><Text style={styles.label}>Belastung 1–10</Text><TextInput placeholder="5" value={exertion} onChangeText={setExertion} style={styles.input} /></View></View>
        <Text style={styles.label}>Notiz</Text><TextInput placeholder="Optional" value={note} onChangeText={setNote} style={styles.input} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: shareWithCoaches }} onPress={() => setShareWithCoaches((value) => !value)} style={[styles.consent, shareWithCoaches && styles.consentActive]}><Text style={styles.consentText}>{shareWithCoaches ? '✓ ' : ''}Diese Aktivität für meine Trainer freigeben</Text></Pressable>
        <Text style={styles.helper}>Du kannst die Freigabe für jede Aktivität einzeln entscheiden. Es erfolgt keine medizinische Bewertung.</Text>
        <Pressable accessibilityRole="button" disabled={Number(duration) < 1 || isSubmitting} onPress={saveActivity} style={styles.primary}><Text style={styles.primaryText}>Aktivität speichern</Text></Pressable>
      </View>

      {canManage ? <View style={styles.card}><Text style={styles.cardTitle}>Vorgabe erstellen</Text>
        <Text style={styles.label}>Spieler</Text><View style={styles.choices}>{players.map((player) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selectedPlayerId === player.id }} key={player.id} onPress={() => setSelectedPlayerId(player.id)} style={[styles.choice, selectedPlayerId === player.id && styles.active]}><Text style={[styles.choiceText, selectedPlayerId === player.id && styles.activeText]}>{player.name}</Text></Pressable>)}</View>
        <Text style={styles.label}>Titel</Text><TextInput placeholder="30 Minuten lockerer Lauf" value={taskTitle} onChangeText={setTaskTitle} style={styles.input} />
        <Text style={styles.label}>Art</Text><View style={styles.choices}>{Object.entries(activityLabels).map(([value, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: taskType === value }} key={value} onPress={() => setTaskType(value)} style={[styles.choice, taskType === value && styles.active]}><Text style={[styles.choiceText, taskType === value && styles.activeText]}>{label}</Text></Pressable>)}</View>
        <Text style={styles.label}>Beschreibung</Text><TextInput placeholder="Tempo und Hinweise" value={instructions} onChangeText={setInstructions} style={styles.input} />
        <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Fällig am</Text><TextInput placeholder="2026-08-17" value={dueOn} onChangeText={setDueOn} style={styles.input} /></View><View style={styles.column}><Text style={styles.label}>Wiederholungen</Text><TextInput placeholder="1" value={repetitions} onChangeText={setRepetitions} style={styles.input} /></View></View>
        <Pressable accessibilityRole="button" disabled={!selectedPlayerId || taskTitle.trim().length < 2 || isSubmitting} onPress={createTask} style={styles.primary}><Text style={styles.primaryText}>Vorgabe zuweisen</Text></Pressable>
      </View> : null}

      <View style={styles.card}><Text style={styles.cardTitle}>Vorgaben</Text>{tasks.length === 0 ? <Text style={styles.empty}>Noch keine Vorgaben vorhanden.</Text> : tasks.map((task) => {
        const isMine = task.membership_id === myMembershipId; return <View key={task.id} style={styles.row}><View style={styles.rowMain}><Text style={styles.rowTitle}>{task.title}</Text><Text style={styles.meta}>{players.find((player) => player.id === task.membership_id)?.name ?? 'Eigene Vorgabe'} · {activityLabels[task.activity_type]} · bis {new Intl.DateTimeFormat('de-DE').format(new Date(task.due_on))}</Text><Text style={styles.meta}>{task.repetitions}× · {statusLabels[task.status]}{task.instructions ? ` · ${task.instructions}` : ''}</Text></View>{isMine || canManage ? <View style={styles.actions}>{['partial','completed','unable'].map((status) => <Pressable accessibilityRole="button" key={status} onPress={() => setStatus(task.id, status)} style={[styles.statusButton, task.status === status && styles.active]}><Text style={[styles.statusText, task.status === status && styles.activeText]}>{statusLabels[status]}</Text></Pressable>)}</View> : null}</View>;
      })}</View>

      <View style={styles.card}><Text style={styles.cardTitle}>Meine Aktivitäten</Text>{myEntries.length === 0 ? <Text style={styles.empty}>Noch keine Aktivität dokumentiert.</Text> : myEntries.map((entry) => <View key={entry.id} style={styles.row}><View><Text style={styles.rowTitle}>{activityLabels[entry.activity_type]} · {entry.duration_minutes} Minuten</Text><Text style={styles.meta}>{new Intl.DateTimeFormat('de-DE').format(new Date(entry.performed_on))}{entry.distance_km !== null ? ` · ${entry.distance_km} km` : ''}{entry.exertion !== null ? ` · Belastung ${entry.exertion}/10` : ''}</Text><Text style={styles.meta}>{entry.share_with_coaches ? 'Für Trainer freigegeben' : 'Privat'}{entry.note ? ` · ${entry.note}` : ''}</Text></View></View>)}</View>
      {canManage ? <View style={styles.card}><Text style={styles.cardTitle}>Freigegebene Aktivitäten</Text>{sharedEntries.length === 0 ? <Text style={styles.empty}>Für dieses Team wurden noch keine weiteren Aktivitäten freigegeben.</Text> : sharedEntries.map((entry) => <View key={entry.id} style={styles.row}><View><Text style={styles.rowTitle}>{players.find((player) => player.id === entry.membership_id)?.name} · {activityLabels[entry.activity_type]}</Text><Text style={styles.meta}>{new Intl.DateTimeFormat('de-DE').format(new Date(entry.performed_on))} · {entry.duration_minutes} Minuten{entry.distance_km !== null ? ` · ${entry.distance_km} km` : ''}{entry.exertion !== null ? ` · Belastung ${entry.exertion}/10` : ''}</Text>{entry.note ? <Text style={styles.meta}>{entry.note}</Text> : null}</View></View>)}</View> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View></ScrollView>
  );
}

const styles = StyleSheet.create({
  page:{backgroundColor:colors.canvas,minHeight:'100%',padding:20,paddingBottom:48},shell:{alignSelf:'center',maxWidth:960,width:'100%'},eyebrow:{color:colors.blue,fontSize:11,fontWeight:'900',letterSpacing:1.4,marginTop:14},title:{color:colors.ink,fontSize:34,fontWeight:'900',marginTop:8},subtitle:{color:colors.muted,fontSize:15,lineHeight:22,marginTop:8},tabs:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:16},tab:{borderColor:colors.border,borderRadius:999,borderWidth:1,paddingHorizontal:12,paddingVertical:8},active:{backgroundColor:colors.ink,borderColor:colors.ink},activeText:{color:colors.surface},card:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:18,borderWidth:1,marginTop:18,padding:20},cardTitle:{color:colors.ink,fontSize:19,fontWeight:'900'},label:{color:colors.ink,fontSize:13,fontWeight:'800',marginBottom:7,marginTop:14},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{borderColor:colors.border,borderRadius:999,borderWidth:1,paddingHorizontal:11,paddingVertical:8},choiceText:{color:colors.muted,fontSize:12,fontWeight:'800'},input:{borderColor:colors.border,borderRadius:10,borderWidth:1,color:colors.ink,padding:12},columns:{flexDirection:'row',flexWrap:'wrap',gap:12},column:{flex:1,minWidth:220},consent:{borderColor:colors.border,borderRadius:10,borderWidth:1,marginTop:15,padding:12},consentActive:{backgroundColor:colors.blueSoft,borderColor:colors.blue},consentText:{color:colors.ink,fontSize:13,fontWeight:'800'},helper:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:7},primary:{alignItems:'center',backgroundColor:colors.ink,borderRadius:11,marginTop:15,padding:13},primaryText:{color:colors.surface,fontWeight:'900'},loader:{marginTop:20},row:{alignItems:'center',borderTopColor:colors.border,borderTopWidth:1,flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'space-between',paddingVertical:14},rowMain:{flex:1,minWidth:240},rowTitle:{color:colors.ink,fontSize:14,fontWeight:'900'},meta:{color:colors.muted,fontSize:11,lineHeight:17,marginTop:3},actions:{flexDirection:'row',flexWrap:'wrap',gap:6},statusButton:{borderColor:colors.border,borderRadius:8,borderWidth:1,padding:7},statusText:{color:colors.muted,fontSize:11,fontWeight:'800'},empty:{color:colors.faint,marginTop:16},error:{color:'#b42318',fontSize:13,marginTop:14},
});
