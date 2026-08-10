import { type Href, usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/theme/ThemeProvider';

const items=[{label:'Spieler & Rollen',path:'/members'},{label:'Kader & Positionen',path:'/squad'},{label:'Statistik',path:'/statistics'}] as const;
export function TeamNavigation(){const router=useRouter();const pathname=usePathname();const {colors}=useAppTheme();const styles=createStyles(colors);return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{items.map((item)=>{const active=pathname===item.path;return <Pressable accessibilityRole="tab" accessibilityState={{selected:active}} key={item.path} onPress={()=>router.replace(item.path as Href)} style={[styles.item,active&&styles.active]}><Text style={[styles.text,active&&styles.activeText]}>{item.label}</Text></Pressable>})}</ScrollView>}
const createStyles=(colors:ReturnType<typeof useAppTheme>['colors'])=>StyleSheet.create({row:{gap:8,marginTop:18},item:{backgroundColor:colors.surface,borderColor:colors.border,borderRadius:10,borderWidth:1,paddingHorizontal:14,paddingVertical:10},active:{backgroundColor:colors.blue,borderColor:colors.blue},text:{color:colors.muted,fontSize:12,fontWeight:'800'},activeText:{color:'#ffffff'}});
