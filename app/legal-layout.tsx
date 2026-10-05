import type {ReactNode} from 'react';
import Link from 'next/link';
import {legalConfig} from '../config/legal';
import {legalNoticeState,legalNoticeVersion} from '../lib/legal-notice';

export default function LegalLayout({title,children}:{title:string;children:ReactNode}){
 const state=legalNoticeState(legalConfig);
 return <main className="legal-page" lang="en">
  <Link href="/" prefetch={false}>Back to the club</Link><h1>{title}</h1><p>Notice version: {legalNoticeVersion}</p>
  {!state.configured&&<aside className="legal-draft" role="status"><strong>Draft notice: operator information is incomplete.</strong><p>The operator must complete and review this notice before deployment. Missing information must not be interpreted as a compliance guarantee.</p></aside>}
  {children}
 </main>;
}
