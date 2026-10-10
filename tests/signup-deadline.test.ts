import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
const hour=3600000,start=Date.parse('2027-04-10T12:00:00Z');
test('new activities preserve signup until the activity ends without an early deadline',async()=>{
 const s=emptyState();s.settings.initialized=true;
 s.accounts.push({id:'host',playerId:'p',role:'admin',email:''});s.players.push({id:'p',name:'Fixture Host',ownerId:'host',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 await apply(s,s.accounts[0],'event',{matchFormat:'doubles',start,end:start+2*hour,venue:'Fixture Venue',address:'',capacity:8,note:'',status:'open',bookings:[{name:'Court',start,end:start+2*hour,pricing:'total',cents:1200}]},start-48*hour);
 assert.equal(s.events[0].signupDeadline,s.events[0].end);
});
