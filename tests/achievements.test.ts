import {test} from 'node:test';
import assert from 'node:assert/strict';
import {achievementSnapshot} from '../lib/domain/achievements';
import {achievementCatalog,achievementTargets,achievementParticipationDays,achievementRanks,achievementLevel,achievementGoal,rankImage} from '../lib/achievement-catalog';
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

test('zero records stay locked; a first completed win lights only the two entry themes and records other progress',()=>{
 const s=fixture();assert.equal(summary(s).unlockedCount,0);
 s.matches.push(game('first',now-1000));const before=structuredClone(s),result=summary(s);
 assert.equal(result.unlockedCount,2);assert.equal(result.totalLevels,2);assert.equal(result.progress['first-flight'].unlockedAt,now-1000);assert.equal(result.progress['first-victory'].unlockedAt,now-1000);
 assert.equal(result.progress['ten-matches'].current,2);assert.equal(result.progress['ten-matches'].level,0);assert.equal(result.progress['fifty-matches'].current,1);assert.equal(result.progress['fifty-matches'].unlockedAt,null);assert.equal(result.progress['ten-victories'].partnerId,'partner');assert.equal(result.progress['ten-victories'].level,0);assert.deepEqual(s,before);
});

test('many matches on the same day against the same opponents do not inflate breadth or consistency',()=>{
 const s=fixture();for(let i=0;i<50;i++)s.matches.push(game(String(i).padStart(3,'0'),now-100000+i*1000,i<10));
 const result=summary(s);assert.equal(result.unlockedCount,2);assert.equal(result.progress['ten-matches'].unlockedAt,null);assert.equal(result.progress['fifty-matches'].unlockedAt,null);assert.equal(result.progress['ten-victories'].unlockedAt,null);
 assert.equal(result.progress['first-flight'].current,50);assert.equal(result.progress['first-flight'].level,1);assert.equal(result.progress['ten-matches'].current,2);assert.equal(result.progress['fifty-matches'].current,1);assert.equal(result.progress['ten-victories'].current,10);assert.equal(result.progress['fifty-matches'].level,0);
});

test('chronological own-match streaks ignore unrelated matches, and a loss resets the current streak',()=>{
 const day=86400000,s=fixture();s.matches=[game('late-win',now-1000),game('early-win',now-5*day),game('loss',now-4*day,false),game('middle-win',now-3*day),game('another-win',now-2*day)];
 const unrelated=game('unrelated',now-2.5*day,false);unrelated.a=['c','d'];unrelated.b=['e','f'];s.matches.push(unrelated);
 assert.equal(summary(s).progress['three-streak'].current,3);assert.equal(summary(s).progress['three-streak'].unlockedAt,now-1000);
 s.matches=s.matches.map(m=>{const end=now-3600000+Math.round((m.end!-now)/1000);return {...m,start:end-60000,end}});assert.equal(summary(s).progress['three-streak'].current,3);assert.equal(summary(s).progress['three-streak'].unlockedAt,null,'a rare streak badge needs three play dates');
});

test('distinct teammates count once, opponents do not count as partners, and repeated match IDs do not inflate progress',()=>{
 const s=fixture();for(const [i,partner]of ['partner','c','d','e','f','f'].entries())s.matches.push(game('match-'+i,now-10000+i*1000,true,partner));
 assert.equal(summary(s).progress['five-partners'].level,0,'an advanced badge needs a second play date');
 s.matches.push(game('earlier-day',now-86400000),{...s.matches[0]});const result=summary(s);assert.equal(result.progress['five-partners'].current,5);assert.equal(result.progress['five-partners'].unlockedAt,s.matches[4].end);assert.equal(result.progress['first-flight'].current,7);assert.equal(result.progress['ten-matches'].current,2);
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
 assert.equal(new Set(achievementCatalog.map(a=>a.id)).size,8);assert.equal(new Set(achievementCatalog.map(a=>a.metric)).size,8,'Each theme must measure a distinct direction');for(const a of achievementCatalog){assert.ok(a.target>0);assert.ok(Number.isInteger(a.target))}
});

