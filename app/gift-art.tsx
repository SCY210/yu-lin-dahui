'use client';
import {useId,useRef,type CSSProperties} from 'react';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import './gift-art.css';

export type GiftArtKind='feather'|'jade'|'scroll'|'parcel';
/** Presentation only. Receipt names include a quantity; unknown/custom products keep a neutral parcel. */
export function giftArtKind(name?:string):GiftArtKind{
 const label=(name??'').trim().replace(/\s*×\s*\d+$/u,'');
 return label==='清风传意'?'feather':label==='同心玉佩'?'jade':label==='金兰灵契'?'scroll':'parcel';
}
const captions:Record<GiftArtKind,string>={feather:'一缕清风 · 心意相随',jade:'双佩相合 · 同心同行',scroll:'金兰结契 · 情谊长存',parcel:'以礼传心 · 缘聚于此'};

/** Original inline vector art: mineral pigments, gold edging and cinnabar on rice paper. */
export default function GiftArt({name,className=''}:{name?:string;className?:string}){
 const kind=giftArtKind(name),id='gift-'+useId().replace(/:/g,'');
 return <svg className={`gift-art gift-art-${kind} ${className}`} viewBox="0 0 128 128" aria-hidden="true" focusable="false" data-gift-art={kind}>
  <defs>
   <linearGradient id={id+'-jade'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#effbef"/><stop offset=".35" stopColor="#8bceba"/><stop offset=".7" stopColor="#327d6b"/><stop offset="1" stopColor="#c6e4c2"/></linearGradient>
   <linearGradient id={id+'-gold'} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff0bb"/><stop offset=".45" stopColor="#d2a653"/><stop offset="1" stopColor="#92632b"/></linearGradient>
   <linearGradient id={id+'-paper'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fffbed"/><stop offset="1" stopColor="#ebd7a1"/></linearGradient>
  </defs>
  <circle className="gift-art-wash" cx="64" cy="64" r="53"/>
  <circle className="gift-art-rim" cx="64" cy="64" r="49"/>
  <path className="gift-art-ornament" d="M13 64h8m86 0h8M64 13v8m0 86v8M29 29l5 5m60 60 5 5M29 99l5-5m60-60 5-5"/>
  {kind==='feather'?<>
   <path className="gift-art-cloud" d="M20 85h32c12 0 15-14 4-14-8 0-10 9-4 10M80 38h22c10 0 11-11 3-11-6 0-8 6-4 8M24 95h55c16 0 25-7 23-16"/>
   <path d="M43 91C24 66 61 23 94 21c-5 29-13 53-30 62-8 5-15 1-21 8Z" fill={`url(#${id}-jade)`} stroke="#427f72" strokeWidth="1.4"/>
   <path d="M34 105Q53 67 88 30" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2.8" strokeLinecap="round"/>
   <g fill="none" stroke="#effff1" strokeWidth="1.5" opacity=".85"><path d="m48 80-3-20m12 7-1-22m11 11 2-22m-7 27 19-1m-26 14 17-1m4-28 12-1"/></g>
   <path d="m31 44 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill={`url(#${id}-gold)`}/>
  </>:kind==='jade'?<>
   <path d="M47 38Q43 14 64 18q21-4 17 20M64 18v20" fill="none" stroke="#ac6946" strokeWidth="2"/>
   <path d="m64 19 6 7-6 7-6-7Z" fill={`url(#${id}-gold)`} stroke="#a97937"/>
   <ellipse cx="49" cy="61" rx="22" ry="27" fill="none" stroke="#27624f" strokeWidth="12" transform="rotate(-18 49 61)"/>
   <ellipse cx="49" cy="61" rx="22" ry="27" fill="none" stroke={`url(#${id}-jade)`} strokeWidth="9" transform="rotate(-18 49 61)"/>
   <ellipse cx="78" cy="62" rx="22" ry="27" fill="none" stroke="#27624f" strokeWidth="12" transform="rotate(18 78 62)"/>
   <ellipse cx="78" cy="62" rx="22" ry="27" fill="none" stroke={`url(#${id}-jade)`} strokeWidth="9" transform="rotate(18 78 62)"/>
   <path d="M33 49q1-10 9-12m38 1q12 3 15 14" fill="none" stroke="#e5ffec" strokeWidth="2" strokeLinecap="round"/>
   <g stroke="#a45040" strokeWidth="1.8" fill="none"><path d="m49 87-5 24m5-20 1 22m0-22 5 20M78 88l-5 24m6-23 1 24m-1-23 6 21"/></g>
   <g fill={`url(#${id}-gold)`}><rect x="43" y="87" width="12" height="6" rx="2"/><rect x="73" y="88" width="12" height="6" rx="2"/></g>
  </>:kind==='scroll'?<>
   <path d="M35 29h58v72H35Z" fill={`url(#${id}-paper)`} stroke="#b68a42" strokeWidth="1.3"/>
   <path d="M40 36h48v57H40Z" fill="none" stroke="#c6a565" strokeWidth=".8"/>
   <g fill={`url(#${id}-gold)`} stroke="#966a32" strokeWidth="1"><rect x="28" y="22" width="72" height="10" rx="5"/><rect x="28" y="96" width="72" height="10" rx="5"/></g>
   <path d="M35 23v8m58-8v8M35 97v8m58-8v8" stroke="#fff0c3" strokeWidth="2"/>
   <path d="M49 85q0-19 17-29m-17 29q17-8 26-25m-26 25q-8-14-5-28" fill="none" stroke="#6b8160" strokeWidth="1.4"/>
   <path d="M64 58q-12-14-5-16 6-1 7 13 4-14 10-11 5 4-10 14 15-4 15 3-2 5-15-3Z" fill={`url(#${id}-gold)`} stroke="#aa823e" strokeWidth=".7"/>
   <rect x="73" y="77" width="10" height="12" rx="1" fill="#a04736"/><text x="78" y="86" fill="#fff1cd" fontSize="9" textAnchor="middle" fontFamily="serif">契</text>
   <path d="M64 22V13m-5 3q5-6 10 0" stroke="#a04736" fill="none" strokeWidth="2"/>
  </>:<>
   <rect x="32" y="48" width="64" height="49" rx="5" fill={`url(#${id}-paper)`} stroke="#a9854e" strokeWidth="2"/>
   <path d="M29 46h70v14H29Z" fill={`url(#${id}-gold)`}/><path d="M59 46h10v51H59Z" fill="#a24c3f"/>
   <path d="M63 46C33 43 38 20 52 29l12 16c23-28 36-6 1 1Z" fill="none" stroke="#a24c3f" strokeWidth="4"/>
  </>}
  <g className="gift-art-star"><path d="m102 93 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z"/></g>
 </svg>;
}

/** One short reveal per mounted receipt, paused when hidden; no timers, sound, requests or auto-acknowledgement. */
export function GiftReveal({name}:{name?:string}){
 const ref=useRef<HTMLDivElement>(null),moving=useVisibleAvatarMotion(ref,true),kind=giftArtKind(name);
 return <div ref={ref} className={`gift-reveal gift-reveal-${kind}`} data-motion={moving?'running':'paused'} aria-hidden="true">
  <div className="gift-reveal-halo"/><div className="gift-reveal-ring"/><div className="gift-reveal-ring gift-reveal-ring-inner"/>
  <svg className="gift-reveal-wind" viewBox="0 0 320 180" focusable="false"><path d="M8 117c40-58 85 40 151-14s106-24 151-46M-8 128c75-42 93 21 166-2s107-27 171-65"/></svg>
  <div className="gift-reveal-object"><GiftArt name={name}/></div>
  <div className="gift-reveal-motes">{Array.from({length:8},(_,i)=><i key={i} style={{'--i':i,'--dx':`${Math.cos(i*Math.PI/4)*96}px`,'--dy':`${Math.sin(i*Math.PI/4)*65}px`} as CSSProperties}/>)}</div>
  <span className="gift-reveal-caption">{captions[kind]}</span><span className="gift-reveal-seal">缘</span>
 </div>;
}
