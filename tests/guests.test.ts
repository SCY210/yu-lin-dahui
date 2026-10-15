import {activityNoticeVersion} from '../lib/activity-notice';
const acceptedActivityNotice={noticeAccepted:true,noticeVersion:activityNoticeVersion};
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {realmLedger} from '../lib/domain/realm-rating';
import {replayRating} from '../lib/domain/ranking';
import {guestIds,guestHostName,guestLevelAt} from '../lib/domain/guests';
import {emptyState,type Match,type State} from '../lib/domain/types';

const start=Date.parse('2026-11-01T15:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';
 for(const [account,player,role] of [['owner','p0','admin'],['m1','p1','member'],['m2','p2','member'],['m3','p3','member'],['m4','p4','member']] as const){
  s.accounts.push({id:account,email:'',role,playerId:player});
  s.players.push({id:player,name:'球友'+player,ownerId:account,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 }
 // A friend brought by m1: no account of their own.
 s.players.push({id:'g',name:'临时朋友',ownerId:'m1',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 s.events.push({id:'e',creatorId:'m3',title:'虚构活动',venue:'球馆',address:'',start,end:start+3*3600000,signupDeadline:start,cancelDeadline:start-86400000,capacity:8,status:'open',attendanceMode:'automatic',courtMode:'interval',ballMode:'interval',note:''});
 for(const id of ['p1','p2','p3','g'])s.registrations.push({id:'r'+id,eventId:'e',playerId:id,sequence:1,status:'confirmed',arrival:start,departure:start+3*3600000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 return s;
}
const game=(id:string,a:string[],b:string[],at:number,scoreA=21,scoreB=15):Match=>({id,eventId:'e',roundId:'r',courtId:'c',a,b,status:'complete',start:at,end:at+600000,scoreA,scoreB,games:[{a:scoreA,b:scoreB}],monthly:true,elo:true,locked:false,enteredBy:'owner'});
const ledgerAt=(s:State)=>realmLedger(s,start+5*3600000);

test('a friend has no account, is shown as the registrant\'s friend, and members keep their accounts',()=>{
 const s=fixture();
 assert.deepEqual([...guestIds(s)],['g']);assert.equal(guestHostName(s,'g'),'球友p1');
 assert.equal(guestLevelAt(s.players.find(p=>p.id==='g')!),1000,'default level');
});

test('a friend never gains rating or points, and members are rated against the friend\'s fixed level',()=>{
 const s=fixture();s.matches.push(game('m',['p1','g'],['p2','p3'],start));
 const ledger=ledgerAt(s);
 assert.equal((ledger.byPlayer.get('g')??[]).length,0,'no rated games for the friend');
 for(const id of ['p1','p2','p3'])assert.equal((ledger.byPlayer.get(id)??[]).length,1);
 replayRating(s,start+5*3600000);assert.equal(s.players.find(p=>p.id==='g')!.rating,1000,'grouping keeps the level');
 // A stronger friend makes the same win worth less for the partner and the loss cost less for the opponents.
 const strong=fixture();strong.players.find(p=>p.id==='g')!.guestLevels=[{at:0,level:1300}];strong.matches.push(game('m',['p1','g'],['p2','p3'],start));
 const weakGain=ledger.byPlayer.get('p1')![0].delta,strongGain=ledgerAt(strong).byPlayer.get('p1')![0].delta;
 assert.ok(strongGain<weakGain,'winning with a 1300 friend gains less than with a 1000 friend');
 replayRating(strong,start+5*3600000);assert.equal(strong.players.find(p=>p.id==='g')!.rating,1300);
});

test('changing the level applies from now on; earlier games keep the old level',async()=>{
 const s=fixture();s.matches.push(game('before',['p1','g'],['p2','p3'],start));
 const before=ledgerAt(s).byPlayer.get('p2')![0].delta;
 await apply(s,s.accounts[1],'guestLevel',{playerId:'g',level:1300},start+3600000);
 assert.equal(ledgerAt(s).byPlayer.get('p2')![0].delta,before,'the earlier game is not re-rated');
 s.matches.push(game('after',['p1','g'],['p2','p3'],start+2*3600000));
 const after=ledgerAt(s).byPlayer.get('p2')!.find(g=>g.matchId==='after')!;
 const partner=ledgerAt(s).byPlayer.get('p1')!.find(g=>g.matchId==='after')!;
 assert.equal(after.opponent,(1300+partner.before)/2,'the later game uses the new level');
 assert.equal(s.players.find(p=>p.id==='g')!.rating,1300);
});

test('only the registrant, an administrator or the activity organiser can change a friend\'s level, and only for friends',async()=>{
 const s=fixture(),before=structuredClone(s);
 await assert.rejects(()=>apply(s,s.accounts[2],'guestLevel',{playerId:'g',level:850},start),/403/);
 await assert.rejects(()=>apply(s,s.accounts[1],'guestLevel',{playerId:'p2',level:850},start),/只有代报名的朋友/);
 await assert.rejects(()=>apply(s,s.accounts[1],'guestLevel',{playerId:'g',level:999},start));
 assert.deepEqual(s,before);
 await apply(s,s.accounts[3],'guestLevel',{playerId:'g',level:850},start);
 await apply(s,s.accounts[0],'guestLevel',{playerId:'g',level:1150},start+1);
 assert.equal(guestLevelAt(s.players.find(p=>p.id==='g')!),1150);
});

test('adding a friend with a level stores it for all of the friend\'s games',async()=>{
 const s=fixture();s.bookings.push({id:'court',eventId:'e',name:'1 号场',start,end:start+3*3600000,pricing:'total',cents:1200});
 await apply(s,s.accounts[1],'friendSignup',{...acceptedActivityNotice,mode:'new',gender:'male',name:'新朋友',guestLevel:1150,bookingId:'court',arrival:start,departure:start+3*3600000,note:''},start-86400000);
 const friend=s.players.at(-1)!;assert.deepEqual(friend.guestLevels,[{at:0,level:1150}]);assert.ok(guestIds(s).has(friend.id));
});

test('legacy guests cannot receive a profile, gender edit or manual points through administrative commands',async()=>{
 const s=fixture(),owner=s.accounts[0],before=structuredClone(s);
 await assert.rejects(()=>apply(s,owner,'profile',{playerId:'g',name:'Not a profile'},start),/没有球员档案/);
 await assert.rejects(()=>apply(s,owner,'profileGender',{playerId:'g',gender:'female'},start),/没有球员档案/);
 await assert.rejects(()=>apply(s,owner,'grantPoints',{playerId:'g',period:'2026-11',points:10,rating:0,reason:'No guest points'},start),/临时来宾不累计/);
 assert.deepEqual(s,before);
});

test('scoped guests are recognised without account metadata and their level history uses chronological time',()=>{
 const s=fixture(),guest=s.players.find(p=>p.id==='g')!;guest.guestEventId='e';
 guest.guestLevels=[{at:20,level:1300},{at:10,level:850}];
 assert.equal(guestLevelAt(guest,9),1000);assert.equal(guestLevelAt(guest,15),850);assert.equal(guestLevelAt(guest,25),1300);
 assert.ok(guestIds({players:s.players}).has(guest.id));
});
