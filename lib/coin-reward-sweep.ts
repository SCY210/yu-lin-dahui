type SweepPort={db:D1Database;now:number;settle:()=>Promise<unknown>};
export const coinRewardSweepKey='automatic-coins-sweep-v1';
/** Only scan event metadata while idle; a separate cursor never rewrites club settings. */
export async function runCoinRewardSweep({db,now,settle}:SweepPort){
 const settings=await db.prepare('SELECT payload FROM settings WHERE id=?').bind('club').first<{payload:string}>();
 if(!settings)return {settled:false};
 const club=JSON.parse(settings.payload) as {initialized?:boolean;automaticCoins?:{activatedAt:number}};
 if(!club.initialized)return {settled:false};
 const marker=await db.prepare('SELECT payload FROM settings WHERE id=?').bind(coinRewardSweepKey).first<{payload:string}>();
 const recorded=marker?Number((JSON.parse(marker.payload) as {through?:number}).through):NaN;
 const activation=club.automaticCoins?.activatedAt;
 const from=Number.isFinite(recorded)&&recorded<=now?recorded:activation;
 let due=!Number.isFinite(activation);
 if(!due){
  const lower=Math.max(activation!,from??activation!);
  const result=await db.prepare("SELECT id FROM events WHERE json_extract(payload,'$.end')>? AND json_extract(payload,'$.end')<=? AND json_extract(payload,'$.status') NOT IN ('draft','cancelled') UNION ALL SELECT m.id FROM matches m JOIN events e ON e.id=m.event_id WHERE json_extract(m.payload,'$.status')='complete' AND json_extract(m.payload,'$.end')>? AND json_extract(m.payload,'$.end')<=? AND json_extract(e.payload,'$.end')>? AND json_extract(e.payload,'$.end')<=? LIMIT 1").bind(lower,now,lower,now,activation!,now).first();
  due=!!result;
 }
 if(due)await settle();
 // Advance only after successful settlement; failures remain eligible for retry.
 await db.prepare('INSERT INTO settings(id,payload) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').bind(coinRewardSweepKey,JSON.stringify({through:now})).run();
 return {settled:due};
}
