import {execFileSync} from 'node:child_process';
import {readFile,access} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {localReportPaths} from './preserve-local-reports.mjs';

const tracked=execFileSync('git',['ls-files','--cached','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const shared=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const prohibited=/(?:^|\/)(?:\.codex|\.agents|\.wrangler|\.sites-runtime|\.vscode|\.idea|\.cursor|\.claude|\.cache|\.local|\.test-output|preview-captures|node_modules|dist|outputs|work|coverage|\.next|\.vinext)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:AGENTS|CLAUDE)\.local\.md$|\.(?:sqlite3?|db|log|tsbuildinfo)$/;
const errors=[];let count=0;
// 共享文档一律用中文写。名单是尚未翻译完的英文旧文档清单：只减不增，改到哪篇就整篇译成中文并移出名单。
const english=new Set(JSON.parse(await readFile(new URL('./english-markdown.json',import.meta.url),'utf8')));
// 和 main 上的名单比较：新增的条目不允许。取不到 main（例如浅克隆）时跳过这一项。
let mainList=null;
for(const ref of ['origin/main','main'])if(!mainList)try{mainList=new Set(JSON.parse(execFileSync('git',['show',ref+':scripts/english-markdown.json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']})))}catch{}
if(mainList)for(const path of english)if(!mainList.has(path))errors.push('英文旧文档名单只能减少，不能新增：'+path);

for(const path of tracked){
 if(prohibited.test(path)||localReportPaths.includes(path))errors.push('Local/generated file is tracked: '+path);
}
for(const path of new Set(shared.filter(path=>path.endsWith('.md')))){
 const content=await readFile(path,'utf8');count++;
 const chinese=/\p{Script=Han}/u.test(content);
 if(!english.has(path)&&!chinese)errors.push('共享 Markdown 必须用中文：'+path);
 if(english.has(path)&&chinese)errors.push('英文旧文档出现了中文，请整篇译成中文并从 scripts/english-markdown.json 移出：'+path);
 for(const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  const target=match[1].split(/[?#]/)[0];
  if(!target||/^[a-z][a-z\d+.-]*:/i.test(target)||target.startsWith('/'))continue;
  try{await access(resolve(dirname(path),decodeURIComponent(target)))}catch{errors.push('Broken documentation link: '+path+' -> '+target)}
 }
}
if(errors.length){for(const error of errors)console.error(error);process.exitCode=1}
else console.log('仓库检查通过：'+count+' 篇 Markdown，文档中文规定、相对链接和跟踪文件规定均符合。');
