'use client';
import {useId,useRef,useState,type CSSProperties} from 'react';
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

/** Spirit fire grows with the streak, like 凡火 → 真火 → 三昧真火: red flame, golden flame, violet flame with a rune ring. */
export const fireTiers=[{wins:6,name:'三昧真火'},{wins:4,name:'真火护体'},{wins:seasonPointsPolicy.streak.start,name:'赤焰护体'}] as const;
export function fireTier(wins:number){const index=fireTiers.findIndex(t=>wins>=t.wins);return index<0?0:fireTiers.length-index}

const r1=(n:number)=>Math.round(n*10)/10;
const at=(radius:number,deg:number)=>r1(50+radius*Math.cos(deg*Math.PI/180))+' '+r1(50+radius*Math.sin(deg*Math.PI/180));
/** A halo of flame (火焰背光): tongues of uneven height rise from the ring and lean with the swirl. */
function flameCrown(count:number,base:number,heights:readonly number[],lean:number,offset=0){
 const step=360/count;let d='M'+at(base,offset-90);
 for(let i=0;i<count;i++){
  const a=offset-90+i*step,tip=base+heights[i%heights.length];
  d+=' C'+at(base+(tip-base)*.35,a+step*.15)+' '+at(tip-(tip-base)*.2,a+step*.35+lean)+' '+at(tip,a+step*.55+lean)
   +' C'+at(tip-(tip-base)*.45,a+step*.6+lean*.4)+' '+at(base+(tip-base)*.15,a+step*.8)+' '+at(base,a+step);
 }
 // Cut the centre out so only the halo is filled.
 const hole=base-.5;
 return d+'Z M'+r1(50-hole)+' 50 A'+hole+' '+hole+' 0 1 0 '+r1(50+hole)+' 50 A'+hole+' '+hole+' 0 1 0 '+r1(50-hole)+' 50Z';
}
const OUTER=flameCrown(16,37,[8,4.5,10,5,7.5,4,9.5,5,8.5,4.5,6.5,4,10,5.5,7,4],9);
const INNER=flameCrown(12,37,[4,2.5,5,3,4.5,2.5,5,3,4,2.5,4.5,3],-6,11);
/** A brush-stroke ring: two offset circles make the line thicken and thin like ink. */
const BRUSH='M50 11 A39 39 0 1 1 49.9 11Z M50.6 12.9 A37.4 37.4 0 1 0 50.7 12.9Z';

export function Avatar({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const streak=p?.winningStreak,wins=streak?Math.max(streak.singles,streak.doubles):0,onFire=wins>=seasonPointsPolicy.streak.start;
 const ref=useRef<HTMLSpanElement>(null),moving=useVisibleAvatarMotion(ref,onFire),id='avatar-fire-'+useId().replaceAll(':','');
 const tier=fireTier(wins),title=fireTiers[fireTiers.length-tier]?.name??'';
 const label=onFire&&streak?title+' · '+[streak.singles>=seasonPointsPolicy.streak.start?'单打 '+streak.singles+' 连胜':'',streak.doubles>=seasonPointsPolicy.streak.start?'双打 '+streak.doubles+' 连胜':''].filter(Boolean).join(' · '):'';
 const img=<AvatarImage p={onFire?{...p,name:(p?.name??'球友')+' · '+label}:p} size={onFire?'avatar-fire-image':size}/>;
 if(!onFire)return img;
 return <span ref={ref} className={'avatar avatar-fire-shell '+size} title={label} data-moving={moving?'true':'false'} data-tier={tier}>
  {img}<svg className="avatar-fire-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
   <defs>
    <radialGradient id={id} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="53"><stop offset=".68" className="af-stop-core"/><stop offset=".8" className="af-stop-mid"/><stop offset="1" className="af-stop-tip"/></radialGradient>
   </defs>
   <g className="avatar-fire-swirl"><path className="avatar-fire-flame" d={OUTER} fillRule="evenodd" fill={'url(#'+id+')'}/></g>
   <g className="avatar-fire-swirl is-inner"><path className="avatar-fire-flame avatar-fire-core" d={INNER} fillRule="evenodd"/></g>
   {/* The ink ring is drawn over the flames so its line stays crisp. */}
   <path className="avatar-fire-brush" d={BRUSH} fillRule="evenodd"/>
   {tier===3&&<circle className="avatar-fire-runes" cx="50" cy="50" r="45.5" fill="none" strokeDasharray=".6 2.4 2.6 2.4" strokeLinecap="round"/>}
   <g className="avatar-fire-embers">{[[20,30],[82,38],[30,86],[74,80]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.6" style={{'--af-delay':(i*0.55)+'s'} as CSSProperties}/>)}</g>
  </svg>
  <b className="avatar-fire-seal" aria-hidden="true">{wins}<small>连</small></b>
 </span>;
}
