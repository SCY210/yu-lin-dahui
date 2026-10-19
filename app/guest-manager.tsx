'use client';
import {useState} from 'react';
import {defaultGuestLevel,guestLevels} from '../lib/domain/guests';
import {friendKey} from '../lib/domain/guest-friend-key';
import {guestNameKey} from '../lib/domain/guest-names';
import {choice,text,why,fmt} from './ui';
import type {Field,Form} from './form-fields';
import './guest-manager.css';

type Guest={id:string;name:string;guest?:boolean;guestEventId?:string;guestHost?:string;guestHostId?:string;guestLevel?:number;guestGender?:'male'|'female';guestFriendId?:string;guestHidden?:boolean};
type EventView={id:string;title:string;start:number};
type Registration={eventId:string;playerId:string;status:string;sequence:number;bookingSignups?:{bookingId:string;status:string}[]};
type Friend={key:string;latest:Guest;records:Guest[];activities:number;last:number};
type Ctx={data:{players:Guest[];events:EventView[];registrations:Registration[]};busy:boolean;open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:Form['convert'],description?:string)=>void;action:(name:string,payload:Record<string,unknown>,close?:boolean)=>Promise<unknown>};
/** Loose nickname match for spotting likely duplicates: case, spaces and a trailing number ("aq", "AQ", "aq 2"). */
const loose=(name:string)=>guestNameKey(name).replace(/\s+/g,'').replace(/\d+$/,'');
const levelLabel=(level?:number)=>guestLevels.find(([v])=>v===level)?.[1]??'';

/** Recorded friends for the owner and admins (docs/FRIEND_SIGNUP_ENTRY.md): merge duplicates, correct details, take a
 * friend off the friend lists, and cancel a friend signed up twice for one activity. History is never deleted. */
