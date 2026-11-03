'use client';
import {Flame,Handshake,Medal,Swords,Trophy,TrendingUp,Zap} from 'lucide-react';
import type {ReactNode} from 'react';
import {activityRecap,type RecapGame} from '../lib/domain/activity-recap';
import {mvpWinners} from '../lib/domain/activity-voting';
import type {ClubData} from '../lib/contracts/club';
import type {Event} from '../lib/domain/types';
import './event-recap.css';

/** 战况小结: shown on an ended activity's overview once it has scored games (docs/ACTIVITY_RECAP.md). */
export default function EventRecap({e,data,name,now}:{e:Event;data:ClubData;name:(id:string)=>string;now:number}){
 const recap=activityRecap(data.matches,e.id);
 if(!recap.games)return null;
 const names=(ids:string[])=>ids.map(name).join('、'),score=(g:RecapGame)=>`${names(g.a)} ${g.scoreA}:${g.scoreB} ${names(g.b)}`;
 const mvp=mvpWinners(data,e,now),mine=recap.byPlayer[data.me.playerId];
 const rows:[ReactNode,string,string][]=[];
 if(mvp.length)rows.push([<Trophy key="i" size={17}/>,'MVP',names(mvp)]);
 if(recap.topWinners.length)rows.push([<Medal key="i" size={17}/>,'胜场王',recap.topWinners.map(p=>`${name(p.playerId)} ${p.wins}胜${p.losses}负`).join('、')]);
 if(recap.bestRate)rows.push([<TrendingUp key="i" size={17}/>,'最高胜率',`${name(recap.bestRate.playerId)} ${Math.round(recap.bestRate.wins/recap.bestRate.games*100)}%（${recap.bestRate.wins}/${recap.bestRate.games}）`]);
 if(recap.streak)rows.push([<Flame key="i" size={17}/>,'最长连胜',`${names(recap.streak.playerIds)} ${recap.streak.length} 连胜`]);
 if(recap.pair)rows.push([<Handshake key="i" size={17}/>,'最佳拍档',`${names(recap.pair.playerIds)} ${recap.pair.wins}胜${recap.pair.games-recap.pair.wins}负`]);
 if(recap.closest)rows.push([<Swords key="i" size={17}/>,'最胶着',score(recap.closest)]);
 if(recap.rout)rows.push([<Zap key="i" size={17}/>,'最悬殊',score(recap.rout)]);
 return <section className="card event-recap" aria-labelledby={'recap-'+e.id}>
  <div className="event-recap-head"><h3 id={'recap-'+e.id}>战况小结</h3><span>{recap.games} 局 · {recap.players} 人上场 · 共 {recap.points} 分</span></div>
  <dl>{rows.map(([icon,label,value])=><div key={label}><dt>{icon}{label}</dt><dd>{value}</dd></div>)}</dl>
  {mine&&<p className="event-recap-mine">我的战绩：{mine.games} 局 {mine.wins} 胜 {mine.losses} 负</p>}
 </section>;
}
