import {execFileSync} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {localReportPaths} from './preserve-local-reports.mjs';

const tracked=execFileSync('git',['ls-files','--cached','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const shared=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const prohibited=/(?:^|\/)(?:\.codex|\.agents|\.wrangler|\.sites-runtime|\.vscode|\.idea|\.cursor|\.claude|\.cache|\.local|\.test-output|preview-captures|node_modules|dist|outputs|work|coverage|\.next|\.vinext)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:AGENTS|CLAUDE)\.local\.md$|\.(?:sqlite3?|db|log|tsbuildinfo)$/;
const errors=[];let count=0;
for(const path of tracked){
 if(prohibited.test(path)||localReportPaths.includes(path))errors.push('Local/generated file is tracked: '+path);
}
for(const path of new Set(shared.filter(path=>path.endsWith('.md')))){
 const content=await readFile(path,'utf8');count++;
 if(/\p{Script=Han}/u.test(content))errors.push('Shared Markdown must be in English: '+path);
 for(const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const target=match[1].split(/[?#]/)[0];
  if(!target||/^[a-z][a-z\d+.-]*:/i.test(target)||target.startsWith('/'))continue;
  try{await access(resolve(dirname(path),decodeURIComponent(target)))}catch{errors.push('Broken documentation link: '+path+' -> '+target)}
 }
}
if(errors.length){for(const error of errors)console.error(error);process.exitCode=1}
else console.log('Repository checks passed: '+count+' English Markdown files, relative links and tracked-state policy.');
