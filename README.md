社群扩展使用说明： [SOCIAL_FEATURES.md](docs/SOCIAL_FEATURES.md)。
# 当前费用范围
根据最新要求，费用仅计算并展示每个人付多少，已移除待付/已付状态、付款确认与退款流程。历史数据库中的付款记录为兼容保留，新接口不再创建或展示；无需删除生产数据或执行迁移。

# 羽林大会

中文、移动端优先的私人羽毛球群 Web App。默认 EUR / Europe/Madrid。

源码仓库：[SCY210/yu-lin-dahui](https://github.com/SCY210/yu-lin-dahui)（私有）。网站继续通过 Sites 托管；GitHub 独立副本同步已验证的源码版本，数据库、上传照片、密码和本地运行状态保存在各自的数据服务中。

## 运行

需要 Node.js >=22.13。进入本目录后：

```powershell
npm ci --prefer-offline --no-audit --no-fund
node scripts/run-framework.mjs build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_handy_freak.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_absent_zuras.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_salty_leo.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0003_dazzling_vapor.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0004_club_brand.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_managed_accounts.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_username_change.sql
node scripts/run-framework.mjs dev
```

打开服务实际输出的地址（本机默认 http://127.0.0.1:5173/）。迁移按 `drizzle/meta/_journal.json` 的顺序逐个执行一次；已有数据库只追加尚未应用的迁移，不重复执行历史文件。
Windows 若 npm 包装脚本失效，本环境已验证的安装命令为：

```powershell
node 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' ci --prefer-offline --no-audit --no-fund
```

本地数据持久保存在 `.wrangler/state`，刷新或停止开发服务不会清空。线上使用 Sites 管理的 Cloudflare D1，与本地数据完全分离。所有成员和业务记录保存在服务器；未用浏览器存储保存业务数据。

## 登录与账号管理

账号与密码为登录入口，由管理员在后台创建球友账号；不需要邮箱，也不开放自行注册。原账号在“我的 → 设置账号和密码”迁移并保留原档案与权限。新账号为普通成员，管理员可为已有球友档案开通登录，或重置忘记的密码。新登录账号只使用2–32位英文字母或数字，旧格式账号保持兼容。成员可自主改一次账号；群主可不限次数改自己和其他人的账号、名字。详见 [ACCOUNT_LOGIN.md](docs/ACCOUNT_LOGIN.md)。

网站已按群主明确授权公开登录入口。朋友直接打开网址，用管理员创建的账号和密码登录，不需要 ChatGPT 账号。群内数据继续由服务器登录与成员权限保护，匿名访客不能读取活动、费用、照片或创建账号。忘记密码由群管理员重置。

开发模式的官方预览辅助器仅在回环地址模拟 `Seedy` 身份；线上构建不含该模拟登录。开发与内置测试服务都绑定127.0.0.1，不应暴露到公网。生产必须经 Sites 身份分发层，不要直接暴露信任身份头的 Worker。

管理员入口在“我的 → 群组管理”。可以修改群名、邀请码、赛季默认规则、初始 Rating、成员启用状态和账号权限。群主拥有固定最高权限并分配管理员角色，其他管理员不能修改群主账号。邀请码仅保存 SHA-256 摘要，没有管理员通用密码或测试后门。

## 完整人工验收路径

1. 所有者登录并初始化群组。创建活动，设置报名/取消截止、容量和首个场地预约；添加第二片场地或不连续的预约时段。
2. 管理员创建普通成员账号，成员登录并报名。每位朋友先建立独立档案，再单独报名。填满容量后确认候补；取消正式成员，观察首位有效候补递补。超过取消截止只提交申请，由管理员处理。
3. 正式报名默认参加，无需签到。修改接龙中的参加时间后，用该区间安排比赛并分摊费用；未发生的未来时间不计算为已参加时长。
4. 排场页生成本轮草稿。点选两名选手交换（可与轮休者交换），调整场地，锁定分组。重新生成保留锁定比赛。查看上场比例和连续等待轮次，然后确认发布。
5. 开始本轮前确定是否计入月积分及 Rating。开始比赛，录入例如21:15的合法终局比分。查看比赛、个人页、月榜；修正比分会重建月积分并重放后续 Rating。
6. 费用页输入本次耗球型号、每筒/每颗价格及实际消耗颗数。“1筒+4颗”以两个数量输入；可填耗球时间段。添加其他费用，分别选择场地/球费分摊模式。
7. 调整单项豁免及群补贴，检查逐时段明细、个人分摊明细与待分配费用。实际参加者签退后保存草稿或确认正式结算。无人可承担的费用须明确指定群补贴，否则正式结算被阻止。
8. 确认分摊结果后，所有已加入群组的成员都能查看每个人的金额、场地费和球费明细。修正费用后保存新分摊版本，旧结果可查看。复制接龙/分摊金额文本，由管理员手动发群。
9. “我的 → 群组管理”可导出全部 JSON，包括比赛事实来源、分摊版本、规则版本与操作日志。

空群组的“载入虚构验收活动”可创建明确标注的模拟活动，包含16正式+2候补、场地间断与混合耗球。它是管理员主动创建的测试数据，不在上线时自动执行。正式使用请从空生产数据库开始，不把模拟人员当作真实成员。

## 数据与算法

20张关系表分开保存账号、参赛者、活动、预约、报名、出勤、轮次、比赛、费用、结算、付款、赛季、Rating变化和日志；业务详细字段采用各记录的JSON载荷。外键及唯一索引保护报名、结算版本和写入修订号。

每次写入采用 D1 原子 batch，首先插入唯一修订号及幂等键，再只保存发生变化的记录。并发抢报失败的一方读取最新数据并重新计算，最多重试5次；管理员修改必须携带当前修订号，过期写入返回409。接口逐次验证身份、角色及参赛者所有权，并校验同源请求。成员可以查看群内活动的每人分摊结果；不跟踪付款、欠款或退款状态，未加入者不返回名单和活动，草稿活动及其子记录对普通成员不可见。

`lib/domain/` 中的独立模块：

- `commands.ts`：报名顺序、候补递补、权限、服务端输入校验与状态变更。
- `grouping.ts`：先按有效轮次上场欠额和等待选择人员，再进行600次确定种子的局部搜索；平衡实力、重复搭档与对手。锁定比赛优先保留。只安排能覆盖整场预计时长的有效预约；并非全局最优保证。
- `money.ts`：等额、时长比例、逐时段三种独立算法。BigInt有理数与最大余数法按稳定参赛者ID处理尾差。每项来源费用先确定到欧分，再分配；按小时费用/耗球总成本产生不到1欧分的部分按半向上确定项目总额。个人分摊明细+群补贴+待分配严格等于总额。无分时耗球数据时，按有实际参与者的预约场地分钟估算并标注；可逐记录输入精确耗球时段，或在界面调整为两段费用。
- `ranking.ts`：比赛是事实来源。Madrid自然月、实际开赛时间+稳定ID排序个人前12场计分，全部启用球友同榜，无最低场数门槛。并列依次看积分、胜率、场均净胜分。Elo按实际完成时间+ID重放，每场四人的变化之和为0，前10场暂定。

默认初始Rating1000，K32，胜3负0，21分/领先2分/30封顶；规则绑定月份，新月份在首次开赛时自动创建，不依赖定时任务。默认规则更新不改变已有月份；历史规则须先预览再确认，赛季版本递增并保留操作记录。

## 测试

```powershell
node node_modules/typescript/bin/tsc --noEmit
node scripts/test.mjs
node scripts/run-framework.mjs build
```

已运行：34项算法测试；初版14项真实本地API验收、新增社群10组真实API验收、服务停止再启动的持久化验证。另检查390px首页/接龙/费用页、朋友档案保存与WebMCP成功/失败路径。详细结果见 `docs/TEST_RESULTS.md`。

API测试需要一个专用、空的本地数据库。在独立测试checkout中初始化上述迁移，启动下方仅本机测试服务，再在第二个终端运行测试：

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8787 --inspector-port 0
node tests/api.mjs
```

停止并重新启动该测试服务后，运行 `node tests/persistence.mjs`。API测试中的身份头仅用于隔离的回环地址测试，不能视为线上登录方法。`tests/reset-local-test.sql` 会清空本地数据库的全部测试记录，仅供专用虚构测试环境使用，不能对真实本地数据或远程数据库执行。

## 部署

`.openai/hosting.json` 声明原有 Sites project_id 与逻辑 D1绑定DB，真实资源由Sites管理。`sites()`构建插件保留，产出Cloudflare Worker ESM及数据库迁移。源码和锁文件推送到该Site的受控源码仓库，部署档案只包括构建输出、hosting元数据和Drizzle迁移，不包含`.wrangler`、测试数据库或凭据。

通过Sites工作流保存版本并私有发布，等待成功状态后使用实际返回的网站地址。不要通过源码中的测试身份、手动身份头或昵称登录线上。无需自建认证服务、支付服务、AI排场API或后台月榜任务。没有安装或开通外部付费服务。

## 已完成与边界

已打通：创建活动→正式/候补报名→自动递补→默认参加→双打草稿/交换/锁定/发布→开赛前计分确认→比分→月榜/Rating→分项AA/豁免/补贴→结算版本，展示每人分摊金额；包括历史修正、权限、审计、JSON导出和手机底部导航。

尚未实现：活动整体改期的联动编辑（目前可修改标题/球馆/容量/截止/备注，以及各预约时段）。已新增三局两胜、头像上传及社群功能，详见 docs/SOCIAL_FEATURES.md。聊天、支付接口、库存和多群平台仍不在范围内。时段球费调整表单一次支持两段，更多时段用独立耗球记录，后台数据结构支持多段。

受环境与交付边界限制：本次只发布所有者私有受众，真实成员分享权限需所有者在Sites设置；未在生产数据库执行模拟数据验收，未做真实支付或大规模负载测试。小群场景每次读取得到一致的完整群数据，历史特别多时应进一步分页与限制日志加载。





球馆选择与地图入口详见 [VENUES.md](docs/VENUES.md)。

最新排行榜规则：所有启用球友同榜、无最低场数门槛，并展示头像，详见 [RANKING.md](docs/RANKING.md)。

最新活动入口和界面说明见 [ACTIVITY_UI.md](docs/ACTIVITY_UI.md)。
功能说明入口已加入首页、排名、活动各页签、球友圈、相册和账号管理。积分公式、段位门槛、称号口径和15个主题详见 [FEATURE_GUIDES.md](docs/FEATURE_GUIDES.md)。装饰图的内置imagegen提示词及项目路径见 [VISUAL_ASSETS.md](docs/VISUAL_ASSETS.md)。
