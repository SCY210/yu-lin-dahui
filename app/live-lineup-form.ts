import {choice,type Field} from './form-fields';
import {teamSize} from '../lib/domain/match-format';
import {liveLineupCandidates} from '../lib/domain/live-lineup';
import type {State,Event,Match} from '../lib/domain/types';
type Context={data:State;name:(id:string)=>string;open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],transform:(values:Record<string,unknown>)=>Record<string,unknown>,description:string)=>void};
export function openLiveLineup(e:Event,m:Match,ctx:Context,now:number){
 const size=teamSize(e),options=liveLineupCandidates(ctx.data,e,m,now).map(id=>[id,ctx.name(id)]);
 const fields:Field[]=[],values:Record<string,unknown>={matchId:m.id,expectedA:[...m.a],expectedB:[...m.b]};
 for(const side of ['a','b'] as const)for(let i=0;i<size;i++){const key=side+i;values[key]=m[side][i];fields.push(choice(key,(side==='a'?'甲队':'乙队')+(size===2?' · 球友 '+(i+1):''),options))}
 ctx.open('调整上场人员','liveLineup',values,fields,v=>({matchId:v.matchId,expectedA:v.expectedA,expectedB:v.expectedB,a:Array.from({length:size},(_,i)=>v['a'+i]),b:Array.from({length:size},(_,i)=>v['b'+i])}),
  '仅调整本局上场人员和搭档，下一局仍自动轮换。轮休中的球友请先点“休息好了”。');
}
