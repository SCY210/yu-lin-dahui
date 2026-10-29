'use client';
import {useState,type ReactNode} from 'react';
import './disclosure.css';

/** A render callback also defers expensive row calculations until the section is open. */
export default function Disclosure({label,children,defaultOpen=false,className=''}:{label:string;children:ReactNode|(()=>ReactNode);defaultOpen?:boolean;className?:string}) {
 const [expanded,setExpanded]=useState(defaultOpen);
 return <details className={'app-disclosure '+className} open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary>{label}</summary>
  {expanded&&<div className="app-disclosure-content">{typeof children==='function'?children():children}</div>}
 </details>;
}
