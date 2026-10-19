import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {dataDirectory} from '../../scripts/data-paths.mjs';
import {exportSource} from '../../scripts/export-source.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
test('public editions isolate default data and retain publication documentation',t=>{
  assert.equal(dataDirectory({}),path.join(root,'private-data'));
  const ignore=fs.readFileSync(path.join(root,'.gitignore'),'utf8');
  assert.match(ignore,/^private-data\/$/m);assert.match(ignore,/^demo-data\/$/m);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-public-source-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const target=path.join(dir,'export');exportSource(target);
  const files=fs.readdirSync(target,{recursive:true});
  for(const file of ['LICENSE','SECURITY.md','docs/DEMO.md','docs/MAINTENANCE.md','docs/ci-workflow.yml.example'])assert(files.includes(file),file);
  for(const file of files)assert.doesNotMatch(file,/^private-data(?:\/|$)|^demo-data(?:\/|$)|^scripts\/(?:english-|localize-english|finalize-english)|\.(?:png|jpe?g|heic|sqlite)(?:-|$)/i);
  assert.match(fs.readFileSync(path.join(target,'README.md'),'utf8'),/https:\/\/github\.com\/hlckl123456\/yixu-wardrobe-en/);
});
