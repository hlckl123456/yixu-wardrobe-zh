import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { layers } from '../dist/garment-model.js';
import {garmentClassification} from '../dist/data/garment-taxonomy.js';
import {assignCodes,garmentPrefixes} from '../dist/communication-codes.js';
import {validateImageEvidence} from '../dist/garment-image.js';
import {readResource,commit} from './api-client.mjs';
import {stageMedia} from './media-files.mjs';

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const assert = (condition,message) => {if(!condition) throw new Error(message)};
// Inspect real RGBA pixels, not merely whether a PNG declares an alpha channel.
export function inspectPNG(bytes) {
  assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'图片必须是 PNG');
  let width,height,depth,type,interlace; const chunks=[];
  for(let pos=8;pos+12<=bytes.length;) {
    const n=bytes.readUInt32BE(pos), name=bytes.toString('ascii',pos+4,pos+8);
    assert(n<=bytes.length-pos-12,'PNG 数据不完整');
    const chunk=bytes.subarray(pos+8,pos+8+n);
    if(name==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);depth=chunk[8];type=chunk[9];interlace=chunk[12]}
    if(name==='IDAT') chunks.push(chunk);
    pos+=n+12;
  }
  assert(width>0&&height>0&&width*height<=25e6,'图片尺寸无效或超过 2500 万像素');
  assert(depth===8&&type===6&&interlace===0,'处理图须为非交错 8 位 RGBA PNG');
  const stride=width*4, raw=inflateSync(Buffer.concat(chunks),{maxOutputLength:(stride+1)*height});
  assert(raw.length===(stride+1)*height,'PNG 像素数据长度错误');
  let prev=Buffer.alloc(stride),transparent=0,visible=0;
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)]; assert(filter<=4,'未知 PNG filter');
    const row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));
    for(let x=0;x<stride;x++){
      const left=x>=4?row[x-4]:0,up=prev[x],corner=x>=4?prev[x-4]:0;
      row[x]=(row[x]+[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][filter])&255;
    }
    for(let x=3;x<stride;x+=4){if(row[x]===0)transparent++;if(row[x]>0)visible++}
    prev=row;
  }
  assert(transparent>width*height*.01 && visible>width*height*.01,'未检测到有效透明背景或衣物像素');
  return {width,height,transparentFraction:transparent/(width*height)};
}
export async function ingest(input) {
  assert(input.collection==='owned','这里只录入真实衣物');
  assert(layers.some(x=>x.id===input.layer),'层级无效');
  for(const key of ['name','subtype','fit','pattern']) assert(typeof input[key]==='string'&&input[key].trim(),`缺少 ${key}`);
  assert(input.color && typeof input.color.name==='string' && /^#[a-f\d]{6}$/i.test(input.color.hex),'颜色字段无效');
  assert(['green','red','blue','orange','yellow','purple','white','black','gray','brown','unknown'].includes(input.color.family),'颜色族无效');
  assert(Array.isArray(input.styles)&&Array.isArray(input.seasons)&&Array.isArray(input.uncertainties),'标签字段必须是数组');
  assert(input.review?.approved===true && typeof input.review.notes==='string','必须先核对原图和处理图');
  assert(input.sourceItemKey===undefined||(typeof input.sourceItemKey==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.sourceItemKey)),'sourceItemKey 必须是 1–64 位小写字母、数字或连字符');
  const classification=garmentClassification(input);
  assert(input.texture==null||(typeof input.texture==='string'&&input.texture.trim()&&input.texture.length<=500),'纹理字段无效');
  assert(['background-extraction','segmentation','ai-reconstruction'].includes(input.processingMethod),'真实衣物必须经过背景提取或分割；AI 整理须另有授权');
  validateImageEvidence({provenance:{processingMethod:input.processingMethod,review:input.review},userConfirmedDetails:input.userConfirmedDetails});
  const original=fs.readFileSync(input.originalPath),cutout=fs.readFileSync(input.cutoutPath);
  assert(original.length<30e6 && cutout.length<30e6,'图片不能超过 30MB');
  const magic=original.subarray(0,8),originalExt=magic.equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':(original[0]===255&&original[1]===216?'jpg':null);
  assert(originalExt,'原图请使用 PNG 或 JPEG，转换前保留原始文件');
  const imageInfo=inspectPNG(cutout),originalHash=sha(original);
  const rawSource=input.sourcePath?fs.readFileSync(input.sourcePath):null;
  const alternateSources=(input.alternateSourcePaths||[]).map(p=>({name:path.basename(p),sha256:sha(fs.readFileSync(p))}));
  if(rawSource) assert(/\.heic$/i.test(input.sourcePath),'原始来源请保留 HEIC 文件');
    const catalog=await readResource('catalog');
    const rawHash=rawSource?sha(rawSource):null;
    const sameSource=catalog.items.filter(x=>x.provenance.originalSha256===originalHash || (rawHash && x.provenance.rawSourceSha256===rawHash));
    assert(sameSource.every(x=>x.collection===input.collection),'此图片已在另一集合中，拒绝自动混入');
    if(input.sourceItemKey===undefined)assert(!sameSource.some(x=>x.provenance.sourceItemKey!==undefined),'此照片已按单品录入，请提供 sourceItemKey');
    else assert(!sameSource.some(x=>x.provenance.sourceItemKey===undefined),'此照片已有未区分单品的旧记录，请先核对旧记录，不能用 sourceItemKey 绕过去重');
    const existing=sameSource.find(x=>x.provenance.sourceItemKey===input.sourceItemKey);
    if(existing){assert(existing.collection===input.collection,'此图片已在另一集合中，拒绝自动混入');return {status:'duplicate',id:existing.id,code:existing.code,total:catalog.items.length}}
    const prefix='YW';
    const reservedIds=new Set([...catalog.items.map(x=>x.id),...Object.keys(catalog.codeRegistry||{})]);
    const next=Math.max(0,...[...reservedIds].filter(id=>/^YW-\d+$/.test(id)).map(id=>Number(id.split('-')[1])))+1;
    const id=`${prefix}-${String(next).padStart(4,'0')}`;
    const asset=await stageMedia(`assets/items/${id}/cutout-${sha(cutout).slice(0,12)}.png`,cutout);
    const now=new Date().toISOString();
    const item={id,collection:'owned',name:input.name,layer:input.layer,subtype:input.subtype,color:input.color,fit:input.fit,pattern:input.pattern,styles:input.styles,seasons:input.seasons,material:input.material??null,warmth:input.warmth??null,uncertainties:input.uncertainties,createdAt:now,assets:{cutout:asset.url},provenance:{kind:'chat-photo',originalSha256:originalHash,originalRetained:false,cutoutSha256:sha(cutout),rawSourceSha256:rawHash,rawSourceName:rawSource?path.basename(input.sourcePath):null,alternateSources,processingMethod:input.processingMethod,review:input.review,...imageInfo}};
    item.classification=classification;
    if(input.sourceItemKey!==undefined)item.provenance.sourceItemKey=input.sourceItemKey;
    item.texture=input.texture??null;
    if(input.userConfirmedDetails)item.userConfirmedDetails=[...input.userConfirmedDetails];
    await commit({type:'upsert-garment',record:item,assets:[asset]});
    const saved=await readResource('catalog');
    return {status:'imported',id,code:saved.codeRegistry[id],total:saved.items.length,imageInfo};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{assert(process.argv[2],'用法：node scripts/intake.mjs <agent-prepared-record.json>');console.log(JSON.stringify(await ingest(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))));}catch(e){console.error(e.message);process.exitCode=1}
}
