'use client';
import {useId,useRef,type ReactNode} from 'react';
import {bondTiers,type MatchBondSide} from '../lib/domain/bond-tiers';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import './team-bond.css';

/** Eleven original emblems, from a first leaf to the lotus constellation; decorative, never combat bonuses. */
const symbols:ReactNode[]=[
 <path key="leaf" d="M22 38Q18 19 43 17Q44 40 22 38Zm0 0 15-15"/>,
 <g key="sprouts"><path d="M31 42V29M31 33Q17 33 18 20Q31 20 31 33ZM31 29Q31 16 45 17Q44 30 31 29Z"/></g>,
 <g key="rings"><circle cx="26" cy="30" r="10"/><circle cx="38" cy="30" r="10"/><path d="m23 42 9 5 9-5"/></g>,
 <g key="moon"><path d="M34 16a16 16 0 1 0 15 23A17 17 0 0 1 34 16Z"/><path d="m41 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/></g>,
 <g key="shelter"><path d="M14 29Q32 7 50 29H14Zm18-13v28q0 7-7 2M20 35l-3 6m26-6 3 6"/><path d="M24 29q0-9 8-13 8 4 8 13"/></g>,
 <g key="knots"><path d="M32 17 47 32 32 47 17 32 32 17Zm0 8 7 7-7 7-7-7 7-7Z"/><path d="M22 21q-12-8-10 4 1 6 10 7m20-11q12-8 10 4-1 6-10 7"/></g>,
 <g key="resonance"><path d="m32 14 5 12 13 6-13 5-5 13-5-13-13-5 13-6Z"/><circle cx="32" cy="32" r="5"/><path d="M15 17l4 4m26-4-4 4m-26 26 4-4m26 4-4-4"/></g>,
 <g key="swords"><path d="m19 14 22 24-4 4-22-24 4-4Zm26 0 4 4-22 24-4-4 22-24ZM19 34l12 12m2-12 12 12M24 41l-8 9m24-9 8 9"/></g>,
 <g key="wings"><path d="M32 44Q8 39 13 17q4 13 14 9l5 18Zm0 0q24-5 19-27-4 13-14 9l-5 18Z"/><path d="m17 28 10 7m20-7-10 7m-5-12 4-6-4-6-4 6 4 6Z"/></g>,
 <g key="diamond"><path d="M19 20h26l7 10-20 20-20-20 7-10Zm-7 10h40M25 20l-4 10 11 20 11-20-4-10M21 30h22"/></g>,
 <g key="lotus"><path d="M32 46Q18 32 32 14q14 18 0 32ZM32 46Q13 42 13 23q19 2 19 23Zm0 0q19-4 19-23-19 2-19 23Z"/><path d="M16 47q16 8 32 0M19 13l3 2m20 0 3-2M32 8v2"/></g>,
];

export function BondEmblem({tier}:{tier:number}){
 const id='bond-emblem-'+useId().replace(/:/g,'');
 return <svg viewBox="0 0 64 64" className={'bond-emblem bond-emblem-'+tier} aria-hidden="true" focusable="false">
  <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff3cd"/><stop offset=".5" stopColor="var(--tb-pigment)"/><stop offset="1" stopColor="var(--tb-deep)"/></linearGradient></defs>
  {tier>=7&&<path className="tb-crown" d="m12 18-4-8 13 5L32 5l11 10 13-5-4 8M17 49l-5 7 14-3m21-4 5 7-14-3"/>}
  <path className="tb-shield" d="M32 8 53 18v17c0 12-14 20-21 23-7-3-21-11-21-23V18Z"/>
  <path className="tb-rim" d="M32 12 49 20v15c0 9-10 16-17 19-7-3-17-10-17-19V20Z"/>
  <g className="tb-symbol" stroke={`url(#${id})`}>{symbols[tier]}</g>
  <circle className="tb-gem" cx="32" cy="55" r={tier>=8?2.6:1.8}/>
 </svg>;
}

/** A cached tier is valid only for the currently displayed teammates, including after a local lineup swap. */
export default function TeamBond({players,bond,active=false}:{players:string[];bond?:MatchBondSide|null;active?:boolean}){
 const ref=useRef<HTMLDivElement>(null);
 const valid=!!bond&&players.length===2&&new Set(players).size===2&&Array.isArray(bond.players)&&bond.players.length===2&&new Set(bond.players).size===2&&players.every(id=>bond.players.includes(id))&&Number.isInteger(bond.tier)&&bond.tier>=0&&bond.tier<bondTiers.length;
 const tier=valid?bond.tier:0,moving=useVisibleAvatarMotion(ref,valid&&active&&tier>=4);
 if(!valid)return null;
 const name=bondTiers[tier].name;
 return <div ref={ref} className={'team-bond team-bond-'+tier} data-moving={moving?'true':'false'} data-active={active?'true':'false'} role="img" aria-label={`搭档道缘：${name}，第 ${tier+1} 阶`} title={`两位队友的当前道缘 · ${name} · 第 ${tier+1} 阶`}>
  <span className="tb-link" aria-hidden="true"/><span className="tb-emblem-wrap"><span className="tb-orbit" aria-hidden="true"/><BondEmblem tier={tier}/></span>
  <span className="tb-label"><span className="tb-name">{name}</span><span className="tb-level">Lv.{tier+1}</span></span>
 </div>;
}
