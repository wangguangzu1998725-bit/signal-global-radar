# SIGNAL 日报发布与运维

状态：代码已实现；**未提供/验证生产API Key，未合并PR，尚不能声称生产环境已无人值守运行。** 此流程不读取现有ChatGPT Tasks任务或对话，也没有把两套系统同步。

## 数据与保留规则

- 正文：`content/issues/YYYY-MM-DD.md`。首段是由 `---` 包围的JSON元数据，其余为完整Markdown。
- 索引：`content/index.json`，含文件路径、日期、标题、发布状态、核验状态、来源及文件SHA-256；不复制全文。
- 原有2026-10-28整理稿和10月24–27日占位逐字迁移。4个占位仍为draft；不伪装成已发布日报。
- `content/legacy-manifest.json`固定迁移内容；程序和PR检查禁止覆盖、删除既有刊期。更正应新增独立说明，勿修改旧原文。
- 首页读取最新published刊期的全文，可展开阅读；历史档案倒序排列，搜索会按需载入全文。浏览器本机草稿不能替代公开稿。
- `complete: true`指10领域和9专题结构齐全，不代表每栏都有新事件或所有事实已验证。缺少可靠资料的栏目明确保留缺口；至少3个新闻领域有实际来源。

## 合并后需要完成的配置

1. 确认本PR后再合并。此PR不会自行合并、改动生产Pages来源或启用付费API。
2. 仓库 Settings → Pages → Source 选择 **GitHub Actions**。`pages.yml`负责部署；无需付费服务器或PAT。
3. Settings → Actions → General 允许Actions，确保发布任务的`GITHUB_TOKEN`可获得`contents: write`。如main有保护规则，需允许该发布方式；不要为运行脚本盲目取消保护规则。
4. `github-pages`环境允许main分支部署。若环境设置必须人工批准，每天部署也会等待人工批准，不能称为无人值守。
5. 在 Settings → Secrets and variables → Actions → Secrets 创建 `OPENAI_API_KEY`。建议使用单独OpenAI项目的受限Key；**不要把Key粘贴到聊天、正文、代码、工作流输入或Variables。** API独立计费，不包含在ChatGPT订阅内。
6. 先保留变量 `SIGNAL_API_ENABLED` 未设置或为`false`。完成模拟和一次人工观察的真实运行后，再将它设为`true`以启用每天生成。Key存在但未启用该变量时不会调用API。

## 每日流程

`publish.yml`安排UTC `01:10`，即北京时间09:10左右；新闻截止09:00。实际启动可能延迟，不能保证准点。公开仓库长期没有活动也可能使定时任务停用，需在Actions中检查。

执行顺序：

1. 检查既有档案和索引；已有同日期文件时跳过生成，不覆盖、不重复计费。
2. 检查API启用状态、Key和预算；把当天的尝试及预算预留记录提交到`.automation/ledger.json`并成功推送，才调用API。
3. 用Responses API独立检索与生成：固定`gpt-5-mini`，最多1次付费请求、8次内置检索、12000个输出token，输入JSON不超过16000字节，4分钟超时，不保存服务端响应（`store:false`）。未开启其他付费工具。
4. 从实际API检索记录核对来源URL，拒绝模型额外编造的来源；新文章至少3条近期来源和3个有来源的新闻领域。
5. 检查来源可达性、受信任HTTPS域名、每次跳转、页面发布日期元数据与09:00前48小时窗口。**无法读取、被反爬、没有可核对时间/时区或证据不足均中止，不改写为“无新闻”。** 历史研究可明确标记historical，不能充当近期新闻。
6. 检查日期、完整栏目、来源引用、非空正文、明显身份/密钥模式与公开声明。新稿固定`verification: unverified`、`verified: false`，不允许导入参数把它标为已验证。
7. 以独占创建方式追加Markdown文件，更新索引，再提交到main。任何历史文件不在自动提交清单中。
8. 显式调用Pages工作流，校验并构建白名单静态文件，再部署。不会依赖`GITHUB_TOKEN`提交触发普通分支式Pages构建。

自动检查只能验证部分结构和来源元数据，不能证明文章事实、语义、数字、政策效力或所有私人信息都正确。所有API稿都保留“未经人工逐条核验”标记。家庭医药私人资料不得进入这条流程；Cloudflare Access三人登录及私人资料环境另行处理。

## 手动运行与导入现有ChatGPT报告

Actions → **Daily SIGNAL publication** → Run workflow：

- `mode: check`：检查现有档案；不调用API、不提交、不部署。
- `mode: generate` + `dry_run: true`：仅检查生成前置条件与预算；不会调用API，也不能据此证明API已接通。当天09:00前此模式会拒绝执行。
- `mode: import`：`date`填写刊期日期，`report`粘贴完整Markdown（包括JSON front matter），明确勾选`confirm_public`。先保持`dry_run: true`；检查通过后再选择`dry_run: false`正式发布。**工作流输入不是秘密存储，只能粘贴已确认可公开的报告。**
- `mode: generate` + `dry_run: false`：仅main允许；需已启用API变量和Key。一次真实调用可能计费，即使来源检查不通过也不会退款。

