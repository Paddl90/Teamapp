import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ContextSwitcher } from '@/components/ContextSwitcher';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

const roleLabels: Record<string, string> = {
  player: 'Spieler',
  coach: 'Trainer',
  guardian: 'Elternteil',
  treasurer: 'Kassenwart',
  medical: 'Medizin',
  club_admin: 'Vereinsadmin',
  cohort_admin: 'Bereichsadmin',
};

type MemberView = {
  id: string;
  name: string;
  birthDate: string;
  status: string;
  clubRoles: string[];
  teams: Array<{ id: string; name: string; roles: string[] }>;
};

type InvitationView = { id: string; email: string; code: string; status: string };
type GuardianLink = { id: string; guardian_membership_id: string; child_membership_id: string };

export default function MembersScreen() {
  const { isLoading: isAuthLoading, session } = useAuth();
  const { activeWorkspace, isLoading: isWorkspaceLoading } = useWorkspace();
  const [members, setMembers] = useState<MemberView[]>([]);
  const [invitations, setInvitations] = useState<InvitationView[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<GuardianLink[]>([]);
  const [guardianId, setGuardianId] = useState('');
  const [childId, setChildId] = useState('');
  const [email, setEmail] = useState('');
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editAssignments, setEditAssignments] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = Boolean(
    activeWorkspace?.clubRoles.some((role) => role === 'club_admin' || role === 'cohort_admin'),
  );

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !activeWorkspace) return;
    setIsLoading(true);
    setError(null);

    const { data: membershipRows, error: membershipError } = await client
      .from('memberships')
      .select('id, profile_id, status')
      .eq('club_id', activeWorkspace.clubId)
      .order('created_at');

    if (membershipError) {
      setError(membershipError.message);
      setIsLoading(false);
      return;
    }

    const membershipIds = (membershipRows ?? []).map((row) => row.id);
    const profileIds = (membershipRows ?? []).map((row) => row.profile_id);
    const [{ data: profileRows }, { data: clubRoleRows }, { data: teamMembershipRows }, invitationResult, guardianResult] = await Promise.all([
      profileIds.length
        ? client.from('profiles').select('id, display_name, birth_date').in('id', profileIds)
        : Promise.resolve({ data: [] }),
      membershipIds.length
        ? client.from('membership_roles').select('membership_id, role').in('membership_id', membershipIds)
        : Promise.resolve({ data: [] }),
      membershipIds.length
        ? client
            .from('team_memberships')
            .select('id, membership_id, team_id, team_membership_roles(role)')
            .in('membership_id', membershipIds)
        : Promise.resolve({ data: [] }),
      canManage
        ? client
            .from('member_invitations')
            .select('id, email, code, status')
            .eq('club_id', activeWorkspace.clubId)
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      client.from('guardian_child_links').select('id, guardian_membership_id, child_membership_id').eq('club_id', activeWorkspace.clubId),
    ]);

    const teamById = new Map(activeWorkspace.teams.map((team) => [team.id, team.name]));
    setMembers(
      (membershipRows ?? []).map((membership) => {
        const profile = (profileRows ?? []).find((row) => row.id === membership.profile_id);
        return {
        id: membership.id,
        name: profile?.display_name || 'Unbenanntes Mitglied',
        birthDate: profile?.birth_date ?? '',
        status: membership.status,
        clubRoles: (clubRoleRows ?? []).filter((row) => row.membership_id === membership.id).map((row) => row.role),
        teams: (teamMembershipRows ?? [])
          .filter((row) => row.membership_id === membership.id && teamById.has(row.team_id))
          .map((row) => ({
            id: row.team_id,
            name: teamById.get(row.team_id)!,
            roles: ((row.team_membership_roles ?? []) as Array<{ role: string }>).map((role) => role.role),
          })),
        };
      }),
    );
    setInvitations((invitationResult.data ?? []) as InvitationView[]);
    setGuardianLinks((guardianResult.data ?? []) as GuardianLink[]);
    setIsLoading(false);
  }, [activeWorkspace?.id, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedAssignments = useMemo(
    () => Object.entries(assignments).filter(([, roles]) => roles.length > 0),
    [assignments],
  );

  const toggleRole = (teamId: string, role: string) => {
    setAssignments((current) => {
      const roles = current[teamId] ?? [];
      return {
        ...current,
        [teamId]: roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role],
      };
    });
  };

  const createInvitation = async () => {
    if (!supabase || !activeWorkspace || selectedAssignments.length < 1) return;
    setIsSubmitting(true);
    setError(null);
    setCreatedCode(null);

    const { data, error: invitationError } = await supabase.rpc('create_member_invitation', {
      target_club_id: activeWorkspace.clubId,
      invite_email: email.trim(),
      assignments: selectedAssignments.map(([teamId, roles]) => ({ team_id: teamId, roles })),
    });

    setIsSubmitting(false);
    if (invitationError) {
      setError(invitationError.message);
      return;
    }

    setCreatedCode(data as string);
    setEmail('');
    setAssignments({});
    await load();
  };

  const beginEdit = (member: MemberView) => {
    setEditingMemberId(member.id);
    setEditName(member.name);
    setEditBirthDate(member.birthDate);
    setEditAssignments(Object.fromEntries(member.teams.map((team) => [team.id, team.roles])));
    setError(null);
  };

  const toggleEditRole = (teamId: string, role: string) => {
    setEditAssignments((current) => {
      const roles = current[teamId] ?? [];
      return {
        ...current,
        [teamId]: roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role],
      };
    });
  };

  const saveMember = async () => {
    if (!supabase || !editingMemberId || editName.trim().length < 2) return;
    setIsSubmitting(true);
    setError(null);
    const nextAssignments = Object.entries(editAssignments)
      .filter(([, roles]) => roles.length > 0)
      .map(([teamId, roles]) => ({ team_id: teamId, roles }));
    const { error: saveError } = await supabase.rpc('update_member_profile_and_roles', {
      target_membership_id: editingMemberId,
      new_display_name: editName.trim(),
      new_birth_date: editBirthDate || null,
      assignments: nextAssignments,
    });
    setIsSubmitting(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setEditingMemberId(null);
    await load();
  };

  const revokeInvitation = async (invitationId: string) => {
    if (!supabase) return;
    setIsSubmitting(true);
    setError(null);
    const { error: revokeError } = await supabase.rpc('revoke_member_invitation', {
      target_invitation_id: invitationId,
    });
    setIsSubmitting(false);
    if (revokeError) {
      setError(revokeError.message);
      return;
    }
    await load();
  };

  const saveGuardianLink = async (targetGuardianId: string, targetChildId: string, shouldLink: boolean) => {
    if (!supabase || !targetGuardianId || !targetChildId) return;
    setIsSubmitting(true); setError(null);
    const { error: linkError } = await supabase.rpc('set_guardian_child_link', {
      target_guardian_membership_id: targetGuardianId,
      target_child_membership_id: targetChildId,
      should_link: shouldLink,
    });
    setIsSubmitting(false);
    if (linkError) { setError(linkError.message); return; }
    setGuardianId(''); setChildId(''); await load();
  };

  if (isAuthLoading) return null;
  if (!session) return <Redirect href="/sign-in" />;
  if (!isWorkspaceLoading && !activeWorkspace) return <Redirect href="/setup" />;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.shell}>
        <Text style={styles.eyebrow}>MITGLIEDER & ROLLEN</Text>
        <Text style={styles.title}>Ein Account, mehrere Aufgaben</Text>
        <Text style={styles.subtitle}>Rollen werden pro Team vergeben. Dieselbe Person kann dadurch gleichzeitig Spieler und Trainer in unterschiedlichen Teams sein.</Text>
        <ContextSwitcher />

        {canManage ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mitglied einladen</Text>
            <Text style={styles.helper}>Die eingeladene Person registriert sich mit dieser E-Mail-Adresse und gibt anschließend den Code ein.</Text>
            <Text style={styles.label}>E-Mail-Adresse</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="mitglied@verein.de"
              style={styles.input}
              value={email}
            />

            <Text style={styles.label}>Teams und Rollen</Text>
            {activeWorkspace?.teams.map((team) => (
              <View key={team.id} style={styles.assignmentRow}>
                <Text style={styles.teamName}>{team.name}</Text>
                <View style={styles.roleRow}>
                  {['player', 'coach', 'guardian'].map((role) => {
                    const selected = assignments[team.id]?.includes(role);
                    return (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(selected) }}
                        key={role}
                        onPress={() => toggleRole(team.id, role)}
                        style={[styles.roleButton, selected && styles.roleButtonActive]}
                      >
                        <Text style={[styles.roleText, selected && styles.roleTextActive]}>{roleLabels[role]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {createdCode ? (
              <View style={styles.success}>
                <Text style={styles.successTitle}>Einladung erstellt</Text>
                <Text style={styles.code}>{createdCode}</Text>
                <Text style={styles.helper}>Diesen Code sicher an die eingeladene Person weitergeben.</Text>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!email.includes('@') || selectedAssignments.length < 1 || isSubmitting}
              onPress={createInvitation}
              style={[styles.primaryButton, (!email.includes('@') || selectedAssignments.length < 1) && styles.disabled]}
            >
              {isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Einladungscode erstellen</Text>}
            </Pressable>
          </View>
        ) : null}

        {!canManage && guardianLinks.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meine betreuten Spieler</Text>
            <Text style={styles.helper}>Für diese Kinder kannst du Termin-Rückmeldungen und Trainingsvorgaben verwalten.</Text>
            {guardianLinks.map((link) => (
              <View key={`mine:${link.id}`} style={styles.memberRow}>
                <Text style={styles.memberName}>{members.find((member) => member.id === link.child_membership_id)?.name ?? 'Spieler'}</Text>
                <Text style={styles.memberMeta}>{members.find((member) => member.id === link.child_membership_id)?.teams.map((team) => team.name).join(' · ')}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aktive Mitglieder</Text>
          {isLoading ? <ActivityIndicator color={colors.blue} style={styles.loader} /> : null}
          {members.map((member) => (
            <View key={member.id} style={styles.memberRow}>
              <View style={styles.memberMain}>
                <Text style={styles.memberName}>{member.name}</Text>
                {member.birthDate ? <Text style={styles.memberMeta}>Geboren am {member.birthDate}</Text> : null}
                {member.clubRoles.length ? <Text style={styles.memberMeta}>{member.clubRoles.map((role) => roleLabels[role] ?? role).join(' · ')}</Text> : null}
                {canManage ? (
                  <Pressable accessibilityRole="button" onPress={() => beginEdit(member)} style={styles.editButton}>
                    <Text style={styles.editButtonText}>Profil & Rollen bearbeiten</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.memberTeams}>
                {member.teams.length ? member.teams.map((team) => (
                  <View key={`${member.id}:${team.name}`} style={styles.teamTag}>
                    <Text style={styles.teamTagTitle}>{team.name}</Text>
                    <Text style={styles.teamTagRoles}>{team.roles.map((role) => roleLabels[role] ?? role).join(' + ') || 'zugeordnet'}</Text>
                  </View>
                )) : <Text style={styles.unassigned}>Noch keinem Team zugeordnet</Text>}
              </View>
            </View>
          ))}
        </View>

        {canManage ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Eltern & Kinder verknüpfen</Text>
            <Text style={styles.helper}>Ein Elternaccount kann mehrere Spieler betreuen. Die Spieler bleiben eigenständige Mitglieder mit eigenen Teams und Statistiken.</Text>
            <Text style={styles.label}>Elternteil</Text>
            <View style={styles.roleRow}>{members.filter((member) => member.id !== childId).map((member) => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: guardianId === member.id }} key={`guardian:${member.id}`} onPress={() => setGuardianId(member.id)} style={[styles.roleButton, guardianId === member.id && styles.roleButtonActive]}>
                <Text style={[styles.roleText, guardianId === member.id && styles.roleTextActive]}>{member.name}</Text>
              </Pressable>
            ))}</View>
            <Text style={styles.label}>Kind / Spieler</Text>
            <View style={styles.roleRow}>{members.filter((member) => member.id !== guardianId && member.teams.some((team) => team.roles.includes('player'))).map((member) => (
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: childId === member.id }} key={`child:${member.id}`} onPress={() => setChildId(member.id)} style={[styles.roleButton, childId === member.id && styles.roleButtonActive]}>
                <Text style={[styles.roleText, childId === member.id && styles.roleTextActive]}>{member.name}</Text>
              </Pressable>
            ))}</View>
            <Pressable accessibilityRole="button" disabled={!guardianId || !childId || isSubmitting} onPress={() => saveGuardianLink(guardianId, childId, true)} style={[styles.primaryButton, (!guardianId || !childId) && styles.disabled]}>
              <Text style={styles.primaryText}>Verknüpfung speichern</Text>
            </Pressable>
            {guardianLinks.map((link) => (
              <View key={link.id} style={styles.invitationRow}>
                <Text style={styles.memberName}>{members.find((member) => member.id === link.guardian_membership_id)?.name} betreut {members.find((member) => member.id === link.child_membership_id)?.name}</Text>
                <Pressable accessibilityRole="button" onPress={() => saveGuardianLink(link.guardian_membership_id, link.child_membership_id, false)} style={styles.revokeButton}><Text style={styles.revokeText}>Verknüpfung lösen</Text></Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {canManage && editingMemberId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mitglied bearbeiten</Text>
            <Text style={styles.label}>Anzeigename</Text>
            <TextInput onChangeText={setEditName} placeholder="Vor- und Nachname" style={styles.input} value={editName} />
            <Text style={styles.label}>Geburtsdatum (JJJJ-MM-TT)</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setEditBirthDate}
              placeholder="2010-05-20"
              style={styles.input}
              value={editBirthDate}
            />
            <Text style={styles.label}>Teams und Rollen</Text>
            {activeWorkspace?.teams.map((team) => (
              <View key={`edit:${team.id}`} style={styles.assignmentRow}>
                <Text style={styles.teamName}>{team.name}</Text>
                <View style={styles.roleRow}>
                  {['player', 'coach', 'guardian'].map((role) => {
                    const selected = editAssignments[team.id]?.includes(role);
                    return (
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(selected) }}
                        key={role}
                        onPress={() => toggleEditRole(team.id, role)}
                        style={[styles.roleButton, selected && styles.roleButtonActive]}
                      >
                        <Text style={[styles.roleText, selected && styles.roleTextActive]}>{roleLabels[role]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.editActions}>
              <Pressable accessibilityRole="button" onPress={() => setEditingMemberId(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={editName.trim().length < 2 || isSubmitting}
                onPress={saveMember}
                style={[styles.primaryButton, styles.saveButton, editName.trim().length < 2 && styles.disabled]}
              >
                {isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>Änderungen speichern</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        {canManage && invitations.length ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Letzte Einladungen</Text>
            {invitations.map((invitation) => (
              <View key={invitation.id} style={styles.invitationRow}>
                <View><Text style={styles.memberName}>{invitation.email}</Text><Text style={styles.memberMeta}>{invitation.status === 'pending' ? 'Offen' : invitation.status === 'accepted' ? 'Angenommen' : invitation.status === 'revoked' ? 'Widerrufen' : 'Abgelaufen'}</Text></View>
                <View style={styles.invitationActions}>
                  <Text style={styles.smallCode}>{invitation.code}</Text>
                  {invitation.status === 'pending' ? (
                    <Pressable accessibilityRole="button" onPress={() => revokeInvitation(invitation.id)} style={styles.revokeButton}>
                      <Text style={styles.revokeText}>Widerrufen</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: colors.canvas, minHeight: '100%', padding: 20, paddingBottom: 48 },
  shell: { alignSelf: 'center', maxWidth: 920, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 14 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 700 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: 18, padding: 20 },
  cardTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 7, marginTop: 16 },
  input: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  assignmentRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingVertical: 12 },
  teamName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleButton: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  roleButtonActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  roleText: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  roleTextActive: { color: colors.surface },
  primaryButton: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, marginTop: 18, minHeight: 48, padding: 14 },
  primaryText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.38 },
  error: { color: '#b42318', fontSize: 13, marginTop: 12 },
  success: { backgroundColor: '#ecfdf3', borderRadius: 12, marginTop: 14, padding: 14 },
  successTitle: { color: colors.green, fontWeight: '900' },
  code: { color: colors.ink, fontSize: 26, fontWeight: '900', letterSpacing: 2, marginTop: 6 },
  loader: { marginTop: 16 },
  memberRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingVertical: 14 },
  memberMain: { minWidth: 180 },
  memberName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  memberMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  editButton: { alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4 },
  editButtonText: { color: colors.blue, fontSize: 12, fontWeight: '800' },
  memberTeams: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  teamTag: { backgroundColor: colors.blueSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  teamTagTitle: { color: colors.blue, fontSize: 12, fontWeight: '900' },
  teamTagRoles: { color: colors.muted, fontSize: 11, marginTop: 2 },
  unassigned: { color: colors.faint, fontSize: 12 },
  invitationRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  invitationActions: { alignItems: 'flex-end', gap: 6 },
  smallCode: { color: colors.ink, fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  revokeButton: { borderColor: '#fda29b', borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
  revokeText: { color: '#b42318', fontSize: 11, fontWeight: '800' },
  editActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  secondaryButton: { alignItems: 'center', borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginTop: 18, minHeight: 48, padding: 14 },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  saveButton: { minWidth: 190 },
});
