import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,openSync,closeSync,readFileSync,readdirSync,unlinkSync,writeFileSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {localTestConfiguration,localTestOrigin,readLocalTestBranch} from './local-test-config.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const json=file=>JSON.parse(readFileSync(file,'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');

export function dependenciesMatch(lock,installed) {
  if(lock.lockfileVersion!==3||installed?.lockfileVersion!==3)return false;
  return Object.entries(lock.packages).filter(([name,value])=>name&&!value.optional).every(([name,value])=>{
    const actual=installed.packages?.[name];
    return actual?.version===value.version&&actual?.integrity===value.integrity;
  });
}

/** Copy only journaled migrations; preserve their original filenames and order. */
export function prepareMigrations(projectRoot,configuration) {
  const journal=json(path.join(projectRoot,'drizzle','meta','_journal.json'));
  const folder=path.join(configuration.runtime,'migrations');
  mkdirSync(folder,{recursive:true});
  const hashFile=path.join(configuration.runtime,'migration-hashes.json');
  const previous=existsSync(hashFile)?json(hashFile):{};
  /** @type {Record<string,string>} */
  const next={};
  const ordered=[...journal.entries].sort((a,b)=>a.idx-b.idx);
  for(const {tag} of ordered){
    if(!/^\d{4}_[a-zA-Z0-9_]+$/.test(tag))throw new Error('Invalid migration name in the journal.');
    const name=tag+'.sql',source=path.join(projectRoot,'drizzle',name);
    next[name]=hash(readFileSync(source));
    if(previous[name]&&previous[name]!==next[name])throw new Error(`Migration ${name} has changed. Add a new migration instead; existing local data has been preserved.`);
  }
  for(const name of readdirSync(folder)){
    if(name.endsWith('.sql')&&!next[name])throw new Error(`Local migration ${name} is not in the journal. Restore the migration history; existing data has been preserved.`);
  }
  for(const {tag} of ordered)copyFileSync(path.join(projectRoot,'drizzle',tag+'.sql'),path.join(folder,tag+'.sql'));
  return {hashFile,hashes:next};
}

function run(args,options={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{cwd:root,env:options.env??process.env,stdio:options.capture?['ignore','pipe','pipe']:['ignore','inherit','inherit'],windowsHide:true});
    let output='';
    if(options.capture){child.stdout.on('data',value=>output+=value);child.stderr.on('data',value=>output+=value)}
    child.once('error',reject);
    child.once('close',code=>code===0?resolve(output):reject(new Error(`Process exited with code ${code}.${output?'\n'+output:''}`)));
  });
}

function browser(url){
  if(process.platform!=='win32')return;
  const child=spawn('powershell.exe',['-NoProfile','-Command',`Start-Process '${url.replaceAll("'","''")}'`],{stdio:'ignore',windowsHide:true});
  child.on('error',()=>console.log('Open this address in your browser: '+url));
}
const live=pid=>{try{process.kill(pid,0);return true}catch{return false}};
function acquireLock(file,branch){
  for(let attempt=0;attempt<2;attempt++){
    try{
      const fd=openSync(file,'wx');
      writeFileSync(fd,JSON.stringify({pid:process.pid,root,origin:localTestOrigin,branch}));closeSync(fd);
      return true;
    }catch(error){
      if(error.code!=='EEXIST')throw error;
      let previous;try{previous=json(file)}catch{throw new Error('The launcher is already starting. Wait a few seconds and open it again.')}
      if(previous.root!==root||previous.origin!==localTestOrigin||!Number.isInteger(previous.pid))throw new Error('Invalid local process-control file. Existing data will not be changed.');
      if(live(previous.pid)){
        if(previous.branch!==branch)throw new Error('Another branch is running in this checkout. Stop its local test window and open start-local-test.cmd again.');
        return false;
      }
      unlinkSync(file);
    }
  }
  throw new Error('Could not reserve the local test environment.');
}

async function ensureFreePort(){
  const port=Number(new URL(localTestOrigin).port);
  await new Promise((resolve,reject)=>{
    const probe=net.createServer();probe.once('error',()=>reject(new Error(`Port ${port} is busy. Stop the other server before opening start-local-test.cmd.`)));
    probe.listen(port,'127.0.0.1',()=>probe.close(resolve));
  });
}

export async function bootstrapClub(origin,fetcher=fetch) {
  if(origin!==localTestOrigin)throw new Error('Initialization is restricted to the local test environment.');
  const signin=await fetcher(origin+'/signin-with-chatgpt',{redirect:'manual'});
  const cookie=signin.headers.getSetCookie().find(value=>value.startsWith('__sites_local_auth='))?.split(';')[0];
  if(signin.status!==302||cookie!=='__sites_local_auth=1')throw new Error('Could not activate the fictional local identity.');
  const read=async()=>{
    const response=await fetcher(origin+'/api/club',{headers:{Cookie:cookie}});
    if(!response.ok)throw new Error(`Could not read the local test database (${response.status}).`);
    return response.json();
  };
  let data=await read();
  const post=async(action,payload)=>{
    const response=await fetcher(origin+'/api/club',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({action,payload,requestId:randomUUID(),revision:data.revision})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||`Could not initialize ${action}.`);
    data=await read();
  };
  // Prepare only the owner account. Business records belong to the tester;
  // the launcher must not seed a particular feature or rewrite existing data.
  if(data.setup){
    await post('initialize',{name:'Local test administrator',invite:randomUUID()});
  }
  return {revision:data.revision,events:data.events?.length??0};
}

