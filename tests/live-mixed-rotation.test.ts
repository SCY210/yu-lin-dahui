import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fillLiveCourts} from '../lib/domain/live-play';
import {matchHistory} from '../lib/domain/match-history';
import {balanceCost,compareLiveDoublesBalance} from '../lib/domain/match-balance';
import {genderMismatches} from '../lib/domain/gender-balance';
import {propose} from '../lib/domain/grouping';
import {createSimulation} from './helpers/scheduling-fixture';
import type {Match,Player} from '../lib/domain/types';

const now=Date.parse('2030-10-10T16:00:00Z');
type Spec=[number,'male'|'female'];
const closeSplits:Spec[]=[[1450,'male'],[1200,'female'],[1430,'male'],[1220,'male']];
function fixture(specs:Spec[]=[[1800,'male'],[1000,'female'],[1400,'male'],[1400,'male']],courts=1){
 const {state:s}=createSimulation(now),e=s.events[0];
 s.players=s.players.slice(0,specs.length);s.accounts=s.accounts.slice(0,specs.length);s.registrations=s.registrations.slice(0,specs.length);s.bookings=s.bookings.slice(0,courts);
 e.start=now-3600000;s.bookings.forEach(b=>b.start=e.start);s.registrations.forEach(r=>{r.arrival=e.start;r.registeredAt=e.start});
 s.players.forEach((p,i)=>{p.rating=specs[i][0];p.profile={years:2,hand:'right',preference:'doubles',style:'',equipment:'',gender:specs[i][1]}});
 e.livePlay={enabled:true,paused:false,preferences:[],completions:[],rest:[]};
 return {s,e,ids:s.players.map(p=>p.id)};
}
function past(f:ReturnType<typeof fixture>,a:string[],b:string[],at=now-60000):Match{
 const m:Match={id:'past-'+f.s.matches.length,eventId:f.e.id,roundId:'round-'+f.s.matches.length,courtId:f.s.bookings[0].id,a,b,status:'complete',start:at,end:at+1000,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:null,games:[{a:21,b:19}]};
 f.s.matches.push(m);return m;
}
const female=(players:Player[])=>(id:string)=>{const p=players.find(p=>p.id===id);return (p?.profile?.gender??p?.guestGender)==='female'};
const mixedMan=(f:ReturnType<typeof fixture>,m:Pick<Match,'a'|'b'>)=>{
 const woman=female(f.s.players),team=[m.a,m.b].find(t=>t.filter(woman).length===1);
 return team?.find(id=>!woman(id));
};
const next=(f:ReturnType<typeof fixture>,at=now)=>fillLiveCourts(f.s,f.e,at,{courtId:f.s.bookings[0].id})[0];

test('实时排场保留首次的修为平衡，允许混双对男双及连续两次同一角色',()=>{
 for(const previous of [0,1]){
  const f=fixture(),[a,b,c,d]=f.ids;
  if(previous)past(f,[a,b],[c,d]);
  const m=next(f);assert.ok(m);assert.equal(mixedMan(f,m),a);
 }
});

test('两种分法都在 40 分以内，第三次个人上场优先轮换混双男生',()=>{
 const f=fixture(closeSplits),[a,b,c,d]=f.ids;
 past(f,[a,b],[c,d],now-120000);past(f,[b,a],[d,c]);
 const m=next(f);assert.ok(m);assert.equal(mixedMan(f,m),c);
 assert.deepEqual(new Set([...m.a,...m.b]),new Set(f.ids));
 assert.equal(genderMismatches(f.s,m.a,m.b,id=>f.s.players.find(p=>p.id===id)!.rating),0);
});

test('两种同类阵容的分差都接近时，轮换一直和低修为女生搭档的男生',()=>{
 const f=fixture([[1250,'male'],[1070,'female'],[1210,'male'],[1080,'female']]),[a,b,c,d]=f.ids;
 past(f,[a,b],[c,d],now-120000);past(f,[a,b],[c,d]);
 const m=next(f);
 assert.ok(m);
 const teams=[m.a,m.b];
 assert.ok(teams.every(t=>t.filter(female(f.s.players)).length===1));
 assert.ok(teams.some(t=>t.includes(a)&&t.includes(d)));
});

test('更换女生也会累积高低修为搭档记录，性别保护、分差和同类对阵仍优先',()=>{
 const f=fixture(closeSplits),[a,b,c,d]=f.ids;
 f.s.players.push({...f.s.players[1],id:'away',rating:1180});
 past(f,[a,'away'],['absent-x','absent-y'],now-180000);
 const rating=(id:string)=>f.s.players.find(p=>p.id===id)?.rating??1000;
 const history=matchHistory(f.s,f.e.id,true,female(f.s.players),rating);
 assert.equal(history.liveUnevenMixedPartners([a,b],[c,d]),1);
 assert.equal(history.liveUnevenMixedPartners([c,b],[a,d]),0);
 const m=next(f);assert.ok(m);assert.equal(mixedMan(f,m),c);
 const repeated={...balanceCost([20],0),liveUnevenMixedPartners:3};
 assert.ok(compareLiveDoublesBalance(repeated,balanceCost([10],0,1))<0);
 assert.ok(compareLiveDoublesBalance(repeated,balanceCost([45],0))<0);
 assert.ok(compareLiveDoublesBalance(repeated,{...balanceCost([10],0),liveTypeMismatch:1})<0);
});

