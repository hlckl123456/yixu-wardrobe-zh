import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRelationalStore} from '../../scripts/relational-store.mjs';
import {syntheticSeed} from '../../scripts/synthetic-data.mjs';

const run=(s,c)=>s.commit(c,crypto.randomUUID());
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-restore-test-')),seed=syntheticSeed(dir);
  seed.catalog.items=seed.catalog.items.map((r,i)=>({...r,code:['SY01','KZ01','WT01'][i]}));
  seed.catalog.codeRegistry={...Object.fromEntries(seed.catalog.items.map(r=>[r.id,r.code])),'YW-0010':'SY05','YW-0011':'SY06'};
  const store=createRelationalStore(path.join(dir,'wardrobe.sqlite'),seed);store.initialize();
  t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return store;
}
const archived=(store,id='YW-0010',code='SY05')=>({...store.catalog().items[0],id,code,provenance:{...store.catalog().items[0].provenance,originalSha256:crypto.createHash('sha256').update(id).digest('hex')}});
function entry(store,record){
  const tables=store.fullBackup().tables;
  return {record,archivedRecord:structuredClone(record),expectedIdentity:tables.identities.find(i=>i.id===record.id),expectedStored:tables.garments.find(g=>g.id===record.id)||null,expectedVersions:tables.garment_versions.filter(v=>v.garment_id===record.id).sort((a,b)=>a.version-b.version)};
}
const command=records=>({type:'restore-garments',reason:'Explicit synthetic restoration test',records});

test('explicit legacy restoration reuses reserved aliases without reviving outfits',t=>{
  const store=fixture(t),before=store.read(),oldCatalog=store.catalog();
  const record=archived(store),c=command([entry(store,record)]),id=crypto.randomUUID();
  assert.throws(()=>run(store,{type:'upsert-garment',record}),/保留/);
  const result=store.commit(c,id);
  assert.deepEqual(store.catalog().items.slice(0,3),oldCatalog.items);
  assert.deepEqual(store.catalog().items[3],record);
  assert.deepEqual(result.data,before.data);assert.deepEqual(result.relationships,before.relationships);
  assert.deepEqual(store.catalog().codeRegistry,oldCatalog.codeRegistry);
  assert.deepEqual(store.commit(c,id),result);
  assert.throws(()=>run(store,command([entry(store,record)])),/仍在目录/);
  assert.equal(store.integrity(),'ok');assert.deepEqual(store.foreignKeys(),[]);
});

test('explicit tombstone restoration retains image history and does not revive removed looks',t=>{
  const store=fixture(t),record=store.catalog().items[0];
  run(store,{type:'upsert-owned-outfit',record:{id:'removed-look',title:'Synthetic look',selection:{inner:record.id,bottom:'YW-0002'}}});
  run(store,{type:'remove-garments',records:[record],relatedOutfits:store.read().data.outfits});
  const before=store.fullBackup().tables.garment_versions.filter(v=>v.garment_id===record.id);
  run(store,command([entry(store,record)]));
  assert.deepEqual(store.catalog().items[0],record);assert.deepEqual(store.read().data.outfits,[]);
  assert.equal(store.fullBackup().tables.identities.find(i=>i.id==='removed-look').kind,'outfit');
  assert.deepEqual(store.fullBackup().tables.garment_versions.filter(v=>v.garment_id===record.id),before);
});

test('restoration rejects changed identities, evidence, snapshots and partial batches atomically',t=>{
  const store=fixture(t),record=archived(store),valid=entry(store,record),before=store.catalog();
  const bad=[
    {...valid,record:{...record,code:'SY99'}},
    {...valid,expectedIdentity:{...valid.expectedIdentity,code:'SY99'}},
    {...valid,record:{...record,name:'Changed metadata'}},
    {...valid,record:{...record,provenance:{...record.provenance,cutoutSha256:'f'.repeat(64)}}},
    {...valid,expectedStored:{}},
    {...valid,expectedVersions:[{}]},
    {...valid,expectedStored:undefined},
    {...valid,record:{...record,id:'YW-9999'}},
    {...valid,record:{...record,provenance:store.catalog().items[0].provenance},archivedRecord:{...record,provenance:store.catalog().items[0].provenance}}
  ];
  for(const invalid of bad){assert.throws(()=>run(store,command([invalid])));assert.deepEqual(store.catalog(),before);}
  assert.throws(()=>run(store,{...command([valid]),reason:' '}));
  assert.throws(()=>run(store,command([valid,valid])));
  const second=entry(store,archived(store,'YW-0011','SY06'));
  assert.throws(()=>run(store,command([valid,{...second,expectedVersions:[{}]}])));
  assert.deepEqual(store.catalog(),before);
});

test('restoration cannot reactivate retired image URLs',t=>{
  const store=fixture(t),record=store.catalog().items[0];
  run(store,{type:'remove-garments',records:[record]});
  run(store,{type:'retire-assets',records:[{expected:store.assets().find(a=>a.url===record.assets.cutout)}]});
  assert.throws(()=>run(store,command([entry(store,record)])),/资源已/);
  assert(!store.catalog().items.some(g=>g.id===record.id));
  assert(store.fullBackup().tables.garments.find(g=>g.id===record.id).deleted_at);
});
