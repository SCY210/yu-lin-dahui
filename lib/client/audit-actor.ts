/** Who did an audited action, as the 宗门事务 log shows it. Audits store the acting account id, or `system:*` for
 * changes the club made by itself (clock-driven starts, maintenance migrations). Accounts and players come from the
 * projected data the club owner and administrators already receive. */
type ActorAccount={id:string;playerId:string;email?:string};
type ActorPlayer={id:string;name:string};

export function auditActorName(actor:string,data:{accounts:ActorAccount[];players:ActorPlayer[]}){
 if(actor==='system'||actor.startsWith('system:'))return '系统自动';
 const account=data.accounts.find(a=>a.id===actor);
 if(!account)return '已删除的账号';
 return data.players.find(p=>p.id===account.playerId)?.name||account.email||'未命名账号';
}
