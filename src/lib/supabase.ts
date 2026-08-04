import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { publicEnv } from '@/lib/env';

const mobileStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
};

export const isSupabaseConfigured = Boolean(
  publicEnv.supabaseUrl && publicEnv.supabaseAnonKey,
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(publicEnv.supabaseUrl!, publicEnv.supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
        persistSession: true,
        storage: Platform.OS === 'web' ? undefined : mobileStorage,
      },
    })
  : null;
