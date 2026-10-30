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
import EventTournament from './event-tournament';
import type {CompetitionSimulationView} from '../lib/competition-simulation';
import type {LiveOp} from '../lib/domain/live-score';
import {choice} from './form-fields';
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

const steps=['设置赛制、项目、计分和报名费','选人（双打可按修为自动配对）并抽签','一键开赛，或在对战表逐场安排并指定裁判','打开「裁判记分」逐分记分，或一键录完','小组赛结束后生成淘汰赛，继续开赛录分','决出冠军后查看成绩并一键归档'];
type Action=(name:string,payload:Record<string,unknown>)=>Promise<unknown>;
/** The competition sandbox: the real competition page on sandbox data, plus shortcuts that start every ready fixture
 * and finish every match in play, so the whole flow can be tried in minutes. */
function CompetitionBody({view,ctx,busy,error,back,form,setForm,danger,setDanger,action}:{view:CompetitionSimulationView;ctx:SchedulingContext;busy:boolean;error:string;back:()=>void;form:Form|null;setForm:(f:Form|null)=>void;danger:Danger|null;setDanger:(d:Danger|null)=>void;action:Action}){
 const data=view.data,e=data.events[0];
 const live={scores:view.live,send:async(op:LiveOp)=>{const next=await action('liveScore',op) as CompetitionSimulationView;return next.live[op.matchId]}};
 return <div className="admin-simulation"><button type="button" className="ghost" onClick={back}>返回选择</button>
  <section className="card simulation-heading"><span className="badge">授权成员专用 · 模拟数据</span><h1>{e.title}</h1><p>{data.players.length} 位真实球友已正式报名，使用姓名、头像、性别与修为快照。模拟记录单独保存，不进入真实榜单、费用或通知。</p>
   <ol className="simulation-steps">{steps.map(step=><li key={step}>{step}</li>)}</ol>
   <div className="actions"><button type="button" className="primary" disabled={busy} onClick={()=>void action('autoStart',{}).catch(()=>{})}>一键开赛空闲场地</button><button type="button" className="secondary" disabled={busy} onClick={()=>void action('autoScore',{}).catch(()=>{})}>一键录完进行中比赛</button><button type="button" className="ghost" disabled={busy} onClick={()=>setForm({title:'重置模拟比赛',action:'reset',values:{expectedRevision:view.revision,matchFormat:'doubles'},fields:[choice('matchFormat','比赛类型',[['doubles','双打 · 固定搭档'],['singles','单打']])],description:'清除模拟比赛记录，从当前启用的正式球友中取最多 16 人，刷新资料并建立四场地比赛。真实活动不受影响。'})}>重置模拟比赛</button></div>
   <p className="hint">一键录分按双方修为随机生成符合计分规则的比分；裁判已记完的比赛按裁判比分提交。</p></section>
  {error&&<p className="connection-note" role="alert">{error}</p>}
  <EventTournament e={e} ctx={{...ctx,live}}/>
  <Forms form={form} setForm={setForm} danger={danger} setDanger={setDanger} busy={busy} action={action}/>
 </div>;
}
