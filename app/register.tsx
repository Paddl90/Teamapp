import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useAppTheme } from '@/theme/ThemeProvider';

export default function RegisterScreen() {
  const {colors}=useAppTheme(); const styles=createStyles(colors);
  const router = useRouter();
  const { isConfigured, session, signUpWithPassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) return <Redirect href="/setup" />;

  const submit = async () => {
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const nextError = await signUpWithPassword(email, password, displayName);
    setIsSubmitting(false);

    if (nextError) {
      setError(nextError);
      return;
    }
    router.replace('/setup');
  };

  const isValid = Boolean(displayName.trim() && email.trim() && password.length >= 8);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ERSTER SCHRITT</Text>
          <Text style={styles.title}>Konto erstellen</Text>
          <Text style={styles.subtitle}>Danach richtest du deinen Verein und die ersten Teams ein.</Text>

          <Field label="Dein Name" value={displayName} onChangeText={setDisplayName} placeholder="Vor- und Nachname" />
          <Field label="E-Mail-Adresse" value={email} onChangeText={setEmail} placeholder="name@verein.de" email />
          <Field label="Passwort" value={password} onChangeText={setPassword} placeholder="Mindestens 8 Zeichen" secure />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={!isConfigured || !isValid || isSubmitting}
            onPress={submit}
            style={({ pressed }) => [styles.button, (!isConfigured || !isValid) && styles.disabled, pressed && styles.pressed]}
          >
            {isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Konto erstellen</Text>}
          </Pressable>

          <Pressable onPress={() => router.replace('/sign-in')} style={styles.link}>
            <Text style={styles.linkText}>Bereits registriert? Anmelden</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  email?: boolean;
  secure?: boolean;
};

function Field({ label, value, onChangeText, placeholder, email, secure }: FieldProps) {
  const {colors}=useAppTheme(); const styles=createStyles(colors);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={email ? 'none' : 'words'}
        autoComplete={email ? 'email' : secure ? 'new-password' : 'name'}
        keyboardType={email ? 'email-address' : 'default'}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secure}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const createStyles=(colors:ReturnType<typeof useAppTheme>['colors'])=>StyleSheet.create({
  page: { backgroundColor: colors.canvas, flex: 1 },
  scroll: { alignItems: 'center', flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 24, borderWidth: 1, maxWidth: 480, padding: 28, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 30, fontWeight: '900', marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginBottom: 18, marginTop: 8 },
  field: { marginTop: 14 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 16, paddingHorizontal: 14, paddingVertical: 13 },
  error: { color: '#b42318', fontSize: 13, marginTop: 14 },
  button: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, marginTop: 22, minHeight: 48, padding: 14 },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.72 },
  link: { alignItems: 'center', marginTop: 16, padding: 6 },
  linkText: { color: colors.blue, fontSize: 14, fontWeight: '700' },
});
