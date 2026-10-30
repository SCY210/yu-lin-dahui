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
import EventView from './event-view';
import {newEventForm} from './event-create-form';
import {feeMembers} from '../lib/domain/fee-transfers';
import type {CompetitionSimulationView} from '../lib/competition-simulation';
import type {LiveOp} from '../lib/domain/live-score';
import {useSecondClock} from '../lib/client/live-score';
import './admin-simulation.css';
type Danger=Parameters<SchedulingContext['setDanger']>[0];
type Kind='activity'|'competition';
/** Opens with a choice between the activity sandbox and the competition sandbox (docs/ADMIN_SIMULATION.md). */
export default function AdminSimulation({accountId,back}:{accountId:string;back:()=>void}){
 const [attempt,setAttempt]=useState(0),[kind,setKind]=useState<Kind|null>(null);
 if(!kind)return <section className="card simulation-chooser"><button type="button" className="ghost" onClick={back}>返回活动</button><h1>模拟排场</h1><p className="hint">选择要模拟的内容。模拟使用真实球友资料快照，单独保存，不影响真实记录、榜单、费用或通知。</p>
  <div className="simulation-choices">
   <button type="button" className="simulation-choice" onClick={()=>setKind('activity')}><strong>模拟活动</strong><span>最多 12 位球友 · 两场地。测试排场、轮休、换人、比分和迟到扣分。</span></button>
   <button type="button" className="simulation-choice" onClick={()=>setKind('competition')}><strong>模拟比赛</strong><span>最多 16 位球友 · 四场地。从设置赛制、抽签、裁判记分到成绩归档，完整走一遍比赛。</span></button>
  </div></section>;
 return <SimulationSession key={kind+':'+accountId+':'+attempt} kind={kind} accountId={accountId} back={()=>setKind(null)} retry={()=>setAttempt(value=>value+1)}/>;
}
function SimulationSession({kind,accountId,back,retry}:{kind:Kind;accountId:string;back:()=>void;retry:()=>void}){
 const url=kind==='competition'?'/api/simulation?kind=competition':'/api/simulation',scope=kind==='competition'?{kind}:{};
 const [view,setView]=useState<SimulationView|null>(null),[form,setForm]=useState<Form|null>(null),[danger,setDanger]=useState<Danger|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const latest=useRef<SimulationView|null>(null),running=useRef(false),lifecycle=useRef<AbortController|null>(null);
 const accept=useCallback((next:SimulationView)=>{if(!latest.current||next.revision>=latest.current.revision){latest.current=next;setView(next)}},[]);
 const read=useCallback(async(signal?:AbortSignal)=>{
  const r=await fetch(url,{cache:'no-store',signal});if(!r.ok){if(r.status===401||r.status===403){latest.current=null;setView(null)}throw new Error('暂时无法读取模拟活动，请检查登录权限后重试')}
  const next=await r.json() as SimulationView;if(!signal?.aborted)accept(next);
 },[accept,url]);
 useEffect(()=>{
  const control=new AbortController();lifecycle.current=control;latest.current=null;
  void fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...scope,action:'initialize',payload:{},requestId:crypto.randomUUID()}),signal:control.signal}).then(async r=>{if(!r.ok)throw new Error('只有群主、管理员和测试员可以进入模拟活动');const next=await r.json() as SimulationView;if(!control.signal.aborted)accept(next)}).catch(e=>{if(!control.signal.aborted)setError(e instanceof Error?e.message:'模拟活动加载失败')});
  const timer=setInterval(()=>{if(!running.current&&!document.hidden)void read(control.signal).catch(e=>{if(!control.signal.aborted)setError(e instanceof Error?e.message:'模拟记录暂时未同步')})},3000);
  return()=>{control.abort();clearInterval(timer)};
 // eslint-disable-next-line react-hooks/exhaustive-deps -- scope follows kind, which remounts the session
 },[accountId,accept,read,url]);
 const action=async(action:string,payload:Record<string,unknown>)=>{
  if(running.current||!latest.current)throw new Error('模拟记录正在同步，请稍候');running.current=true;setBusy(true);setError('');
  try{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...scope,action,payload,revision:typeof payload.expectedRevision==='number'?payload.expectedRevision:latest.current.revision,requestId:crypto.randomUUID()}),signal:lifecycle.current?.signal});
   const result=await r.json() as SimulationView&{error?:string};if(!r.ok){if(r.status===409)await read(lifecycle.current?.signal);if(r.status===401||r.status===403){latest.current=null;setView(null)}throw new Error(result.error??'模拟操作未保存')}
   if(!lifecycle.current?.signal.aborted){accept(result);setForm(null);setDanger(null)}return result;
  }catch(e){if(!lifecycle.current?.signal.aborted)setError(e instanceof Error?e.message:'模拟操作未保存');throw e}finally{running.current=false;if(!lifecycle.current?.signal.aborted)setBusy(false)}
 };
 if(!view)return <section className="card simulation-loading"><button type="button" className="ghost" onClick={back}>返回活动</button><h1>模拟活动</h1><p role="status">{error||'正在读取模拟记录…'}</p>{error&&<button type="button" className="secondary" onClick={retry}>重试加载</button>}</section>;
 const data=view.data,e=data.events[0],ctx:SchedulingContext&{action:typeof action}={data,action,admin:true,busy,name:id=>data.players.find(p=>p.id===id)?.name??id,open:(title,action,values,fields,convert,description)=>setForm({title,action,values,fields,convert,description:description??'仅保存到授权成员专用模拟空间，不修改真实活动。'}),send:(name,payload)=>void action(name,payload).catch(()=>{}),setDanger};
 if(kind==='competition')return <CompetitionBody view={view as CompetitionSimulationView} ctx={ctx} busy={busy} error={error} back={back} form={form} setForm={setForm} danger={danger} setDanger={setDanger} action={action}/>;
 return <div className="admin-simulation"><button type="button" className="ghost" onClick={back}>返回真实活动</button><section className="card simulation-heading"><span className="badge">授权成员专用 · 模拟数据</span><h1>{e.title}</h1><p>{data.players.length} 位真实球友已加入模拟接龙，使用姓名、头像、性别与修为快照。模拟记录单独保存并在管理员之间同步；仅获授权的测试员和管理员可访问，不进入真实榜单、费用或通知。</p><div className="actions">{!e.pointsSession?.startedAt&&<button type="button" className="primary" disabled={busy} onClick={()=>ctx.open('运行模拟','pointsStart',{eventId:e.id,expectedMode:schedulingMode(data,e),expectedPendingIds:pendingSchedulingIds(data,e.id)},[],undefined,'仅在管理员模拟空间运行当前排场，真实活动按预定时间自动开始。')}>运行模拟</button>}<button type="button" className="secondary" disabled={busy} onClick={()=>void action('preplan',{}).catch(()=>{})}>一键预排90分钟</button><button type="button" className="ghost" disabled={busy} onClick={()=>setForm({title:'重置模拟活动',action:'reset',values:{expectedRevision:view.revision},fields:[],description:'清除模拟测试记录，从当前启用的正式球友中取最多12人，刷新资料并建立两场地活动。真实活动不受影响。'})}>重置模拟活动</button></div><p className="hint">可切换三种排场方式。重置会刷新真实球友资料；不足12人时使用现有正式球友。录分后检查场下球友是否上场。</p></section>
  {error&&<p className="connection-note" role="alert">{error}</p>}
  <Disclosure label={'已接龙的真实球友 · '+data.players.length+'人'}><div className="simulation-roster">{data.registrations.map(r=><span key={r.id}>{data.players.find(p=>p.id===r.playerId)?.name??r.playerId} · 模拟接龙</span>)}</div></Disclosure>
  <NoShowHold e={e} ctx={ctx}/><EventScheduling e={e} ctx={ctx}/>
  <Disclosure label="模拟积分 · 不计入真实榜单"><div className="simulation-roster">{data.quarterlyLeaderboard.map(row=><span key={row.playerId}>{row.name} · {row.points} 分 · {row.games} 局</span>)}</div></Disclosure>
  <Forms form={form} setForm={setForm} danger={danger} setDanger={setDanger} busy={busy} action={action}/>
 </div>;
}

