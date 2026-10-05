import {test} from 'node:test';
import assert from 'node:assert/strict';
import {achievementSnapshot} from '../lib/domain/achievements';
import {achievementCatalog} from '../lib/achievement-catalog';
import {projectClubState} from '../lib/club-view';
import {clubViewValidUntil} from '../lib/club-read-cache';
import {emptyState,type Match,type State,type Event} from '../lib/domain/types';
import {readFileSync,statSync} from 'node:fs';
import {validateImage} from '../lib/image-validation';

const now=Date.parse('2026-10-05T12:00:00Z');
function fixture(){
 const s=emptyState();s.settings.initialized=true;
 for(const id of ['p','partner','a','b','c','d','e','f'])s.players.push({id,name:id,ownerId:'owner-'+id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 const event:Event={id:'event',title:'虚构成就验收',creatorId:'owner-p',start:now-86400000,end:now-3600000,venue:'测试',address:'',capacity:8,signupDeadline:now-90000000,cancelDeadline:now-90000000,note:'',status:'ended',courtMode:'equal',ballMode:'equal',attendanceMode:'automatic'};
 s.events.push(event);s.accounts.push({id:'owner-p',role:'member',email:'',playerId:'p'});return s;
}
function game(id:string,end:number,won=true,partner='partner'):Match{
 return {id,eventId:'event',roundId:'round-'+id,courtId:'court',a:['p',partner],b:['a','b'],status:'complete',start:end-600000,end,scoreA:won?21:15,scoreB:won?15:21,monthly:true,elo:true,locked:false,enteredBy:'owner-p',games:[{a:won?21:15,b:won?15:21}]};
}
const summary=(s:State)=>achievementSnapshot(s,now).p;

test('zero records stay locked; a completed win unlocks first match and first victory at the factual end',()=>{
 const s=fixture();assert.equal(summary(s).unlockedCount,0);
 s.matches.push(game('first',now-1000));const before=structuredClone(s),result=summary(s);
 assert.equal(result.unlockedCount,2);assert.equal(result.progress['first-flight'].unlockedAt,now-1000);assert.equal(result.progress['first-victory'].unlockedAt,now-1000);assert.equal(result.progress['ten-matches'].current,1);assert.deepEqual(s,before);
});

test('ten/fifty matches and ten wins unlock at their own thresholds, not signup or projected participation',()=>{
 const s=fixture();for(let i=0;i<50;i++)s.matches.push(game(String(i).padStart(3,'0'),now-100000+i*1000,i<10));
 const result=summary(s);assert.equal(result.progress['ten-matches'].unlockedAt,s.matches[9].end);assert.equal(result.progress['fifty-matches'].unlockedAt,s.matches[49].end);assert.equal(result.progress['ten-victories'].unlockedAt,s.matches[9].end);
 assert.equal(result.progress['fifty-matches'].current,50);assert.equal(result.progress['ten-victories'].current,10);
});

test('chronological own-match streaks ignore unrelated matches, and a loss resets the current streak',()=>{
 const s=fixture();s.matches=[game('late-win',now-1000),game('early-win',now-5000),game('loss',now-4000,false),game('middle-win',now-3000),game('another-win',now-2000)];
 const unrelated=game('unrelated',now-2500,false);unrelated.a=['c','d'];unrelated.b=['e','f'];s.matches.push(unrelated);
 assert.equal(summary(s).progress['three-streak'].current,3);assert.equal(summary(s).progress['three-streak'].unlockedAt,now-1000);
});

test('distinct teammates count once, opponents do not count as partners, and repeated match IDs do not inflate progress',()=>{
 const s=fixture();for(const [i,partner]of ['partner','c','d','e','f','f'].entries())s.matches.push(game('match-'+i,now-10000+i*1000,true,partner));
 s.matches.push({...s.matches[0]});const result=summary(s);assert.equal(result.progress['five-partners'].current,5);assert.equal(result.progress['five-partners'].unlockedAt,s.matches[4].end);assert.equal(result.progress['ten-matches'].current,6);
});

test('three-game victory counts winners only; valid friendly results still count',()=>{
 const s=fixture(),match=game('three',now-1000);match.games=[{a:21,b:17},{a:16,b:21},{a:21,b:19}];match.scoreA=2;match.scoreB=1;match.monthly=false;match.elo=false;s.matches.push(match);
 const result=achievementSnapshot(s,now);assert.equal(result.p.progress['three-game-victory'].current,1);assert.equal(result.a.progress['three-game-victory'].current,0);assert.equal(result.p.progress['first-victory'].current,1);
});

test('cancelled, forfeit, pending, incomplete, future and malformed results never earn achievements',()=>{
 const s=fixture();for(const status of ['cancelled','forfeit','playing','published','draft'] as const)s.matches.push({...game(status,now-1000),status});
 s.matches.push({...game('incomplete',now-1000),end:null},game('future',now+1000),{...game('tie',now-1000),scoreA:21,scoreB:21},{...game('duplicate-player',now-1000),b:['p','a']},{...game('unknown-event',now-1000),eventId:'missing'});
 assert.equal(summary(s).unlockedCount,0);assert.equal(summary(s).progress['first-flight'].current,0);
});

test('score corrections and voiding recalculate earned badges while historical soft deletion preserves finished facts',()=>{
 const s=fixture();s.matches.push(game('win',now-1000));assert.notEqual(summary(s).progress['first-victory'].unlockedAt,null);
 s.matches[0].scoreA=15;s.matches[0].scoreB=21;s.matches[0].games=[{a:15,b:21}];assert.equal(summary(s).progress['first-victory'].unlockedAt,null);assert.notEqual(summary(s).progress['first-flight'].unlockedAt,null);
 s.events[0].deletedAt=now;assert.notEqual(summary(s).progress['first-flight'].unlockedAt,null);
 s.matches[0].status='cancelled';assert.equal(summary(s).unlockedCount,0);
});

test('member achievement projection does not leak private draft matches, but preserves completed archived results',()=>{
 const s=fixture();s.events[0].status='draft';s.events[0].creatorId='other';s.matches.push(game('hidden',now-1000));
 assert.equal(projectClubState(s,s.accounts[0],'2026-10',2026,now).achievements.p.unlockedCount,0);
 s.events[0].status='ended';s.events[0].deletedAt=now;assert.equal(projectClubState(s,s.accounts[0],'2026-10',2026,now).achievements.p.unlockedCount,2);
});

test('a future completed fact invalidates conditional-read metadata exactly at its unlock boundary',()=>{
 const s=fixture();s.matches.push(game('future',now+60000));assert.equal(summary(s).unlockedCount,0);assert.equal(clubViewValidUntil(s,s.accounts[0],now),now+60000);
 assert.equal(achievementSnapshot(s,now+60000).p.unlockedCount,2);
 s.events[0].deletedAt=now;assert.equal(clubViewValidUntil(s,s.accounts[0],now),now+60000);
});

test('catalog identifiers and assets are unique and every target is attainable',()=>{
 assert.equal(new Set(achievementCatalog.map(a=>a.id)).size,8);for(const a of achievementCatalog){assert.ok(a.target>0);assert.ok(Number.isInteger(a.target))}
});

test('every badge has a real 256px generated WebP asset and the complete collection stays lightweight',()=>{
 let bytes=0;for(const a of achievementCatalog){const path='public/badges/'+a.id+'.webp',data=readFileSync(path);const image=validateImage(new Uint8Array(data),'image/webp');assert.equal(image.width,256);assert.equal(image.height,256);bytes+=statSync(path).size}
 assert.ok(bytes<256*1024,'Badge collection should remain below 256 KiB');
});
