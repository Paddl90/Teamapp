import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { colors } from '@/theme/colors';

export function ContextSwitcher() {
  const { activeTeamId, activeWorkspace, contexts, selectTeam, selectWorkspace } = useWorkspace();

  if (!activeWorkspace) return null;

  return (
    <View style={styles.wrapper}>
      {contexts.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {contexts.map((context) => (
            <Pressable
              accessibilityRole="button"
              key={context.id}
              onPress={() => selectWorkspace(context.id)}
              style={[styles.workspaceButton, context.id === activeWorkspace.id && styles.workspaceActive]}
            >
              <Text style={[styles.workspaceText, context.id === activeWorkspace.id && styles.workspaceTextActive]}>
                {context.clubName} · {context.cohortName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => selectTeam(null)}
          style={[styles.teamButton, activeTeamId === null && styles.teamActive]}
        >
          <Text style={[styles.teamText, activeTeamId === null && styles.teamTextActive]}>Gesamt</Text>
        </Pressable>
        {activeWorkspace.teams.map((team) => (
          <Pressable
            accessibilityRole="button"
            key={team.id}
            onPress={() => selectTeam(team.id)}
            style={[styles.teamButton, activeTeamId === team.id && styles.teamActive]}
          >
            <Text style={[styles.teamText, activeTeamId === team.id && styles.teamTextActive]}>{team.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8, marginTop: 12 },
  row: { gap: 8 },
  workspaceButton: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  workspaceActive: { backgroundColor: colors.blueSoft, borderColor: colors.blue },
  workspaceText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  workspaceTextActive: { color: colors.blue },
  teamButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  teamActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  teamText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  teamTextActive: { color: colors.surface },
});
