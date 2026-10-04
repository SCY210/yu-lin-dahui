/** Display-only realms: ranking points and Elo calculations keep their own rules. */
export const cultivationRealms = [
  {name:'炼气', minimum:-Infinity, range:'低于 900'},
  {name:'筑基', minimum:900, range:'900 至小于 1050'},
  {name:'金丹', minimum:1050, range:'1050 至小于 1200'},
  {name:'元婴', minimum:1200, range:'1200 至小于 1400'},
  {name:'化神', minimum:1400, range:'1400 及以上'},
] as const;

export function cultivationRealm(rating:number) {
  return [...cultivationRealms].reverse().find(realm=>rating>=realm.minimum)?.name ?? cultivationRealms[0].name;
}
