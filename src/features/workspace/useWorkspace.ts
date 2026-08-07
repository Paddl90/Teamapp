import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type WorkspaceSummary = {
  clubId: string;
  clubName: string;
  seasonName: string;
  cohortName: string;
  teams: string[];
};

export function useWorkspace(userId?: string) {
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client || !userId) {
      setWorkspace(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      const { data: membership, error: membershipError } = await client
        .from('memberships')
        .select('club_id')
        .eq('profile_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!isActive) return;
      if (membershipError) {
        setError(membershipError.message);
        setIsLoading(false);
        return;
      }
      if (!membership) {
        setWorkspace(null);
        setIsLoading(false);
        return;
      }

      const clubId = membership.club_id as string;
      const [{ data: club }, { data: season }] = await Promise.all([
        client.from('clubs').select('name').eq('id', clubId).single(),
        client
          .from('seasons')
          .select('id, name')
          .eq('club_id', clubId)
          .order('starts_on', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!isActive) return;
      if (!club || !season) {
        setError('Der Arbeitsbereich ist unvollständig.');
        setIsLoading(false);
        return;
      }

      const { data: cohort } = await client
        .from('cohorts')
        .select('id, name')
        .eq('club_id', clubId)
        .eq('season_id', season.id)
        .order('created_at')
        .limit(1)
        .maybeSingle();

      if (!isActive) return;
      if (!cohort) {
        setError('Es wurde noch kein Bereich angelegt.');
        setIsLoading(false);
        return;
      }

      const { data: teamRows } = await client
        .from('teams')
        .select('name')
        .eq('club_id', clubId)
        .eq('cohort_id', cohort.id)
        .order('sort_order');

      if (!isActive) return;
      setWorkspace({
        clubId,
        clubName: club.name,
        seasonName: season.name,
        cohortName: cohort.name,
        teams: (teamRows ?? []).map((team) => team.name),
      });
      setIsLoading(false);
    };

    void load();
    return () => {
      isActive = false;
    };
  }, [userId]);

  return { error, isLoading, workspace };
}