const steps=['用正式的「创建比赛」表单建比赛：项目、时间、球馆、场地','球友报名（可一键全员报名），到点后可「快进到开赛」','群主或管理员设置赛制、小组赛和淘汰赛计分、报名费','选人（双打可按修为自动配对）并抽签','开赛、指定裁判，用「裁判记分」逐分记分，或一键录完','生成淘汰赛，决出冠军后在费用页确认报名费、查看成绩并归档'];
type Action=(name:string,payload:Record<string,unknown>)=>Promise<unknown>;
/** The competition sandbox runs the real flow on sandbox data: the real create form, member signups, and the real
 * activity page with its signup, competition and fee tabs. Shortcuts sign everyone up, move the competition to now,
 * start ready fixtures and finish matches in play, so the whole flow can be tried in minutes. */
function CompetitionBody({view,ctx,busy,error,back,form,setForm,danger,setDanger,action}:{view:CompetitionSimulationView;ctx:SchedulingContext;busy:boolean;error:string;back:()=>void;form:Form|null;setForm:(f:Form|null)=>void;danger:Danger|null;setDanger:(d:Danger|null)=>void;action:Action}){
 const data=view.data,e=data.events.find(e=>e.deletedAt===undefined),[tab,setTab]=useState('overview');
 const clock=useSecondClock();
 const run=(name:string,payload:Record<string,unknown>={})=>void action(name,payload).catch(()=>{});
 const live={scores:view.live,send:async(op:LiveOp)=>{const next=await action('liveScore',op) as CompetitionSimulationView;return next.live[op.matchId]}};
 const create=()=>{const f=newEventForm(Date.now(),true,true,feeMembers(data.players));ctx.open(f.title,f.action,f.values,f.fields,f.convert,'仅保存到模拟空间，不会创建真实比赛。'+(f.description??''))};
 const signedUp=(id:string)=>!!e&&data.registrations.some(r=>r.eventId===e.id&&r.playerId===id&&r.status!=='cancelled');
 const count=data.players.filter(p=>signedUp(p.id)).length;
 const regs=(ev:{id:string})=>data.registrations.filter(r=>r.eventId===ev.id&&r.status!=='cancelled').sort((a,b)=>a.sequence-b.sequence);
 const eventCtx={...ctx,live,regs,refresh:async()=>{},openEvent:()=>setTab('overview'),openProfile:()=>{}};
 return <div className="admin-simulation"><button type="button" className="ghost" onClick={back}>返回选择</button>
  <section className="card simulation-heading"><span className="badge">授权成员专用 · 模拟数据</span><h1>{e?.title??'模拟比赛'}</h1><p>{data.players.length} 位真实球友的姓名、头像、性别与修为快照。流程与正式比赛一致，记录单独保存，不进入真实榜单、费用或通知。</p>
   <ol className="simulation-steps">{steps.map(step=><li key={step}>{step}</li>)}</ol>
   <div className="actions">{!e&&<button type="button" className="primary" disabled={busy} onClick={create}>创建比赛</button>}
    {e&&count<data.players.length&&<button type="button" className="secondary" disabled={busy} onClick={()=>run('signupAll')}>全员报名</button>}
    {e&&clock<e.start&&<button type="button" className="secondary" disabled={busy} onClick={()=>run('startNow')}>快进到开赛</button>}
    {e?.tournament&&e.tournament.phase!=='setup'&&<><button type="button" className="primary" disabled={busy} onClick={()=>run('autoStart')}>一键开赛空闲场地</button><button type="button" className="secondary" disabled={busy} onClick={()=>run('autoScore')}>一键录完进行中比赛</button></>}
    <button type="button" className="ghost" disabled={busy} onClick={()=>setForm({title:'重置模拟比赛',action:'reset',values:{expectedRevision:view.revision},fields:[],description:'清除模拟比赛和报名，重新取最多 16 位正式球友的资料快照。真实活动不受影响。'})}>重置模拟比赛</button></div>
   <p className="hint">一键录分按双方修为随机生成符合该阶段计分规则的比分；裁判已记完的比赛按裁判比分提交。</p></section>
  {error&&<p className="connection-note" role="alert">{error}</p>}
  {e&&<Disclosure label={'模拟球友报名 · 已报名 '+count+' / '+data.players.length}><div className="simulation-signups">{data.players.map(p=><div key={p.id} className="row small-line"><span className="grow">{p.name}</span><button type="button" className={signedUp(p.id)?'ghost':'secondary'} disabled={busy} onClick={()=>run('signup',{playerId:p.id,cancel:signedUp(p.id)})}>{signedUp(p.id)?'取消报名':'替他报名'}</button></div>)}</div></Disclosure>}
  {e&&<EventView e={e} ctx={eventCtx} tab={tab} setTab={setTab} back={()=>setTab('overview')}/>}
  <Forms form={form} setForm={setForm} danger={danger} setDanger={setDanger} busy={busy} action={action}/>
 </div>;
}
