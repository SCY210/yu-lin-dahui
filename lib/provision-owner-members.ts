import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {load,save,committed,raw} from './store';
import {normalizeUsername} from './password';

const entry=z.object({
 name:z.string().trim().min(1).max(150),username:z.string().min(2).max(32).regex(/^[a-z0-9_\-\u4e00-\u9fff]+$/),
 accountId:z.string().startsWith('account:').max(100),playerId:z.string().uuid(),
 salt:z.string().regex(/^[0-9a-f]{64}$/),hash:z.string().regex(/^[0-9a-f]{128}$/),
}).strict().refine(e=>e.username===normalizeUsername(e.name),'账号必须与指定名字对应');
const schema=z.object({runId:z.string().uuid(),entries:z.array(entry).length(18)}).strict();

/** One owner-configured batch; no request data can select members or grant roles. */
export async function provisionOwnerMembers(){
 const config=(env as unknown as Record<string,unknown>).OWNER_MEMBER_BATCH;
 if(typeof config!=='string'||!config)return;
 const seed=schema.parse(JSON.parse(config));
 for(const field of ['username','accountId','playerId'] as const)if(new Set(seed.entries.map(e=>e[field])).size!==18)throw new Error('批量账号有重复项');
 const key='site-owner:member-batch:'+seed.runId;
 if(await committed(key))return;
 for(let attempt=0;attempt<4;attempt++){
  const state=await load();
  if(await committed(key))return;
  if(!state.settings.initialized||!state.accounts.some(a=>a.role==='admin'))throw new Error('群组尚未由管理员开通');
  const existing=await raw().prepare('SELECT username FROM password_credentials').all<{username:string}>();
  if(seed.entries.some(e=>existing.results.some(c=>c.username===e.username)||state.accounts.some(a=>a.id===e.accountId)||state.players.some(p=>p.id===e.playerId||normalizeUsername(p.name)===e.username)))throw new Error('账号或同名档案已存在，批量创建未覆盖任何记录');
  const previous=structuredClone(state),now=Date.now();
  const accounts=seed.entries.map(e=>({id:e.accountId,email:'',role:'member' as const,playerId:e.playerId}));
  const players=seed.entries.map(e=>({id:e.playerId,ownerId:e.accountId,name:e.name,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'管理员创建球友账号'}));
  state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:site-owner',action:'createLoginAccountBatch',reason:'网站所有者指定创建18个普通成员账号',changes:{count:18,usernames:seed.entries.map(e=>e.username)}});
  // Each bulk INSERT stays below D1's 100-bound-parameter limit; together with
  // the revision gate and audit they commit as one batch, without partial users.
  const insertAccounts=raw().prepare('INSERT INTO accounts(id,email,role,player_id,payload) VALUES '+accounts.map(()=>'(?,?,?,?,?)').join(',')).bind(...accounts.flatMap(a=>[a.id,a.email,a.role,a.playerId,JSON.stringify(a)]));
  const insertPlayers=raw().prepare('INSERT INTO players(id,owner_id,payload) VALUES '+players.map(()=>'(?,?,?)').join(',')).bind(...players.flatMap(p=>[p.id,p.ownerId,JSON.stringify(p)]));
  const insertCredentials=raw().prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES '+seed.entries.map(()=>'(?,?,?,?,?)').join(',')).bind(...seed.entries.flatMap(e=>[e.accountId,e.username,e.salt,e.hash,now]));
  try{await save(state,key,previous,[insertAccounts,insertPlayers,insertCredentials]);return}catch(error){
   if(attempt<3&&String(error).includes('UNIQUE constraint failed: commits'))continue;
   throw error;
  }
 }
 throw new Error('同时操作较多，请稍后再试');
}
