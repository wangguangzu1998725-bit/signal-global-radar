# SIGNAL｜全球信息雷达｜Global Intelligence Radar｜グローバル情報レーダー

中文资讯研究网站，保留10大新闻观察领域、9大研究专题与全部已有历史档案。继续维护现有设计与代码，使用免费GitHub Pages静态托管，不使用付费建站会员、服务器或数据库。

## 三个主要栏目与共享数据

- **01 DAILY｜今日概览**：最新日报摘要和完整阅读入口，新稿包含世界速览、10领域、8–12条重点新闻、深度分析与9专题槽位。
- **02 TOPICS｜九大专题**：自动引用历期对应研究，倒序累积，可读完整案例与来源并返回原刊期；缺口不冒充文章。
- **03 ARCHIVE｜历史档案**：北京时间日期唯一标识，日期导航、搜索和完整阅读，旧文只增不减。

三个栏目共用content/issues正文、content/taxonomy.json分类和content/sections.js解析器；索引自动派生、不另存专题正文。旧稿7组标题到网站9专题的明确映射与目前无法确认的ChatGPT任务部分，见[栏目映射](docs/COLUMN-MAPPING.md)。

## 内容与发布

- 正文独立存放于 `content/issues/YYYY-MM-DD.md`；`content/index.json`是自动生成的倒序索引。
- 原有2026-10-28待核验整理稿和10月24–27日的4个待补录占位已逐字迁移。占位仍为draft，不冒充真实新闻。
- 首页读取最新已发布的完整日报，可展开全文；档案支持标题、日期和全文关键词搜索。
- 新刊期只能追加；既有日期禁止覆盖或删除。本机编辑器仅保存个人草稿，不能替代公开文章。
- 每期保留完整正文、来源、发布日期和核验状态。自动稿始终标为未经人工逐条核验。

## 每日自动化的真实状态

已开发每天北京时间09:10左右运行的GitHub Actions，以及独立OpenAI API生成、来源/日期/格式检查、追加归档、自动提交与显式Pages部署流程。

**尚未证明生产无人值守链路已接通。** PR合并后仍需配置Pages的GitHub Actions来源、仓库/环境权限、`OPENAI_API_KEY` Secret和`SIGNAL_API_ENABLED`变量，并完成真实联调。本次不自动合并或启用付费API。

现有ChatGPT Tasks每日09:00报告与本网站**没有同步**。API生成是独立流程；现有报告可通过手动Markdown导入入口发布。没有可靠来源或校验失败就不发布，保留上一期内容。

完整配置、手动运行、导入格式、失败重试、费用与限制见 **[docs/AUTOMATION.md](docs/AUTOMATION.md)**。

## 隐私与事实

家庭医药私人资料、家庭经营数据、账号、Key及本机JSON备份不得进入公开仓库、工作流输入或网站源码。公开医药页面只保留研究范围；Cloudflare Access三人私密环境单独处理。

不编造新闻、政策或贸易金额数量。已有外贸案例是2025年度历史统计，不是最新月度数据；本次没有新增新闻或将旧整理稿升级为已验证内容。

## 本地维护

```sh
npm ci
npx playwright install chromium
npm test
npm run build
npm run publish:check
git diff --check
```

可设置环境变量`CHROME_PATH`使用本机Chrome。测试数据只存临时目录和模拟HTTP响应，不发布到站点。`npm run build`生成白名单静态目录`_site/`；生产由Pages工作流部署。不要直接双击HTML测试内容加载，请使用本地HTTP服务或浏览器测试。

添加历史Markdown后运行`node scripts/content.mjs`更新索引；新文件必须通过严格内容检查。后续新增专题或修改视觉设计应继续在本仓库迭代。
