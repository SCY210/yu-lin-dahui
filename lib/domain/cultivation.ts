/** Display-only realms: ranking points and Elo calculations keep their own rules. */
export const cultivationRealms = [
  {name:'炼气', minimum:-Infinity, range:'低于 900'},
  {name:'筑基', minimum:900, range:'900 至小于 1032'},
  {name:'金丹', minimum:1032, range:'1032 至小于 1100'},
  {name:'元婴', minimum:1100, range:'1100 至小于 1180'},
  {name:'化神', minimum:1180, range:'1180 及以上'},
] as const;

export function cultivationRealm(rating:number) {
  return [...cultivationRealms].reverse().find(realm=>rating>=realm.minimum)?.name ?? cultivationRealms[0].name;
}

/** Progress describes current strength within a realm; it does not award points. */
export function cultivationProgress(rating:number) {
  const realm=cultivationRealm(rating);
  const index=cultivationRealms.findIndex(level=>level.name===realm);
  const next=cultivationRealms[index+1];
  if(!next)return {realm,nextRealm:null,stage:'圆满',progressPercent:100};
  const minimum=index===0?800:cultivationRealms[index].minimum;
  const progressPercent=Math.max(0,Math.min(99,Math.floor((rating-minimum)/(next.minimum-minimum)*100)));
  const stage=progressPercent<34?'初期':progressPercent<67?'中期':'后期';
  return {realm,nextRealm:next.name,stage,progressPercent};
}
