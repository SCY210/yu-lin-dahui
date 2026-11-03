import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isNewUsername,usernamePattern} from '../lib/username-format';
import {legacyUsernameKey,normalizeUsername} from '../lib/password';
import {simplifyHanzi} from '../lib/username-hanzi';
import {hanziPairs} from '../lib/username-hanzi-data';
import {newUsername} from '../lib/username-policy';

test('new login names take 2–32 Chinese characters, English letters or digits, mixed',()=>{
 for(const ok of ['ab','羽林','羽林會','球友A1','yulin2026','阿青'])assert.ok(isNewUsername(ok),ok);
 for(const bad of ['a','羽','ＡＢ','a b','a_b','a-b','羽林 会','x'.repeat(33),'aq😀'])assert.equal(isNewUsername(bad),false,bad);
 assert.ok(new RegExp('^'+usernamePattern+'$','v').test('羽林會'),'the HTML pattern attribute (compiled with the v flag) accepts Chinese');
 assert.equal(newUsername.parse(' 羽林會ABC '),'羽林会abc','stored under the key: simplified, lower case');
 assert.throws(()=>newUsername.parse('ＡＢＣ'),'full-width letters are refused');
});

test('simplified, traditional and regional spellings are one key, and converting twice changes nothing',()=>{
 assert.equal(simplifyHanzi('羽林會'),'羽林会');
 assert.equal(normalizeUsername('羽林會'),normalizeUsername('羽林会'));
 assert.equal(simplifyHanzi('裡'),simplifyHanzi('裏'),'台湾和香港字形 are the same');assert.equal(simplifyHanzi('裏'),'里');
 assert.equal(normalizeUsername('豈'),normalizeUsername('岂'),'compatibility ideographs fold too');
 assert.equal(normalizeUsername('Yu林會'),'yu林会');
 assert.equal(legacyUsernameKey('羽林會'),'羽林會','the older key keeps the stored form');
 const chars=Array.from(hanziPairs);assert.equal(chars.length%2,0);
 for(let i=0;i<chars.length;i+=2){assert.notEqual(chars[i],chars[i+1]);assert.equal(simplifyHanzi(chars[i]),chars[i+1]);assert.equal(simplifyHanzi(chars[i+1]),chars[i+1],chars[i]+' → '+chars[i+1]+' is final')}
 assert.equal(simplifyHanzi('羽林会 abc 123'),'羽林会 abc 123','simplified text and ASCII stay as they are');
});
