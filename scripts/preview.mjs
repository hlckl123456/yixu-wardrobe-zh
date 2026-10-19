import {createLocalServer} from './local-server.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Same serving/security behavior as local production, but never use the owner's origin.
const qaDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'yixu-sqlite-qa-'));
const server=createLocalServer({databasePath:path.join(qaDirectory,'wardrobe.sqlite')});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(4173,'127.0.0.1',()=>console.log('Local QA: http://127.0.0.1:4173'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{
  server.close(()=>process.exit(0));
  server.closeIdleConnections?.();
});