test('every badge has a real 256px generated WebP asset and the complete collection stays lightweight',()=>{
 let bytes=0;for(const a of achievementCatalog){const path='public/badges/'+a.id+'.webp',data=readFileSync(path);const image=validateImage(new Uint8Array(data),'image/webp');assert.equal(image.width,256);assert.equal(image.height,256);bytes+=statSync(path).size}
 assert.ok(bytes<256*1024,'Badge collection should remain below 256 KiB');
});

test('each achievement has five increasing, finite goals matching its first unlock',()=>{
 assert.equal(achievementRanks.length,5);
 const firstDay={'初阶':1,'进阶':2,'珍稀':3} as const;
 for(const a of achievementCatalog){const targets=achievementTargets[a.id],days=achievementParticipationDays[a.id];assert.equal(targets.length,5);assert.equal(days.length,5);assert.equal(targets[0],a.target);assert.equal(days[0],firstDay[a.rarity],a.id+' first play-date requirement follows its rarity');
  for(const [i,target]of targets.entries()){assert.ok(Number.isSafeInteger(target)&&target>0);assert.ok(Number.isSafeInteger(days[i])&&days[i]>0);if(i){assert.ok(target>targets[i-1]);assert.ok(days[i]>days[i-1])}assert.equal(achievementLevel(a.id,target,days[i]),i+1);assert.equal(achievementLevel(a.id,target-1,days[i]),i);assert.equal(achievementLevel(a.id,target,days[i]-1),i);assert.ok(achievementGoal(a.id,target).includes(String(target)))}
 }
 assert.deepEqual(achievementCatalog.filter(a=>achievementParticipationDays[a.id][0]===1).map(a=>a.id),['first-flight','first-victory']);
 for(const a of achievementCatalog){const days=achievementParticipationDays[a.id];assert.ok(days[1]>=4,'silver needs about a month of weekly play');assert.ok(days[2]>=10);assert.ok(days[3]>=20);assert.ok(days[4]>=40)}
});

test('gold needs both sixty completed matches and ten real Madrid play dates',()=>{
 const s=fixture();for(let i=0;i<80;i++)s.matches.push(game('tier-'+String(i).padStart(3,'0'),now-(10-Math.floor(i/8))*86400000+(i%8)*900000));
 const result=summary(s),p=result.progress['first-flight'];assert.equal(result.matchDays,10);assert.equal(p.level,3);assert.equal(p.levelUnlockedAt[1],s.matches[24].end);assert.equal(p.levelUnlockedAt[2],s.matches[72].end);assert.equal(p.levelUnlockedAt[3],null);assert.equal(achievementLevel('first-flight',p.current,result.matchDays),3);
 assert.equal(achievementLevel('first-flight',60,9),2);assert.equal(achievementLevel('first-flight',59,10),2);
 assert.equal(result.totalLevels,Object.values(result.progress).reduce((sum,p)=>sum+p.level,0));assert.equal(achievementLevel('first-flight',2000,40),5);
});

test('a two-hour eight-game session lights only the two entry badges, even with perfect wins and rotating partners',()=>{
 const s=fixture();for(let i=0;i<8;i++){const mate='mate'+i;for(const id of [mate,'foe'+i,'foe'+(i+8)])s.players.push({id,name:id,ownerId:'',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});const m=game('short'+i,now-7200000+(i+1)*900000,true,mate);m.b=['foe'+i,'foe'+(i+8)];if(i<3){m.games=[{a:21,b:15},{a:15,b:21},{a:21,b:17}];m.scoreA=2;m.scoreB=1}s.matches.push(m)}
 const result=summary(s);assert.equal(result.matchDays,1);assert.equal(result.progress['first-flight'].current,8);assert.equal(result.progress['three-streak'].current,8);assert.equal(result.progress['ten-matches'].current,16);assert.equal(result.progress['five-partners'].current,8);assert.equal(result.progress['three-game-victory'].current,3);
 assert.equal(result.unlockedCount,2);assert.equal(result.totalLevels,2);for(const [id,p] of Object.entries(result.progress))assert.equal(p.level,['first-flight','first-victory'].includes(id)?1:0,id);
});

