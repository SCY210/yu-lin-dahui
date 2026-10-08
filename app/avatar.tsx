'use client';
import {useState} from 'react';
type AvatarPlayer={name?:string;avatarId?:string};
export function Avatar({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const [failedId,setFailedId]=useState<string|null>(null);
 const name=p?.name??'球友',avatarId=p?.avatarId;
 const custom=!!avatarId&&avatarId!==failedId;
 return <img className={'avatar '+size} src={custom?'/api/photos/'+avatarId:'/default-avatar.svg'} alt={name+'的头像'} loading="lazy" onError={custom?()=>setFailedId(avatarId!):undefined}/>;
}
