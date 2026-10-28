'use client';
import {useMemo,useState,type ReactNode} from 'react';
import {LayoutGrid,List,Search,X} from 'lucide-react';
import {bondTierIndex,type BondRow} from '../lib/domain/bond-tiers';
import {BondStage} from './bond-card';
import RealmBadge,{PlacementBadge} from './realm-badge';
import {Avatar} from './avatar';
import './player-directory.css';

type Player={id:string;name:string;profile?:{motto?:string;racket?:string}};
type Stats={games?:number;provisional?:boolean;tier?:string;realmScore?:{score?:number;placement?:boolean;ratedGames?:number;placementGames?:number}};
type Sort='realm'|'bond'|'name';
type View='list'|'cards';
const viewKey='yl-player-directory-view';
const collator=new Intl.Collator('zh-Hans-CN-u-co-pinyin');
const readView=():View=>{try{return localStorage.getItem(viewKey)==='cards'?'cards':'list'}catch{return 'list'}};

/** 球友圈: search, sort and a compact list, so a member is found without swiping through every card (docs/BONDS.md). */
export default function PlayerDirectory({roster,stats,bonds,meId,onProfile,cards}:{roster:Player[];stats:(id:string)=>Stats|undefined;bonds:BondRow[];meId:string;onProfile:(id:string)=>void;cards:(players:Player[])=>ReactNode}){
 const [query,setQuery]=useState(''),[sort,setSort]=useState<Sort>('realm'),[view,setView]=useState<View>(readView);
 const choose=(next:View)=>{setView(next);try{localStorage.setItem(viewKey,next)}catch{}};
 const bond=useMemo(()=>new Map(bonds.map(r=>[r.playerId,r])),[bonds]);
 const realm=(id:string)=>stats(id)?.realmScore?.score??0;
 const needle=query.trim().toLowerCase();
 const shown=roster.filter(p=>!needle||[p.name,p.profile?.motto,p.profile?.racket].some(v=>v?.toLowerCase().includes(needle)))
  .sort((x,y)=>(sort==='realm'?realm(y.id)-realm(x.id):sort==='bond'?(bond.get(y.id)?.score??-1)-(bond.get(x.id)?.score??-1):0)||collator.compare(x.name,y.name));
 return <div className="pd">
  <div className="pd-tools">
   <label className="pd-search"><Search size={17} aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索名字、口号或战拍" aria-label="搜索球友"/>{query&&<button type="button" aria-label="清空搜索" onClick={()=>setQuery('')}><X size={16} aria-hidden="true"/></button>}</label>
   <div className="pd-row">
    <select value={sort} onChange={e=>setSort(e.target.value as Sort)} aria-label="排序">
     <option value="realm">按修为</option><option value="bond">按我的道缘</option><option value="name">按名字</option>
    </select>
    <div className="pd-views" role="group" aria-label="显示方式">
     <button type="button" aria-pressed={view==='list'} onClick={()=>choose('list')}><List size={16} aria-hidden="true"/>名录</button>
     <button type="button" aria-pressed={view==='cards'} onClick={()=>choose('cards')}><LayoutGrid size={16} aria-hidden="true"/>名帖</button>
    </div>
   </div>
  </div>
  {needle&&<p className="pd-found" aria-live="polite">找到 {shown.length} 位球友</p>}
  {!shown.length?<p className="empty">{roster.length?'没有找到这位球友。':'还没有可查看的球友。'}</p>:view==='cards'?<div key={needle+sort}>{cards(shown)}</div>:
  <ul className="pd-list">{shown.map(p=>{const row=stats(p.id),score=row?.realmScore,b=bond.get(p.id),self=p.id===meId;return <li key={p.id}>
   <button type="button" className="pd-item" onClick={()=>onProfile(p.id)} aria-label={'查看'+p.name+'的档案'}>
    <Avatar p={p}/>
    <span className="pd-main">
     <span className="pd-name"><strong>{p.name}</strong>{self&&<small className="pd-self">我</small>}{row?.provisional||score?.placement?<PlacementBadge className="pd-realm" games={score?.ratedGames} total={score?.placementGames}/>:row?.tier?<RealmBadge className="pd-realm" realm={row.tier}/>:null}</span>
     <span className="pd-sub">{p.profile?.motto?.trim()||p.profile?.racket||'修为 '+(score?.score??1000)+' · '+(row?.games??0)+' 局'}</span>
    </span>
    {!self&&<span className="pd-bond">{b?<><BondStage index={bondTierIndex(b.score)}/><small>{new Intl.NumberFormat('zh-CN').format(b.score)} 缘值</small></>:<small>尚无道缘</small>}</span>}
   </button>
  </li>})}</ul>}
 </div>;
}
