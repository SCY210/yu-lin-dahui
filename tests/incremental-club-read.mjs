import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const sqlitedb=sqliteD1(),{sql}=sqlitedb;let returned=0,queries=[];
const db={prepare:sqlitedb.db.prepare,async batch(statements){queries.push(...statements.map(s=>s.query));const results=await sqlitedb.db.batch(statements);returned+=results.reduce((n,r)=>n+r.results.length,0);return results}};
globalThis.__incrementalClub={env:{DB:db}};
await build({stdin:{contents:`export {createIncrementalStore} from './lib/incremental-store';export {emptyState} from './lib/domain/types';export {loadWithRestore,load,save} from './lib/store';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/incremental-club-read.mjs',plugins:[{name:'isolated-incremental',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const env=globalThis.__incrementalClub.env;',loader:'js'}))}}]});
const api=await import(pathToFileURL(resolve('.test-output/incremental-club-read.mjs')).href);
const row=(name,id)=>JSON.stringify({id,name});
const addEvent=sql.prepare('INSERT INTO events(id,payload) VALUES(?,?)');
try{
 const persistedNames=Object.keys(api.emptyState()).filter(k=>Array.isArray(api.emptyState()[k]));
 for(const table of ['settings',...persistedNames]){
  const triggers=sql.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name=? AND name LIKE 'club_sync_%'").all(table);
  assert.equal(triggers.length,3,'every persisted collection needs an insert/update/delete trigger: '+table);
 }
 const initial=api.emptyState();initial.settings.initialized=true;initial.settings.name='Fictional budget club';
 await api.save(initial,'initial',api.emptyState());
 const insertAudit=sql.prepare('INSERT INTO audits(id,payload) VALUES(?,?)');
 for(let i=0;i<1400;i++)insertAudit.run('audit-'+i,JSON.stringify({id:'audit-'+i,at:i,actor:'fixture',action:'fixture',reason:'Fictional historical row'}));
 for(let i=0;i<20;i++)addEvent.run('event-'+i,row('Event '+i,'event-'+i));
 const equal=async()=>{const a=await api.loadWithRestore({incremental:true});assert.deepEqual(a.state,await api.load());return a};
 const first=await equal(),original=structuredClone(first.state);
 first.state.events[0].title='must never escape';first.state.audits.length=0;
 assert.deepEqual(first.restore(),original,'rollback snapshot is isolated from caller mutations');
 await equal();
 const priorRows=returned;queries=[];await api.loadWithRestore({incremental:true});
 assert.equal(returned-priorRows,1,'unchanged reads fetch only the indexed head row');
 assert.equal(queries.length,2);assert.ok(queries.every(q=>!q.startsWith('SELECT id,payload FROM')));
 const update=sql.prepare('UPDATE events SET payload=? WHERE id=?');
 update.run(row('Changed','event-0'),'event-0');sql.prepare('DELETE FROM events WHERE id=?').run('event-1');addEvent.run('new-event',row('Added','new-event'));
 const updated=await equal();assert.equal(updated.state.events.find(e=>e.id==='event-0').name,'Changed');assert.ok(!updated.state.events.some(e=>e.id==='event-1'));
 assert.deepEqual(first.restore(),original,'later incremental reads cannot alter an earlier rollback snapshot');
 // A failed batch rolls back the change feed and business rows together.
 const cursor=sql.prepare('SELECT MAX(seq) AS n FROM club_changes').get().n;
 await assert.rejects(db.batch([db.prepare('UPDATE events SET payload=? WHERE id=?').bind(row('Uncommitted','event-0'),'event-0'),db.prepare('INSERT INTO commits(revision,key,at) VALUES(?,?,?)').bind(initial.revision,'conflict',0)]));
 assert.equal(sql.prepare('SELECT MAX(seq) AS n FROM club_changes').get().n,cursor);await equal();
 // Successful saves and competing writers preserve the optimistic revision gate.
 const before=await api.load(),next=structuredClone(before);next.settings.name='Saved incrementally';await api.save(next,'next',before);await equal();
 await assert.rejects(api.save(structuredClone(before),'stale',before));await equal();
 // Missing history cannot be mistaken for an unchanged snapshot.
 for(let i=0;i<4200;i++)update.run(row('Version '+i,'event-0'),'event-0');
 const beforeTrim=await api.load();await api.save(structuredClone(beforeTrim),'trim',beforeTrim);
 assert.ok(sql.prepare('SELECT COUNT(*) AS n FROM club_changes').get().n<=4096);
 queries=[];await equal();assert.ok(queries.some(q=>q==='SELECT id,payload FROM events'),'expired cursor falls back to a full transaction');
 const simultaneous=await Promise.all(Array.from({length:20},()=>api.loadWithRestore({incremental:true})));
 for(const result of simultaneous)assert.deepEqual(result.state,await api.load());
 sqlitedb.injectFailure(q=>q.includes('FROM club_changes'));await assert.rejects(api.loadWithRestore({incremental:true}));sqlitedb.injectFailure(null);await equal();
 // Both cursor seeks and retention use the integer primary key, never a full change-feed scan.
 const plan=sql.prepare('EXPLAIN QUERY PLAN SELECT seq,table_name,row_id,payload FROM club_changes WHERE seq>? ORDER BY seq LIMIT ?').all(10,4097);
 assert.ok(plan.some(p=>p.detail.includes('INTEGER PRIMARY KEY')&&p.detail.includes('SEARCH')));
 const checkpoint=sql.prepare('SELECT total_changes() AS n').get().n;
 // Capacity rehearsal: 20 isolated readers, 3-second polls for three simulated hours, cold every five minutes,
 // and ten actual row updates every 30 seconds. No live credentials/data/network are used.
 const names=persistedNames;
 let readers=Array.from({length:20},()=>api.createIncrementalStore(db,names));returned=0;queries=[];
 const polls=3600;
 for(let tick=0;tick<polls;tick++){
  if(tick&&tick%100===0)readers=Array.from({length:20},()=>api.createIncrementalStore(db,names));
  if(tick%10===0)for(let j=0;j<10;j++)update.run(row('Score batch '+tick,'event-'+j),'event-'+j);
  // Exercise the incremental loader on EVERY poll, even though real 304 hits skip it entirely.
  for(const reader of readers)await reader.read();
  if(tick%100===0)queries=[];
 }
 const businessChanges=sql.prepare('SELECT total_changes() AS n').get().n-checkpoint;
 // Allow 20 indexed row reads on every poll for auth, permissions, revision, clock/maintenance and notifications.
 const budgetRows=returned+20*20*polls,writeBudget=businessChanges*2+20000;
 assert.ok(budgetRows<4000000,`D1 read reserve exceeded: ${budgetRows}`);
 assert.ok(writeBudget<80000,`D1 write reserve exceeded: ${writeBudget}`);
 const receipt={viewers:20,hours:3,pollSeconds:3,requests:20*polls,coldIntervalSeconds:300,changedRowsEvery30Seconds:9,returnedRows:returned,readBudgetIncludingIndexedAllowance:budgetRows,writeBudgetIncludingAllowance:writeBudget,quota:{reads:5000000,writes:100000,requests:100000},note:'SQLite functional/capacity rehearsal; conservative indexed-row allowance, not Cloudflare CPU or billing measurement. One event was deleted before the rehearsal, so nine of each ten UPDATE statements match.'};
 writeFileSync('.test-output/incremental-club-capacity.json',JSON.stringify(receipt,null,2)+'\n');
 console.log('PASS incremental reads: fresh versions, inserts/updates/deletes, immutable restore, rollback, concurrent readers, pruning, retry and indexed query plan.');console.log(JSON.stringify(receipt));
}finally{sqlitedb.close();delete globalThis.__incrementalClub}
