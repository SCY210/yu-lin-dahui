'use client';
import {useId,useState,type ReactNode} from 'react';
import {Bell,KeyRound,Medal} from 'lucide-react';
import './me-panels.css';

/** The entry card on My: a short tally; the collection opens on its own page (`page=achievements`). */
export function MyAchievements({unlocked,stages,totalStages,onOpen}:{unlocked:number;stages:number;totalStages:number;onOpen:()=>void}) {
 return <section className="card me-achievements-entry">
  <div className="row"><div><h3><Medal size={20} aria-hidden="true"/> 我的成就</h3><p className="hint">已点亮 {unlocked} 枚 · {stages} / {totalStages} 阶段</p></div><button className="secondary" onClick={onOpen}>查看成就 ›</button></div>
 </section>;
}

/** extra: further buttons in the same row (administrator tools, sign-out), so My ends with one settings card. */
export function MySettings({account,notifications,extra}:{account:ReactNode;notifications:ReactNode;extra?:ReactNode}) {
 const [active,setActive]=useState<'account'|'notifications'|null>(null),id=useId();
 return <section className="card me-settings-entry">
  <h3>设置</h3>
  <div className="actions">
   <button className="secondary" aria-expanded={active==='account'} aria-controls={active==='account'?id:undefined} onClick={()=>setActive(value=>value==='account'?null:'account')}><KeyRound size={17} aria-hidden="true"/> 账号与密码</button>
   <button className="secondary" aria-expanded={active==='notifications'} aria-controls={active==='notifications'?id:undefined} onClick={()=>setActive(value=>value==='notifications'?null:'notifications')}><Bell size={17} aria-hidden="true"/> 通知与安装</button>
   {extra}
  </div>
  {active&&<div id={id} className="me-panel-content">{active==='account'?account:notifications}</div>}
 </section>;
}
