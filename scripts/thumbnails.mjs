import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import path from 'node:path';
import {readResource,commit,origin} from './api-client.mjs';
import {stageMedia} from './media-files.mjs';
const {default:sharp}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'sharp');
const {items}=await readResource('catalog'),thumbnails={},assets=[];
for(const item of items){
  const response=await fetch(origin()+'/'+item.assets.cutout);if(!response.ok)throw Error('无法读取已核对图片');
  const source=Buffer.from(await response.arrayBuffer()),digest=crypto.createHash('sha256').update(source).digest('hex').slice(0,12);
  const url=path.posix.join(path.posix.dirname(item.assets.cutout),'thumbnail-'+digest+'.webp');
  const bytes=await sharp(source).resize({width:360,height:480,fit:'inside',withoutEnlargement:true}).webp({quality:82,alphaQuality:100}).toBuffer();
  assets.push(await stageMedia(url,bytes));thumbnails[item.id]=url;
}
await commit({type:'register-assets',assets});
const previous=await readResource('thumbnails');
await commit({type:'set-document',key:'thumbnails',expected:previous,data:thumbnails});
console.log(JSON.stringify({count:items.length}));
