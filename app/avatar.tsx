'use client';
import {useId,useRef,useState} from 'react';
import {seasonPointsPolicy,type WinningStreaks} from '../lib/domain/season-points';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import './avatar-fire.css';
type AvatarPlayer={name?:string;avatarId?:string;winningStreak?:WinningStreaks};
function AvatarImage({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const [failedId,setFailedId]=useState<string|null>(null);
 const name=p?.name??'球友',avatarId=p?.avatarId;
 const custom=!!avatarId&&avatarId!==failedId;
 return <img className={'avatar '+size} src={custom?'/api/photos/'+avatarId:'/default-avatar.svg'} alt={name+'的头像'} loading="lazy" onError={custom?()=>setFailedId(avatarId!):undefined}/>;
}
export function Avatar({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const streak=p?.winningStreak,onFire=!!streak&&Math.max(streak.singles,streak.doubles)>=seasonPointsPolicy.streak.start;
 const ref=useRef<HTMLSpanElement>(null),moving=useVisibleAvatarMotion(ref,onFire),gradient='avatar-fire-'+useId().replaceAll(':','');
 const label=onFire?'🔥 On fire · '+[streak.singles>=seasonPointsPolicy.streak.start?'单打 '+streak.singles+' 连胜':'',streak.doubles>=seasonPointsPolicy.streak.start?'双打 '+streak.doubles+' 连胜':''].filter(Boolean).join(' · '):'';
 const img=<AvatarImage p={onFire?{...p,name:(p?.name??'球友')+' · '+label}:p} size={onFire?'avatar-fire-image':size}/>;
 if(!onFire)return img;
 return <span ref={ref} className={'avatar avatar-fire-shell '+size} title={label} data-moving={moving?'true':'false'}>
  {img}<svg className="avatar-fire-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
   <defs><linearGradient id={gradient} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ed4024"/><stop offset=".55" stopColor="#ff911c"/><stop offset="1" stopColor="#ffe995"/></linearGradient></defs>
   <circle cx="50" cy="50" r="37.5" fill="none" stroke="#ff961d" strokeWidth="2.8"/>
   <g className="avatar-fire-flames" fill={'url(#'+gradient+')'}>{Array.from({length:12},(_,i)=><path key={i} transform={'rotate('+i*30+' 50 50)'} d="M45 15 C41 9 45 5 47 1 C47 7 51 6 51 2 C58 9 58 12 54 16 C51 18 48 17 45 15Z"/>)}</g>
  </svg>
 </span>;
}
