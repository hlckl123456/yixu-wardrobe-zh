import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalRepository} from '../../dist/local-repository.js';
import {emptyPreferences} from '../../dist/data-schema.js';

const envelope=(revision,title='test')=>({initialized:true,revision,data:{...emptyPreferences(),curation:[],saved:[{id:'n',title,text:title}]}});
const response=(body,ok=true)=>({ok,json:async()=>body});
test('local repository migrates exact browser bytes and never writes browser storage',async()=>{
  const raw='{"schemaVersion":2,"outfits":[],"saved":[]}';const calls=[];
  const storage={getItem:key=>key==='yixu-v2'?raw:null,setItem:()=>assert.fail('must not rewrite browser data')};
  const repo=createLocalRepository(storage,{fetcher:async(url,options)=>{calls.push({url,options});return response(envelope(1));}});
  await repo.initialize();assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1].options.body).source.raw,raw);
  assert.equal(calls[1].options.headers['X-Yixu-Client'],'3');
});
test('existing SQLite records work even when browser storage is unavailable',async()=>{
  const repo=createLocalRepository(null,{fetcher:async()=>response(envelope(4,'retained'))});
  assert.equal((await repo.initialize()).saved[0].title,'retained');
});
test('late network read cannot replace newer revision in the UI cache',async()=>{
  let resolveOld,calls=0;
  const repo=createLocalRepository(null,{fetcher:()=>++calls===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(response(envelope(5,'newer')))});
  const old=repo.read();await repo.read();
  resolveOld(response(envelope(4,'stale')));
  assert.equal((await old).saved[0].title,'newer');assert.equal(repo.revision(),5);
});
test('server validation and disconnection report failure instead of browser fallback writes',async()=>{
  const offline=createLocalRepository(null,{fetcher:async()=>{throw Error('offline');}});
  await assert.rejects(offline.read(),/原记录未修改/);
  const denied=createLocalRepository(null,{fetcher:async()=>response({error:'invalid'},false)});
  await assert.rejects(denied.read(),/invalid/);
});
test('browser repository exposes no save, backup or rescue UI operations and retains old bytes',async()=>{
  const raw='raw retained bytes',storage={getItem:key=>key==='yixu-v2'?raw:null};
  const repo=createLocalRepository(storage,{fetcher:async()=>{throw Error('offline');}});
  for(const method of ['commit','backup','rescue'])assert.equal(repo[method],undefined);
  await assert.rejects(repo.read());assert.equal(storage.getItem('yixu-v2'),raw);
});
