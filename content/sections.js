/* One parser for DAILY, TOPICS, ARCHIVE, index generation and validation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SignalContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PRIVATE_PLACEHOLDER = '本公开版不收录家庭医药私人资料；私密版独立存储，不参与公开归档。';
  function headings(markdown) {
    const lines=String(markdown||'').replace(/\r\n/g,'\n').split('\n');
    const result=[];let fence=null;
    for(let n=0;n<lines.length;n++) {
      const code=lines[n].match(/^\s*(`{3,}|~{3,})/);
      if(code){if(!fence)fence=code[1][0];else if(fence===code[1][0])fence=null;continue;}
      const m=!fence&&lines[n].match(/^(#{1,6})\s+(.+?)\s*$/);
      if(m)result.push({level:m[1].length,title:m[2],line:n});
    }
    return result.map((h,n)=>{
      const next=result.slice(n+1).find(other=>other.level<=h.level);
      return {...h,markdown:lines.slice(h.line+1,next?next.line:lines.length).join('\n').trim()};
    });
  }
  function exact(blocks,title){return blocks.find(b=>b.title===title);}
  const plain=text=>String(text||'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*#>`]/g,'').trim();
  function stateOf(markdown) {
    if(!markdown?.trim())return 'missing';
    if(markdown.trim()===PRIVATE_PLACEHOLDER)return 'private-excluded';
    if(/待补录|未取得.*(?:资料|来源)|无可靠(?:资料|来源)|本期尚无已逐条核实的新增政策/.test(markdown))return 'gap';
    return 'content';
  }
  function topics(issue,taxonomy) {
    const blocks=headings(issue.markdown);
    const legacyMap={ai:/^01 AI、科技与机器人$/,business:/^02 商业创新与创业$/,economics:/^03 经济逻辑与金融基础/,healthcare:/^05 医药、医保与药房政策$/,design:/^06 建筑、城市与设计$/,trends:/^07 全球重要变化与长期趋势$/};
    const art=issue.legacy?blocks.find(b=>b.level===3&&b.title==='04 艺术与创作研究'):null;
    return taxonomy.topics.map(topic=>{
      let block=exact(blocks,`专题 ${topic.num}｜${topic.name}`),body=block?.markdown||'',mapping='canonical';
      if(!block&&issue.legacy) {
        block=blocks.find(b=>b.level===3&&legacyMap[topic.slug]?.test(b.title));body=block?.markdown||'';mapping='legacy-explicit';
        if(art&&['artists','art-break'].includes(topic.slug)) {
          const first=art.markdown.indexOf('**艺术家研究：**'),second=art.markdown.indexOf('**艺术认知破圈：**');
          if(first>=0&&second>first){block=art;body=topic.slug==='artists'?art.markdown.slice(first,second).trim():art.markdown.slice(second).trim();mapping='legacy-art-split';}
        }
      }
      const urls=[...body.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>m[1]);
      return {slug:topic.slug,date:issue.date,id:'research-'+topic.slug,heading:block?.title||null,markdown:body,state:stateOf(body),mapping,
        sources:(issue.sources||[]).filter(s=>urls.includes(s.url))};
    });
  }
  function daily(issue,taxonomy) {
    const blocks=headings(issue.markdown),world=exact(blocks,'世界速览'),focus=exact(blocks,'重点新闻'),analysis=exact(blocks,'深度分析');
    const legacyFocus=issue.legacy?blocks.find(b=>b.level===2&&b.title==='02｜今日重点议题（待逐条核验）'):null;
    const highlights=focus?headings(focus.markdown).filter(b=>b.level===3):legacyFocus?legacyFocus.markdown.split('\n').filter(l=>l.startsWith('- ')).map((l,n)=>({title:String(n+1),markdown:l.slice(2)})):[];
    const legacyWorld=issue.legacy?blocks.find(b=>b.title==='01｜全球新闻十领域'):null;
    const excerpt=world?.markdown||(legacyWorld?.markdown.split('\n').slice(0,3).join('\n'))||issue.markdown.split('\n').filter(l=>l&&!l.startsWith('#')).slice(0,2).join('\n');
    return {world:world?.markdown||'',summary:plain(excerpt).slice(0,260),highlights,
      analysis:analysis?.markdown||(issue.legacy?blocks.find(b=>b.title==='03｜深度分析')?.markdown:'')||'',topics:topics(issue,taxonomy)};
  }
  return {PRIVATE_PLACEHOLDER,headings,plain,stateOf,topics,daily};
});
