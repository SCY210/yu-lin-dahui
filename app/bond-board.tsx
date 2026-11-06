'use client';
import {useState,type ReactNode} from 'react';
import {ChevronLeft,Gift,Link2,Search} from 'lucide-react';
import {bondTierIndex,type BondPair,type BondRow,type GiftRecord} from '../lib/domain/bond-tiers';
import {BondStage} from './bond-card';
import {Avatar} from './avatar';
import './bond-board.css';

type Player={id:string;name:string;enabled?:boolean;guest?:boolean;guestEventId?:string;avatarId?:string};
type Row={playerId:string;score:number;games:number;gifts:number};
const count=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
const collator=new Intl.Collator('zh-Hans-CN-u-co-pinyin');
const when=new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const preview=3;

/** 道缘榜 on the 我的 page: the viewer's 道缘 with every member, strongest first. The owner and administrators can
 * also pick any member and see that member's 道缘 with everyone, and read every gift between members (docs/BONDS.md). */
export default function BondBoard({rows,pairs,gifts,players,meId,onProfile}:{rows:BondRow[];pairs?:BondPair[];gifts?:GiftRecord[];players:Player[];meId:string;onProfile:(id:string)=>void}){
 const [tab,setTab]=useState<'mine'|'all'|'gifts'>('mine'),[focus,setFocus]=useState(''),[query,setQuery]=useState('');
 const members=players.filter(p=>p.enabled!==false&&!p.guest&&!p.guestEventId);
 const byId=new Map(players.map(p=>[p.id,p])),name=(id:string)=>byId.get(id)?.name??'未知道友';
 const order=(x:Row,y:Row)=>y.score-x.score||collator.compare(name(x.playerId),name(y.playerId));
 const fill=(id:string,known:Map<string,Row>)=>members.filter(p=>p.id!==id).map(p=>known.get(p.id)??{playerId:p.id,score:0,games:0,gifts:0}).sort(order);
 const mine=fill(meId,new Map(rows.map(r=>[r.playerId,{playerId:r.playerId,score:r.score,games:r.games,gifts:r.giftsSent+r.giftsReceived}])));
 if(!mine.length&&!pairs?.length)return null;
 // Every member's 道缘 with each other member, from the list of pairs.
 const bonds=new Map<string,Map<string,Row>>();
 for(const p of pairs??[])for(const [x,y] of [[p.a,p.b],[p.b,p.a]]){if(!bonds.has(x))bonds.set(x,new Map());bonds.get(x)!.set(y,{playerId:y,score:p.score,games:p.games,gifts:p.gifts})}
 const strongest=(id:string)=>[...bonds.get(id)?.values()??[]].sort(order)[0];
 const needle=query.trim().toLowerCase();
 const roster=members.filter(p=>!needle||p.name.toLowerCase().includes(needle)).sort((x,y)=>(strongest(y.id)?.score??0)-(strongest(x.id)?.score??0)||collator.compare(x.name,y.name));
 const focused=focus&&byId.get(focus);
 const switchTab=(next:'mine'|'all'|'gifts')=>{setTab(next);setFocus('');setQuery('')};
 return <section className="card bond-board" aria-labelledby="bond-board-title">
  <div className="bond-board-head"><h2 id="bond-board-title"><Link2 size={19} aria-hidden="true"/>道缘榜</h2>
   {pairs&&<div className="bond-board-tabs" role="tablist" aria-label="道缘范围">
    <button type="button" role="tab" aria-selected={tab==='mine'} onClick={()=>switchTab('mine')}>我的道缘</button>
    <button type="button" role="tab" aria-selected={tab==='all'} onClick={()=>switchTab('all')}>全群道缘</button>
    {gifts&&<button type="button" role="tab" aria-selected={tab==='gifts'} onClick={()=>switchTab('gifts')}>送礼记录</button>}
   </div>}
  </div>
  {tab==='mine'?<>
   <p className="hint">你和每位球友的道缘，缘值从高到低。一起搭档打球、互赠礼物都会增加缘值。</p>
   <BondList rows={mine} byId={byId} onProfile={onProfile}/>
  </>:tab==='gifts'?<>
   <p className="hint">球友之间互赠礼物的记录，最新在前。仅宗主和副宗主可见。</p>
   <GiftList gifts={gifts??[]} name={name}/>
  </>:focused?<>
   <button type="button" className="ghost bond-board-back" onClick={()=>setFocus('')}><ChevronLeft size={17} aria-hidden="true"/>全部球友</button>
   <div className="bond-board-focus">
    <Avatar p={focused} size="bond-board-face"/>
    <div><button type="button" onClick={()=>onProfile(focused.id)}>{focused.name}</button><small>{bonds.get(focused.id)?.size??0} 段道缘</small></div>
   </div>
   <BondList key={focused.id} rows={fill(focused.id,bonds.get(focused.id)??new Map())} byId={byId} onProfile={onProfile}/>
  </>:<>
   <p className="hint">点一位球友，查看与群里每个人的道缘。仅宗主和副宗主可见。</p>
   <label className="bond-board-search"><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索球友" aria-label="搜索球友的道缘"/></label>
   <Expandable total={roster.length} unit="位" open={!!needle}>{limit=><ul className="bond-board-members">{roster.slice(0,limit).map(p=>{const top=strongest(p.id);return <li key={p.id}>
    <button type="button" className="bond-board-member" onClick={()=>setFocus(p.id)} aria-label={'查看'+p.name+'的道缘'}>
     <Avatar p={p}/>
     <span className="bond-board-who"><strong>{p.name}</strong><small>{bonds.get(p.id)?.size?bonds.get(p.id)!.size+' 段道缘':'尚无道缘'}</small></span>
     {top&&<span className="bond-board-top"><small>最深</small><Avatar p={byId.get(top.playerId)}/><span><b>{name(top.playerId)}</b><BondStage index={bondTierIndex(top.score)}/></span></span>}
    </button>
   </li>})}</ul>}</Expandable>
   {!roster.length&&<p className="empty">没有找到这位球友。</p>}
  </>}
 </section>;
}

