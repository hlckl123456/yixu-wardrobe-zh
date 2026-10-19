// Restore to a NEW directory only; never silently overwrite post-cutover edits.
import fs from 'node:fs';
import path from 'node:path';
import {backupPrivate} from './backup-private.mjs';
const [source,target]=process.argv.slice(2);
if(!source||!path.isAbsolute(source)||!fs.existsSync(path.join(source,'backup-receipt.json')))throw Error('请指定已校验的私人备份目录');
console.log(JSON.stringify(await backupPrivate(source,target),null,2));
console.log('恢复副本已验证。原衣橱未修改。核对后停止原服务，再用 YIXU_DATA_DIR 指向此新目录；不能无声覆盖现用数据。');
