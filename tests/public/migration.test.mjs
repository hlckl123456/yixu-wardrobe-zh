import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRelationalStore} from '../../scripts/relational-store.mjs';
import {syntheticSeed} from '../../scripts/synthetic-data.mjs';
import {createBackup} from '../../dist/backup-model.js';

function legacy(t,invalid=false){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-v1-test-')),file=path.join(dir,'wardrobe.sqlite');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const seed=syntheticSeed(dir);
  const db=new DatabaseSync(file);db.exec(`CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE outfits(id TEXT PRIMARY KEY,position INTEGER NOT NULL,data TEXT NOT NULL);CREATE TABLE notes(id TEXT PRIMARY KEY,position INTEGER NOT NULL,data TEXT NOT NULL);CREATE TABLE formula_preferences(style_id TEXT PRIMARY KEY,state TEXT,season TEXT,position INTEGER);CREATE TABLE imports(fingerprint TEXT PRIMARY KEY,imported_at TEXT);CREATE TABLE commands(id TEXT PRIMARY KEY,fingerprint TEXT);PRAGMA user_version=1;`);
  const outfit={id:'old-look',title:'Old synthetic record',selection:{inner:invalid?'absent':'YW-0001'},code:'DP03',createdAt:'2020-01-01',unknownHistoricalField:{keep:true}};
  db.prepare('INSERT INTO outfits VALUES(?,?,?)').run(outfit.id,7,JSON.stringify(outfit));
  for(const [key,value] of Object.entries({revision:'9',initialized:'1',outfit_codes:JSON.stringify({'deleted-look':'DP02','old-look':'DP03'}),selections:JSON.stringify({owned:{inner:'YW-0001'}})}))db.prepare('INSERT INTO metadata VALUES(?,?)').run(key,value);
  db.prepare('INSERT INTO notes VALUES(?,?,?)').run('n',2,JSON.stringify({id:'n',title:'note',text:'exact 🙂'}));db.prepare('INSERT INTO imports VALUES(?,?)').run('legacy-fingerprint','2020');db.close();return {dir,file,seed,outfit};
}
test('v1 upgrade keeps metadata, opaque historical fields, aliases, positions and raw bytes',t=>{
  const {file,seed}=legacy(t);let store=createRelationalStore(file,seed);
  try{
    const before=store.read();assert.equal(before.revision,9);assert.equal(before.data.outfits[0].code,'DP03');assert.equal(before.relationships.garments.length,1);
    const tables=store.fullBackup().tables;assert.equal(tables.outfits[0].position,7);assert.deepEqual(JSON.parse(tables.outfits[0].data).unknownHistoricalField,{keep:true});assert.equal(tables.identities.find(i=>i.id==='deleted-look').code,'DP02');assert.equal(tables.imports[0].fingerprint,'legacy-fingerprint');
    store.close();store=createRelationalStore(file);assert.deepEqual(store.read(),before);assert.deepEqual(store.fullBackup().tables,tables);
  }finally{store.close();}
});
test('failed v1 upgrade rolls back schema and rows; no fabricated FK parents',t=>{
  const {file,seed,outfit}=legacy(t,true);assert.throws(()=>createRelationalStore(file,seed),/不存在/);
  const db=new DatabaseSync(file);try{assert.equal(db.prepare('PRAGMA user_version').get().user_version,1);assert.deepEqual(JSON.parse(db.prepare('SELECT data FROM outfits').get().data),outfit);assert.equal(db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='outfit_items'").get().n,0);}finally{db.close();}
});
test('image metadata and historical versions cannot disappear during an update',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-version-test-')),seed=syntheticSeed(dir),store=createRelationalStore(path.join(dir,'db.sqlite'),seed);store.initialize();t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});
  const before=store.catalog().items[0],other=store.catalog().items[1],history={assets:before.assets,provenance:before.provenance,reason:'synthetic version test'};
  const next={...before,assets:other.assets,provenance:other.provenance,imageHistory:[history]};
  store.commit({type:'upsert-garment',expected:before,record:next},crypto.randomUUID());assert.deepEqual(store.catalog().items[0],next);
  assert.throws(()=>store.commit({type:'upsert-garment',expected:next,record:{...next,imageHistory:[]}},crypto.randomUUID()),/历史不可丢失/);assert.deepEqual(store.catalog().items[0],next);
});
test('legacy backup merging preserves assumptions, notes, draft and alias reservations',t=>{
  const {file,seed}=legacy(t),store=createRelationalStore(file,seed);t.after(()=>store.close());
  const assumption={kind:'basic-tee',sleeve:'long',neckline:'crew',color:{name:'cream',hex:'#f0e5ba'},maxVisibleBandCm:2,exposure:'neckline only',provenance:'user-authorized-assumption'};
  const old=store.read().data.outfits[0],record={...old,assumedBasics:[assumption]};store.commit({type:'upsert-owned-outfit',record,expected:old},crypto.randomUUID());
  assert.deepEqual(store.read().data.outfits[0].assumedBasics,[assumption]);const before=store.read().data;
  store.commit({type:'import-backup',data:createBackup(before),options:{restoreDraft:true}},crypto.randomUUID());assert.deepEqual(store.read().data,before);
  assert.deepEqual(JSON.parse(store.fullBackup().tables.outfits[0].data).unknownHistoricalField,{keep:true});
  assert.throws(()=>store.commit({type:'upsert-owned-outfit',record:{...record,id:'bad',assumedBasics:[{...assumption,kind:'shirt'}]}},crypto.randomUUID()));
});
