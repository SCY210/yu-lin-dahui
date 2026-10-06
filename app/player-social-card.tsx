'use client';
import {useEffect,useRef,useState,type ReactNode,type PointerEvent} from 'react';
import {ArrowUpRight,RotateCcw,RotateCw} from 'lucide-react';
import {tensionLabel} from '../lib/domain/tension';
import './player-social-card.css';

function RacketMark({large=false}:{large?:boolean}){
 return <svg viewBox="0 0 100 160" className={large?'pc-racket-mark pc-racket-mark--large':'pc-racket-mark'} aria-hidden="true" fill="none"><ellipse cx="49" cy="48" rx="32" ry="42" stroke="currentColor" strokeWidth="3"/><ellipse cx="49" cy="48" rx="27" ry="37" stroke="currentColor" strokeWidth=".8"/>{[29,39,49,59,69].map(x=><path key={x} d={`M${x} 15v65`} stroke="currentColor" strokeWidth=".6" opacity=".4"/>)}{[25,36,47,58,69].map(y=><path key={y} d={`M23 ${y}h52`} stroke="currentColor" strokeWidth=".6" opacity=".4"/>)}<path d="m33 85 13 21v32m20-53-14 21v32M45 136h9v20h-9z" stroke="currentColor" strokeWidth="2"/><path d="m46 139 7 3-7 3 7 3-7 3" stroke="currentColor" strokeWidth="1"/></svg>;
}

export default function PlayerSocialCard({player,stats,monthly,photo,avatar,self,onProfile}:{player:any;stats:any;monthly:any;photo:any;avatar:ReactNode;self:boolean;onProfile:()=>void}){
 const [flipped,setFlipped]=useState(false),[failedPhoto,setFailedPhoto]=useState<string|null>(null);
 const tilt=useRef<HTMLDivElement>(null),front=useRef<HTMLButtonElement>(null),back=useRef<HTMLDivElement>(null);
 const [turn,setTurn]=useState<'out'|'in'|null>(null);
 const turning=useRef(false),target=useRef(false),restoreFocus=useRef(false);
 useEffect(()=>{
  if(!turn)return;
  const timer=setTimeout(()=>{if(turn==='out'){setFlipped(target.current);setTurn('in')}else{turning.current=false;setTurn(null)}},180);
  return()=>clearTimeout(timer);
 },[turn]);
 useEffect(()=>{
  if(turn||!restoreFocus.current)return;restoreFocus.current=false;
  const control=flipped?back.current:front.current;
  if(control&&!control.closest('[inert]'))control.focus({preventScroll:true});
 },[flipped,turn]);
 function flip(next:boolean){
  if(turning.current||next===flipped)return;reset();target.current=next;restoreFocus.current=true;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setFlipped(next);return}
  turning.current=true;setTurn('out');
 }
 const profile=player.profile??{},motto=profile.motto?.trim();
 function move(event:PointerEvent<HTMLDivElement>){
  if(event.pointerType!=='mouse'||!window.matchMedia('(min-width:761px) and (hover:hover) and (pointer:fine)').matches||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const box=event.currentTarget.getBoundingClientRect(),x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
  tilt.current?.style.setProperty('--pc-rx',`${(0.5-y)*9}deg`);tilt.current?.style.setProperty('--pc-ry',`${(x-0.5)*11}deg`);
  tilt.current?.style.setProperty('--pc-glow-x',`${x*100}%`);tilt.current?.style.setProperty('--pc-glow-y',`${y*100}%`);
 }
 function reset(){tilt.current?.style.setProperty('--pc-rx','0deg');tilt.current?.style.setProperty('--pc-ry','0deg')}
 return <article className={'pc-scene'+(flipped?' pc-scene--flipped':'')+(turn?' pc-scene--turn-'+turn:'')} aria-busy={!!turn} aria-label={player.name+'的球友卡片'} onPointerMove={move} onPointerLeave={reset}>
  <div className="pc-tilt" ref={tilt}><div className="pc-rotor">
   <div className="pc-face pc-front" hidden={flipped} aria-hidden={flipped} inert={flipped}>
    <button type="button" ref={front} className="pc-front-trigger" aria-label={'翻转'+player.name+'的卡片，查看战拍'} aria-expanded={flipped} onClick={()=>{flip(true)}}>
     <span className="pc-heading"><span>羽林同修</span><span>{self?'我的名帖':'球友名帖'}</span></span>
     <span className="pc-portrait">{avatar}</span>
     <strong className="pc-player-name" title={player.name}>{player.name}</strong>
     <span className="pc-realm">{stats?.tier||'暂无境界'}<span>{stats?.provisional?' · 暂定':''}</span></span>
     <span className={'pc-motto'+(!motto?' pc-unfilled':'')} title={motto}>{motto?<><span aria-hidden="true">“</span>{motto}<span aria-hidden="true">”</span></>:'尚未填写个人口号'}</span>
     <span className="pc-front-racket"><RacketMark/><span><span>本命战拍</span><strong title={profile.racket}>{profile.racket||'战拍待填写'}</strong></span></span>
     <span className="pc-stats"><span><b>{stats?.games??0}</b><span>累计小局</span></span><span><b>{stats?.games?Math.round(stats.rate*100)+'%':'—'}</b><span>胜率</span></span><span><b>{monthly?.points??0}</b><span>本月积分</span></span></span>
    </button>
    <div className="pc-controls"><button type="button" onClick={onProfile}>查看档案<ArrowUpRight size={14} aria-hidden="true"/></button><button type="button" onClick={()=>{flip(true)}} aria-label={'翻转'+player.name+'的卡片'}><RotateCw size={14} aria-hidden="true"/>翻面</button></div>
   </div>
   <div ref={back} className="pc-face pc-back" hidden={!flipped} role="group" tabIndex={flipped?0:-1} aria-label={player.name+'的战拍卡片，轻点翻回正面'} aria-hidden={!flipped} inert={!flipped} onClick={event=>{if((event.target as HTMLElement).closest('button,a'))return;flip(false)}} onKeyDown={event=>{if(event.target===event.currentTarget&&['Enter',' '].includes(event.key)){event.preventDefault();flip(false)}}}>
    <div className="pc-back-heading"><span>本命战拍</span><span className="pc-back-hint"><RotateCcw size={13} aria-hidden="true"/>轻点翻回</span></div>
    <strong className="pc-back-name">{player.name}</strong>
    <div className="pc-weapon-image">{photo&&failedPhoto!==photo.id?<img src={'/api/photos/'+photo.id} alt={player.name+'的战拍照片'} loading="lazy" onError={()=>setFailedPhoto(photo.id)}/>:<><RacketMark large/><span>{photo?'照片暂不可用':'尚未上传战拍照'}</span></>}</div>
    <strong className="pc-weapon-model" title={profile.racket}>{profile.racket||'战拍尚未填写'}</strong>
    <div className="pc-weapon-details"><span><span>拍线</span><strong title={profile.strings}>{profile.strings||'尚未填写'}</strong></span><span><span>磅数</span><strong>{tensionLabel(profile)||'尚未填写'}</strong></span></div>
    <p className={'pc-back-motto'+(!motto?' pc-unfilled':'')} title={motto}>{motto?'“'+motto+'”':'尚未填写个人口号'}</p>
    <button type="button" className="pc-back-profile" onClick={onProfile}>走进{self?'我的':'这位球友的'}档案<ArrowUpRight size={15} aria-hidden="true"/></button>
   </div>
  </div></div>
 </article>;
}
