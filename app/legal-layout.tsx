import type {ReactNode} from 'react';
import Link from 'next/link';
import {legalConfig} from '../config/legal';
import {legalNoticeState,legalNoticeVersion} from '../lib/legal-notice';

export default function LegalLayout({title,children}:{title:string;children:ReactNode}){
 const state=legalNoticeState(legalConfig);
 return <main className="legal-page" lang="zh-CN">
  <Link href="/" prefetch={false}>返回羽林大会</Link><h1>{title}</h1><p>说明更新日期：{legalNoticeVersion}</p>
  {!state.configured&&<aside className="legal-draft" role="status"><strong>运营及隐私信息仍有待补充。</strong><p>目前可通过群内现有联系渠道联系群主或管理员。球友共同维护的说明不能替代实际负责人的身份、处理依据、保留期限等具体信息，也不代表已完成全部合规要求。</p></aside>}
  {children}
 </main>;
}
