'use client';
import {useId,useState,type ReactNode} from 'react';
import {Bell,KeyRound,Medal} from 'lucide-react';
import './me-panels.css';

export function MyAchievements({children}:{children:ReactNode}) {
 const [expanded,setExpanded]=useState(false),id=useId();
 return <section className="card me-achievements-entry">
  <div className="row"><h3><Medal size={20} aria-hidden="true"/> 我的成就</h3><button className="secondary" aria-expanded={expanded} aria-controls={expanded?id:undefined} onClick={()=>setExpanded(value=>!value)}>{expanded?'收起成就':'查看成就'}</button></div>
  {expanded&&<div id={id} className="me-panel-content">{children}</div>}
 </section>;
}

export function MySettings({account,notifications}:{account:ReactNode;notifications:ReactNode}) {
 const [active,setActive]=useState<'account'|'notifications'|null>(null),id=useId();
 return <section className="card me-settings-entry">
  <h3>账号与设备</h3>
  <div className="actions">
   <button className="secondary" aria-expanded={active==='account'} aria-controls={active==='account'?id:undefined} onClick={()=>setActive(value=>value==='account'?null:'account')}><KeyRound size={17} aria-hidden="true"/> 账号与密码</button>
   <button className="secondary" aria-expanded={active==='notifications'} aria-controls={active==='notifications'?id:undefined} onClick={()=>setActive(value=>value==='notifications'?null:'notifications')}><Bell size={17} aria-hidden="true"/> 通知与安装</button>
  </div>
  {active&&<div id={id} className="me-panel-content">{active==='account'?account:notifications}</div>}
 </section>;
}
