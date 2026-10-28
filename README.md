# SIGNAL｜全球信息雷达（GitHub Pages 免费版）

完整静态网站，**不需要购买 Lovable 会员**、不需要服务器、数据库或 Node.js 构建工具。

## 已包含

- 首页：**10 大全球新闻观察领域 + 7 大深度专题**
- 7 个专题入口：AI 科技机器人、商业创新创业、经济金融、艺术与创作研究（艺术家与认知破圈合并）、医药医保药房政策、建筑城市设计、全球长期趋势
- 知识示例：经济学 3 篇、部分艺术与建筑研究方法；这些是教学示例，**不是当天新闻**
- 医药：全国及辽宁、吉林、黑龙江的政府官方资料入口（**没有声称自动采集最新政策**）
- 历史刊期：按日期查看完整日报；搜索文章
- 网页内的 **导入日报**：粘贴纯文本或 Markdown、保存到本机、导出新的 `index.html`
- 基于 `#/...` 的地址，因此可以直接在 GitHub Pages 子目录下运行；手机适配

## 免费上线：GitHub Pages（首次操作）

1. 登录 https://github.com/ 并点击右上角 `+` → **New repository**。
2. 仓库名称建议 `signal-global-radar`（可自定），选 **Public**（免费 Pages 对个人免费账户通常要求公共仓库），点击 **Create repository**。
3. 在仓库 **Add file → Upload files** 上传本文件夹中的 `index.html` 和 `.nojekyll`（以及可选的 `README.md`），确保 `index.html` 在仓库根目录，不是在子文件夹里。点击 **Commit changes**。
4. 进入仓库 **Settings → Pages**。在 **Build and deployment → Source** 选择 **Deploy from a branch**，**Branch** 选择 `main`，**Folder** 选择 `/(root)`，点击 **Save**。
5. Pages 完成部署后，链接一般是 `https://你的GitHub用户名.github.io/signal-global-radar/`。以 **Settings → Pages → Visit site** 显示的真实地址为准。
6. 把链接发到群里即可，普通访客无需 GitHub 账号。

官方部署指南：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 每天更新日报（手动但免费）

1. 打开你公开的网站 → **导入日报**。
2. 将当天 ChatGPT 09:00 的完整简报文字粘贴到编辑区，输入北京时间日期。
3. **先人工核实** 新闻原始链接、日期以及医药医保政策的正式状态。点击 **保存到此浏览器**。
4. 点击 **导出 GitHub Pages 网页**，浏览器下载新 `index.html`，文件中包含已保存的历史刊期。
5. 在 GitHub 仓库用新 `index.html` **替换根目录原文件并提交**。如网页拖拽上传遇到同名文件提示，可打开仓库中的 `index.html`，用编辑文件功能替换全部文本后提交，或者用 GitHub Desktop 上传并提交更改。
6. GitHub Pages 重新部署后，群里的同一个链接会显示最新日报。每隔一段时间可点击 **下载 JSON 备份**，保留历史内容副本。

**非常重要**：
- 这个版本**没有**与 ChatGPT Tasks 自动同步：每天产生的报告必须先导入、审查和提交，才能被群成员看见。
- 编辑器的“保存”只修改当前设备的浏览器数据；它不是远程管理后台。群成员也可以操作自己的本地副本，但无法因此篡改公开网站。
- GitHub Pages 免费公开仓库及网站内容均可被他人查看。不要上传个人证件、API 密钥、客户资料等敏感信息。
- 未经核实的报道、政策请作为“待核查”标示，尤其是市场行情、疫情数据、药监与医保文件。GitHub Pages 不适合存储医疗隐私数据或处理支付。
- 这是**静态站**，适合发布信息与研究，不适合用作在线药房交易系统。

## 网站文件

`index.html`：整个网站与已导入日报，单文件版本。  
`.nojekyll`：让 GitHub Pages 直接按静态文件发布。  
`README.md`：这份操作说明。

未来如果要真正无人值守每日发布，可再设计 GitHub Actions + 后端数据源 / API；目前该部分未建成。


2026-10-28: imported an explicitly unverified editorial reconstruction; 2026-10-24 to 27 are draft placeholders.
