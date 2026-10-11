import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationPromptDue,postponeNotificationPrompt,notificationPromptSnooze} from '../lib/client/notification-prompt';
test('prompt dismissal lasts seven days and belongs only to the current account/device',()=>{
 const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)}},now=1000000;
 assert.equal(notificationPromptDue(storage,'member',now),true);postponeNotificationPrompt(storage,'member',now);
 assert.equal(notificationPromptDue(storage,'member',now+1),false);assert.equal(notificationPromptDue(storage,'other',now+1),true);
 assert.equal(notificationPromptDue(storage,'member',now+notificationPromptSnooze),true);
 const key=[...values.keys()][0];values.set(key,'invalid');assert.equal(notificationPromptDue(storage,'member',now),true);
 values.set(key,String(now+notificationPromptSnooze+1));assert.equal(notificationPromptDue(storage,'member',now),true);
});
test('blocked device storage never prevents entering or dismissing the prompt',()=>{
 const storage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('blocked')}};
 assert.equal(notificationPromptDue(storage,'member'),true);assert.doesNotThrow(()=>postponeNotificationPrompt(storage,'member'));
});
