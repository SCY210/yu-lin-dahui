import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationDeviceIsPhone} from '../lib/notification-device-policy';
const phone=(ua:string,mobile?:string)=>notificationDeviceIsPhone(new Headers({'user-agent':ua,...(mobile?{'sec-ch-ua-mobile':mobile}:{})}));
test('iPhone and Android Mobile qualify for phone notification points',()=>{
 assert.equal(phone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148'),true);
 assert.equal(phone('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36','?1'),true);
});
test('Windows, macOS, Linux and ChromeOS computers never qualify',()=>{
 for(const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15','Mozilla/5.0 (X11; Linux x86_64) Firefox/132.0','Mozilla/5.0 (X11; CrOS x86_64) Chrome/130.0'])assert.equal(phone(ua),false);
});
test('tablets and iPod do not qualify as phones',()=>{
 for(const ua of ['Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148','Mozilla/5.0 (iPod touch; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148','Mozilla/5.0 (Linux; Android 15; Tablet) Safari/537.36'])assert.equal(phone(ua),false);
});
test('unknown devices and explicit desktop client hints are ineligible',()=>{
 assert.equal(phone(''),false);assert.equal(phone('unknown','?1'),false);
 assert.equal(phone('Mozilla/5.0 (Linux; Android 15) Mobile Safari/537.36','?0'),false);
});
