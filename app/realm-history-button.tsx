'use client';
import {lazy,useState} from 'react';
import Deferred from './deferred';
import './realm-history.css';
const RealmHistoryDialog=lazy(()=>import('./realm-history-dialog'));

export default function RealmHistoryButton({playerId,accountId,name}:{playerId:string;accountId:string;name?:string}){
 const [open,setOpen]=useState(false);
 return <><button type="button" className="ghost realm-history-button" aria-label={name?name+'的修为明细':'修为明细'} aria-haspopup="dialog" onClick={()=>setOpen(true)}>修为明细</button>
 {open&&<Deferred><RealmHistoryDialog key={accountId+'|'+playerId} playerId={playerId} accountId={accountId} name={name} onClose={()=>setOpen(false)}/></Deferred>}</>;
}
