// Portable consistent snapshot. Never overwrites a library or a previous backup.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync,backup} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {containedFile,dataDirectory,databaseFile} from './data-paths.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function backupPrivate(source,target){
  if(!path.isAbsolute(target)||fs.existsSync(target))throw Error('备份目标必须是不存在的绝对目录');
  fs.mkdirSync(target,{recursive:true,mode:0o700});
  const sourceDB=new DatabaseSync(databaseFile(source),{readOnly:true});
  try{await backup(sourceDB,databaseFile(target));}finally{sourceDB.close();}
  const db=new DatabaseSync(databaseFile(target));
  try{
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('数据库完整性检查失败');
    const files=[];
    for(const row of db.prepare('SELECT * FROM media_assets ORDER BY url').all()){
      const from=containedFile(path.join(source,'public'),row.relative_path),to=containedFile(path.join(target,'public'),row.relative_path),bytes=fs.readFileSync(from);
      if(sha(bytes)!==row.sha256)throw Error('资源校验失败：'+row.url);
      fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});fs.writeFileSync(to,bytes,{flag:'wx',mode:0o600});files.push({path:row.relative_path,sha256:row.sha256});
    }
    const receipt={format:'yixu-private-backup',version:2,createdAt:new Date().toISOString(),revision:Number(db.prepare("SELECT value FROM metadata WHERE key='revision'").get()?.value||0),files};
    fs.writeFileSync(path.join(target,'backup-receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});return {target,revision:receipt.revision,files:files.length};
  }finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await backupPrivate(dataDirectory(),process.argv[2]),null,2));
