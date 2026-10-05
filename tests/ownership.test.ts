import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,type Account} from '../lib/domain/types';
import {clubOwnerId,isClubOwner,ensureClubOwner,assertAccountMutable,assertPlayerMutable} from '../lib/domain/ownership';
import {apply} from '../lib/domain/commands';
import {applySocial} from '../lib/domain/social-commands';
import {projectClubState} from '../lib/club-view';

const at=Date.parse('2026-10-05T10:00:00Z');
const owner:Account={id:'owner',playerId:'owner-player',role:'admin',email:''};
const admin:Account={id:'admin',playerId:'admin-player',role:'admin',email:''};
const member:Account={id:'member',playerId:'member-player',role:'member',email:''};
function fixture(){const s=emptyState();s.settings.ownerAccountId=owner.id;s.accounts=[{...owner},{...admin},{...member}];s.players=s.accounts.map(a=>({id:a.playerId,ownerId:a.id,name:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));return s;}
const profile={playerId:owner.playerId,years:3,hand:'left',preference:'mixed',style:'网前',equipment:'球拍',level:'advanced',racket:'测试战拍',strings:'测试拍线',tensionMin:24,tensionMax:28};
test('群主由持久化账号身份决定，昵称、role和客户端isOwner字段不能冒充',()=>{
 const s=fixture();s.players[1].name='chenyue';assert.equal(clubOwnerId(s),owner.id);assert.equal(isClubOwner(s,admin),false);assert.equal(isClubOwner(s,{...admin,isOwner:true} as Account),false);assert.equal(isClubOwner(s,owner),true);
});
test('新群主状态和旧已验证账号可幂等规范化，最高角色不能被意外保持为member',()=>{
 const s=fixture();s.accounts[0].role='member';assert.equal(ensureClubOwner(s),true);assert.equal(s.accounts[0].role,'admin');assert.equal(ensureClubOwner(s),false);
 const old=emptyState();old.accounts.push({...owner,id:'uoVo7RaSrpRMqVTmKzLB3vvo0m9s8pOKfx7c6JAUxtROd5NVdL4z7B',role:'member'});assert.equal(ensureClubOwner(old),true);assert.equal(old.settings.ownerAccountId,old.accounts[0].id);assert.equal(old.accounts[0].role,'admin');assert.equal(ensureClubOwner(old),false);
 const unrelated=emptyState();unrelated.accounts.push({...admin});assert.equal(ensureClubOwner(unrelated),false);assert.equal(unrelated.settings.ownerAccountId,undefined);
});
test('指定群主后不会产生固定旧账号与新群主同时具有最高权限的情况',()=>{
 const s=fixture();s.accounts.push({...admin,id:'uoVo7RaSrpRMqVTmKzLB3vvo0m9s8pOKfx7c6JAUxtROd5NVdL4z7B'});assert.equal(isClubOwner(s,s.accounts.at(-1)!),false);assert.equal(isClubOwner(s,owner),true);
});
for(const actor of [admin,member])for(const [action,payload]of [['profile',{playerId:owner.playerId,name:'篡改'}],['profileDetails',profile],['rating',{playerId:owner.playerId,value:500,enabled:false,reason:'停用群主'}],['role',{accountId:owner.id,role:'member',reason:'降级群主'}]] as const)test(actor.role+'不能修改群主 '+action,async()=>{
 const s=fixture(),before=structuredClone(s);await assert.rejects(()=>apply(s,actor,action,payload,at),/403/);assert.deepEqual(s,before);
});
test('社群命令直接调用也保护群主；账号和照片目标检查不依赖界面',async()=>{
 const s=fixture();await assert.rejects(()=>applySocial(s,admin,'profileDetails',profile,at),/403/);
 assert.throws(()=>assertAccountMutable(s,admin,owner.id),/403/);assert.throws(()=>assertPlayerMutable(s,admin,owner.playerId),/403/);
 assert.doesNotThrow(()=>assertAccountMutable(s,owner,owner.id));assert.doesNotThrow(()=>assertPlayerMutable(s,owner,owner.playerId));
});
test('群主可以改自己的名字、档案和初始实力，省略playerId时仍正确指向本人',async()=>{
 const s=fixture();await apply(s,owner,'profile',{name:'新昵称'},at);assert.equal(s.players[0].name,'新昵称');
 await apply(s,owner,'profileDetails',profile,at);assert.equal(s.players[0].profile?.racket,'测试战拍');await apply(s,owner,'rating',{playerId:owner.playerId,value:1200,enabled:true,reason:'本人调整'},at);assert.equal(s.players[0].initialRating,1200);
 assert.equal(isClubOwner(s,owner),true);
});
test('只有群主可以升降管理员，群主本人也不能把自己降级',async()=>{
 const s=fixture();await assert.rejects(()=>apply(s,admin,'role',{accountId:member.id,role:'admin',reason:'自行提权'},at),/群主/);
 await assert.rejects(()=>apply(s,owner,'role',{accountId:owner.id,role:'member',reason:'误操作'},at),/最高权限/);assert.equal(s.accounts[0].role,'admin');
 await apply(s,owner,'role',{accountId:member.id,role:'admin',reason:'群主授权'},at);assert.equal(s.accounts[2].role,'admin');await apply(s,owner,'role',{accountId:admin.id,role:'member',reason:'群主降级'},at);assert.equal(s.accounts[1].role,'member');
});
test('普通管理员仍可维护成员资料，成员只能修改自己，settings输入不能替换群主',async()=>{
 const s=fixture();await apply(s,admin,'profile',{playerId:member.playerId,name:'成员新名'},at);assert.equal(s.players[2].name,'成员新名');
 await apply(s,member,'profileDetails',{...profile,playerId:member.playerId},at);await assert.rejects(()=>apply(s,member,'profileDetails',{...profile,playerId:admin.playerId},at),/403/);
 await apply(s,admin,'settings',{name:s.settings.name,invite:'',rules:s.settings.rules,ownerAccountId:admin.id},at);assert.equal(s.settings.ownerAccountId,owner.id);
});
test('投影为界面标注最高权限、保护名单与可用操作，不暴露密码或允许伪造身份',()=>{
 const s=fixture(),ov=projectClubState(s,owner,'2026-10',2026,at),av=projectClubState(s,admin,'2026-10',2026,at),mv=projectClubState(s,member,'2026-10',2026,at);
 assert.equal(ov.me.isOwner,true);assert.equal(ov.permissions.canManageRoles,true);assert.equal(av.me.isOwner,false);assert.equal(av.permissions.canManageRoles,false);
 assert.equal(av.accounts.find(a=>a.id===owner.id)!.canModify,false);assert.equal(ov.accounts.find(a=>a.id===owner.id)!.canModify,true);assert.equal(av.players.find(p=>p.id===owner.playerId)!.protectedOwner,true);
 assert.deepEqual(mv.accounts,[]);assert.equal('ownerAccountId' in mv.settings,false);assert.ok(mv.players.every(p=>p.rating===null));assert.equal(s.accounts.length,3);
});
test('群主记录缺失时不能退回普通管理员分配角色，原始球员仍不能被接管',async()=>{
 const s=emptyState();s.accounts=[{...admin},{...member}];s.players=[{id:'17799d9d-ca2d-4da1-aedb-bd1459030557',ownerId:'unknown',name:'原群主',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}];
 await assert.rejects(()=>apply(s,admin,'role',{accountId:member.id,role:'admin',reason:'接管'},at),/群主/);
 assert.throws(()=>assertPlayerMutable(s,admin,s.players[0].id),/403/);
 const v=projectClubState(s,admin,'2026-10',2026,at);assert.equal(v.permissions.canManageRoles,false);assert.equal(v.players[0].protectedOwner,true);
});
