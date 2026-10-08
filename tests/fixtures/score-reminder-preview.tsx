'use client';
import {useState} from 'react';
import ScoreReminder from '../../app/score-reminder';
import {emptyState,type Match,type Event,type Round,type Registration} from '../../lib/domain/types';
function fixture(teamSide='a'){
 const s=emptyState(),now=Date.now(),me={id:'fixture-account',email:'',role:'member' as const,playerId:teamSide==='b'?'opponent-a':'self'};
 for(const [i,id]of ['self','partner','opponent-a','opponent-b'].entries())s.players.push({id,name:['虚构球友甲（我）','虚构搭档乙','虚构对手丙','虚构对手丁'][i],ownerId:'fixture',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 const e:Event={id:'fixture-event',title:'虚构赛后录分验收',creatorId:'fixture-host',start:now-3600000,end:now+3600000,venue:'虚构球馆',address:'',capacity:4,signupDeadline:now,cancelDeadline:now,note:'',status:'live',courtMode:'equal',ballMode:'equal'};
 const r:Round={id:'fixture-round',eventId:e.id,start:now-20*60000,duration:15,status:'playing',eligible:['self','partner','opponent-a','opponent-b'],rest:[],seed:1,live:true};
 const m:Match={id:'fixture-match',eventId:e.id,roundId:r.id,courtId:'fixture-court',a:['self','partner'],b:['opponent-a','opponent-b'],status:'playing',start:r.start,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]};
 const registration:Registration={id:'fixture-signup',eventId:e.id,playerId:me.playerId,sequence:1,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}};
 s.events.push(e);s.rounds.push(r);s.matches.push(m);s.registrations.push(registration);s.bookings.push({id:'fixture-court',eventId:e.id,name:'1号场',start:e.start,end:e.end,pricing:'total',cents:0});return {...s,me};
}
export default function Preview({blocked=false,teamSide='a'}:{blocked?:boolean;teamSide?:'a'|'b'}){
 const [data,setData]=useState(()=>fixture(teamSide)),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 const ctx={data,busy,name:(id:string)=>data.players.find(p=>p.id===id)?.name??id,refresh:async()=>data,action:async(action:string,payload:{matchId:string;games:{a:number;b:number}[]})=>{
  if(action!=='score')throw Error('Fixture accepts scores only');setBusy(true);const next=structuredClone(data),m=next.matches.find(m=>m.id===payload.matchId)!;m.status='complete';m.games=payload.games;m.scoreA=payload.games[0].a;m.scoreB=payload.games[0].b;m.end=Date.now();next.rounds[0].status='complete';
  next.rounds.push({...next.rounds[0],id:'next-round',status:'playing',start:Date.now()});next.matches.push({...m,id:'next-match',roundId:'next-round',status:'playing',start:Date.now(),end:null,games:[],scoreA:null,scoreB:null});setData(next);setSaved(true);setBusy(false);
 }};
 return <main className="shell app-compact"><h1>赛后录分 · 本地虚构验收</h1><ScoreReminder ctx={ctx} blocked={blocked}/>{saved&&<p role="status">虚构结果已保存：{data.matches[0].scoreA}:{data.matches[0].scoreB}，下一局不会立即弹出录分。</p>}<p>此页面仅用于本地交互验证，不访问或写入线上比赛。</p></main>;
}
