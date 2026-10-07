import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const localTestOrigin = 'http://127.0.0.1:5190';
export const localTestEnabled = (command, flag) => command === 'serve' && flag === '1';
export function readLocalTestBranch(root) {
  const options = {cwd:root,encoding:'utf8',windowsHide:true};
  const branch = spawnSync('git',['symbolic-ref','--quiet','--short','HEAD'],options);
  if(branch.status===0&&branch.stdout.trim())return branch.stdout.trim();
  const head = spawnSync('git',['rev-parse','--verify','HEAD'],options);
  if(head.status===0&&/^[a-f0-9]{40,64}$/.test(head.stdout.trim()))return 'detached:'+head.stdout.trim();
  throw new Error('Git could not identify this checkout. Install Git and run the launcher inside a repository.');
}

export function localTestConfiguration(root,branch=readLocalTestBranch(root)) {
  if(typeof branch!=='string'||!branch||branch.length>1024||/[\x00-\x1f]/.test(branch))throw new Error('Invalid local test branch.');
  const cacheRoot = path.join(root, '.sites-runtime', 'local-test');
  const branchKey = createHash('sha256').update(branch).digest('hex').slice(0,24);
  const runtime = path.join(cacheRoot, 'branches', branchKey);
  return {
    branch,
    branchKey,
    cacheRoot,
    runtime,
    state: path.join(runtime, 'state'),
    configFile: path.join(runtime, 'wrangler.json'),
    bindings: {
      d1_databases: [{binding:'DB',database_name:'yu-lin-dahui-local-test',database_id:'00000000-0000-4000-8000-000000000042'}],
      r2_buckets: [{binding:'BUCKET',bucket_name:'yu-lin-dahui-local-test-photos'}],
    },
  };
}
