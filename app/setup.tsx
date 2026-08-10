import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/theme/ThemeProvider';

function seasonDefaults() {
  const today = new Date();
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    name: `${startYear}/${String(startYear + 1).slice(-2)}`,
    startsOn: `${startYear}-07-01`,
    endsOn: `${startYear + 1}-06-30`,
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function SetupScreen() {
  const {colors}=useAppTheme(); const styles=createStyles(colors);
  const router = useRouter();
  const { isLoading, session } = useAuth();
  const { refresh } = useWorkspace();
  const defaults = useMemo(seasonDefaults, []);
  const [clubName, setClubName] = useState('');
  const [clubSlug, setClubSlug] = useState('');
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [seasonName, setSeasonName] = useState(defaults.name);
  const [startsOn, setStartsOn] = useState(defaults.startsOn);
  const [endsOn, setEndsOn] = useState(defaults.endsOn);
  const [cohortName, setCohortName] = useState('');
  const [teams, setTeams] = useState(['']);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && !session) return <Redirect href="/sign-in" />;

  const updateClubName = (value: string) => {
    setClubName(value);
    if (!slugWasEdited) setClubSlug(slugify(value));
  };

  const updateTeam = (index: number, value: string) => {
    setTeams((current) => current.map((team, teamIndex) => (teamIndex === index ? value : team)));
  };

  const removeTeam = (index: number) => {
    setTeams((current) => current.filter((_, teamIndex) => teamIndex !== index));
  };

  const normalizedTeams = teams.map((team) => team.trim()).filter(Boolean);
  const hasDuplicateTeams = new Set(normalizedTeams.map((team) => team.toLocaleLowerCase('de'))).size !== normalizedTeams.length;
  const isValid = Boolean(
    clubName.trim().length >= 2 &&
      clubSlug &&
      seasonName.trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(startsOn) &&
      /^\d{4}-\d{2}-\d{2}$/.test(endsOn) &&
      startsOn < endsOn &&
      cohortName.trim() &&
      normalizedTeams.length > 0 &&
      !hasDuplicateTeams,
  );

  const submit = async () => {
    if (!supabase || !isValid) return;
    setError(null);
    setIsSubmitting(true);

    const { error: createError } = await supabase.rpc('create_club_workspace', {
      club_name: clubName.trim(),
      club_slug: clubSlug,
      season_name: seasonName.trim(),
      season_starts_on: startsOn,
      season_ends_on: endsOn,
      cohort_name: cohortName.trim(),
      team_names: normalizedTeams,
    });

    setIsSubmitting(false);
    if (createError) {
      setError(createError.message);
      return;
    }
    await refresh();
    router.replace('/dashboard');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <Text style={styles.eyebrow}>ARBEITSBEREICH EINRICHTEN</Text>
          <Text style={styles.title}>Vom Verein bis zu deinen Teams</Text>
          <Text style={styles.subtitle}>
            Altersklasse, Abteilung oder Trainingsgruppe: Du bestimmst die Bezeichnung und kannst beliebig viele Teams ergänzen.
          </Text>

          <Pressable accessibilityRole="button" onPress={() => router.push('/accept-invite')} style={styles.inviteLink}>
            <Text style={styles.inviteLinkText}>Du hast einen Einladungs- oder Spielerprofil-Code? Code eingeben</Text>
          </Pressable>

          <Section number="1" title="Verein">
            <Field label="Vereinsname" value={clubName} onChangeText={updateClubName} placeholder="z. B. SV Musterstadt" />
            <Field
              autoCapitalize="none"
              label="Kurzname für Links"
              value={clubSlug}
              onChangeText={(value) => {
                setSlugWasEdited(true);
                setClubSlug(slugify(value));
              }}
              placeholder="sv-musterstadt"
            />
          </Section>

          <Section number="2" title="Saison">
            <View style={styles.row}>
              <Field containerStyle={styles.flexField} label="Bezeichnung" value={seasonName} onChangeText={setSeasonName} placeholder="2026/27" />
              <Field containerStyle={styles.flexField} label="Start (JJJJ-MM-TT)" value={startsOn} onChangeText={setStartsOn} placeholder="2026-07-01" />
              <Field containerStyle={styles.flexField} label="Ende (JJJJ-MM-TT)" value={endsOn} onChangeText={setEndsOn} placeholder="2027-06-30" />
            </View>
          </Section>

          <Section number="3" title="Bereich oder Jahrgang">
            <Field label="Freie Bezeichnung" value={cohortName} onChangeText={setCohortName} placeholder="z. B. U17, Senioren, Frauen oder Torwartgruppe" />
          </Section>

          <Section number="4" title="Teams">
            <Text style={styles.helper}>Lege mindestens ein Team an. Weitere Teams kannst du jetzt oder später hinzufügen.</Text>
            {teams.map((team, index) => (
              <View key={`team-${index}`} style={styles.teamRow}>
                <TextInput
                  onChangeText={(value) => updateTeam(index, value)}
                  placeholder={`Team ${index + 1}`}
                  style={[styles.input, styles.teamInput]}
                  value={team}
                />
                {teams.length > 1 ? (
                  <Pressable accessibilityLabel={`Team ${index + 1} entfernen`} onPress={() => removeTeam(index)} style={styles.removeButton}>
                    <Text style={styles.removeText}>Entfernen</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Pressable onPress={() => setTeams((current) => [...current, ''])} style={styles.addButton}>
              <Text style={styles.addText}>+ Weiteres Team</Text>
            </Pressable>
            {hasDuplicateTeams ? <Text style={styles.error}>Teamnamen dürfen nicht doppelt vorkommen.</Text> : null}
          </Section>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={!isValid || isSubmitting}
            onPress={submit}
            style={({ pressed }) => [styles.submitButton, (!isValid || isSubmitting) && styles.disabled, pressed && styles.pressed]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.submitText}>Arbeitsbereich erstellen</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  const {colors}=useAppTheme(); const styles=createStyles(colors);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.number}><Text style={styles.numberText}>{number}</Text></View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, containerStyle, ...inputProps }: { label: string; containerStyle?: object } & React.ComponentProps<typeof TextInput>) {
  const {colors}=useAppTheme(); const styles=createStyles(colors);
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} style={styles.input} />
    </View>
  );
}

const createStyles=(colors:ReturnType<typeof useAppTheme>['colors'])=>StyleSheet.create({
  page: { backgroundColor: colors.canvas, flex: 1 },
  scroll: { padding: 20, paddingBottom: 48 },
  shell: { alignSelf: 'center', maxWidth: 820, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 },
  title: { color: colors.ink, fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 10, maxWidth: 680 },
  section: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 8 },
  number: { alignItems: 'center', backgroundColor: colors.blueSoft, borderRadius: 999, height: 28, justifyContent: 'center', width: 28 },
  numberText: { color: colors.blue, fontSize: 13, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  field: { marginTop: 12 },
  flexField: { flexBasis: 190, flexGrow: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 4, marginTop: 6 },
  teamRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 10 },
  teamInput: { flex: 1 },
  removeButton: { paddingHorizontal: 8, paddingVertical: 12 },
  removeText: { color: '#b42318', fontSize: 13, fontWeight: '700' },
  addButton: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 8 },
  addText: { color: colors.blue, fontSize: 14, fontWeight: '800' },
  error: { color: '#b42318', fontSize: 13, marginTop: 12 },
  submitButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 14, marginTop: 22, minHeight: 52, padding: 16 },
  submitText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.72 },
  inviteLink: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8 },
  inviteLinkText: { color: colors.blue, fontSize: 14, fontWeight: '800' },
});
