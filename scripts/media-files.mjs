import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {dataDirectory,containedFile} from './data-paths.mjs';
import {origin} from './api-client.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function stageMedia(url,bytes){
  const directory=dataDirectory(),health=await (await fetch(origin()+'/__yixu_local/health')).json();
  if(health.dataTag!==sha(path.resolve(directory)).slice(0,16))throw Error('CLI 的 YIXU_DATA_DIR 与服务不一致，未写文件');
  const root=path.join(directory,'public'),target=containedFile(root,url);
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
  if(!fs.realpathSync(path.dirname(target)).startsWith(fs.realpathSync(root)+path.sep))throw Error('资源目录越界');
  if(fs.existsSync(target)){
    if(!fs.readFileSync(target).equals(bytes))throw Error('已有图片不可覆盖，请使用版本路径');
  }else{
    const temporary=path.join(path.dirname(target),'.stage-'+crypto.randomUUID());
    const fd=fs.openSync(temporary,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    try{fs.linkSync(temporary,target);}finally{fs.unlinkSync(temporary);}
  }
  // Failure leaves an unregistered immutable orphan, never a false SQL record.
  return {url,sha256:sha(bytes)};
}
