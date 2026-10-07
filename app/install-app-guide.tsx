'use client';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';

export default function InstallAppGuide({open,onOpenChange,ready,busy,error,install}:{open:boolean;onOpenChange:(open:boolean)=>void;ready:boolean;busy:boolean;error:string;install:()=>Promise<void>}){
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="app-dialog install-app-guide">
  <DialogHeader><DialogTitle>把羽林大会安装到手机</DialogTitle><DialogDescription>添加桌面图标，用独立窗口打开；继续使用现有账号。</DialogDescription></DialogHeader>
  {ready&&<button type="button" className="primary full" disabled={busy} onClick={()=>void install()}>{busy?'正在打开安装提示…':'安装羽林大会'}</button>}
  {error&&<p className="error" role="alert">{error}</p>}
  <p className="hint">先在页面右上角选择喜欢的主题，再安装；桌面图标会使用该主题的羽毛球标识。</p>
  <section><h3>安卓手机</h3><ol><li>用 Chrome 打开羽林大会网址。</li><li>打开右上角菜单，选择“安装应用”或“添加到主屏幕”。</li><li>确认安装，再从桌面图标打开。</li></ol></section>
  <section><h3>iPhone</h3><ol><li>用 Safari 打开羽林大会网址。</li><li>打开分享菜单，选择“添加到主屏幕”。</li><li>如果显示“作为网页 App 打开”，将它开启，再点“添加”。</li></ol></section>
  <p className="hint">微信等内置浏览器中，请先选择“在浏览器中打开”。首次从桌面打开可能需要重新登录。报名、投票和保存比赛结果需要网络。</p>
  <p className="hint">网页 Logo 会随主题立即切换。桌面图标由手机系统更新，可能仍显示旧版本；若未更新，请移除旧的桌面应用，再用浏览器选择主题并重新添加。账号和球局记录保存在群组里，不会因此删除。</p>
 </DialogContent></Dialog>;
}
