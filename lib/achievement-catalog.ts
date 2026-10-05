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
export type AchievementProgress={current:number;unlockedAt:number|null};
export type AchievementSummary={unlockedCount:number;progress:Record<AchievementId,AchievementProgress>};

export const badgeImage=(id:AchievementId)=>'/badges/'+id+'.webp';
