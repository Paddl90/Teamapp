import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme/colors';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { WorkspaceProvider } from '@/features/workspace/WorkspaceProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <StatusBar style="dark" />
        <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.canvas },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ title: 'Anmelden', presentation: 'modal' }} />
        <Stack.Screen name="register" options={{ title: 'Konto erstellen', presentation: 'modal' }} />
        <Stack.Screen name="setup" options={{ title: 'Arbeitsbereich einrichten' }} />
        <Stack.Screen name="members" options={{ title: 'Mitglieder' }} />
        <Stack.Screen name="events" options={{ title: 'Termine & Verfügbarkeit' }} />
        <Stack.Screen name="availability" options={{ title: 'Zeitfensterplanung' }} />
        <Stack.Screen name="squad" options={{ title: 'Saison-Kaderplanung' }} />
        <Stack.Screen name="matchday" options={{ title: 'Spieltagsaufstellung' }} />
        <Stack.Screen name="funds" options={{ title: 'Mannschaftskasse' }} />
        <Stack.Screen name="accept-invite" options={{ title: 'Einladung annehmen' }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        </Stack>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
