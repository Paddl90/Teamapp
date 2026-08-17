import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { FootballPitch } from '@/components/FootballPitch';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/theme/ThemeProvider';

const formations = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'];
const positions = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
const responseLabels: Record<string, string> = { yes: 'Zugesagt', maybe: 'Vielleicht', no: 'Abgesagt' };

type MatchEvent = { id: string; title: string; starts_at: string; event_teams: Array<{ team_id: string }> };
type Candidate = { membershipId: string; name: string; response: string | null; primary: string | null; secondary: string | null };
type Assignment = { squadRole: 'starting' | 'bench'; position: string | null; x: number | null; y: number | null };

const formationLayouts:Record<string,Array<{x:number;y:number;position:string}>>={
  '4-4-2':[{x:50,y:90,position:'GK'},{x:18,y:72,position:'FB'},{x:39,y:75,position:'CB'},{x:61,y:75,position:'CB'},{x:82,y:72,position:'FB'},{x:18,y:48,position:'W'},{x:39,y:52,position:'CM'},{x:61,y:52,position:'CM'},{x:82,y:48,position:'W'},{x:38,y:24,position:'ST'},{x:62,y:24,position:'ST'}],
  '4-3-3':[{x:50,y:90,position:'GK'},{x:18,y:72,position:'FB'},{x:39,y:75,position:'CB'},{x:61,y:75,position:'CB'},{x:82,y:72,position:'FB'},{x:28,y:50,position:'CM'},{x:50,y:56,position:'DM'},{x:72,y:50,position:'CM'},{x:18,y:24,position:'W'},{x:50,y:18,position:'ST'},{x:82,y:24,position:'W'}],
  '4-2-3-1':[{x:50,y:90,position:'GK'},{x:18,y:72,position:'FB'},{x:39,y:75,position:'CB'},{x:61,y:75,position:'CB'},{x:82,y:72,position:'FB'},{x:38,y:57,position:'DM'},{x:62,y:57,position:'DM'},{x:20,y:37,position:'W'},{x:50,y:40,position:'AM'},{x:80,y:37,position:'W'},{x:50,y:17,position:'ST'}],
  '3-5-2':[{x:50,y:90,position:'GK'},{x:25,y:72,position:'CB'},{x:50,y:76,position:'CB'},{x:75,y:72,position:'CB'},{x:12,y:48,position:'FB'},{x:35,y:52,position:'CM'},{x:50,y:42,position:'AM'},{x:65,y:52,position:'CM'},{x:88,y:48,position:'FB'},{x:38,y:20,position:'ST'},{x:62,y:20,position:'ST'}],
};

