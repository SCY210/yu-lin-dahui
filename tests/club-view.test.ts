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
 assert.ok(v.leaderboard.every(p=>p.rating===null));assert.ok(v.quarterlyLeaderboard.every(p=>p.rating===null));assert.ok(v.annualLeaderboard.every(p=>p.rating===null));
});

test('administrators retain all drafts and previews without exposing storage object keys',()=>{
 const {s,me,start}=fixture(),v=projectClubState(s,{...me,role:'admin'},'2026-10',2026,start);
 assert.equal(v.events.length,3);assert.equal(v.drafts.length,3);assert.equal(v.accounts.length,2);
 assert.ok(v.photos.every(p=>!('key' in p)));
});

test('future default attendance provides a planned fee estimate without available players or invented arrival personality',()=>{
 const {s,me,start}=fixture();s.registrations.push({id:'own-reg',eventId:'own',playerId:'self',sequence:1,status:'confirmed',arrival:start,departure:start+3600000,note:'',cancelRequested:false,registeredAt:start-7200000,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 const v=projectClubState(s,me,'2026-10',2026,start-3600000);
 assert.equal(v.events.find(e=>e.id==='own')!.attendanceMode,'automatic');
 assert.equal(v.attendance.find(a=>a.eventId==='own')!.start,start);
 assert.equal(v.attendance.find(a=>a.eventId==='own')!.source,'automatic');
 assert.equal(v.rotationPlans.own.players,0);assert.equal(v.drafts[0].bills.length,1);assert.equal(v.drafts[0].bills[0].minutes,60);
 const personality=v.social.personality.find(p=>p.playerId==='self')!;assert.equal(personality.early,0);assert.equal(personality.onTime,0);
 assert.equal(s.events.find(e=>e.id==='own')!.attendanceMode,undefined);assert.equal(s.attendance.length,0);
});

test('planned automatic arrivals do not become arrival personality after their start, while historical manual records remain',()=>{
 const {s,me,start}=fixture();const automatic=s.events.find(e=>e.id==='open')!;automatic.attendanceMode='automatic';
 s.registrations.push({id:'open-reg',eventId:'open',playerId:'self',sequence:1,status:'confirmed',arrival:start,departure:start+3600000,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 const old={...automatic,id:'historical',start:start-7200000,end:start-3600000,status:'ended' as const,attendanceMode:undefined};s.events.push(old);
 s.attendance.push({id:'actual-old',eventId:old.id,playerId:'self',start:old.start,end:old.end,state:'left'});
 const v=projectClubState(s,me,'2026-10',2026,start+1800000),personality=v.social.personality.find(p=>p.playerId==='self')!;
 assert.equal(personality.onTime,1);assert.equal(personality.early,0);
 assert.equal(v.events.find(e=>e.id===old.id)!.attendanceMode,undefined);assert.deepEqual(s.attendance,[{id:'actual-old',eventId:old.id,playerId:'self',start:old.start,end:old.end,state:'left'}]);
});
test('已完成活动改回私有草稿后，所有账号仍看到相同历史榜单与档案统计，草稿内容保持隔离',()=>{
 const {s,me,start}=fixture();
 for(const id of ['third','fourth'])s.players.push({id,ownerId:'other',name:id,rating:1000,initialRating:1000,ratedGames:0,enabled:true,ratingReason:''});
 s.matches.push({id:'historical-draft-result',eventId:'hidden',roundId:'private-round',courtId:'court-hidden',a:['self','third'],b:['peer','fourth'],status:'complete',start,end:start+1200000,scoreA:21,scoreB:19,games:[{a:21,b:19}],monthly:true,elo:true,locked:false,enteredBy:'other'});
 s.registrations.push({id:'private-reg',eventId:'hidden',playerId:'peer',sequence:1,status:'confirmed',arrival:start,departure:start+3600000,note:'私有报名备注',cancelRequested:false,registeredAt:start-60000,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''}});
 const at=start+1200000,member=projectClubState(s,me,'2026-10',2026,at),creator=projectClubState(s,s.accounts[1],'2026-10',2026,at),admin=projectClubState(s,{...me,role:'admin'},'2026-10',2026,at);
 const publicRanking=(rows:typeof member.quarterlyLeaderboard)=>rows.map(row=>{const copy:Record<string,unknown>={...row};delete copy.rating;return copy});
 assert.deepEqual(publicRanking(member.quarterlyLeaderboard),publicRanking(admin.quarterlyLeaderboard));assert.deepEqual(publicRanking(creator.quarterlyLeaderboard),publicRanking(admin.quarterlyLeaderboard));
 assert.deepEqual(publicRanking(member.annualLeaderboard),publicRanking(admin.annualLeaderboard));assert.equal(member.quarterlyLeaderboard.find(r=>r.playerId==='self')!.points,3);
 assert.deepEqual(member.social.stats,admin.social.stats);assert.equal(member.social.stats.find(p=>p.playerId==='self')!.games,1);
 assert.ok(!member.events.some(e=>e.id==='hidden'));assert.ok(!member.matches.some(m=>m.id==='historical-draft-result'));assert.ok(!member.registrations.some(r=>r.id==='private-reg'));assert.ok(!('historical-draft-result' in member.social.matchLevels));assert.ok(!('hidden' in member.social.arenas));
 assert.equal(member.social.personality.find(p=>p.playerId==='peer')!.fastSignup,0);assert.equal(admin.social.personality.find(p=>p.playerId==='peer')!.fastSignup,1);
 assert.ok(member.players.every(p=>p.rating===null&&p.initialRating===null));assert.deepEqual(member.ratingHistory,[]);
});
