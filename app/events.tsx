import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const recurrenceOptions = [{ value: 'none', label: 'Einmalig' }, { value: 'weekly', label: 'Wöchentlich' }] as const;
const attendanceLabels: Record<string, string> = { present: 'Anwesend', excused: 'Entschuldigt', unexcused: 'Unentschuldigt', injured: 'Verletzt' };

type EventView = {
  id: string;
  title: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  location: string;
  notes: string;
  responseDeadline: string | null;
  meetingAt: string | null;
  meetingLocation: string;
  recurrenceGroupId: string | null;
  teamIds: string[];
  yes: number;
  maybe: number;
  no: number;
  total: number;
  responders: Array<{ membershipId: string; name: string; response: string | null; isCurrentUser: boolean }>;
  participants: Array<{ membershipId: string; name: string; attendance: string | null }>;
};
type PenaltyItem = { id: string; team_id: string; title: string; amount_cents: number };

const toIso = (value: string) => new Date(value).toISOString();
const optionalIso = (value: string) => value.trim() ? toIso(value) : null;
const toLocalInput = (value: string | null) => value ? new Date(value).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(' ', 'T') : '';
const formatDate = (value: string) => new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value));

export default function EventsScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const { isLoading: isAuthLoading, session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [events, setEvents] = useState<EventView[]>([]);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('training');
  const [startsAt, setStartsAt] = useState('2026-08-11T17:30');
  const [endsAt, setEndsAt] = useState('2026-08-11T19:00');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [meetingAt, setMeetingAt] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [recurrenceEndsOn, setRecurrenceEndsOn] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [penaltyCatalog, setPenaltyCatalog] = useState<PenaltyItem[]>([]);
  const [attendancePenalty, setAttendancePenalty] = useState<Record<string, string>>({});
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [screen, setScreen] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const isClubManager = Boolean(activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'));
  const coachTeamIds = activeWorkspace?.teams.filter((team) => team.roles.includes('coach')).map((team) => team.id) ?? [];
  const canManage = isClubManager || coachTeamIds.length > 0;
  const manageableTeamIds = isClubManager ? activeWorkspace?.teams.map((team) => team.id) ?? [] : coachTeamIds;

  const load = useCallback(async () => {
    if (!supabase || !activeWorkspace || !session) return;
    setIsLoading(true);
    setError(null);

    const { data: membership } = await supabase.from('memberships').select('id').eq('club_id', activeWorkspace.clubId).eq('profile_id', session.user.id).maybeSingle();
    const { data: guardianRows } = membership?.id ? await supabase.from('guardian_child_links').select('child_membership_id').eq('guardian_membership_id', membership.id) : { data: [] };
    const managedIds = (guardianRows ?? []).map((row) => row.child_membership_id);
    const { data: managedMembers } = managedIds.length ? await supabase.from('memberships').select('id,profile_id').in('id', managedIds) : { data: [] };
    const managedProfileIds = (managedMembers ?? []).map((row) => row.profile_id);
    const { data: managedProfiles } = managedProfileIds.length ? await supabase.from('profiles').select('id,display_name').in('id', managedProfileIds) : { data: [] };
    const identities = [
      ...(membership?.id ? [{ membershipId: membership.id, name: 'Ich', isCurrentUser: true }] : []),
      ...(managedMembers ?? []).map((member) => ({ membershipId: member.id, name: (managedProfiles ?? []).find((profile) => profile.id === member.profile_id)?.display_name ?? 'Kind', isCurrentUser: false })),
    ];
    const { data: eventRows, error: eventError } = await supabase
      .from('events')
      .select('id, title, event_type, starts_at, ends_at, location, notes, response_deadline, meeting_at, meeting_location, recurrence_group_id, event_teams(team_id), event_responses(membership_id, response), event_attendance(membership_id,status)')
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
    const participantMembershipIds = [...new Set((participantRows ?? []).map((row) => row.membership_id))];
    const { data: participantMembers } = participantMembershipIds.length ? await supabase.from('memberships').select('id,profile_id').in('id',participantMembershipIds) : { data: [] };
    const participantProfileIds = (participantMembers ?? []).map((row) => row.profile_id);
    const { data: participantProfiles } = participantProfileIds.length ? await supabase.from('profiles').select('id,display_name').in('id',participantProfileIds) : { data: [] };
    const participantName = (membershipId: string) => { const member=(participantMembers ?? []).find((row)=>row.id===membershipId); return (participantProfiles ?? []).find((profile)=>profile.id===member?.profile_id)?.display_name ?? 'Unbekannt'; };
    const { data: catalogRows } = await supabase.from('penalty_catalog').select('id,team_id,title,amount_cents').in('team_id',activeWorkspace.teams.map((team)=>team.id)).eq('active',true).order('title');
    setPenaltyCatalog((catalogRows ?? []) as PenaltyItem[]);

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
        notes: event.notes ?? '',
        responseDeadline: event.response_deadline,
        meetingAt: event.meeting_at,
        meetingLocation: event.meeting_location ?? '',
        recurrenceGroupId: event.recurrence_group_id,
        teamIds: targets,
        yes: responses.filter((row) => row.response === 'yes').length,
        maybe: responses.filter((row) => row.response === 'maybe').length,
        no: responses.filter((row) => row.response === 'no').length,
        total: participantIds.size,
        responders: identities.filter((identity) => participantIds.has(identity.membershipId)).map((identity) => ({ ...identity, response: responses.find((row) => row.membership_id === identity.membershipId)?.response ?? null })),
        participants: [...participantIds].map((membershipId) => ({ membershipId, name: participantName(membershipId), attendance: (event.event_attendance ?? []).find((row) => row.membership_id === membershipId)?.status ?? null })).sort((a,b)=>a.name.localeCompare(b.name,'de')),
      };
    }));
    setIsLoading(false);
  }, [activeWorkspace?.id, session?.user.id]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (activeWorkspace && selectedTeams.length === 0) setSelectedTeams(manageableTeamIds);
  }, [activeWorkspace?.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [screen, selectedEventId]);

  const teamNameById = useMemo(() => new Map(activeWorkspace?.teams.map((team) => [team.id, team.name]) ?? []), [activeWorkspace]);
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const resetForm = () => {
    setEditingId(null); setTitle(''); setEventType('training'); setLocation(''); setNotes('');
    setResponseDeadline(''); setMeetingAt(''); setMeetingLocation(''); setRecurrence('none'); setRecurrenceEndsOn('');
    setSelectedTeams(manageableTeamIds); setError(null);
  };

  const startCreate = () => { resetForm(); setFeedback(null); setScreen('form'); };
  const openEvent = (eventId: string) => { setSelectedEventId(eventId); setFeedback(null); setScreen('detail'); };

  const createEvent = async () => {
    if (!supabase || !activeWorkspace) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { error: createError } = await supabase.rpc('create_event_series', {
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
        target_response_deadline: optionalIso(responseDeadline),
        target_meeting_at: optionalIso(meetingAt),
        target_meeting_location: meetingLocation,
        recurrence,
        recurrence_ends_on: recurrence === 'weekly' ? recurrenceEndsOn : null,
      });
      if (createError) throw createError;
      setTitle('');
      setLocation('');
      setNotes('');
      setResponseDeadline(''); setMeetingAt(''); setMeetingLocation(''); setRecurrence('none'); setRecurrenceEndsOn('');
      await load();
      setFeedback(recurrence === 'weekly' ? 'Terminserie wurde veröffentlicht.' : 'Termin wurde veröffentlicht.');
      setScreen('list');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Termin konnte nicht erstellt werden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginEdit = (event: EventView) => {
    setEditingId(event.id); setTitle(event.title); setEventType(event.eventType); setStartsAt(toLocalInput(event.startsAt));
    setEndsAt(toLocalInput(event.endsAt)); setLocation(event.location); setNotes(event.notes); setSelectedTeams(event.teamIds);
    setResponseDeadline(toLocalInput(event.responseDeadline)); setMeetingAt(toLocalInput(event.meetingAt)); setMeetingLocation(event.meetingLocation);
    setRecurrence('none'); setRecurrenceEndsOn(''); setError(null);
    setFeedback(null); setScreen('form');
  };

  const saveEvent = async () => {
    if (!supabase || !editingId) return; setIsSubmitting(true); setError(null);
    const { error: saveError } = await supabase.rpc('update_team_event', {
      target_event_id: editingId, event_title: title.trim(), target_event_type: eventType,
      event_starts_at: toIso(startsAt), event_ends_at: toIso(endsAt), event_location: location, event_notes: notes,
      target_team_ids: selectedTeams, target_response_deadline: optionalIso(responseDeadline), target_meeting_at: optionalIso(meetingAt), target_meeting_location: meetingLocation,
    });
    setIsSubmitting(false); if (saveError) { setError(saveError.message); return; }
    setEditingId(null); setTitle(''); setLocation(''); setNotes(''); setResponseDeadline(''); setMeetingAt(''); setMeetingLocation(''); await load();
    setFeedback('Änderungen wurden gespeichert.'); setScreen('detail');
  };

  const cancelEvent = async (eventId: string) => {
    if (!supabase) return; setIsSubmitting(true); setError(null);
    const { error: cancelError } = await supabase.rpc('cancel_team_event', { target_event_id: eventId });
    setIsSubmitting(false); if (cancelError) setError(cancelError.message); else { if (editingId === eventId) setEditingId(null); await load(); setFeedback('Termin wurde abgesagt.'); setScreen('list'); setSelectedEventId(null); }
  };

  const respond = async (eventId: string, membershipId: string, response: string) => {
    if (!supabase) return;
    setIsSubmitting(true);
    setError(null);
    const { error: responseError } = await supabase.rpc('respond_to_event', {
      target_event_id: eventId, target_membership_id: membershipId, new_response: response, response_note: null,
    });
    if (responseError) setError(responseError.message);
    else { await load(); setFeedback('Rückmeldung wurde gespeichert.'); }
    setIsSubmitting(false);
  };

  const initializeAttendance = async (eventId: string) => {
    if (!supabase) return; setIsSubmitting(true); setError(null);
    const { error: attendanceError } = await supabase.rpc('initialize_event_attendance',{target_event_id:eventId});
    setIsSubmitting(false); if(attendanceError)setError(attendanceError.message);else { await load(); setFeedback('Zusagen wurden in die Anwesenheit übernommen.'); }
  };

  const setAttendance = async (eventId: string, membershipId: string, status: string) => {
    if (!supabase) return; setIsSubmitting(true); setError(null);
    const { error: attendanceError } = await supabase.rpc('set_event_attendance',{target_event_id:eventId,target_membership_id:membershipId,new_status:status,target_penalty_catalog_id:status==='unexcused'?(attendancePenalty[eventId]||null):null});
    setIsSubmitting(false); if(attendanceError)setError(attendanceError.message);else { await load(); setFeedback('Anwesenheit wurde gespeichert.'); }
  };

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  return <ScrollView ref={scrollRef} contentContainerStyle={styles.page}><View style={styles.shell}>
    <Text style={styles.eyebrow}>KALENDER</Text>
    <View style={styles.pageHeader}><View><Text style={styles.title}>Termine</Text><Text style={styles.subtitle}>Alle Termine und Rückmeldungen im gewählten Bereich.</Text></View>{canManage&&screen==='list'?<Pressable accessibilityRole="button" onPress={startCreate} style={styles.headerAction}><Text style={styles.headerActionText}>+ Termin erstellen</Text></Pressable>:null}</View>
    <ContextSwitcher/>
    <View style={styles.sectionNav}><Pressable accessibilityRole="button" style={[styles.sectionNavItem,styles.sectionNavActive]}><Text style={styles.sectionNavActiveText}>Termine</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>router.push('/availability')} style={styles.sectionNavItem}><Text style={styles.sectionNavText}>Zeitfenster</Text></Pressable></View>
    {feedback?<View style={styles.successBanner}><Text style={styles.successText}>✓ {feedback}</Text></View>:null}
    {error&&screen!=='form'?<Text style={styles.error}>{error}</Text>:null}

    {screen==='list'?<View style={styles.card}>
      <View style={styles.listHeader}><View><Text style={styles.cardTitle}>Anstehende Termine</Text><Text style={styles.helper}>Wähle einen Termin, um Rückmeldungen und Details zu sehen.</Text></View><Text style={styles.countBadge}>{events.length}</Text></View>
      {isLoading?<ActivityIndicator color={colors.blue} style={styles.loader}/>:null}
      {!isLoading&&events.length===0?<View style={styles.emptyState}><Text style={styles.emptyTitle}>Noch keine Termine</Text><Text style={styles.empty}>Erstelle den ersten gemeinsamen Termin für deine Teams.</Text></View>:null}
      {events.map((event)=>{const deadlinePassed=Boolean(event.responseDeadline&&new Date(event.responseDeadline)<new Date());return <View key={event.id} style={styles.eventListItem}>
        <Pressable accessibilityRole="button" onPress={()=>openEvent(event.id)} style={styles.eventSummary}>
          <View style={styles.dateTile}><Text style={styles.dateMonth}>{new Date(event.startsAt).toLocaleDateString('de-DE',{month:'short'}).replace('.','').toUpperCase()}</Text><Text style={styles.dateNumber}>{new Date(event.startsAt).getDate()}</Text></View>
          <View style={styles.listMain}><Text style={styles.eventType}>{eventTypeLabels[event.eventType]}</Text><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventMeta}>{formatDate(event.startsAt)}{event.location?` · ${event.location}`:''}</Text><Text style={styles.listTeams}>{event.teamIds.map((id)=>teamNameById.get(id)).join(' + ')}</Text></View>
          <View style={styles.listStatus}><Text style={styles.yes}>{event.yes} dabei</Text><Text style={styles.open}>{Math.max(0,event.total-event.yes-event.maybe-event.no)} offen</Text><Text style={styles.detailLink}>Details →</Text></View>
        </Pressable>
        {event.responders.filter((responder)=>responder.isCurrentUser).map((responder)=><View key={responder.membershipId} style={styles.inlineResponseArea}><View style={styles.inlineResponder}><Text style={styles.inlineResponderName}>Meine Rückmeldung</Text>{deadlinePassed?<Text style={styles.inlineDeadline}>Frist abgelaufen</Text>:<View style={styles.inlineSymbols}>{Object.entries(responseLabels).map(([value,label])=><Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{selected:responder.response===value}} disabled={isSubmitting} key={value} onPress={()=>respond(event.id,responder.membershipId,value)} style={[styles.symbolButton,responder.response===value&&styles.symbolActive]}><Text style={[styles.symbolText,responder.response===value&&styles.symbolTextActive]}>{value==='yes'?'✓':value==='maybe'?'?':'×'}</Text></Pressable>)}</View>}</View></View>)}
      </View>})}
    </View>:null}

    {screen==='form'&&canManage?<View style={styles.card}>
      <View style={styles.detailHeader}><Pressable accessibilityRole="button" onPress={()=>{setScreen(editingId?'detail':'list');setError(null)}} style={styles.backButton}><Text style={styles.backText}>← Zurück</Text></Pressable><Text style={styles.cardTitle}>{editingId?'Termin bearbeiten':'Neuer Termin'}</Text></View>
      <Text style={styles.label}>Titel</Text><TextInput onChangeText={setTitle} placeholder="Gemeinsames Training" style={styles.input} value={title}/>
      <Text style={styles.label}>Art</Text><View style={styles.choiceRow}>{Object.entries(eventTypeLabels).map(([value,label])=><Pressable accessibilityRole="radio" accessibilityState={{checked:eventType===value}} key={value} onPress={()=>setEventType(value)} style={[styles.choice,eventType===value&&styles.choiceActive]}><Text style={[styles.choiceText,eventType===value&&styles.choiceTextActive]}>{label}</Text></Pressable>)}</View>
      <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Beginn</Text><TextInput onChangeText={setStartsAt} style={styles.input} value={startsAt}/></View><View style={styles.column}><Text style={styles.label}>Ende</Text><TextInput onChangeText={setEndsAt} style={styles.input} value={endsAt}/></View></View><Text style={styles.helper}>Format: JJJJ-MM-TTTHH:MM</Text>
      <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Zusagefrist</Text><TextInput onChangeText={setResponseDeadline} placeholder="2026-08-10T18:00" style={styles.input} value={responseDeadline}/></View><View style={styles.column}><Text style={styles.label}>Treffpunkt / Abfahrt</Text><TextInput onChangeText={setMeetingAt} placeholder="2026-08-11T16:45" style={styles.input} value={meetingAt}/></View></View>
      <Text style={styles.label}>Treffpunkt</Text><TextInput onChangeText={setMeetingLocation} placeholder="Vereinsheim oder Parkplatz" style={styles.input} value={meetingLocation}/>
      <Text style={styles.label}>Teams</Text><View style={styles.choiceRow}>{activeWorkspace?.teams.filter((team)=>manageableTeamIds.includes(team.id)).map((team)=>{const selected=selectedTeams.includes(team.id);return <Pressable accessibilityRole="checkbox" accessibilityState={{checked:selected}} key={team.id} onPress={()=>setSelectedTeams((current)=>selected?current.filter((id)=>id!==team.id):[...current,team.id])} style={[styles.choice,selected&&styles.choiceActive]}><Text style={[styles.choiceText,selected&&styles.choiceTextActive]}>{team.name}</Text></Pressable>})}</View>
      <Text style={styles.label}>Ort</Text><TextInput onChangeText={setLocation} placeholder="Sportplatz" style={styles.input} value={location}/><Text style={styles.label}>Hinweise</Text><TextInput multiline onChangeText={setNotes} placeholder="Optional" style={[styles.input,styles.notes]} value={notes}/>
      {!editingId?<><Text style={styles.label}>Wiederholung</Text><View style={styles.choiceRow}>{recurrenceOptions.map(({value,label})=><Pressable accessibilityRole="radio" accessibilityState={{checked:recurrence===value}} key={value} onPress={()=>setRecurrence(value)} style={[styles.choice,recurrence===value&&styles.choiceActive]}><Text style={[styles.choiceText,recurrence===value&&styles.choiceTextActive]}>{label}</Text></Pressable>)}</View>{recurrence==='weekly'?<><Text style={styles.label}>Wiederholen bis</Text><TextInput onChangeText={setRecurrenceEndsOn} placeholder="2026-12-15" style={styles.input} value={recurrenceEndsOn}/></>:null}</>:null}
      {error?<Text style={styles.error}>{error}</Text>:null}<View style={styles.formActions}><Pressable accessibilityRole="button" onPress={()=>{setScreen(editingId?'detail':'list');setError(null)}} style={styles.secondaryButton}><Text style={styles.secondaryText}>Abbrechen</Text></Pressable><Pressable accessibilityRole="button" disabled={title.trim().length<2||selectedTeams.length===0||isSubmitting||(recurrence==='weekly'&&!recurrenceEndsOn)} onPress={editingId?saveEvent:createEvent} style={[styles.primaryButton,styles.formPrimary,(title.trim().length<2||selectedTeams.length===0)&&styles.disabled]}>{isSubmitting?<ActivityIndicator color={colors.surface}/>:<Text style={styles.primaryText}>{editingId?'Speichern':recurrence==='weekly'?'Serie veröffentlichen':'Termin veröffentlichen'}</Text>}</Pressable></View>
    </View>:null}

    {screen==='detail'&&selectedEvent?<View style={styles.card}>
      <View style={styles.detailHeader}><Pressable accessibilityRole="button" onPress={()=>{setScreen('list');setFeedback(null)}} style={styles.backButton}><Text style={styles.backText}>← Alle Termine</Text></Pressable>{canManage&&selectedEvent.teamIds.every((id)=>manageableTeamIds.includes(id))?<Pressable accessibilityRole="button" onPress={()=>beginEdit(selectedEvent)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Bearbeiten</Text></Pressable>:null}</View>
      <View style={styles.eventTop}><View><Text style={styles.eventType}>{eventTypeLabels[selectedEvent.eventType]}</Text><Text style={styles.detailTitle}>{selectedEvent.title}</Text><Text style={styles.eventMeta}>{formatDate(selectedEvent.startsAt)}{selectedEvent.location?` · ${selectedEvent.location}`:''}</Text></View><Text style={styles.teams}>{selectedEvent.teamIds.map((id)=>teamNameById.get(id)).join(' + ')}</Text></View>
      {selectedEvent.meetingAt||selectedEvent.responseDeadline?<View style={styles.details}>{selectedEvent.meetingAt?<Text style={styles.detailText}>Treffen {formatDate(selectedEvent.meetingAt)}{selectedEvent.meetingLocation?` · ${selectedEvent.meetingLocation}`:''}</Text>:null}{selectedEvent.responseDeadline?<Text style={styles.detailText}>Zusage bis {formatDate(selectedEvent.responseDeadline)}</Text>:null}{selectedEvent.recurrenceGroupId?<Text style={styles.seriesTag}>Terminserie</Text>:null}</View>:null}
      <View style={styles.metrics}><Text style={styles.yes}>✓ {selectedEvent.yes} dabei</Text><Text style={styles.maybe}>? {selectedEvent.maybe} vielleicht</Text><Text style={styles.no}>× {selectedEvent.no} nicht dabei</Text><Text style={styles.open}>○ {Math.max(0,selectedEvent.total-selectedEvent.yes-selectedEvent.maybe-selectedEvent.no)} offen</Text></View>
      <Text style={styles.sectionTitle}>Meine Rückmeldung</Text>{selectedEvent.responders.length?selectedEvent.responders.map((responder)=>{const deadlinePassed=Boolean(selectedEvent.responseDeadline&&new Date(selectedEvent.responseDeadline)<new Date());return <View key={responder.membershipId} style={styles.responderBlock}><Text style={styles.responderName}>{responder.name}</Text>{deadlinePassed?<Text style={styles.deadlinePassed}>Zusagefrist abgelaufen</Text>:<View style={styles.responseRow}>{Object.entries(responseLabels).map(([value,label])=><Pressable accessibilityRole="button" key={value} onPress={()=>respond(selectedEvent.id,responder.membershipId,value)} style={[styles.responseButton,responder.response===value&&styles.responseActive]}><Text style={[styles.responseText,responder.response===value&&styles.responseTextActive]}>{label}</Text></Pressable>)}</View>}</View>}):<Text style={styles.notTargeted}>Du bist diesem Termin nicht zugeordnet.</Text>}
      {canManage&&selectedEvent.teamIds.every((id)=>manageableTeamIds.includes(id))?<><Text style={styles.sectionTitle}>Anwesenheit</Text><View style={styles.attendanceBox}><View style={styles.attendanceHeader}><Text style={styles.helper}>Zusagen übernehmen oder einzeln korrigieren.</Text><Pressable accessibilityRole="button" onPress={()=>initializeAttendance(selectedEvent.id)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Zusagen übernehmen</Text></Pressable></View>
        {penaltyCatalog.some((item)=>selectedEvent.teamIds.includes(item.team_id))?<><Text style={styles.miniLabel}>Optionale Strafe bei „Unentschuldigt“</Text><View style={styles.choiceRow}><Pressable accessibilityRole="radio" accessibilityState={{checked:!attendancePenalty[selectedEvent.id]}} onPress={()=>setAttendancePenalty((current)=>({...current,[selectedEvent.id]:''}))} style={[styles.miniChoice,!attendancePenalty[selectedEvent.id]&&styles.miniChoiceActive]}><Text style={styles.miniChoiceText}>Keine</Text></Pressable>{penaltyCatalog.filter((item)=>selectedEvent.teamIds.includes(item.team_id)).map((item)=><Pressable accessibilityRole="radio" accessibilityState={{checked:attendancePenalty[selectedEvent.id]===item.id}} key={item.id} onPress={()=>setAttendancePenalty((current)=>({...current,[selectedEvent.id]:item.id}))} style={[styles.miniChoice,attendancePenalty[selectedEvent.id]===item.id&&styles.miniChoiceActive]}><Text style={styles.miniChoiceText}>{item.title} · {(item.amount_cents/100).toFixed(2)} €</Text></Pressable>)}</View></>:null}
        {selectedEvent.participants.map((participant)=><View key={participant.membershipId} style={styles.attendanceRow}><View><Text style={styles.participantName}>{participant.name}</Text><Text style={styles.currentAttendance}>{participant.attendance?attendanceLabels[participant.attendance]:'Noch nicht erfasst'}</Text></View><View style={styles.attendanceActions}>{Object.entries(attendanceLabels).map(([value,label])=><Pressable accessibilityRole="button" key={value} onPress={()=>setAttendance(selectedEvent.id,participant.membershipId,value)} style={[styles.attendanceButton,participant.attendance===value&&styles.attendanceActive]}><Text style={[styles.attendanceButtonText,participant.attendance===value&&styles.attendanceActiveText]}>{label}</Text></Pressable>)}</View></View>)}
      </View><View style={styles.dangerZone}><Pressable accessibilityRole="button" onPress={()=>cancelEvent(selectedEvent.id)} style={styles.cancelButton}><Text style={styles.cancelText}>Termin absagen</Text></Pressable></View></>:null}
    </View>:null}
  </View></ScrollView>;
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20, paddingBottom: 48 }, shell: { alignSelf: 'center', maxWidth: 960, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 }, title: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 8 }, subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 720 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 }, cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 16 }, helper: { color: colors.muted, fontSize: 12, marginTop: 6 }, input: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 15, paddingHorizontal: 13, paddingVertical: 12 }, notes: { minHeight: 74, textAlignVertical: 'top' }, columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, column: { flex: 1, minWidth: 230 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 }, choiceActive: { backgroundColor: colors.blue, borderColor: colors.blue }, choiceText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, choiceTextActive: { color: colors.surface },
  primaryButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, marginTop: 18, minHeight: 48, padding: 14 }, primaryText: { color: colors.surface, fontSize: 14, fontWeight: '900' }, disabled: { opacity: 0.38 }, error: { color: '#b42318', fontSize: 13, marginTop: 12 }, loader: { marginTop: 18 }, empty: { color: colors.faint, marginTop: 18 },
  eventCard: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: 16, paddingTop: 16 }, eventTop: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }, eventType: { color: colors.blue, fontSize: 10, fontWeight: '900', letterSpacing: 1 }, eventTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 3 }, eventMeta: { color: colors.muted, fontSize: 12, marginTop: 4 }, teams: { backgroundColor: colors.blueSoft, borderRadius: 9, color: colors.blue, fontSize: 11, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 6 }, metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 13 }, yes: { color: colors.green, fontSize: 12, fontWeight: '800' }, maybe: { color: colors.orange, fontSize: 12, fontWeight: '800' }, no: { color: '#b42318', fontSize: 12, fontWeight: '800' }, open: { color: colors.faint, fontSize: 12, fontWeight: '800' }, responseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 }, responseButton: { borderColor: colors.border, borderRadius: 9, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 }, responseActive: { backgroundColor: colors.ink, borderColor: colors.ink }, responseText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, responseTextActive: { color: colors.surface },
  notTargeted: { color: colors.faint, fontSize: 12, marginTop: 13 },
  responderBlock: { marginTop: 13 }, responderName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  details: { backgroundColor: colors.canvas, borderRadius: 10, gap: 4, marginTop: 11, padding: 10 }, detailText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, seriesTag: { color: colors.blue, fontSize: 10, fontWeight: '900' },
  deadlinePassed: { color: '#b42318', fontSize: 11, fontWeight: '800', marginTop: 5 }, formActions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 9, justifyContent: 'flex-end', marginTop: 18 }, formPrimary: { flex: 1, marginTop: 0 },
  secondaryButton: { borderColor: colors.border, borderRadius: 11, borderWidth: 1, padding: 13 }, secondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' }, manageActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 13 }, cancelButton: { borderColor: '#fda29b', borderRadius: 11, borderWidth: 1, padding: 13 }, cancelText: { color: '#b42318', fontSize: 12, fontWeight: '800' },
  attendanceBox:{backgroundColor:colors.canvas,borderRadius:13,marginTop:15,padding:14},attendanceHeader:{alignItems:'center',flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},attendanceTitle:{color:colors.ink,fontSize:14,fontWeight:'900'},miniLabel:{color:colors.muted,fontSize:11,fontWeight:'800',marginTop:12},miniChoice:{borderColor:colors.border,borderRadius:999,borderWidth:1,marginTop:7,paddingHorizontal:9,paddingVertical:6},miniChoiceActive:{backgroundColor:colors.blueSoft,borderColor:colors.blue},miniChoiceText:{color:colors.ink,fontSize:10,fontWeight:'800'},attendanceRow:{alignItems:'center',borderTopColor:colors.border,borderTopWidth:1,flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between',marginTop:12,paddingTop:12},participantName:{color:colors.ink,fontSize:13,fontWeight:'900'},currentAttendance:{color:colors.muted,fontSize:10,marginTop:3},attendanceActions:{flexDirection:'row',flexWrap:'wrap',gap:5},attendanceButton:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:8,borderWidth:1,paddingHorizontal:8,paddingVertical:6},attendanceActive:{backgroundColor:colors.ink,borderColor:colors.ink},attendanceButtonText:{color:colors.muted,fontSize:10,fontWeight:'800'},attendanceActiveText:{color:colors.surface},
  pageHeader:{alignItems:'center',flexDirection:'row',flexWrap:'wrap',gap:16,justifyContent:'space-between'},headerAction:{backgroundColor:colors.ink,borderRadius:11,paddingHorizontal:16,paddingVertical:12},headerActionText:{color:colors.surface,fontSize:13,fontWeight:'900'},
  sectionNav:{borderBottomColor:colors.border,borderBottomWidth:1,flexDirection:'row',gap:20,marginTop:18},sectionNavItem:{paddingHorizontal:2,paddingVertical:12},sectionNavActive:{borderBottomColor:colors.blue,borderBottomWidth:3},sectionNavText:{color:colors.muted,fontSize:13,fontWeight:'800'},sectionNavActiveText:{color:colors.blue,fontSize:13,fontWeight:'900'},
  successBanner:{backgroundColor:'#dff7ea',borderRadius:12,marginTop:14,padding:12},successText:{color:colors.green,fontSize:12,fontWeight:'800'},listHeader:{alignItems:'center',flexDirection:'row',justifyContent:'space-between'},countBadge:{backgroundColor:colors.blueSoft,borderRadius:999,color:colors.blue,fontSize:12,fontWeight:'900',paddingHorizontal:10,paddingVertical:6},
  emptyState:{alignItems:'center',paddingVertical:36},emptyTitle:{color:colors.ink,fontSize:16,fontWeight:'900'},eventListItem:{borderTopColor:colors.border,borderTopWidth:1,marginTop:16,paddingTop:16},eventSummary:{alignItems:'center',flexDirection:'row',flexWrap:'wrap',gap:14},dateTile:{alignItems:'center',backgroundColor:colors.canvas,borderRadius:12,minWidth:54,padding:9},dateMonth:{color:colors.blue,fontSize:9,fontWeight:'900'},dateNumber:{color:colors.ink,fontSize:22,fontWeight:'900'},listMain:{flex:1,minWidth:210},listTeams:{color:colors.faint,fontSize:11,fontWeight:'700',marginTop:5},listStatus:{alignItems:'flex-end',gap:4},detailLink:{color:colors.blue,fontSize:11,fontWeight:'900',marginTop:3},
  inlineResponseArea:{backgroundColor:colors.canvas,borderRadius:12,gap:8,marginTop:12,padding:10},inlineResponder:{alignItems:'center',flexDirection:'row',gap:10,justifyContent:'space-between'},inlineResponderName:{color:colors.ink,fontSize:11,fontWeight:'800'},inlineDeadline:{color:colors.faint,fontSize:10,fontWeight:'700'},inlineSymbols:{flexDirection:'row',gap:7},symbolButton:{alignItems:'center',backgroundColor:colors.surface,borderColor:colors.border,borderRadius:999,borderWidth:1,height:32,justifyContent:'center',width:32},symbolActive:{backgroundColor:colors.ink,borderColor:colors.ink},symbolText:{color:colors.muted,fontSize:15,fontWeight:'900'},symbolTextActive:{color:colors.surface},
  detailHeader:{alignItems:'center',flexDirection:'row',gap:12,justifyContent:'space-between',marginBottom:20},backButton:{paddingVertical:8},backText:{color:colors.blue,fontSize:12,fontWeight:'900'},detailTitle:{color:colors.ink,fontSize:28,fontWeight:'900',marginTop:4},sectionTitle:{color:colors.ink,fontSize:15,fontWeight:'900',marginTop:24},dangerZone:{borderTopColor:colors.border,borderTopWidth:1,marginTop:24,paddingTop:16},
});
