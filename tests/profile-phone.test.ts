import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {projectClubState,phonePeers} from '../lib/club-view';
import {needsPhone,phoneProblem} from '../lib/player-profile-options';
import {emptyState,type Account,type State} from '../lib/domain/types';

const hour=3600000,start=Date.parse('2026-11-05T18:00:00Z'),end=start+3*hour,after=end+hour;
const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'};
const vice:Account={id:'vice',email:'',role:'admin',playerId:'p4'};
const alice:Account={id:'alice',email:'',role:'member',playerId:'p1'};
const bob:Account={id:'bob',email:'',role:'member',playerId:'p2'};
const carol:Account={id:'carol',email:'',role:'member',playerId:'p3'};
const phones:Record<string,string>={p0:'+34 600 000 000',p1:'600 111 111',p2:'600 222 222',p3:'600 333 333',p4:'600 444 444'};

function club(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=[owner,alice,bob,carol,vice].map(a=>({...a}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:'Fictional '+a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 return s;
}
const phoneSeen=(s:State,viewer:Account,playerId:string)=>projectClubState(s,viewer,'2026-11',2026,after).players.find(p=>p.id===playerId)?.profile?.phone;

test('the phone number is checked: digits with common separators, 5 to 20 digits',()=>{
 for(const ok of ['+34 600 123 456','600-123-456','+86 (138) 0000 0000'])assert.equal(phoneProblem(ok),'',ok);
 assert.match(phoneProblem('abc 123'),/只可包含数字/);assert.match(phoneProblem('1234'),/请检查/);assert.match(phoneProblem('1'.repeat(21)),/请检查/);
 assert.equal(needsPhone(undefined),true);assert.equal(needsPhone('  '),true);assert.equal(needsPhone('600 111 111'),false);
});

test('members fill in their own number; the owner and administrators can fill in anyone’s; others and guests cannot',async()=>{
 const s=club();
 await apply(s,alice,'profilePhone',{playerId:'p1',phone:' 600 111 111 '},1);
 assert.equal(s.players[1].profile?.phone,'600 111 111');assert.equal(s.players[1].profile?.hand,'right','a missing profile gets the usual defaults');
 assert.equal(s.audits.at(-1)?.action,'profilePhone');
 await assert.rejects(()=>apply(s,alice,'profilePhone',{playerId:'p2',phone:'600 222 222'},2),/403/);
 await assert.rejects(()=>apply(s,alice,'profilePhone',{playerId:'p1',phone:'call me'},2),/只可包含数字/);
 await assert.rejects(()=>apply(s,alice,'profilePhone',{playerId:'p1',phone:''},2),/请填写/);
 for(const manager of [owner,vice]){await apply(s,manager,'profilePhone',{playerId:'p2',phone:phones.p2},3);assert.equal(s.players[2].profile?.phone,phones.p2)}
 s.players.push({id:'guest',name:'Fictional guest',ownerId:'alice',guestEventId:'e',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 await assert.rejects(()=>apply(s,owner,'profilePhone',{playerId:'guest',phone:'600 555 555'},4),/临时来宾/);
});

test('the full profile form saves the number and keeps it when an older form leaves it out',async()=>{
 const s=club(),form={playerId:'p1',years:3,hand:'left',preference:'mixed',style:'',equipment:''};
 await apply(s,alice,'profileDetails',{...form,phone:'600 111 111'},1);assert.equal(s.players[1].profile?.phone,'600 111 111');
 await apply(s,alice,'profileDetails',{...form,years:4},2);assert.equal(s.players[1].profile?.phone,'600 111 111');assert.equal(s.players[1].profile?.years,4);
 await assert.rejects(()=>apply(s,alice,'profileDetails',{...form,phone:'x'},3));
});

test('numbers are seen by their owner, the owner and administrators, and the people one transfers with in a fee split',async()=>{
 const s=club();for(const p of s.players)p.profile={years:0,hand:'right',preference:'doubles',style:'',equipment:'',phone:phones[p.id]};
 await apply(s,owner,'event',{title:'虚构周四双打',matchFormat:'doubles',start,end,venue:'虚构球馆',address:'',capacity:8,cancelDeadline:start-86400000,note:'',status:'open',
  bookings:[{name:'1号场',start,end,pricing:'hourly',cents:1200,advancedBy:'p1'}]},start-2*86400000);
 const e=s.events[0];
 for(const [i,id] of ['p1','p2'].entries())s.registrations.push({id:'r'+i,eventId:e.id,playerId:id,sequence:i,status:'confirmed',arrival:start,departure:end,registeredAt:start-86400000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}} as State['registrations'][number]);
 // Before any split, members see only their own number.
 assert.equal(phoneSeen(s,bob,'p2'),phones.p2);assert.equal(phoneSeen(s,bob,'p1'),undefined);
 await apply(s,owner,'settle',{eventId:e.id,confirmed:true,reason:'确认'},after);
 const split=s.settlements.filter(x=>x.confirmed).at(-1)!;
 assert.ok(split.transfers?.some(t=>t.from==='p2'&&t.to==='p1'),'Bob pays Alice, who advanced the court');
 assert.equal(phoneSeen(s,bob,'p1'),phones.p1,'the payer sees whom to pay');
 assert.equal(phoneSeen(s,alice,'p2'),phones.p2,'the receiver sees who pays');
 assert.equal(phoneSeen(s,carol,'p1'),undefined,'someone outside the transfer does not');
 assert.equal(phoneSeen(s,bob,'p3'),undefined);
 for(const manager of [owner,vice])for(const id of ['p1','p2','p3'])assert.equal(phoneSeen(s,manager,id),phones[id]);
 split.revokedAt=after;assert.equal(phoneSeen(s,bob,'p1'),undefined,'a withdrawn split no longer shares numbers');
 assert.deepEqual([...phonePeers([{transfers:[{from:'p2',to:'p0'}],collector:'p0'},{transfers:[{from:'p3',to:'p0'}],collector:'p0'}],'p2')],['p0']);
});
