const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright');
(async () => {
  const source = fs.readFileSync('index.html', 'utf8');
  const embedded = JSON.parse(source.match(/<script id="signal-export-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(embedded.length, 5);
  assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(embedded)).digest('hex'),'87d934ce453c1b55af8e280d200b3728c7e3346aa59a5a7353cd9ec9722914cb', 'Existing archive text must remain intact');
  const server = http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(source)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {});
  try {
    const page = await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const url=`http://127.0.0.1:${server.address().port}/signal-global-radar/`;
    await page.goto(url);
    assert.equal(await page.evaluate(()=>TOPICS.length),9);
    assert.equal(await page.evaluate(()=>DOMAINS.length),10);
    assert.deepEqual(await page.evaluate(()=>readEmbedded()),embedded);
    const routes=['/','/topics','/archive','/healthcare','/about','/editor','/issue/2026-10-28',...await page.evaluate(()=>TOPICS.map(t=>'/topic/'+t.slug))];
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      for(const route of routes){
        await page.goto(url+'#'+route);
        await page.waitForSelector('#app h1',{timeout:3000}).catch(e=>{throw new Error(`${width} ${route}: ${errors.join('; ')} ${e.message}`)});
        assert(!await page.locator('#app').innerText().then(s=>s.includes('没有找到对应内容')),route);
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${width} ${route}`);
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto(url+'#/topics');
    await page.click('#menuToggle');assert.equal(await page.getAttribute('#menuToggle','aria-expanded'),'true');
    await page.keyboard.press('Escape');assert.equal(await page.getAttribute('#menuToggle','aria-expanded'),'false');
    await page.goto(url+'#/topic/economics');
    await page.click('.side-card a[href*="item=1"]');
    assert.equal(await page.locator('#item-1 h2').innerText(),'02｜供给与需求');
    assert((await page.locator('#item-1').boundingBox()).y>=64);
    await page.goto(url+'#/%E0%A4%A');assert.match(await page.locator('#app').innerText(),/没有找到/);
    await page.goto(url+'#/editor');
    await page.fill('#issueDate','2026-10-29');await page.fill('#issueTitle','LOCAL ONLY');await page.fill('#issueMarkdown','LOCAL_ONLY_TEST');await page.click('#saveBtn');
    const exportData=async()=>page.evaluate(()=>{let result;const original=download;download=(_,body)=>result=body;exportHtml();download=original;return result});
    let exported=await exportData();assert(!exported.includes('LOCAL_ONLY_TEST'));
    assert.deepEqual(JSON.parse(exported.match(/<script id="signal-export-data"[^>]*>([\s\S]*?)<\/script>/)[1]),embedded);
    await page.check('#publicExport');await page.fill('#issueMarkdown','PUBLIC_TEST <tag> & </script>');await page.click('#saveBtn');
    exported=await exportData();const data=JSON.parse(exported.match(/<script id="signal-export-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.length,6);assert.equal(data[0].markdown,'PUBLIC_TEST <tag> & </script>');
    const fresh=await browser.newPage();await fresh.route('**/*',r=>r.fulfill({contentType:'text/html',body:exported}));await fresh.goto('http://export.test/#/issue/2026-10-29');assert.match(await fresh.locator('#app').innerText(),/PUBLIC_TEST <tag> & <\/script>/);await fresh.close();
    assert(!exported.includes('LOCAL_ONLY_TEST'));assert(!exported.includes('PUBLIC_TEST <tag>'));
    await page.evaluate(()=>localStorage.setItem('signal_issues_v1',JSON.stringify([null,{date:'2026-10-28',title:'STALE',markdown:'STALE',updated_at:'2020-01-01'}])));
    await page.reload();assert.equal(await page.evaluate(()=>issues.find(i=>i.date==='2026-10-28').title),embedded[0].title);
    assert.equal(await page.evaluate(()=>validIssue({date:'2026-02-30',title:'x',markdown:'x'})),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: 80 responsive route checks, navigation, archive preservation, malformed URLs/storage, export privacy and JSON round-trip.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