test('轮换会把分差从 0 扩大到 400 时仍选均衡分法',()=>{
 const f=fixture(),[a,b,c,d]=f.ids;
 past(f,[a,b],[c,d],now-120000);past(f,[a,b],[c,d]);
 const m=next(f);assert.ok(m);assert.equal(mixedMan(f,m),a);
 assert.deepEqual(new Set([...m.a,...m.b]),new Set(f.ids));
});

test('有分差接近的替代分法时，连续十二局轮换混双男生',()=>{
 const f=fixture(closeSplits);let last:string|undefined,run=0;
 for(let i=0;i<12;i++){
  const m=next(f,now+i*60000);assert.ok(m);
  const man=mixedMan(f,m);assert.ok(man);run=man===last?run+1:1;last=man;
  assert.ok(run<=2,'第 '+(i+1)+' 局重复角色过多');
  m.status='complete';m.end=now+i*60000+1000;m.scoreA=21;m.scoreB=19;
 }
});

test('历史按个人最近上场连续计算，换搭档、对手、场地和中间轮休均不清零',()=>{
 const f=fixture([[1800,'male'],[1000,'female'],[1400,'male'],[1400,'male'],[1100,'female'],[1300,'male'],[1300,'male']]);
 const [a,b,c,d,w,x,y]=f.ids;
 past(f,[a,b],[c,d],now-240000);
 past(f,[x,c],[d,y],now-180000);
 const m=past(f,[x,y],[w,a],now-120000);m.courtId='other-court';
 past(f,[x,c],[d,y]);
 const history=matchHistory(f.s,f.e.id,true,female(f.s.players));
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),1);
 assert.equal(history.liveMixedRepeats([w,a],[y,x]),1);
 assert.equal(history.liveMixedRepeats([c,b],[a,d]),0);
 history.add({a:[a,c],b:[b,w]});
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),0,'男双或其他角色的一次上场结束此前连续记录');
 history.add({a:[a,b],b:[c,d]});
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),0,'重新开始连续计数');
});

test('草稿、取消、未开打、其他活动和缺席判负不会制造或清除连续记录',()=>{
 const f=fixture(),[a,b,c,d]=f.ids;
 past(f,[a,b],[c,d],now-240000);
 for(const status of ['draft','cancelled','published'] as const){const m=past(f,[a,b],[c,d],now-180000);m.status=status;if(status==='published')m.start=null}
 past(f,[a,b],[c,d],now-120000).eventId='other';
 const forfeited=past(f,[a,b],[c,d]);forfeited.status='forfeit';forfeited.noShow=[c];
 let history=matchHistory(f.s,f.e.id,true,female(f.s.players));
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),0,'只有一场有效历史');
 past(f,[a,b],[c,d],now-30000);
 const cancelled=past(f,[a,c],[b,d],now-10000);cancelled.status='cancelled';
 history=matchHistory(f.s,f.e.id,true,female(f.s.players));
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),1);
});

test('角色轮换不压过原来的女生保护，无法安全替换时仍正常开局',()=>{
 const f=fixture([[1800,'male'],[1000,'female'],[1400,'male'],[1100,'male']]),[a,b,c]=f.ids;
 past(f,[a,b],['absent-x','absent-y'],now-240000);past(f,[a,b],['absent-x','absent-y'],now-180000);
 past(f,[c,b],['absent-x','absent-y'],now-120000);past(f,[c,b],['absent-x','absent-y']);
 const m=next(f);assert.ok(m);assert.equal(mixedMan(f,m),a);
 assert.equal(genderMismatches(f.s,m.a,m.b,id=>f.s.players.find(p=>p.id===id)!.rating),0);
 const repeated=balanceCost([0],0,0,0,0,0,0,0,0,1);
 assert.ok(compareLiveDoublesBalance(repeated,balanceCost([0],0,1))<0);
 assert.ok(compareLiveDoublesBalance(balanceCost([Infinity],0),repeated)>0);
});

