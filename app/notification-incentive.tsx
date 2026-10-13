import type {NotificationIncentive} from '../lib/client/push-notifications';

export function NotificationIncentiveNotice({incentive}:{incentive?:NotificationIncentive}){
 return <div className="connection-note"><strong>通知积分规则</strong><p>首次开启并验证成功，双打赛季积分 +10；领取奖励后，在站内关闭任意一台设备，或下次进入网站、从后台返回时检测到这台设备的通知权限已关闭，双打赛季积分 −30。奖励、扣分每个账号各一次，重新开启不再奖励，不影响修为。</p><p className="hint">不开启不扣分。退出登录、网络故障、订阅失效不扣分；系统开关未反映为浏览器权限变化、无法确认原设备时，不据此扣分。{incentive?.status==='earned'?'你已领取 10 分奖励。':incentive?.status==='disabled'?'本账号的奖励和关闭扣分已结算。':''}</p></div>;
}