/** The first three, then the rest on request, so My stays short. */
function Expandable({total,unit,open,children}:{total:number;unit:string;open?:boolean;children:(limit:number)=>ReactNode}){
 const [expanded,setExpanded]=useState(false);
 return <>{children(expanded||open?total:preview)}{!open&&total>preview&&<button type="button" className="ghost bond-board-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'收起':'查看全部 '+total+' '+unit}</button>}</>;
}

function BondList({rows,byId,onProfile}:{rows:Row[];byId:Map<string,Player>;onProfile:(id:string)=>void}){
 return <Expandable total={rows.length} unit="位">{limit=><ol className="bond-board-list">{rows.slice(0,limit).map((r,i)=><li key={r.playerId}>
  <span className="bond-board-rank">{i+1}</span>
  <button type="button" className="bond-board-player" onClick={()=>onProfile(r.playerId)}><Avatar p={byId.get(r.playerId)}/><span className="bond-board-who"><strong>{byId.get(r.playerId)?.name??'未知道友'}</strong><small>{r.score?'搭档 '+count(r.games)+' 局'+(r.gifts?' · 礼物 '+count(r.gifts)+' 羽币':''):'还没有一起搭档'}</small></span></button>
  <span className="bond-board-score"><BondStage index={bondTierIndex(r.score)}/><small>{count(r.score)}</small></span>
 </li>)}</ol>}</Expandable>;
}

/** Gift history for the owner and administrators: giver → receiver, what and when, with the note. */
function GiftList({gifts,name}:{gifts:GiftRecord[];name:(id:string)=>string}){
 if(!gifts.length)return <p className="empty">还没有球友互赠礼物。</p>;
 return <Expandable total={gifts.length} unit="条">{limit=><ul className="bond-gift-list">{gifts.slice(0,limit).map(g=><li key={g.id} className={g.cancelled?'cancelled':undefined}>
  <Gift size={16} aria-hidden="true"/>
  <span className="bond-gift-main"><strong>{name(g.from)} → {name(g.to)}</strong><small>{g.item?g.item+' · 价值 ':''}{count(g.value)} 羽币{g.cancelled?' · 已取消':''}</small>{g.message&&<q>{g.message}</q>}</span>
  <time dateTime={new Date(g.at).toISOString()}>{when.format(g.at)}</time>
 </li>)}</ul>}</Expandable>;
}
