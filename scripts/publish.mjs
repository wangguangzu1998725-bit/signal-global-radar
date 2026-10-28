import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {ROOT,config,chinaDate,validDate,parseIssue,serializeIssue,buildIndex,appendIssue,validateIssue,privacyCheck} from './content.mjs';
import {generateIssue,reserveBudget,readLedger} from './generate.mjs';
import {checkSources} from './sources.mjs';

function commitPaths(root,paths,message) {
  const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
  git('config','user.name','signal-publisher[bot]');
  git('config','user.email','signal-publisher[bot]@users.noreply.github.com');
  git('add','--',...paths);git('commit','-m',message);git('push','origin','HEAD:main');
}
export async function publish({root=ROOT,mode='check',date=chinaDate(),dryRun=true,report,
  apiEnabled=false,apiKey,confirmPublic=false,now=new Date(),generate=generateIssue,
  check=checkSources,onStage=()=>{},onValidated=async()=>{},commit=(paths,message)=>commitPaths(root,paths,message)}={}) {
  onStage('档案与日期预检');
  if(!['check','import','generate'].includes(mode)||!validDate(date)||date>chinaDate(now))throw new Error('无效运行模式或刊期日期');
  const index=await buildIndex(root,{check:true});
  if(mode==='check')return {mode,dry_run:true,archives:index.issues.length,ready:false};
  if(index.issues.some(i=>i.date===date))return {mode,duplicate:true,ready:!dryRun};
  let issue;
  if(mode==='import') {
    if(!confirmPublic || !report)throw new Error('导入必须明确确认全部内容可公开，并提供完整Markdown文件');
    privacyCheck(report);issue=parseIssue(report);validateIssue(issue,{expectedDate:date,now});
    issue={...issue,origin:'manual-import',verification:'unverified',verified:false};
  } else {
    if(date!==chinaDate(now))throw new Error('付费生成只允许当天刊期；历史稿请手动导入');
    if(now.getTime()<Date.parse(date+'T09:00:00+08:00'))throw new Error('尚未到当日09:00新闻截止时间');
    const ledger=await readLedger(root);
    const reservation=reserveBudget(ledger,date,now);
    if(dryRun)return {mode,dry_run:true,ready:false,api_called:false,reservation_usd:config.reservation_usd,monthly_budget_usd:config.monthly_budget_usd};
    if(!apiEnabled||!apiKey)throw new Error('独立API生成尚未启用或缺少OPENAI_API_KEY；保留最近正常刊期');
    // Reservation must be durable on GitHub BEFORE any paid API request.
    await fs.mkdir(path.join(root,'.automation'),{recursive:true});
    onStage('先提交付费尝试与预算预留记录');
    await fs.writeFile(path.join(root,'.automation/ledger.json'),JSON.stringify(reservation,null,2)+'\n');
    await commit(['.automation/ledger.json'],`chore: reserve daily API attempt ${date}`);
    onStage('独立API生成：最多一次请求，不读取ChatGPT Tasks');
    issue=await generate(date,{apiKey,now});
  }
  onStage('来源链接、网页发布日期与公开内容检查');
  issue=await check(issue);validateIssue(issue,{expectedDate:date,now});
  if(dryRun)return {mode,dry_run:true,ready:false,validated:true,api_called:false};
  await onValidated(issue);
  onStage('追加独立刊期及历史索引');
  await appendIssue(issue,root);
  onStage('提交已通过检查的公开刊期');
  await commit([`content/issues/${date}.md`,'content/index.json'],`content: publish SIGNAL ${date}`);
  return {mode,date,ready:true,published:true};
}
async function main() {
  const args=process.argv.slice(2), value=key=>{const n=args.indexOf(key);return n<0?undefined:args[n+1];};
  const mode=value('--mode')||process.env.SIGNAL_MODE||'check';
  const date=value('--date')||process.env.SIGNAL_DATE||chinaDate();
  const dryRun=!args.includes('--publish')&&process.env.SIGNAL_DRY_RUN!=='false';
  if(!dryRun && (process.env.GITHUB_REF!=='refs/heads/main'||process.env.GITHUB_EVENT_NAME==='pull_request'))throw new Error('真正发布只允许合并后的main分支；本次未写入或调用API');
  const input=value('--input');
  const report=input?await fs.readFile(input,'utf8'):process.env.SIGNAL_REPORT;
  const result=await publish({mode,date,dryRun,report,apiEnabled:process.env.SIGNAL_API_ENABLED==='true',apiKey:process.env.OPENAI_API_KEY,confirmPublic:process.env.SIGNAL_CONFIRM_PUBLIC==='true',onStage:s=>console.log('[SIGNAL] '+s),onValidated:async issue=>{if(process.env.RUNNER_TEMP)await fs.writeFile(path.join(process.env.RUNNER_TEMP,`signal-validated-${date}.md`),serializeIssue(issue));}});
  console.log(JSON.stringify(result));
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`ready=${result.ready===true}\n`);
  if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`### SIGNAL发布检查\n\n- 模式：${mode}\n- 刊期：${date}\n- 模拟运行：${dryRun}\n- 已发布：${result.published===true}\n- 重复保护：${result.duplicate===true}\n- 未接入ChatGPT Tasks；自动来源检查不等于人工事实核验。\n`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{
  // Report/model text and credentials are intentionally never printed.
  console.error('发布中止：请检查配置、日期、公开声明、来源/栏目格式及付费尝试记录。最近正常刊期未被覆盖；详见docs/AUTOMATION.md。');process.exitCode=1;
});
