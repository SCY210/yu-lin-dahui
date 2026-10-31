'use client';
import {useRef,useState,type CSSProperties} from 'react';
import {seasonPointsPolicy,type WinningStreaks} from '../lib/domain/season-points';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import './avatar-fire.css';
type AvatarPlayer={name?:string;avatarId?:string;winningStreak?:WinningStreaks;losingStreak?:WinningStreaks};
function AvatarImage({p,size='',eager=false}:{p?:AvatarPlayer;size?:string;eager?:boolean}){
 const [failedId,setFailedId]=useState<string|null>(null);
 const name=p?.name??'球友',avatarId=p?.avatarId;
 const custom=!!avatarId&&avatarId!==failedId;
 return <img className={'avatar '+size} src={custom?'/api/photos/'+avatarId:'/default-avatar.svg'} alt={name+'的头像'} loading={eager?'eager':'lazy'} decoding="async" onError={custom?()=>setFailedId(avatarId!):undefined}/>;
}

/** A winning streak shows a different cultivation sign as it grows, each with its own word on the seal:
 * 灵气护体 (jade qi and auspicious clouds), 剑意凌空 (orbiting flying swords), 八卦天阵 (a bagua array with thunder). */
export const streakTiers=[
 {wins:seasonPointsPolicy.streak.start,name:'灵气护体',word:'连胜'},
 {wins:4,name:'剑意凌空',word:'连斩'},
 {wins:6,name:'八卦天阵',word:'连霸'},
] as const;
export function streakTier(wins:number){let tier=0;streakTiers.forEach((t,i)=>{if(wins>=t.wins)tier=i+1});return tier}

const r1=(n:number)=>Math.round(n*10)/10;
/** The frame follows the avatar: round in the classic theme, square in 水墨江湖 (CSS shows one of the two). */
function Frame({className}:{className:string}){
 return <><circle className={className+' af-round'} cx="50" cy="50" r="37.5"/><rect className={className+' af-square'} x="12.5" y="12.5" width="75" height="75" rx="3"/></>;
}
/** 如意云头: an auspicious cloud with a curl, drawn at the origin. */
const CLOUD='M0 6 C-1 2 2 -1 5 0 C6 -3 10 -4 12 -1 C15 -3 19 0 17 4 C20 5 19 9 16 9 L2 9 C-1 9 -2 7 0 6Z';
const CLOUD_CURL='M5.5 5.5 C5.5 3.2 9 3.2 9 5.4 C9 7 6.8 7 6.8 5.8';
/** A flying sword lying along the orbit at the top, point forward (clockwise). */
const SWORD_BLADE='M41 3.9 L58.5 3.9 L62 5 L58.5 6.1 L41 6.1Z';
/** 先天八卦 from 乾 to 坤; 1 is a solid line, 0 a broken one, inner line first. */
const TRIGRAMS=['111','011','101','001','110','010','100','000'];

