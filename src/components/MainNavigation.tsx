import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { colors } from '@/theme/colors';

const items = [
  { label: 'Start', path: '/dashboard', routes: ['/dashboard'] },
  { label: 'Kalender', path: '/events', routes: ['/events', '/availability'] },
  { label: 'Team', path: '/members', routes: ['/members', '/squad', '/statistics'] },
  { label: 'Spieltag', path: '/matchday', routes: ['/matchday', '/match-report'] },
  { label: 'Mehr', path: '/notifications', routes: ['/notifications', '/training', '/funds', '/accept-invite'] },
] as const;

const hiddenRoutes = ['/', '/sign-in', '/register', '/setup'];

export function MainNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  if (!session || hiddenRoutes.includes(pathname)) return null;

  return (
    <View style={[styles.navigation, isDesktop ? styles.sidebar : styles.bottomBar]}>
      {isDesktop ? (
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>TEAMAPP</Text>
          <Text style={styles.brandSubtitle}>Vereinsorganisation</Text>
        </View>
      ) : null}

      <View style={[styles.items, isDesktop && styles.desktopItems]}>
        {items.map((item) => {
          const active = item.routes.includes(pathname as never);
          return (
            <Pressable
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              key={item.path}
              onPress={() => router.replace(item.path as Href)}
              style={[styles.item, isDesktop ? styles.desktopItem : styles.mobileItem, active && styles.activeItem]}
            >
              <View style={[styles.marker, active && styles.activeMarker]} />
              <Text style={[styles.label, active && styles.activeLabel]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: { backgroundColor: colors.surface, borderColor: colors.border },
  sidebar: { borderRightWidth: 1, paddingHorizontal: 16, paddingVertical: 24, width: 220 },
  bottomBar: { borderTopWidth: 1, paddingBottom: 6, paddingHorizontal: 6, paddingTop: 7 },
  brandBlock: { paddingHorizontal: 10 },
  brand: { color: colors.blue, fontSize: 14, fontWeight: '900', letterSpacing: 1.4 },
  brandSubtitle: { color: colors.faint, fontSize: 11, marginTop: 4 },
  items: { flexDirection: 'row', justifyContent: 'space-around' },
  desktopItems: { flexDirection: 'column', gap: 6, marginTop: 34 },
  item: { alignItems: 'center', borderRadius: 12 },
  desktopItem: { flexDirection: 'row', gap: 11, justifyContent: 'flex-start', paddingHorizontal: 12, paddingVertical: 13 },
  mobileItem: { flex: 1, gap: 5, minWidth: 58, paddingHorizontal: 3, paddingVertical: 6 },
  activeItem: { backgroundColor: colors.blueSoft },
  marker: { backgroundColor: colors.border, borderRadius: 999, height: 6, width: 6 },
  activeMarker: { backgroundColor: colors.blue },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  activeLabel: { color: colors.blue },
});
