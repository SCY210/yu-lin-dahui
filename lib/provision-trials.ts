import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {load,raw,save,committed} from './store';

// Temporary, owner-configured data provisioning. No request data is accepted here.
const configSchema=z.object({runId:z.string().uuid(),entries:z.array(z.object({
 username:z.enum(['trial01','trial02','trial03']),name:z.string().trim().min(1).max(150),
 accountId:z.string().startsWith('account:').max(100),playerId:z.string().uuid(),
 salt:z.string().regex(/^[0-9a-f]{64}$/),hash:z.string().regex(/^[0-9a-f]{128}$/)
}).strict()).length(3)}).strict();
export async function provisionConfiguredTrials(){
 const value=(env as unknown as Record<string,unknown>).TRIAL_ACCOUNT_PROVISION;
 if(typeof value!=='string'||!value)return;
 const config=configSchema.parse(JSON.parse(value));
 if(new Set(config.entries.map(e=>e.username)).size!==3||new Set(config.entries.map(e=>e.accountId)).size!==3||new Set(config.entries.map(e=>e.playerId)).size!==3)throw new Error('试用配置重复');
 const key='site-owner:trial-provision:'+config.runId;
 for(let attempt=0;attempt<4;attempt++){
  if(await committed(key))return;
  const state=await load();if(!state.settings.initialized||!state.accounts.some(a=>a.role==='admin'))throw new Error('群组尚未开通');
  for(const entry of config.entries){
   if(state.accounts.some(a=>a.id===entry.accountId)||state.players.some(p=>p.id===entry.playerId)||await raw().prepare('SELECT id FROM password_credentials WHERE username=?').bind(entry.username).first())throw new Error('试用账号已存在');
  }
  const previous=structuredClone(state),now=Date.now();
  for(const entry of config.entries){
   state.accounts.push({id:entry.accountId,email:'',role:'member',playerId:entry.playerId});
   state.players.push({id:entry.playerId,ownerId:entry.accountId,name:entry.name,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'试用账号初始水平'});
  }
  state.audits.push({id:crypto.randomUUID(),at:now,actor:'system:site-owner',action:'createTrialAccounts',reason:'网站所有者请求创建三个普通成员试用账号',changes:{usernames:config.entries.map(e=>e.username)}});
  try{
   await save(state,key,previous,config.entries.map(e=>raw().prepare('INSERT INTO password_credentials(id,username,salt,hash,created) VALUES(?,?,?,?,?)').bind(e.accountId,e.username,e.salt,e.hash,now)));
   return;
  }catch(e){if(String(e).includes('UNIQUE constraint failed: commits')&&attempt<3)continue;throw e}
 }
 throw new Error('试用账号开通未完成');
}
