import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createRelationalStore} from '../../scripts/relational-store.mjs';
import {syntheticSeed,fixturePNG} from '../../scripts/synthetic-data.mjs';
import {normalizePreferences,validateBackup} from '../../dist/data-schema.js';
import {realOutfits,ownedImageDialog} from '../../dist/views/outfits.js';
import {garmentOutfits} from '../../dist/views/dialogs.js';
const concept={slot:'outer',provenance:'shopping-concept',name:'合成待购外层',reason:'测试购买方向',specification:'仅为合成示意，尚未拥有',color:{name:'棕色',hex:'#887766'}};
const look=(id='planned')=>({id,title:'合成待购搭配',outfitKind:'planned',selection:{inner:'YW-0001',bottom:'YW-0002'},suggestedPieces:[concept],season:'autumn',styleTags:['relaxed']});
function fixture(t){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-planned-test-')),file=path.join(directory,'wardrobe.sqlite'),store=createRelationalStore(file,syntheticSeed(directory));store.initialize();t.after(()=>{store.close();fs.rmSync(directory,{recursive:true,force:true});});return {store,file,directory};}
const commit=(s,c)=>s.commit(c,crypto.randomUUID());
test('explicit planned save preserves SQL real memberships, concepts, stable codes and backups without adding inventory',t=>{
 const {store,file}=fixture(t),catalog=store.catalog();
 commit(store,{type:'upsert-planned-outfit',record:look()});
 const state=store.read(),saved=state.data.outfits[0];assert.equal(saved.code,'DP01');assert.equal(saved.outfitKind,'planned');assert.deepEqual(saved.suggestedPieces,[concept]);assert.deepEqual(store.catalog(),catalog);
 assert.equal(state.relationships.garments.length,2);assert.ok(!state.relationships.garments.some(r=>r.slot==='outer'));
 const db=new DatabaseSync(file,{readOnly:true});try{const payload=JSON.parse(db.prepare('select data from outfits').get().data);assert.deepEqual(payload.suggestedPieces,[concept]);assert.equal(payload.selection,undefined);assert.equal(db.prepare('select count(*) n from garments').get().n,3);}finally{db.close();}
 const second=createRelationalStore(file);try{assert.deepEqual(second.read(),state);}finally{second.close();}
 assert.deepEqual(validateBackup(store.backup().backup).outfits,state.data.outfits);
 const edited={...saved,season:'winter'};commit(store,{type:'upsert-planned-outfit',record:edited,expected:saved});assert.equal(store.read().data.outfits[0].code,'DP01');
 assert.throws(()=>commit(store,{type:'upsert-planned-outfit',record:edited,expected:saved}),/变化/);
 commit(store,{type:'remove-owned-outfits',records:store.read().data.outfits});
 assert.throws(()=>commit(store,{type:'upsert-planned-outfit',record:look()}),/保留/);assert.equal(store.catalog().items.length,3);
});
test('owned and planned commands cannot silently change ownership, fabricate identities, overlap slots or hide shopping provenance',t=>{
 const {store}=fixture(t),before=store.read();
 const bad=[
  {type:'upsert-owned-outfit',record:look()},
  {type:'upsert-owned-outfit',record:{...look(),outfitKind:undefined}},
  {type:'upsert-planned-outfit',record:{...look(),suggestedPieces:[]}},
  {type:'upsert-planned-outfit',record:{...look(),selection:{outer:'YW-0003',inner:'YW-0001',bottom:'YW-0002'}}},
  {type:'upsert-planned-outfit',record:{...look(),suggestedPieces:[{...concept,id:'fake'}]}},
  {type:'upsert-planned-outfit',record:{...look(),selection:{inner:'fake',bottom:'YW-0002'}}},
  {type:'upsert-planned-outfit',record:{...look(),suggestedPieces:[{...concept,provenance:'owned'}]}},
  {type:'upsert-planned-outfit',record:{...look(),suggestedPieces:[{...concept,color:{name:'bad',hex:'red'}}]}},
  {type:'upsert-planned-outfit',record:{id:'owned',title:'test',selection:{inner:'YW-0001'}}}
 ];
 for(const command of bad){assert.throws(()=>commit(store,command));assert.deepEqual(store.read(),before);}
 const basic={kind:'basic-tee',sleeve:'long',neckline:'crew',provenance:'user-authorized-assumption',color:{name:'蓝',hex:'#112233'},maxVisibleBandCm:1,exposure:'窄边'};
 assert.throws(()=>normalizePreferences({outfits:[{...look(),selection:{bottom:'YW-0002'},suggestedPieces:[{...concept,slot:'inner'}],assumedBasics:[basic]}]}),/同一位置/);
});
test('planned labels survive normalization, list, detail, zoom and garment relationship display',t=>{
 const {store,directory}=fixture(t),url='assets/outfits/synthetic/planned.png',bytes=fixturePNG();fs.mkdirSync(path.dirname(path.join(directory,'public',url)),{recursive:true});fs.writeFileSync(path.join(directory,'public',url),bytes);
 commit(store,{type:'register-assets',assets:[{url}]});
 commit(store,{type:'upsert-planned-outfit',record:{...look(),visual:{src:url,kind:'ai',alt:'合成待购搭配示意',garmentIds:['YW-0001','YW-0002']}}});
 const saved=store.read().data.outfits[0],args={outfits:[saved],items:store.catalog().items,relationships:store.read().relationships};
 const list=realOutfits(args),detail=realOutfits({...args,outfitId:saved.id}),zoom=ownedImageDialog(saved),relations=garmentOutfits([saved]);
 for(const html of [list,detail,zoom,relations])assert.match(html,/未购/);
 assert.match(list,/其中 1 套/);assert.match(detail,/尚未配齐/);assert.match(detail,/不计入已拥有衣物/);assert.match(zoom,/合成待购外层/);
 assert.ok(!/data-detail="fake"/.test(detail));assert.deepEqual(normalizePreferences(store.read().data).outfits,[saved]);
});
test('an explicitly owned replacement converts a planned look in place using old memberships to interpret old payload',t=>{
 const {store,file,directory}=fixture(t),url='assets/outfits/synthetic/converted.png',bytes=fixturePNG();
 fs.mkdirSync(path.dirname(path.join(directory,'public',url)),{recursive:true});fs.writeFileSync(path.join(directory,'public',url),bytes);
 commit(store,{type:'register-assets',assets:[{url}]});
 commit(store,{type:'upsert-planned-outfit',record:{...look('purchase-history'),visual:{src:url,kind:'ai',alt:'合成试搭',garmentIds:['YW-0001','YW-0002']}}});
 commit(store,{type:'upsert-planned-outfit',record:look('other-planned')});
 const before=store.read(),saved=before.data.outfits[0],catalog=store.catalog();
 const record={...saved,selection:{outer:'YW-0003',...saved.selection},visual:{...saved.visual,garmentIds:['YW-0003','YW-0001','YW-0002']}};
 delete record.outfitKind;delete record.suggestedPieces;
 commit(store,{type:'upsert-owned-outfit',expected:saved,record});
 const after=store.read(),converted=after.data.outfits[0];
 assert.equal(after.data.outfits.length,2);assert.equal(converted.id,saved.id);assert.equal(converted.code,saved.code);
 assert.equal(converted.outfitKind,undefined);assert.equal(converted.suggestedPieces,undefined);assert.equal(converted.visual.src,url);
 assert.deepEqual(converted.selection,record.selection);assert.deepEqual(converted.visual.garmentIds,record.visual.garmentIds);
 assert.deepEqual(after.data.outfits[1],before.data.outfits[1]);assert.deepEqual(store.catalog(),catalog);
 assert.equal(after.relationships.garments.filter(r=>r.outfitId===saved.id).length,3);
 assert.ok(after.relationships.garments.some(r=>r.outfitId===saved.id&&r.slot==='outer'&&r.garmentId==='YW-0003'));
 assert.throws(()=>commit(store,{type:'upsert-owned-outfit',expected:saved,record}),/变化/);
 const db=new DatabaseSync(file,{readOnly:true});try{
  const rows=db.prepare('SELECT id,position,data FROM outfits ORDER BY position').all();
  assert.deepEqual(rows.map(r=>r.id),before.data.outfits.map(o=>o.id));
  const payload=JSON.parse(rows[0].data);assert.equal(payload.outfitKind,undefined);assert.equal(payload.suggestedPieces,undefined);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM outfit_visuals WHERE outfit_id=?').get(saved.id).n,2);
 }finally{db.close();}
 assert.deepEqual(validateBackup(store.backup().backup).outfits,after.data.outfits);
 const html=realOutfits({outfits:[converted],items:catalog.items,relationships:after.relationships,outfitId:converted.id});
 assert.ok(!html.includes('尚未配齐'));assert.ok(!html.includes('不计入已拥有衣物'));
});
