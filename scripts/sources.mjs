import { publicUrl } from './content.mjs';

// Never follow an unchecked redirect; only publicly trusted domains are reachable.
export async function fetchSource(url, { fetcher = fetch, sleep = ms => new Promise(r=>setTimeout(r,ms)) } = {}) {
  let current = publicUrl(url);
  for (let redirects=0; redirects<5; redirects++) {
    let response;
    for (let attempt=0; attempt<3; attempt++) {
      try {
        response = await fetcher(current, {redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'User-Agent':'SIGNAL-source-check/1.0'}});
        if (response.status !== 429 && response.status < 500) break;
      } catch(e) { if(attempt===2) throw new Error('来源访问超时'); }
      if(attempt<2) await sleep(500 * 2**attempt);
    }
    if ([301,302,303,307,308].includes(response.status)) {
      current = publicUrl(new URL(response.headers.get('location'), current).href); continue;
    }
    if (!response.ok || !/(text\/html|application\/(?:ld\+)?json|application\/xml|text\/xml)/i.test(response.headers.get('content-type')||'')) throw new Error('来源链接不可读或格式不支持');
    const reader = response.body.getReader(); let bytes=0, chunks=[];
    try { while(true) {const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2000000)throw new Error('来源页面过大');chunks.push(value);} }
    finally {await reader.cancel();}
    return {url:current,text:Buffer.concat(chunks).toString('utf8')};
  }
  throw new Error('来源重定向过多');
}
export function publishedTimes(html) {
  const dates=[];
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs=Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1].toLowerCase(),m[2]]));
    if (/^(article:published_time|datepublished|pubdate|publishdate|date)$/i.test(attrs.property||attrs.name||'')) dates.push(attrs.content);
  }
  for(const m of html.matchAll(/["']datePublished["']\s*:\s*["']([^"']+)["']/gi))dates.push(m[1]);
  return dates.filter(d=>typeof d==='string' && Number.isFinite(Date.parse(d)));
}
export async function checkSources(issue, options = {}) {
  const cutoff=Date.parse(issue.date+'T09:00:00+08:00');
  const checked=[];
  for(const source of issue.sources) {
    const page=await fetchSource(source.url, options);
    const dates=publishedTimes(page.text);
    const published=dates.find(d=>d.slice(0,10)===source.published_date);
    if(!published) throw new Error('来源网页发布日期无法与清单交叉核对');
    // Date-only metadata is insufficient to establish the 09:00 cutoff.
    if(!source.historical && (!/T\d\d:\d\d.*(?:Z|[+-]\d\d:?\d\d)$/i.test(published) ||
        Date.parse(published)>cutoff || Date.parse(published)<cutoff-48*3600000)) throw new Error('来源时间不在09:00截止前48小时内，或缺少时区');
    checked.push({...source,check_status:'link-and-date-checked',checked_at:new Date().toISOString()});
  }
  return {...issue,sources:checked,verification:'unverified',verified:false};
}
