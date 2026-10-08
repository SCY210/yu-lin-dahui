'use client';
import {Plus} from 'lucide-react';
import {month} from '../lib/domain/types';
import {choice,fmt,type Field} from './form-fields';
import Disclosure from './disclosure';

export default function OwnerPoints({data,open,busy}:any){
 if(!data.me.isOwner)return null;
 const players=data.players.filter((p:any)=>p.enabled);
 const name=(id:string)=>data.players.find((p:any)=>p.id===id)?.name??'已移除球友';
 const fields:Field[]=[choice('playerId','加分球友',players.map((p:any)=>[p.id,p.name])),{key:'period',label:'计入月份',type:'month'},{key:'points',label:'增加积分（1–1000）',type:'number',min:1,max:1000,step:1},{key:'reason',label:'加分原因'}];
 return <Disclosure label="手动加积分"><section className="card">
  <div className="section-title"><h2>群主加分</h2><button type="button" className="primary" disabled={busy||!players.length} onClick={()=>open('给球友加积分','grantPoints',{playerId:'',period:month(Date.now()),points:10,reason:''},fields,undefined,'增加榜单积分，保存后立即生效。请确认球友、月份和分数；胜场、修为与实力分不变。')}><Plus size={18}/>加积分</button></div>
  <p className="hint">只允许群主操作。积分计入所选月份，并累加到对应季度、年度榜；每次加分都保留原因。</p>
  <div aria-label="手动加分记录">{[...(data.pointGrants??[])].sort((a:any,b:any)=>b.at-a.at||b.id.localeCompare(a.id)).map((g:any)=><div className="rank-line" key={g.id}><div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{name(g.playerId)}</strong><small>{g.period.replace('-','年')}月 · {fmt(g.at)}</small><p>{g.reason}</p></div><strong style={{whiteSpace:'nowrap'}}>+{g.points}<small>积分</small></strong></div>)}{!data.pointGrants?.length&&<p className="muted">还没有手动加分记录。</p>}</div>
 </section></Disclosure>;
}
