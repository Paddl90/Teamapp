import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/colors';

export default function SignInScreen() {
  const router = useRouter();
  const { isConfigured, isLoading, session, signInWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) return <Redirect href="/dashboard" />;

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    const nextError = await signInWithPassword(email, password);
    setIsSubmitting(false);

    if (nextError) {
      setError(nextError);
      return;
    }
    router.replace('/dashboard');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>TEAMAPP</Text>
        <Text style={styles.title}>Willkommen zurück</Text>
        <Text style={styles.subtitle}>Melde dich mit deinem Vereinskonto an.</Text>

        {!isConfigured ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Backend noch nicht verbunden</Text>
            <Text style={styles.noticeText}>
              Hinterlege die Supabase-Zugangsdaten in `.env.local`, um die Anmeldung zu
              aktivieren. Der Pilotmodus funktioniert bereits ohne Backend.
            </Text>
          </View>
        ) : null}

        <Text style={styles.label}>E-Mail-Adresse</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          editable={isConfigured && !isSubmitting}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="name@verein.de"
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Passwort</Text>
        <TextInput
          autoComplete="current-password"
          editable={isConfigured && !isSubmitting}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!isConfigured || isSubmitting || isLoading || !email || !password}
          onPress={submit}
          style={({ pressed }) => [
            styles.button,
            (!isConfigured || isSubmitting || !email || !password) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>Anmelden</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.replace('/dashboard?demo=1')} style={styles.demoLink}>
          <Text style={styles.demoLinkText}>Stattdessen Pilot ansehen</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/register')} style={styles.demoLink}>
          <Text style={styles.demoLinkText}>Noch kein Konto? Registrieren</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    maxWidth: 460,
    padding: 28,
    width: '100%',
  },
  eyebrow: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
    marginTop: 8,
  },
  notice: {
    backgroundColor: colors.blueSoft,
    borderRadius: 12,
    marginBottom: 20,
    padding: 14,
  },
  noticeTitle: {
    color: colors.blue,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 12,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  error: {
    color: '#b42318',
    fontSize: 13,
    marginTop: 12,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    marginTop: 22,
    minHeight: 48,
    padding: 14,
  },
  buttonDisabled: { opacity: 0.38 },
  buttonPressed: { opacity: 0.72 },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  demoLink: { alignItems: 'center', marginTop: 18, padding: 6 },
  demoLinkText: { color: colors.blue, fontSize: 14, fontWeight: '700' },
});
