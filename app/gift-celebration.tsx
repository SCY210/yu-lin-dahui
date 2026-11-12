'use client';
import {useRef,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import GiftArt from './gift-art';
import {useVisibleAvatarMotion} from '../lib/client/visible-avatar-motion';
import './gift-celebration.css';

const bursts=[{x:22,y:28,delay:.35},{x:78,y:24,delay:.85},{x:50,y:70,delay:1.35},{x:16,y:66,delay:1.9},{x:84,y:62,delay:2.3}];
const sparks=14,petals=36;

/** Full-screen celebration when a member opens the app to unacknowledged gifts (docs/BONDS.md): a golden flash, turning
 * light rays, firework bursts and falling petals around the first gift, about 4.5 seconds, once per batch. It never
 * blocks taps, sends nothing and is skipped entirely when the system asks for reduced motion. */
export default function GiftCelebration({item,from,count}:{item?:string;from:string;count:number}){
 const ref=useRef<HTMLDivElement>(null),moving=useVisibleAvatarMotion(ref,true);
 if(typeof document==='undefined')return null;
 return createPortal(<div ref={ref} className="gift-fx" data-motion={moving?'running':'paused'} aria-hidden="true">
  <div className="gift-fx-veil"/>
  <div className="gift-fx-rays"/>
  <div className="gift-fx-flash"/>
  {bursts.map((b,n)=><div key={n} className={'gift-fx-burst gift-fx-burst-'+(n%3)} style={{left:b.x+'%',top:b.y+'%','--delay':b.delay+'s'} as CSSProperties}>
   {Array.from({length:sparks},(_,i)=>{const angle=i/sparks*Math.PI*2,reach=70+(i%3)*22;return <i key={i} style={{'--dx':(Math.cos(angle)*reach).toFixed(1)+'px','--dy':(Math.sin(angle)*reach).toFixed(1)+'px'} as CSSProperties}/>})}
  </div>)}
  <div className="gift-fx-rain">{Array.from({length:petals},(_,i)=><i key={i} className={'gift-fx-petal-'+(i%3)} style={{left:((i*37+11)%100)+'%','--delay':((i%9)*.22).toFixed(2)+'s','--fall':(2.6+((i*13)%10)/10).toFixed(1)+'s','--drift':(((i*29)%9)-4)*14+'px','--spin':(i%2?1:-1)*(240+(i*47)%300)+'deg'} as CSSProperties}/>)}</div>
  <div className="gift-fx-center">
   <div className="gift-fx-halo"/><div className="gift-fx-ring"/><div className="gift-fx-ring gift-fx-ring-outer"/>
   <div className="gift-fx-art"><GiftArt name={item}/></div>
  </div>
  <div className="gift-fx-title"><strong>天降仙缘</strong><span>{from} 赠你{item?' '+item:'一份礼物'}{count>1?' 等 '+count+' 份礼物':''}</span></div>
 </div>,document.body);
}