const formatDate = (value: string) => new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function MatchdayScreen() {
  const {colors}=useAppTheme(); const styles=createStyles(colors);
  const router = useRouter();
  const { isLoading: isAuthLoading, session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState('');
  const [venueSide, setVenueSide] = useState('home');
  const [formation, setFormation] = useState('4-3-3');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const isClubManager = Boolean(activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const coachTeamIds = activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [];

  const loadEvents = useCallback(async () => {
    if (!supabase || !activeWorkspace) return;
    setIsLoading(true);
    const { data, error: eventError } = await supabase.from('events').select('id, title, starts_at, event_teams(team_id)').eq('cohort_id', activeWorkspace.cohortId).eq('event_type', 'match').neq('status', 'cancelled').order('starts_at');
    if (eventError) setError(eventError.message);
    else {
      const rows = (data ?? []) as MatchEvent[]; setEvents(rows);
      if (!selectedEventId && rows[0]) setSelectedEventId(rows[0].id);
    }
    setIsLoading(false);
  }, [activeWorkspace?.id]);
  useEffect(() => { void loadEvents(); }, [loadEvents]);
  useFocusEffect(useCallback(() => { void loadEvents(); }, [loadEvents]));

  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const eventTeamIds = selectedEvent?.event_teams.map((team) => team.team_id) ?? [];
  const manageableEventTeams = activeWorkspace?.teams.filter((team) => eventTeamIds.includes(team.id) && (isClubManager || coachTeamIds.includes(team.id))) ?? [];
  useEffect(() => {
    const first = manageableEventTeams[0]?.id ?? null;
    if (selectedEventId && !manageableEventTeams.some((team) => team.id === selectedTeamId)) setSelectedTeamId(first);
  }, [selectedEventId, activeWorkspace?.id]);

  const loadPlan = useCallback(async () => {
    if (!supabase || !activeWorkspace || !selectedEventId || !selectedTeamId) { setCandidates([]); return; }
    setIsLoading(true); setError(null); setSavedStatus(null);
    const { data: assignmentRows } = await supabase.from('team_memberships').select('membership_id, team_membership_roles(role)').eq('team_id', selectedTeamId);
    const playerIds = (assignmentRows ?? []).filter((row) => ((row.team_membership_roles ?? []) as Array<{ role: string }>).some((role) => role.role === 'player')).map((row) => row.membership_id);
    const { data: memberships } = playerIds.length ? await supabase.from('memberships').select('id, profile_id, display_name').in('id', playerIds) : { data: [] };
    const profileIds = (memberships ?? []).map((row) => row.profile_id).filter((id): id is string => Boolean(id));
    const [profilesResult, positionsResult, responsesResult, planResult] = await Promise.all([
      profileIds.length ? supabase.from('profiles').select('id, display_name').in('id', profileIds) : Promise.resolve({ data: [] }),
      playerIds.length ? supabase.from('member_positions').select('membership_id, position_code, priority').in('membership_id', playerIds) : Promise.resolve({ data: [] }),
      playerIds.length ? supabase.from('event_responses').select('membership_id, response').eq('event_id', selectedEventId).in('membership_id', playerIds) : Promise.resolve({ data: [] }),
      supabase.from('match_plans').select('id, opponent, venue_side, formation, status, match_squad_entries(membership_id, squad_role, position_code, x_percent, y_percent)').eq('event_id', selectedEventId).eq('team_id', selectedTeamId).maybeSingle(),
    ]);
    setCandidates((memberships ?? []).map((member) => {
      const memberPositions = (positionsResult.data ?? []).filter((row) => row.membership_id === member.id);
      return { membershipId: member.id, name: member.display_name ?? (profilesResult.data ?? []).find((profile) => profile.id === member.profile_id)?.display_name ?? 'Unbenannt', response: (responsesResult.data ?? []).find((row) => row.membership_id === member.id)?.response ?? null, primary: memberPositions.find((row) => row.priority === 'primary')?.position_code ?? null, secondary: memberPositions.find((row) => row.priority === 'secondary')?.position_code ?? null };
    }));
    if (planResult.data) {
      setOpponent(planResult.data.opponent); setVenueSide(planResult.data.venue_side); setFormation(planResult.data.formation); setSavedStatus(planResult.data.status);
      const savedFormation=planResult.data.formation;
      setAssignments(Object.fromEntries(((planResult.data.match_squad_entries ?? []) as Array<{ membership_id:string;squad_role:'starting'|'bench';position_code:string|null;x_percent:number|null;y_percent:number|null }>).map((entry,index)=>{const fallback=formationLayouts[savedFormation]?.[index]??{x:50,y:50,position:'CM'};return [entry.membership_id,{squadRole:entry.squad_role,position:entry.position_code??fallback.position,x:entry.squad_role==='starting'?Number(entry.x_percent??fallback.x):null,y:entry.squad_role==='starting'?Number(entry.y_percent??fallback.y):null}]})));
    } else { setOpponent(''); setAssignments({}); }
    setIsLoading(false);
  }, [activeWorkspace?.id, selectedEventId, selectedTeamId]);
  useEffect(() => { void loadPlan(); }, [loadPlan]);

  const toggleNomination = (candidate: Candidate) => setAssignments((current) => current[candidate.membershipId] ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== candidate.membershipId)) : { ...current, [candidate.membershipId]: { squadRole:'bench',position:candidate.primary,x:null,y:null } });
  const setRole = (id:string,squadRole:'starting'|'bench') => setAssignments((current)=>{const index=Object.values(current).filter((entry)=>entry.squadRole==='starting').length;const fallback=formationLayouts[formation]?.[Math.min(index,10)]??{x:50,y:50,position:'CM'};return {...current,[id]:{...current[id]!,squadRole,position:squadRole==='bench'?null:current[id]?.position??fallback.position,x:squadRole==='bench'?null:current[id]?.x??fallback.x,y:squadRole==='bench'?null:current[id]?.y??fallback.y}}});
  const setPosition = (id:string,position:string) => setAssignments((current)=>({...current,[id]:{...current[id]!,squadRole:'starting',position}}));
  const movePlayer=useCallback((id:string,x:number,y:number)=>setAssignments((current)=>({...current,[id]:{...current[id]!,x,y}})),[]);
  const applyFormation=(value:string)=>{setFormation(value);setAssignments((current)=>{let index=0;return Object.fromEntries(Object.entries(current).map(([id,entry])=>{if(entry.squadRole==='bench')return [id,entry];const slot=formationLayouts[value]?.[Math.min(index++,10)]??{x:50,y:50,position:'CM'};return [id,{...entry,x:slot.x,y:slot.y,position:slot.position}] }))})};
  const startingCount = Object.values(assignments).filter((entry) => entry.squadRole === 'starting').length;

  const save = async (status: 'draft' | 'published') => {
    if (!supabase || !selectedEventId || !selectedTeamId || opponent.trim().length < 2) return;
    setIsSubmitting(true); setError(null);
    const { error: saveError } = await supabase.rpc('save_match_plan', { target_event_id:selectedEventId,target_team_id:selectedTeamId,target_opponent:opponent,target_venue_side:venueSide,target_formation:formation,target_status:status,squad_entries:Object.entries(assignments).map(([membershipId,entry],index)=>({membership_id:membershipId,squad_role:entry.squadRole,position_code:entry.position,sort_order:index,x_percent:entry.x,y_percent:entry.y})) });
    if (saveError) setError(saveError.message); else { setSavedStatus(status); await loadPlan(); }
    setIsSubmitting(false);
  };

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;
  return <ScrollView contentContainerStyle={styles.page}><View style={styles.shell}>
    <Text style={styles.eyebrow}>SPIELTAG</Text><Text style={styles.title}>Kader & Aufstellung</Text><Text style={styles.subtitle}>Nominierung, Formation, Startelf und Ersatzbank greifen auf Terminantworten und Saisonpositionen zurück.</Text><ContextSwitcher />
    {!isLoading && events.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Noch kein Spieltermin</Text><Text style={styles.helper}>Lege zuerst unter Termine einen Termin der Art „Spiel“ an.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/events')} style={styles.primaryButton}><Text style={styles.primaryText}>Spieltermin anlegen</Text></Pressable></View> : null}
    {events.length ? <>
      <View style={styles.card}><Text style={styles.cardTitle}>Spiel auswählen</Text><View style={styles.choices}>{events.map((event) => <Pressable accessibilityRole="button" key={event.id} onPress={() => setSelectedEventId(event.id)} style={[styles.choice, selectedEventId === event.id && styles.choiceActive]}><Text style={[styles.choiceText, selectedEventId === event.id && styles.choiceTextActive]}>{event.title} · {formatDate(event.starts_at)}</Text></Pressable>)}</View><Text style={styles.label}>Mannschaft</Text><View style={styles.choices}>{manageableEventTeams.map((team) => <Pressable accessibilityRole="button" key={team.id} onPress={() => setSelectedTeamId(team.id)} style={[styles.choice, selectedTeamId === team.id && styles.choiceActive]}><Text style={[styles.choiceText, selectedTeamId === team.id && styles.choiceTextActive]}>{team.name}</Text></Pressable>)}</View>
        <Text style={styles.label}>Gegner</Text><TextInput onChangeText={setOpponent} placeholder="SV Gegner" style={styles.input} value={opponent} /><Text style={styles.label}>Spielort</Text><View style={styles.choices}>{([{ value: 'home', label: 'Heim' }, { value: 'away', label: 'Auswärts' }, { value: 'neutral', label: 'Neutral' }]).map((option) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: venueSide === option.value }} key={option.value} onPress={() => setVenueSide(option.value)} style={[styles.choice, venueSide === option.value && styles.choiceActive]}><Text style={[styles.choiceText, venueSide === option.value && styles.choiceTextActive]}>{option.label}</Text></Pressable>)}</View><Text style={styles.label}>Formation</Text><View style={styles.choices}>{formations.map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: formation === value }} key={value} onPress={() => applyFormation(value)} style={[styles.choice, formation === value && styles.choiceActive]}><Text style={[styles.choiceText, formation === value && styles.choiceTextActive]}>{value}</Text></Pressable>)}</View>
      </View>
      <View style={styles.card}><View style={styles.cardHeader}><Text style={styles.cardTitle}>Spieler nominieren</Text><Text style={styles.counter}>{startingCount} Startelf · {Object.keys(assignments).length - startingCount} Bank</Text></View>{isLoading ? <ActivityIndicator color={colors.blue} /> : null}{candidates.map((candidate) => { const assigned = assignments[candidate.membershipId]; return <View key={candidate.membershipId} style={styles.playerRow}><View><Text style={styles.playerName}>{candidate.name}</Text><Text style={styles.playerMeta}>{candidate.primary ? `${candidate.primary}${candidate.secondary ? ` / ${candidate.secondary}` : ''}` : 'Position offen'} · {candidate.response ? responseLabels[candidate.response] : 'Antwort offen'}</Text></View><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(assigned) }} onPress={() => toggleNomination(candidate)} style={[styles.nominate, assigned && styles.nominateActive]}><Text style={[styles.nominateText, assigned && styles.nominateTextActive]}>{assigned ? 'Nominiert' : 'Nominieren'}</Text></Pressable>{assigned ? <View style={styles.assignmentControls}><View style={styles.choices}><Pressable accessibilityRole="button" onPress={() => setRole(candidate.membershipId,'starting')} style={[styles.miniChoice, assigned.squadRole === 'starting' && styles.choiceActive]}><Text style={[styles.miniText, assigned.squadRole === 'starting' && styles.choiceTextActive]}>Startelf</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setRole(candidate.membershipId,'bench')} style={[styles.miniChoice, assigned.squadRole === 'bench' && styles.choiceActive]}><Text style={[styles.miniText, assigned.squadRole === 'bench' && styles.choiceTextActive]}>Bank</Text></Pressable></View>{assigned.squadRole === 'starting' ? <View style={styles.positions}>{positions.map((position) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: assigned.position === position }} key={position} onPress={() => setPosition(candidate.membershipId, position)} style={[styles.position, assigned.position === position && styles.positionActive]}><Text style={[styles.positionText, assigned.position === position && styles.choiceTextActive]}>{position}</Text></Pressable>)}</View> : null}</View> : null}</View>; })}</View>
      <View style={styles.card}><Text style={styles.cardTitle}>Aufstellungsfeld · {formation}</Text><Text style={styles.helper}>Spielerkarten direkt auf dem Feld verschieben. Die Position wird beim Speichern übernommen.</Text><FootballPitch editable onMove={movePlayer} players={Object.entries(assignments).filter(([,entry])=>entry.squadRole==='starting'&&entry.x!==null&&entry.y!==null).map(([id,entry])=>({id,name:candidates.find((candidate)=>candidate.membershipId===id)?.name??'Spieler',label:entry.position??undefined,x:entry.x!,y:entry.y!}))}/><Text style={styles.benchTitle}>Ersatzbank</Text><Text style={styles.helper}>{Object.entries(assignments).filter(([,entry]) => entry.squadRole === 'bench').map(([id]) => candidates.find((candidate) => candidate.membershipId === id)?.name).join(' · ') || 'Noch niemand auf der Bank'}</Text>{savedStatus ? <Text style={styles.success}>{savedStatus === 'published' ? 'Aufstellung veröffentlicht' : 'Entwurf gespeichert'}</Text> : null}{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.actions}>{savedStatus === 'published' ? <Pressable accessibilityRole="button" onPress={() => router.push('/match-report')} style={styles.secondaryButton}><Text style={styles.secondaryText}>Ergebnis & Ereignisse</Text></Pressable> : null}<Pressable accessibilityRole="button" disabled={isSubmitting || opponent.trim().length < 2} onPress={() => save('draft')} style={styles.secondaryButton}><Text style={styles.secondaryText}>Als Entwurf speichern</Text></Pressable><Pressable accessibilityRole="button" disabled={isSubmitting || opponent.trim().length < 2} onPress={() => save('published')} style={styles.primaryButton}><Text style={styles.primaryText}>Aufstellung veröffentlichen</Text></Pressable></View></View>
    </> : null}
  </View></ScrollView>;
}

