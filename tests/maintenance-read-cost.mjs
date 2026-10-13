import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sqliteD1} from './helpers/sqlite-d1.mjs';
mkdirSync('.test-output',{recursive:true});
const database=sqliteD1(),calls=[];
function observe(statement){return {...statement,bind(...args){return observe(statement.bind(...args))},async first(){calls.push([statement]);return statement.first()},async all(){calls.push([statement]);return statement.all()},async run(){calls.push([statement]);return statement.run()}};}
globalThis.__maintenanceCost={env:{DB:{prepare:query=>observe(database.db.prepare(query)),async batch(queries){calls.push(queries);return database.db.batch(queries)}}}};
await build({stdin:{contents:`export {loadClubState} from './lib/club-maintenance';export {emptyState} from './lib/domain/types';export {load,save} from './lib/store';export {requestedEventDateRepair} from './lib/requested-event-date-repair';export {requestedThursdaySplit} from './lib/requested-thursday-split';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/maintenance-read-cost.mjs',plugins:[{name:'isolated-maintenance-cost',setup(builder){builder.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'maintenance-cost'}));builder.onLoad({filter:/.*/,namespace:'maintenance-cost'},()=>({loader:'js',contents:'export const env=globalThis.__maintenanceCost.env;'}));}}]});
const api=await import(pathToFileURL(resolve('.test-output/maintenance-read-cost.mjs')).href);
try{
 const state=api.emptyState(),previous=structuredClone(state);state.settings={...state.settings,initialized:true,ownerAccountId:'owner',realmVersion:'elo-v1',rankingVersion:'signed-v1',scoringPolicy:'all-ranked-v1'};state.accounts.push({id:'owner',email:'',role:'admin',playerId:'player'});state.players.push({id:'player',name:'Fictional owner',ownerId:'owner',enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});await api.save(state,'fixture',previous);
 const warmed=await api.loadClubState(),baselineCount=database.sql.prepare('SELECT COUNT(*) AS n FROM commits').get().n;
 const keys=[api.requestedEventDateRepair.key,api.requestedThursdaySplit.key];keys.forEach((key,index)=>database.sql.prepare('INSERT INTO commits(revision,key,at) VALUES(?,?,?)').run(warmed.revision+index+1,key,1));
 calls.length=0;const completed=await api.loadClubState();assert.equal(calls.length,2,'one maintenance lookup and one state batch');assert.ok(calls[0][0].query.includes('key IN (?,?)'));assert.equal(completed.revision,warmed.revision+2);assert.equal(database.sql.prepare('SELECT COUNT(*) AS n FROM commits').get().n,baselineCount+2);
 for(const key of keys)database.sql.prepare('DELETE FROM commits WHERE key=?').run(key);
 calls.length=0;await api.loadClubState();const guards=calls.flat().filter(s=>s.query==='SELECT revision FROM commits WHERE key = ?').map(s=>s.args[0]);assert.deepEqual(guards,keys,'pending jobs retain date-repair before fee-confirmation order');assert.equal(database.sql.prepare('SELECT COUNT(*) AS n FROM commits').get().n,baselineCount,'missing targets are not marked complete');
 console.log('PASS maintenance read cost: completed jobs use one lookup plus one state batch (2 trips vs previous 3); pending jobs retain ordered guards and no negative-result caching.');
}finally{database.close();delete globalThis.__maintenanceCost}
