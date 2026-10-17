import {exportTables,type ExportEnvironment} from './operator-export';
type Environment=ExportEnvironment&{MIGRATION_IMPORT_TOKEN?:string;MIGRATION_IMPORT_EXPIRES_AT?:string;MIGRATION_IMPORT_ORIGIN?:string;YULIN_HOSTING_PROVIDER?:string};
const allowed=new Set<string>(exportTables),root='/_operator/restore/';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
/** Temporary owner-operated, host-pinned restore port. Removed after verified import. */
export async function operatorRestore(request:Request,env:Environment,now=Date.now()):Promise<Response|null>{
 const url=new URL(request.url);if(!url.pathname.startsWith(root))return null;
 const token=env.MIGRATION_IMPORT_TOKEN,expires=Number(env.MIGRATION_IMPORT_EXPIRES_AT),supplied=request.headers.get('Authorization')??'';
 if(env.YULIN_HOSTING_PROVIDER==='cloudflare'||url.origin!==env.MIGRATION_IMPORT_ORIGIN||!token||!/^[a-f0-9]{64}$/.test(token)||!Number.isFinite(expires)||expires<=now||expires>now+86400000||supplied.length!==token.length+7)return json({error:'Not found'},404);
 let difference=0;const expected='Bearer '+token;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^supplied.charCodeAt(i);if(difference)return json({error:'Not found'},404);
 if(!env.DB||!env.BUCKET)return json({error:'Storage unavailable'},503);
 try{
  if(url.pathname===root+'object'&&request.method==='PUT'){
   const key=url.searchParams.get('key'),digest=request.headers.get('x-content-sha256');if(!key||!key.startsWith('media/')||!digest||!/^[a-f0-9]{64}$/.test(digest))return json({error:'Invalid object'},400);
   if(Number(request.headers.get('Content-Length'))>20*1024*1024)return json({error:'Object too large'},413);
   const bytes=await request.arrayBuffer();if(bytes.byteLength>20*1024*1024)return json({error:'Object too large'},413);
   const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==digest)return json({error:'Digest mismatch'},400);
   await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:request.headers.get('Content-Type')??'application/octet-stream'}});return json({sha256:actual,size:bytes.byteLength});
  }
  if(url.pathname===root+'schema'&&request.method==='GET'){
   const tables=[...allowed],results=await env.DB.batch(tables.map(t=>env.DB!.prepare(`PRAGMA table_info("${t}")`)));
   return json({columns:Object.fromEntries(tables.map((t,i)=>[t,results[i].results.map(row=>(row as {name:string}).name)]))});
  }
  if(request.method!=='POST')return json({error:'Not found'},404);
  if(Number(request.headers.get('Content-Length'))>1024*1024)return json({error:'Batch too large'},413);
  const p=await request.json() as {expectedRevision?:number;tables?:string[];table?:string;rows?:Record<string,unknown>[]};
  if(url.pathname===root+'finish'){
   await env.DB.prepare('DELETE FROM club_changes').run();const check=await env.DB.prepare('PRAGMA foreign_key_check').all();return json({foreignKeyViolations:check.results.length});
  }
  if(url.pathname===root+'begin'){
   if(!Array.isArray(p.tables)||p.tables.length!==new Set(p.tables).size||p.tables.some(t=>!allowed.has(t)))return json({error:'Invalid table set'},400);
   const version=await env.DB.prepare('SELECT MAX(revision) AS revision FROM commits').first<{revision:number}>();if(version?.revision!==p.expectedRevision)return json({error:'Destination revision changed'},409);
   await env.DB.batch([env.DB.prepare('PRAGMA defer_foreign_keys=TRUE'),...p.tables.filter(t=>t!=='accountNoticeReceipts').map(t=>env.DB!.prepare(`DELETE FROM "${t}"`))]);return json({clearedTables:p.tables.length-1});
  }
  if(url.pathname===root+'table'){
   if(!p.table||!allowed.has(p.table)||!Array.isArray(p.rows)||p.rows.length>75)return json({error:'Invalid table batch'},400);
   const columns=(await env.DB.prepare(`PRAGMA table_info("${p.table}")`).all<{name:string}>()).results.map(x=>x.name);if(!columns.length||columns.some(c=>!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)))return json({error:'Invalid schema'},400);
   const qs=p.rows.map(row=>{if(Object.keys(row).some(k=>!columns.includes(k))||columns.some(k=>!(k in row)))throw Error('Schema mismatch');const values=columns.map(k=>row[k]);if(values.some(v=>v!==null&&typeof v!=='string'&&typeof v!=='number'))throw Error('Invalid value');return env.DB!.prepare(`INSERT ${p.table==='accountNoticeReceipts'?'OR IGNORE ':''}INTO "${p.table}" (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).bind(...values)});
   if(qs.length)await env.DB.batch(qs);return json({inserted:p.rows.length});
  }
  return json({error:'Not found'},404);
 }catch{return json({error:'Restore failed; retain backup and inspect before retry'},503)}
}
