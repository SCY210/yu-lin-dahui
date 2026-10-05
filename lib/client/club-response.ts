const isObject=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** A proxy's HTML/partial error page must never replace the last usable view. */
export function isClubResponse(value:unknown){
 if(!isObject(value))return false;
 if(value.setup===true||value.join===true)return isObject(value.user)&&typeof value.user.name==='string';
 if(!isObject(value.me)||typeof value.me.id!=='string'||typeof value.me.playerId!=='string'||!['admin','member'].includes(value.me.role))return false;
 if(!isObject(value.settings)||typeof value.settings.name!=='string'||!isObject(value.settings.rules))return false;
 if(!Number.isInteger(value.revision)||typeof value.period!=='string'||!Number.isInteger(value.rankingYear))return false;
 for(const key of ['players','events','bookings','registrations','attendance','rounds','matches','costs','seasons','leaderboard','annualLeaderboard','challenges','tagVotes','awardVotes','photos','settlements','audits','accounts','drafts'])if(!Array.isArray(value[key]))return false;
 if(!isObject(value.social)||!isObject(value.rotationPlans))return false;
 for(const key of ['stats','funny','personality','annual'])if(!Array.isArray(value.social[key]))return false;
 for(const key of ['arenas','courtBoards','matchLevels'])if(!isObject(value.social[key]))return false;
 return true;
}
