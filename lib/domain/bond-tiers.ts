/** 羁绊 between two members (docs/BONDS.md). Each stage starts at its `min` 好感度; `boost` multiplies the points of
 * every game the two play as partners while they are in that stage, so a pair that keeps playing together reaches
 * 莫逆之交 in about three years of weekly play, while early stages come within weeks. */
export const bondTiers=[
 {name:'萍水相逢',min:0,boost:1},{name:'泛泛之交',min:300,boost:1},{name:'金兰之契',min:1500,boost:2},
 {name:'朝夕相处',min:5000,boost:4},{name:'风雨同舟',min:15000,boost:8},{name:'情同手足',min:50000,boost:10},
 {name:'心有灵犀',min:80000,boost:14},{name:'生死与共',min:150000,boost:18},{name:'珠联璧合',min:250000,boost:22},
 {name:'情比金坚',min:350000,boost:26},{name:'莫逆之交',min:500000,boost:30},
] as const;
/** 好感度 for one game played as partners, before the stage boost, plus the extra for winning it together. */
export const bondGamePoints=60,bondWinPoints=40;
/** 好感度 per 羽币 of a shop gift's value. Gifts are not boosted. */
export const bondCoinPoints=50;
/** Received gifts are announced for this long; older ones are not brought up again. */
export const giftNoticeDays=30;

/** The stage a 好感度 score has reached. */
export function bondTierIndex(score:number){let i=0;while(i+1<bondTiers.length&&score>=bondTiers[i+1].min)i++;return i}
export type BondRow={playerId:string;score:number;games:number;wins:number;giftsSent:number;giftsReceived:number};
/** A received gift not yet acknowledged: coins, or a shop gift with its coin value. */
export type GiftNotice={id:string;fromPlayerId:string;coins:number;item?:string;value:number;message?:string;at:number};
