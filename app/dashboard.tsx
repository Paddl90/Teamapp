import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { colors } from '@/theme/colors';

const demoMetrics = [
  { label: 'Spieler', value: '54', detail: 'auf 3 Teams verteilt' },
  { label: 'Trainer', value: '6', detail: '4 heute verfügbar' },
  { label: 'Offene Antworten', value: '9', detail: 'für Dienstag' },
] as const;

export default function DashboardScreen() {
  const router = useRouter();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const { isLoading, session, signOut } = useAuth();
  const isDemo = demo === '1';
  const { activeTeamId, activeWorkspace: workspace, error, isLoading: isWorkspaceLoading } = useWorkspace();

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
  const metrics = isDemo
    ? demoMetrics
    : [
        {
          label: 'Teams',
          value: String(workspace?.teams.length ?? '–'),
          detail: workspace?.teams.map((team) => team.name).join(' · ') || 'werden geladen',
        },
        { label: 'Spieler', value: '0', detail: 'Mitglieder als Nächstes einladen' },
        { label: 'Offene Antworten', value: '0', detail: 'noch keine Termine' },
      ];

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

        {!isDemo && workspace ? (
          <View style={styles.quickActions}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/events')} style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Termine & Verfügbarkeit</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/availability')} style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Zeitfenster planen</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/squad')} style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Saison-Kader planen</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/matchday')} style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Spieltagsaufstellung</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/members')} style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Mitglieder verwalten</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/accept-invite')} style={styles.quickButton}>
              <Text style={styles.quickButtonText}>Einladungscode eingeben</Text>
            </Pressable>
          </View>
        ) : null}

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

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Arbeitsbereich konnte nicht geladen werden</Text>
            <Text style={styles.errorText}>{error}</Text>
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

        <View style={styles.nextCard}>
          <View style={styles.dateBox}>
            <Text style={styles.dateDay}>DI</Text>
            <Text style={styles.dateNumber}>11</Text>
          </View>
          <View style={styles.nextContent}>
            <Text style={styles.nextEyebrow}>NÄCHSTER TERMIN · 17:30</Text>
            <Text style={styles.nextTitle}>Gemeinsames Training</Text>
            <Text style={styles.nextMeta}>28 zugesagt · 4 abgesagt · 4 offen</Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Gut besetzt</Text>
          </View>
        </View>
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
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  quickButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10 },
  quickButtonText: { color: colors.blue, fontSize: 13, fontWeight: '800' },
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
});
