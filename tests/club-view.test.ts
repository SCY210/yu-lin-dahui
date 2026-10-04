import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Event} from '../lib/domain/types';
import {projectClubState} from '../lib/club-view';

function fixture(){
 const s=emptyState(),start=Date.parse('2026-10-04T12:00:00Z');
 const me={id:'member',role:'member' as const,email:'',playerId:'self'};
 s.accounts.push(me,{id:'other',role:'member',email:'',playerId:'peer'});
 s.players.push(...['self','peer'].map((id,i)=>({id,ownerId:i?'other':'member',name:id,rating:1000,initialRating:1000,ratedGames:0,enabled:true,ratingReason:''})));
 for(const [id,creatorId,status] of [['own','member','draft'],['hidden','other','draft'],['open','other','open']] as const){
  s.events.push({id,creatorId,status,title:id,start,end:start+3600000,venue:'本地虚构球馆',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',courtMode:'interval',ballMode:'interval'} as Event);
  s.bookings.push({id:'court-'+id,eventId:id,name:'1号场',start,end:start+3600000,pricing:'hourly',cents:1200});
  s.photos.push({id:'photo-'+id,key:'private/'+id,kind:'photo',eventId:id,matchId:null,playerIds:[],caption:'虚构测试照片',type:'image/png',size:100,at:start,uploaderId:'other'} as any);
 }
 return {s,me,start};
}

test('ordinary creator sees own draft and settlement preview, while another creator draft stays private',()=>{
 const {s,me,start}=fixture(),v=projectClubState(s,me,'2026-10',2026,start);
 assert.deepEqual(v.events.map(e=>e.id).sort(),['open','own']);
 assert.deepEqual(v.bookings.map(b=>b.eventId).sort(),['open','own']);
 assert.equal(v.drafts.length,1);assert.equal(v.drafts[0].eventId,'own');
 assert.deepEqual(v.photos.map(p=>p.id).sort(),['photo-open','photo-own']);
 assert.ok(v.photos.every(p=>!('key' in p)));
 assert.equal(s.events.length,3,'Projection must not mutate persisted state');
});

test('organizing an activity does not grant administrative account or raw rating access',()=>{
 const {s,me,start}=fixture(),v=projectClubState(s,me,'2026-10',2026,start);
 assert.equal(v.me.role,'member');assert.deepEqual(v.accounts,[]);assert.deepEqual(v.audits,[]);assert.deepEqual(v.ratingHistory,[]);
 assert.ok(v.players.every(p=>p.rating===null&&p.initialRating===null));
 assert.ok(v.leaderboard.every(p=>p.rating===null));assert.ok(v.annualLeaderboard.every(p=>p.rating===null));
});

test('administrators retain all drafts and previews without exposing storage object keys',()=>{
 const {s,me,start}=fixture(),v=projectClubState(s,{...me,role:'admin'},'2026-10',2026,start);
 assert.equal(v.events.length,3);assert.equal(v.drafts.length,3);assert.equal(v.accounts.length,2);
 assert.ok(v.photos.every(p=>!('key' in p)));
});
