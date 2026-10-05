import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HALF_HOUR,ceilHalfHour,madridDateTime,madridEpoch,plannedEpoch,plannedInterval,plannedDateChange,shiftActivityTimes} from '../lib/time-planning';

test('计划默认值向上取整点或半点，已在边界时不再推进',()=>{
 const exact=Date.parse('2026-10-05T14:30:00Z');assert.equal(ceilHalfHour(exact),exact);
 assert.equal(ceilHalfHour(exact+1),exact+HALF_HOUR);assert.equal(ceilHalfHour(exact-1),exact);
 assert.equal(madridDateTime(ceilHalfHour(Date.parse('2026-10-05T14:17:26.351Z'))),'2026-10-05T16:30');
});

test('下一半点可以跨马德里午夜，日期和结束默认仍合法',()=>{
 const start=ceilHalfHour(Date.parse('2026-10-05T21:47:00Z'));
 assert.equal(madridDateTime(start),'2026-10-06T00:00');assert.equal(madridDateTime(start+3*3600000),'2026-10-06T03:00');
 assert.equal(madridEpoch(madridDateTime(start)),start);
});

test('春季夏令时向上取半点直接进入03点，不生成不存在的02点',()=>{
 const next=ceilHalfHour(Date.parse('2026-03-29T00:47:00Z'));assert.equal(madridDateTime(next),'2026-03-29T03:00');
 assert.throws(()=>madridEpoch('2026-03-29T02:00'),/夏令时/);assert.throws(()=>madridEpoch('2026-03-29T02:30'),/夏令时/);
 assert.equal(madridEpoch('2026-03-29T03:00'),next);
});

test('冬夏季马德里时间解析保持对应UTC偏移，非法日期拒绝',()=>{
 assert.equal(madridEpoch('2026-01-05T18:30'),Date.parse('2026-01-05T17:30:00Z'));
 assert.equal(madridEpoch('2026-07-05T18:30'),Date.parse('2026-07-05T16:30:00Z'));
 assert.throws(()=>madridEpoch('2026-02-30T18:30'));assert.throws(()=>madridEpoch('not-a-date'));
});

test('新预约和接龙默认半点区间始终落在活动原区间内',()=>{
 const start=Date.parse('2026-10-05T14:17:19.381Z'),end=Date.parse('2026-10-05T17:17:02.943Z');
 const p=plannedInterval(start,end);assert.equal(p.start,Date.parse('2026-10-05T14:30:00Z'));assert.equal(p.end,Date.parse('2026-10-05T17:00:00Z'));
 assert.ok(p.start>=start&&p.end<=end&&p.end>p.start);
});

test('不足两个半点边界的历史活动保留原区间，避免无效零时长',()=>{
 const start=Date.parse('2026-10-05T14:17:19.381Z'),end=start+20*60000;
 assert.deepEqual(plannedInterval(start,end),{start,end});assert.throws(()=>plannedInterval(start,start));
});

test('未修改旧显示时间保留秒和毫秒，编辑后使用新整半点，旧费用时长不被截断',()=>{
 const old=Date.parse('2026-10-05T14:17:19.381Z'),shown=madridDateTime(old);
 assert.equal(plannedEpoch(shown,old),old);assert.equal(plannedEpoch('2026-10-05T16:30',old),Date.parse('2026-10-05T14:30:00Z'));
 const oldEnd=old+47*60000+2132;assert.equal(plannedEpoch(madridDateTime(oldEnd),oldEnd)-plannedEpoch(shown,old),oldEnd-old);
});

test('旧时间修改日期时进入该日期可选半点，普通半点不改变时刻',()=>{
 assert.equal(plannedDateChange('2026-10-05T16:17','2026-10-06'),'2026-10-06T16:30');
 assert.equal(plannedDateChange('2026-10-05T16:30','2026-10-06'),'2026-10-06T16:30');
 assert.equal(plannedDateChange('2026-10-05T23:47','2026-10-06'),'2026-10-06T23:30');
});

test('秋季重复02:30的旧时间保留各自UTC偏移，未编辑不会移动一小时',()=>{
 const first=Date.parse('2026-10-25T00:30:12.345Z'),second=Date.parse('2026-10-25T01:30:12.345Z');
 assert.equal(madridDateTime(first),'2026-10-25T02:30');assert.equal(madridDateTime(second),'2026-10-25T02:30');
 assert.equal(plannedEpoch('2026-10-25T02:30',first),first);assert.equal(plannedEpoch('2026-10-25T02:30',second),second);
});

test('创建活动修改开始日期，同步结束与报名取消截止，保留价格及其他字段',()=>{
 const values={start:'2026-10-06T18:30',end:'2026-10-06T21:30',signupDeadline:'2026-10-06T17:30',cancelDeadline:'2026-10-05T18:30',courtPrice:6.9};
 assert.deepEqual(shiftActivityTimes(values,{start:'2026-10-08T20:00'}),{start:'2026-10-08T20:00',end:'2026-10-08T23:00',signupDeadline:'2026-10-08T19:00',cancelDeadline:'2026-10-07T20:00',courtPrice:6.9});
 assert.equal(values.start,'2026-10-06T18:30');
});

test('开始时间跨夏令时，截止仍保留真实提前时长，手动调整和同时提交的字段不丢失',()=>{
 const values={start:'2026-03-28T18:00',end:'2026-03-28T21:00',signupDeadline:'2026-03-28T16:00',cancelDeadline:'2026-03-27T18:00'};
 const result=shiftActivityTimes(values,{start:'2026-03-29T18:00',end:'2026-03-29T22:00'});
 assert.equal(result.end,'2026-03-29T22:00');assert.equal(result.signupDeadline,'2026-03-29T16:00');
 assert.equal(madridEpoch(result.start)-madridEpoch(result.cancelDeadline),86400000);
 assert.deepEqual(shiftActivityTimes(values,{signupDeadline:'2026-03-28T17:00'}),{...values,signupDeadline:'2026-03-28T17:00'});
});

test('创建活动不完整日期仍可编辑，不把其他时间改成无效值',()=>{
 const values={start:'2026-10-06T18:30',end:'2026-10-06T21:30',signupDeadline:'2026-10-06T17:30',cancelDeadline:'2026-10-05T18:30'};
 assert.deepEqual(shiftActivityTimes(values,{start:'T18:30'}),{...values,start:'T18:30'});
 const cleared={...values,start:'T18:30'};
 const restored=shiftActivityTimes(cleared,{start:'2026-10-08T18:30'},values.start);
 assert.equal(restored.signupDeadline,'2026-10-08T17:30');assert.equal(restored.cancelDeadline,'2026-10-07T18:30');
});
