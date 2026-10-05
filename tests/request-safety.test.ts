import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {readJsonBody,readPhotoForm,RequestError} from '../lib/request-body';
import {publicApiError} from '../lib/api-error';
import {fail} from '../lib/domain/types';

test('无Content-Length的超限JSON流在限制处取消，阻止继续读取',async()=>{
 let cancelled=false;const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(20));},cancel(){cancelled=true}});
 const req=new Request('http://localhost/api/club',{method:'POST',body,duplex:'half'} as RequestInit);
 await assert.rejects(()=>readJsonBody(req,10),(e:any)=>e instanceof RequestError&&e.status===413);assert.equal(cancelled,true);
});
test('Content-Length超限时在读取请求体之前拒绝',async()=>{
 const req=new Request('http://localhost/api/club',{method:'POST',headers:{'Content-Length':'100'},body:'{}'});
 await assert.rejects(()=>readJsonBody(req,20),(e:any)=>e.status===413);assert.equal(req.bodyUsed,false);
});
test('按UTF-8字节限制JSON，合法内容与SQL字符串作为原始资料读取',async()=>{
 const value={title:'正常活动',note:"' OR 1=1; DROP TABLE events; --"};const body=JSON.stringify(value);
 const req=new Request('http://localhost/api/club',{method:'POST',body});assert.deepEqual(await readJsonBody(req),value);
 await assert.rejects(()=>readJsonBody(new Request('http://localhost/api/club',{method:'POST',body:'"中文"'}),5),(e:any)=>e.status===413);
});
test('错误JSON只返回格式提示，不泄漏解析器或内部数据',async()=>{
 await assert.rejects(()=>readJsonBody(new Request('http://localhost/api/club',{method:'POST',body:'{"secret":'})),(e:any)=>e.status===400&&!e.message.includes('secret'));
});
test('合法multipart文件与中文说明保持原样；超限总上传被拒绝',async()=>{
 const form=new FormData();form.set('file',new Blob(['fixture'],{type:'image/png'}),'虚构图片.png');form.set('caption','战拍');
 const req=new Request('http://localhost/api/photos',{method:'POST',body:form});const parsed=await readPhotoForm(req);assert.equal(parsed.get('caption'),'战拍');assert.equal(await (parsed.get('file') as File).text(),'fixture');
 const oversized=new Request('http://localhost/api/photos',{method:'POST',headers:{'Content-Length':String(7*1024*1024)},body:'small'});await assert.rejects(()=>readPhotoForm(oversized),(e:any)=>e.status===413);
});
test('数据库错误、SQL语句和存储密钥不返回给客户端，业务权限与冲突提示保留',()=>{
 for(const text of ['D1_ERROR: SELECT hash FROM password_credentials','R2: secret-key /private/file','TypeError: internal code'])assert.deepEqual(publicApiError(new Error(text)),{error:'服务暂不可用，请稍后重试',status:503});
 for(const [message,status]of [['403: 只能修改自己的活动',403],['409: 数据已更新',409],['人数不能低于当前接龙人数',400]] as const){try{fail(message)}catch(e){assert.deepEqual(publicApiError(e),{error:message,status})}}
 const result=z.number().safeParse('wrong');if(!result.success)assert.equal(publicApiError(result.error).status,400);
});
test('未知或局部成功响应不能覆盖正在使用的完整页面快照',async()=>{
 const {isClubResponse}=await import('../lib/client/club-response');
 const {projectClubState}=await import('../lib/club-view');const {emptyState}=await import('../lib/domain/types');
 const s=emptyState(),account={id:'a',playerId:'p',email:'',role:'member' as const};s.accounts=[account];s.players=[{id:'p',ownerId:'a',name:'球友',initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:''}];
 const valid=projectClubState(s,account,'2026-10',2026);assert.ok(isClubResponse(valid));
 for(const bad of [null,'<html>proxy error</html>',{}, {error:'temporary error'}, {...valid,events:undefined},{...valid,social:{}},{...valid,me:{id:'a'} }])assert.equal(isClubResponse(bad),false);
 assert.ok(isClubResponse({setup:true,user:{name:'管理员'}}));assert.ok(isClubResponse({join:true,user:{name:'球友'}}));
});
