import {test} from 'node:test';
import assert from 'node:assert/strict';
import {liveSchedulingFits,recommendedSchedulingMode} from '../lib/domain/scheduling';

test('about one player resting per court is the case live scheduling fills sooner',()=>{
 assert.equal(liveSchedulingFits(9,2,4),true);assert.equal(liveSchedulingFits(10,2,4),true);
 assert.equal(liveSchedulingFits(13,3,4),true);assert.equal(liveSchedulingFits(15,3,4),true);
 assert.equal(liveSchedulingFits(8,2,4),false,'nobody rests');assert.equal(liveSchedulingFits(11,2,4),false,'enough on the bench');
 assert.equal(liveSchedulingFits(7,2,4),false,'too few for both courts');assert.equal(liveSchedulingFits(5,2,2),true,'singles: two per court');
 assert.equal(liveSchedulingFits(4,0,4),false,'no courts');
});
test('one court recommends planned, two or more live, each with the cases for the other spelled out',()=>{
 const one=recommendedSchedulingMode(1);assert.equal(one.mode,'planned');assert.equal(one.other,'live');assert.equal(one.cases.length,2);
 assert.ok(one.cases[0].includes('只多 1 人')&&one.cases[1].includes('不连续上场'));
 const two=recommendedSchedulingMode(2);assert.equal(two.mode,'live');assert.equal(two.other,'planned');assert.ok(two.cases[0].includes('强弱更接近'));
 assert.equal(recommendedSchedulingMode(3).mode,'live');
});
