import {seasonPointsPolicy} from '../domain/season-points';

/** The point fields of a leaderboard row (aggregateLeaderboard in lib/domain/ranking.ts). */
export type BreakdownRow={points:number;wins?:number;losses?:number;upsetPoints?:number;streakPoints?:number;mvpPoints?:number;bountyPoints?:number;notificationPoints?:number;attendancePoints?:number;manualPoints?:number};
export type BreakdownLine={label:string;points:number};

/** Where a ranking row's points come from (docs/RANKING_POINTS_BREAKDOWN.md): non-zero sources only, adding up to `points`.
 * Anything the known sources do not explain shows as 其他调整, so the lines always match the total. */
export function pointsBreakdown(r:BreakdownRow):BreakdownLine[]{
 const wins=r.wins??0,losses=r.losses??0;
 const lines:BreakdownLine[]=[
  {label:`胜局 ${wins} × ${seasonPointsPolicy.win}`,points:wins*seasonPointsPolicy.win},
  {label:`负局 ${losses} × ${-seasonPointsPolicy.loss}`,points:losses*seasonPointsPolicy.loss},
  {label:'强弱加成',points:r.upsetPoints??0},
  {label:'连胜加分',points:r.streakPoints??0},
  {label:'MVP 加分',points:r.mvpPoints??0},
  {label:'悬赏',points:r.bountyPoints??0},
  {label:'通知积分',points:r.notificationPoints??0},
  {label:'迟到扣分',points:r.attendancePoints??0},
  {label:'群主调整',points:r.manualPoints??0},
 ];
 const rest=r.points-lines.reduce((n,line)=>n+line.points,0);
 return [...lines,{label:'其他调整',points:rest}].filter(line=>line.points!==0);
}
