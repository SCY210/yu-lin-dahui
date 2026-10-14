export const dynamic='force-dynamic';
const retired=()=>Response.json({error:'模拟活动已停用，请返回活动页面'},{status:410,headers:{'Cache-Control':'no-store'}});
/** Old clients receive a cheap tombstone without authentication or D1 access. */
export async function GET(){return retired()}
export async function POST(req:Request){await req.body?.cancel().catch(()=>{});return retired()}