test('repeating many matches on one date cannot substitute for the silver participation requirement',()=>{
 const s=fixture();for(let i=0;i<30;i++)s.matches.push(game('same-day'+i,now-3600000+i*60000));assert.equal(summary(s).progress['first-flight'].level,1);
 s.matches.push(game('day-two',now-86400000),game('day-three',now-2*86400000));assert.equal(summary(s).matchDays,3);assert.equal(summary(s).progress['first-flight'].level,1);
 s.matches.push(game('day-four',now-3*86400000));const result=summary(s);assert.equal(result.matchDays,4);assert.equal(result.progress['first-flight'].level,2);assert.equal(result.progress['first-flight'].levelUnlockedAt[1],s.matches[16].end);
});

test('corrections revoke unsupported streak tiers; a later loss keeps supported lifetime milestones',()=>{
 const s=fixture();for(let i=0;i<15;i++)s.matches.push(game('w'+i,now-(15-i)*86400000));
 assert.equal(summary(s).progress['three-streak'].level,3);s.matches.push(game('lost',now-1000,false));assert.equal(summary(s).progress['three-streak'].level,3);
 Object.assign(s.matches[7],{scoreA:15,scoreB:21,games:[{a:15,b:21}]});const result=summary(s),p=result.progress['three-streak'];assert.equal(p.current,7);assert.equal(p.level,2);assert.equal(p.levelUnlockedAt[2],null);assert.equal(result.progress['first-victory'].level,2);
});

test('the forty-stage collection remains attainable with months of matches and long-term chemistry',()=>{
 const s=fixture();s.events[0].start=now-80*86400000;for(let i=0;i<20;i++)for(const prefix of ['mate','foe'])s.players.push({id:prefix+i,name:prefix+i,ownerId:'',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});
 for(let i=0;i<600;i++){const m=game('full'+String(i).padStart(3,'0'),now-(75-Math.floor(i/8))*86400000+(i%8)*900000,true,'mate'+(i<120?0:i%20));m.b=['foe'+i%20,'foe'+(i+1)%20];if(i<50){m.games=[{a:21,b:15},{a:15,b:21},{a:21,b:17}];m.scoreA=2;m.scoreB=1}s.matches.push(m)}
 const p=summary(s);assert.equal(p.matchDays,75);assert.equal(p.unlockedCount,8);assert.equal(p.totalLevels,40);for(const result of Object.values(p.progress)){assert.equal(result.level,5);assert.ok(result.levelUnlockedAt.every(at=>at!==null))}
});

test('rank frames are real generated WebP assets and are shared across all eight achievement themes',()=>{
 let bytes=0;for(let level=1;level<=5;level++){const file='public'+rankImage(level),data=readFileSync(file),image=validateImage(new Uint8Array(data),'image/webp');assert.equal(image.width,384);assert.equal(image.height,384);bytes+=data.byteLength}
 assert.ok(bytes<384*1024,'Shared rank ornaments should remain below 384 KiB');
});

