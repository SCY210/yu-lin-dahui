'use client';
import {useEffect,useState} from 'react';
import {Plus,Check,Trash2} from 'lucide-react';
import {canManageEvent} from '../lib/domain/permissions';
import {canVoteForShuttle,shuttleParticipantIds,shuttleVoteCounts} from '../lib/domain/shuttle-voting';
import type {Event,ShuttleOption} from '../lib/domain/types';
import './event-shuttles.css';

export default function EventShuttles({e,ctx}:{e:Event;ctx:any}){
 const {data,open,send,busy}=ctx;
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[e.id,e.start]);
 const plan=e.shuttlePlan,options=plan?.options??[],selected=options.find(o=>o.id===plan?.selectedId);
 const manager=canManageEvent(data.me,e),editable=manager&&!['ended','cancelled'].includes(e.status);
 const participants=shuttleParticipantIds(data,e.id),counts=shuttleVoteCounts(data,e),canVote=canVoteForShuttle(data,e,data.me,now);
 const mine=plan?.votes.find(v=>v.voterId===data.me.id);
 const total=Object.values(counts).reduce((sum,count)=>sum+count,0);
 const votingOpen=!!plan?.votingOpen&&now<e.start&&['open','locked'].includes(e.status);
 const add=()=>open('添加候选球','shuttleOption',{eventId:e.id,name:'',note:''},[{key:'name',label:'品牌 / 型号'},{key:'note',label:'球速、价格或其他说明（可选）',optional:true}],undefined,'填入本次可用的球，成员可参考说明投票。');
 const confirm=(option:ShuttleOption)=>open('确认本次用球','shuttleConfirm',{eventId:e.id,optionId:option.id},[],undefined,`选用「${option.name}」后关闭投票并保留票数，成员会看到确认结果。`);
 return <section className="card event-shuttles" aria-label="本次用球与投票">
  <div className="row"><h3>本次用球</h3>{editable&&<button type="button" className="secondary" disabled={busy||options.length>=12} onClick={add}><Plus size={17} aria-hidden="true"/>添加候选球</button>}</div>
  {selected?<div className="shuttle-selected"><span className="badge"><Check size={15} aria-hidden="true"/>已确认</span><strong>{selected.name}</strong>{selected.note&&<p>{selected.note}</p>}</div>:<p className="muted">{options.length?'等待创建者确认本次用球。':'尚未设置本次用球。'}</p>}
  {options.length>0&&<>
   <p className="hint" role="status">{votingOpen?'用球投票开放中':e.status==='cancelled'?'活动已取消，投票已关闭':now>=e.start||['live','ended'].includes(e.status)?'活动已开始，投票已关闭':'用球投票已关闭'} · {total} 票</p>
   <div className="shuttle-options">{options.map(option=>{
    const count=counts[option.id]??0,voted=mine?.optionId===option.id&&participants.has(data.me.playerId);
    return <div className={'shuttle-option'+(selected?.id===option.id?' is-selected':'')} key={option.id}>
     <div className="shuttle-option-heading"><strong>{option.name}</strong><span>{count} 票{voted?' · 已投':''}{selected?.id===option.id?' · 本次选用':''}</span></div>
     {option.note&&<p className="hint">{option.note}</p>}
     <div className="shuttle-vote-track" aria-hidden="true"><span style={{width:(total?count/total*100:0)+'%'}}/></div>
     <div className="actions">
      <button type="button" className={'tag-button'+(voted?' active':'')} aria-label={(voted?'撤回对':'投给')+option.name+'的票'} aria-pressed={voted} disabled={busy||!canVote} onClick={()=>send('shuttleVote',{eventId:e.id,optionId:voted?null:option.id})}>{voted?'撤回投票':'投这一款'}</button>
      {editable&&selected?.id!==option.id&&<button type="button" className="ghost" disabled={busy} onClick={()=>confirm(option)}>选用这一款</button>}
      {editable&&selected?.id!==option.id&&<button type="button" className="ghost danger" aria-label={'移除候选球'+option.name} disabled={busy} onClick={()=>open('移除候选球','shuttleRemove',{eventId:e.id,optionId:option.id},[],undefined,`移除「${option.name}」及其 ${count} 票，其他候选球的投票保持不变。`)}><Trash2 size={16} aria-hidden="true"/>移除</button>}
     </div>
    </div>;
   })}</div>
   <p className="hint">正式接龙与候补成员每个账号一票，可改投或撤回。投票仅供参考，最终由创建者确认用球。</p>
   {votingOpen&&!participants.has(data.me.playerId)&&<p className="hint">先参加本次接龙，即可投票。</p>}
   {editable&&<div className="actions">
    {now<e.start&&['open','locked'].includes(e.status)&&<button type="button" className="secondary" disabled={busy} onClick={()=>send('shuttleVoting',{eventId:e.id,open:!plan?.votingOpen})}>{plan?.votingOpen?'关闭投票':'开放投票'}</button>}
    {selected&&<button type="button" className="ghost" disabled={busy} onClick={()=>open('清除用球确认','shuttleConfirm',{eventId:e.id,optionId:null},[],undefined,'清除当前用球确认并保留候选球与票数，需要时可再次开放投票。')}>清除确认</button>}
   </div>}
  </>}
 </section>;
}
