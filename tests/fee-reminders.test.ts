import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {dueFeeReminders,reminderHours,type FeeReminderProgress} from '../lib/fee-reminders';
import {emptyState,type Account,type State} from '../lib/domain/types';

// Confirmed at 10:00 in Madrid (CEST), so every 24-hour step falls inside reminder hours.
const confirmed=Date.parse('2026-10-20T08:00:00Z'),hour=3600000,day=24*hour;
const owner:Account={id:'owner',email:'',role:'admin',playerId:'p0'};
const admin:Account={id:'admin',email:'',role:'admin',playerId:'p9'};
const alice:Account={id:'alice',email:'',role:'member',playerId:'p1'};
const bob:Account={id:'bob',email:'',role:'member',playerId:'p2'};
function fixture(created=confirmed):State{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=owner.id;s.accounts=[owner,admin,alice,bob].map(a=>({...a}));
 s.players=[...s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''})),
  {id:'friend',name:'小明',ownerId:'alice',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}];
 s.events.push({id:'e',creatorId:owner.id,title:'周四双打',start:created-4*hour,end:created-2*hour,venue:'球馆',address:'',capacity:8,signupDeadline:created-5*hour,cancelDeadline:created-5*hour,note:'',status:'ended',courtMode:'equal',ballMode:'equal'});
 const bills=['p0','p1','p2','friend'].map(playerId=>({playerId,court:600,ball:0,other:0,total:600,minutes:120}));
 s.settlements.push({id:'v1',eventId:'e',version:1,created,reason:'确认',confirmed:true,total:2400,subsidy:0,unallocated:0,bills,detail:[]});
 return s;
}
const pay=(s:State,a:Account,playerId:string,at:number)=>apply(s,a,'feePaid',{eventId:'e',settlementId:'v1',playerId,paid:true},at);
/** Runs the sweep like the hourly cron: notices are "sent" and the returned progress is stored. */
function sweep(s:State,progress:{value:FeeReminderProgress},now:number){const {notices,progress:next}=dueFeeReminders(s,progress.value,now);progress.value=next;return notices}
const recipients=(notices:ReturnType<typeof sweep>)=>notices.flatMap(n=>n.accountIds).sort();

test('unpaid bills are reminded 24, 48 and 72 hours after confirmation, then the owner and administrators are told once',async()=>{
 const s=fixture(),progress={value:{}};
 await pay(s,owner,'p0',confirmed+hour);
 assert.deepEqual(sweep(s,progress,confirmed+23*hour),[],'not before 24 hours');
 const first=sweep(s,progress,confirmed+day);
 assert.deepEqual(recipients(first),['alice','bob'],'the owner paid; alice also covers her friend');
 assert.ok(first.every(n=>n.kind==='fees'&&n.due&&n.settlementId==='v1'&&n.tab==='fees'));
 assert.deepEqual(first.find(n=>n.accountIds[0]==='alice')!.proxyPlayerIds,['friend']);
 assert.deepEqual(sweep(s,progress,confirmed+day+hour),[],'the next hourly tick sends nothing');
 await pay(s,bob,'p2',confirmed+30*hour);
 assert.deepEqual(recipients(sweep(s,progress,confirmed+2*day)),['alice'],'paying stops the reminders');
 assert.deepEqual(recipients(sweep(s,progress,confirmed+3*day)),['alice']);
 assert.deepEqual(sweep(s,progress,confirmed+3*day+23*hour),[],'never a fourth automatic reminder');
 const overdue=sweep(s,progress,confirmed+4*day);
 assert.equal(overdue.length,1);assert.deepEqual(overdue[0].accountIds.sort(),['admin','owner']);
 assert.ok(overdue[0].overdue&&!overdue[0].due);assert.match(overdue[0].body,/自动提醒 3 次，仍有 2 人未标记付款：alice、小明/);
 assert.equal(new Set([...first,...overdue].map(n=>n.id)).size,first.length+1,'every notice has its own id');
 assert.deepEqual(sweep(s,progress,confirmed+5*day),[],'the owner is told only once');
});

test('reminders wait for the morning, a missed step is sent once, and paid, old or withdrawn splits are left alone',async()=>{
 // Confirmed at 22:30 in Madrid: the first reminder, due at 22:30 the next day, waits until 09:00 the morning after.
 const late=Date.parse('2026-10-20T20:30:00Z'),s=fixture(late),progress={value:{}};
 assert.equal(reminderHours(late+day),false);assert.deepEqual(sweep(s,progress,late+day),[]);
 assert.equal(reminderHours(Date.parse('2026-10-22T07:00:00Z')),true);
 assert.equal(sweep(s,progress,Date.parse('2026-10-22T07:00:00Z')).length,3,'three accounts owe (alice covers her friend), sent at 09:00');
 // The cron was down for days: one reminder, then straight on to the owner the next day.
 const down=fixture(),gap={value:{}};assert.equal(sweep(down,gap,confirmed+3*day+hour).length,3);assert.deepEqual(gap.value,{v1:{sent:3}});
 assert.equal(sweep(down,gap,confirmed+4*day).filter(n=>n.overdue).length,1);
 // Everyone paid: nothing is sent and the split leaves the progress.
 const paid=fixture(),done={value:{v1:{sent:1}} as FeeReminderProgress};for(const [a,id] of [[owner,'p0'],[alice,'p1'],[alice,'friend'],[bob,'p2']] as const)await pay(paid,a,id,confirmed+hour);
 assert.deepEqual(sweep(paid,done,confirmed+2*day),[]);assert.deepEqual(done.value,{});
 // Splits confirmed more than a week ago are not reminded automatically.
 assert.deepEqual(sweep(fixture(),{value:{}},confirmed+8*day),[]);
 // Deleted and cancelled activities, and an unconfirmed split.
 for(const change of [(s:State)=>{s.events[0].deletedAt=confirmed},(s:State)=>{s.events[0].status='cancelled'},(s:State)=>{s.settlements[0].confirmed=false}]){const x=fixture();change(x);assert.deepEqual(sweep(x,{value:{}},confirmed+day),[])}
});

test('a newer confirmed version starts its own reminder schedule',()=>{
 const s=fixture(),progress={value:{}};
 assert.equal(sweep(s,progress,confirmed+day).length,3);
 s.settlements.push({...structuredClone(s.settlements[0]),id:'v2',version:2,created:confirmed+30*hour});
 assert.deepEqual(sweep(s,progress,confirmed+2*day),[],'v2 is only 18 hours old');
 const next=sweep(s,progress,confirmed+30*hour+day);assert.ok(next.length&&next.every(n=>n.settlementId==='v2'));
 assert.deepEqual(Object.keys(progress.value),['v2'],'the replaced version is forgotten');
});
