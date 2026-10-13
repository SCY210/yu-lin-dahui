import LegalLayout from '../legal-layout';
import {legalConfig} from '../../config/legal';
import {legalNoticeState} from '../../lib/legal-notice';

export const metadata={title:'Privacy notice | Yu Lin Da Hui'};
const pending='To be specified by the club operator before deployment.';

export default function PrivacyPage(){
 const state=legalNoticeState(legalConfig);
 return <LegalLayout title="Privacy notice">
  <h2>Who is responsible</h2>
  <p>Operator: {legalConfig.operatorName||pending}</p>
  <p>Contact address: {legalConfig.operatorAddress||pending}</p>
  <p>Jurisdiction: {legalConfig.jurisdiction||pending}</p>
  <p>Privacy contact: {state.contactEmail?<a href={'mailto:'+state.contactEmail}>{state.contactEmail}</a>:pending}</p>
  <h2>Data and purposes</h2>
  <p>The club processes display names, usernames, password hashes and session records; player profiles and optional equipment descriptions; event registrations and participation times; match results and derived rankings; shared cost allocations; photographs and their associations; and administrator audit records. Legacy platform accounts can retain their email for identity compatibility.</p>
  <p>These records support club access, organizing badminton, matching players, calculating results and shared costs, and securing the service. Do not put health information, identification documents, private contact details, or other unnecessary sensitive data in profiles or notes.</p>
  <p>Profiles can also be supplied by an administrator or another member registering a friend. The operator must inform those people and verify the applicable basis before creating their records.</p>
  <h2>Legal bases</h2><p>{legalConfig.legalBases||pending}</p>
  <p>Optional images require the uploader to confirm rights and permission to share identifiable people within the club. That statement does not itself collect consent from each person or establish the legal basis for all other processing.</p>
  <h2>Who can see records</h2>
  <p>Authenticated club members can see shared profiles, events, results, photos and participant cost shares. Administrators can manage accounts and export business records. Private drafts have narrower permissions. Club membership does not authorize publishing others’ records on social media.</p>
  <p>The application uses Sites hosting with Cloudflare D1 and R2. A legacy sign-in flow uses the hosting identity layer. Infrastructure can process network addresses and service logs. Following a Google Maps link sends the venue search to Google.</p>
  <p>Operator-approved processors, locations and transfer safeguards: {legalConfig.processorsAndTransfers||pending}</p>
  <h2>Retention and deletion</h2><p>{legalConfig.retention||pending}</p>
  <p>In My → Account and password, members can request deletion of their own account. Submitting the request signs out all password sessions and blocks account access. A successful sign-in with the same account before 30 days have elapsed cancels the request. Failed login attempts, background requests and existing sessions do not cancel it. At or after the deadline, recovery is unavailable. Expired requests are processed automatically by the hourly server cleanup and retried on API traffic.</p>
  <p>Cleanup removes the login account, password credentials, sessions, notification records, personal profile fields, related audit snapshots and site photos uploaded by or associated with the member. Future registrations are removed. Historical match results and cost allocations remain under a new, unowned “deleted member” identifier and label so other participants’ records remain usable. Friend profiles created by the member remain but are detached from the deleted account. A hash of the former platform identity is retained to prevent an old platform session from reactivating the deleted account. Image file deletion is retried if storage is temporarily unavailable.</p>
  <p>This does not erase other members’ free-text mentions, downloaded copies, operator backups or hosting logs. Contact the operator for those records and any other privacy request. Event deletion can be reversible and is not personal-data erasure. The protected principal administrator must arrange ownership handover before account deletion. Other administrators can voluntarily relinquish their own administrator role without principal-administrator approval.</p>
  <p>注销规则：提交后退出全部设备；30天内使用同一账号成功重新登录会取消注销。期限届满后不能恢复，系统按小时自动清理，失败后重试。登录账号、密码、个人档案、关联操作快照及站内关联照片会被清理，未来报名会取消。历史比赛和费用以“已注销球友”保留。朋友档案保留但与账号解绑。平台身份哈希保留以阻止旧会话恢复已注销账号。其他成员的文字、导出副本、运营者备份及托管日志需联系运营者处理。群主须先安排所有权交接；其他管理员可自行放弃管理员权限。</p>
  <h2>Your choices and requests</h2>
  <p>You can edit supported profile fields and ask the operator for access, correction, erasure, restriction, objection, or portability where applicable. You can ask to withdraw consent when that is the processing basis, without affecting prior lawful processing. Contact the operator above; if contact details are still missing, contact the administrator through the channel that invited you.</p>
  <p>Complaint authority: {legalConfig.complaintAuthority||pending}</p>
  <h2>Cookies and installed-app storage</h2>
  <p>The application’s yulin_session cookie manages login and lasts up to fourteen days. The yulin_signed_out cookie suppresses legacy auto-login for fourteen days after logout, or thirty days after a deletion request. A local session-storage notice shows the requested deletion deadline on the same browser tab. HTTPS cookies use Secure, HttpOnly and SameSite=Lax. The service worker caches only the public offline page; it does not cache private club data or queue offline writes.</p>
  <p>This source does not add advertising or analytics cookies. The operator must separately review cookies or tracking introduced by hosting, identity providers or future integrations. A required login cookie does not justify unrelated tracking.</p>
  <h2>Children and image metadata</h2>
  <p>Minors policy: {legalConfig.minorsPolicy||pending}</p>
  <p>The application does not verify age or guardian authorization. Until the operator has established an appropriate process, do not upload photographs of minors. Uploaded files may retain EXIF/location and other metadata; remove unnecessary metadata before sharing.</p>
 </LegalLayout>;
}
