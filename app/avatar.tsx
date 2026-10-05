'use client';
import {useState} from 'react';
export function Avatar({p,size=''}:any){const [failedId,setFailedId]=useState<string|null>(null);const name:string=p?.name??'球友';return p?.avatarId&&p.avatarId!==failedId?<img className={'avatar '+size} src={'/api/photos/'+p.avatarId} alt={name+'的头像'} loading="lazy" onError={()=>setFailedId(p.avatarId)}/>:null}
