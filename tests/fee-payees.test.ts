import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../lib/domain/commands';
import {projectClubState} from '../lib/club-view';
import {emptyState,type Account,type State} from '../lib/domain/types';

const now=Date.parse('2026-10-10T20:00:00Z'),hour=3600000;
const admin:Account={id:'admin',email:'',role:'admin',playerId:'p0'};
const organizer:Account={id:'organizer',email:'',role:'member',playerId:'p1'};
const other:Account={id:'other',email:'',role:'member',playerId:'p2'};
function fixture():State{
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId=admin.id;s.accounts=[admin,organizer,other].map(a=>({...a}));
 s.players=s.accounts.map(a=>({id:a.playerId,name:a.id,ownerId:a.id,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}));
 for(const id of ['e1','e2'])s.events.push({id,creatorId:organizer.id,title:'周四双打',start:now-4*hour,end:now-2*hour,venue:'球馆',address:'',capacity:8,signupDeadline:now-5*hour,cancelDeadline:now-5*hour,note:'',status:'ended',courtMode:'equal',ballMode:'equal'});
 return s;
}
const set=(s:State,a:Account,eventId:string,name:string,phone:string,at=now)=>apply(s,a,'feeRecipient',{eventId,name,phone,reason:''},at);

test('设置收款人后自动存为常用收款人；同一电话只存一条并更新名字，最近用过的排在前面',async()=>{
 const s=fixture();
 await set(s,organizer,'e1','张三','+34 600 111 222');await set(s,organizer,'e1','李四','600 333 444',now+1);
 assert.deepEqual(s.settings.feePayees!.map(p=>p.name),['李四','张三']);
 await set(s,organizer,'e2','张三（收款）','+34600111222',now+2);
 assert.deepEqual(s.settings.feePayees!.map(p=>[p.name,p.phone]),[['张三（收款）','+34600111222'],['李四','600 333 444']]);
 assert.deepEqual(s.events.find(e=>e.id==='e2')!.feeRecipient,{name:'张三（收款）',phone:'+34600111222'});
});

test('常用收款人最多保留 20 位',async()=>{
 const s=fixture();for(let i=0;i<22;i++)await set(s,organizer,'e1','收款人'+i,'600 000 '+String(100+i),now+i);
 assert.equal(s.settings.feePayees!.length,20);assert.equal(s.settings.feePayees![0].name,'收款人21');
});

test('只有添加者或管理员可以删除常用收款人',async()=>{
 const s=fixture();await set(s,organizer,'e1','张三','600 111 222');const id=s.settings.feePayees![0].id;
 await assert.rejects(()=>apply(s,other,'feePayeeRemove',{payeeId:id,reason:''},now),/403/);
 await apply(s,organizer,'feePayeeRemove',{payeeId:id,reason:''},now);assert.equal(s.settings.feePayees!.length,0);
 await set(s,organizer,'e1','李四','600 333 444');await apply(s,admin,'feePayeeRemove',{payeeId:s.settings.feePayees![0].id,reason:''},now);assert.equal(s.settings.feePayees!.length,0);
 assert.deepEqual(s.events[0].feeRecipient,{name:'李四',phone:'600 333 444'},'removing a saved payee keeps the activity recipient');
});

test('页面数据给出常用收款人和是否由自己添加，不暴露添加者账号',async()=>{
 const s=fixture();await set(s,organizer,'e1','张三','600 111 222');
 assert.deepEqual(projectClubState(s,organizer,'2026-10',2026,now).settings.feePayees,[{id:s.settings.feePayees![0].id,name:'张三',phone:'600 111 222',mine:true}]);
 assert.equal(projectClubState(s,other,'2026-10',2026,now).settings.feePayees[0].mine,false);
});
