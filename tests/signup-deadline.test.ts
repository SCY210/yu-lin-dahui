import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {initialSignupDeadline,signupClosed,signupClosesAt,signupCloseHours} from '../lib/domain/event-lifecycle';
const hour=3600000,start=Date.parse('2027-04-10T12:00:00Z'),end=start+3*hour;

test('sign-ups close two hours before the start; short-notice activities stay open until they start',()=>{
 assert.equal(signupCloseHours,2);
 assert.equal(initialSignupDeadline(start,start-48*hour),start-2*hour);
 assert.equal(initialSignupDeadline(start,start-hour),start,'created within two hours of the start');
 assert.equal(signupClosesAt({start,end,signupDeadline:end}),start-2*hour,'activities created before the rule stored their end time');
 assert.equal(signupClosesAt({start,end,signupDeadline:start}),start);
 assert.equal(signupClosesAt({start,end,signupDeadline:undefined as unknown as number}),start-2*hour,'missing deadline');
 assert.equal(signupClosed({start,end,signupDeadline:start-2*hour},start-2*hour-1),false);
 assert.equal(signupClosed({start,end,signupDeadline:start-2*hour},start-2*hour),true);
});

test('creating an activity stores the deadline from the rule',async()=>{
 const s=emptyState();s.settings.initialized=true;
 s.accounts.push({id:'host',playerId:'p',role:'admin',email:''});s.players.push({id:'p',name:'虚构组织者',ownerId:'host',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 const input=(title:string,at:number)=>({title,matchFormat:'doubles',start:at,end:at+2*hour,venue:'虚构球馆',address:'',capacity:8,cancelDeadline:at,note:'',status:'open',bookings:[{name:'一号场',start:at,end:at+2*hour,pricing:'total',cents:1200}]});
 await apply(s,s.accounts[0],'event',input('提前创建',start),start-48*hour);
 await apply(s,s.accounts[0],'event',input('临时加场',start+24*hour),start+23*hour);
 assert.equal(s.events.find(e=>e.title==='提前创建')!.signupDeadline,start-2*hour);
 assert.equal(s.events.find(e=>e.title==='临时加场')!.signupDeadline,start+24*hour);
});