export async function launch({noBrowser=false,smokeTest=false}={}) {
  process.chdir(root);
  const configuration=localTestConfiguration(root);
  mkdirSync(configuration.runtime,{recursive:true});
  const lockFile=path.join(configuration.cacheRoot,'launcher.lock');
  if(!acquireLock(lockFile,configuration.branch)){
    console.log('Local test environment already running: '+localTestOrigin+'\nBranch: '+configuration.branch);
    if(!noBrowser&&!smokeTest)browser(localTestOrigin+'/__local-test/login');
    return;
  }
  let server,stopping=false,branchMonitor;
  const stop=()=>{
    if(stopping)return;stopping=true;
    if(server?.pid){
      if(process.platform==='win32'){
        const killed=spawnSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
        if(killed.status!==0)server.kill('SIGTERM');
      }else server.kill('SIGTERM');
    }
  };
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try{
    console.log('Testing the current checkout. Branch: '+configuration.branch);
    await ensureFreePort();
    const lock=json(path.join(root,'package-lock.json'));
    let installed;try{installed=json(path.join(root,'node_modules','.package-lock.json'))}catch{}
    const required=Object.entries(lock.packages).filter(([name,value])=>name&&!value.optional);
    const complete=required.every(([name])=>existsSync(path.join(root,name,'package.json')));
    const essential=['vinext/dist/cli.js','wrangler/bin/wrangler.js','@cloudflare/vite-plugin/package.json'];
    if(!dependenciesMatch(lock,installed)||!complete||!essential.every(file=>existsSync(path.join(root,'node_modules',file)))){
      const npm=process.env.YULIN_LOCAL_NPM;
      if(!npm||!existsSync(npm))throw new Error('npm was not found. Open start-local-test.cmd to prepare Node and npm.');
      console.log('[1/4] Installing this branch\'s locked dependencies...');
      await run([npm,'ci','--no-audit','--no-fund','--cache',path.join(configuration.cacheRoot,'npm-cache')]);
    }else console.log('[1/4] Dependencies ready.');
    const migrations=prepareMigrations(root,configuration);
    writeFileSync(configuration.configFile,JSON.stringify({name:'yu-lin-dahui-local-test',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],...configuration.bindings,d1_databases:configuration.bindings.d1_databases.map(binding=>({...binding,migrations_dir:'./migrations'}))},null,2));
    const env={...process.env,YULIN_LOCAL_TEST:'1',YULIN_LOCAL_TEST_BRANCH:configuration.branch,CLOUDFLARE_CF_FETCH_ENABLED:'false',WRANGLER_SEND_METRICS:'false',WRANGLER_WRITE_LOGS:'false',WRANGLER_LOG_PATH:path.join(configuration.runtime,'logs'),WRANGLER_REGISTRY_PATH:path.join(configuration.runtime,'registry'),MINIFLARE_REGISTRY_PATH:path.join(configuration.runtime,'miniflare-registry')};
    console.log('[2/4] Applying this branch\'s pending local migrations...');
    await run(['--import',pathToFileURL(path.join(root,'scripts','sites-env.mjs')).href,path.join(root,'node_modules','wrangler','bin','wrangler.js'),'d1','migrations','apply','DB','--local','--config',configuration.configFile,'--persist-to',configuration.state],{env:{...env,CI:'true'},capture:true});
    writeFileSync(migrations.hashFile,JSON.stringify(migrations.hashes,null,2));
    console.log('[3/4] Starting the current checkout...');
    server=spawn(process.execPath,[path.join(root,'node_modules','vinext','dist','cli.js'),'dev','--hostname','127.0.0.1','--port','5190'],{cwd:root,env,stdio:['ignore','inherit','inherit'],windowsHide:true});
    let exited=false,serverError=null;
    const completion=new Promise(resolve=>{server.once('exit',code=>{exited=true;resolve(code)});server.once('error',error=>{serverError=error;exited=true;resolve(1)})});
    let ready=false;
    for(let attempt=0;attempt<120&&!exited&&!stopping;attempt++){
      try{const response=await fetch(localTestOrigin+'/signin-with-chatgpt',{redirect:'manual',signal:AbortSignal.timeout(2000)});if(response.status===302){ready=true;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(stopping)return;
    if(!ready)throw new Error(serverError?.message||'The app did not start. Check the messages above.');
    console.log('[4/4] Preparing the local administrator...');
    const summary={...await bootstrapClub(localTestOrigin),branch:configuration.branch};
    console.log('\nREADY: '+localTestOrigin+'\nBranch: '+configuration.branch+'\nSaved data: '+configuration.state+'\nKeep this window open. Press Ctrl+C to stop the server.\n');
    if(smokeTest){
      writeFileSync(path.join(configuration.runtime,'smoke-result.json'),JSON.stringify(summary,null,2));
      stop();await completion;return summary;
    }
    // Switching source branches while Vite is running must not mix their data.
    branchMonitor=setInterval(()=>{
      try{if(readLocalTestBranch(root)!==configuration.branch){console.log('Branch changed. Stopping this server; open start-local-test.cmd to test the new branch.');stop()}}catch{}
    },1000);
    if(!noBrowser)browser(localTestOrigin+'/__local-test/login');
    const code=await completion;
    if(!stopping&&code!==0)throw new Error('The local server stopped with an error.');
    return summary;
  }finally{
    clearInterval(branchMonitor);stop();process.off('SIGINT',stop);process.off('SIGTERM',stop);
    try{if(json(lockFile).pid===process.pid)unlinkSync(lockFile)}catch{}
  }
}

if(process.argv[1]&&path.basename(process.argv[1])==='local-test.mjs'&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  launch({noBrowser:process.argv.includes('--no-browser'),smokeTest:process.argv.includes('--smoke-test')}).catch(error=>{console.error('\nERROR: '+error.message);process.exitCode=1});
}
