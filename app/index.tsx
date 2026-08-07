import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FeatureCard } from '@/components/FeatureCard';
import { colors } from '@/theme/colors';

const features = [
  {
    eyebrow: 'BEREICHE & TEAMS',
    title: 'Beliebig viele Teams gemeinsam führen',
    description: 'Ein gemeinsamer Mitgliederpool, ohne starre Altersklassen oder Teamgrenzen.',
    accent: colors.blue,
  },
  {
    eyebrow: 'PLANUNG',
    title: 'Gute Zeitfenster erkennen',
    description: 'Spieler-, Torhüter- und Trainerverfügbarkeit auf einen Blick.',
    accent: colors.green,
  },
  {
    eyebrow: 'SPIELTAG',
    title: 'Vom Kader bis zur Statistik',
    description: 'Nominierung, Aufstellung und Spielereignisse in einem Ablauf.',
    accent: colors.orange,
  },
] as const;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>VEREINSORGANISATION · ALLE STUFEN</Text>
        </View>

        <Text style={styles.title}>Ein Verein.{`\n`}Ein gemeinsamer Plan.</Text>
        <Text style={styles.subtitle}>
          Teamapp verbindet Bereiche, Jahrgänge und beliebig viele Teams, ohne Mitglieder,
          Termine und Trainer in getrennte Arbeitsbereiche aufzuteilen.
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sign-in')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>Anmelden</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/dashboard?demo=1')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Pilot ansehen</Text>
          </Pressable>
        </View>

        <View style={styles.contextCard}>
          <View>
            <Text style={styles.contextLabel}>AKTIVER KONTEXT</Text>
            <Text style={styles.contextTitle}>U17 · Saison 2026/27</Text>
          </View>
          <View style={styles.teamRow}>
            <View style={[styles.teamPill, styles.teamPillActive]}>
              <Text style={styles.teamPillActiveText}>Gesamt</Text>
            </View>
            <View style={styles.teamPill}>
              <Text style={styles.teamPillText}>Team 1</Text>
            </View>
            <View style={styles.teamPill}>
              <Text style={styles.teamPillText}>Team 2</Text>
            </View>
          </View>
        </View>

        <View style={styles.grid}>
          {features.map((feature) => (
            <FeatureCard key={feature.eyebrow} {...feature} />
          ))}
        </View>

        <Text style={styles.footnote}>Technisches Grundgerüst · Version 0.1.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: '100%',
    backgroundColor: colors.canvas,
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  shell: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.blueSoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.blue,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.8,
    lineHeight: 52,
    marginTop: 24,
    maxWidth: 720,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 18,
    lineHeight: 28,
    marginTop: 18,
    maxWidth: 680,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 28,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  contextCard: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    gap: 24,
    justifyContent: 'space-between',
    marginTop: 40,
    padding: 24,
  },
  contextLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  contextTitle: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
  },
  teamRow: {
    flexDirection: 'row',
    gap: 8,
  },
  teamPill: {
    alignItems: 'center',
    borderColor: colors.inkBorder,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 70,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  teamPillActive: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
  },
  teamPillText: {
    color: colors.inkMuted,
    fontWeight: '700',
  },
  teamPillActiveText: {
    color: colors.ink,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 16,
  },
  footnote: {
    color: colors.faint,
    fontSize: 12,
    marginTop: 28,
    textAlign: 'center',
  },
});
