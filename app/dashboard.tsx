import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const demoMetrics = [
  { label: 'Spieler', value: '54', detail: 'auf 3 Teams verteilt' },
  { label: 'Trainer', value: '6', detail: '4 heute verfügbar' },
  { label: 'Offene Antworten', value: '9', detail: 'für Dienstag' },
] as const;

type DashboardData = {
  playerCount: number;
  coachCount: number;
  openResponses: number;
  nextEvent: null | {
    title: string;
    startsAt: string;
    yes: number;
    no: number;
    open: number;
    total: number;
  };
};

type DashboardAction = {
  description: string;
  label: string;
  path: '/accept-invite' | '/availability' | '/events' | '/funds' | '/matchday' | '/members' | '/notifications' | '/squad' | '/statistics' | '/training';
};

const initialData: DashboardData = { playerCount: 0, coachCount: 0, openResponses: 0, nextEvent: null };

export default function DashboardScreen() {
  const router = useRouter();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const { isLoading, session, signOut } = useAuth();
  const isDemo = demo === '1';
  const { activeTeamId, activeWorkspace: workspace, error, isLoading: isWorkspaceLoading } = useWorkspace();
  const [dashboardData, setDashboardData] = useState<DashboardData>(initialData);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!supabase || !workspace || isDemo) return;
    setDashboardError(null);
    const selectedTeamIds = activeTeamId ? [activeTeamId] : workspace.teams.map((team) => team.id);
    if (!selectedTeamIds.length) { setDashboardData(initialData); return; }

    const [{ data: assignmentRows, error: assignmentError }, { data: eventRows, error: eventError }] = await Promise.all([
      supabase.from('team_memberships').select('membership_id,team_id,team_membership_roles(role)').in('team_id', selectedTeamIds),
      supabase.from('events').select('id,title,starts_at,event_teams(team_id),event_responses(membership_id,response)').eq('cohort_id', workspace.cohortId).eq('status', 'published').gte('ends_at', new Date().toISOString()).order('starts_at').limit(20),
    ]);
    if (assignmentError || eventError) { setDashboardError(assignmentError?.message ?? eventError?.message ?? 'Dashboard konnte nicht geladen werden.'); return; }

    const players = new Set<string>();
    const coaches = new Set<string>();
    for (const assignment of assignmentRows ?? []) {
      const roles = (assignment.team_membership_roles ?? []) as Array<{ role: string }>;
      if (roles.some((role) => role.role === 'player')) players.add(assignment.membership_id);
      if (roles.some((role) => role.role === 'coach')) coaches.add(assignment.membership_id);
    }

    const relevantEvents = (eventRows ?? []).filter((event) => (event.event_teams ?? []).some((team) => selectedTeamIds.includes(team.team_id)));
    let openResponses = 0;
    let nextEvent: DashboardData['nextEvent'] = null;
    for (const [index, event] of relevantEvents.entries()) {
      const targetTeamIds = (event.event_teams ?? []).map((team) => team.team_id).filter((id) => selectedTeamIds.includes(id));
      const participants = new Set((assignmentRows ?? []).filter((row) => targetTeamIds.includes(row.team_id)).map((row) => row.membership_id));
      const responses = (event.event_responses ?? []).filter((response) => participants.has(response.membership_id));
      const eventOpen = Math.max(0, participants.size - responses.length);
      openResponses += eventOpen;
      if (index === 0) nextEvent = {
        title: event.title, startsAt: event.starts_at, total: participants.size, open: eventOpen,
        yes: responses.filter((response) => response.response === 'yes').length,
        no: responses.filter((response) => response.response === 'no').length,
      };
    }
    setDashboardData({ playerCount: players.size, coachCount: coaches.size, openResponses, nextEvent });
  }, [activeTeamId, isDemo, workspace?.id]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  const nextEventDate = dashboardData.nextEvent ? new Date(dashboardData.nextEvent.startsAt) : null;

  if (!isLoading && !session && !isDemo) return <Redirect href="/sign-in" />;
  if (!isDemo && session && !isWorkspaceLoading && !workspace && !error) {
    return <Redirect href="/setup" />;
  }

  const activeTeam = workspace?.teams.find((team) => team.id === activeTeamId);
  const context = isDemo
    ? 'Jugendbereich · Gesamt'
    : workspace
      ? `${workspace.cohortName} · ${activeTeam?.name ?? 'Gesamt'}`
      : 'Arbeitsbereich wird geladen';
  const displayName = session?.user.user_metadata?.display_name as string | undefined;
  const contextTeamRoles = activeTeam ? activeTeam.roles : [...new Set(workspace?.teams.flatMap((team) => team.roles) ?? [])];
  const isClubManager = Boolean(workspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const isCoach = isClubManager || contextTeamRoles.includes('coach');
  const isPlayer = contextTeamRoles.includes('player');
  const isGuardian = Boolean(workspace?.clubRoles.includes('guardian') || contextTeamRoles.includes('guardian'));
  const roleLabels = [isClubManager && 'Admin', isCoach && !isClubManager && 'Trainer', isPlayer && 'Spieler', isGuardian && 'Elternteil'].filter(Boolean) as string[];
  const navigationSections: Array<{ title: string; actions: DashboardAction[] }> = [
    { title: 'Aktuell', actions: [
      { label: 'Termine & Verfügbarkeit', description: 'Zu- und Absagen sowie Teilnehmerzahlen', path: '/events' },
      { label: 'Benachrichtigungen', description: 'Neue Termine, Aufgaben und Nominierungen', path: '/notifications' },
    ] },
    { title: 'Mein Team', actions: [
      { label: 'Spieltagsaufstellung', description: 'Kader, Formation und veröffentlichte Aufstellung', path: '/matchday' },
      { label: 'Statistik', description: 'Einsätze, Tore, Minuten und Saisonwerte', path: '/statistics' },
      { label: 'Individuelles Training', description: isCoach ? 'Aktivitäten und Vorgaben verwalten' : 'Aktivitäten und Vorgaben ansehen', path: '/training' },
      { label: 'Kasse & Strafen', description: 'Strafen, Zahlungen und Mannschaftskasse', path: '/funds' },
    ] },
    ...(isCoach ? [{ title: 'Planung', actions: [
      { label: 'Zeitfenster planen', description: 'Geeignete Termine anhand der Verfügbarkeit finden', path: '/availability' as const },
      { label: 'Saison-Kader planen', description: 'Positionen und Kaderbreite über Teams hinweg', path: '/squad' as const },
    ] }] : []),
    { title: 'Organisation', actions: [
      ...((isClubManager || isCoach || isGuardian) ? [{ label: isClubManager || isCoach ? 'Mitglieder verwalten' : 'Familie & Spieler', description: isClubManager || isCoach ? 'Profile, Teams, Rollen und Familien' : 'Betreute Spieler und Teams', path: '/members' as const }] : []),
      { label: 'Einladung annehmen', description: 'Weiteren Verein, Bereich oder Team hinzufügen', path: '/accept-invite' },
    ] },
  ];
  const metrics = isDemo
    ? demoMetrics
    : [
        {
          label: 'Teams',
          value: String(activeTeam ? 1 : workspace?.teams.length ?? '–'),
          detail: activeTeam?.name ?? (workspace?.teams.map((team) => team.name).join(' · ') || 'werden geladen'),
        },
        { label: 'Spieler', value: String(dashboardData.playerCount), detail: `${dashboardData.coachCount} Trainer im gewählten Bereich` },
        { label: 'Offene Antworten', value: String(dashboardData.openResponses), detail: dashboardData.nextEvent ? 'für anstehende Termine' : 'noch keine anstehenden Termine' },
      ];

  const attendanceRatio = dashboardData.nextEvent?.total ? dashboardData.nextEvent.yes / dashboardData.nextEvent.total : 0;
  const attendanceStatus = !dashboardData.nextEvent?.total ? 'Noch offen' : attendanceRatio >= 0.7 ? 'Gut besetzt' : attendanceRatio >= 0.4 ? 'Knapp besetzt' : 'Kritisch';

  const leave = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.brand}>TEAMAPP</Text>
            <Text style={styles.context}>{context}</Text>
          </View>
          <Pressable onPress={leave} style={styles.leaveButton}>
            <Text style={styles.leaveText}>{isDemo ? 'Pilot verlassen' : 'Abmelden'}</Text>
          </Pressable>
        </View>

        {!isDemo && workspace ? <ContextSwitcher /> : null}

        {isDemo ? (
          <View style={styles.demoBanner}>
            <Text style={styles.demoTitle}>Pilotmodus</Text>
            <Text style={styles.demoText}>Beispieldaten · Änderungen werden nicht gespeichert.</Text>
          </View>
        ) : null}

        <Text style={styles.greeting}>Guten Tag{displayName ? `, ${displayName}` : ''}.</Text>
        <Text style={styles.intro}>
          {workspace ? `${workspace.clubName} · Saison ${workspace.seasonName}` : 'Das Wichtigste für deinen Bereich auf einen Blick.'}
        </Text>
        {!isDemo && roleLabels.length ? <View style={styles.roleBadges}>{roleLabels.map((role) => <Text key={role} style={styles.roleBadge}>{role}</Text>)}</View> : null}

        {error || dashboardError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Arbeitsbereich konnte nicht geladen werden</Text>
            <Text style={styles.errorText}>{error ?? dashboardError}</Text>
          </View>
        ) : null}

        <View style={styles.metrics}>
          {metrics.map((metric) => (
            <View key={metric.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
              <Text style={styles.metricDetail}>{metric.detail}</Text>
            </View>
          ))}
        </View>

        {!isDemo && workspace ? <View style={styles.navigation}>{navigationSections.filter((section) => section.actions.length).map((section) => (
          <View key={section.title} style={styles.navigationSection}>
            <Text style={styles.navigationTitle}>{section.title}</Text>
            <View style={styles.actionGrid}>{section.actions.map((action) => (
              <Pressable accessibilityRole="button" key={action.path} onPress={() => router.push(action.path)} style={styles.actionCard}>
                <Text style={styles.actionTitle}>{action.label}</Text><Text style={styles.actionDescription}>{action.description}</Text><Text style={styles.actionLink}>Öffnen →</Text>
              </Pressable>
            ))}</View>
          </View>
        ))}</View> : null}

        {!isDemo && !dashboardData.nextEvent ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/events')} style={styles.emptyNextCard}>
            <Text style={styles.emptyNextTitle}>Noch kein anstehender Termin</Text><Text style={styles.emptyNextText}>Terminübersicht öffnen</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => !isDemo && router.push('/events')} style={styles.nextCard}>
            <View style={styles.dateBox}>
              <Text style={styles.dateDay}>{isDemo ? 'DI' : nextEventDate?.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').toUpperCase()}</Text>
              <Text style={styles.dateNumber}>{isDemo ? '11' : nextEventDate?.getDate()}</Text>
            </View>
            <View style={styles.nextContent}>
              <Text style={styles.nextEyebrow}>NÄCHSTER TERMIN · {isDemo ? '17:30' : nextEventDate?.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.nextTitle}>{isDemo ? 'Gemeinsames Training' : dashboardData.nextEvent?.title}</Text>
              <Text style={styles.nextMeta}>{isDemo ? '28 zugesagt · 4 abgesagt · 4 offen' : `${dashboardData.nextEvent?.yes} zugesagt · ${dashboardData.nextEvent?.no} abgesagt · ${dashboardData.nextEvent?.open} offen`}</Text>
            </View>
            <View style={[styles.statusPill, attendanceStatus === 'Kritisch' && styles.statusCritical, attendanceStatus === 'Knapp besetzt' && styles.statusWarning]}>
              <Text style={[styles.statusText, attendanceStatus === 'Kritisch' && styles.statusCriticalText, attendanceStatus === 'Knapp besetzt' && styles.statusWarningText]}>{isDemo ? 'Gut besetzt' : attendanceStatus}</Text>
            </View>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20 },
  shell: { alignSelf: 'center', maxWidth: 1040, width: '100%' },
  topbar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  brand: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  context: { color: colors.ink, fontSize: 16, fontWeight: '800', marginTop: 3 },
  leaveButton: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, padding: 10 },
  leaveText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  roleBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  roleBadge: { backgroundColor: colors.blueSoft, borderRadius: 999, color: colors.blue, fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 6 },
  navigation: { marginTop: 12 }, navigationSection: { marginTop: 20 }, navigationTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  actionCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexBasis: 230, flexGrow: 1, minHeight: 126, padding: 16 },
  actionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' }, actionDescription: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 }, actionLink: { color: colors.blue, fontSize: 12, fontWeight: '900', marginTop: 10 },
  demoBanner: {
    backgroundColor: colors.blueSoft,
    borderRadius: 12,
    marginTop: 18,
    padding: 14,
  },
  demoTitle: { color: colors.blue, fontWeight: '800' },
  demoText: { color: colors.muted, fontSize: 13, marginTop: 3 },
  errorBanner: { backgroundColor: '#fef3f2', borderRadius: 12, marginTop: 18, padding: 14 },
  errorTitle: { color: '#b42318', fontWeight: '800' },
  errorText: { color: '#7a271a', fontSize: 13, marginTop: 3 },
  greeting: {
    color: colors.ink,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.1,
    marginTop: 42,
  },
  intro: { color: colors.muted, fontSize: 17, marginTop: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 28 },
  metricCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: 220,
    flexGrow: 1,
    padding: 20,
  },
  metricLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  metricValue: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 10 },
  metricDetail: { color: colors.faint, fontSize: 13, marginTop: 5 },
  nextCard: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 16,
    padding: 22,
  },
  dateBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    minWidth: 62,
    padding: 10,
  },
  dateDay: { color: colors.blue, fontSize: 10, fontWeight: '900' },
  dateNumber: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  nextContent: { flex: 1, minWidth: 210 },
  nextEyebrow: { color: colors.inkMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  nextTitle: { color: colors.surface, fontSize: 21, fontWeight: '800', marginTop: 5 },
  nextMeta: { color: colors.inkMuted, fontSize: 13, marginTop: 5 },
  statusPill: { backgroundColor: '#dff7ea', borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  statusText: { color: colors.green, fontSize: 12, fontWeight: '800' },
  statusWarning: { backgroundColor: '#fff4e5' }, statusWarningText: { color: colors.orange },
  statusCritical: { backgroundColor: '#fef3f2' }, statusCriticalText: { color: '#b42318' },
  emptyNextCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1, marginTop: 16, padding: 22 },
  emptyNextTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' }, emptyNextText: { color: colors.blue, fontSize: 13, fontWeight: '800', marginTop: 5 },
});
