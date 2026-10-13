import type {NotificationIncentive} from '../lib/client/push-notifications';

export function NotificationIncentiveNotice({incentive}:{incentive?:NotificationIncentive}){
 return <div className="connection-note"><strong>通知积分规则</strong><p>首次开启并验证成功，双打赛季积分 +10；领取奖励后，在站内主动关闭任意一台通知设备，双打赛季积分 −30。奖励、扣分每个账号各一次，重新开启不再奖励，不影响修为。</p><p className="hint">不开启不扣分。退出登录、网络故障、订阅失效不扣分；浏览器或系统中直接关闭可能无法识别。{incentive?.status==='earned'?'你已领取 10 分奖励。':incentive?.status==='disabled'?'本账号的奖励和关闭扣分已结算。':''}</p></div>;
}
