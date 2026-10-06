'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Pause,Play} from 'lucide-react';

export default function AquariumWelcome({name,children}:{name:string;children:ReactNode}){
 const [moving,setMoving]=useState(true);
 useEffect(()=>{try{setMoving(localStorage.getItem('yulin-aquarium-motion')!=='paused')}catch{}},[]);
 function toggle(){setMoving(value=>{const next=!value;try{localStorage.setItem('yulin-aquarium-motion',next?'playing':'paused')}catch{}return next})}
 return <section className={'aquarium-welcome'+(moving?'':' animals-paused')} aria-label="粉粉水族馆欢迎卡片">
  <div className="aq-card-stage">
   <div className="aq-welcome-note">
    <div className="aq-greeting"><p className="aq-kicker">粉粉水族馆</p><p className="aq-hello">{name}，</p><h1>今天也闪闪发光</h1></div>
    <div className="aq-welcome-actions">{children}</div>
   </div>
   <div className="aq-capy-companion" aria-hidden="true">
    <svg className="aq-capy-heart" viewBox="0 0 120 110" width={120} height={110} focusable="false">
     <defs><linearGradient id="aq-heart-pink" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffb6d2"/><stop offset=".55" stopColor="#ef78aa"/><stop offset="1" stopColor="#cf4682"/></linearGradient></defs>
     <path d="M60 103C49 94 7 65 7 35C7 9 41 1 60 25C79 1 113 9 113 35C113 65 71 94 60 103Z" fill="url(#aq-heart-pink)" stroke="#e16e9f" strokeWidth="2"/>
     <path d="M20 33C20 20 36 15 46 22" fill="none" stroke="#fff4fa" strokeWidth="6" strokeLinecap="round" opacity=".8"/>
    </svg>
    <img className="aq-capy-hugger" src="/api/theme/aquarium/art?kind=capyhug" width={220} height={220} alt=""/>
    <img className="aq-capy-paws" src="/api/theme/aquarium/art?kind=capypaws" width={220} height={73} alt=""/>
   </div>
  </div>
  <div className="aq-companion-lane">
   <div className="aq-loopy-roam" aria-hidden="true"><span className="aq-loopy-gait"/></div>
   <img className="aq-swimming-friend" src="/api/theme/aquarium/art?kind=mascot" width={64} height={64} alt="" aria-hidden="true"/>
   <button type="button" className="aq-motion-toggle" onClick={toggle} aria-pressed={moving} aria-label={moving?'暂停动物动画':'播放动物动画'}>{moving?<Pause size={13}/>:<Play size={13}/>}<span>动物动效</span></button>
  </div>
 </section>;
}
