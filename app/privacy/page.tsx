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
  <p>There is no automatic account-erasure or retention scheduler. Removing a photo uses authorized controls; historical event deletion can be reversible and is not personal-data erasure. The operator must handle requests across profiles, photographs, credentials, audit records, exports and backups, while respecting other participants’ rights and applicable retention duties.</p>
  <h2>Your choices and requests</h2>
  <p>You can edit supported profile fields and ask the operator for access, correction, erasure, restriction, objection, or portability where applicable. You can ask to withdraw consent when that is the processing basis, without affecting prior lawful processing. Contact the operator above; if contact details are still missing, contact the administrator through the channel that invited you.</p>
  <p>Complaint authority: {legalConfig.complaintAuthority||pending}</p>
  <h2>Cookies and installed-app storage</h2>
  <p>The application’s yulin_session and yulin_signed_out cookies manage login/logout and last up to fourteen days. HTTPS cookies use Secure, HttpOnly and SameSite=Lax. The service worker caches only the public offline page; it does not cache private club data or queue offline writes.</p>
  <p>This source does not add advertising or analytics cookies. The operator must separately review cookies or tracking introduced by hosting, identity providers or future integrations. A required login cookie does not justify unrelated tracking.</p>
  <h2>Children and image metadata</h2>
  <p>Minors policy: {legalConfig.minorsPolicy||pending}</p>
  <p>The application does not verify age or guardian authorization. Until the operator has established an appropriate process, do not upload photographs of minors. Uploaded files may retain EXIF/location and other metadata; remove unnecessary metadata before sharing.</p>
 </LegalLayout>;
}
