'use client';
import {TrendingUp} from 'lucide-react';
import {month} from '../lib/domain/types';
import {choice,fmt,type Field,type Form} from './form-fields';
import Disclosure from './disclosure';
import './owner-rating.css';

type Player={id:string;name:string;enabled:boolean;guest?:boolean;guestEventId?:string;rating?:number|null};
type Grant={id:string;playerId:string;rating?:number;at:number};
type Props={data:{me:{isOwner?:boolean};players:Player[];pointGrants?:Grant[];social?:{stats:{playerId:string;realmScore?:{score:number}}[]}};busy:boolean;open:(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert?:Form['convert'],description?:string)=>void};
export default function OwnerRating({data,open,busy}:Props){
 if(!data.me.isOwner)return null;
 const players=data.players.filter(p=>p.enabled&&!p.guest&&!p.guestEventId);
 const grants=(data.pointGrants??[]).filter(g=>!!g.rating).slice().sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id));
 const fields:Field[]=[choice('playerId','要提升的球友',players.map(p=>[p.id,p.name+' · 当前修为 '+Math.round(data.social?.stats.find(row=>row.playerId===p.id)?.realmScore?.score??p.rating??1000)])),{key:'rating',label:'提升修为（1–300）',type:'number',min:1,max:300,step:1}];
 const raise=()=>open('手动提升修为','grantPoints',{playerId:'',rating:100,points:0,period:month(Date.now()),reason:'群主手动提升修为'},fields,
  values=>({playerId:values.playerId,period:month(Date.now()),points:0,rating:Number(values.rating),reason:'群主手动提升修为'}),
  '选择球友和提升数值，保存后立即增加修为。积分、比赛局数和胜场保持不变；已定级球友的境界随修为更新，定级中的球友仍保留定级状态。');
 return <section className="card owner-rating">
  <div className="section-title"><h2>手动提升修为</h2><button type="button" className="primary" disabled={busy||!players.length} onClick={raise}><TrendingUp size={18}/>提升修为</button></div>
  <p className="hint">群主专用，每次提升 1–300 修为。保存后立即生效，不增加积分或比赛场次。</p>
  <Disclosure label={'修为调整记录 · '+grants.length}>
   {grants.slice(0,20).map(g=><div className="rank-line" key={g.id}><div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{data.players.find(p=>p.id===g.playerId)?.name??'已移除球友'}</strong><small>{fmt(g.at)}</small></div><strong>{g.rating!>0?'+':''}{g.rating}<small>修为</small></strong></div>)}
   {!grants.length&&<p className="muted">还没有手动修为调整记录。</p>}
   {grants.length>20&&<p className="hint">显示最近 20 条调整；完整记录仍保存在操作日志中。</p>}
  </Disclosure>
 </section>;
}
