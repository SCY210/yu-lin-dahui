/** Server-only raw-row snapshots. Every reuse checks D1 in a fresh transaction; callers get their own parsed state.
 * Nothing here is sent to clients or used to authorize a viewer. SQL triggers include deletes and non-store writers. */
export type StoredRow={id:string;payload:string};
type Head={revision:number;cursor:number;first:number};
type Change={seq:number;table_name:string;row_id:string;payload:string|null};
type Snapshot={head:Head;tables:Map<string,Map<string,string>>;bytes:number};
const maximumChanges=4096,maximumBytes=16*1024*1024;
const headQuery=`SELECT COALESCE((SELECT MAX(revision) FROM commits),0) AS revision,
 COALESCE((SELECT MAX(seq) FROM club_changes),0) AS cursor,
 COALESCE((SELECT MIN(seq) FROM club_changes),0) AS first`;

export function createIncrementalStore(db:D1Database,names:readonly string[]){
 let cached:Snapshot|null=null;
 // Serialize cache updates, not request projections. Each caller still verifies the database after preceding callers.
 let queue:Promise<unknown>=Promise.resolve();
 const allowed=new Set(['settings',...names]);
 function head(row:Record<string,unknown>):Head{
  const result={revision:Number(row.revision),cursor:Number(row.cursor),first:Number(row.first)};
  if(Object.values(result).some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('Invalid incremental snapshot version');
  return result;
 }
 async function full():Promise<Snapshot>{
  const tables=['settings',...names];
  const batch=await db.batch<Record<string,unknown>>([db.prepare(headQuery),...tables.map(name=>db.prepare(`SELECT id,payload FROM ${name}${name==='settings'?" WHERE id='club'":''}`))]);
  let bytes=0;
  const rows=new Map(tables.map((name,i)=>[name,new Map(batch[i+1].results.map(row=>{
   const id=String(row.id),payload=String(row.payload);bytes+=2*(id.length+payload.length);return [id,payload];
  }))]));
  return {head:head(batch[0].results[0]),tables:rows,bytes};
 }
 async function next():Promise<Snapshot>{
  const before=cached;
  if(!before)return full();
  const batch=await db.batch<Record<string,unknown>>([
   db.prepare(headQuery),
   db.prepare('SELECT seq,table_name,row_id,payload FROM club_changes WHERE seq>? ORDER BY seq LIMIT ?').bind(before.head.cursor,maximumChanges+1),
  ]);
  const latest=head(batch[0].results[0]),changes=batch[1].results as Change[];
  if(latest.cursor<before.head.cursor||latest.revision<before.head.revision||
     (latest.first>before.head.cursor+1)||changes.length>maximumChanges||
     (latest.cursor>before.head.cursor&&changes.at(-1)?.seq!==latest.cursor))return full();
  const tables=new Map(before.tables),copied=new Set<string>();let bytes=before.bytes;
  for(const change of changes){
   if(!allowed.has(change.table_name)||(change.table_name==='settings'&&change.row_id!=='club'))throw new Error('Invalid incremental snapshot table');
   if(!copied.has(change.table_name)){tables.set(change.table_name,new Map(tables.get(change.table_name)));copied.add(change.table_name)}
   const table=tables.get(change.table_name)!,old=table.get(change.row_id);
   if(old!==undefined)bytes-=2*(change.row_id.length+old.length);
   if(change.payload===null)table.delete(change.row_id);
   else{table.set(change.row_id,change.payload);bytes+=2*(change.row_id.length+change.payload.length)}
  }
  return {head:latest,tables,bytes};
 }
 return {
  async read(){
   const job=queue.then(async()=>{const snapshot=await next();cached=snapshot.bytes<=maximumBytes?snapshot:null;return snapshot});queue=job.then(()=>undefined,()=>undefined);
   const snapshot=await job;
   // The restore closure captures an immutable snapshot, never the moving cache head.
   return {revision:snapshot.head.revision,rows:(name:string):StoredRow[]=>Array.from(snapshot.tables.get(name)??[],([id,payload])=>({id,payload}))};
  },
 };
}
