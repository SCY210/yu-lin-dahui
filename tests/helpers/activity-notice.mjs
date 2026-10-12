import {readFileSync} from 'node:fs';

// Old signup suites intentionally accept the current notice; enforcement and
// omitted/false/stale values are exercised separately by activity-notice-api.
const source=readFileSync(new URL('../../lib/activity-notice.ts',import.meta.url),'utf8');
const version=source.match(/activityNoticeVersion\s*=\s*['"]([^'"]+)['"]/)?.[1];
if(!version)throw new Error('Cannot read canonical activity notice version');
export const acceptedActivityNotice={noticeAccepted:true,noticeVersion:version};
