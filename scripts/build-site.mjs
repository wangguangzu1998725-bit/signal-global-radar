import fs from 'node:fs/promises';
import path from 'node:path';
import {ROOT,buildIndex} from './content.mjs';
await buildIndex(ROOT,{check:true});
// Explicit allowlist: keys, local drafts, developer tools and ledgers never ship.
const output=path.join(ROOT,'_site');
if(path.dirname(path.resolve(output))!==path.resolve(ROOT)||path.basename(output)!=='_site')throw new Error('非法构建输出路径');
try {if((await fs.lstat(output)).isSymbolicLink())throw new Error('构建目录不能是符号链接');}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.rm(output,{recursive:true,force:true});
await fs.mkdir(output,{recursive:true});
for(const name of ['index.html','.nojekyll'])await fs.copyFile(path.join(ROOT,name),path.join(output,name));
await fs.cp(path.join(ROOT,'content'),path.join(output,'content'),{recursive:true});
try {await fs.copyFile(path.join(ROOT,'CNAME'),path.join(output,'CNAME'));}catch(e){if(e.code!=='ENOENT')throw e;}
console.log('静态站点构建完成：_site');
