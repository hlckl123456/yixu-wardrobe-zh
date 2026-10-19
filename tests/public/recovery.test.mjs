import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createDemo} from '../../scripts/synthetic-data.mjs';
import {createRelationalStore} from '../../scripts/relational-store.mjs';
import {backupPrivate} from '../../scripts/backup-private.mjs';
test('portable backup/restore verifies bytes and never overwrites later edits',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-restore-test-')),source=path.join(root,'source'),copy=path.join(root,'backup'),restored=path.join(root,'restored');t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  createDemo(source);const store=createRelationalStore(path.join(source,'wardrobe.sqlite'));t.after(()=>store.close());const before=store.read();
  await backupPrivate(source,copy);store.commit({type:'save-note',record:{id:'later',title:'later',text:'must survive'}},crypto.randomUUID());
  await assert.rejects(backupPrivate(copy,source),/不存在/);assert.equal(store.read().data.saved[0].text,'must survive');
  await backupPrivate(copy,restored);const recovered=createRelationalStore(path.join(restored,'wardrobe.sqlite'));try{assert.deepEqual(recovered.read(),before);}finally{recovered.close();}
});
