'use client';
import {useState} from 'react';
import {Link2,Search} from 'lucide-react';
import {bondTierIndex,type BondPair,type BondRow} from '../lib/domain/bond-tiers';
import {BondStage} from './bond-card';
import {Avatar} from './avatar';
import './home-bonds.css';

type Player={id:string;name:string;enabled?:boolean;guest?:boolean;guestEventId?:string};
const count=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
const collator=new Intl.Collator('zh-Hans-CN-u-co-pinyin');
const preview=8;

/** 道缘榜 on the home page: the viewer's 道缘 with every member, strongest first; the owner and administrators can also
 * list the 道缘 between every pair of members (docs/BONDS.md). */
export default function HomeBonds({rows,pairs,players,meId,onProfile}:{rows:BondRow[];pairs?:BondPair[];players:Player[];meId:string;onProfile:(id:string)=>void}){
 const [tab,setTab]=useState<'mine'|'all'>('mine'),[expanded,setExpanded]=useState(false),[query,setQuery]=useState('');
 const members=players.filter(p=>p.enabled!==false&&!p.guest&&!p.guestEventId);
 const byId=new Map(players.map(p=>[p.id,p])),name=(id:string)=>byId.get(id)?.name??'未知成员';
 const scores=new Map(rows.map(r=>[r.playerId,r]));
 const mine=members.filter(p=>p.id!==meId).map(p=>scores.get(p.id)??{playerId:p.id,score:0,games:0,wins:0,giftsSent:0,giftsReceived:0})
  .sort((x,y)=>y.score-x.score||collator.compare(name(x.playerId),name(y.playerId)));
 const needle=query.trim().toLowerCase();
 const all=(pairs??[]).filter(p=>!needle||name(p.a).toLowerCase().includes(needle)||name(p.b).toLowerCase().includes(needle));
 const rank=new Map((pairs??[]).map((p,i)=>[p,i+1]));
 const list=tab==='all'?all:mine,shown=expanded||needle?list:list.slice(0,preview);
 if(!mine.length&&!pairs?.length)return null;
 const switchTab=(next:'mine'|'all')=>{setTab(next);setExpanded(false);setQuery('')};
 return <section className="card home-bonds" aria-labelledby="home-bonds-title">
  <div className="home-bonds-head"><h2 id="home-bonds-title"><Link2 size={19} aria-hidden="true"/>道缘榜</h2>
   {pairs&&<div className="home-bonds-tabs" role="tablist" aria-label="道缘范围">
    <button type="button" role="tab" aria-selected={tab==='mine'} onClick={()=>switchTab('mine')}>我的道缘</button>
    <button type="button" role="tab" aria-selected={tab==='all'} onClick={()=>switchTab('all')}>全群道缘</button>
   </div>}
  </div>
  <p className="hint">{tab==='all'?'群内所有球友两两之间的道缘，缘值从高到低。仅群主和管理员可见。':'你和每位球友的道缘，缘值从高到低。一起搭档打球、互赠礼物都会增加缘值。'}</p>
  {tab==='all'&&pairs!.length>preview&&<label className="home-bonds-search"><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="按球友名字筛选" aria-label="按球友名字筛选道缘"/></label>}
  <ol className="home-bonds-list">{tab==='all'?(shown as BondPair[]).map(p=><li key={p.a+'|'+p.b}>
   <span className="home-bonds-rank">{rank.get(p)}</span>
   <span className="home-bonds-who"><button type="button" onClick={()=>onProfile(p.a)}>{name(p.a)}</button><span aria-hidden="true">·</span><button type="button" onClick={()=>onProfile(p.b)}>{name(p.b)}</button><small>搭档 {count(p.games)} 局{p.gifts?' · 礼物 '+count(p.gifts)+' 羽币':''}</small></span>
   <span className="home-bonds-score"><BondStage index={bondTierIndex(p.score)}/><small>{count(p.score)}</small></span>
  </li>):(shown as BondRow[]).map((r,i)=><li key={r.playerId}>
   <span className="home-bonds-rank">{i+1}</span>
   <button type="button" className="home-bonds-player" onClick={()=>onProfile(r.playerId)}><Avatar p={byId.get(r.playerId)}/><span className="home-bonds-who"><strong>{name(r.playerId)}</strong><small>{r.score?'搭档 '+count(r.games)+' 局'+(r.giftsSent+r.giftsReceived?' · 礼物 '+count(r.giftsSent+r.giftsReceived)+' 羽币':''):'还没有一起搭档'}</small></span></button>
   <span className="home-bonds-score"><BondStage index={bondTierIndex(r.score)}/><small>{count(r.score)}</small></span>
  </li>)}</ol>
  {tab==='all'&&!all.length&&<p className="empty">{needle?'没有找到相关的道缘。':'还没有球友之间结下道缘。'}</p>}
  {!needle&&list.length>preview&&<button type="button" className="ghost home-bonds-more" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'收起':'查看全部 '+list.length+(tab==='all'?' 对':' 位')}</button>}
 </section>;
}
