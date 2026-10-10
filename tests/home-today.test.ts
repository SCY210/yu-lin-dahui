import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account,type Event,type Registration} from '../lib/domain/types';
import {courtLine,groupEvents,homeTodos,liveActivities,recentlyEnded,recentlyEndedHours} from '../lib/client/home-today';
const now=Date.parse('2030-10-08T12:00:00Z'),hour=3600000;
const me:Account={id:'acc-me',email:'me@club.example',role:'member',playerId:'me'};
const event=(id:string,start:number,end:number,extra:Partial<Event>={}):Event=>({id,title:'Fixture '+id,matchFormat:'doubles',creatorId:'host',start,end,venue:'Fixture venue',address:'',capacity:8,signupDeadline:start,cancelDeadline:start,note:'',status:'open',courtMode:'equal',ballMode:'equal',...extra});
const reg=(eventId:string,playerId:string,extra:Partial<Registration>={}):Registration=>({id:eventId+':'+playerId,eventId,playerId,sequence:1,status:'confirmed',arrival:0,departure:0,note:'',cancelRequested:false,courtExempt:{mode:'none',reason:''},ballExempt:{mode:'none',reason:''},...extra});
function fixture(){
 const s=emptyState();
 return {...s,me,players:[{id:'me',enabled:true},{id:'b',enabled:true},{id:'c',enabled:true},{id:'d',enabled:true}]};
}
test('one live card per running activity, with the viewer\'s own game, partners and opponents',()=>{
 const s=fixture(),e=event('live',now-hour,now+hour);s.events.push(e,event('later',now+hour,now+2*hour));s.registrations.push(reg('live','me'));
 s.bookings.push({id:'court',eventId:'live',name:'Court 1',start:e.start,end:e.end,pricing:'total',cents:690});
 s.rounds.push({id:'round',eventId:'live',start:e.start,duration:0,status:'playing',eligible:['me','b','c','d'],rest:[],seed:1,live:true,liveSequence:1});
 s.matches.push({id:'m',eventId:'live',roundId:'round',courtId:'court',a:['c','d'],b:['me','b'],status:'playing',start:now-1000,end:null,scoreA:null,scoreB:null,monthly:true,elo:true,locked:false,enteredBy:null,games:[]});
 const live=liveActivities(s,now);
 assert.deepEqual(live.map(a=>a.event.id),['live']);
 assert.equal(live[0].registered,true);assert.equal(live[0].matches.length,1);
 assert.deepEqual(live[0].myMatch?.partners,['b']);assert.deepEqual(live[0].myMatch?.opponents,['c','d']);
 s.matches[0].b=['x','y'];assert.equal(liveActivities(s,now)[0].myMatch,undefined);
 s.events[0].status='ended';assert.deepEqual(liveActivities(s,now),[]);
});
test('finished activities stay for the recent window, including ones ended early, and report the viewer\'s vote',()=>{
 const s=fixture();
 s.events.push(event('just',now-3*hour,now-hour),event('old',now-10*hour,now-recentlyEndedHours*hour),event('early',now-hour,now+hour,{status:'ended'}),event('gone',now-3*hour,now-hour,{status:'cancelled'}));
 s.awardVotes.push({id:'v',eventId:'just',voterId:me.id,playerId:'b',category:'mvp',at:now-1000});
 const ended=recentlyEnded(s,now);
 assert.deepEqual(ended.map(e=>e.event.id),['early','just']);
 assert.equal(ended.find(e=>e.event.id==='just')?.voted,true);assert.equal(ended.find(e=>e.event.id==='early')?.voted,false);
});
test('todos cover closing sign-ups and recent promotions, once per activity',()=>{
 const s=fixture();
 s.events.push(event('soon',now+48*hour,now+50*hour,{signupDeadline:now+2*hour}),event('far',now+96*hour,now+98*hour,{signupDeadline:now+72*hour}),event('joined',now+48*hour,now+50*hour,{signupDeadline:now+hour}),event('promo',now+5*hour,now+7*hour));
 s.registrations.push(reg('joined','me'),reg('promo','me',{promotedAt:now-hour}));
 const todos=homeTodos(s,now);
 assert.deepEqual(todos.map(t=>t.kind+':'+t.eventId),['promoted:promo','signup:soon']);
 assert.match(todos[1].detail,/2 小时后截止/);
 s.registrations[1].promotedAt=now-30*hour;assert.deepEqual(homeTodos(s,now).map(t=>t.eventId),['soon']);
});
test('the activities page groups my sign-ups, open activities, the rest and the history',()=>{
 const s=fixture();
 s.events.push(event('mine',now+2*hour,now+4*hour,{signupDeadline:now+hour}),event('open',now+hour,now+3*hour,{signupDeadline:now+hour/2}),event('locked',now+hour,now+3*hour,{status:'locked'}),event('past',now-4*hour,now-2*hour),event('cancelled',now+hour,now+2*hour,{status:'cancelled'}));
 s.registrations.push(reg('mine','me'),reg('open','me',{status:'cancelled'}));
 const g=groupEvents(s,now);
 assert.deepEqual([g.mine,g.open,g.other,g.past].map(l=>l.map(e=>e.id)),[['mine'],['open'],['locked'],['cancelled','past']]);
});
test('the on-court line spaces out numbered court names and falls back without a court',()=>{
 assert.equal(courtLine('1 号场'),'你正在 1 号场比赛');assert.equal(courtLine('Court A'),'你正在 Court A 比赛');
 assert.equal(courtLine('主场'),'你正在主场比赛');assert.equal(courtLine(undefined),'你正在场上比赛');
});
