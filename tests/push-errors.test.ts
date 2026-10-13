import test from 'node:test';
import assert from 'node:assert/strict';
import {browserPushError,pushFailure} from '../lib/client/push-errors';

test('Chromium push provider failures have actionable copy separate from login',()=>{
 for(const error of [
  new DOMException('Registration failed - push service error','AbortError'),
  new Error('Registration failed - push service not available'),
  new Error('Registration failed - could not connect to push server'),
  {name:'AbortError',message:'Subscription failed'},
 ]){
  const result=pushFailure(browserPushError(error));
  assert.equal(result.serviceUnavailable,true);
  assert.match(result.message,/登录不受影响/);
  assert.match(result.message,/网络连接或更新浏览器/);
  assert.ok(!result.message.includes('Registration failed'));
 }
});
test('permission denial, invalid keys, ownership and API failures do not unlock the prompt',()=>{
 for(const error of [
  new DOMException('Permission denied','NotAllowedError'),
  new DOMException('Invalid applicationServerKey','InvalidAccessError'),
  new Error('登录账号已更新，请刷新后操作'),
  new Error('通知设置暂时无法同步'),
  new DOMException('Request timed out','TimeoutError'),
  new DOMException('Server synchronization aborted','AbortError'),
  new Error('Registration failed - push service error'),
 ]){
  assert.equal(pushFailure(error).serviceUnavailable,false);
  assert.equal(pushFailure(error).message,error.message);
 }
 assert.deepEqual(pushFailure(null,'无法检测通知状态，请重试'),{serviceUnavailable:false,message:'无法检测通知状态，请重试'});
 const denial=new DOMException('Permission denied','NotAllowedError');
 assert.equal(browserPushError(denial),denial);
});
