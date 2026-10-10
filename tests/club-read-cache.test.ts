import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event} from '../lib/domain/types';
import {createClubReadCache,clubViewValidUntil,type ClubReadVersion} from '../lib/club-read-cache';
import {projectClubState} from '../lib/club-view';
import {calculateSettlement} from '../lib/domain/money';

const now=Date.parse('2026-10-04T12:00:00Z'),duration=20*60000;
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.revision=4;
 const a={id:'member',email:'',playerId:'self',role:'member' as const};s.accounts.push(a);
 s.players.push({id:'self',name:'虚构球友',ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const e:Event={id:'event',creatorId:a.id,title:'虚构测试活动',start:now+2*3600000,end:now+3*3600000,venue:'虚构球馆',address:'',capacity:8,signupDeadline:now,cancelDeadline:now,note:'',status:'open',courtMode:'interval',ballMode:'interval',attendanceMode:'automatic'};s.events.push(e);
 s.bookings.push({id:'court',eventId:e.id,name:'1号场',start:e.start,end:e.end,pricing:'total',cents:1200});
 s.registrations.push({id:'reg',eventId:e.id,playerId:'self',sequence:1,status:'confirmed',arrival:e.start,departure:e.end,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 const version:ClubReadVersion={revision:s.revision,settings:s.settings,account:a};
 const identity={userId:a.id,method:'password',username:'fixture'};
 return {s,a,e,version,identity};
}

test('validators bind fresh revision, account permissions, identity and ranking query',()=>{
 const {version,identity}=fixture(),cache=createClubReadCache();
 const token=cache.remember(version,identity,'2026-10',2026,now+60000,now)!;
 assert.ok(cache.matches(token,version,identity,'2026-10',2026,now+15000));
 for(const altered of [
  {...version,revision:5},
  {...version,account:null},
  {...version,account:{...version.account!,role:'admin' as const}},
  {...version,account:{...version.account!,playerId:'changed'}},
  {...version,settings:{...version.settings,initialized:false}},
  {...version,settings:{...version.settings,ownerAccountId:'different-owner'}},
 ])assert.equal(cache.matches(token,altered,identity,'2026-10',2026,now+15000),false);
 for(const altered of [{...identity,userId:'other'},{...identity,method:'chatgpt'},{...identity,username:'renamed'}])assert.equal(cache.matches(token,version,altered,'2026-10',2026,now+15000),false);
 assert.equal(cache.matches(token,version,identity,'2026-09',2026,now+15000),false);
 assert.equal(cache.matches(token,version,identity,'2026-10',2025,now+15000),false);
 assert.equal(cache.matches('"invented"',version,identity,'2026-10',2026,now),false);
 assert.equal(cache.matches(token,version,identity,'2026-10',2026,now+60000),false);
});

test('validator cache is bounded, expires, and a new Worker safely falls back to a full read',()=>{
 const {version,identity}=fixture(),cache=createClubReadCache(2);
 const old=cache.remember(version,identity,'2026-10',2026,now+600000,now)!;
 cache.remember(version,identity,'2026-10',2026,now+600000,now);
 const recent=cache.remember(version,identity,'2026-10',2026,now+600000,now)!;
 assert.equal(cache.matches(old,version,identity,'2026-10',2026,now),false);
 assert.equal(createClubReadCache().matches(recent,version,identity,'2026-10',2026,now),false);
 assert.equal(cache.matches(recent,version,identity,'2026-10',2026,now+300000),false);
 assert.equal(cache.remember(version,identity,'2026-10',2026,now,now),null);
});

test('future rounds start at the activity, with no phantom pre-activity countdown changes',()=>{
 const {s,a,e}=fixture();
 // Use a time just before a 20-minute boundary, away from activity start.
 const before=e.start-duration-1000,next=clubViewValidUntil(s,a,before);
 assert.equal(next,before+300000);
 assert.deepEqual(projectClubState(s,a,'2026-10',2026,before),projectClubState(s,a,'2026-10',2026,next-1));
 assert.deepEqual(projectClubState(s,a,'2026-10',2026,before).rotationPlans,projectClubState(s,a,'2026-10',2026,next).rotationPlans);
});

test('arrival, booking and live fee boundaries never return a stale unchanged view',()=>{
 const {s,a,e}=fixture();
 assert.equal(clubViewValidUntil(s,a,e.start-1000),e.start);
 assert.equal(clubViewValidUntil(s,a,e.start),e.start);
 assert.equal(clubViewValidUntil(s,a,e.start+60000),e.start+60000);
 assert.deepEqual(projectClubState(s,a,'2026-10',2026,e.start+60000).drafts,projectClubState(s,a,'2026-10',2026,e.start+120000).drafts,'planned estimates stay stable as time passes');
 assert.notDeepEqual(calculateSettlement(s,e,e.start+60000),calculateSettlement(s,e,e.start+120000),'actual elapsed accounting still advances');
 const at=now+1000;s.bookings[0].start=at+5000;
 assert.equal(clubViewValidUntil(s,a,at),at+5000);
 s.bookings[0].start=e.start;s.events[0].attendanceMode='manual';
 s.attendance.push({id:'actual',eventId:e.id,playerId:'self',start:at+2000,end:null,state:'ready'});
 assert.equal(clubViewValidUntil(s,a,at),at+2000);
});

test('completed history remains stable and another creator private activity does not disable reuse',()=>{
 const {s,a,e}=fixture();e.start=now-3600000;e.end=now-1000;e.status='ended';
 s.events.push({...e,id:'private',creatorId:'other',status:'draft',start:now-1000,end:now+60000});
 const expires=clubViewValidUntil(s,a,now);
 assert.equal(expires,now+300000);
 assert.deepEqual(projectClubState(s,a,'2026-10',2026,now),projectClubState(s,a,'2026-10',2026,expires-1));
 assert.equal(clubViewValidUntil(s,{...a,role:'admin'},now),now);
});

test('a clock boundary changes the returned activity status without a write or reusable old validator',()=>{
 const {s,a,e,version,identity}=fixture(),cache=createClubReadCache();
 const before=e.start-1,token=cache.remember(version,identity,'2026-10',2026,clubViewValidUntil(s,a,before),before)!;
 assert.ok(token);assert.equal(cache.matches(token,version,identity,'2026-10',2026,e.end),false);
 assert.equal(projectClubState(s,a,'2026-10',2026,e.end-1).events[0].status,'open');
 assert.equal(projectClubState(s,a,'2026-10',2026,e.end).events[0].status,'ended');
 assert.equal(s.events[0].status,'open');assert.equal(s.revision,4);
});

test('weak and list GET validators reuse an account-scoped entry with one canonical ETag',()=>{
 const {version,identity}=fixture(),cache=createClubReadCache(),token=cache.remember(version,identity,'2026-10',2026,now+60000,now)!;
 for(const header of ['W/'+token,'  W/'+token+'  ','"unrelated", W/'+token,token+', "unrelated"']){assert.equal(cache.match(header,version,identity,'2026-10',2026,now+1),token);assert.equal(cache.matches(header,version,identity,'2026-10',2026,now+1),true)}
 for(const header of ['*','w/'+token,'invalid'+token,'"invented"','x'.repeat(8193)])assert.equal(cache.match(header,version,identity,'2026-10',2026,now+1),null);
 assert.equal(cache.matches('W/'+token,version,{...identity,userId:'another-user'},'2026-10',2026,now+1),false);
 assert.equal(cache.matches('W/'+token,{...version,revision:version.revision+1},identity,'2026-10',2026,now+1),false);
 assert.equal(cache.matches('W/'+token,version,identity,'2026-10',2026,now+60000),false);
});
