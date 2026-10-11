import {test} from 'node:test';
import assert from 'node:assert/strict';
import {propose} from '../lib/domain/grouping';
import {apply} from '../lib/domain/commands';
import {genderMismatches,genderGapPoints} from '../lib/domain/gender-balance';
import {emptyState,type Event,type Player} from '../lib/domain/types';

const start=Date.parse('2026-10-07T12:00:00Z');
const profile:NonNullable<Player['profile']>={years:2,hand:'right',preference:'doubles',style:'',equipment:''};
type Spec=[rating:number,gender?:NonNullable<Player['profile']>['gender']];
function fixture(specs:Spec[],courts=Math.floor(specs.length/4)){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 const e:Event={id:'event',creatorId:'owner',title:'性别分组测试',start:start-3600000,end:start+3*3600000,venue:'测试球馆',address:'',capacity:16,signupDeadline:start,cancelDeadline:start-86400000,note:'',status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval'};
 s.events.push(e);
 specs.forEach(([rating,gender],i)=>{
  const id=String.fromCharCode(65+i),account=i?'member'+i:'owner';
  s.accounts.push({id:account,email:'',playerId:id,role:i?'member':'admin'});
  s.players.push({id,name:id,ownerId:account,rating,initialRating:rating,ratedGames:20,enabled:true,ratingReason:'',profile:{...profile,...(gender?{gender}:{})}});
  s.registrations.push({id:'reg-'+id,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 });
 for(let i=0;i<courts;i++)s.bookings.push({id:'court-'+i,eventId:e.id,name:String(i),start:e.start,end:e.end,pricing:'hourly',cents:1000});
 return {s,e};
}
const rating=(s:ReturnType<typeof emptyState>)=>(id:string)=>s.players.find(p=>p.id===id)!.rating;
const menPairAgainstWoman=(s:ReturnType<typeof emptyState>,m:{a:string[];b:string[]})=>genderMismatches(s,m.a,m.b,rating(s));

test('only a pair of men at least 150 above a woman on the other side counts; the reverse is fine',()=>{
 assert.equal(genderGapPoints,150);
 const {s}=fixture([[1300,'male'],[1300],[1150,'female'],[1000,'male'],[1149,'female'],[1500,'female'],[1500,'female'],[1000,'undisclosed']]);
 const r=rating(s);
 assert.equal(genderMismatches(s,['A','B'],['C','D'],r),1,'unset gender counts as a man; a 150 gap is enough');
 assert.equal(genderMismatches(s,['A','B'],['E','D'],r),1);
 assert.equal(genderMismatches(s,['A','C'],['B','D'],r),0,'a mixed pair is not a pair of men');
 assert.equal(genderMismatches(s,['F','G'],['D','H'],r),0,'strong women against weaker men may play');
 assert.equal(genderMismatches(s,['A','D'],['C','H'],r),0,'one of the men is not 150 stronger');
 assert.equal(genderMismatches(s,['A','B'],['C','E'],r),2,'each woman counts');
});

test('round and planned grouping split two strong men instead of sending them against a weaker woman',()=>{
 // Ignoring gender, A+B against C+D is perfectly even (gap 0), but C is 150 below both men; the other splits are 150 apart.
 const {s,e}=fixture([[1400,'male'],[1400,'male'],[1250,'female'],[1550,'female']]);
 const plain=structuredClone(s);plain.players.forEach(p=>delete p.profile!.gender);
 const even=propose(plain,e,start,15,1).courts[0];assert.ok([even.a,even.b].some(team=>team.includes('A')&&team.includes('B')),'without the rule the men would be paired');
 for(let seed=1;seed<=20;seed++){const court=propose(s,e,start,15,seed).courts[0];assert.equal(menPairAgainstWoman(s,court),0,'seed '+seed)}
});

test('several courts: players are swapped between courts to avoid it, and who plays does not change',()=>{
 const {s,e}=fixture([[1400,'male'],[1400,'male'],[1200,'female'],[1200,'female'],[1400,'male'],[1400,'male'],[1200,'female'],[1200,'female'],[900,'male'],[900,'male']],2);
 for(let seed=1;seed<=10;seed++){
  const next=propose(s,e,start,15,seed),ungendered=(()=>{const copy=structuredClone(s);copy.players.forEach(p=>delete p.profile!.gender);return propose(copy,e,start,15,seed)})();
  assert.deepEqual(next.rest.slice().sort(),ungendered.rest.slice().sort(),'the same people rest');
  assert.ok(next.courts.every(m=>menPairAgainstWoman(s,m)===0));
 }
});

test('when it cannot be avoided the court is still scheduled',()=>{
 const {s,e}=fixture([[1400,'male'],[1400,'male'],[1400,'male'],[1200,'female']]);
 const court=propose(s,e,start,15,3).courts[0];
 assert.equal([...court.a,...court.b].length,4);assert.equal(menPairAgainstWoman(s,court),1);
});

test('live rotation pairs the next four the same way',async()=>{
 const {s,e}=fixture([[1400,'male'],[1400,'male'],[1250,'female'],[1550,'female']]);
 await apply(s,s.accounts[0],'liveStart',{eventId:e.id},start);
 const m=s.matches.find(m=>m.status==='playing')!;
 assert.equal(menPairAgainstWoman(s,m),0);
});
