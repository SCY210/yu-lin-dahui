import {choice,type Field} from './form-fields';
import {teamSize} from '../lib/domain/match-format';
import {liveLineupCandidates} from '../lib/domain/live-lineup';
import type {State,Event,Match} from '../lib/domain/types';
export type LineupContext={data:State;name:(id:string)=>string;open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],transform:(values:Record<string,unknown>)=>Record<string,unknown>,description:string)=>void};
export function openLiveLineup(e:Event,m:Match,ctx:LineupContext,now:number){
 const size=teamSize(e),options=liveLineupCandidates(ctx.data,e,m,now).map(id=>[id,ctx.name(id)]);
 const fields:Field[]=[],values:Record<string,unknown>={matchId:m.id,expectedA:[...m.a],expectedB:[...m.b]};
 for(const side of ['a','b'] as const)for(let i=0;i<size;i++){const key=side+i;values[key]=m[side][i];fields.push(choice(key,(side==='a'?'甲队':'乙队')+(size===2?' · 球友 '+(i+1):''),options))}
 ctx.open('调整上场人员','liveLineup',values,fields,v=>({matchId:v.matchId,expectedA:v.expectedA,expectedB:v.expectedB,a:Array.from({length:size},(_,i)=>v['a'+i]),b:Array.from({length:size},(_,i)=>v['b'+i])}),
  '仅调整本局上场人员和搭档，下一局仍自动轮换。轮休中的球友请先点“休息好了”。');
}

export function openLiveSubstitution(e:Event,m:Match,incomingId:string,ctx:LineupContext){
 const values={matchId:m.id,incomingId,outgoingId:m.a[0],expectedA:[...m.a],expectedB:[...m.b]};
 ctx.open('安排 '+ctx.name(incomingId)+' 上场','liveLineup',values,[choice('outgoingId','换下谁',[...m.a,...m.b].map(id=>[id,ctx.name(id)]))],v=>({
  matchId:v.matchId,expectedA:v.expectedA,expectedB:v.expectedB,
  a:(v.expectedA as string[]).map(id=>id===v.outgoingId?v.incomingId:id),b:(v.expectedB as string[]).map(id=>id===v.outgoingId?v.incomingId:id),
 }),'选择要换下的球友；保存后只调整本局，下一局仍自动轮换。');
}
