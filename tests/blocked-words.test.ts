import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blockedWordMasker,normalizeBlockedWords} from '../lib/domain/blocked-words';
import {emptyState} from '../lib/domain/types';
import {apply} from '../lib/domain/commands';
import {projectClubState} from '../lib/club-view';

function fixture(){const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='owner';for(const [id,role]of [['owner','admin'],['admin','admin'],['member','member']] as const){s.accounts.push({id,role,playerId:id+'-player',email:''});s.players.push({id:id+'-player',ownerId:id,name:id==='member'?'坏词·球友':id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:'',profile:{years:1,hand:'right',preference:'doubles',style:'BAD·打法',motto:'不要 坏词',equipment:'坏词 装备',level:'beginner'}})}return s}
test('完整词条按大小写无关匹配，不屏蔽更长词中的部分字符',()=>{
 assert.equal(blockedWordMasker(['坏词','bad'])('坏词 BaD badmintON'),'** *** badmintON');
 assert.equal(blockedWordMasker(['abc','bcd'])('abcd abc bcd'),'abcd *** ***');
 assert.equal(blockedWordMasker(['毛','泽','航','mzh'])('羽毛球 毛泽航 航班 mzh123 mzh'),'羽毛球 毛泽航 航班 mzh123 ***');
 assert.equal(blockedWordMasker(['毛','泽','航'])('毛，泽，航'),'*，*，*');
 assert.equal(blockedWordMasker(['毛泽航'])('毛泽航'), '***');
 assert.equal(blockedWordMasker(['😡'])('你好😡'),'你好*');
 assert.deepEqual(normalizeBlockedWords([' BAD ','bad','坏词','坏词']),['BAD','坏词']);
});
test('特殊字符是普通屏蔽词，不能注入正则表达式；无命中内容保留',()=>{
 const mask=blockedWordMasker(['a+b','.*','[x]','\\']);assert.equal(mask('a+b .* [x] \\ test'),'*** ** *** * test');assert.equal(mask('plain text'),'plain text');assert.equal(blockedWordMasker([])('原始内容'),'原始内容');
});
test('群主和其他管理员都能管理词库，成员及活动创建者不能伪造权限',async()=>{
 const s=fixture();await apply(s,s.accounts[0],'blockedWords',{words:['坏词','bad','BAD']},1);assert.deepEqual(s.settings.blockedWords,['坏词','bad']);await apply(s,s.accounts[1],'blockedWords',{words:['新词']},2);assert.deepEqual(s.settings.blockedWords,['新词']);const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[2],'blockedWords',{words:['伪造'],role:'admin'},3),/403/);assert.deepEqual(s,before);
});
test('无效或超限词库在修改前拒绝，不能覆盖当前有效词库',async()=>{
 const s=fixture();s.settings.blockedWords=['保留'];for(const words of [[''],['   '],['x\ny'],['x'.repeat(51)],Array.from({length:201},(_,i)=>'word'+i)]){const before=structuredClone(s);await assert.rejects(()=>apply(s,s.accounts[0],'blockedWords',{words},1));assert.deepEqual(s,before)}
});
test('服务端视图遮盖既有资料且不改原始数据，身份保持准确，成员看不到词库',()=>{
 const s=fixture();s.settings.blockedWords=['坏词','bad','member'];s.settings.name='坏词 群';
 s.photos.push({id:'photo',kind:'avatar',eventId:null,matchId:null,playerIds:['member-player'],ownerId:'member',caption:'BAD 坏词',created:1,key:'media/bad-path',type:'image/png',size:100});
 const before=structuredClone(s),view=projectClubState(s,s.accounts[2],'2026-10',2026,10);
 assert.equal(view.settings.name,'** 群');assert.equal(view.players.find(p=>p.id==='member-player')!.name,'**·球友');assert.equal(view.players.find(p=>p.id==='member-player')!.profile!.style,'***·打法');assert.equal(view.photos[0].caption,'*** **');assert.equal(view.me.id,'member');assert.equal(view.me.playerId,'member-player');assert.equal('blockedWords' in view.settings,false);assert.deepEqual(s,before);
 const admin=projectClubState(s,s.accounts[1],'2026-10',2026,10);assert.deepEqual(admin.settings.blockedWords,['坏词','bad','member']);assert.equal(admin.permissions.canManageBlockedWords,true);
 s.settings.blockedWords=[];assert.equal(projectClubState(s,s.accounts[2],'2026-10',2026,10).players.find(p=>p.id==='member-player')!.name,'坏词·球友');
});
test('球馆、地址和场地名称同样遮盖，导航仍按原地址，编辑未改动字段不抹掉原文',async()=>{
 const s=fixture(),start=Date.parse('2027-01-10T10:00:00Z'),end=start+3600000;s.settings.blockedWords=['坏词','坏词球馆','坏词场'];
 s.events.push({id:'event',creatorId:'owner',title:'坏词 活动',start,end,venue:'坏词球馆',address:'坏词 路10号',capacity:4,signupDeadline:start,cancelDeadline:start-86400000,note:'坏词备注',status:'open',courtMode:'interval',ballMode:'interval'});
 s.bookings.push({id:'court',eventId:'event',name:'坏词场',start,end,venue:'坏词球馆',address:'坏词 路10号',pricing:'hourly',cents:690});
 const view=projectClubState(s,s.accounts[0],'2027-01',2027,start-86400000);
 assert.equal(view.events[0].venue,'****');assert.equal(view.events[0].address,'** 路10号');assert.equal(view.bookings[0].name,'***');assert.ok(view.events[0].mapUrl.includes(encodeURIComponent('坏词球馆')));
 await apply(s,s.accounts[0],'bookingEdit',{bookingId:'court',name:view.bookings[0].name,venue:view.bookings[0].venue,address:view.bookings[0].address,start,end,pricing:'hourly',cents:790,signupCapacity:4,reason:'只改价格'},start-2*86400000);
 assert.equal(s.bookings[0].name,'坏词场');assert.equal(s.bookings[0].venue,'坏词球馆');assert.equal(s.bookings[0].cents,790);
 await apply(s,s.accounts[0],'profile',{playerId:'member-player',name:view.players.find(p=>p.id==='member-player')!.name},1);assert.equal(s.players[2].name,'坏词·球友');
});