公开网页的编辑器继续提供本机预览和草稿保存；「导出公开Markdown」只导出当前已明确授权且已保存的草稿，默认`complete:false`、`sources:[]`。需补齐所有章节、来源与日期，再通过上述导入入口发布。不能再用下载index.html的方式覆盖历史正文。

Markdown文件格式（示意，省略部分**不能直接发布**）：

```text
---
{
  "schema_version": 1,
  "date": "YYYY-MM-DD",
  "title": "01｜全球信息雷达｜YYYY-MM-DD",
  "status": "published",
  "published_at": "YYYY-MM-DDT09:10:00+08:00",
  "origin": "manual-import",
  "verification": "unverified",
  "verified": false,
  "public_approved": true,
  "complete": true,
  "sources": [
    {"url":"实际HTTPS文章地址","title":"原标题","published_date":"YYYY-MM-DD","event_date":"YYYY-MM-DD","historical":false}
  ]
}
---
# 01｜全球信息雷达

## 新闻 01｜全球政治与地缘关系

完整中文原稿、事件/报道日期、事实与分析区分、实际来源链接。

……其余9个新闻领域和9个专题；必须使用scripts/config.json中对应的完整标题。
```

所有19个标题可以从`scripts/config.json`查看；正文中的每个来源链接必须在sources中声明。至少3条近期文章，其余历史研究来源须标记`historical:true`。若原ChatGPT报告没有可靠来源/时间元数据，导入会拒绝：保留本机草稿，先补证据，不伪造来源来绕过检查。

## 失败与重试

- 来源GET请求对网络错误、429及5xx最多重试3次；所有跳转重新检查域名，不访问任意上传URL。
- 付费API只有一次请求；网络超时后的实际计费情况不明，因此**不会自动再次付费**。当天已预留的尝试在工作流重跑时仍保留，即使后来失败。
- 如果生成和校验已完成但提交失败，会短期保留「已通过检查的公开候选稿」Actions artifact（3天）。可下载后用import模式重试，不需要再次调用API。
- 如果正文提交成功但部署失败，重跑Pages工作流即可；或重跑发布任务，同日期检测会跳过生成并再次部署。
- 如果生成/来源/隐私/格式检查失败，原公开文章和索引不变，网站继续展示最近正常刊期。只可能追加非敏感的预算预留记录。
- 不为重试清空历史档案或预算台账。若当天API结果不能恢复，使用手动导入，或保留昨天内容等待下一天。
- 手动运行的新工作流是否能在PR分支被GitHub接受取决于注册状态；未合并前仅允许只读预演，不会执行真实发布。实际定时与生产部署验收需合并后进行。

## 费用与成本控制（2026-10-29查阅）

- GitHub Pages公开站托管：免费。
- 本仓库使用标准Ubuntu GitHub-hosted runner；公开仓库的标准runner分钟免费，不使用larger runner。缓存和artifact仍遵守账号存储额度；只短期保留少量文件。
- 手动导入：没有OpenAI API费用。
- 独立生成：默认GPT-5 Mini每百万输入token $0.25、输出token $2.00；Web search $0.01/次，另收检索内容token。按每次2万–12.8万输入、4000–12000输出、4–8次检索估算，约 **$0.05–$0.14/天，30天约$1.50–$4.20**。这是用量情景估算，不是实测或账单上限；实际检索轮次、计费token与未来单价会改变金额。
- 应用在付费前每次预留$0.25、每个北京时间自然月最多预留$8，且每个刊期日期至多一次付费尝试。31天每天运行对应$7.75预留；失败尝试也占预算，不会因重试重复收费。
- 预留台账是**估算控制，不是OpenAI账单硬封顶**。请求次数/工具调用/token有代码上限；上线前仍应在OpenAI项目中设置可用的消费限制/预付额度和告警，并核对当前价格。台账不统计此Key在其他程序产生的费用。

官方依据：

- [OpenAI Scheduled tasks](https://learn.chatgpt.com/docs/automations)：未找到GitHub Actions读取现有ChatGPT Tasks报告的公开接口；不把API独立生成当作Tasks同步。
- [Responses API与调用限制](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [API Web search及来源](https://developers.openai.com/api/docs/guides/tools-web-search)
- [GPT-5 Mini价格](https://developers.openai.com/api/docs/models/gpt-5-mini) · [工具价格](https://developers.openai.com/api/docs/pricing)
- [GitHub Actions计费](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [Pages发布来源与GITHUB_TOKEN限制](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [工作流调度延迟](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)

## 开发与验收

```sh
npm ci
npx playwright install chromium
npm test
npm run build
git diff --check
```

可用`CHROME_PATH`指向本机Chrome。测试数据只放临时目录及模拟HTTP响应，不写入公开档案；单元测试覆盖追加、拒绝覆盖、迁移保留、非法日期、虚假verified、来源失败、预算、重复付费保护、导入预演与API失败。浏览器测试覆盖5种屏宽、16个主要页面组合、最新全文、搜索、独立档案加载、手机导航、缓存回退及本机草稿隔离。

必须区分：这些测试和PR云端预演通过，**不等于真实API生成、main提交和Pages部署已完成生产联调**。首次上线请在人工观察下运行一份有可靠来源的真实报告，再检查线上首页与档案；之后才能确认无人值守链路已接通。
