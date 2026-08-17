import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useAppTheme } from '@/theme/ThemeProvider';

export type PitchPlayer={id:string;name:string;label?:string;x:number;y:number};
type Props={players:PitchPlayer[];editable?:boolean;onMove?:(id:string,x:number,y:number)=>void;emptyText?:string};
const clamp=(value:number)=>Math.max(6,Math.min(94,value));

export function FootballPitch({players,editable=false,onMove,emptyText='Ziehe Spieler aus der Liste in die Startelf.'}:Props){
  const {colors}=useAppTheme();const styles=useMemo(()=>createStyles(colors),[colors]);
  const [size,setSize]=useState({width:1,height:1});
  return <View onLayout={(event:LayoutChangeEvent)=>setSize(event.nativeEvent.layout)} style={styles.pitch}>
    <View style={styles.halfway}/><View style={styles.circle}/><View style={styles.topBox}/><View style={styles.bottomBox}/><View style={styles.topGoal}/><View style={styles.bottomGoal}/>
    {!players.length?<Text style={styles.empty}>{emptyText}</Text>:null}
    {players.map((player)=><DraggablePlayer editable={editable} key={player.id} onMove={onMove} player={player} size={size} styles={styles}/>) }
  </View>;
}

function DraggablePlayer({player,size,editable,onMove,styles}:{player:PitchPlayer;size:{width:number;height:number};editable:boolean;onMove?:Props['onMove'];styles:ReturnType<typeof createStyles>}){
  const start=useRef({x:player.x,y:player.y});
  const playerRef=useRef(player);playerRef.current=player;
  const responder=useMemo(()=>PanResponder.create({onStartShouldSetPanResponder:()=>editable,onMoveShouldSetPanResponder:()=>editable,onPanResponderGrant:()=>{start.current={x:playerRef.current.x,y:playerRef.current.y}},onPanResponderMove:(_,gesture)=>{onMove?.(playerRef.current.id,clamp(start.current.x+gesture.dx/size.width*100),clamp(start.current.y+gesture.dy/size.height*100))}}),[editable,onMove,size.height,size.width]);
  return <View {...responder.panHandlers} accessibilityLabel={`${player.name}${editable?' verschieben':''}`} accessibilityRole={editable?'adjustable':'text'} style={[styles.player,{left:`${player.x}%`,top:`${player.y}%`}]}><Text numberOfLines={1} style={styles.playerName}>{player.name}</Text>{player.label?<Text style={styles.playerLabel}>{player.label}</Text>:null}</View>;
}

const createStyles=(colors:ReturnType<typeof useAppTheme>['colors'])=>StyleSheet.create({
  pitch:{backgroundColor:'#287a4b',borderColor:'#e7f8ec',borderRadius:18,borderWidth:2,height:560,marginTop:16,overflow:'hidden',position:'relative',width:'100%'},
  halfway:{backgroundColor:'#e7f8ec',height:2,left:0,position:'absolute',right:0,top:'50%'},circle:{borderColor:'#e7f8ec',borderRadius:70,borderWidth:2,height:140,left:'50%',marginLeft:-70,marginTop:-70,position:'absolute',top:'50%',width:140},
  topBox:{borderColor:'#e7f8ec',borderTopWidth:0,borderWidth:2,height:92,left:'25%',position:'absolute',top:0,width:'50%'},bottomBox:{borderBottomWidth:0,borderColor:'#e7f8ec',borderWidth:2,bottom:0,height:92,left:'25%',position:'absolute',width:'50%'},topGoal:{borderColor:'#e7f8ec',borderTopWidth:0,borderWidth:2,height:24,left:'40%',position:'absolute',top:0,width:'20%'},bottomGoal:{borderBottomWidth:0,borderColor:'#e7f8ec',borderWidth:2,bottom:0,height:24,left:'40%',position:'absolute',width:'20%'},
  player:{alignItems:'center',backgroundColor:colors.surface,borderColor:colors.blue,borderRadius:10,borderWidth:2,maxWidth:118,minWidth:78,paddingHorizontal:8,paddingVertical:6,position:'absolute',transform:[{translateX:-45},{translateY:-24}]},playerName:{color:colors.ink,fontSize:11,fontWeight:'900',maxWidth:100},playerLabel:{color:colors.blue,fontSize:9,fontWeight:'900',marginTop:2},empty:{alignSelf:'center',backgroundColor:'#173d2a',borderRadius:10,color:'#fff',fontSize:12,fontWeight:'800',marginTop:250,padding:12},
});
