'use client';
import {useState} from 'react';
import {Check,Plus,Search,Trash2,X} from 'lucide-react';
import type {PairingCondition,PairingDefault,PairingOdds} from '../lib/domain/pairing-odds';
import {Avatar} from './avatar';
import './pairing-odds-panel.css';

type Player={id:string;name:string;enabled?:boolean;guest?:boolean;guestEventId?:string;avatarId?:string};
type EventRow={id:string;title:string;start:number;end:number;status:string;matchFormat?:string;deletedAt?:number};
type Data={events:EventRow[];players:Player[];registrations:{eventId:string;playerId:string;status:string}[];settings:{pairingOdds?:PairingOdds[]}};
type Ctx={data:Data;busy?:boolean;action:(name:string,payload:Record<string,unknown>,close?:boolean)=>Promise<unknown>};
type Condition={pair:string[];members:string[];one:number;two:number};
const collator=new Intl.Collator('zh-Hans-CN-u-co-pinyin');
const when=new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});

/** 临时排场概率 (lib/domain/pairing-odds.ts): the owner and administrators only. */
export default function PairingOddsPanel({ctx}:{ctx:Ctx}){
 const [now]=useState(Date.now),saved=ctx.data.settings.pairingOdds??[];
 const events=ctx.data.events.filter(e=>e.deletedAt===undefined&&e.end>now&&!['ended','cancelled'].includes(e.status)&&!['singles','practice'].includes(e.matchFormat??'')).sort((a,b)=>a.start-b.start);
 const [chosen,setChosen]=useState('');
 const e=events.find(x=>x.id===chosen)??events[0];
 if(!e)return <p className="empty">没有未结束的双打活动。</p>;
 const entry=saved.find(o=>o.eventId===e.id);
 return <section className="card pairing-odds">
  <label className="po-event">活动<select value={e.id} onChange={event=>setChosen(event.target.value)}>{events.map(x=><option key={x.id} value={x.id}>{x.title} · {when.format(x.start)}{saved.some(o=>o.eventId===x.id)?' · 已设置':''}</option>)}</select></label>
  <OddsEditor key={e.id+JSON.stringify(entry??null)} ctx={ctx} eventId={e.id} saved={entry}/>
 </section>;
}

function OddsEditor({ctx,eventId,saved}:{ctx:Ctx;eventId:string;saved?:PairingOdds}){
 const [defaults,setDefaults]=useState<PairingDefault[]>(saved?.defaults??[]),[conditions,setConditions]=useState<Condition[]>(saved?.conditions??[]);
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 const signed=new Set(ctx.data.registrations.filter(r=>r.eventId===eventId&&r.status!=='cancelled').map(r=>r.playerId));
 const players=ctx.data.players.filter(p=>p.enabled!==false&&(p.guestEventId?p.guestEventId===eventId:!p.guest))
  .sort((a,b)=>Number(signed.has(b.id))-Number(signed.has(a.id))||collator.compare(a.name,b.name));
 const changed=JSON.stringify({defaults,conditions})!==JSON.stringify({defaults:saved?.defaults??[],conditions:saved?.conditions??[]});
 const valid=defaults.every(d=>d.players.length&&d.targets.length)&&conditions.every(c=>c.pair.length===2&&c.members.length);
 const setDefault=(i:number,next:Partial<PairingDefault>)=>setDefaults(list=>list.map((d,j)=>j===i?{...d,...next}:d));
 const setCondition=(i:number,next:Partial<Condition>)=>setConditions(list=>list.map((c,j)=>j===i?{...c,...next}:c));
 async function save(){
  setSaving(true);setError('');
  try{await ctx.action('pairingOdds',{eventId,defaults,conditions:conditions.map(c=>({...c,pair:c.pair as PairingCondition['pair']}))},false)}
  catch(e){setError((e as Error).message)}finally{setSaving(false)}
 }
 return <>
  <div className="po-block">
   <h4>默认组队</h4>
   {defaults.map((d,i)=><div className="po-rule" key={i}>
    <PlayerPicker label="主角" options={players} signed={signed} value={d.players} onChange={v=>setDefault(i,{players:v})}/>
    <PlayerPicker label="对象" options={players} signed={signed} value={d.targets} onChange={v=>setDefault(i,{targets:v})}/>
    <Percent label="队友概率" value={d.percent} onChange={v=>setDefault(i,{percent:v})}/>
    <button type="button" className="ghost po-remove" aria-label="删除这条默认组队" onClick={()=>setDefaults(list=>list.filter((_,j)=>j!==i))}><Trash2 size={16} aria-hidden="true"/></button>
   </div>)}
   <button type="button" className="secondary po-new" disabled={defaults.length>=30} onClick={()=>setDefaults(list=>[...list,{players:[],targets:[],percent:50}])}><Plus size={16} aria-hidden="true"/>添加默认组队</button>
  </div>
  <div className="po-block">
   <h4>条件组队</h4>
   {conditions.map((c,i)=><div className="po-rule" key={i}>
    <PlayerPicker label="选定两人" options={players} signed={signed} value={c.pair} max={2} hidden={c.members} onChange={v=>setCondition(i,{pair:v})}/>
    <PlayerPicker label="条件成员" options={players} signed={signed} value={c.members} hidden={c.pair} onChange={v=>setCondition(i,{members:v})}/>
    <Percent label="出现一位" value={c.one} onChange={v=>setCondition(i,{one:v})}/>
    <Percent label="出现两位" value={c.two} onChange={v=>setCondition(i,{two:v})}/>
    <button type="button" className="ghost po-remove" aria-label="删除这条条件组队" onClick={()=>setConditions(list=>list.filter((_,j)=>j!==i))}><Trash2 size={16} aria-hidden="true"/></button>
   </div>)}
   <button type="button" className="secondary po-new" disabled={conditions.length>=30} onClick={()=>setConditions(list=>[...list,{pair:[],members:[],one:50,two:50}])}><Plus size={16} aria-hidden="true"/>添加条件组队</button>
  </div>
  {error&&<p className="error" role="alert">{error}</p>}
  <button type="button" className="primary po-save" disabled={!changed||!valid||saving||!!ctx.busy} onClick={()=>void save()}>{saving?'正在保存…':'保存'}</button>
 </>;
}

