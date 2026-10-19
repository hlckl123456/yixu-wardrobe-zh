import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRelationalStore} from '../../scripts/relational-store.mjs';
import {syntheticSeed} from '../../scripts/synthetic-data.mjs';
const run=(s,c)=>s.commit(c,crypto.randomUUID());
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-public-test-')),file=path.join(dir,'wardrobe.sqlite'),seed=syntheticSeed(dir),store=createRelationalStore(file,seed);store.initialize();t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return {store,dir,file,seed};}
const look=(id='look',extra={})=>({id,title:'合成示例',selection:{inner:'YW-0001',bottom:'YW-0002'},...extra});
test('swap positions preserves records and relationships, rejects stale requests and persists',t=>{
  const {store,file}=fixture(t);
  for(const id of ['a','b','c'])run(store,{type:'upsert-owned-outfit',record:look(id)});
  const before=store.read(),command={type:'swap-outfit-positions',records:[before.data.outfits[0],before.data.outfits[2]],expectedOrder:['a','b','c']};
  const requestId=crypto.randomUUID(),after=store.commit(command,requestId);
  assert.deepEqual(after.data.outfits,[before.data.outfits[2],before.data.outfits[1],before.data.outfits[0]]);
  assert.deepEqual(after.relationships,before.relationships);assert.equal(after.revision,before.revision+1);
  assert.deepEqual(store.commit(command,requestId),after);
  assert.throws(()=>run(store,command),/顺序已改变/);
  assert.throws(()=>run(store,{...command,expectedOrder:['c','b','a'],records:[command.records[0],command.records[0]]}),/不同/);
  assert.throws(()=>run(store,{...command,expectedOrder:['c','b','a'],records:[{...command.records[0],title:'stale'},command.records[1]]}),/已变化/);
  assert.deepEqual(store.read(),after);
  const reopened=createRelationalStore(file);try{assert.deepEqual(reopened.read(),after);}finally{reopened.close();}
});
test('normalized memberships and codes survive restart without dual JSON selection',t=>{
  const {store,file}=fixture(t);run(store,{type:'upsert-owned-outfit',record:look()});
  const second=createRelationalStore(file);try{assert.deepEqual(second.read(),store.read());assert.equal(second.catalog().items.length,3);}finally{second.close();}
  const db=new DatabaseSync(file,{readOnly:true});try{assert.equal(db.prepare('SELECT count(*) n FROM outfit_items').get().n,2);assert.equal(JSON.parse(db.prepare('SELECT data FROM outfits').get().data).selection,undefined);}finally{db.close();}
  assert.equal(store.read().data.outfits[0].code,'DP01');assert.equal(store.integrity(),'ok');assert.deepEqual(store.foreignKeys(),[]);
});
test('SQL rejects invalid links, duplicate slots, duplicate garments and identity edits',t=>{
  const {store,file}=fixture(t);run(store,{type:'upsert-owned-outfit',record:look()});const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON');
  try{
    for(const sql of ["INSERT INTO outfit_items VALUES('look','shoes','missing',4)","INSERT INTO outfit_items VALUES('look','inner','YW-0003',4)","INSERT INTO outfit_items VALUES('look','outer','YW-0001',4)","UPDATE identities SET code='SY99' WHERE id='YW-0001'","DELETE FROM identities WHERE id='YW-0001'","DELETE FROM garments WHERE id='YW-0001'"])assert.throws(()=>db.exec(sql));
  }finally{db.close();}
});
test('delete impact is explicit and atomic; aliases, image versions and descendants survive',t=>{
  const {store}=fixture(t);run(store,{type:'upsert-owned-outfit',record:look('parent')});run(store,{type:'upsert-owned-outfit',record:look('child',{derivedFromOutfitId:'parent'})});
  const garment=store.catalog().items[0],before=store.read();
  assert.throws(()=>run(store,{type:'remove-garments',records:[garment]}),/relatedOutfits/);assert.deepEqual(store.read(),before);
  run(store,{type:'remove-owned-outfits',records:[before.data.outfits[0]]});assert.equal(store.read().relationships.origins[0].available,0);assert.equal(store.read().relationships.origins[0].sourceCode,'DP01');
  run(store,{type:'remove-garments',records:[garment],relatedOutfits:store.read().data.outfits});assert.equal(store.catalog().items.length,2);assert.equal(store.catalog().codeRegistry[garment.id],garment.code);
  assert.equal(store.fullBackup().tables.garment_versions.length,3);assert.equal(store.assets().length,3);
  assert.throws(()=>run(store,{type:'upsert-garment',record:garment}),/保留/);
});
test('status is separate from ownership and retains existing outfit relationships',t=>{
  const {store}=fixture(t);run(store,{type:'upsert-owned-outfit',record:look()});const item=store.catalog().items[0];
  run(store,{type:'set-garment-status',records:[item],status:'pending-discard'});assert.equal(store.read().relationships.garments.length,2);assert.equal(store.catalog().items[0].wardrobeStatus,'pending-discard');
  assert.throws(()=>run(store,{type:'upsert-owned-outfit',record:look('new')}),/准备丢弃/);
  assert.throws(()=>run(store,{type:'set-garment-status',records:[item],status:'active'}),/已改变/);
});
test('stale writes, idempotency and backup failure never partially apply',t=>{
  const {store,dir}=fixture(t);const command={type:'save-note',record:{id:'n',title:'test',text:'retained'}},requestId=crypto.randomUUID();store.commit(command,requestId);const before=store.read();
  assert.deepEqual(store.commit(command,requestId),before);assert.throws(()=>store.commit({...command,record:{...command.record,text:'other'}},requestId));
  assert.throws(()=>run(store,{...command,expected:{...command.record,text:'stale'}}));assert.deepEqual(store.read(),before);
  fs.renameSync(path.join(dir,'backups'),path.join(dir,'saved-backups'));fs.writeFileSync(path.join(dir,'backups'),'obstacle');assert.throws(()=>run(store,{type:'save-note',record:{id:'new',title:'no',text:'no'}}));assert.deepEqual(store.read(),before);
});
test('malformed and unresolved imports preserve source bytes but never invent owned garments',t=>{
  const {store,dir}=fixture(t),before=store.read();assert.throws(()=>store.initialize({raw:'broken'}));
  assert.throws(()=>store.initialize({raw:JSON.stringify({outfits:[look('missing',{selection:{inner:'missing'}})]})}),/不存在/);assert.deepEqual(store.read(),before);
  assert(fs.readdirSync(path.join(dir,'backups')).some(n=>fs.readFileSync(path.join(dir,'backups',n),'utf8').includes('broken')));
});
test('asset registration is immutable, validates hashes and rejects traversal',t=>{
  const {store}=fixture(t);for(const url of ['../secret','assets/../../secret','/etc/passwd','assets/.hidden'])assert.throws(()=>run(store,{type:'register-assets',assets:[{url}]}));
  assert.throws(()=>run(store,{type:'register-assets',assets:[{url:store.assets()[0].url,sha256:'f'.repeat(64)}]}));assert.equal(store.assets().length,3);
});
test('empty library is valid and foreign schema does not get downgraded',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-empty-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const file=path.join(dir,'db.sqlite');const s=createRelationalStore(file);assert.deepEqual(s.catalog().items,[]);s.close();
  const db=new DatabaseSync(file);db.exec('PRAGMA user_version=999');db.close();assert.throws(()=>createRelationalStore(file),/版本较新/);
});
