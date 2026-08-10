import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

export type TeamContext = {
  id: string;
  name: string;
  roles: string[];
};

export type WorkspaceContext = {
  id: string;
  clubId: string;
  clubName: string;
  primaryColor: string;
  accentColor: string;
  seasonId: string;
  seasonName: string;
  cohortId: string;
  cohortName: string;
  clubRoles: string[];
  teams: TeamContext[];
};

type WorkspaceContextValue = {
  activeTeamId: string | null;
  activeWorkspace: WorkspaceContext | null;
  contexts: WorkspaceContext[];
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  selectTeam: (teamId: string | null) => void;
  selectWorkspace: (workspaceId: string) => void;
};

const Context = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  const [contexts, setContexts] = useState<WorkspaceContext[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  // Keep protected routes mounted until the initial session-driven workspace
  // lookup has completed. This also preserves direct web links on first load.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const client = supabase;
    const userId = session?.user.id;
    if (!client || !userId) {
      setContexts([]);
      setActiveWorkspaceId(null);
      setActiveTeamId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: memberships, error: membershipError } = await client
      .from('memberships')
      .select('id, club_id')
      .eq('profile_id', userId)
      .eq('status', 'active')
      .order('created_at');

    if (membershipError) {
      setError(membershipError.message);
      setIsLoading(false);
      return;
    }

    const nextContexts: WorkspaceContext[] = [];

    for (const membership of memberships ?? []) {
      const [{ data: club }, { data: season }, { data: clubRoleRows }, { data: assignmentRows }] = await Promise.all([
        client.from('clubs').select('name,primary_color,accent_color').eq('id', membership.club_id).single(),
        client
          .from('seasons')
          .select('id, name')
          .eq('club_id', membership.club_id)
          .order('starts_on', { ascending: false })
          .limit(1)
          .maybeSingle(),
        client.from('membership_roles').select('role').eq('membership_id', membership.id),
        client
          .from('team_memberships')
          .select('id, team_id, team_membership_roles(role)')
          .eq('membership_id', membership.id),
      ]);

      if (!club || !season) continue;

      const { data: cohortRows } = await client
        .from('cohorts')
        .select('id, name')
        .eq('club_id', membership.club_id)
        .eq('season_id', season.id)
        .order('created_at');

      for (const cohort of cohortRows ?? []) {
        const { data: teamRows } = await client
          .from('teams')
          .select('id, name')
          .eq('club_id', membership.club_id)
          .eq('cohort_id', cohort.id)
          .order('sort_order');

        nextContexts.push({
          id: `${membership.club_id}:${season.id}:${cohort.id}`,
          clubId: membership.club_id,
          clubName: club.name,
          primaryColor: club.primary_color,
          accentColor: club.accent_color,
          seasonId: season.id,
          seasonName: season.name,
          cohortId: cohort.id,
          cohortName: cohort.name,
          clubRoles: (clubRoleRows ?? []).map((row) => row.role),
          teams: (teamRows ?? []).map((team) => {
            const assignment = (assignmentRows ?? []).find((row) => row.team_id === team.id);
            const roleRows = (assignment?.team_membership_roles ?? []) as Array<{ role: string }>;
            return { id: team.id, name: team.name, roles: roleRows.map((row) => row.role) };
          }),
        });
      }
    }

    setContexts(nextContexts);
    setActiveWorkspaceId((current) =>
      current && nextContexts.some((context) => context.id === current) ? current : nextContexts[0]?.id ?? null,
    );
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, [session?.user.id]);

  const activeWorkspace = contexts.find((context) => context.id === activeWorkspaceId) ?? null;

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      activeTeamId,
      activeWorkspace,
      contexts,
      error,
      isLoading,
      refresh,
      selectTeam: setActiveTeamId,
      selectWorkspace: (workspaceId) => {
        setActiveWorkspaceId(workspaceId);
        setActiveTeamId(null);
      },
    }),
    [activeTeamId, activeWorkspace, contexts, error, isLoading],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
