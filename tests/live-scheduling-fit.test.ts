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
test('planned stays the recommendation, with the cases for live scheduling spelled out',()=>{
 const advice=recommendedSchedulingMode();assert.equal(advice.mode,'planned');assert.equal(advice.live.length,2);
 assert.ok(advice.live[0].includes('每片场只多 1 人')&&advice.live[1].includes('不连续上场'));
});
