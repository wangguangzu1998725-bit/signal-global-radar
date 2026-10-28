import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT,config,parseIssue,serializeIssue,validateIssue,buildIndex,appendIssue,hash,privacyCheck,publicUrl} from '../scripts/content.mjs';
import {publish} from '../scripts/publish.mjs';
import {reserveBudget,requestBody,generateIssue,responseToIssue} from '../scripts/generate.mjs';
import {checkSources,fetchSource} from '../scripts/sources.mjs';

// Synthetic data exists only in temporary test directories and mocked responses.
export function fixture(date='2026-10-23') {
  const sources=[0,1,2].map(n=>({url:`https://www.un.org/signal-test-fixture-${n}`,title:`测试夹具${n}，不是新闻`,published_date:date,event_date:date,historical:false}));
  const text='自动化测试夹具，所有文字仅用于检验程序行为，禁止作为真实新闻发布。这里没有任何真实事件、市场数据、政策或预测。'.repeat(2);
  return {schema_version:1,date,title:'测试刊期，禁止公开',status:'published',published_at:date+'T09:10:00+08:00',origin:'test-fixture',complete:true,public_approved:true,verification:'unverified',verified:false,sources,
    markdown:'# 测试夹具\n\n'+[...config.domains.map((s,n)=>`## 新闻 ${String(n+1).padStart(2,'0')}｜${s}`),...config.topics.map(t=>`## 专题 ${t.num}｜${t.name}`)].map((h,n)=>`${h}\n\n${text}\n\n[来源夹具](${sources[n%3].url})`).join('\n\n')+'\n'};
}
const mockFetch=async url=>new Response(`<meta property="article:published_time" content="2026-10-23T08:00:00+08:00"><p>测试夹具</p>`,{headers:{'content-type':'text/html'}});
async function sandbox(t) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'signal-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'content/issues'),{recursive:true});const legacy=JSON.parse(await fs.readFile(path.join(ROOT,'content/legacy-manifest.json'),'utf8'));await fs.copyFile(path.join(ROOT,'content/legacy-manifest.json'),path.join(root,'content/legacy-manifest.json'));for(const name of Object.keys(legacy))await fs.copyFile(path.join(ROOT,'content/issues',name),path.join(root,'content/issues',name));await buildIndex(root);return root;
}
test('migration preserves exact original markdown and all five records',async()=>{
  const index=await buildIndex(ROOT,{check:true});assert.equal(index.issues.length>=5,true);
  const old=execFileSync('git',['show','086cd1942d7d0337a34e13eb24f90d5eed20e2d5:index.html'],{cwd:ROOT,encoding:'utf8'});
  const data=JSON.parse(old.match(/<script id="signal-export-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  for(const entry of data){const issue=parseIssue(await fs.readFile(path.join(ROOT,'content/issues',entry.date+'.md'),'utf8'));assert.equal(issue.markdown,entry.markdown);assert.equal(issue.title,entry.title);assert.equal(issue.status,entry.status);assert.equal(issue.verified,entry.verified);}
});
test('append is immutable, sorted and transactionally keeps previous archives',async t=>{
  const root=await sandbox(t),before=await buildIndex(root,{check:true}),issue=fixture();
  await appendIssue(issue,root);const after=await buildIndex(root,{check:true});assert.equal(after.issues.length,before.issues.length+1);
  assert.deepEqual(after.issues.slice(0,5),before.issues);
  await assert.rejects(appendIssue({...issue,markdown:'overwrite'},root));
  await assert.rejects(appendIssue(issue,root),{code:'EEXIST'});
  await fs.unlink(path.join(root,'content/issues/2026-10-28.md'));await assert.rejects(buildIndex(root),/历史迁移档案丢失/);
});
test('reject empty, incomplete, fake verified, future, stale and unlisted content',()=>{
  for(const patch of [{markdown:''},{complete:false},{verified:true},{verification:'verified'},{date:'2099-02-30'},{public_approved:false},{sources:[]},{markdown:fixture().markdown.replace('## 专题 09','## 删去 09')},{markdown:fixture().markdown+'\n[伪来源](https://www.un.org/unknown)'}])assert.throws(()=>validateIssue({...fixture(),...patch}));
  assert.throws(()=>validateIssue({...fixture(),sources:fixture().sources.map(s=>({...s,published_date:'2020-01-01'}))}));
  assert.throws(()=>privacyCheck('家庭经营病历'));assert.throws(()=>privacyCheck('test@example.com'));
  for(const url of ['http://www.un.org/a','https://un.org.attacker.test/a','https://127.0.0.1/','https://u:p@www.un.org/'])assert.throws(()=>publicUrl(url));
});
test('sources require accessible articles with matching, recent timestamp metadata',async()=>{
  const checked=await checkSources(fixture(),{fetcher:mockFetch});assert.equal(checked.verification,'unverified');
  assert.equal(checked.sources[0].check_status,'link-and-date-checked');
  await assert.rejects(checkSources(fixture(),{fetcher:async()=>new Response('no published date',{headers:{'content-type':'text/html'}})}));
  await assert.rejects(checkSources(fixture(),{fetcher:async()=>new Response('<meta name="date" content="2026-10-23T12:00:00+08:00">',{headers:{'content-type':'text/html'}})}));
  await assert.rejects(fetchSource('https://www.un.org/a',{fetcher:async()=>new Response('',{status:302,headers:{location:'http://127.0.0.1'}})}));
  let attempts=0;await fetchSource('https://www.un.org/a',{sleep:async()=>{},fetcher:async(...args)=>{if(++attempts<3)return new Response('',{status:503});return mockFetch(...args)}});assert.equal(attempts,3);
});
test('manual import dry-run, real append, duplicate rerun and validation failure',async t=>{
  const root=await sandbox(t),report=serializeIssue(fixture()),commits=[];
  const options={root,mode:'import',date:'2026-10-23',report,confirmPublic:true,check:i=>checkSources(i,{fetcher:mockFetch}),commit:async(...c)=>commits.push(c)};
  await publish(options);assert.equal((await buildIndex(root,{check:true})).issues.length,5);assert.equal(commits.length,0);
  const bad={...options,report:report.replace('"complete": true','"complete": false'),dryRun:false};await assert.rejects(publish(bad));assert.equal(commits.length,0);
  const result=await publish({...options,dryRun:false});assert.equal(result.published,true);assert.equal(commits.length,1);
  assert.equal((await publish({...options,dryRun:false})).duplicate,true);assert.equal(commits.length,1);
});
test('billing reservation is durable before the single API call, reruns do not repay',async t=>{
  const root=await sandbox(t),events=[],now=new Date('2026-10-29T10:00:00+08:00');
  const opts={root,mode:'generate',date:'2026-10-29',now,dryRun:false,apiEnabled:true,apiKey:'TEST_ONLY',commit:async()=>events.push('reserved-on-remote'),generate:async()=>{events.push('API');throw new Error('mock network failure')}};
  await assert.rejects(publish({...opts,apiEnabled:false}));assert.deepEqual(events,[]);
  await assert.rejects(publish(opts));assert.deepEqual(events,['reserved-on-remote','API']);
  await assert.rejects(publish(opts),/当天已有付费尝试/);assert.deepEqual(events,['reserved-on-remote','API']);
  assert.equal((await buildIndex(root,{check:true})).issues.length,5);
  await fs.rm(path.join(root,'.automation'),{recursive:true});
  await assert.rejects(publish({...opts,commit:async()=>{throw new Error('push denied')}}));assert.equal(events.filter(x=>x==='API').length,1);
});
test('budget, API limits and missing/incomplete responses fail closed',async()=>{
  const ledger={attempts:Array.from({length:32},(_,n)=>({date:`2026-10-${n+1}`,billing_month:'2026-10',reserved_usd:0.25}))};
  assert.throws(()=>reserveBudget(ledger,'2026-10-29',new Date('2026-10-29')));
  const request=requestBody('2026-10-29');assert.equal(request.max_tool_calls,8);assert.equal(request.max_output_tokens,12000);assert.equal(request.store,false);assert.equal(request.tool_choice,'required');
  let calls=0;await assert.rejects(generateIssue('2026-10-29',{apiKey:'TEST_ONLY',fetcher:async()=>{calls++;throw new Error('network')}}));assert.equal(calls,1);
  await assert.rejects(generateIssue('2026-10-29',{fetcher:async()=>{calls++;}}));assert.equal(calls,1);
  assert.throws(()=>responseToIssue({status:'incomplete'},'2026-10-29'));
});
test('a complete API response uses actual search sources and preserves unverified status',async()=>{
  const date='2026-10-23',issue=fixture(date),now=new Date(date+'T09:10:00+08:00');
  const data={sources:issue.sources,news:config.domains.map((_,n)=>({text:n<3?'仅供测试的合成资料，不能作为新闻发布。'.repeat(4):'本期未取得可核实新增资料；不代表没有变化。',source_indices:n<3?[n]:[]})),topics:config.topics.map(()=>({text:'本期未取得可核实新增资料；不代表没有变化。',source_indices:[]}))};
  const response={status:'completed',usage:{input_tokens:1000,output_tokens:2000},output:[{type:'web_search_call',action:{type:'search',sources:issue.sources}},{type:'message',content:[{type:'output_text',text:JSON.stringify(data),annotations:[]}]}]};
  const generated=await generateIssue(date,{apiKey:'TEST_ONLY',now,fetcher:async(_url,options)=>{assert.equal(JSON.parse(options.body).model,config.model);return Response.json(response)}});
  assert.equal(generated.verification,'unverified');assert.equal(generated.verified,false);assert.equal(generated.sources.length,3);
  const extra=structuredClone(response);extra.output[1].content[0].text=JSON.stringify({...data,sources:[...data.sources,{...data.sources[0],url:'https://www.un.org/not-searched'}]});assert.throws(()=>responseToIssue(extra,date,now),/实际检索记录/);
});
test('manual dispatcher check runs without secrets, API requests or writes',async()=>{
  const before=hash(await fs.readFile(path.join(ROOT,'content/index.json'),'utf8'));
  const output=execFileSync(process.execPath,['scripts/publish.mjs','--mode','check'],{cwd:ROOT,encoding:'utf8',env:{...process.env,SIGNAL_DRY_RUN:'true',OPENAI_API_KEY:''}});
  assert.equal(JSON.parse(output.trim().split('\n').at(-1)).ready,false);
  assert.equal(hash(await fs.readFile(path.join(ROOT,'content/index.json'),'utf8')),before);
});
