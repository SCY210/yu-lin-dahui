'use client';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {schedulingLabels,type recommendedSchedulingMode} from '../lib/domain/scheduling';
/** Why the planned schedule is recommended and when live scheduling serves better, opened from the one-line
 * recommendation above the scheduling selector (docs/COMPACT_MOBILE_LAYOUT.md). Loaded only when opened. */
export default function SchedulingAdviceDialog({advice,onClose}:{advice:ReturnType<typeof recommendedSchedulingMode>;onClose:()=>void}){
 return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="app-dialog scheduling-advice-dialog"><DialogHeader className="text-left"><DialogTitle>预排还是实时排场</DialogTitle><DialogDescription>推荐{schedulingLabels[advice.mode]}：{advice.reason}</DialogDescription></DialogHeader>
  <p className="scheduling-advice-live">这些情况可改用实时排场（代价是双方强弱没那么接近）：</p><ul>{advice.live.map(text=><li key={text}>{text}</li>)}</ul></DialogContent></Dialog>;
}
