import test from 'node:test';
import assert from 'node:assert/strict';
import {canRebaseLineupWrite} from '../lib/lineup-write';
import {currentRoundSelection,fastLineupRefresh,liveLineupFormChanged,readBelowRevision} from '../lib/client/lineup-sync';
import {roundLineupSnapshot} from '../lib/domain/round-lineup';
import type {Event,Match,Round} from '../lib/domain/types';
const match:Match={id:'m',eventId:'e',roundId:'r',courtId:'court',a:['p0','p1'],b:['p2','p3'],status:'playing',start:1,end:null,games:[],scoreA:null,scoreB:null,locked:false,monthly:true,elo:true,enteredBy:null};
const round:Round={id:'r',eventId:'e',status:'playing',start:1,duration:15,eligible:[],rest:[],seed:1};
const event:Event={id:'e',status:'open',title:'Fixture',start:1,end:100000,venue:'Venue',address:'',capacity:8,signupDeadline:0,cancelDeadline:0,note:'',courtMode:'equal',ballMode:'equal'};
test('only displayed-lineup commands can rebase; legacy and unrelated writes keep revision checks',()=>{
 assert.equal(canRebaseLineupWrite('liveLineup',{expectedA:['p0'],expectedB:['p1']}),true);
 assert.equal(canRebaseLineupWrite('swap',{expectedLineup:[]}),true);
 assert.equal(canRebaseLineupWrite('score',{expectedA:['p0'],expectedB:['p1'],expectedGames:[]}),true,'a score with its opened games is guarded by the match itself');
 for(const [action,payload] of [['liveLineup',{}],['liveLineup',{expectedA:[]}],['swap',{}],['score',{expectedA:[],expectedB:[]}],['role',{expectedLineup:[]}]])assert.equal(canRebaseLineupWrite(String(action),payload),false);
});
test('live editor closes when displayed teams change, finish or disappear, but unrelated edits preserve it',()=>{
 const form={action:'liveLineup',values:{matchId:'m',expectedA:match.a,expectedB:match.b}};
 assert.equal(liveLineupFormChanged(form,{matches:[match,{...match,id:'other',a:['p4','p5']}]}),false);
 for(const matches of [[],[{...match,a:['p4','p1']}],[{...match,status:'complete' as const}],[{...match,games:[{a:21,b:19}]}]])assert.equal(liveLineupFormChanged(form,{matches}),true);
 assert.equal(liveLineupFormChanged({action:'eventEdit',values:{}},{matches:[]}),false);
 assert.equal(liveLineupFormChanged({...form,values:{...form.values,incomingId:'p4'}},{matches:[match,{...match,id:'other',a:['p4','p5']}]}),true,'a selected replacement claimed by another court invalidates the editor');
 assert.equal(liveLineupFormChanged(form,{matches:[match],events:[event]}),true,'switching off live play invalidates the live editor');
});
test('a two-click round selection is invalidated by changed teams, locks or a started round',()=>{
 const m={...match,status:'published' as const,start:null},r={...round,status:'published' as const};
 const selected={roundId:'r',playerId:'p0',lineup:roundLineupSnapshot([m])};
 assert.equal(currentRoundSelection(selected,{matches:[m],rounds:[r]}),selected);
 assert.equal(currentRoundSelection(selected,{matches:[{...m,a:['p4','p1']}],rounds:[r]}),null);
 assert.equal(currentRoundSelection(selected,{matches:[{...m,locked:true}],rounds:[r]}),null);
 assert.equal(currentRoundSelection(selected,{matches:[m],rounds:[round]}),null);
});
test('planned and round-by-round match views poll quickly without speeding unrelated pages',()=>{
 const data={matches:[match],rounds:[round],events:[event]};
 assert.equal(fastLineupRefresh('events','e','rounds',data),true);
 assert.equal(fastLineupRefresh('events','e','fees',data),false);
 assert.equal(fastLineupRefresh('events','other','rounds',data),false);
 assert.equal(fastLineupRefresh('home',undefined,undefined,data),true);
 assert.equal(fastLineupRefresh('events','e','rounds',{...data,rounds:[{...round,status:'complete'}]}),false);
 assert.equal(fastLineupRefresh('events','e','overview',{...data,events:[{...event,livePlay:{enabled:true} as Event['livePlay']}]}),true);
});
test('accepted and acknowledged revisions cannot be replaced by an older read',()=>{
 assert.equal(readBelowRevision({revision:11},12),true);
 assert.equal(readBelowRevision({revision:12},12),false);
 assert.equal(readBelowRevision({revision:13},12),false);
 assert.equal(readBelowRevision({},12),false,'entry/auth responses retain their normal handling');
});
