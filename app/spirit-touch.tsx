'use client';
import {useEffect} from 'react';

const sparks=6,life=800;

/** 点按灵气 (docs/XIUXIAN_FX.md): in the 水墨江湖 theme, each tap or click blooms a ring of spirit light with a few
 * golden sparks at the pointer. Decoration only: the layer never takes pointer events, holds at most a handful of
 * short-lived nodes, and does nothing in the classic theme or when the system asks for reduced motion. */
export default function SpiritTouch(){
 useEffect(()=>{
  const still=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let layer:HTMLDivElement|null=null;
  const down=(event:PointerEvent)=>{
   if(!document.documentElement.classList.contains('wuxia-theme')||still?.matches||!event.isPrimary)return;
   if(!layer){layer=document.createElement('div');layer.className='xx-touch-layer';layer.setAttribute('aria-hidden','true');document.body.appendChild(layer)}
   if(layer.childElementCount>8)return;
   const bloom=document.createElement('div');bloom.className='xx-touch';bloom.style.left=event.clientX+'px';bloom.style.top=event.clientY+'px';
   for(let i=0;i<sparks;i++){
    const spark=document.createElement('i'),angle=i/sparks*Math.PI*2+Math.random()*.6,reach=22+Math.random()*16;
    spark.style.setProperty('--dx',(Math.cos(angle)*reach).toFixed(1)+'px');spark.style.setProperty('--dy',(Math.sin(angle)*reach).toFixed(1)+'px');
    bloom.appendChild(spark);
   }
   layer.appendChild(bloom);window.setTimeout(()=>bloom.remove(),life);
  };
  window.addEventListener('pointerdown',down,{passive:true,capture:true});
  return ()=>{window.removeEventListener('pointerdown',down,{capture:true});layer?.remove()};
 },[]);
 return null;
}
