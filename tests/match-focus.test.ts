import {test} from 'node:test';
import assert from 'node:assert/strict';
import {focusTarget} from '../app/match-focus';
import type {Match,Round} from '../lib/domain/types';

const match=(id:string,roundId:string,status:Match['status'],a:string[],b:string[]):Match=>({id,eventId:'e',roundId,courtId:'c',a,b,status,start:status==='published'?null:1,end:status==='complete'?2:null,scoreA:null,scoreB:null,games:[],monthly:true,elo:true,locked:false,enteredBy:null});
const data={me:{playerId:'me'},rounds:[] as Round[],matches:[
 match('done','r1','complete',['me','p1'],['p2','p3']),
 match('court1','r2','playing',['p4','p5'],['p6','p7']),
 match('mine','r2','playing',['p8','me'],['p9','p10']),
 match('next','r3','published',['me','p2'],['p4','p6']),
 match('other-event','r2','playing',['me','x'],['y','z']),
]};
data.matches[4].eventId='other';

test('a named match is the target, wherever it is in the activity',()=>{
 assert.equal(focusTarget(data,{id:'e'},{matchId:'done'},true)?.id,'done');
 assert.equal(focusTarget(data,{id:'e'},{matchId:'other-event'},true),undefined,'never a match of another activity');
});
test('a named round targets the member’s own match in it, else its first',()=>{
 assert.equal(focusTarget(data,{id:'e'},{roundId:'r2'},true)?.id,'mine');
 assert.equal(focusTarget({...data,me:{playerId:'nobody'}},{id:'e'},{roundId:'r2'},true)?.id,'court1');
});
test('without a link, the game in progress is the target once: the member’s own first',()=>{
 assert.equal(focusTarget(data,{id:'e'},undefined,true)?.id,'mine');
 assert.equal(focusTarget({...data,me:{playerId:'nobody'}},{id:'e'},undefined,true)?.id,'court1');
 assert.equal(focusTarget(data,{id:'e'},undefined,false),undefined,'after the first visit nothing moves the page');
 assert.equal(focusTarget({...data,matches:data.matches.filter(m=>m.status!=='playing')},{id:'e'},undefined,true),undefined,'nothing in progress');
});
