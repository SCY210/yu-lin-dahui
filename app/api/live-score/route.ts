import {z} from 'zod';
import {getAppUser} from '../../../lib/auth';
import {raw,clubReadVersion} from '../../../lib/store';
import {readJsonBody,RequestError} from '../../../lib/request-body';
import {assertWriteRequest,writeErrorResponse} from '../../../lib/write-security';
import {consumeRateLimit} from '../../../lib/rate-limit';
import {liveOpInput} from '../../../lib/domain/live-score';
import {applyLiveScore,liveScores,LiveScoreError} from '../../../lib/live-score-store';
import type {Player} from '../../../lib/domain/types';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});

/** Live referee scoring (docs/LIVE_SCORING.md). GET: the live scores of one competition, for every member's board.
 * POST: one referee operation. Both read only the rows they need. */
async function member(){
 const user=await getAppUser();if(!user)throw new RequestError('请先登录',401);
 const version=await clubReadVersion(user.userId);if(!version.settings.initialized||!version.account)throw new RequestError('仅群组成员可以查看比分',403);
 const row=await raw().prepare('SELECT payload FROM players WHERE id=?').bind(version.account.playerId).first<{payload:string}>();
 if(!row||!(JSON.parse(row.payload) as Player).enabled)throw new RequestError('账号当前不可用',403);
 return version.account;
}
const failure=(error:unknown)=>error instanceof LiveScoreError?reply({error:error.message},error.status):writeErrorResponse(error);

export async function GET(req:Request){try{
 await member();
 const eventId=z.string().min(1).max(100).parse(new URL(req.url).searchParams.get('eventId'));
 return reply({scores:await liveScores(eventId),at:Date.now()});
}catch(error){return failure(error)}}

export async function POST(req:Request){try{
 assertWriteRequest(req);const account=await member();
 await consumeRateLimit('live-score:'+account.id,900,5*60000);
 const op=liveOpInput.parse(await readJsonBody(req,2048));
 return reply({score:await applyLiveScore(account,op)});
}catch(error){return failure(error)}}
