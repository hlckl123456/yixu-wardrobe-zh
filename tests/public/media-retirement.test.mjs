import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRelationalStore} from '../../scripts/relational-store.mjs';
import {createLocalServer} from '../../scripts/local-server.mjs';
import {syntheticSeed,createDemo} from '../../scripts/synthetic-data.mjs';
const run=(store,command)=>store.commit(command,crypto.randomUUID());
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-retire-media-'));
  const store=createRelationalStore(path.join(dir,'wardrobe.sqlite'),syntheticSeed(dir));store.initialize();
  t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return {dir,store};
}
function addReview(dir,store,url,body='review'){
  const file=path.join(dir,'public',url);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);
  run(store,{type:'register-assets',assets:[{url}]});return store.asset(url);
}
test('media retirement preserves bytes, blocks active references and cannot resurrect via registration',t=>{
  const {dir,store}=fixture(t),item=store.catalog().items[2],asset=store.asset(item.assets.cutout);
  const bytes=fs.readFileSync(path.join(dir,'public',asset.relative_path));
  assert.throws(()=>run(store,{type:'retire-assets',records:[{expected:asset}]}),/仍被当前/);
  run(store,{type:'remove-garments',records:[item],relatedOutfits:[]});
  const before=store.read();run(store,{type:'retire-assets',records:[{expected:asset}]});
  assert.equal(store.asset(asset.url).kind,'retired');assert.deepEqual(store.read().data,before.data);
  assert.deepEqual(fs.readFileSync(path.join(dir,'public',asset.relative_path)),bytes);
  run(store,{type:'register-assets',assets:[{url:asset.url,sha256:asset.sha256}]});assert.equal(store.asset(asset.url).kind,'retired');
  assert.equal(store.fullBackup().tables.garment_versions.length,3);
  assert.throws(()=>run(store,{type:'register-assets',assets:[{url:asset.url,kind:'redirect:reviews/new/index.html'}]}),/访问状态/);
});
test('review retirement validates the whole expected batch and rejects unsafe redirects',t=>{
  const {dir,store}=fixture(t),a=addReview(dir,store,'reviews/old/index.html'),b=addReview(dir,store,'reviews/new/index.html');
  const before=store.read();
  assert.throws(()=>run(store,{type:'retire-assets',records:[{expected:a},{expected:{...b,sha256:'f'.repeat(64)}}]}),/已改变/);
  assert.deepEqual(store.read(),before);assert.equal(store.asset(a.url).kind,a.kind);
  for(const redirectTo of ['https://example.com','/reviews/new/index.html','reviews/new/../index.html',a.url,'reviews/missing/index.html'])assert.throws(()=>run(store,{type:'retire-assets',records:[{expected:a,redirectTo}]}));
  assert.throws(()=>run(store,{type:'retire-assets',records:[{expected:a,redirectTo:b.url},{expected:b}]}),/同时移除/);
  run(store,{type:'retire-assets',records:[{expected:a,redirectTo:b.url}]});assert.equal(store.asset(a.url).kind,'redirect:'+b.url);
  assert.throws(()=>run(store,{type:'retire-assets',records:[{expected:store.asset(a.url),redirectTo:a.url}]}));
});
test('retired URLs return 410 and replaced review documents redirect only to registered local media',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-retired-server-'));createDemo(dir);
  const server=createLocalServer({dataDir:dir,databasePath:path.join(dir,'wardrobe.sqlite')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});});
  const origin='http://127.0.0.1:'+server.address().port;
  const command=async c=>{const response=await fetch(origin+'/__yixu_local/api/command',{method:'POST',headers:{origin,'content-type':'application/json','x-yixu-client':'3'},body:JSON.stringify({command:c,requestId:crypto.randomUUID()})});assert.equal(response.status,200);return response.json();};
  const registrations=[];
  for(const [url,body] of [['reviews/old/index.html','old'],['reviews/new/index.html','new'],['reviews/old/image.svg','<svg/>']]){
    const file=path.join(dir,'public',url);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);
    registrations.push({url,sha256:crypto.createHash('sha256').update(body).digest('hex'),relative_path:url,size:Buffer.byteLength(body),kind:'media'});
  }
  await command({type:'register-assets',assets:registrations});
  await command({type:'retire-assets',records:[{expected:registrations[0],redirectTo:registrations[1].url},{expected:registrations[2]}]});
  const old=await fetch(origin+'/'+registrations[0].url,{redirect:'manual'});assert.equal(old.status,307);assert.equal(old.headers.get('location'),'/'+registrations[1].url);
  assert.equal(await(await fetch(origin+'/'+registrations[0].url)).text(),'new');
  assert.equal((await fetch(origin+'/'+registrations[2].url)).status,410);
});
