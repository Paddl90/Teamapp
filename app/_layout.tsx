import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { MainNavigation } from '@/components/MainNavigation';
import { ThemeProvider, useAppTheme } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { WorkspaceProvider } from '@/features/workspace/WorkspaceProvider';

export default function RootLayout() {
  return <AuthProvider><WorkspaceProvider><ThemeProvider><ThemedLayout /></ThemeProvider></WorkspaceProvider></AuthProvider>;
}

function ThemedLayout() {
  const { width } = useWindowDimensions();
  const {colors,isDark}=useAppTheme();
  const isDesktop = width >= 900;
  const styles=createStyles(colors);

  return (
        <>
        <StatusBar style={isDark?'light':'dark'} />
        <View style={[styles.app, isDesktop ? styles.desktop : styles.mobile]}>
          {isDesktop ? <MainNavigation /> : null}
          <View style={styles.content}>
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
              <Stack.Screen name="match-report" options={{ title: 'Spielbericht' }} />
              <Stack.Screen name="funds" options={{ title: 'Mannschaftskasse' }} />
              <Stack.Screen name="statistics" options={{ title: 'Statistik' }} />
              <Stack.Screen name="training" options={{ title: 'Individuelles Training' }} />
              <Stack.Screen name="notifications" options={{ title: 'Benachrichtigungen' }} />
              <Stack.Screen name="accept-invite" options={{ title: 'Einladung annehmen' }} />
              <Stack.Screen name="more" options={{ title: 'Mehr' }} />
              <Stack.Screen name="settings" options={{ title: 'Einstellungen' }} />
              <Stack.Screen name="dashboard" options={{ headerShown: false }} />
            </Stack>
          </View>
          {!isDesktop ? <MainNavigation /> : null}
        </View>
        </>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
  app: { backgroundColor: colors.canvas, flex: 1 },
  desktop: { flexDirection: 'row' },
  mobile: { flexDirection: 'column' },
  content: { flex: 1 },
});
