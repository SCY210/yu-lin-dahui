'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {SimulationView} from '../lib/admin-simulation';
import {pendingSchedulingIds,schedulingMode} from '../lib/domain/scheduling';
import type {SchedulingContext} from './event-scheduling';
import type {Form} from './form-fields';
import EventScheduling from './event-scheduling';
import {NoShowHold} from './match-no-show';
import {Forms} from './ui';
import Disclosure from './disclosure';
import './admin-simulation.css';
type Danger=Parameters<SchedulingContext['setDanger']>[0];
export default function AdminSimulation({accountId,back}:{accountId:string;back:()=>void}){
 const [attempt,setAttempt]=useState(0);return <SimulationSession key={accountId+':'+attempt} accountId={accountId} back={back} retry={()=>setAttempt(value=>value+1)}/>;
}
function SimulationSession({accountId,back,retry}:{accountId:string;back:()=>void;retry:()=>void}){
 const [view,setView]=useState<SimulationView|null>(null),[form,setForm]=useState<Form|null>(null),[danger,setDanger]=useState<Danger|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const latest=useRef<SimulationView|null>(null),running=useRef(false),lifecycle=useRef<AbortController|null>(null);
 const accept=useCallback((next:SimulationView)=>{if(!latest.current||next.revision>=latest.current.revision){latest.current=next;setView(next)}},[]);
 const read=useCallback(async(signal?:AbortSignal)=>{
  const r=await fetch('/api/simulation',{cache:'no-store',signal});if(!r.ok){if(r.status===401||r.status===403){latest.current=null;setView(null)}throw new Error('暂时无法读取模拟活动，请检查登录权限后重试')}
  const next=await r.json() as SimulationView;if(!signal?.aborted)accept(next);
 },[accept]);
 useEffect(()=>{
  const control=new AbortController();lifecycle.current=control;latest.current=null;
  void fetch('/api/simulation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'initialize',payload:{},requestId:crypto.randomUUID()}),signal:control.signal}).then(async r=>{if(!r.ok)throw new Error('只有群主、管理员和测试员可以进入模拟活动');const next=await r.json() as SimulationView;if(!control.signal.aborted)accept(next)}).catch(e=>{if(!control.signal.aborted)setError(e instanceof Error?e.message:'模拟活动加载失败')});
  const timer=setInterval(()=>{if(!running.current&&!document.hidden)void read(control.signal).catch(e=>{if(!control.signal.aborted)setError(e instanceof Error?e.message:'模拟记录暂时未同步')})},3000);
  return()=>{control.abort();clearInterval(timer)};
 },[accountId,accept,read]);
 const action=async(action:string,payload:Record<string,unknown>)=>{
  if(running.current||!latest.current)throw new Error('模拟记录正在同步，请稍候');running.current=true;setBusy(true);setError('');
  try{
   const r=await fetch('/api/simulation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,payload,revision:typeof payload.expectedRevision==='number'?payload.expectedRevision:latest.current.revision,requestId:crypto.randomUUID()}),signal:lifecycle.current?.signal});
   const result=await r.json() as SimulationView&{error?:string};if(!r.ok){if(r.status===409)await read(lifecycle.current?.signal);if(r.status===401||r.status===403){latest.current=null;setView(null)}throw new Error(result.error??'模拟操作未保存')}
   if(!lifecycle.current?.signal.aborted){accept(result);setForm(null);setDanger(null)}return result;
  }catch(e){if(!lifecycle.current?.signal.aborted)setError(e instanceof Error?e.message:'模拟操作未保存');throw e}finally{running.current=false;if(!lifecycle.current?.signal.aborted)setBusy(false)}
 };
 if(!view)return <section className="card simulation-loading"><button type="button" className="ghost" onClick={back}>返回活动</button><h1>模拟活动</h1><p role="status">{error||'正在读取模拟记录…'}</p>{error&&<button type="button" className="secondary" onClick={retry}>重试加载</button>}</section>;
 const data=view.data,e=data.events[0],ctx:SchedulingContext&{action:typeof action}={data,action,admin:true,busy,name:id=>data.players.find(p=>p.id===id)?.name??id,open:(title,action,values,fields,convert,description)=>setForm({title,action,values,fields,convert,description:description??'仅保存到授权成员专用模拟空间，不修改真实活动。'}),send:(name,payload)=>void action(name,payload).catch(()=>{}),setDanger};
 return <div className="admin-simulation"><button type="button" className="ghost" onClick={back}>返回真实活动</button><section className="card simulation-heading"><span className="badge">授权成员专用 · 模拟数据</span><h1>{e.title}</h1><p>{data.players.length} 位真实球友已加入模拟接龙，使用姓名、头像、性别与修为快照。模拟记录单独保存并在管理员之间同步；仅获授权的测试员和管理员可访问，不进入真实榜单、费用或通知。</p><div className="actions">{!e.pointsSession?.startedAt&&<button type="button" className="primary" disabled={busy} onClick={()=>ctx.open('运行模拟','pointsStart',{eventId:e.id,expectedMode:schedulingMode(data,e),expectedPendingIds:pendingSchedulingIds(data,e.id)},[],undefined,'仅在管理员模拟空间运行当前排场，真实活动按预定时间自动开始。')}>运行模拟</button>}<button type="button" className="secondary" disabled={busy} onClick={()=>void action('preplan',{}).catch(()=>{})}>一键预排90分钟</button><button type="button" className="ghost" disabled={busy} onClick={()=>setForm({title:'重置模拟活动',action:'reset',values:{expectedRevision:view.revision},fields:[],description:'清除模拟测试记录，从当前启用的正式球友中取最多12人，刷新资料并建立两场地活动。真实活动不受影响。'})}>重置模拟活动</button></div><p className="hint">可切换三种排场方式。重置会刷新真实球友资料；不足12人时使用现有正式球友。录分后检查场下球友是否上场。</p></section>
  {error&&<p className="connection-note" role="alert">{error}</p>}
  <Disclosure label={'已接龙的真实球友 · '+data.players.length+'人'}><div className="simulation-roster">{data.registrations.map(r=><span key={r.id}>{data.players.find(p=>p.id===r.playerId)?.name??r.playerId} · 模拟接龙</span>)}</div></Disclosure>
  <NoShowHold e={e} ctx={ctx}/><EventScheduling e={e} ctx={ctx}/>
  <Disclosure label="模拟积分 · 不计入真实榜单"><div className="simulation-roster">{data.quarterlyLeaderboard.map(row=><span key={row.playerId}>{row.name} · {row.points} 分 · {row.games} 局</span>)}</div></Disclosure>
  <Forms form={form} setForm={setForm} danger={danger} setDanger={setDanger} busy={busy} action={action}/>
 </div>;
}
