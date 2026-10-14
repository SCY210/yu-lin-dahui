import {test} from 'node:test';import assert from 'node:assert/strict';
import {coinRewardStart} from '../lib/coin-reward-clock';
import {runCoinRewardSweep,coinRewardSweepKey,coinRewardSweepInterval} from '../lib/coin-reward-sweep';
function port({policy=true,due=false,matchDue=false,cursor=0,fail=false}:{policy?:boolean;due?:boolean;matchDue?:boolean;cursor?:number;fail?:boolean}={}){
 let settled=0,written=0;const queries:string[]=[];
 const db={prepare(sql:string){queries.push(sql);let args:unknown[]=[];const statement={bind(...v:unknown[]){args=v;return statement},async first(){if(sql.includes('FROM events'))return due||matchDue?{id:'fictional-ended-event'}:null;if(args[0]===coinRewardSweepKey)return cursor?{payload:JSON.stringify({through:cursor})}:null;return {payload:JSON.stringify({initialized:true,...(policy?{automaticCoins:{activatedAt:1000}}:{})})}},async run(){written++;return {success:true}}};return statement}} as unknown as D1Database;
 return {db,now:coinRewardSweepInterval+5000,async settle(){settled++;if(fail)throw Error('fictional failed save')},counts:()=>({settled,written}),queries};
}
test('first scheduler invocation activates policy; later idle ticks scan metadata only',async()=>{const first=port({policy:false});await runCoinRewardSweep(first);assert.deepEqual(first.counts(),{settled:1,written:1});const idle=port({cursor:4000});await runCoinRewardSweep(idle);assert.deepEqual(idle.counts(),{settled:0,written:1});assert.equal(idle.queries.filter(s=>s.includes('FROM events')).length,1)});
test('due activities settle and failed transactions never advance the scheduler cursor',async()=>{const ready=port({due:true});await runCoinRewardSweep(ready);assert.deepEqual(ready.counts(),{settled:1,written:1});const failed=port({due:true,fail:true});await assert.rejects(runCoinRewardSweep(failed));assert.deepEqual(failed.counts(),{settled:1,written:0})});
test('a completed result whose own timestamp becomes valid later triggers another reconciliation',async()=>{const delayed=port({cursor:4000,matchDue:true});await runCoinRewardSweep(delayed);assert.equal(delayed.counts().settled,1);assert.ok(delayed.queries.some(s=>s.includes('FROM matches')))});
test('waiting wakeups never scan or move the five-hour cursor, including across midnight',async()=>{
 const cursor=Date.parse('2035-01-01T20:00:00Z');
 for(const elapsed of [3600000,4*3600000,coinRewardSweepInterval-1]){const waiting=port({cursor,due:true});waiting.now=cursor+elapsed;await runCoinRewardSweep(waiting);assert.deepEqual(waiting.counts(),{settled:0,written:0});assert.equal(waiting.queries.length,1)}
 const boundary=port({cursor,due:true});boundary.now=cursor+coinRewardSweepInterval;await runCoinRewardSweep(boundary);assert.deepEqual(boundary.counts(),{settled:1,written:1});
});
test('version timestamp supplies a stable server-owned activation boundary',()=>{const at=Date.parse('2035-01-01T00:00:00Z');assert.equal(coinRewardStart('2035-01-01T00:00:00Z',at+60000),at);for(const invalid of [undefined,'bad','2036-01-01T00:00:00Z'])assert.equal(coinRewardStart(invalid,at),at)});
