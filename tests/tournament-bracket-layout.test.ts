import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tournamentBracketLayout,bracketCard} from '../lib/client/tournament-bracket-layout';
import type {TournamentFixture} from '../lib/domain/tournament';
function bracket(size:number){const fixtures:TournamentFixture[]=[];let previous:TournamentFixture[]=[];for(let round=1,count=size/2;count>=1;round++,count/=2){const current:TournamentFixture[]=[];for(let slot=0;slot<count;slot++)current.push({id:round+':'+slot,stage:'knockout',round,slot,...(round===1?{}:{fromA:previous[slot*2].id,fromB:previous[slot*2+1].id})});fixtures.push(...current);previous=current}return fixtures}
test('2 to 32 entrant brackets mirror both halves into one centered final without overlapping nodes',()=>{
 for(const size of [2,4,8,16,32]){const fixtures=bracket(size),layout=tournamentBracketLayout(fixtures);assert.equal(layout.nodes.length,size-1);assert.equal(layout.links.length,size-2);const final=layout.nodes.find(n=>n.side==='final')!;assert.equal(final.x+bracketCard.width/2,layout.width/2);assert.equal(final.label,'决赛');
  for(const n of layout.nodes){assert.ok(n.x>=0&&n.x+bracketCard.width<=layout.width);assert.ok(n.y>=0&&n.y+bracketCard.height<=layout.height);for(const other of layout.nodes.filter(x=>x.fixture.id!==n.fixture.id))assert.ok(n.x+bracketCard.width<=other.x||other.x+bracketCard.width<=n.x||n.y+bracketCard.height<=other.y||other.y+bracketCard.height<=n.y,'no overlapping fixture boxes')}
  for(let round=1;round<Math.log2(size);round++){const left=layout.nodes.filter(n=>n.fixture.round===round&&n.side==='left'),right=layout.nodes.filter(n=>n.fixture.round===round&&n.side==='right');assert.equal(left.length,right.length);for(let i=0;i<left.length;i++){assert.equal(left[i].x+right[i].x+bracketCard.width,layout.width);assert.equal(left[i].y,right[i].y)}}
  assert.deepEqual(layout,tournamentBracketLayout([...fixtures].reverse()),'stored ordering does not change geometry');
 }
});
test('connectors follow persisted fixture ancestry rather than inventing new pairings or drawing group games',()=>{
 const fixtures=bracket(8);fixtures.push({id:'group',stage:'group',group:0,round:1,slot:0,a:'a',b:'b'});const layout=tournamentBracketLayout(fixtures);
 for(const link of layout.links){const parent=fixtures.find(f=>f.id===link.to)!;assert.ok([parent.fromA,parent.fromB].includes(link.from));assert.match(link.path,/^M [\d.]+ [\d.]+ H [\d.]+ V [\d.]+ H [\d.]+$/)}assert.equal(layout.nodes.length,7);assert.equal(layout.nodes.filter(n=>n.label==='半决赛').length,2);assert.equal(layout.nodes.filter(n=>n.label==='四分之一决赛').length,4);
});