test('同轮次候选可改善轮换，但不会越过已等待多局且不可再跳过的球友',()=>{
 const f=fixture([...closeSplits,[1400,'female']]),[a,b,c,d,w]=f.ids;
 past(f,[a,b],['absent-x','absent-y'],now-180000);past(f,[a,b],['absent-x','absent-y'],now-120000);
 // The fifth player just finished on another court, while the four selected players have waited for three games.
 for(let i=0;i<3;i++){const m=past(f,[w,'absent-x'],['absent-y','absent-z'],now-60000+i*1000);m.courtId='another-court'}
 f.s.matches.forEach(m=>m.courtId='another-court');
 f.s.rounds.push({id:'passed',eventId:f.e.id,start:now-1000,duration:0,status:'complete',eligible:[...f.ids],rest:[a,b,c,d],seed:1,live:true,livePassed:[a,b,c,d]});
 const m=next(f);assert.ok(m);assert.deepEqual(new Set([...m.a,...m.b]),new Set([a,b,c,d]));
 assert.notEqual(mixedMan(f,m),a);
});

test('固定搭档不足其他整队时不拆队、不空场',()=>{
 const f=fixture(),[a,b,c,d]=f.ids;
 f.e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[[a,b],[c,d]]};
 past(f,[a,b],[c,d],now-120000);past(f,[a,b],[c,d]);
 const m=next(f);assert.ok(m);assert.deepEqual([m.a,m.b],[[a,b],[c,d]]);
});

test('固定搭档有同轮次替代整队时轮换，不拆开任何搭档',()=>{
 const f=fixture([[1450,'male'],[1200,'female'],[1310,'male'],[1340,'male'],[1300,'male'],[1300,'male']]);
 const [a,b,c,d,x,y]=f.ids,teams=[[a,b],[c,d],[x,y]];
 f.e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams};
 for(const at of [now-120000,now-60000])for(const team of teams){const m=past(f,team,['absent-x','absent-y'],at);m.courtId='another-court'}
 const m=next(f);assert.ok(m);assert.ok(![...m.a,...m.b].includes(a));
 assert.ok([m.a,m.b].every(team=>teams.some(t=>t.every(id=>team.includes(id)))));
});

for(const [category,counts] of [['男双',[0,1,0]],['混双',[1,0,1]],['女双',[2,1,2]]] as const){
 test(`分差接近且轮次相同时优先${category}对${category}`,()=>{
  const specs:Spec[]=counts.flatMap((women,team)=>Array.from({length:2},(_,i):Spec=>[1000+team*10,i<women?'female':'male']));
  const f=fixture(specs),[a,b,c,d,x,y]=f.ids;
  f.e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[[a,b],[c,d],[x,y]]};
  const m=next(f);assert.ok(m);
  assert.deepEqual(new Set([...m.a,...m.b]),new Set([a,b,x,y]));
  assert.ok([m.a,m.b].some(team=>team.includes(a)&&team.includes(b)));
 });
}

test('同类对阵分差明显更大时优先修为相近的混双对男双',()=>{
 const f=fixture([[1000,'male'],[1000,'male'],[1010,'male'],[1010,'female'],[1200,'male'],[1200,'male']]);
 const [a,b,c,d,x,y]=f.ids;
 f.e.pointsChoice={votes:[],votingOpen:false,selectedMode:'fixed',teams:[[a,b],[c,d],[x,y]]};
 const m=next(f);assert.ok(m);
 assert.deepEqual(new Set([...m.a,...m.b]),new Set([a,b,c,d]));
});

test('朋友按报名性别参与角色记录，混双对混双的一局会结束连续记录',()=>{
 const f=fixture([[1800,'male'],[1000,'female'],[1400,'male'],[1400,'male'],[1200,'female']]),[a,b,c,d,w]=f.ids;
 const guest=f.s.players[1];delete guest.profile;guest.guestGender='female';guest.guestEventId=f.e.id;
 past(f,[a,b],[c,d],now-120000);past(f,[a,b],[c,d]);
 const history=matchHistory(f.s,f.e.id,true,female(f.s.players));
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),1);
 history.add({a:[a,b],b:[c,w]});
 assert.equal(history.liveMixedRepeats([a,b],[c,d]),0);
});

test('分差接近时临时搭档概率不能取消已找到的角色轮换',()=>{
 const f=fixture(closeSplits),[a,b,c,d]=f.ids;
 f.s.settings.pairingOdds=[{eventId:f.e.id,defaults:[{players:[a],targets:[b],percent:100}],conditions:[]}];
 past(f,[a,b],[c,d],now-120000);past(f,[a,b],[c,d]);
 const m=next(f);assert.ok(m);assert.notEqual(mixedMan(f,m),a);
});

test('预排保持原有匹配机制，不启用实时角色限制',()=>{
 const f=fixture(),[a,b,c,d]=f.ids;
 past(f,[a,b],[c,d],now-120000);past(f,[a,b],[c,d]);
 const court=propose(f.s,f.e,now,15,1).courts[0];
 assert.equal(mixedMan(f,court),a);assert.equal(f.s.matches.length,2);
});
