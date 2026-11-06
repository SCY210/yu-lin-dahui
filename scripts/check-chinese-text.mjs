// 仓库所有者要求：PR 标题、PR 描述和提交信息一律用中文，不用英文或其他语言。
// 代码、命令、路径、链接和标识符可以原样保留，所以检查前先把它们去掉。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const han = /\p{Script=Han}/u;
// 中文和拉丁字母以外的文字（日文假名、韩文、俄文、阿拉伯文、泰文、希腊文等）一律不行。
const otherScript = /(?![\p{Script=Han}\p{Script=Latin}])\p{L}/u;
// 连续四个及以上英文单词视为英文句子；"Workers Paid"这类专有名词不受影响。
const englishRun = /[A-Za-z][A-Za-z'’]*(?:[ \t,;:()-]+[A-Za-z][A-Za-z'’]*){3,}/;

/** @param {string | null | undefined} text */
export function stripAllowed(text) {
  return String(text ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, '] ')
    .replace(/(?:https?|ftp):\/\/\S+/g, ' ')
    .replace(/^[A-Za-z][A-Za-z-]*: .*$/gm, ' ') // Co-authored-by: 之类的提交尾注
    .replace(/[@#][\w./-]+/g, ' ')
    // 路径、文件名、标识符和命令参数：带 / . _ = 或数字，或驼峰写法的词。
    .replace(/[\w.\/=-]*[\/._=\d][\w.\/=-]*/g, ' ')
    .replace(/\w[\w-]*:[\w:-]+/g, ' ') // 带冒号的 npm 脚本名，例如 check:repo
    .replace(/\b[a-z]+[A-Z]\w*\b/g, ' ')
    .replace(/(^|\s)--?[\w-]+/g, ' ');
}

/** @param {string | null | undefined} text @returns {string[]} */
export function chineseProblems(text) {
  const rest = stripAllowed(text);
  if (!rest.trim()) return [];
  /** @type {string[]} */
  const problems = [];
  const other = rest.match(otherScript);
  if (other) problems.push(`含有中文以外的文字："${other[0]}"`);
  const run = rest.match(englishRun);
  if (run) problems.push(`像是英文句子："${run[0].trim().slice(0, 60)}"`);
  if (!han.test(rest)) problems.push('没有中文');
  return problems;
}

/** @param {{ label: string, text: string | null | undefined }[]} items @returns {string[]} */
export function checkTexts(items) {
  return items.flatMap(({ label, text }) => chineseProblems(text).map(problem => `${label}：${problem}`));
}

function commitItems(range) {
  const log = execFileSync('git', ['log', '--no-merges', '--format=%h%x00%B%x1e', range], { encoding: 'utf8' });
  return log.split('\x1e').map(entry => entry.trim()).filter(Boolean).map(entry => {
    const [hash, body = ''] = entry.split('\0');
    return { label: `提交 ${hash}`, text: body };
  });
}

function main(argv) {
  const items = [];
  if (argv.includes('--pr')) {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const pr = event.pull_request;
    items.push({ label: 'PR 标题', text: pr.title }, { label: 'PR 描述', text: pr.body ?? '' });
    items.push(...commitItems(`origin/${pr.base.ref}..${pr.head.sha}`));
  }
  const at = argv.indexOf('--commits');
  if (at >= 0) items.push(...commitItems(argv[at + 1] ?? 'origin/main..HEAD'));
  if (!argv.includes('--pr') && at < 0) throw new Error('用法：--pr（在 GitHub Actions 里）或 --commits origin/main..HEAD');
  const problems = checkTexts(items);
  if (problems.length) {
    console.error('PR 标题、PR 描述和提交信息必须用中文（见 AGENTS.md）：\n' + problems.map(p => '- ' + p).join('\n'));
    console.error('代码、命令、路径和标识符可以放在反引号里原样保留。改 PR 文字后检查会自动重跑；提交信息要用 git commit --amend 或 git rebase 改写。');
    process.exit(1);
  }
  console.log(`PASS 中文文字：检查了 ${items.length} 项。`);
}

// 测试会把本文件打包进别的文件，所以按命令行里的文件名判断是否直接运行。
if (process.argv[1] && basename(process.argv[1]) === 'check-chinese-text.mjs') main(process.argv.slice(2));
