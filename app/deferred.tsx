'use client';
import {Suspense,type ReactNode} from 'react';

export default function Deferred({children}:{children:ReactNode}){
 return <Suspense fallback={<p className="hint" role="status">正在加载…</p>}>{children}</Suspense>;
}
