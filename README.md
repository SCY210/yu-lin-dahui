# 羽林大会

一个私人使用、以手机为主的羽毛球俱乐部网页应用。界面是中文，默认货币为欧元，默认时区为 Europe/Madrid。仓库里的共享文档一律用中文写（见[仓库与本地状态](docs/REPOSITORY_HYGIENE.md)）。

工程验证与现代化见 [ENGINEERING.md](docs/ENGINEERING.md)，故障处理与恢复见 [OPERATIONS.md](docs/OPERATIONS.md)。使用 `.node-version` 指定的 Node 版本，用 `npm ci` 安装依赖，然后运行 `npm run verify`。lint 检查只允许历史遗留问题减少，`npm run lint:report` 列出尚未解决的问题。

正式源码仓库：[SCY210/yu-lin-dahui](https://github.com/SCY210/yu-lin-dahui)。托管使用现有的 Sites 项目，结构化数据存放在 Cloudflare D1，照片存放在 R2。GitHub 上只有源码，没有生产数据、密码、会话、上传文件或本地运行状态。

另见[协作与本地检出规范](docs/REPOSITORY_HYGIENE.md)、[安全](docs/SECURITY.md)和[隐私与法律准备](docs/LEGAL_READINESS.md)。协作者通过 PR 提交，由 SCY210 审查。

## 当前的应用流程

实时排场在每局录分后推进对应场地，优先安排上场次数少的人，并照顾"休息一局"的要求，不需要手动输入比赛时间。应用提供默认头像、搭档投票、群主调整积分、修为（一种长期的 Elo 式评分，决定显示的境界；分组只用双打对局按同一公式重算；连续三个月没有计分对局才会重置）、季度榜和年度榜使用的赛季积分（每赢一局加 3 分，每输一局扣 1 分，另有以弱胜强加成），以及单打排行榜。代报名的来宾档案保留对局记录，但在分配到自己的账号前不进入全站排名。

## 本地运行

在 Windows 上双击 start-local-test.cmd，可以用一个隔离的本地分支数据库运行当前检出目录，它从不使用生产数据。见[本地测试启动器](docs/LOCAL_TEST_LAUNCHER.md)。

需要 Node.js >=22.13.0。请使用你自己环境里受支持的 Node 程序，不要照抄其他开发者的绝对运行路径。

```powershell
npm ci --no-audit --no-fund
npm run build
```

初始化新的本地数据库时，按 drizzle/meta/_journal.json 记录的顺序执行 SQL 迁移。例如：

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_handy_freak.sql
```

对之后的每个迁移重复这一步，包括 0007_security_limits.sql。已有数据库只执行尚未执行过的迁移。绝不要重放历史迁移，也不要重置含有真实数据的数据库。

```powershell
npm run dev
```

打开服务器给出的地址（通常是 http://127.0.0.1:5173）。本地数据保存在 .wrangler/state，刷新和重启后仍在，并且与生产 D1 分开。

开发预览只在本机回环地址上提供一个虚构身份，生产构建不包含这个模拟身份。开发和测试服务器要绑定在 127.0.0.1。生产环境必须留在 Sites 身份分发层之后；绝不要直接暴露一个信任转发身份请求头的 Worker。

## 账号与权限

界面上群主、管理员、测试员和成员分别显示为宗主、长老、试剑人和道友（见 AGENTS.md 的界面文案风格）；本文仍用原来的权限术语。成员用管理员创建的用户名和密码登录，不需要邮箱，也没有公开自助注册。新用户名由 2-32 个 ASCII 字母或数字组成，大小写会统一。旧用户名仍然兼容。已有平台身份可以开启密码登录，同时保留原来的账号、档案和权限。

成员验证当前密码后，可以修改一次自己的用户名。群主可以多次修改用户名并管理角色。其他管理员不能修改受保护的群主账号或档案。修改或重置密码会撤销相应的旧会话。没有默认管理员密码，也没有测试后门。见[账号管理](docs/ACCOUNT_LOGIN.md)。

登录入口是公开的；俱乐部数据、照片、活动、比分和费用都需要服务器端验证身份和成员资格。邀请码哈希为兼容保留，以 SHA-256 存储，但生产环境不用它开放注册。

## 主要流程

1. 管理员创建活动，设置报名截止时间、人数上限和一个或多个场地预约。支持不连续的预约时段。
2. 每位参加者有自己的档案和报名记录。活动满员后进入候补；有人取消时，第一位符合条件的候补者自动转正。开始前 24 小时内取消需要活动管理者批准。
3. 正式报名默认视为参加，不强制签到。实际参加时段决定场地安排和费用分摊；未来的时间不会被当作已经到场。
4. 生成轮次草稿，查看休息机会，调换球友或场地，锁定选中的对局后发布。重新生成会保留已锁定的对局。
5. 开始这一轮；网站上每场完整的比赛都计入赛季积分和修为。录入合法的终局比分（例如 21:15）或三局两胜的结果。修改比分会重算积分，并重放之后的修为变化。
6. 按颗记录实际用球：型号、单颗价格和颗数（整筒换算成颗，例如一筒 12 颗加 4 颗 = 16），也可以记录消耗时段。旧的按筒记录仍可读取，结算金额不变（见 docs/UPDATE_FEES.md）。记录其他费用，并分别选择场地费和球费的分摊方式。
7. 设置单项豁免和俱乐部补贴。每次计算都会核对参加者应付金额、补贴和未分摊费用。无法分摊的费用必须先明确处理，才能最终结算。
8. 保存或确认结算版本。所有俱乐部成员都能查看每人的分摊金额和明细。修正会生成新版本，旧版本仍然可查。
9. 管理员可以导出完整的业务数据和审计记录。导出内容属于个人数据，不要放进 Git。

应用显示每个人在共同活动中应付多少钱。付款确认、已付和未付状态、退款、收款和欠款跟踪都没有实现。历史付款记录为兼容仍保存在存储中，但正常业务接口不会创建或返回它们。

## 数据与算法

业务记录分表存放，详细字段放在 JSON 载荷里。外键、唯一的报名和版本索引，以及唯一的提交修订号，保护数据关系和并发写入。凭据、会话和限流数据与业务导出分开。

写入使用带唯一修订号和幂等键的原子 D1 批处理。报名冲突时重新加载状态并重算，最多尝试五次。管理类写入必须带上当前修订号，过期时返回 409。每个接口都会验证身份、角色、归属，以及写请求是否同源。普通成员不能访问私人草稿及其相关记录。

- lib/domain/commands.ts 实现报名顺序、候补转正、权限、校验和状态变化。
- lib/domain/grouping.ts 先按欠的上场机会和等待时间选人，再用 600 次带种子的局部搜索平衡双方强弱和重复搭配。对局必须落在有效的场地预约时段内。这是启发式算法，不保证全局最优。
- lib/domain/money.ts 支持平均、按时长和按时段三种分摊方式。用 BigInt 有理数运算和确定性的最大余数分配来核对到分。各项总额在分摊前先定到分：新的球费记录（单颗价格 × 颗数）本来就是整分，按小时计的费用和旧的按筒球费记录四舍五入。没有精确消耗时间时，会标出估算的用球时段。
- lib/domain/ranking.ts 以比赛记录为事实来源。排行榜积分是该时段内每局计分对局的赛季积分，按马德里时间的开赛月份归属（lib/domain/season-points.ts），综合榜另加群主调整的积分（见 docs/REALM_PROGRESSION.md）。所有已启用的球友都会出现在榜上，没有最低局数门槛。同分时依次比较积分、胜率和平均分差。修为按完成时间和 ID 重放；双方使用相同 K 值时，每局的变化总和为零。前十局计分对局是定级赛。

每月保存的胜、负和上限数值仍可读取，但不再影响积分；境界在每次活动结束后结算。修为从 1000 开始（前 20 局 K=32，之后为 16）；目标分 21、领先 2 分、封顶 30 分。单打和双打活动也可以选择 15 分制（见[每局分制](docs/GAME_POINTS.md)）。规则绑定到月份；修改默认规则不会改写历史月份。修改历史规则需要先预览、再明确确认，并保留审计记录。

## 验证

```powershell
npm test
npm run typecheck
npm run build
```

可复现的测试放在 tests/。生成的报告放在 .test-output；各检出目录自己的历史 Markdown 报告不再共享。确切的测试结果属于执行那次运行的 PR，不代表每个检出目录都测过。

HTTP 测试套件需要专用的虚构回环数据库。在那里执行全部迁移，然后启动一个隔离的已构建 Worker：

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .test-output/api-state --ip 127.0.0.1 --port 8787 --inspector-port 0
```

按每个测试脚本对测试数据的要求准备环境。tests/reset-local-test.sql 会清空目标里的全部数据，只能用于空的、专用的虚构测试环境。绝不要对生产数据库或真实的本地数据库运行它。本地身份请求头是测试设施，不是生产登录方式。

只读的请求体 HTTP 回归测试默认使用 8794 端口，不需要准备账号或执行迁移：node tests/request-body-http.mjs。计时和模拟器的局限见[安全](docs/SECURITY.md)。

## 部署

在所有者的 Cloudflare 账号中独立部署，见 [Cloudflare 部署](docs/CLOUDFLARE_DEPLOYMENT.md)。

.openai/hosting.json 指明共用的现有 Sites 项目，以及逻辑上的 DB 和 BUCKET 绑定。它是必需的部署配置，不是个人的 Codex 配置。Sites 构建插件会生成 Cloudflare Worker ESM 包，并包含 Drizzle 迁移。只部署受支持的构建产物、托管元数据和迁移，不包括本地状态和凭据。

把源码同步到 GitHub 不会部署网站。请按授权的 Sites 托管流程操作，并确认部署确实成功。不要顺带改动访问范围、协作者保护、身份或生产数据。

发布新的声明之前，先在[法律准备](docs/LEGAL_READINESS.md)中填好真实的运营者信息和隐私决定。本仓库不保证符合法律要求。

## 功能文档

- [活动流程](docs/ACTIVITY_UI.md)
- [社交功能与玩法](docs/SOCIAL_FEATURES.md)
- [球友页面](docs/PLAYER_PAGES.md)和[档案与装备](docs/PLAYER_PROFILES.md)
- [排名](docs/RANKING.md)、[单打排名](docs/SINGLES_RANKING.md)、[修为与境界](docs/REALM_PROGRESSION.md)和[领奖台](docs/RANKING_PODIUM.md)
- [费用分摊](docs/UPDATE_FEES.md)和[垫付费用](docs/FEE_ADVANCES.md)
- [球馆与地图链接](docs/VENUES.md)
- [功能说明](docs/FEATURE_GUIDES.md)
- [手机返回导航](docs/MOBILE_BACK_NAVIGATION.md)
- [安装 PWA 应用](docs/INSTALL_APP.md)
- [性能架构](docs/PERFORMANCE_SLIMMING.md)和 [Worker CPU 预算](docs/PERFORMANCE_BUDGET.md)
- [视觉素材与来源](docs/VISUAL_ASSETS.md)

已知边界：整场活动改期不会自动更新所有相关记录；单个场地预约和支持的活动字段可以编辑。聊天、付款、库存和多俱乐部平台不在范围内。费用表单一次支持两个按时间调整的用球时段，更多时段可以用额外记录表示。大量历史数据仍需要进一步分页。自动检查不能代替真机测试、生产访问测试或压力测试。

创建活动时可以选择单打或双打，名称按日期自动生成，排行榜分开计算。修改类表单自动生成审计说明，不强制填写备注；见[单打与双打活动](docs/SINGLES_RANKING.md)。