function Percent({label,value,onChange}:{label:string;value:number;onChange:(value:number)=>void}){
 return <label className="po-percent"><span>{label}</span><input type="range" min={0} max={100} step={5} value={value} onChange={e=>onChange(Number(e.target.value))}/><output>{value}%</output></label>;
}

function PlayerPicker({label,options,signed,value,onChange,max,hidden=[]}:{label:string;options:Player[];signed:Set<string>;value:string[];onChange:(value:string[])=>void;max?:number;hidden?:string[]}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState('');
 const byId=new Map(options.map(p=>[p.id,p])),needle=query.trim().toLowerCase();
 const shown=options.filter(p=>!hidden.includes(p.id)&&(!needle||p.name.toLowerCase().includes(needle)));
 const full=max!==undefined&&value.length>=max;
 const toggle=(id:string)=>{
  const next=value.includes(id)?value.filter(x=>x!==id):full?value:[...value,id];
  onChange(next);if(max!==undefined&&next.length>=max)setOpen(false);
 };
 return <div className="po-picker">
  <span className="po-label">{label}</span>
  <div className="po-chips">
   {value.map(id=><span className="po-chip" key={id}><Avatar p={byId.get(id)}/><span>{byId.get(id)?.name??'未知成员'}</span><button type="button" aria-label={'移除'+(byId.get(id)?.name??'')} onClick={()=>onChange(value.filter(x=>x!==id))}><X size={14} aria-hidden="true"/></button></span>)}
   {!full&&<button type="button" className="po-add" aria-expanded={open} onClick={()=>setOpen(!open)}><Plus size={15} aria-hidden="true"/>选择</button>}
  </div>
  {open&&<div className="po-menu">
   <label className="po-search"><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索名字" aria-label={'搜索'+label}/></label>
   <ul>{shown.map(p=><li key={p.id}><button type="button" aria-pressed={value.includes(p.id)} disabled={full&&!value.includes(p.id)} onClick={()=>toggle(p.id)}><Avatar p={p}/><span className="po-name">{p.name}</span>{signed.has(p.id)&&<small>已报名</small>}{value.includes(p.id)&&<Check size={16} aria-hidden="true"/>}</button></li>)}</ul>
   {!shown.length&&<p className="empty">没有找到这位球友。</p>}
   <button type="button" className="ghost po-done" onClick={()=>{setOpen(false);setQuery('')}}>完成</button>
  </div>}
 </div>;
}
