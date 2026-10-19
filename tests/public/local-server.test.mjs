import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createLocalServer,healthPath,rootTag} from '../../scripts/local-server.mjs';

function request(port,target='/',headers={},method='GET') {
  return new Promise((resolve,reject) => {
    const req=http.request({hostname:'127.0.0.1',port,path:target,method,headers},res=>{
      let body='';res.on('data',part=>body+=part);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
    });req.on('error',reject);req.end();
  });
}
test('local server serves exact assets, validates host/origin and never serves parent or hidden files',async()=>{
  const server=createLocalServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {
    const index=await request(port);
    assert.equal(index.status,200);assert.match(index.body,/<title>衣序/);
    assert.equal(index.headers['cache-control'],'no-store');
    assert.equal(index.headers['cross-origin-resource-policy'],'same-origin');
    const health=JSON.parse((await request(port,healthPath)).body);
    assert.equal(health.app,'yixu-local');assert.equal(health.rootTag,rootTag);
    assert.equal(server.address().address,'127.0.0.1');
    const head=await request(port,'/app.js',{},'HEAD');
    assert.equal(head.status,200);assert.equal(head.body,'');assert(Number(head.headers['content-length'])>0);
    assert.equal((await request(port,'/',{host:'evil.example:'+port})).status,403);
    assert.equal((await request(port,'/data/catalog.json',{origin:'https://evil.example'})).status,403);
    assert.equal((await request(port,'/data/catalog.json',{'sec-fetch-site':'cross-site','sec-fetch-mode':'cors'})).status,403);
    assert.equal((await request(port,'/',{},'POST')).status,405);
    assert.equal((await request(port,'/.openai/hosting.json')).status,404);
    assert.equal((await request(port,'/%2e%2e%2fAGENTS.md')).status,404);
    assert.equal((await request(port,'/%E0%A4%A')).status,400);
    assert.equal((await request(port,'/assets/items/')).status,404);
    const alias=await request(port,'/',{host:'localhost:'+port});
    assert.equal(alias.status,307);assert.equal(alias.headers.location,`http://127.0.0.1:${port}/`);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('symlinks cannot expose files outside the static root',async()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-server-'));
  const root=path.join(temporary,'public');fs.mkdirSync(root);
  fs.writeFileSync(path.join(temporary,'private.txt'),'not public');
  fs.symlinkSync(path.join(temporary,'private.txt'),path.join(root,'leak.txt'));
  const server=createLocalServer({root});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {assert.equal((await request(server.address().port,'/leak.txt')).status,404);}
  finally {await new Promise(resolve=>server.close(resolve));fs.rmSync(temporary,{recursive:true,force:true});}
});
