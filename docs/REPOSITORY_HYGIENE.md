# 共享源码与个人检出状态

仓库共享应用源码、可复用的构建和运行辅助工具、可复现的测试、数据库迁移、必需的部署元数据和第三方声明。不共享凭据、本地数据库、编辑器或助手配置、生成的截图、日志，也不共享某个人的历史测试运行记录。

AGENTS.md 是共享的协作规定，纳入版本跟踪，用中文写。.openai/hosting.json 指明现有的部署和绑定；它不是个人指令文件，构建和部署本应用都需要它。不要忽略所有隐藏目录，也不要忽略所有 Markdown 或 JSON 文件。

## 已停止跟踪的报告

下面这些报告记录的是某个检出目录里的历史运行：

- docs/MANAGED_ACCOUNTS_RESULTS.md
- docs/MANAGED_ACCOUNTS_RACE_RESULTS.md
- docs/PLAYER_PROFILE_API_RESULTS.md
- docs/TEST_RESULTS.md

它们已加入忽略，并用 git rm --cached 从 Git 索引中移除。工作目录里的原文件仍然保留；可复现的测试留在 tests/。如果你需要把这些报告作为个人证据，请自行保存。历史报告仍在 Git 历史里；这次改动不是清除机密，也没有改写历史。

## 拉取前先备份另一个检出目录

另一个检出目录拉取或切换分支时，被跟踪文件的删除可能会删掉一个没有改动的文件。在本检出目录里加 .gitignore 或使用 --cached 都无法阻止这一点。请在应用清理提交**之前**先备份。

如果旧分支上还没有备份脚本，先获取 PR 分支，只取出这个脚本：

```powershell
git fetch origin feature/request-body-security
$backupScript = Join-Path ([System.IO.Path]::GetTempPath()) ('yu-lin-preserve-' + [guid]::NewGuid().ToString() + '.mjs')
git show origin/feature/request-body-security:scripts/preserve-local-reports.mjs | Set-Content -LiteralPath $backupScript -Encoding utf8
node $backupScript
Remove-Item -LiteralPath $backupScript
```

临时取出的脚本不是原始报告。先审阅脚本，再从仓库根目录运行，确认输出成功后，才拉取、合并或切换分支。也可以手动把这四个文件复制到被跟踪路径以外的安全位置。

脚本把现有报告复制到唯一的 .local/reports/<时间戳-uuid>/docs/ 目录，并按源文件字节校验 SHA-256。它从不删除或覆盖原文件；每次运行都使用不同的归档目录。manifest.json 记录校验过的哈希。.local 已被忽略。

更新之后，归档里的报告不受被跟踪文件删除的影响，仍然可用。需要的话，可以把它们复制回现在已被忽略的 docs 路径。不要使用 git clean -xfd 或任何会删除被忽略备份的清理命令。

这次改动没有任何操作直接访问或删除其他所有者的本地文件系统。如果所有者更新前没有备份，仓库无法保证之后的 Git 检出会做什么。

## 忽略规则

.gitignore 涵盖依赖和构建输出；.wrangler、.sites-runtime；.agents、.codex 和个人编辑器状态；截图、outputs、work、.test-output；.local 备份；数据库、日志、环境变量文件和个人指令覆盖文件。

它不会隐藏正常的源码、迁移、共享指令、许可证或托管配置。凭据和生产导出绝不能进入 Git。如果以前提交过真实的机密，只忽略或删除当前文件是不够的：要更换这个机密，并在所有者授权后另外处理历史。

运行 npm run check:repo 可以检查：被禁止跟踪的路径、不含中文的共享 Markdown、名单上的英文旧文档出现中文、名单只减不增，以及失效的相对文档链接。这个检查只是粗略判断，不保证翻译质量；审查者仍要核对意思。被忽略的个人报告可以保留原来的语言。

## 文档语言

仓库里的共享文档一律用中文写。代码标识符、命令、路径、文件名和引用的英文原文保持原样。

2026 年 11 月之前文档用英文写，那时已有的英文文档列在 scripts/english-markdown.json 里，是尚未完成的翻译清单，不是可以长期保留英文的豁免。名单只能减少，不能增加；改动名单上的文档时，要把整篇译成中文并从名单中移出。名单上的文档如果出现中文、名单比 main 上的多，检查都会失败。被跟踪状态的限制和相对链接检查适用于所有共享文档。
