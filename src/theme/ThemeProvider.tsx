import * as SecureStore from 'expo-secure-store';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { useWorkspace } from '@/features/workspace/WorkspaceProvider';
import { colors as lightColors, darkColors, type ThemeColors } from '@/theme/colors';

export type ThemeMode='light'|'dark'|'system';
type ThemeValue={colors:ThemeColors;isDark:boolean;mode:ThemeMode;setMode:(mode:ThemeMode)=>Promise<void>};
const Context=createContext<ThemeValue|null>(null);
const key='teamapp-theme-mode';
const readMode=async()=>{if(Platform.OS==='web')return globalThis.localStorage?.getItem(key) as ThemeMode|null;return SecureStore.getItemAsync(key) as Promise<ThemeMode|null>};
const writeMode=async(mode:ThemeMode)=>{if(Platform.OS==='web')globalThis.localStorage?.setItem(key,mode);else await SecureStore.setItemAsync(key,mode)};

export function ThemeProvider({children}:PropsWithChildren){
  const system=useColorScheme(); const {activeWorkspace}=useWorkspace(); const [mode,setModeState]=useState<ThemeMode>('system');
  useEffect(()=>{void readMode().then((saved)=>{if(saved==='light'||saved==='dark'||saved==='system')setModeState(saved)})},[]);
  const isDark=mode==='system'?system==='dark':mode==='dark';
  const colors=useMemo<ThemeColors>(()=>{const base=isDark?darkColors:lightColors;const primary=activeWorkspace?.primaryColor??base.blue;return {...base,blue:primary,blueSoft:`${primary}${isDark?'33':'1f'}`,green:activeWorkspace?.accentColor??base.green}},[activeWorkspace?.primaryColor,activeWorkspace?.accentColor,isDark]);
  const value=useMemo(()=>({colors,isDark,mode,setMode:async(next:ThemeMode)=>{setModeState(next);await writeMode(next)}}),[colors,isDark,mode]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppTheme(){const value=useContext(Context);if(!value)throw new Error('useAppTheme must be used inside ThemeProvider');return value}
