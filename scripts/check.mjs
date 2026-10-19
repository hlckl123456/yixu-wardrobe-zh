import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {containedFile} from './data-paths.mjs';
import {inspectPNG} from './intake.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
for(const file of ['dist/index.html','dist/workspace.js','dist/data-schema.js','scripts/relational-store.mjs'])assert(fs.existsSync(path.join(root,file)));
const index=process.argv.indexOf('--data-dir');
if(index>=0){
  const dir=path.resolve(process.argv[index+1]),db=new DatabaseSync(path.join(dir,'wardrobe.sqlite'),{readOnly:true});
  try{
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    for(const asset of db.prepare('SELECT * FROM media_assets').all()){
      const bytes=fs.readFileSync(containedFile(path.join(dir,'public'),asset.relative_path));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.url);
    }
    for(const row of db.prepare('SELECT asset_url FROM garment_versions WHERE version=-1').all())inspectPNG(fs.readFileSync(containedFile(path.join(dir,'public'),row.asset_url)));
    console.log('SQLite integrity, foreign keys, all registered hashes and current cutout alpha verified.');
  }finally{db.close();}
}else console.log('Application source verified. Use --data-dir /absolute/private/directory for private integrity checks.');
