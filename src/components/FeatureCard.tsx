import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

type FeatureCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
};

export function FeatureCard({ eyebrow, title, description, accent }: FeatureCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.marker, { backgroundColor: accent }]} />
      <Text style={[styles.eyebrow, { color: accent }]}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexBasis: 260,
    flexGrow: 1,
    minHeight: 190,
    padding: 22,
  },
  marker: {
    borderRadius: 999,
    height: 8,
    marginBottom: 24,
    width: 42,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 25,
    marginTop: 8,
  },
  description: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
});
