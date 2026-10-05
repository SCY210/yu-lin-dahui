export const achievementCatalog=[
 {id:'first-flight',name:'启程一羽',description:'完成第一场比赛，留下你的羽林足迹。',requirement:'完成 1 场有效比赛',metric:'matches',target:1,unit:'场',rarity:'初阶'},
 {id:'first-victory',name:'初露锋芒',description:'第一次与搭档一起赢下比赛。',requirement:'赢得 1 场有效比赛',metric:'wins',target:1,unit:'胜',rarity:'初阶'},
 {id:'ten-matches',name:'十战成章',description:'每一次上场，都在写下你的球场故事。',requirement:'累计完成 10 场有效比赛',metric:'matches',target:10,unit:'场',rarity:'进阶'},
 {id:'fifty-matches',name:'五十淬锋',description:'五十场磨练，让热爱沉淀成实力。',requirement:'累计完成 50 场有效比赛',metric:'matches',target:50,unit:'场',rarity:'珍稀'},
 {id:'ten-victories',name:'十胜破阵',description:'与不同的搭档，共同积累十次胜利。',requirement:'累计赢得 10 场有效比赛',metric:'wins',target:10,unit:'胜',rarity:'进阶'},
 {id:'three-streak',name:'三连之势',description:'在自己的连续三场比赛中保持全胜。',requirement:'达成 3 场连胜',metric:'bestStreak',target:3,unit:'连胜',rarity:'珍稀'},
 {id:'five-partners',name:'五路同修',description:'和五位不同球友并肩完成比赛。',requirement:'与 5 位不同搭档完成有效比赛',metric:'partners',target:5,unit:'位',rarity:'进阶'},
 {id:'three-game-victory',name:'三局决胜',description:'坚持到决胜局，赢下三局两胜的比赛。',requirement:'赢得 1 场打满三局的有效比赛',metric:'threeGameWins',target:1,unit:'场',rarity:'进阶'},
] as const;

export type AchievementId=typeof achievementCatalog[number]['id'];
export type AchievementMetric=typeof achievementCatalog[number]['metric'];
export const achievementRanks=[
 {level:1,name:'青铜',description:'朴素铜边 · 初识羽林'},
 {level:2,name:'白银',description:'银色双叶 · 稳步成长'},
 {level:3,name:'黄金',description:'金色羽翼 · 实力绽放'},
 {level:4,name:'铂金',description:'铂金卷纹 · 深厚积累'},
 {level:5,name:'钻石',description:'晶钻冠饰 · 生涯里程碑'},
] as const;
export const achievementTargets:Record<AchievementId,readonly [number,number,number,number,number]>={
 'first-flight':[1,3,5,10,20],'first-victory':[1,3,5,10,20],
 'ten-matches':[10,20,30,40,50],'fifty-matches':[50,75,100,150,200],
 'ten-victories':[10,20,30,40,50],'three-streak':[3,4,5,6,8],
 'five-partners':[5,6,8,10,12],'three-game-victory':[1,3,5,10,20],
};
export type AchievementProgress={current:number;unlockedAt:number|null;level:number;levelUnlockedAt:(number|null)[]};
export type AchievementSummary={unlockedCount:number;totalLevels:number;progress:Record<AchievementId,AchievementProgress>};
export const rankImage=(level:number)=>'/badges/ranks/level-'+Math.max(1,Math.min(5,level))+'.webp';
export function achievementLevel(id:AchievementId,current:number){return achievementTargets[id].filter(target=>current>=target).length}
export function achievementGoal(id:AchievementId,target:number){
 const metric=achievementCatalog.find(a=>a.id===id)!.metric;
 if(metric==='matches')return '累计完成 '+target+' 场有效比赛';
 if(metric==='wins')return '累计赢得 '+target+' 场有效比赛';
 if(metric==='bestStreak')return '达成 '+target+' 场连胜';
 if(metric==='partners')return '与 '+target+' 位不同搭档完成有效比赛';
 return '累计赢得 '+target+' 场打满三局的有效比赛';
}

export const badgeImage=(id:AchievementId)=>'/badges/'+id+'.webp';
