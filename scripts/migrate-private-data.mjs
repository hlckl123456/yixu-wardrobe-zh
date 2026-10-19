// One-time, explicit v1 checkout -> private SQLite v2 migration. No source deletion.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRelationalStore} from './relational-store.mjs';

export async function migratePrivateData({source,target,database}){
  if(!path.isAbsolute(source)||!path.isAbsolute(target)||target.startsWith(source+path.sep))throw Error('明确指定仓库外的绝对路径');
  if(fs.existsSync(target))throw Error('目标已存在；请核对已有迁移，不覆盖重试');
  fs.mkdirSync(target,{recursive:true,mode:0o700});
  const catalog=JSON.parse(fs.readFileSync(path.join(source,'dist/data/catalog.json')));
  const documents={
    'reference-catalog':(await import(pathToFileURL(path.join(source,'dist/data/reference-catalog.js')).href)).default,
    guides:JSON.parse(fs.readFileSync(path.join(source,'dist/data/guides.json'))),
    thumbnails:(await import(pathToFileURL(path.join(source,'dist/thumbnail-manifest.js')).href)).thumbnails,
    preferences:{workflowHistory:fs.readFileSync(path.join(source,'AGENTS.md'),'utf8'),migratedAt:new Date().toISOString()}
  };
  const assets=[];
  function copyTree(relative){
    const from=path.join(source,'dist',relative),to=path.join(target,'public',relative);
    if(fs.statSync(from).isDirectory()){
      fs.mkdirSync(to,{recursive:true,mode:0o700});
      for(const name of fs.readdirSync(from))if(!name.startsWith('.'))copyTree(path.posix.join(relative,name));
    }else{
      const bytes=fs.readFileSync(from);fs.writeFileSync(to,bytes,{flag:'wx',mode:0o600});assert.deepEqual(fs.readFileSync(to),bytes);
      assets.push({url:relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),kind:relative.startsWith('reviews/')?'review':'media'});
    }
  }
  for(const section of ['assets','reviews'])if(fs.existsSync(path.join(source,'dist',section)))copyTree(section);
  const db=new DatabaseSync(database,{readOnly:true});
  const before={outfits:db.prepare('SELECT data FROM outfits ORDER BY position').all().map(r=>JSON.parse(r.data)),notes:db.prepare('SELECT * FROM notes').all(),meta:db.prepare('SELECT * FROM metadata').all(),imports:db.prepare('SELECT * FROM imports').all(),commands:db.prepare('SELECT * FROM commands').all(),curation:db.prepare('SELECT * FROM formula_preferences').all()};
  await backup(db,path.join(target,'wardrobe.sqlite'));db.close();
  const store=createRelationalStore(path.join(target,'wardrobe.sqlite'),{catalog,documents,assets,mediaRoot:path.join(target,'public')});
  try{
    assert.deepEqual(store.catalog(),catalog);assert.deepEqual(store.read().data.outfits,before.outfits);
    assert.equal(store.integrity(),'ok');assert.deepEqual(store.foreignKeys(),[]);
    const sql=store.fullBackup().tables;
    for(const [key,table] of [['notes','notes'],['imports','imports'],['commands','commands'],['curation','formula_preferences']])assert.deepEqual(sql[table],before[key]);
    for(const row of before.meta.filter(r=>r.key!=='outfit_codes'))assert.deepEqual(sql.metadata.find(r=>r.key===row.key),row);
    const receipt={version:2,source,target,createdAt:new Date().toISOString(),garments:catalog.items.length,outfits:before.outfits.length,edges:store.read().relationships.garments.length,origins:store.read().relationships.origins.length,assets:assets.length,revision:store.read().revision,foreignKeys:'ok',integrity:'ok'};
    fs.writeFileSync(path.join(target,'migration-receipt.json'),JSON.stringify(receipt,null,2),{flag:'wx',mode:0o600});
    return receipt;
  }finally{store.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [source,target,database]=process.argv.slice(2);console.log(JSON.stringify(await migratePrivateData({source,target,database}),null,2));
}
