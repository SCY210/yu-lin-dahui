export const guideTopics = [
  'ranking', 'annualRanking', 'rating', 'titles', 'activities', 'signup', 'grouping',
  'matches', 'fees', 'partners', 'challenges', 'state', 'modes',
  'photos', 'annual', 'accounts',
] as const;

export type GuideTopic = typeof guideTopics[number];
export type GuideSection = {title:string; paragraphs?:string[]; items?:string[]};
export type FeatureGuideContent = {
  title:string;
  description:string;
  sections:GuideSection[];
  table?:{caption:string; columns:string[]; rows:string[][]};
  example?:{title:string; text:string};
  related:GuideTopic[];
};

export const guideLabels:Record<GuideTopic,string> = {
  ranking:'月度积分与排名', annualRanking:'年度积分与排名', rating:'实力与修仙境界', titles:'称号与投票',
  activities:'活动与比赛', signup:'报名与候补', grouping:'分组与轮休',
  matches:'比分与计分赛', fees:'费用分摊', partners:'搭档与交手',
  challenges:'复仇挑战', state:'最近状态', modes:'玩法与随机身份',
  photos:'照片与头像', annual:'年度总结', accounts:'账号与权限',
};