test('consistency counts Madrid calendar dates, including midnight boundaries, not UTC days or number of events',()=>{
 const s=fixture();s.events[0].start=now-4*86400000;
 const ends=['2026-10-03T21:50:00Z','2026-10-03T22:10:00Z','2026-10-04T21:59:00Z'].map(Date.parse);
 s.matches=ends.map((end,i)=>game('date'+i,end,false));
 s.events.push({...s.events[0],id:'event-two'});s.matches.push({...game('other-event',ends[2]),eventId:'event-two'});
 s.matches.push({...game('cancelled-date',now-1000),status:'cancelled'},game('future-day',now+86400000));
 let result=summary(s);assert.equal(result.progress['first-flight'].current,4);assert.equal(result.progress['fifty-matches'].current,2);assert.equal(result.progress['fifty-matches'].level,0);assert.equal(result.progress['fifty-matches'].unlockedAt,null);
 const third=Date.parse('2026-10-05T08:00:00Z');s.matches.push(game('third-date',third,false));result=summary(s);assert.equal(result.matchDays,3);assert.equal(result.progress['fifty-matches'].level,1);assert.equal(result.progress['fifty-matches'].unlockedAt,third);
});

test('opponent breadth counts only distinct defeated opposing players, across either team side',()=>{
 const s=fixture();const first=game('first',now-6000),repeat=game('repeat',now-5000),loss=game('lost',now-4000,false);loss.b=['c','d'];
 const different=game('different',now-3000);different.b=['c','e'];
 const otherSide=game('other-side',now-2000);otherSide.a=['a','b'];otherSide.b=['p','c'];otherSide.scoreA=15;otherSide.scoreB=21;otherSide.games=[{a:15,b:21}];
 const earlier=game('earlier-date',now-86400000,false);earlier.b=['c','d'];
 s.matches=[earlier,first,repeat,loss,different,otherSide,{...first}];const result=summary(s);
 assert.equal(result.progress['ten-matches'].current,4);assert.equal(result.progress['ten-matches'].level,1);assert.equal(result.progress['ten-matches'].levelUnlockedAt[0],different.end);assert.equal(result.progress['ten-matches'].levelUnlockedAt[1],null);
 assert.equal(result.progress['first-victory'].current,4);assert.equal(result.progress['first-flight'].current,6);
 different.status='cancelled';assert.equal(summary(s).progress['ten-matches'].current,2);assert.equal(summary(s).progress['ten-matches'].level,0);
});

test('partner chemistry tracks the best individual partner rather than combining all wins or teammate breadth',()=>{
 const s=fixture();for(const [i,partner]of ['partner','c','partner','c','d'].entries())s.matches.push(game('partner'+i,now-10000+i*1000,true,partner));
 let result=summary(s);assert.equal(result.progress['first-victory'].current,5);assert.equal(result.progress['five-partners'].current,3);assert.equal(result.progress['ten-victories'].current,2);assert.equal(result.progress['ten-victories'].partnerId,'partner');
 const third=game('third-c',now-1000,true,'c');s.matches.push(third);result=summary(s);assert.equal(result.progress['ten-victories'].current,3);assert.equal(result.progress['ten-victories'].partnerId,'c');assert.equal(result.progress['ten-victories'].levelUnlockedAt[1],null);
 third.scoreA=15;third.scoreB=21;third.games=[{a:15,b:21}];result=summary(s);assert.equal(result.progress['ten-victories'].current,2);assert.equal(result.progress['ten-victories'].partnerId,'partner');assert.equal(result.progress['ten-victories'].levelUnlockedAt[1],null);
});

test('silver partner chemistry is one partner record across five play dates, not combined wins',()=>{
 const s=fixture();for(let i=0;i<10;i++)s.matches.push(game('chemistry'+i,now-(5-Math.floor(i/2))*86400000+(i%2)*900000));const p=summary(s);assert.equal(p.matchDays,5);assert.equal(p.progress['ten-victories'].current,10);assert.equal(p.progress['ten-victories'].level,2);assert.equal(p.progress['ten-victories'].levelUnlockedAt[0],s.matches[2].end);assert.equal(p.progress['ten-victories'].levelUnlockedAt[1],s.matches[8].end);
 s.matches[8].status='cancelled';s.matches[9].status='cancelled';const fewer=summary(s);assert.equal(fewer.matchDays,4);assert.equal(fewer.progress['ten-victories'].current,8);assert.equal(fewer.progress['ten-victories'].level,1);
});
