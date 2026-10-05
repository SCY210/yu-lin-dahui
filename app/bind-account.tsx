'use client';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import AuthPanel from './auth-panel';
export default function BindAccount({onOpenChange,onBound}:{onOpenChange:(open:boolean)=>void;onBound:()=>void}){
 return <Dialog open onOpenChange={onOpenChange}><DialogContent className="app-dialog"><DialogHeader><DialogTitle>开通账号登录</DialogTitle><DialogDescription>设置自己的账号和密码，保留当前权限与全部记录。</DialogDescription></DialogHeader><AuthPanel binding onBound={onBound}/></DialogContent></Dialog>;
}
