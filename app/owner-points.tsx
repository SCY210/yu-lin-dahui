'use client';
import {SlidersHorizontal} from 'lucide-react';
import {month} from '../lib/domain/types';
import {choice,fmt,type Field} from './form-fields';
import Disclosure from './disclosure';

export default function OwnerPoints({data,open,busy}:any){
 if(!data.me.isOwner)return null;
 const players=data.players.filter((p:any)=>p.enabled);
 const name=(id:string)=>data.players.find((p:any)=>p.id===id)?.name??'已移除球友';
 const fields:Field[]=[choice('playerId','球友',players.map((p:any)=>[p.id,p.name])),choice('operation','操作',[['add','加积分'],['subtract','扣积分']]),{key:'period',label:'计入月份',type:'month'},{key:'points',label:'调整分数（1–1000）',type:'number',min:1,max:1000,step:1},{key:'reason',label:'调整原因'}];
 return <Disclosure label="手动调整积分"><section className="card">
  <div className="section-title"><h2>积分调整</h2><button type="button" className="primary" disabled={busy||!players.length} onClick={()=>open('调整球友积分','grantPoints',{playerId:'',operation:'add',period:month(Date.now()),points:10,reason:''},fields,(values:{operation:string;playerId:string;period:string;points:number;reason:string})=>{const {operation,...payload}=values;return {...payload,points:operation==='subtract'?-payload.points:payload.points}},'可以加分或扣分，扣分后允许为负数。请确认球友、月份和分数；胜场、段位分与境界不变。')}><SlidersHorizontal size={18}/>调整积分</button></div>
  <p className="hint">只允许群主操作。积分计入所选月份，并累加到双打季度、年度榜；系统自动记录操作者、时间和分数变化，无需填写备注。</p>
  <div aria-label="手动积分调整记录">{[...(data.pointGrants??[])].sort((a:any,b:any)=>b.at-a.at||b.id.localeCompare(a.id)).map((g:any)=><div className="rank-line" key={g.id}><div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{name(g.playerId)}</strong><small>{g.period.replace('-','年')}月 · {fmt(g.at)}</small><p>{g.reason}</p></div><strong style={{whiteSpace:'nowrap'}}>{g.points>0?'+':''}{g.points}<small>积分</small></strong></div>)}{!data.pointGrants?.length&&<p className="muted">还没有手动积分调整记录。</p>}</div>
 </section></Disclosure>;
}
