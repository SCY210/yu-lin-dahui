import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildRealmHistory,realmHistoryView} from '../lib/realm-history';
import {realmLedger,replayRealmScores,isRatedMatch,realmPolicy,inactivityDeadline,type RealmChange} from '../lib/domain/realm-rating';
import {ratingAdjustments} from '../lib/domain/point-grants';
import {emptyState,type Match,type Event} from '../lib/domain/types';

const now=Date.parse('2026-11-08T12:00:00Z'),hour=3600000;
function fixture(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='A';
 for(const id of ['A','B','C','D']){s.players.push({id,name:id,ownerId:id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''});s.accounts.push({id,playerId:id,email:'',role:id==='A'?'admin':'member'})}
 const event:Event={id:'done',creatorId:'A',title:'已结算活动',start:now-5*hour,end:now-2*hour,venue:'球馆',address:'',capacity:4,signupDeadline:now-5*hour,cancelDeadline:now-24*hour,note:'',status:'ended',attendanceMode:'automatic',courtMode:'equal',ballMode:'equal'};
 s.events=[event,{...event,id:'live',title:'进行中活动',start:now-hour,end:now+hour,status:'open'}];
 return s;
}
function match(id:string,eventId='done',end=now-3*hour):Match{return {id,eventId,roundId:'round',courtId:'court',a:['A','B'],b:['C','D'],status:'complete',start:end-60000,end,scoreA:21,scoreB:19,monthly:true,elo:true,locked:false,enteredBy:'A',games:[{a:21,b:19}]}}
function grant(s:ReturnType<typeof fixture>,id:string,at:number,rating:number){s.audits.push({id,at,actor:'A',action:'grantPoints',reason:'修为调整原因',changes:{playerId:'A',period:'2026-11',points:0,rating,reason:'修为调整原因'}})}

test('修为明细逐笔加总与当前已结算及含待结算修为一致，不改状态',()=>{
 const s=fixture();s.matches=[match('one'),{...match('two','done',now-2.5*hour),games:[{a:21,b:19},{a:19,b:21},{a:21,b:18}]},match('pending','live',now-0.5*hour)];
 grant(s,'before',now-4*hour,100);grant(s,'after',now-2*hour,-20);
 const before=structuredClone(s),history=buildRealmHistory(s,now),ledger=realmLedger(s,now);
 for(const player of s.players){
  const view=realmHistoryView(s,s.accounts[0],player.id,history),score=ledger.snapshot.get(player.id)!;
  assert.equal(view.score,score.score);assert.equal(view.liveScore,score.score+score.pendingChange);
  for(const [rows,total] of [[view.settled,view.score],[view.live,view.liveScore]] as const){
   let running=view.initial;for(const row of [...rows].reverse()){assert.equal(row.before,running);assert.equal(row.after-row.before,row.delta);running=row.after}assert.equal(running,total);
  }
 }
 const view=realmHistoryView(s,s.accounts[0],'A',history);
 assert.equal(view.settled.filter(r=>r.kind==='game').length,4);assert.equal(view.live.filter(r=>r.pending).length,1);
 assert.ok(view.settled.some(r=>r.kind==='adjustment'&&r.delta===100&&r.reason==='修为调整原因'));
 assert.deepEqual(s,before);
});

test('连续三个月的重置明确列出数值，重新定级后仍逐笔对账',()=>{
 const s=fixture(),old=Date.parse('2026-06-01T12:00:00Z');
 s.events[0].start=old-2*hour;s.events[0].end=old+hour;s.matches=[match('old','done',old)];
 const view=realmHistoryView(s,s.accounts[0],'A',buildRealmHistory(s,now)),reset=view.settled.find(r=>r.kind==='reset');
 assert.ok(reset);assert.equal(reset.at,inactivityDeadline(old));assert.equal(reset.before,1016);assert.equal(reset.after,1000);assert.equal(reset.delta,-16);assert.equal(view.score,1000);
 s.matches.push(match('returned','done',now-3*hour));
 const returned=realmHistoryView(s,s.accounts[0],'A',buildRealmHistory(s,now));
 assert.equal(returned.score,1016);assert.equal(returned.settled.filter(r=>r.kind==='reset').length,1);
});

test('开启追踪不改变任何回放结果，取消、未来、未完成和让分局沿用原规则',()=>{
 const s=fixture();s.matches=[match('valid'),{...match('cancelled'),status:'cancelled'},match('future','done',now+hour),{...match('unfinished'),status:'playing'},{...match('handicap'),handicap:{side:'a',points:3,applied:true}}];
 grant(s,'manual',now-4*hour,70);const include=(m:Match)=>isRatedMatch(m,now),adjustments=ratingAdjustments(s),trace:RealmChange[]=[];
 const plain=replayRealmScores(s,include,()=>true,realmPolicy.doubles,now,adjustments);
 const traced=replayRealmScores(s,include,()=>true,realmPolicy.doubles,now,adjustments,row=>trace.push(row));
 assert.deepEqual(traced,plain);assert.equal(trace.filter(r=>r.kind==='game').length,4);
});

test('不可见活动隐藏名称、编号和对战数据，手动原因仅本人或管理员可见',()=>{
 const s=fixture();s.matches=[match('secret')];s.events[0].deletedAt=now-hour;s.events[0].title='不可泄露的标题';grant(s,'manual',now-4*hour,50);
 const history=buildRealmHistory(s,now),view=realmHistoryView(s,s.accounts[2],'A',history);
 assert.ok(!JSON.stringify(view).includes('不可泄露的标题'));assert.ok(view.settled.some(r=>r.kind==='game'&&r.title==='历史计分小局'&&r.eventId===undefined&&r.opponent===undefined));
 assert.ok(!view.settled.find(r=>r.kind==='adjustment')!.reason);
 assert.equal(realmHistoryView(s,s.accounts[0],'A',history).settled.find(r=>r.kind==='adjustment')!.reason,'修为调整原因');
});
