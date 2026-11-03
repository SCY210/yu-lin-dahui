export const achievementCatalog=[
 {id:'first-flight',name:'初入仙门',description:'踏入羽林仙门，每完成一场有效比赛，便积一分道行。',requirement:'完成 1 场有效比赛',metric:'matches',target:1,unit:'场',rarity:'初阶'},
 {id:'first-victory',name:'剑气初成',description:'首次与同伴斩落对手，剑气自此初成。',requirement:'赢得 1 场有效比赛',metric:'wins',target:1,unit:'胜',rarity:'初阶'},
 {id:'ten-matches',name:'四方论剑',description:'与各路高手论剑并胜之。每位对手只计一次，落败不增人数。',requirement:'击败 4 位不同对手',metric:'opponentsBeaten',target:4,unit:'位',rarity:'进阶'},
 {id:'fifty-matches',name:'勤修不辍',description:'修行贵在不辍。按比赛结束的马德里日期计，同一天打多场只计一日。',requirement:'在 3 个不同日期完成比赛',metric:'matchDays',target:3,unit:'天',rarity:'珍稀'},
 {id:'ten-victories',name:'金兰之契',description:'与同一位同伴并肩取胜，结下金兰之契。取单个同伴的最高累计胜场，换同伴后的胜场不合并。',requirement:'与同一搭档累计获胜 3 场',metric:'partnerWins',target:3,unit:'胜',rarity:'进阶'},
 {id:'three-streak',name:'不败金身',description:'连战连捷，金身不破。按生涯中最长的一段连续不败（连胜）场次计算，20、50、100 场不败分别对应宝品、仙品、神品。',requirement:'连续 3 场不败',metric:'bestStreak',target:3,unit:'场不败',rarity:'珍稀'},
 {id:'five-partners',name:'广结仙缘',description:'与五湖四海的同道并肩比赛，广结仙缘。',requirement:'与 5 位不同搭档完成有效比赛',metric:'partners',target:5,unit:'位',rarity:'进阶'},
 {id:'three-game-victory',name:'三局定乾坤',description:'鏖战至决胜局，一局定乾坤，赢下打满三局的比赛。',requirement:'赢得 1 场打满三局的有效比赛',metric:'threeGameWins',target:1,unit:'场',rarity:'进阶'},
 {id:'thunder-rout',name:'雷霆万钧',description:'一击如雷霆，赢下一局时把对手压在 10 分以内（含 10 分）。按赢下的局数计。',requirement:'赢 1 局对手不超过 10 分',metric:'routWins',target:1,unit:'局',rarity:'进阶'},
 {id:'endless-duel',name:'鏖战八荒',description:'20 平后寸步不让，赢下加分局（如 22:20）。按赢下的局数计。',requirement:'赢 1 局 20 平后的加分局',metric:'deuceWins',target:1,unit:'局',rarity:'进阶'},
 {id:'phoenix-rebirth',name:'浴火涅槃',description:'连败三场之后不坠道心，紧接着的一场便浴火重生、反手取胜。每次涅槃计一次。',requirement:'连输 3 场后紧接着赢 1 场',metric:'comebacks',target:1,unit:'次',rarity:'珍稀'},
 {id:'swift-journey',name:'一日千里',description:'一日之内连斩多阵，修为一日千里。取单个马德里日期内的最多胜场。',requirement:'一天之内赢 4 场',metric:'bestDayWins',target:4,unit:'胜',rarity:'珍稀'},
 {id:'secluded-cultivation',name:'闭关苦修',description:'在场上一拍一拍磨砺道心。累计比赛时长按开始到结束计，单场最多计 90 分钟。',requirement:'累计比赛 3 小时',metric:'courtHours',target:3,unit:'小时',rarity:'进阶'},
] as const;

