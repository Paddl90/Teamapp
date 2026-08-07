export const publicEnv = {
  // Expo ersetzt EXPO_PUBLIC-Werte beim Build nur bei statischem Punktzugriff.
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || null,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || null,
};
