import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearMatchScore,pendingMatchScore,requestMatchScore,subscribeMatchScore} from '../lib/client/score-intent';

test('a score request is one-shot: only its own match clears it, and listeners hear each change',()=>{
 const heard:string[]=[];const stop=subscribeMatchScore(()=>heard.push(pendingMatchScore()));
 requestMatchScore('m1');assert.equal(pendingMatchScore(),'m1');
 clearMatchScore('other');assert.equal(pendingMatchScore(),'m1','another card cannot drop it');
 clearMatchScore('m1');assert.equal(pendingMatchScore(),'');
 stop();requestMatchScore('m2');assert.deepEqual(heard,['m1','']);clearMatchScore('m2');
});
