'use client';
import {useEffect,useRef,useState} from 'react';
import {seasonPointsPolicy,type WinningStreaks} from '../lib/domain/season-points';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import {subscribeAvatarFire,type AvatarFireSubscription} from '../lib/client/avatar-fire-renderer';
import './avatar-fire.css';
type AvatarPlayer={name?:string;avatarId?:string;winningStreak?:WinningStreaks};
/** Keep streak progression and seal words while using the same flowing fire. */
export const streakTiers=[
 {wins:seasonPointsPolicy.streak.start,word:'连胜'},
 {wins:4,word:'连斩'},
 {wins:6,word:'连霸'},
] as const;
export function streakTier(wins:number){let tier=0;streakTiers.forEach((item,i)=>{if(wins>=item.wins)tier=i+1});return tier}
function AvatarImage({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const [failedId,setFailedId]=useState<string|null>(null);
 const name=p?.name??'球友',avatarId=p?.avatarId;
 const custom=!!avatarId&&avatarId!==failedId;
 return <img className={'avatar '+size} src={custom?'/api/photos/'+avatarId:'/default-avatar.svg'} alt={name+'的头像'} loading="lazy" onError={custom?()=>setFailedId(avatarId!):undefined}/>;
}
export function Avatar({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const streak=p?.winningStreak,wins=streak?Math.max(streak.singles,streak.doubles):0,onFire=wins>=seasonPointsPolicy.streak.start;
 const tier=streakTier(wins),info=streakTiers[tier-1];
 const ref=useRef<HTMLSpanElement>(null),moving=useVisibleAvatarMotion(ref,onFire);
 const canvas=useRef<HTMLCanvasElement>(null),fire=useRef<AvatarFireSubscription|null>(null);
 useEffect(()=>{
  if(!onFire||!canvas.current)return;
  const subscription=subscribeAvatarFire(canvas.current);fire.current=subscription;
  return()=>{subscription.dispose();fire.current=null};
 },[onFire]);
 useEffect(()=>{fire.current?.setMoving(moving)},[moving,onFire]);
 const label=onFire&&streak&&info?'🔥 On fire · 日漫流焰 · '+info.word+' · '+[streak.singles>=seasonPointsPolicy.streak.start?'单打 '+streak.singles+' 连胜':'',streak.doubles>=seasonPointsPolicy.streak.start?'双打 '+streak.doubles+' 连胜':''].filter(Boolean).join(' · '):'';
 const img=<AvatarImage p={onFire?{...p,name:(p?.name??'球友')+' · '+label}:p} size={onFire?'avatar-fire-image':size}/>;
 if(!onFire||!info)return img;
 return <span ref={ref} className={'avatar avatar-fire-shell '+size} title={label} data-moving={moving?'true':'false'} data-tier={tier}>
  <canvas ref={canvas} className="avatar-fire-art" aria-hidden="true"/>
  <i className="avatar-fire-fallback" aria-hidden="true"/>
  {img}
  <b className="avatar-fire-seal" aria-hidden="true">{wins}<small>{info.word}</small></b>
 </span>;
}
