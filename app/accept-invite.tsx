import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';

export default function AcceptInviteScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { refresh } = useWorkspace();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;

  const accept = async () => {
    if (!supabase) return;
    setIsSubmitting(true);
    setError(null);
    const { error: acceptError } = await supabase.rpc('accept_member_invitation', {
      invitation_code: code.trim().toUpperCase(),
    });
    setIsSubmitting(false);

    if (acceptError) {
      setError(acceptError.message);
      return;
    }

    await refresh();
    router.replace('/dashboard');
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>EINLADUNG</Text>
        <Text style={styles.title}>Weiteres Team hinzufügen</Text>
        <Text style={styles.subtitle}>Gib den zehnstelligen Code ein. Die vorgesehenen Vereine, Teams und Rollen werden deinem bestehenden Account hinzugefügt.</Text>
        <TextInput
          autoCapitalize="characters"
          maxLength={10}
          onChangeText={setCode}
          placeholder="EINLADUNGSCODE"
          style={styles.input}
          value={code}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={code.trim().length !== 10 || isSubmitting} onPress={accept} style={[styles.button, code.trim().length !== 10 && styles.disabled]}>
          {isSubmitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Einladung annehmen</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.canvas, flex: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, maxWidth: 520, padding: 26, width: '100%' },
  eyebrow: { color: colors.blue, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  input: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: 2, marginTop: 20, padding: 14, textAlign: 'center' },
  error: { color: '#b42318', fontSize: 13, marginTop: 12 },
  button: { alignItems: 'center', backgroundColor: colors.ink, borderRadius: 12, marginTop: 18, minHeight: 48, padding: 14 },
  buttonText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.38 },
});