export type AchievementId=typeof achievementCatalog[number]['id'];
export type AchievementMetric=typeof achievementCatalog[number]['metric'];
export const achievementRanks=[
 {level:1,name:'凡品',description:'铜纹初成 · 初识羽林'},
 {level:2,name:'灵品',description:'银叶生辉 · 灵气渐生'},
 {level:3,name:'宝品',description:'金羽展翼 · 宝光初现'},
 {level:4,name:'仙品',description:'玉纹叠翼 · 仙气盈身'},
 {level:5,name:'神品',description:'晶冠加冕 · 一代宗师'},
] as const;
export const achievementTargets:Record<AchievementId,readonly [number,number,number,number,number]>={
 'first-flight':[1,20,60,150,300],'first-victory':[1,10,35,100,220],
 'ten-matches':[4,6,10,15,20],'fifty-matches':[3,6,16,35,60],
 'ten-victories':[3,8,25,60,120],'three-streak':[3,10,20,50,100],
 'five-partners':[5,8,12,16,20],'three-game-victory':[1,5,12,25,50],
 'thunder-rout':[1,5,15,40,80],'endless-duel':[1,4,10,25,50],
 'phoenix-rebirth':[1,3,6,12,25],'swift-journey':[4,6,8,11,15],'secluded-cultivation':[3,12,35,90,200],
};
// Every stage also needs distinct lifetime Madrid play dates, so one long session cannot replace repeated participation.
// Only the two 初阶 themes can light up on a first play date; 进阶 needs a second date and 珍稀 a third.
// With roughly weekly club play, later stages take about one month, two to three months, five to six months and most of a year.
const entryDays=[1,4,10,20,40] as const,advancedDays=[2,5,12,24,40] as const,rareDays=[3,6,14,28,48] as const;
export const achievementParticipationDays:Record<AchievementId,readonly [number,number,number,number,number]>={
 'first-flight':entryDays,'first-victory':entryDays,
 'ten-matches':advancedDays,'ten-victories':advancedDays,'five-partners':advancedDays,'three-game-victory':advancedDays,
 'thunder-rout':advancedDays,'endless-duel':advancedDays,'secluded-cultivation':advancedDays,
 'fifty-matches':rareDays,'three-streak':rareDays,'phoenix-rebirth':rareDays,'swift-journey':rareDays,
};
export type AchievementProgress={current:number;unlockedAt:number|null;level:number;levelUnlockedAt:(number|null)[];partnerId?:string};
export type AchievementSummary={unlockedCount:number;totalLevels:number;matchDays:number;progress:Record<AchievementId,AchievementProgress>};
export const rankImage=(level:number)=>'/badges/ranks/level-'+Math.max(1,Math.min(5,level))+'.webp';
export function achievementLevel(id:AchievementId,current:number,matchDays:number){return achievementTargets[id].filter((target,index)=>current>=target&&matchDays>=achievementParticipationDays[id][index]).length}
export function achievementGoal(id:AchievementId,target:number){
 const metric=achievementCatalog.find(a=>a.id===id)!.metric;
 if(metric==='matches')return '累计完成 '+target+' 场有效比赛';
 if(metric==='wins')return '累计赢得 '+target+' 场有效比赛';
 if(metric==='bestStreak')return '连续 '+target+' 场不败';
 if(metric==='routWins')return '累计赢 '+target+' 局对手不超过 10 分';
 if(metric==='deuceWins')return '累计赢 '+target+' 局 20 平后的加分局';
 if(metric==='comebacks')return '连输 3 场后反胜，累计 '+target+' 次';
 if(metric==='bestDayWins')return '一天之内赢 '+target+' 场';
 if(metric==='courtHours')return '累计比赛 '+target+' 小时';
 if(metric==='partners')return '与 '+target+' 位不同搭档完成有效比赛';
 if(metric==='opponentsBeaten')return '击败 '+target+' 位不同对手';
 if(metric==='matchDays')return '在 '+target+' 个不同日期完成比赛';
 if(metric==='partnerWins')return '与同一搭档累计获胜 '+target+' 场';
 return '累计赢得 '+target+' 场打满三局的有效比赛';
}

export const badgeImage=(id:AchievementId)=>'/badges/'+id+'.webp';
