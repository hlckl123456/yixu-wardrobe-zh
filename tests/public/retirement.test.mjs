import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSqliteStore} from '../../scripts/sqlite-store.mjs';
import {createLocalServer} from '../../scripts/local-server.mjs';
import {retiredCommands} from '../../dist/compatibility/retired-commands.js';
import {createLegacySource} from '../../dist/compatibility/legacy-storage.js';
import {normalizePreferences,validateBackup,compactSelection} from '../../dist/data-schema.js';
import {createBackup,previewBackup,mergeBackup} from '../../dist/backup-model.js';
import {applyCommand} from '../../dist/data-commands.js';
import {realOutfits} from '../../dist/views/outfits.js';

const outfit={id:'o',title:'原记录',selection:{outer:'old',tie:'historic',belt:'b',bag:'bag',accessory:'a'},route:'#workbench/cardigan?style=fine',createdAt:'2026-10-17'};
const old={outfits:[outfit],saved:[{id:'n',title:'旧笔记',text:'不能丢'}],selections:{owned:{inner:'legacy'}},curation:[{styleId:'unknown-old-style',state:'hidden',season:'winter',position:7}]};
test('fresh SQLite contains no formula memberships; historical curation, draft and notes survive round trip',()=>{
  const db=createSqliteStore();try{
    assert.deepEqual(db.initialize().data.curation,[]);
    const merged=mergeBackup(db.read().data,createBackup(old),{restoreDraft:true});
    assert.deepEqual(merged,old);assert.deepEqual(mergeBackup(merged,createBackup(old)),old);
    assert.deepEqual(mergeBackup(old,{format:'yixu-backup',version:1,outfits:[]}),old);
  }finally{db.close();}
});
test('retired commands fail with 410 without changing any SQLite records or revision',async()=>{
  const server=createLocalServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const post=(endpoint,data)=>fetch(origin+'/__yixu_local/api/'+endpoint,{method:'POST',headers:{origin,'content-type':'application/json','x-yixu-client':'3'},body:JSON.stringify(data)});
  const state=async()=> (await fetch(origin+'/__yixu_local/api/state')).json();
  try{
    await post('migrate',{source:{key:null,raw:null}});const before=await state();
    for(const file of ['model.js','storage.js','curation-model.js','views/wardrobe.js','views/collection.js','features/saved-data.js','data/formula-catalog.js'])assert.equal((await fetch(origin+'/'+file)).status,404,file);
    for(const type of retiredCommands){const response=await post('command',{command:{type},requestId:crypto.randomUUID()});assert.equal(response.status,410,type);assert.equal((await response.json()).code,'RETIRED_OPERATION');assert.deepEqual(await state(),before);}
  }finally{await new Promise(r=>server.close(r));}
});
test('legacy browser adapter is read-only and rescues corrupt bytes exactly',()=>{
  const values={'yixu-v1':'old bytes','yixu-v2':'{broken','yixu-before-import':'older backup'};
  const storage={getItem:k=>values[k]??null,setItem:()=>assert.fail('must not write'),removeItem:()=>assert.fail('must not erase')};
  const legacy=createLegacySource(storage);assert.deepEqual(legacy.source(),{key:'yixu-v2',raw:'{broken'});
  assert.deepEqual(legacy.rescue().entries,values);assert.equal(legacy.commit,undefined);
});
test('backup preview is order-insensitive; conflicts keep both once and stale previews cannot overwrite',()=>{
  const changed={...old,saved:[{text:'new',title:'旧笔记',id:'n'}]};
  assert.equal(previewBackup(old,createBackup({...old,saved:[{text:'不能丢',title:'旧笔记',id:'n'}]})).identical,2);
  assert.equal(previewBackup(old,createBackup(changed)).conflicts.length,1);
  const result=mergeBackup(old,createBackup(changed),{conflicts:'keep-both'});
  assert.equal(result.saved.length,2);assert.deepEqual(mergeBackup(result,createBackup(changed),{conflicts:'keep-both'}),result);
  assert.throws(()=>applyCommand(result,{type:'import-backup',expected:old,data:createBackup(changed)}),/记录已/);
});
test('backup validation is atomic and repairs duplicate legacy identities without deleting entries',()=>{
  assert.throws(()=>validateBackup({...createBackup(old),outfits:[outfit,outfit]}),/重复/);
  const repaired=normalizePreferences({...old,outfits:[outfit,outfit]},{repairDuplicates:true});
  assert.equal(repaired.outfits.length,2);assert.notEqual(repaired.outfits[0].id,repaired.outfits[1].id);
  assert.throws(()=>validateBackup({...createBackup(old),version:999}));
  assert.throws(()=>normalizePreferences({saved:[{id:'n',title:'x',text:null}]}));
});
test('new outfit records do not acquire a workbench route, while historical slots and links remain intact',()=>{
  assert.deepEqual(normalizePreferences(old),old);
  const fresh=normalizePreferences({outfits:[{id:'fresh',title:'new',selection:{bottom:'b'}}]}).outfits[0];
  assert.equal(fresh.route,undefined);assert.deepEqual(compactSelection({outer:null,tie:'historic',bag:'bag'}),{tie:'historic',bag:'bag'});
  const html=realOutfits({outfits:[{...outfit,selection:{outer:null,inner:'gone'}}],items:[]});
  assert.match(html,/gone 暂不在档案中/);assert.doesNotMatch(html,/衣物 null/);
});
test('note writes require the exact previous value before replacing existing content',()=>{
  const update={type:'save-note',record:{...old.saved[0],text:'updated'}};
  assert.throws(()=>applyCommand(old,update),/已改变/);
  assert.equal(applyCommand(old,{...update,expected:old.saved[0]}).saved[0].text,'updated');
});
