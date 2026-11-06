import type {ClubData} from '../lib/contracts/club';
import {auditActorName} from '../lib/client/audit-actor';
import {fmt} from './form-fields';

type AuditView=ClubData['audits'][number];

/** The latest 50 audited actions, newest first; each line says when, who, what and why. */
export default function AuditLog({data,labels}:{data:Pick<ClubData,'audits'|'accounts'|'players'>;labels:Record<string,string>}){
 return <section className="card"><h3>操作日志</h3>{data.audits.slice().reverse().slice(0,50).map((a:AuditView)=><details className="audit" key={a.id}>
  <summary>{fmt(a.at)} · <strong className="audit-actor">{auditActorName(a.actor,data)}</strong> · {labels[a.action]??'其他操作'} · {a.reason}</summary>
  <pre>{JSON.stringify(a.changes??{},null,2)}</pre>
 </details>)}</section>;
}
