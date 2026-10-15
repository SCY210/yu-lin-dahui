import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchHistory,matchupKey} from '../lib/domain/match-history';
import {emptyState,type Match} from '../lib/domain/types';

test('matchup identity ignores side and teammate order without ambiguous IDs',()=>{
 assert.equal(matchupKey(['a','b'],['c','d']),matchupKey(['d','c'],['b','a']));
 assert.notEqual(matchupKey(['a','b'],['c','d']),matchupKey(['a','c'],['b','d']));
 assert.notEqual(matchupKey(['a:b','c'],['d','e']),matchupKey(['a','b:c'],['d','e']));
});
test('history excludes cancelled, draft, foreign and no-show matches; live ignores unstarted plans',()=>{
 const s=emptyState();
 const base:Match={id:'complete',eventId:'e',roundId:'r',courtId:'c',a:['a','b'],b:['c','d'],status:'complete',start:100,end:200,scoreA:21,scoreB:19,games:[],monthly:true,elo:true,locked:false,enteredBy:null};
 s.matches.push(base,{...base,id:'plan',status:'published',start:null},
  {...base,id:'draft',status:'draft'},{...base,id:'cancel',status:'cancelled'},
  {...base,id:'foreign',eventId:'other'},{...base,id:'absent',status:'forfeit',noShow:['a']});
 assert.equal(matchHistory(s,'e').rematches(['d','c'],['b','a']),2);
 const live=matchHistory(s,'e',true);assert.equal(live.rematches(base.a,base.b),1);
 live.add(base);assert.equal(live.rematches(base.a,base.b),2);
 assert.equal(s.matches.length,6,'indexing never mutates stored history');
});
