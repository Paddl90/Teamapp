import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

type TeamAssignment = { team_id: string; membership_id: string; team_membership_roles: Array<{ role: string }> };
type EventRow = {
  id: string;
  event_type: string;
  event_teams: Array<{ team_id: string }>;
  event_responses: Array<{ membership_id: string; response: string }>;
  event_attendance: Array<{ membership_id: string; status: string }>;
};
type MatchPlanRow = {
  id: string;
  team_id: string;
  status: string;
  match_squad_entries: Array<{ membership_id: string; squad_role: string }>;
  match_results: Array<{ match_minutes: number; status: string }> | { match_minutes: number; status: string } | null;
  match_incidents: Array<{ incident_type: string; minute: number; membership_id: string; related_membership_id: string | null }>;
};
type PlayerStatistic = {
  membershipId: string;
  name: string;
  teamIds: string[];
  events: number;
  yes: number;
  no: number;
  maybe: number;
  open: number;
  starts: number;
  bench: number;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  trainingRecorded: number;
  trainingPresent: number;
};

const percent = (value: number, total: number) => total > 0 ? Math.round((value / total) * 100) : 0;
const resultFor = (plan: MatchPlanRow) => Array.isArray(plan.match_results) ? plan.match_results[0] : plan.match_results;

export default function StatisticsScreen() {
  const { session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<EventRow[]>([]);
  const [matchPlans, setMatchPlans] = useState<MatchPlanRow[]>([]);
  const [viewerMembershipId, setViewerMembershipId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !activeWorkspace) return;
    setIsLoading(true);
    setError(null);
    const teamIds = activeWorkspace.teams.map((team) => team.id);

    const [assignmentResult, eventResult, matchResult] = await Promise.all([
      teamIds.length
        ? supabase.from('team_memberships').select('team_id, membership_id, team_membership_roles(role)').in('team_id', teamIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('events')
        .select('id, event_type, event_teams(team_id), event_responses(membership_id, response), event_attendance(membership_id, status)')
        .eq('cohort_id', activeWorkspace.cohortId)
        .eq('season_id', activeWorkspace.seasonId)
        .neq('status', 'cancelled'),
      teamIds.length
        ? supabase.from('match_plans').select('id, team_id, status, match_squad_entries(membership_id, squad_role), match_results(match_minutes, status), match_incidents(incident_type, minute, membership_id, related_membership_id)').in('team_id', teamIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const firstError = assignmentResult.error ?? eventResult.error ?? matchResult.error;
    if (firstError) {
      setError(firstError.message);
      setIsLoading(false);
      return;
    }

    const playerAssignments = ((assignmentResult.data ?? []) as TeamAssignment[]).filter((row) =>
      row.team_membership_roles.some((role) => role.role === 'player'),
    );
    const membershipIds = [...new Set(playerAssignments.map((row) => row.membership_id))];
    const membershipResult = membershipIds.length
      ? await supabase.from('memberships').select('id, profile_id').in('id', membershipIds)
      : { data: [], error: null };
    if (membershipResult.error) {
      setError(membershipResult.error.message);
      setIsLoading(false);
      return;
    }
    const profileIds = (membershipResult.data ?? []).map((row) => row.profile_id);
    const profileResult = profileIds.length
      ? await supabase.from('profiles').select('id, display_name').in('id', profileIds)
      : { data: [], error: null };
    if (profileResult.error) {
      setError(profileResult.error.message);
      setIsLoading(false);
      return;
    }
    const profileById = new Map((profileResult.data ?? []).map((row) => [row.id, row.display_name]));
    setViewerMembershipId((membershipResult.data ?? []).find((row) => row.profile_id === session?.user.id)?.id ?? null);
    setNames(new Map((membershipResult.data ?? []).map((row) => [row.id, profileById.get(row.profile_id) ?? 'Unbekannt'])));
    setAssignments(playerAssignments);
    setEvents((eventResult.data ?? []) as EventRow[]);
    setMatchPlans((matchResult.data ?? []) as unknown as MatchPlanRow[]);
    setIsLoading(false);
  }, [activeWorkspace?.id, session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  const selectedTeamIds = useMemo(
    () => selectedTeamId ? [selectedTeamId] : activeWorkspace?.teams.map((team) => team.id) ?? [],
    [activeWorkspace, selectedTeamId],
  );

  const statistics = useMemo(() => {
    const isClubManager = activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin') ?? false;
    const managedTeamIds = isClubManager
      ? selectedTeamIds
      : activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [];
    const visibleAssignments = assignments.filter((row) =>
      selectedTeamIds.includes(row.team_id) && (managedTeamIds.includes(row.team_id) || row.membership_id === viewerMembershipId),
    );
    const membershipIds = [...new Set(visibleAssignments.map((row) => row.membership_id))];
    const visibleEvents = events.filter((event) => event.event_teams.some((team) => selectedTeamIds.includes(team.team_id)));
    const visiblePlans = matchPlans.filter((plan) => selectedTeamIds.includes(plan.team_id) && plan.status === 'published');

    const players: PlayerStatistic[] = membershipIds.map((membershipId) => {
      const teamIds = [...new Set(visibleAssignments.filter((row) => row.membership_id === membershipId).map((row) => row.team_id))];
      const targetedEvents = visibleEvents.filter((event) => event.event_teams.some((team) => teamIds.includes(team.team_id)));
      const responses = targetedEvents.map((event) => event.event_responses.find((response) => response.membership_id === membershipId)?.response ?? 'open');
      const squadEntries = visiblePlans.flatMap((plan) => plan.match_squad_entries.filter((entry) => entry.membership_id === membershipId));
      const completedPlans = visiblePlans.filter((plan) => resultFor(plan)?.status === 'completed');
      const appearances = completedPlans.filter((plan) => {
        const squad = plan.match_squad_entries.find((entry) => entry.membership_id === membershipId);
        return squad?.squad_role === 'starting' || plan.match_incidents.some((incident) => incident.incident_type === 'substitution' && incident.related_membership_id === membershipId);
      }).length;
      const minutes = completedPlans.reduce((sum, plan) => {
        const squad = plan.match_squad_entries.find((entry) => entry.membership_id === membershipId);
        const total = resultFor(plan)?.match_minutes ?? 0;
        if (squad?.squad_role === 'starting') {
          const substituted = plan.match_incidents.find((incident) => incident.incident_type === 'substitution' && incident.membership_id === membershipId);
          return sum + Math.min(total, substituted?.minute ?? total);
        }
        const substituted = plan.match_incidents.find((incident) => incident.incident_type === 'substitution' && incident.related_membership_id === membershipId);
        return sum + (substituted ? Math.max(0, total - substituted.minute) : 0);
      }, 0);
      const incidents = completedPlans.flatMap((plan) => plan.match_incidents);
      const trainingAttendance = targetedEvents.filter((event)=>event.event_type==='training').flatMap((event)=>event.event_attendance.filter((entry)=>entry.membership_id===membershipId));
      return {
        membershipId,
        name: names.get(membershipId) ?? 'Unbekannt',
        teamIds,
        events: targetedEvents.length,
        yes: responses.filter((response) => response === 'yes').length,
        no: responses.filter((response) => response === 'no').length,
        maybe: responses.filter((response) => response === 'maybe').length,
        open: responses.filter((response) => response === 'open').length,
        starts: squadEntries.filter((entry) => entry.squad_role === 'starting').length,
        bench: squadEntries.filter((entry) => entry.squad_role === 'bench').length,
        appearances,
        minutes,
        goals: incidents.filter((incident) => incident.incident_type === 'goal' && incident.membership_id === membershipId).length,
        assists: incidents.filter((incident) => incident.incident_type === 'goal' && incident.related_membership_id === membershipId).length,
        yellowCards: incidents.filter((incident) => incident.incident_type === 'yellow_card' && incident.membership_id === membershipId).length,
        redCards: incidents.filter((incident) => incident.incident_type === 'red_card' && incident.membership_id === membershipId).length,
        trainingRecorded: trainingAttendance.length,
        trainingPresent: trainingAttendance.filter((entry)=>entry.status==='present').length,
      };
    }).sort((a, b) => b.yes - a.yes || a.name.localeCompare(b.name, 'de'));

    const possibleResponses = players.reduce((sum, player) => sum + player.events, 0);
    const yes = players.reduce((sum, player) => sum + player.yes, 0);
    const responded = players.reduce((sum, player) => sum + player.yes + player.no + player.maybe, 0);
    const trainingRecorded=players.reduce((sum,player)=>sum+player.trainingRecorded,0);const trainingPresent=players.reduce((sum,player)=>sum+player.trainingPresent,0);
    return { players, visibleEvents, visiblePlans, possibleResponses, yes, responded,trainingRecorded,trainingPresent };
  }, [activeWorkspace, assignments, events, matchPlans, names, selectedTeamIds, viewerMembershipId]);

  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  const teamName = (teamId: string) => activeWorkspace?.teams.find((team) => team.id === teamId)?.name ?? '';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>STATISTIK</Text>
        <Text style={styles.title}>Beteiligung & Einsätze</Text>
        <Text style={styles.subtitle}>Saisonwerte für den gesamten Jahrgang oder einzelne Teams. Mehrfach zugeordnete Spieler werden in der Gesamtansicht nur einmal geführt.</Text>
        <ContextSwitcher />

        <View style={styles.tabs}>
          <Pressable accessibilityRole="button" onPress={() => setSelectedTeamId(null)} style={[styles.tab, selectedTeamId === null && styles.tabActive]}>
            <Text style={[styles.tabText, selectedTeamId === null && styles.tabTextActive]}>Gesamt</Text>
          </Pressable>
          {activeWorkspace?.teams.map((team) => (
            <Pressable accessibilityRole="button" key={team.id} onPress={() => setSelectedTeamId(team.id)} style={[styles.tab, selectedTeamId === team.id && styles.tabActive]}>
              <Text style={[styles.tabText, selectedTeamId === team.id && styles.tabTextActive]}>{team.name}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isLoading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : (
          <>
            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.metricLabel}>Termine</Text><Text style={styles.metricValue}>{statistics.visibleEvents.length}</Text><Text style={styles.metricDetail}>in dieser Saison</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Zusagen</Text><Text style={styles.metricValue}>{percent(statistics.yes, statistics.possibleResponses)} %</Text><Text style={styles.metricDetail}>{statistics.yes} von {statistics.possibleResponses}</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Rücklauf</Text><Text style={styles.metricValue}>{percent(statistics.responded, statistics.possibleResponses)} %</Text><Text style={styles.metricDetail}>beantwortete Teilnahmen</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Trainingsanwesenheit</Text><Text style={styles.metricValue}>{percent(statistics.trainingPresent,statistics.trainingRecorded)} %</Text><Text style={styles.metricDetail}>{statistics.trainingPresent} von {statistics.trainingRecorded} erfasst</Text></View>
              <View style={styles.metric}><Text style={styles.metricLabel}>Aufstellungen</Text><Text style={styles.metricValue}>{statistics.visiblePlans.length}</Text><Text style={styles.metricDetail}>veröffentlicht</Text></View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Spielerübersicht</Text>
              <Text style={styles.helper}>Quote = Zusagen im Verhältnis zu allen Terminen, denen der Spieler über mindestens eines seiner Teams zugeordnet war.</Text>
              {statistics.players.length === 0 ? <Text style={styles.empty}>Für diesen Bereich sind noch keine Spieler zugeordnet.</Text> : null}
              {statistics.players.map((player) => (
                <View key={player.membershipId} style={styles.playerRow}>
                  <View style={styles.playerIdentity}>
                    <Text style={styles.playerName}>{player.name}</Text>
                    <Text style={styles.playerTeams}>{player.teamIds.map(teamName).join(' · ')}</Text>
                  </View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{percent(player.yes, player.events)} %</Text><Text style={styles.playerLabel}>Quote</Text></View>
                  <View style={styles.playerMetric}><Text style={[styles.playerValue, styles.positive]}>{player.yes}</Text><Text style={styles.playerLabel}>Dabei</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.no}</Text><Text style={styles.playerLabel}>Absage</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.open}</Text><Text style={styles.playerLabel}>Offen</Text></View>
                  <View style={styles.playerMetric}><Text style={[styles.playerValue,styles.positive]}>{percent(player.trainingPresent,player.trainingRecorded)} %</Text><Text style={styles.playerLabel}>Training</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.starts}</Text><Text style={styles.playerLabel}>Startelf</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.appearances}</Text><Text style={styles.playerLabel}>Einsätze</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.minutes}</Text><Text style={styles.playerLabel}>Minuten</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.goals}</Text><Text style={styles.playerLabel}>Tore</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.assists}</Text><Text style={styles.playerLabel}>Vorlagen</Text></View>
                  <View style={styles.playerMetric}><Text style={styles.playerValue}>{player.yellowCards}/{player.redCards}</Text><Text style={styles.playerLabel}>Gelb/Rot</Text></View>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20, paddingBottom: 48 },
  shell: { alignSelf: 'center', maxWidth: 1040, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 760 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  tab: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  tabActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: colors.surface },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, flex: 1, minWidth: 180, padding: 18 },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  metricValue: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 8 },
  metricDetail: { color: colors.faint, fontSize: 11, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  playerRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16, paddingTop: 16 },
  playerIdentity: { flex: 1, minWidth: 190 },
  playerName: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  playerTeams: { color: colors.muted, fontSize: 11, marginTop: 4 },
  playerMetric: { alignItems: 'center', minWidth: 54 },
  playerValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  positive: { color: colors.green },
  playerLabel: { color: colors.faint, fontSize: 10, fontWeight: '700', marginTop: 3 },
  error: { color: '#b42318', fontSize: 13, marginTop: 16 },
  loader: { marginTop: 28 },
  empty: { color: colors.faint, marginTop: 18 },
});
