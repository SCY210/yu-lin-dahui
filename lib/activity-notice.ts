/** Bump the version whenever the confirmed text changes; keep prior versions in source history. */
export const activityNoticeVersion='2026-10-12-v2';
export const activityNoticeVersionLabel='2026年10月12日 · 第2版';
export const activityNoticeTitle='活动参与须知与风险提示';
export const activityNoticeSummary='请了解运动风险、参与规则和确认记录的用途，自愿参加并遵守安全要求。本确认不免除任何主体依法应承担的责任。';
export const activityNoticeSections=[
 {title:'自愿参加与运动风险',body:'羽毛球活动存在扭伤、拉伤、跌倒、碰撞，以及被球或球拍击中等风险。请根据自己的身体状态、运动能力和现场情况决定是否参加及运动强度；如有不适，应停止运动并及时寻求帮助。无需在报名或档案中提交健康、病史等敏感资料。'},
 {title:'现场安全与球友相处',body:'请遵守场馆规定、活动安排和基本运动礼仪，使用适合的装备，避免危险动作。留意周围球友、场地及器材状况，发现安全隐患时及时提醒组织者，并停止可能造成危险的活动。尊重他人，配合必要的安全提醒。'},
 {title:'接龙、取消与费用',body:'请如实填写本次参加的场地和时间，并查看活动页面中的名额、候补、取消及费用规则。费用分摊和活动变更应按本次活动公布并依法有效的规则处理；对安排或金额有疑问，请联系活动创建者或管理员核对。'},
 {title:'随身物品与责任边界',body:'请妥善保管随身物品；如需交由他人保管，应另行明确约定。本须知用于提示风险和明确参与规则，不表示任何人放弃依法享有的权利，也不免除组织者、场馆、球友或其他主体依法应承担的责任。实际责任依具体行为、事实和适用法律确定。'},
 {title:'个人资料由本人自愿填写',body:'球龄、惯用手、打法、装备、口号等扩展球员档案资料由本人自愿提供，请避免填写不必要的敏感信息。接龙所需的账号、参与者及参加时段等信息用于安排活动。本次确认仅针对活动参与规则和风险提示，不包含照片对外公开授权；个人资料自愿提供也不表示放弃相应隐私权利。'},
 {title:'本次确认如何记录',body:'登录后的账号确认会由服务器记录实际操作账号、确认时间、须知版本、完整内容快照和内容摘要。提交接龙时，另行记录对应参与者、活动或场地及实际操作账号，用于核对本次参与确认。代报名会标记为代理操作，不会记成朋友本人在网站上签署。代报名者应向同行朋友说明本次活动须知。记录用于核对，不属于经核验的电子签名或公证，也不保证法律免责；照片和个人信息的其他处理请查看隐私说明。'},
] as const;
export const accountNoticeScope='请先阅读并确认，再继续使用羽林大会。你可以选择退出登录，稍后再决定。';
export const accountNoticeCheckbox='我已阅读并同意活动参与须知与风险提示。';
export function activityNoticeSnapshot(){
 return JSON.stringify({version:activityNoticeVersion,title:activityNoticeTitle,summary:activityNoticeSummary,sections:activityNoticeSections,accountScope:accountNoticeScope,confirmation:accountNoticeCheckbox});
}
