import {Share,SquarePlus,Smartphone,BellRing,Settings} from 'lucide-react';
import './ios-push-steps.css';

/** Step-by-step iPhone instructions: web push only works from a home-screen app on iOS 16.4 or later. */
export function IosInstallSteps(){
 return <ol className="ios-push-steps">
  <li><Smartphone size={16} aria-hidden="true"/><span>确认系统是 <b>iOS 16.4 或更高</b>：设置 → 通用 → 关于本机 → iOS 版本。</span></li>
  <li><Share size={16} aria-hidden="true"/><span>用 <b>Safari</b> 打开羽林大会（在微信里请先点右上角 ··· 选“在 Safari 中打开”），点<b>分享按钮</b>（方框加向上箭头）；如果没看到，先点地址栏旁的<b>更多／页面菜单</b>，再选<b>“分享”</b>。</span></li>
  <li><SquarePlus size={16} aria-hidden="true"/><span>在分享菜单中向下滑，点<b>“添加到主屏幕”</b>；找不到时，滑到底部点<b>“编辑操作”</b>把它加入。若有“作为网页 App 打开”，保持开启，再点<b>“添加”</b>。</span></li>
  <li><BellRing size={16} aria-hidden="true"/><span>回到桌面，点<b>羽林大会图标</b>打开（不要再从 Safari 打开）。这个提示会再次出现，点“开启通知”，系统询问时选<b>“允许”</b>。</span></li>
 </ol>;
}

export function IosDeniedSteps(){
 return <ol className="ios-push-steps">
  <li><Settings size={16} aria-hidden="true"/><span>打开 iPhone 的<b>设置 → 通知</b>，在列表中找到<b>“羽林大会”</b>。</span></li>
  <li><BellRing size={16} aria-hidden="true"/><span>打开<b>“允许通知”</b>，建议同时勾选锁定屏幕、通知中心、横幅，并打开声音。</span></li>
  <li><Smartphone size={16} aria-hidden="true"/><span>回到羽林大会，点下方“已允许，重新检测并开启”。列表里没有羽林大会时，请先从桌面图标打开一次再找。</span></li>
 </ol>;
}

export const isIphone=()=>typeof navigator!=='undefined'&&(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
