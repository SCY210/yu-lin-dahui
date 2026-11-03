import {activityNoticeVersion} from '../lib/activity-notice';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {convertFriendToMember} from '../lib/domain/guest-conversion';
import {isGuest} from '../lib/domain/guests';
import {emptyState,type Account,type Event,type Match} from '../lib/domain/types';

const notice={noticeAccepted:true,noticeVersion:activityNoticeVersion},week=7*86400000,start=Date.parse('2026-10-01T15:00:00Z'),now=start-86400000;
/** A member brought the same fictional friend "aq" to two activities; the friend played one game in the first. */
async function fixture(){
 const s=emptyState(),admin:Account={id:'admin',playerId:'pa',email:'',role:'admin'},alice:Account={id:'alice',playerId:'p1',email:'',role:'member'};
 s.settings.initialized=true;s.settings.ownerAccountId='admin';s.accounts.push(admin,alice,{id:'m2',playerId:'p2',email:'',role:'member'},{id:'m3',playerId:'p3',email:'',role:'member'});
 for(const a of s.accounts)s.players.push({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const event=(id:string,at:number):Event=>({id,creatorId:'admin',title:'Fictional '+id,venue:'Fictional',address:'',start:at,end:at+7200000,signupDeadline:at+7200000,cancelDeadline:at-86400000,capacity:8,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''});
 for(const [i,e] of [event('one',start),event('two',start+week)].entries()){s.events.push(e);s.bookings.push({id:'court-'+i,eventId:e.id,name:'Court',start:e.start,end:e.end,pricing:'total',cents:1200})}
 const add=async(court:string,name='aq')=>{const b=s.bookings.find(x=>x.id===court)!;await apply(s,alice,'friendSignup',{...notice,mode:'new',gender:'female',guestLevel:1150,name,bookingId:court,arrival:b.start,departure:b.end,note:''},now);return s.players.at(-1)!};
 const first=await add('court-0'),second=await add('court-1');
 const game:Match={id:'game',eventId:'one',roundId:'round',courtId:'court-0',a:[first.id,'p1'],b:['p2','p3'],status:'complete',start:start+600000,end:start+1500000,scoreA:21,scoreB:15,games:[{a:21,b:15}],locked:false,monthly:true,elo:true} as unknown as Match;
 s.matches.push(game);s.events[0].status='ended';
 s.audits.push({id:'old',at:now,actor:'alice',action:'friendSignup',reason:'',changes:{playerId:first.id}});
 return {s,first,second};
}
const later=start+2*week;

test('a friend who joins becomes one member with all their records, and is rated as a member from their last level',async()=>{
 const {s,first,second}=await fixture();
 assert.ok(isGuest(s,first.id)&&isGuest(s,second.id));
 const result=convertFriendToMember(s,second.id,'account:aq','Aqing',later);
 assert.equal(result.playerId,second.id);assert.deepEqual(result.left,[]);
 assert.deepEqual(result.merged,[first.id]);
 assert.equal(s.players.some(p=>p.id===first.id),false,'the older record is merged away');
 const member=s.players.find(p=>p.id===second.id)!;
 assert.equal(member.name,'Aqing');assert.equal(member.ownerId,'account:aq');assert.equal(member.initialRating,1150,'starts from the friend’s level');
 assert.equal(member.guestEventId,undefined);assert.equal(member.guestLevels,undefined);assert.equal(member.guestGender,'female','gender is kept for pairing');
 assert.equal(isGuest(s,second.id),false,'no longer a guest');
 assert.ok(s.accounts.some(a=>a.id==='account:aq'&&a.playerId===second.id));
 assert.deepEqual(s.registrations.filter(r=>r.playerId===second.id).map(r=>r.eventId).sort(),['one','two'],'both signups belong to the member');
 assert.equal(s.registrations.some(r=>r.playerId===first.id),false);
 assert.deepEqual(s.matches[0].a,[second.id,'p1'],'the past game is the member’s');
 assert.ok(s.ratingChanges.some(c=>c.playerId===second.id),'the past game is rated for the member');
 assert.deepEqual(s.audits.find(a=>a.id==='old')!.changes,{playerId:first.id},'the audit history is kept as it was');
});

test('a friend signed up twice for one activity is refused until the duplicate is cancelled, which then stays behind',async()=>{
 const {s,second}=await fixture();
 // An older duplicate the signup check would refuse today: a second "aq" record signed up for the second activity too.
 s.players.push({...second,id:'dup'});s.registrations.push({...s.registrations.find(r=>r.playerId===second.id)!,id:'dup-reg',playerId:'dup'});
 // Still signed up twice: refused, nothing changes.
 const before=structuredClone(s);
 assert.throws(()=>convertFriendToMember(s,second.id,'account:aq','Aqing',later),/同一场活动里有两条接龙/);
 assert.deepEqual(s,before,'nothing changes');
 assert.throws(()=>convertFriendToMember(s,'p2','account:x','x',later),/临时来宾不存在/);
 // Once 临时来宾 cancels the duplicate, it stays behind as a hidden guest record and the rest becomes the member,
 // even when the duplicate is the record the form chose.
 s.registrations.find(r=>r.id==='dup-reg')!.status='cancelled';
 const result=convertFriendToMember(s,'dup','account:aq','Aqing',later);
 assert.equal(result.playerId,second.id,'the latest kept record carries the member');assert.deepEqual(result.left,['dup']);
 assert.equal(s.players.find(p=>p.id==='dup')!.guestHidden,true,'the duplicate is kept, off the friend lists');
 assert.equal(s.registrations.find(r=>r.id==='dup-reg')!.playerId,'dup','its cancelled signup is left as it was');
 assert.equal(s.registrations.filter(r=>r.playerId===second.id&&r.status!=='cancelled').length,2);
 assert.ok(s.accounts.some(a=>a.id==='account:aq'&&a.playerId===second.id));
});
