import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerClubWebMcp} from '../lib/client/club-webmcp';
import type {ClubData} from '../lib/contracts/club';

test('browser signup prepares human confirmation without repeated notice consent and validates activity scope',async()=>{
 const registered=new Map<string,{execute:(input:unknown)=>Promise<unknown>}>(),opened:unknown[][]=[];
 let signal:AbortSignal|undefined;
 const data={me:{id:'account',playerId:'player'},events:[{id:'e'}],bookings:[{id:'b',eventId:'e'},{id:'foreign',eventId:'other'}]} as unknown as ClubData;
 const cleanup=registerClubWebMcp({current:()=>data,refresh:async()=>data,openSignup:(...args)=>{opened.push(args)}},{modelContext:{registerTool:(tool,options)=>{registered.set(tool.name,tool);signal=options.signal}}});
 const signup=registered.get('register_for_event')!;
 await assert.rejects(()=>signup.execute(null),/请选择/);
 await assert.rejects(()=>signup.execute({eventId:'e',bookingId:'foreign'}),/此活动/);
 assert.equal(opened.length,0);
 const result=await signup.execute({eventId:'e',bookingId:'b'});
 assert.deepEqual(result,{requiresConfirmation:true,message:'已打开接龙表单，请确认参加场地与时段，再提交接龙。'});
 assert.deepEqual(opened,[[data.events[0],data.bookings[0],data.me]]);
 assert.equal(signal?.aborted,false);cleanup();assert.equal(signal?.aborted,true);
 await assert.rejects(()=>signup.execute({eventId:'e',bookingId:'b'}),/已关闭/);
 assert.equal(opened.length,1);
});
test('browser reads only expose own registrations and missing WebMCP is harmless',async()=>{
 const registered=new Map<string,{execute:(input:unknown)=>Promise<unknown>}>();
 const data={me:{id:'me',playerId:'mine'},events:[],bookings:[],registrations:[{id:'own',playerId:'mine'},{id:'other',playerId:'other'}]} as unknown as ClubData;
 const options={current:()=>data,refresh:async()=>data,openSignup:()=>{throw new Error('Read must not open a signup')}};
 const cleanup=registerClubWebMcp(options,{modelContext:{registerTool:tool=>{registered.set(tool.name,tool)}}});
 const result=await registered.get('read_club_overview')!.execute({}) as {myRegistrations:unknown[]};assert.deepEqual(result.myRegistrations,[data.registrations[0]]);
 cleanup();assert.doesNotThrow(()=>registerClubWebMcp(options,{})());
});