const createStyles=(colors:ReturnType<typeof useAppTheme>['colors'])=>StyleSheet.create({
  page:{backgroundColor:colors.canvas,minHeight:'100%',padding:20,paddingBottom:48},shell:{alignSelf:'center',maxWidth:1040,width:'100%'},eyebrow:{color:colors.blue,fontSize:11,fontWeight:'900',letterSpacing:1.4,marginTop:14},title:{color:colors.ink,fontSize:34,fontWeight:'900',marginTop:8},subtitle:{color:colors.muted,fontSize:15,lineHeight:22,marginTop:8,maxWidth:760},card:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:18,borderWidth:1,marginTop:18,padding:20},cardTitle:{color:colors.ink,fontSize:19,fontWeight:'900'},helper:{color:colors.muted,fontSize:12,marginTop:5},label:{color:colors.ink,fontSize:13,fontWeight:'800',marginBottom:8,marginTop:16},input:{borderColor:colors.border,borderRadius:10,borderWidth:1,color:colors.ink,fontSize:15,paddingHorizontal:13,paddingVertical:12},choices:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:10},choice:{borderColor:colors.border,borderRadius:999,borderWidth:1,paddingHorizontal:12,paddingVertical:8},choiceActive:{backgroundColor:colors.blue,borderColor:colors.blue},choiceText:{color:colors.muted,fontSize:12,fontWeight:'800'},choiceTextActive:{color:colors.surface},cardHeader:{alignItems:'center',flexDirection:'row',justifyContent:'space-between'},counter:{color:colors.blue,fontSize:12,fontWeight:'900'},playerRow:{borderTopColor:colors.border,borderTopWidth:1,paddingVertical:14},playerName:{color:colors.ink,fontSize:15,fontWeight:'900'},playerMeta:{color:colors.muted,fontSize:12,marginTop:3},nominate:{alignSelf:'flex-start',borderColor:colors.border,borderRadius:9,borderWidth:1,marginTop:9,paddingHorizontal:10,paddingVertical:7},nominateActive:{backgroundColor:colors.ink,borderColor:colors.ink},nominateText:{color:colors.muted,fontSize:12,fontWeight:'800'},nominateTextActive:{color:colors.surface},assignmentControls:{marginTop:8},miniChoice:{borderColor:colors.border,borderRadius:8,borderWidth:1,paddingHorizontal:10,paddingVertical:6},miniText:{color:colors.muted,fontSize:11,fontWeight:'800'},positions:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8},position:{backgroundColor:colors.canvas,borderRadius:7,paddingHorizontal:9,paddingVertical:6},positionActive:{backgroundColor:colors.blue},positionText:{color:colors.muted,fontSize:11,fontWeight:'900'},pitch:{alignItems:'center',backgroundColor:'#287a4b',borderColor:'#dff7ea',borderRadius:16,borderWidth:2,flexDirection:'row',flexWrap:'wrap',gap:12,justifyContent:'center',marginTop:15,minHeight:260,padding:20},pitchPlayer:{alignItems:'center',backgroundColor:colors.surface,borderRadius:10,minWidth:110,padding:9},pitchPosition:{color:colors.blue,fontSize:11,fontWeight:'900'},pitchName:{color:colors.ink,fontSize:11,fontWeight:'800',marginTop:3},benchTitle:{color:colors.ink,fontSize:13,fontWeight:'900',marginTop:15},actions:{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'flex-end',marginTop:18},primaryButton:{alignItems:'center',backgroundColor:colors.ink,borderRadius:11,padding:13},primaryText:{color:colors.surface,fontWeight:'900'},secondaryButton:{borderColor:colors.border,borderRadius:11,borderWidth:1,padding:13},secondaryText:{color:colors.ink,fontWeight:'800'},success:{color:colors.green,fontSize:13,fontWeight:'900',marginTop:12},error:{color:'#b42318',fontSize:13,marginTop:12},
});