function QiArt(){
 return <>
  <Frame className="af-qi-ring"/>
  <Frame className="af-flow af-flow-qi"/>
  <g className="af-cloud af-cloud-a" transform="translate(3 5) scale(1.25)"><path d={CLOUD}/><path className="af-curl" d={CLOUD_CURL}/></g>
  <g className="af-cloud af-cloud-b" transform="translate(97 84) scale(-1.15 1.15)"><path d={CLOUD}/><path className="af-curl" d={CLOUD_CURL}/></g>
  <g className="af-motes">{[[24,20],[86,40],[16,70],[64,92]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.5" style={{'--af-delay':(i*0.6)+'s'} as CSSProperties}/>)}</g>
 </>;
}

function SwordArt(){
 return <>
  <Frame className="af-sword-frame-outer"/>
  <Frame className="af-flow af-flow-gold"/>
  <g transform="translate(50 50) scale(.93) translate(-50 -50)"><Frame className="af-sword-frame-inner"/></g>
  <g className="af-swords">
   {[0,120,240].map(angle=><g key={angle} transform={'rotate('+angle+' 50 50)'}>
    <path className="af-sword-trail" d="M34 5 A45 45 0 0 0 16 12"/>
    <path className="af-sword-blade" d={SWORD_BLADE}/>
    <path className="af-sword-edge" d="M42 5 L59 5"/>
    <rect className="af-sword-guard" x="39" y="2.2" width="2" height="5.6" rx=".8"/>
    <rect className="af-sword-hilt" x="34.5" y="4.2" width="4.6" height="1.6" rx=".6"/>
    <circle className="af-sword-guard" cx="34" cy="5" r="1.3"/>
   </g>)}
  </g>
 </>;
}

/** The bagua array sits behind the avatar, so its disc never tints the face. The octagon stays upright and
 * centred; only the trigrams and the rune ring turn, so the array never looks lopsided mid-turn. */
function BaguaBack(){
 const octagon=Array.from({length:8},(_,i)=>{const a=(-90+22.5+i*45)*Math.PI/180;return r1(50+46*Math.cos(a))+','+r1(50+46*Math.sin(a))}).join(' ');
 return <g className="af-bagua-scale">
  <circle className="af-runes" cx="50" cy="50" r="49.5" strokeDasharray=".6 2.4 2.6 2.4"/>
  <polygon className="af-octagon" points={octagon}/>
  <g className="af-bagua">
   {TRIGRAMS.map((lines,i)=><g key={i} transform={'rotate('+(i*45)+' 50 50)'}>
    {[...lines].map((line,j)=>{const y=r1(12.2-j*2.1);return line==='1'?<rect key={j} className="af-yao" x="46.6" y={y} width="6.8" height="1.25" rx=".4"/>:<g key={j}><rect className="af-yao" x="46.6" y={y} width="2.9" height="1.25" rx=".4"/><rect className="af-yao" x="50.5" y={y} width="2.9" height="1.25" rx=".4"/></g>})}
   </g>)}
  </g>
 </g>;
}
function BaguaArt(){
 return <>
  <Frame className="af-bagua-frame"/>
  <Frame className="af-flow af-flow-violet"/>
  {['M8 22 L14 27 L10 30 L17 36','M92 70 L85 74 L89 78 L81 84'].map((d,i)=><path key={i} className={'af-thunder af-thunder-'+(i?'b':'a')} d={d}/>)}
 </>;
}

/** A losing streak brings weather instead, lightly teased and xianxia in spirit: 乌云罩顶 (a grey cloud and drizzle),
 * 风雨交加 (a dark storm cloud, driving rain and flashes) and 天劫加身 (a turning tribulation cloud whose lightning
 * strikes the avatar). The projection keeps only the format of the player's latest rated game, so the avatar shows
 * the live state and a broken run disappears; if both ever arrive, the winning streak is shown. */
export const losingTiers=[
 {losses:2,name:'乌云罩顶',seal:(n:number)=>n+'连败'},
 {losses:4,name:'风雨交加',seal:(n:number)=>n+'连跪'},
 {losses:6,name:'天劫加身',seal:(n:number)=>'渡劫·'+n},
] as const;
export function losingTier(losses:number){let tier=0;losingTiers.forEach((t,i)=>{if(losses>=t.losses)tier=i+1});return tier}
/** A rain cloud drawn above the avatar's top edge. */
const RAIN_CLOUD='M22 17 C17 17 15 12 19 9.5 C18 4.5 24 2 28 4.6 C30 -0.6 39 -1.4 42 3.4 C45 -1 54 -0.8 56 4 C60 0.6 68 2 68 7.4 C73 6.6 77 10.4 75 14 C78 16 76 19.4 72 19.4 L24 19.4 C22.6 19.4 22 18.4 22 17Z';
const BOLT='M52 18 L46 31 L51.5 31 L44 47 L57 27.5 L51 27.5 L56 18Z';
function StormArt({tier}:{tier:number}){
 const drops=tier===1?[30,42,56,68]:[26,34,42,50,58,66,74];
 return <>
  {tier===3&&<g className="al-vortex"><ellipse cx="49" cy="10" rx="31" ry="9" /><ellipse cx="49" cy="10" rx="20" ry="5.5"/></g>}
  <g className="al-cloud"><path d={RAIN_CLOUD}/><path className="al-cloud-shade" d="M24 19.4 C30 15 40 18 46 15.5 C53 18.5 64 14.6 72 19.4Z"/></g>
  {tier>=2&&<path className="al-cloud-flash" d={RAIN_CLOUD}/>}
  <g className="al-rain">{drops.map((x,i)=><line key={x} x1={x} y1="21" x2={x-(tier===1?0:3)} y2={tier===1?27:30} style={{'--al-delay':(i*0.17)+'s'} as CSSProperties}/>)}</g>
  {tier===3&&<path className="al-bolt" d={BOLT}/>}
 </>;
}

export function Avatar({p,size='',eager=false}:{p?:AvatarPlayer;size?:string;eager?:boolean}){
 const streak=p?.winningStreak,wins=streak?Math.max(streak.singles,streak.doubles):0,onFire=wins>=seasonPointsPolicy.streak.start;
 const lost=p?.losingStreak,losses=lost?Math.max(lost.singles,lost.doubles):0,stormy=!onFire&&losses>=losingTiers[0].losses;
 const ref=useRef<HTMLSpanElement>(null),moving=useVisibleAvatarMotion(ref,onFire||stormy);
 const tier=streakTier(wins),info=streakTiers[tier-1];
 const label=onFire&&streak&&info?info.name+' · '+[streak.singles>=seasonPointsPolicy.streak.start?'单打 '+streak.singles+' 连胜':'',streak.doubles>=seasonPointsPolicy.streak.start?'双打 '+streak.doubles+' 连胜':''].filter(Boolean).join(' · '):'';
 if(stormy&&lost){
  const lossTier=losingTier(losses),loss=losingTiers[lossTier-1];
  const lossLabel=loss.name+' · '+[lost.singles>=losingTiers[0].losses?'单打 '+lost.singles+' 连败':'',lost.doubles>=losingTiers[0].losses?'双打 '+lost.doubles+' 连败':''].filter(Boolean).join(' · ');
  return <span ref={ref} className={'avatar avatar-fire-shell '+size} title={lossLabel} data-moving={moving?'true':'false'} data-mood="loss" data-tier={lossTier}>
   <AvatarImage p={{...p,name:(p?.name??'球友')+' · '+lossLabel}} size="avatar-fire-image" eager={eager}/>
   {lossTier===3&&<span className="al-strike" aria-hidden="true"/>}
   <svg className="avatar-fire-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><StormArt tier={lossTier}/></svg>
   <span className="avatar-fire-seal" aria-hidden="true"><span className="af-seal-word">{loss.seal(losses)}</span></span>
  </span>;
 }
 const img=<AvatarImage p={onFire?{...p,name:(p?.name??'球友')+' · '+label}:p} size={onFire?'avatar-fire-image':size} eager={eager}/>;
 if(!onFire||!info)return img;
 return <span ref={ref} className={'avatar avatar-fire-shell '+size} title={label} data-moving={moving?'true':'false'} data-tier={tier}>
  {tier===3&&<svg className="avatar-fire-art avatar-fire-back" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><BaguaBack/></svg>}
  {img}<svg className="avatar-fire-art" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
   {tier===1?<QiArt/>:tier===2?<SwordArt/>:<BaguaArt/>}
  </svg>
  {/* Own spans with fixed type so page rules for b or small (ranking rows, podium) never resize or recolour it. */}
  <span className="avatar-fire-seal" aria-hidden="true"><span className="af-seal-count">{wins}</span><span className="af-seal-word">{info.word}</span></span>
 </span>;
}
