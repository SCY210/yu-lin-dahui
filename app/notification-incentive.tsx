import type {NotificationIncentive} from '../lib/client/push-notifications';

export function NotificationIncentiveNotice({incentive}:{incentive?:NotificationIncentive}){
 return <div className="connection-note"><strong>通知积分规则</strong><p>首次开启并验证成功，双打赛季积分 +10，每个账号只领一次。领取后，关闭任意一台设备，或下次进入网站、从后台返回时检测到通知权限已关闭，双打赛季积分 −30；重新开启并验证成功，加 10 分，不退还扣掉的 30 分。同一次关闭不重复扣；重新开启后再次关闭会重新扣。不影响修为。</p><p className="hint">不开启不扣分。退出登录、网络故障、订阅失效不扣分；系统开关未反映为浏览器权限变化、无法确认原设备时，不据此扣分。{incentive?.status==='earned'?'你已领取 10 分奖励。':incentive?.status==='disabled'?'你有 30 分关闭扣分，重新开启并验证成功可加 10 分，不退还这 30 分。':''}</p></div>;
}
