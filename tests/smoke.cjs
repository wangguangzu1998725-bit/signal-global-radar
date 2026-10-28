const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
(async () => {
  const source = fs.readFileSync('index.html','utf8');
  assert(!source.includes('id="signal-export-data"'),'News must live outside index.html');
  const index=JSON.parse(fs.readFileSync('content/index.json','utf8'));
  const published=index.issues.filter(i=>i.status==='published');
  const errors=[];
  const server=http.createServer((req,res)=>{
    const relative=decodeURIComponent(req.url.split('?')[0]).replace(/^\/signal-global-radar\//,'');
    const file=path.resolve(relative||'index.html');
    if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403);res.end();return;}
    try {res.setHeader('Content-Type',file.endsWith('.json')?'application/json':file.endsWith('.md')?'text/plain; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(file));}
    catch {res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try {
    browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/signal-global-radar/`;
    await page.goto(url);await page.waitForSelector('#app h1');
    assert.equal(await page.locator('header .nav > a').count(),3);assert.match(await page.locator('header .nav').innerText(),/01 DAILY/);assert.equal(await page.evaluate(()=>TOPICS.length),9);assert.equal(await page.evaluate(()=>DOMAINS.length),10);
    assert.equal(await page.evaluate(()=>currentIssues()[0].date),published[0].date);
    assert((await page.evaluate(()=>currentIssues()[0].markdown)).length>100);
    const routes=['/','/topics','/archive','/healthcare','/about','/editor','/issue/'+published[0].date,...await page.evaluate(()=>TOPICS.map(t=>'/topic/'+t.slug))];
    for(const width of [320,390,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      for(const route of routes) {
        await page.goto(url+'#'+route);await page.waitForSelector('#app h1',{timeout:5000});
        assert(!await page.locator('#app').innerText().then(s=>s.includes('没有找到对应内容')),route);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${width} ${route}`);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(url+'#/');await page.waitForSelector('details.article');await page.locator('details.article summary').click();assert(await page.locator('details.article .markdown').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.goto(url+'#/topics');await page.click('#menuToggle');assert.equal(await page.getAttribute('#menuToggle','aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await page.getAttribute('#menuToggle','aria-expanded'),'false');
    await page.goto(url+'#/topic/artists');await page.waitForSelector('[data-topic-history="artists"] .article');assert.match(await page.locator('[data-topic-history="artists"]').innerText(),/Christina Kubisch/);await page.click('[data-topic-history="artists"] a[href^="#\/research\/"]');await page.waitForSelector('.page-head h1');assert.match(await page.locator('.issue-content').innerText(),/Christina Kubisch/);assert(!await page.locator('.issue-content').innerText().then(s=>s.includes('Agnes Denes')));await page.click('a[href*="section=research-artists"]');await page.waitForSelector('#research-artists',{state:'attached'});assert((await page.locator('#research-artists').boundingBox()).y>=64);await page.goto(url+'#/topic/economics');await page.click('.side-card a[href*="item=1"]');assert.equal(await page.locator('#item-1 h2').innerText(),'02｜供给与需求');assert((await page.locator('#item-1').boundingBox()).y>=64);
    await page.goto(url+'#/archive');await page.fill('#archiveDate','2026-10-28');await page.waitForSelector('.issue-content');assert.match(await page.locator('.page-head').innerText(),/2026-10-28/);await page.goto(url+'#/archive');await page.fill('#archiveSearch','Electrical Walks');await page.waitForSelector('.archive-item');assert.match(await page.locator('#archiveResults').innerText(),/2026-10-28/);
    await page.fill('#archiveSearch','NO_SUCH_KEYWORD_987');await page.waitForSelector('.empty-issue');
    await page.goto(url+'#/%E0%A4%A');assert.match(await page.locator('#app').innerText(),/没有找到/);
    await page.goto(url+'#/editor');await page.fill('#issueDate','2026-10-23');await page.fill('#issueTitle','LOCAL ONLY');await page.fill('#issueMarkdown','LOCAL_ONLY_TEST');await page.click('#saveBtn');
    const exported=()=>page.evaluate(()=>{let result;const original=download;download=(_,body)=>result=body;exportHtml();download=original;return result});
    assert.equal(await exported(),undefined);await page.check('#publicExport');await page.click('#saveBtn');
    const markdown=await exported();assert(markdown.startsWith('---\n'));assert(markdown.includes('LOCAL_ONLY_TEST'));assert(markdown.includes('"complete": false'));
    assert(!await page.evaluate(()=>currentIssues().some(i=>i.date==='2026-10-23')),'Local drafts cannot become homepage publications');
    await page.fill('#issueDate','2026-10-28');await page.fill('#issueMarkdown','OVERWRITE_TEST');await page.click('#saveBtn');assert.match(await page.locator('#toast').innerText(),/不能覆盖/);
    await page.evaluate(()=>localStorage.setItem('signal_issues_v1',JSON.stringify([null,{date:'2026-10-28',title:'STALE',markdown:'STALE',updated_at:'2099-01-01'}])));await page.reload();await page.waitForSelector('#app h1');assert.notEqual(await page.evaluate(()=>issues.find(i=>i.date==='2026-10-28').title),'STALE');
    // Unavailable index retains cached public content and working navigation.
    await page.route('**/content/index.json',r=>r.fulfill({status:503,body:'unavailable'}));await page.reload();await page.waitForSelector('#app h1');assert(await page.evaluate(()=>currentIssues().length>0));await page.goto(url+'#/');await page.waitForSelector('.hero-title');assert.match(await page.locator('#app').innerText(),/公开档案暂时无法加载/);await page.unroute('**/content/index.json');
    // A newly added standalone issue becomes latest without changing index.html.
    const virtual=(date,token)=>{const body='# 浏览器测试夹具\n\n不是新闻。\n\n## 专题 01｜AI、科技与机器人\n\n'+token+'：临时测试案例，禁止公开作为新闻。';const text='---\n'+JSON.stringify({date,title:'临时浏览器测试夹具'})+'\n---\n'+body;return {text,entry:{date,title:'临时浏览器测试夹具',status:'published',verification:'unverified',file:'issues/'+date+'.md',sha256:crypto.createHash('sha256').update(text).digest('hex'),sources:[],topics:[{slug:'ai',id:'research-ai',state:'content'}]}}};
    const first=virtual('2099-12-31','NEW_CASE_FIXTURE'),second=virtual('2099-12-30','OLDER_CASE_FIXTURE'),virtuals=[first,second,...Array.from({length:11},(_,n)=>virtual('2099-12-'+(29-n),'HISTORY_CASE_FIXTURE_'+n))];
    await page.route('**/content/index.json',r=>r.fulfill({json:{schema_version:1,issues:[...virtuals.map(i=>i.entry),...index.issues]}}));for(const item of virtuals)await page.route('**/content/'+item.entry.file,r=>r.fulfill({body:item.text}));
    await page.goto(url+'#/');await page.reload();await page.waitForSelector('details.article');assert.equal(await page.evaluate(()=>currentIssues()[0].date),first.entry.date);await page.goto(url+'#/issue/'+first.entry.date);await page.waitForSelector('.issue-content');assert.match(await page.locator('.issue-content').innerText(),/不是新闻/);
    await page.goto(url+'#/topic/ai');await page.waitForSelector('[data-topic-history="ai"] .article');const cases=await page.locator('[data-topic-history="ai"] .article').allTextContents();assert.equal(cases.length,12);assert.match(cases[0],/NEW_CASE_FIXTURE/);assert.match(cases[1],/OLDER_CASE_FIXTURE/);await page.click('[data-topic-history="ai"] .article:first-of-type a[href^="#/research/"]');await page.waitForSelector('.issue-content');assert.match(await page.locator('.issue-content').innerText(),/NEW_CASE_FIXTURE/);assert(!await page.locator('.issue-content').innerText().then(s=>s.includes('OLDER_CASE_FIXTURE')));
    await page.goto(url+'#/topic/ai');await page.getByRole('link',{name:'更早研究',exact:true}).click();await page.waitForSelector('#topic-2099-12-19');assert.equal(await page.locator('[data-topic-history="ai"] .article').count(),1);assert.match(await page.locator('#topic-2099-12-19').innerText(),/HISTORY_CASE_FIXTURE_10/);
    assert.deepEqual(errors,[]);
    console.log('PASS: 80 responsive route checks; standalone issue loading, latest/archive search, navigation, immutable public archives, local draft isolation, shared topic research, pagination and cached failure fallback.');
  } finally {if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
