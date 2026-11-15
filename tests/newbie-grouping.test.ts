import {test} from 'node:test';
import assert from 'node:assert/strict';
import {propose} from '../lib/domain/grouping';
import {fillLiveCourts} from '../lib/domain/live-play';
import {NEWBIE_BELOW,newbieExposure} from '../lib/domain/match-balance';
import {emptyState,type Event,type Player} from '../lib/domain/types';

const start=Date.parse('2026-10-07T12:00:00Z');
/** A doubles evening on `courts` courts with fictional players of the given ratings and genders. */
function evening(players:[string,number,('male'|'female')?][],courts:number){
 const s=emptyState();
 const e:Event={id:'event',title:'萌新排场',start,end:start+3*3600000,venue:'测试球馆',address:'',capacity:16,signupDeadline:start,cancelDeadline:start,note:'',status:'live',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);s.accounts.push({id:'admin',email:'',playerId:players[0][0],role:'admin'});
 for(const [i,[id,rating,gender]] of players.entries()){
  const profile:NonNullable<Player['profile']>={years:2,hand:'right',preference:'doubles',style:'',equipment:'',gender:gender??'male'};
  s.players.push({id,name:id,ownerId:'admin',rating,initialRating:rating,ratedGames:20,enabled:true,ratingReason:'现场评估',profile});
  s.registrations.push({id:'reg-'+id,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 }
 for(let i=0;i<courts;i++)s.bookings.push({id:'court-'+i,eventId:e.id,name:String(i),start,end:e.end,pricing:'hourly',cents:1000});
 return {s,e};
}
const rating=new Map<string,number>();
const strongest=(m:{a:string[];b:string[]})=>Math.max(...[...m.a,...m.b].map(id=>rating.get(id)!));

test('萌新 cost: below 850 is a 萌新; every stronger player in the game costs more the stronger they are; women’s doubles half',()=>{
 const r=(id:string)=>({n:700,m:820,l:900,h:1500,w:1200}[id[0]]??1000);
 assert.equal(NEWBIE_BELOW,850);
 assert.equal(newbieExposure(['l1','l2','h1','h2'],r),0,'no 萌新, no cost');
 assert.ok(newbieExposure(['n1','l1','l2','l3'],r)<newbieExposure(['n1','l1','l2','h1'],r),'a stronger player costs more');
 assert.ok(newbieExposure(['n1','m1','l1','l2'],r)>0,'炼气 members are 萌新 too');
 assert.equal(newbieExposure(['n1','w1','w2','w3'],r,()=>true),newbieExposure(['n1','w1','w2','w3'],r)/2,'women’s doubles cost half');
});

test('the planned schedule puts 萌新 with the lower-rated players and lets the strong play each other',()=>{
 const players:[string,number][]=[['H1',1520],['H2',1480],['H3',1500],['H4',1460],['L1',900],['L2',920],['N1',700],['N2',720]];
 for(const [id,r] of players)rating.set(id,r);
 for(const seed of [1,2,3,4,5]){
  const {s,e}=evening(players,2),round=propose(s,e,start,15,seed);
  assert.equal(round.courts.length,2);
  const newbies=round.courts.find(c=>[...c.a,...c.b].includes('N1'))!;
  assert.ok([...newbies.a,...newbies.b].includes('N2'),'seed '+seed+': both 萌新 on one court');
  assert.ok(strongest(newbies)<1000,'seed '+seed+': no strong player with the 萌新');
 }
});

test('live play keeps 萌新 away from the strong when someone as due can take the place (one court at a time)',()=>{
 // Signed up interleaved, so the queue's first four would put a 萌新 with two strong players. Everyone is as due at the
 // start, so 开始组队 may swap them; the game it starts has no 萌新 facing the strong. Courts that start at the same time
 // are chosen one after another, and the last can be left with what remains (AGENTS.md E1).
 const players:[string,number][]=[['N1',700],['H1',1520],['L1',900],['H2',1480],['N2',720],['H3',1500],['L2',920],['H4',1460]];
 for(const [id,r] of players)rating.set(id,r);
 const {s,e}=evening(players,1);e.schedulingMode='live';e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
 const [game]=fillLiveCourts(s,e,start+60000,{courtId:'court-0'});
 const ids=[...game.a,...game.b],r=(id:string)=>rating.get(id)!;
 assert.equal(newbieExposure(ids,r),0,JSON.stringify(ids));
});
