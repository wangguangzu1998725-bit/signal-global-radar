import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const config = JSON.parse(await fs.readFile(new URL('./config.json', import.meta.url), 'utf8'));
export const hash = text => createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
export const chinaDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(now);
export function validDate(date) {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function parseIssue(text) {
  const match = text.replace(/^\uFEFF/, '').replace(/\r\n/g,'\n').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error('刊期需要 JSON front matter 和完整 Markdown 正文');
  return { ...JSON.parse(match[1]), markdown: match[2] };
}
export function serializeIssue(issue) {
  const { markdown, ...meta } = issue;
  return `---\n${JSON.stringify(meta, null, 2)}\n---\n${markdown}`;
}
export function publicUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') ||
      !config.allowed_domains.some(d => u.hostname === d || u.hostname.endsWith('.' + d))) {
    throw new Error('来源必须使用受信任公开域名的 HTTPS 链接');
  }
  u.hash = '';
  return u.href;
}
export function privacyCheck(text) {
  if (/(?:sk-(?:proj-)?[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|-----BEGIN .*PRIVATE KEY-----|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|(?<!\d)1[3-9]\d{9}(?!\d)|(?:家庭|私人|家人|父母|我家).{0,12}(?:经营|病历|处方|身份证|营业额|医保账号))/u.test(text)) {
    throw new Error('隐私/密钥检查未通过；不要把家庭私人资料交给公开发布流程');
  }
}
export function validateIssue(issue, { expectedDate, now = new Date(), legacy = false } = {}) {
  if (!validDate(issue.date) || (expectedDate && issue.date !== expectedDate) || issue.date > chinaDate(now)) throw new Error('刊期日期不合法或超出允许日期');
  if (typeof issue.title !== 'string' || !issue.title.trim() || typeof issue.markdown !== 'string' || !issue.markdown.trim()) throw new Error('标题或正文为空');
  if (!['published', 'draft'].includes(issue.status)) throw new Error('非法刊期状态');
  if (legacy) return;
  if (issue.legacy || issue.schema_version !== 1 || issue.status !== 'published' || issue.public_approved !== true || issue.complete !== true) throw new Error('缺少完整刊期/公开发布声明');
  if (issue.verification !== 'unverified' || issue.verified === true) throw new Error('自动流程和导入不能把未验证信息标为已验证');
  if (!Number.isFinite(Date.parse(issue.published_at)) || chinaDate(new Date(issue.published_at)) !== issue.date || Date.parse(issue.published_at) > now.getTime()) throw new Error('发布日期与刊期不符');
  if (issue.markdown.length < 800 || issue.markdown.length > 60000) throw new Error('正文长度不足或过大');
  privacyCheck(JSON.stringify(issue));
  const headings = [...config.domains.map((name, n) => `## 新闻 ${String(n+1).padStart(2,'0')}｜${name}`),
    ...config.topics.map(t => `## 专题 ${t.num}｜${t.name}`)];
  for (const heading of headings) {
    const sections = issue.markdown.split('\n').filter(line => line.trim() === heading);
    if (sections.length !== 1) throw new Error('必须恰好保留10个新闻领域与9个专题章节');
    const body = issue.markdown.slice(issue.markdown.indexOf(heading) + heading.length).split(/\n## /)[0].trim();
    if (body.length < 8) throw new Error('章节不能为空；无可靠资料时应明确写出缺口');
  }
  if (!Array.isArray(issue.sources) || issue.sources.length < 3 || issue.sources.length > 30) throw new Error('需要3–30条有日期的原始来源');
  const cutoff = Date.parse(issue.date + 'T09:00:00+08:00');
  const urls = new Set(); let recent = 0;
  for (const source of issue.sources) {
    const url = publicUrl(source.url);
    if (urls.has(url) || !source.title?.trim() || !validDate(source.published_date) || !validDate(source.event_date)) throw new Error('来源重复或缺少标题、报道/事件日期');
    const timestamp = Date.parse(source.published_date + 'T00:00:00+08:00');
    if (source.published_date > issue.date || source.event_date > issue.date) throw new Error('来源/事件日期在未来');
    if (!source.historical) {
      if (timestamp < cutoff - 57 * 3600000) throw new Error('新闻来源超出最近48小时日期窗口');
      recent++;
    }
    urls.add(url);
  }
  if (recent < 3) throw new Error('至少需要3条近期新闻来源');
  const links = [...issue.markdown.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m => publicUrl(m[1]));
  if (!links.length || links.some(u => !urls.has(u)) || [...urls].some(u => !links.includes(u))) throw new Error('正文引用必须与来源清单一一对应');
  if(headings.slice(0,10).filter(heading=>/\]\(https:\/\//.test(issue.markdown.slice(issue.markdown.indexOf(heading)+heading.length).split(/\n## /)[0])).length<3)throw new Error('至少需要3个带来源的新闻领域');
  if (/!\[|<script|\]\((?!https:\/\/)/i.test(issue.markdown)) throw new Error('正文包含不支持的嵌入或链接');
}
export async function readArchive(root = ROOT) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'content/legacy-manifest.json'), 'utf8'));
  const files = (await fs.readdir(path.join(root, 'content/issues'))).sort();
  const result = [];
  for (const name of files) {
    if (!/^\d{4}-\d{2}-\d{2}\.md$/.test(name)) throw new Error('档案目录出现非标准文件');
    const text = await fs.readFile(path.join(root, 'content/issues', name), 'utf8');
    const issue = parseIssue(text), sha256 = hash(text);
    if (issue.legacy && manifest[name] !== sha256) throw new Error('历史迁移记录已被更改');
    validateIssue(issue, { expectedDate: name.slice(0, -3), legacy: !!issue.legacy });
    const { markdown, ...meta } = issue;
    result.push({ ...meta, file: `issues/${name}`, sha256, excerpt: markdown.slice(0, 180) });
  }
  for (const name of Object.keys(manifest)) if (!files.includes(name)) throw new Error('历史迁移档案丢失');
  return result.sort((a,b) => b.date.localeCompare(a.date));
}
export async function buildIndex(root = ROOT, { check = false } = {}) {
  const issues = await readArchive(root);
  let old;
  try { old = JSON.parse(await fs.readFile(path.join(root,'content/index.json'),'utf8')); }
  catch(e) { if(e.code !== 'ENOENT') throw e; }
  if (old) for (const item of old.issues) {
    if (!issues.some(i => i.date === item.date && i.sha256 === item.sha256)) throw new Error('拒绝覆盖或删除已有历史档案');
  }
  const index = { schema_version: 1, issues };
  const text = JSON.stringify(index, null, 2) + '\n';
  if (check) {
    if (JSON.stringify(old) !== JSON.stringify(index)) throw new Error('档案索引未更新或不匹配');
  } else {
    const target = path.join(root,'content/index.json');
    await fs.writeFile(target + '.tmp', text); await fs.rename(target + '.tmp', target);
  }
  return index;
}
export async function appendIssue(issue, root = ROOT) {
  validateIssue(issue);
  await buildIndex(root, {check:true});
  const file = path.join(root,'content/issues',issue.date+'.md');
  await fs.writeFile(file, serializeIssue(issue), { flag: 'wx' });
  try { return await buildIndex(root); }
  catch(e) { await fs.unlink(file); throw e; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildIndex(ROOT, {check:process.argv.includes('--check')});
  console.log('档案、来源元数据与索引检查通过');
}
