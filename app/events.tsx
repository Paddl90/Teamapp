import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const eventTypeLabels: Record<string, string> = {
  training: 'Training', match: 'Spiel', tournament: 'Turnier', meeting: 'Besprechung', other: 'Sonstiges',
};
const responseLabels: Record<string, string> = { yes: 'Dabei', maybe: 'Vielleicht', no: 'Nicht dabei' };

type EventView = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  location: string;
  teamIds: string[];
  yes: number;
  maybe: number;
  no: number;
  total: number;
  canRespond: boolean;
  myResponse: string | null;
};

const toIso = (value: string) => new Date(value).toISOString();
const formatDate = (value: string) => new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export default function EventsScreen() {
  const { session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [events, setEvents] = useState<EventView[]>([]);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('training');
  const [startsAt, setStartsAt] = useState('2026-08-11T17:30');
  const [endsAt, setEndsAt] = useState('2026-08-11T19:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClubManager = Boolean(activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const coachTeamIds = activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [];
  const canManage = isClubManager || coachTeamIds.length > 0;
  const manageableTeamIds = isClubManager ? activeWorkspace?.teams.map((team) => team.id) ?? [] : coachTeamIds;

  const load = useCallback(async () => {
    if (!supabase || !activeWorkspace || !session) return;
    setIsLoading(true);
    setError(null);

    const { data: membership } = await supabase.from('memberships').select('id').eq('club_id', activeWorkspace.clubId).eq('profile_id', session.user.id).maybeSingle();
    const { data: eventRows, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_type, starts_at, ends_at, location, event_teams(team_id), event_responses(membership_id, response)')
      .eq('cohort_id', activeWorkspace.cohortId)
      .neq('status', 'cancelled')
      .order('starts_at');

    if (eventError) {
      setError(eventError.message);
      setIsLoading(false);
      return;
    }

    const teamIds = [...new Set((eventRows ?? []).flatMap((event) => (event.event_teams ?? []).map((team) => team.team_id)))];
    const { data: participantRows } = teamIds.length
      ? await supabase.from('team_memberships').select('team_id, membership_id').in('team_id', teamIds)
      : { data: [] };

    setEvents((eventRows ?? []).map((event) => {
      const targets = (event.event_teams ?? []).map((team) => team.team_id);
      const participantIds = new Set((participantRows ?? []).filter((row) => targets.includes(row.team_id)).map((row) => row.membership_id));
      const responses = event.event_responses ?? [];
      return {
        id: event.id,
        title: event.title,
        eventType: event.event_type,
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        location: event.location ?? '',
        teamIds: targets,
        yes: responses.filter((row) => row.response === 'yes').length,
        maybe: responses.filter((row) => row.response === 'maybe').length,
        no: responses.filter((row) => row.response === 'no').length,
        total: participantIds.size,
        canRespond: Boolean(membership?.id && participantIds.has(membership.id)),
        myResponse: responses.find((row) => row.membership_id === membership?.id)?.response ?? null,
      };
    }));
    setIsLoading(false);
  }, [activeWorkspace?.id, session?.user.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (activeWorkspace && selectedTeams.length === 0) setSelectedTeams(manageableTeamIds);
  }, [activeWorkspace?.id]);

  const teamNameById = useMemo(() => new Map(activeWorkspace?.teams.map((team) => [team.id, team.name]) ?? []), [activeWorkspace]);

  const createEvent = async () => {
    if (!supabase || !activeWorkspace) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: createError } = await supabase.rpc('create_team_event', {
        target_club_id: activeWorkspace.clubId,
        target_season_id: activeWorkspace.seasonId,
        target_cohort_id: activeWorkspace.cohortId,
        event_title: title.trim(),
        target_event_type: eventType,
        event_starts_at: toIso(startsAt),
        event_ends_at: toIso(endsAt),
        event_location: location,
        event_notes: notes,
        target_team_ids: selectedTeams,
      });
      if (createError) throw createError;
      setTitle('');
      setLocation('');
      setNotes('');
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Termin konnte nicht erstellt werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const respond = async (eventId: string, response: string) => {
    if (!supabase) return;
    setIsSubmitting(true);
    setError(null);
    const { error: responseError } = await supabase.rpc('respond_to_event', {
      target_event_id: eventId, new_response: response, response_note: null,
    });
    if (responseError) setError(responseError.message);
    else await load();
    setIsSubmitting(false);
  };

  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>TERMINE & VERFÜGBARKEIT</Text>
        <Text style={styles.title}>Gemeinsam planen</Text>
        <Text style={styles.subtitle}>Termine können mehrere Teams verbinden. Rückmeldungen zeigen sofort, ob Spieler und Trainer ausreichend verfügbar sind.</Text>
        <ContextSwitcher />

        {canManage ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Termin erstellen</Text>
            <Text style={styles.label}>Titel</Text>
            <TextInput onChangeText={setTitle} placeholder="Gemeinsames Training" style={styles.input} value={title} />
            <Text style={styles.label}>Art</Text>
            <View style={styles.choiceRow}>{Object.entries(eventTypeLabels).map(([value, label]) => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: eventType === value }} key={value} onPress={() => setEventType(value)} style={[styles.choice, eventType === value && styles.choiceActive]}>
                <Text style={[styles.choiceText, eventType === value && styles.choiceTextActive]}>{label}</Text>
              </Pressable>
            ))}</View>
            <View style={styles.columns}>
              <View style={styles.column}><Text style={styles.label}>Beginn</Text><TextInput onChangeText={setStartsAt} placeholder="2026-08-11T17:30" style={styles.input} value={startsAt} /></View>
              <View style={styles.column}><Text style={styles.label}>Ende</Text><TextInput onChangeText={setEndsAt} placeholder="2026-08-11T19:00" style={styles.input} value={endsAt} /></View>
            </View>
            <Text style={styles.helper}>Format: JJJJ-MM-TTTHH:MM</Text>
            <Text style={styles.label}>Teams</Text>
            <View style={styles.choiceRow}>{activeWorkspace?.teams.filter((team) => manageableTeamIds.includes(team.id)).map((team) => {
              const selected = selectedTeams.includes(team.id);
              return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={team.id} onPress={() => setSelectedTeams((current) => selected ? current.filter((id) => id !== team.id) : [...current, team.id])} style={[styles.choice, selected && styles.choiceActive]}><Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{team.name}</Text></Pressable>;
            })}</View>
            <Text style={styles.label}>Ort</Text><TextInput onChangeText={setLocation} placeholder="Sportplatz" style={styles.input} value={location} />
            <Text style={styles.label}>Hinweise</Text><TextInput multiline onChangeText={setNotes} placeholder="Optional" style={[styles.input, styles.notes]} value={notes} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" disabled={title.trim().length < 2 || selectedTeams.length === 0 || isSubmitting} onPress={createEvent} style={[styles.primaryButton, (title.trim().length < 2 || selectedTeams.length === 0) && styles.disabled]}>
              {isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Termin veröffentlichen</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Planungsübersicht</Text>
          <Text style={styles.helper}>Zusagen, mögliche Teilnahmen und offene Rückmeldungen aller ausgewählten Teams.</Text>
          {isLoading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {!isLoading && events.length === 0 ? <Text style={styles.empty}>Noch keine Termine angelegt.</Text> : null}
          {events.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventTop}><View><Text style={styles.eventType}>{eventTypeLabels[event.eventType]}</Text><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventMeta}>{formatDate(event.startsAt)}{event.location ? ` · ${event.location}` : ''}</Text></View><Text style={styles.teams}>{event.teamIds.map((id) => teamNameById.get(id)).join(' + ')}</Text></View>
              <View style={styles.metrics}><Text style={styles.yes}>✓ {event.yes} dabei</Text><Text style={styles.maybe}>? {event.maybe} vielleicht</Text><Text style={styles.no}>× {event.no} nicht dabei</Text><Text style={styles.open}>○ {Math.max(0, event.total - event.yes - event.maybe - event.no)} offen</Text></View>
              {event.canRespond ? <View style={styles.responseRow}>{Object.entries(responseLabels).map(([value, label]) => (
                <Pressable accessibilityRole="button" key={value} onPress={() => respond(event.id, value)} style={[styles.responseButton, event.myResponse === value && styles.responseActive]}><Text style={[styles.responseText, event.myResponse === value && styles.responseTextActive]}>{label}</Text></Pressable>
              ))}</View> : <Text style={styles.notTargeted}>Du bist diesem Termin nicht als Spieler oder Trainer zugeordnet.</Text>}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20, paddingBottom: 48 }, shell: { alignSelf: 'center', maxWidth: 960, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }, title: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 8 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 720 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 }, cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 16 }, helper: { color: colors.muted, fontSize: 12, marginTop: 6 }, input: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 15, paddingHorizontal: 13, paddingVertical: 12 }, notes: { minHeight: 74, textAlignVertical: 'top' }, columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, column: { flex: 1, minWidth: 230 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, choiceActive: { backgroundColor: colors.blue, borderColor: colors.blue }, choiceText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, choiceTextActive: { color: colors.surface },
  primaryButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, marginTop: 18, minHeight: 48, padding: 14 }, primaryText: { color: colors.surface, fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.38 }, error: { color: '#b42318', fontSize: 13, marginTop: 12 }, loader: { marginTop: 18 }, empty: { color: colors.faint, marginTop: 18 },
  eventCard: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 16, paddingTop: 16 }, eventTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }, eventType: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, eventTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 3 }, eventMeta: { color: colors.muted, fontSize: 12, marginTop: 4 }, teams: { backgroundColor: colors.blueSoft, borderRadius: 9, color: colors.blue, fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 6 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 13 }, yes: { color: colors.green, fontSize: 12, fontWeight: '800' }, maybe: { color: colors.orange, fontSize: 12, fontWeight: '800' }, no: { color: '#b42318', fontSize: 12, fontWeight: '800' }, open: { color: colors.faint, fontSize: 12, fontWeight: '800' }, responseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 }, responseButton: { borderColor: colors.border, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, responseActive: { backgroundColor: colors.ink, borderColor: colors.ink }, responseText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, responseTextActive: { color: colors.surface },
  notTargeted: { color: colors.faint, fontSize: 12, marginTop: 13 },
});
