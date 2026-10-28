import {z} from 'zod';
import {getAppUser} from '../../../lib/auth';
import {raw,load} from '../../../lib/store';
import {emptyState,type State} from '../../../lib/domain/types';
import {RequestError,readJsonBody} from '../../../lib/request-body';
import {assertWriteRequest,releaseRejectedWriteBody,writeErrorResponse} from '../../../lib/write-security';
import {simulationKey,createSimulation,changeSimulation,simulationView,type SimulationDocument} from '../../../lib/admin-simulation';
export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const requestSchema=z.object({action:z.string().min(1).max(50),payload:z.record(z.unknown()).default({}),revision:z.number().int().min(0).optional(),requestId:z.string().uuid()}).strict();
const accessSql="(json_extract(payload,'$.role')='admin' OR json_type(payload,'$.simulationTester')='true')";
async function simulationUser(){
 const user=await getAppUser();if(!user)throw new RequestError('请先登录',401);
 const row=await raw().prepare(`SELECT id FROM accounts WHERE id=? AND ${accessSql}`).bind(user.userId).first<{id:string}>();
 if(!row)throw new RequestError('只有群主、管理员和测试员可以访问模拟活动',403);return user.userId;
}
async function readDocument(){const row=await raw().prepare('SELECT payload FROM settings WHERE id=?').bind(simulationKey).first<{payload:string}>();if(!row)return null;const doc=JSON.parse(row.payload) as SimulationDocument;if(![1,2].includes(doc.version)||!Number.isSafeInteger(doc.revision)||!doc.state?.events?.length||!Array.isArray(doc.requests))throw new Error('Invalid simulation document');return doc}
/** Only what the sandbox needs to follow production pairing odds, without loading the club's history. */
async function pairingOddsSource():Promise<Pick<State,'events'|'settings'>>{
 const row=await raw().prepare('SELECT payload FROM settings WHERE id=?').bind('club').first<{payload:string}>();
 const settings=row?JSON.parse(row.payload) as State['settings']:emptyState().settings,ids=(settings.pairingOdds??[]).map(o=>o.eventId);
 if(!ids.length)return {settings,events:[]};
 const rows=(await raw().prepare(`SELECT payload FROM events WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<{payload:string}>()).results;
 return {settings,events:rows.map(r=>JSON.parse(r.payload) as State['events'][number])};
}
export async function GET(){try{await simulationUser();const doc=await readDocument();return doc?response(simulationView(doc,Date.now())):response({error:'模拟活动尚未初始化'},404)}catch(error){return writeErrorResponse(error)}}
export async function POST(req:Request){
 try{
  assertWriteRequest(req);const accountId=await simulationUser(),p=requestSchema.parse(await readJsonBody(req));
  if(p.action==='initialize'){
   const existing=await readDocument();if(existing?.version===2&&existing.state.events[0].end>Date.now())return response(simulationView(existing,Date.now()));
   const doc=createSimulation(Date.now(),await load());
   if(existing){doc.revision=existing.revision+1;doc.state.revision=doc.revision;await raw().prepare(`UPDATE settings SET payload=? WHERE id=? AND json_extract(payload,'$.version') IN (1,2) AND json_extract(payload,'$.revision')=? AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND ${accessSql})`).bind(JSON.stringify(doc),simulationKey,existing.revision,accountId).run()}
   else await raw().prepare(`INSERT INTO settings(id,payload) SELECT ?,? WHERE EXISTS(SELECT 1 FROM accounts WHERE id=? AND ${accessSql}) ON CONFLICT(id) DO NOTHING`).bind(simulationKey,JSON.stringify(doc),accountId).run();
   await simulationUser();const saved=await readDocument();if(!saved)throw new Error('Simulation initialization failed');return response(simulationView(saved,Date.now()));
  }
  const doc=await readDocument();if(!doc)throw new RequestError('请先打开模拟活动',404);
  if(doc.requests.includes(p.requestId))return response(simulationView(doc,Date.now()));
  if(p.revision!==doc.revision)throw new RequestError('模拟记录刚刚被其他测试成员更新，请刷新后再试',409);
  // Every write reads the current production pairing odds, so the sandbox schedules exactly as production.
  const next=await changeSimulation(doc,p.action,p.payload,p.requestId,Date.now(),p.action==='reset'?await load():undefined,p.action==='reset'?undefined:await pairingOddsSource());
  const result=await raw().prepare(`UPDATE settings SET payload=? WHERE id=? AND json_extract(payload,'$.revision')=? AND EXISTS(SELECT 1 FROM accounts WHERE id=? AND ${accessSql})`).bind(JSON.stringify(next),simulationKey,doc.revision,accountId).run();
  if(!result.meta.changes){await simulationUser();throw new RequestError('模拟记录已更新，请刷新后重试',409)}
  return response(simulationView(next,Date.now()));
 }catch(error){await releaseRejectedWriteBody(req);return writeErrorResponse(error)}
}
