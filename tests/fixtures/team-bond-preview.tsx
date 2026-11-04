'use client';
import {useState} from 'react';
import MatchCard,{type CardContext} from '../../app/match-card';
import TeamBond from '../../app/team-bond';
import {fixtureData} from './treasure-shop-preview';
import type {Match} from '../../lib/domain/types';
import '../../app/event-scheduling.css';
import '../../app/event-live-play.css';

/** Fictional display-only fixture, no requests or writes. */
export default function TeamBondPreview(){
 const [complete,setComplete]=useState(false),[swapped,setSwapped]=useState(false),data=fixtureData('member');const [now]=useState(()=>Date.now());
 data.players=Array.from({length:8},(_,i)=>({...data.players[0],id:'p'+i,name:['虚构清风客','虚构长风剑客','虚构山月','虚构听雨','虚构云中鹤','虚构竹间客','虚构星河','虚构江南'][i]}));
 data.events=[{id:'e',creatorId:'fixture-owner',title:'虚构双打',start:now-3600000,end:now+3600000,status:'live',matchFormat:'doubles',schedulingMode:'live',ranked:true,venue:'虚构球馆',address:'',capacity:8,signupDeadline:now,cancelDeadline:now,note:'',courtMode:'equal',ballMode:'equal',canViewCourtOccupancy:false,mapUrl:''}];
 data.bookings=[0,1].map(i=>({id:'c'+i,eventId:'e',name:(i+1)+'号场',start:now-3600000,end:now+3600000,pricing:'total',cents:0,mapUrl:''}));
 const matches:Match[]=[0,1].map(i=>({id:'m'+i,eventId:'e',roundId:'r'+i,courtId:'c'+i,a:['p'+i*4,'p'+(i*4+1)],b:['p'+(i*4+2),'p'+(i*4+3)],status:complete?'complete':'playing',start:now-1000,end:complete?now:null,scoreA:complete?21:null,scoreB:complete?17:null,monthly:true,elo:true,locked:false,enteredBy:null,games:complete?[{a:21,b:17}]:[]}));
 data.matches=matches;data.matchBondTiers={m0:{a:{players:['p0','p1'],tier:10},b:{players:['p2','p3'],tier:7}},m1:{a:{players:['p4','p5'],tier:0},b:{players:['p6','p7'],tier:3}}};
 if(swapped)matches[0].a=['p0','p4'];
 const ctx:CardContext={data,name:id=>data.players.find(p=>p.id===id)?.name??id,admin:false,readOnly:true,send(){},open(){},setDanger(){}};
 return <main className="shell"><h1>同队道缘</h1><p className="hint">虚构对局效果预览</p><div className="actions"><button className="secondary" onClick={()=>setComplete(v=>!v)}>{complete?'显示进行中':'显示已完成'}</button><button className="secondary" onClick={()=>setSwapped(v=>!v)}>{swapped?'恢复搭档':'模拟换人'}</button></div><div className="event-scheduling"><div className="courts-grid">{matches.map(m=><MatchCard key={m.id} m={m} ctx={ctx}/>)}</div></div><h2>十一阶道缘徽章</h2><div className="bond-preview-gallery" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(108px,1fr))',gap:10}}>{Array.from({length:11},(_,tier)=><TeamBond key={tier} players={['a','b']} bond={{players:['a','b'],tier}}/>)}</div></main>;
}
