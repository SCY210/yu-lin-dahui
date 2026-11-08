'use client';
import {lazy,useState,type ReactNode} from 'react';
import Deferred from './deferred';
import './realm-history.css';
const RealmHistoryDialog=lazy(()=>import('./realm-history-dialog'));

export default function RealmHistoryButton({playerId,accountId,name,children}:{playerId:string;accountId:string;name?:string;children:ReactNode}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="realm-history-trigger" aria-label={name?'查看'+name+'的修为详情':'查看修为详情'} aria-haspopup="dialog" onClick={event=>{event.stopPropagation();setOpen(true)}}>{children}</button>
 {open&&<Deferred><RealmHistoryDialog key={accountId+'|'+playerId} playerId={playerId} accountId={accountId} name={name} onClose={()=>setOpen(false)}/></Deferred>}</>;
}
