import {execFileSync} from 'node:child_process';
import {ROOT} from './content.mjs';
const base=process.env.SIGNAL_BASE_REF||'origin/main';
const changes=execFileSync('git',['diff','--name-status',base,'--','content/issues','content/legacy-manifest.json'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(changes.some(line=>!line.startsWith('A\t')))throw new Error('历史档案或迁移清单被更改/删除，请改为新增更正说明，不覆盖旧文');
console.log('与目标分支比较：历史档案只增不减');
