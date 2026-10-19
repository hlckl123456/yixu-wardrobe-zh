import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exportSource} from '../../scripts/export-source.mjs';
test('source export excludes private payloads, history and deployment identities and includes runnable tests',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-export-test-')),target=path.join(dir,'source');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));exportSource(target);
  const files=fs.readdirSync(target,{recursive:true});assert(files.includes('tests/public/relational.test.mjs'));assert(files.includes('scripts/data-paths.mjs'));
  for(const file of files)assert.doesNotMatch(file,/^\.git\/|\.sqlite|\.openai|\.local-data|dist\/assets|migration-2026|^tmp\//);
  assert.match(fs.readFileSync(path.join(target,'dist/data/reference-catalog.js'),'utf8'),/empty-references/);assert.throws(()=>exportSource(target),/尚不存在/);
});
