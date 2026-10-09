'use client';
import {SlidersHorizontal} from 'lucide-react';
import {month} from '../lib/domain/types';
import {choice,fmt,type Field} from './form-fields';
import Disclosure from './disclosure';

type PlayerOption={id:string;name:string};
type GrantRow={id:string;playerId:string;period:string;points:number;rating?:number;reason:string;at:number};

export default function OwnerPoints({data,open,busy}:any){
 if(!data.me.isOwner)return null;
 const players=data.players.filter((p:any)=>p.enabled);
 const name=(id:string)=>data.players.find((p:any)=>p.id===id)?.name??'已移除球友';
 const fields:Field[]=[choice('playerId','球友',players.map((p:PlayerOption)=>[p.id,p.name])),choice('operation','操作',[['add','加积分'],['subtract','扣积分']]),{key:'period',label:'计入月份',type:'month'},{key:'points',label:'调整积分（0–1000，可填 0）',type:'number',min:0,max:1000,step:1},{key:'rating',label:'调整修为（−300 到 300，可填 0）',type:'number',min:-300,max:300,step:1},{key:'reason',label:'调整原因'}];
 return <Disclosure label="手动调整积分"><section className="card">
  <div className="section-title"><h2>积分调整</h2><button type="button" className="primary" disabled={busy||!players.length} onClick={()=>open('调整球友积分','grantPoints',{playerId:'',operation:'add',period:month(Date.now()),points:10,rating:0,reason:''},fields,(values:{operation:string;playerId:string;period:string;points:number;rating:number;reason:string})=>{const {operation,...payload}=values,points=Number(payload.points)||0,rating=Number(payload.rating)||0;return {...payload,points:operation==='subtract'?-points:points,rating}},'积分可以加或扣，扣分后允许为负数，只影响双打季度、年度榜。修为调整直接填正数或负数，保存后立即改变修为、境界和双打分组实力，不计入比赛局数和胜场。两项不能都为 0。')}><SlidersHorizontal size={18}/>调整积分</button></div>
  <p className="hint">只允许群主操作。积分计入所选月份，并累加到双打季度、年度榜；修为调整从保存时起计入修为与境界。系统自动记录操作者、时间和分数变化，无需填写备注。</p>
  <div aria-label="手动积分调整记录">{[...(data.pointGrants??[])].sort((a:GrantRow,b:GrantRow)=>b.at-a.at||b.id.localeCompare(a.id)).map((g:GrantRow)=><div className="rank-line" key={g.id}><div style={{minWidth:0,overflowWrap:'anywhere'}}><strong>{name(g.playerId)}</strong><small>{g.period.replace('-','年')}月 · {fmt(g.at)}</small><p>{g.reason}</p></div><strong style={{whiteSpace:'nowrap'}}>{g.points>0?'+':''}{g.points}<small>积分</small>{g.rating?<small>{' · '}{g.rating>0?'+':''}{g.rating} 修为</small>:null}</strong></div>)}{!data.pointGrants?.length&&<p className="muted">还没有手动积分调整记录。</p>}</div>
 </section></Disclosure>;
}
