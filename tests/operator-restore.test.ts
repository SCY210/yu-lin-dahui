import {test} from 'node:test';
import assert from 'node:assert/strict';
import {operatorRestore} from '../lib/operator-restore';
import {exportTables} from '../lib/operator-export';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
const origin='https://restore-fixture.invalid',token='a'.repeat(64),now=1800000000000;
test('restore requires an expiring secret, exact target origin and a non-standalone host',async()=>{
 const base={MIGRATION_IMPORT_TOKEN:token,MIGRATION_IMPORT_EXPIRES_AT:String(now+3600000),MIGRATION_IMPORT_ORIGIN:origin};
 for(const override of [{MIGRATION_IMPORT_TOKEN:undefined},{MIGRATION_IMPORT_EXPIRES_AT:String(now-1)},{MIGRATION_IMPORT_EXPIRES_AT:String(now+86400001)},{MIGRATION_IMPORT_ORIGIN:'https://other.invalid'},{YULIN_HOSTING_PROVIDER:'cloudflare'}]){
  const r=await operatorRestore(new Request(origin+'/_operator/restore/schema',{headers:{Authorization:'Bearer '+token}}),{...base,...override},now);assert.equal(r?.status,404);
 }
});
test('restore keeps immutable consent, validates revision/schema and imports only allowlisted tables',async()=>{
 const f=sqliteD1(),sql=f.sql;const raw=f.db;
 raw.batch=async qs=>{sql.exec('BEGIN');try{const r=qs.map((q:{query:string;args:(string|number|null)[]})=>{const st=sql.prepare(q.query);if(/^\s*(SELECT|PRAGMA)\b/i.test(q.query))return {success:true,results:st.all(...q.args)};st.run(...q.args);return {success:true,results:[]}});sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}};
 const env={DB:raw as unknown as D1Database,BUCKET:{put:async()=>{}} as unknown as R2Bucket,MIGRATION_IMPORT_TOKEN:token,MIGRATION_IMPORT_EXPIRES_AT:String(now+3600000),MIGRATION_IMPORT_ORIGIN:origin};
 const call=(action:string,body:unknown)=>operatorRestore(new Request(origin+'/_operator/restore/'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)}),env,now);
 try{
  sql.prepare('INSERT INTO commits(revision,key,at) VALUES(?,?,?)').run(1,'fixture',now);sql.prepare('INSERT INTO accountNoticeReceipts(id,account_id,notice_version,content_hash,payload) VALUES(?,?,?,?,?)').run('old','fixture-account','v1','hash','{}');
  assert.equal((await call('begin',{expectedRevision:0,tables:exportTables}))?.status,409);assert.equal((await call('table',{table:'accounts; DROP TABLE events',rows:[]}))?.status,400);
  assert.equal((await call('begin',{expectedRevision:1,tables:exportTables}))?.status,200);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM accountNoticeReceipts').get()?.n,1);
  assert.equal((await call('table',{table:'commits',rows:[{revision:2,key:'restored-fixture',at:now}]}))?.status,200);
  assert.equal((await call('table',{table:'accountNoticeReceipts',rows:[{id:'new-equivalent',account_id:'fixture-account',notice_version:'v1',content_hash:'hash',payload:'{}'}]}))?.status,200);assert.equal(sql.prepare('SELECT id FROM accountNoticeReceipts').get()?.id,'old');
  assert.equal((await call('table',{table:'commits',rows:[{revision:3,key:'bad',at:now,injected:'value'}]}))?.status,503);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM commits').get()?.n,1);
  assert.equal((await call('finish',{}))?.status,200);assert.equal(sql.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{f.close()}
});
