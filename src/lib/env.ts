function optionalPublicEnv(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY') {
  return process.env[name]?.trim() || null;
}

export const publicEnv = {
  supabaseUrl: optionalPublicEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: optionalPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
};
