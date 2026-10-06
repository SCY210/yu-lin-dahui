/** Display-only realms: ranking points and Elo calculations keep their own rules. */
export const cultivationRealms = [
  {name:'炼气', minimum:-Infinity, range:'低于 1100'},
  {name:'筑基', minimum:1100, range:'1100 至小于 1232'},
  {name:'金丹', minimum:1232, range:'1232 至小于 1300'},
  {name:'元婴', minimum:1300, range:'1300 至小于 1380'},
  {name:'化神', minimum:1380, range:'1380 及以上'},
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
  // The shared default strength starts at炼气初期, with no earned progress.
  const minimum=index===0?1000:cultivationRealms[index].minimum;
  const progressPercent=Math.max(0,Math.min(99,Math.floor((rating-minimum)/(next.minimum-minimum)*100)));
  const stage=progressPercent<34?'初期':progressPercent<67?'中期':'后期';
  return {realm,nextRealm:next.name,stage,progressPercent};
}