export default function GuestManager({ctx}:{ctx:Ctx}){
 const {data,open,action,busy}=ctx,[selected,setSelected]=useState<string[]>([]);
 const starts=new Map(data.events.map(e=>[e.id,e.start])),titles=new Map(data.events.map(e=>[e.id,e.title]));
 const groups=new Map<string,Guest[]>();
 for(const p of data.players)if(p.guest||p.guestEventId){const k=friendKey(p,p.guestHostId);groups.set(k,[...(groups.get(k)??[]),p])}
 const friends:Friend[]=[...groups].map(([key,records])=>{
  const dated=[...records].sort((a,b)=>(starts.get(a.guestEventId??'')??0)-(starts.get(b.guestEventId??'')??0));
  return {key,records,latest:dated.at(-1)!,activities:new Set(records.map(r=>r.guestEventId).filter(Boolean)).size,last:starts.get(dated.at(-1)!.guestEventId??'')??0};
 }).sort((a,b)=>a.latest.name.localeCompare(b.latest.name,'zh-CN')||b.last-a.last);
 const listed=friends.filter(f=>!f.latest.guestHidden),hidden=friends.filter(f=>f.latest.guestHidden);
 const similar=new Map<string,number>();for(const f of listed)similar.set(loose(f.latest.name),(similar.get(loose(f.latest.name))??0)+1);
 const chosen=listed.filter(f=>selected.includes(f.key));
 const toggle=(key:string)=>setSelected(list=>list.includes(key)?list.filter(k=>k!==key):[...list,key]);
 const merge=()=>{
  const hosts=[...new Map(chosen.filter(f=>f.latest.guestHostId).map(f=>[f.latest.guestHostId!,f.latest.guestHost??'成员'])).entries()];
  open('合并临时来宾','guestFriendMerge',{playerIds:chosen.map(f=>f.latest.id),name:chosen[0].latest.name,hostPlayerId:hosts[0]?.[0]??'',reason:''},
   [text('name','合并后的昵称'),choice('hostPlayerId','以后由谁负责（带来人）',hosts),why],undefined,
   '这几条以后在名单里只算一位朋友，昵称和带来人统一成所选的。历史接龙、比赛和已确认的费用都保留；之后的新活动和还没确认的费用记在所选带来人名下。');
  setSelected([]);
 };
 const edit=(f:Friend)=>open('修改临时来宾','guestFriendEdit',{playerId:f.latest.id,name:f.latest.name,gender:f.latest.guestGender??'',level:String(f.latest.guestLevel??defaultGuestLevel),reason:''},
  [text('name','昵称'),choice('gender','性别（用于分队）',[['male','男'],['female','女']]),choice('level','水平（用于分队，不计积分）',guestLevels.map(([v,l])=>[String(v),l+' · '+v])),why],
  (v:{playerId:string;name:string;gender:string;level:string;reason:string})=>{if(!v.gender)throw new Error('请选择性别');return {...v,level:Number(v.level)}},
  '昵称和性别更新到这位朋友的所有记录；水平从现在起生效，以前的对局保留当时的水平。');
 const hide=(f:Friend,hiddenNow:boolean)=>void action('guestFriendHide',{playerId:f.latest.id,hidden:hiddenNow,reason:''},false).catch(()=>{});
 // The same friend signed up more than once for one activity (before duplicates were refused): keep the first.
 const doubles=[...new Map(data.registrations.filter(r=>r.status!=='cancelled').flatMap(r=>{const p=data.players.find(x=>x.id===r.playerId&&x.guestEventId===r.eventId);return p?[{r,p}]:[]})
  .reduce((m,x)=>{const k=x.r.eventId+'|'+loose(x.p.name);m.set(k,[...(m.get(k)??[]),x]);return m},new Map<string,{r:Registration;p:Guest}[]>())).values()].filter(list=>list.length>1).map(list=>list.sort((a,b)=>a.r.sequence-b.r.sequence));
 const cancelDouble=async(r:Registration)=>{
  const reason='取消同场重复的临时来宾接龙';
  try{if(r.bookingSignups){for(const x of r.bookingSignups.filter(x=>x.status!=='cancelled'))await action('courtCancel',{bookingId:x.bookingId,playerId:r.playerId,reason},false)}
  else await action('cancel',{eventId:r.eventId,playerId:r.playerId,reason},false)}catch{/* The action shows its own error. */}
 };
 const row=(f:Friend)=><div className="guest-friend" key={f.key}>
  <label className="guest-friend-pick"><input type="checkbox" checked={selected.includes(f.key)} disabled={busy||!!f.latest.guestHidden} onChange={()=>toggle(f.key)} aria-label={'选择 '+f.latest.name+' 合并'}/></label>
  <div className="grow"><strong>{f.latest.name}</strong>{(similar.get(loose(f.latest.name))??0)>1&&!f.latest.guestHidden&&<small className="badge warning">可能重复</small>}
   <p>{f.latest.guestHost?f.latest.guestHost+'带来':'带来人未知'} · {f.latest.guestGender==='female'?'女':f.latest.guestGender==='male'?'男':'性别未填'} · {levelLabel(f.latest.guestLevel)||'水平未填'} · {f.activities} 场{f.last?' · 最近 '+fmt(f.last,{month:'numeric',day:'numeric'}):''}</p></div>
  <div className="actions compact">{!f.latest.guestHidden&&<button type="button" className="ghost" disabled={busy} onClick={()=>edit(f)}>修改</button>}<button type="button" className="ghost" disabled={busy} onClick={()=>hide(f,!f.latest.guestHidden)}>{f.latest.guestHidden?'恢复到名单':'移出名单'}</button></div>
 </div>;
 return <section className="card guest-manager">
  <p className="hint">“我的朋友 / 全部临时来宾”里的名单。勾选几条重复的朋友可以合并；移出名单只是不再出现在名单里，历史接龙、比赛和费用都保留。</p>
  {chosen.length>1&&<div className="guest-merge-bar" role="status"><span>已选 {chosen.length} 位</span><button type="button" className="primary" disabled={busy} onClick={merge}>合并所选</button><button type="button" className="ghost" onClick={()=>setSelected([])}>取消选择</button></div>}
  <h3>名单里的临时来宾 · {listed.length} 位</h3>
  {listed.map(row)}{!listed.length&&<p className="empty">还没有记录的临时来宾</p>}
  {doubles.length>0&&<details className="guest-doubles" open><summary>同一场活动里重复的接龙 · {doubles.length} 处</summary>{doubles.map(list=><div className="guest-double" key={list[0].r.eventId+list[0].p.id}>
   <strong>{titles.get(list[0].r.eventId)??'活动'} · {fmt(starts.get(list[0].r.eventId)??0,{month:'numeric',day:'numeric'})} · {list[0].p.name}</strong>
   {list.map((x,i)=><div className="guest-friend" key={x.p.id}><div className="grow"><p>第 {x.r.sequence} 位接龙 · {x.p.guestHost?x.p.guestHost+'带来':'带来人未知'}{i===0?' · 保留':''}</p></div>{i>0&&<div className="actions compact"><button type="button" className="ghost danger" disabled={busy} onClick={()=>void cancelDouble(x.r)}>取消这条接龙</button></div>}</div>)}
  </div>)}</details>}
  {hidden.length>0&&<details className="guest-hidden"><summary>已移出名单 · {hidden.length} 位</summary>{hidden.map(row)}</details>}
 </section>;
}
