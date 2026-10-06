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
   <img className="aq-capy-hugger" src="/api/theme/aquarium/art?kind=capyhug" width={220} height={220} alt="" aria-hidden="true"/>
   <img className="aq-capy-paws" src="/api/theme/aquarium/art?kind=capypaws" width={220} height={73} alt="" aria-hidden="true"/>
  </div>
  <div className="aq-companion-lane">
   <div className="aq-loopy-roam" aria-hidden="true"><span className="aq-loopy-gait"/></div>
   <img className="aq-swimming-friend" src="/api/theme/aquarium/art?kind=mascot" width={64} height={64} alt="" aria-hidden="true"/>
   <button type="button" className="aq-motion-toggle" onClick={toggle} aria-pressed={moving} aria-label={moving?'暂停动物动画':'播放动物动画'}>{moving?<Pause size={13}/>:<Play size={13}/>}<span>动物动效</span></button>
  </div>
 </section>;
}
