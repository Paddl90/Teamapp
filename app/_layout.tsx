import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/theme/colors';
import { AuthProvider } from '@/features/auth/AuthProvider';

export default function RootLayout() {
  return (
    <AuthProvider>
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
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
