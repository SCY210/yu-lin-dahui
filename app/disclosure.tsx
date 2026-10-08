'use client';
import {useState,type ReactNode} from 'react';
import './disclosure.css';

/** Keep secondary information discoverable without mounting it until opened. */
export default function Disclosure({label,children,defaultOpen=false,className=''}:{label:string;children:ReactNode;defaultOpen?:boolean;className?:string}) {
 const [expanded,setExpanded]=useState(defaultOpen);
 return <details className={'app-disclosure '+className} open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary>{label}</summary>
  {expanded&&<div className="app-disclosure-content">{children}</div>}
 </details>;
}
