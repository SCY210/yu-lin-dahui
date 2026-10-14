'use client';
import {useId,useRef,useState,type CSSProperties} from 'react';
import {seasonPointsPolicy,type WinningStreaks} from '../lib/domain/season-points';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import './avatar-fire.css';
type AvatarPlayer={name?:string;avatarId?:string;winningStreak?:WinningStreaks};
// Flames rise from the rim; each tongue has its own silhouette and rhythm.
const fireTongues=[
 {x:20,y:79,lean:-18,height:.8,delay:-.7,path:0},
 {x:22,y:60,lean:-12,height:1.05,delay:-1.4,path:1},
 {x:33,y:47,lean:-8,height:1.1,delay:-.3,path:2},
 {x:47,y:41,lean:4,height:1.3,delay:-1.1,path:0},
 {x:61,y:43,lean:10,height:1.05,delay:-.5,path:1},
 {x:74,y:51,lean:15,height:1.2,delay:-1.8,path:2},
 {x:81,y:70,lean:18,height:.95,delay:-.9,path:0},
 {x:73,y:91,lean:30,height:.7,delay:-1.5,path:1},
 {x:31,y:94,lean:-30,height:.65,delay:-.2,path:2},
];
const flamePaths=[
 'M-9 3C-15-7-7-12-5-20C-4-14 0-14 1-18C3-24 0-29 5-34C3-24 13-20 10-12C16-14 13-19 14-21C22-9 14 3 5 5Z',
 'M-8 4C-16-4-10-10-11-15C-7-13-6-9-3-12C3-18-4-25 2-31C1-23 11-21 9-12C13-16 12-20 16-24C13-13 20-6 11 2C6 6-3 7-8 4Z',
 'M-9 3C-15-5-8-9-9-18C-5-17-4-12-1-15C6-22 2-28 8-33C5-22 13-19 11-12C15-10 17-14 17-17C22-7 13 5 4 5Z',
];
function AvatarImage({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const [failedId,setFailedId]=useState<string|null>(null);
 const name=p?.name??'球友',avatarId=p?.avatarId;
 const custom=!!avatarId&&avatarId!==failedId;
 return <img className={'avatar '+size} src={custom?'/api/photos/'+avatarId:'/default-avatar.svg'} alt={name+'的头像'} loading="lazy" onError={custom?()=>setFailedId(avatarId!):undefined}/>;
}
export function Avatar({p,size=''}:{p?:AvatarPlayer;size?:string}){
 const streak=p?.winningStreak,onFire=!!streak&&Math.max(streak.singles,streak.doubles)>=seasonPointsPolicy.streak.start;
 const ref=useRef<HTMLSpanElement>(null),moving=useVisibleAvatarMotion(ref,onFire),artId='avatar-fire-'+useId().replaceAll(':','');
 const label=onFire?'🔥 On fire · '+[streak.singles>=seasonPointsPolicy.streak.start?'单打 '+streak.singles+' 连胜':'',streak.doubles>=seasonPointsPolicy.streak.start?'双打 '+streak.doubles+' 连胜':''].filter(Boolean).join(' · '):'';
 const img=<AvatarImage p={onFire?{...p,name:(p?.name??'球友')+' · '+label}:p} size={onFire?'avatar-fire-image':size}/>;
 if(!onFire)return img;
 return <span ref={ref} className={'avatar avatar-fire-shell '+size} title={label} data-moving={moving?'true':'false'}>
  {img}<svg className="avatar-fire-art" viewBox="0 0 100 120" aria-hidden="true" focusable="false">
   <defs>
    <linearGradient id={artId+'-outer'} x1="0" y1="1" x2=".2" y2="0"><stop stopColor="#e63216"/><stop offset=".4" stopColor="#ff651a"/><stop offset="1" stopColor="#ffc34b"/></linearGradient>
    <linearGradient id={artId+'-core'} x1="0" y1="1" x2="0" y2="0"><stop stopColor="#ff9d20"/><stop offset=".5" stopColor="#ffe477"/><stop offset="1" stopColor="#fff7cf"/></linearGradient>
    <mask id={artId+'-rim'} maskUnits="userSpaceOnUse" x="-20" y="-20" width="140" height="160"><rect x="-20" y="-20" width="140" height="160" fill="white"/><circle cx="50" cy="70" r="29" fill="black"/></mask>
   </defs>
   <g mask={'url(#'+artId+'-rim)'}>
    <circle className="avatar-fire-heat" cx="50" cy="70" r="30.5" fill="none" stroke="#ff6a1d" strokeWidth="6"/>
    {fireTongues.map((flame,i)=><g key={i} transform={`translate(${flame.x} ${flame.y}) rotate(${flame.lean}) scale(.7 ${flame.height})`}>
     <g className="avatar-fire-tongue" style={{'--fire-delay':flame.delay+'s','--fire-duration':(1.05+i%3*.23)+'s'} as CSSProperties}>
      <path d={flamePaths[flame.path]} fill={'url(#'+artId+'-outer)'}/>
      <path d={flamePaths[(flame.path+1)%3]} transform="scale(.52 .72)" fill={'url(#'+artId+'-core)'}/>
     </g>
    </g>)}
    <circle cx="50" cy="70" r="30" fill="none" stroke={'url(#'+artId+'-core)'} strokeWidth="1.8"/>
   </g>
   <g fill="#ffd875">{[[-23,55],[-11,37],[8,34],[25,51]].map(([x,y],i)=><g key={i} transform={`translate(${50+x} ${y})`}><ellipse className="avatar-fire-ember" rx=".9" ry="1.7" style={{'--fire-delay':(-i*.47)+'s','--ember-drift':(i%2?4:-3)+'px','--fire-duration':(1.6+i*.19)+'s'} as CSSProperties}/></g>)}</g>
  </svg>
 </span>;
}
