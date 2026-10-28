import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,buildIndex} from './content.mjs';
export async function buildSite(root=ROOT){
const index=await buildIndex(root,{check:true});
// Explicit allowlist: keys, local drafts, developer tools and ledgers never ship.
const output=path.join(root,'_site');
if(path.dirname(path.resolve(output))!==path.resolve(root)||path.basename(output)!=='_site')throw new Error('非法构建输出路径');
try {if((await fs.lstat(output)).isSymbolicLink())throw new Error('构建目录不能是符号链接');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
for(const name of ['index.html','.nojekyll'])await fs.copyFile(path.join(root,name),path.join(output,name));
await fs.mkdir(path.join(output,'content/issues'),{recursive:true});
for(const name of ['index.json','taxonomy.json','sections.js'])await fs.copyFile(path.join(root,'content',name),path.join(output,'content',name));
for(const issue of index.issues)await fs.copyFile(path.join(root,'content',issue.file),path.join(output,'content',issue.file));
try {await fs.copyFile(path.join(root,'CNAME'),path.join(output,'CNAME'));}catch(e){if(e.code!=='ENOENT')throw e;}
return output;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){await buildSite();console.log('静态站点构建完成：_site');}
