// Codex-only intake adapter. Use the live loopback server, never a second DB writer.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {applyCommand} from '../dist/data-commands.js';
import {resolveCode} from '../dist/communication-codes.js';
import {readResource} from './api-client.mjs';

const input=process.argv[2],origin=process.env.YIXU_ORIGIN||'http://127.0.0.1:4183';
if(!input||!path.isAbsolute(input))throw Error('用法：node scripts/save-owned-outfit.mjs /absolute/path/outfit.json');
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('只允许本机 loopback 服务');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const record=JSON.parse(fs.readFileSync(input,'utf8'));
if(!record.id||!record.title?.trim())throw Error('请提供稳定搭配编号与名称');
const stateResponse=await fetch(origin+'/__yixu_local/api/state');
if(!stateResponse.ok)throw Error('无法读取本地记录');
const state=await stateResponse.json();if(!state.initialized)throw Error('先打开本地衣橱完成数据迁移');
if(/^DP\d+$/i.test(record.id))record.id=resolveCode(state.data.outfits,record.id).id;
const previous=state.data.outfits.find(o=>o.id===record.id);
record.createdAt=previous?.createdAt||record.createdAt||new Date().toISOString();
// Retain a historical link when updating an existing record; new records use sourceReference.
if(!record.route&&previous?.route)record.route=previous.route;
if(!record.code&&previous?.code)record.code=previous.code;
if(/^CK\d+$/i.test(record.sourceReference||'')){
  const library=await readResource('references'),{referenceHref}=await import('../dist/navigation-model.js');
  const style=resolveCode(library.formulas.flatMap(f=>f.styles),record.sourceReference);
  record.sourceReference=referenceHref(library.formulas.find(f=>f.id===style.formula),style);
}
const references=record.sourceReference?await readResource('references'):null;
const resolver=record.sourceReference?(await import('../dist/navigation-model.js')).referenceContext:undefined;
const referenceContext=resolver?hash=>resolver(hash,references):undefined;
if(record.sourceReference&&!referenceContext(record.sourceReference))throw Error('参考穿法不存在');
if(record.visual){
  if(!(await fetch(origin+'/'+record.visual.src.replace(/^\//,''),{method:'HEAD'})).ok)throw Error('搭配图片尚未登记或校验失败');
}
const {items}=await readResource('catalog');
for(const [slot,value] of Object.entries(record.selection||{}))record.selection[slot]=resolveCode(items,value).id;
if(record.visual?.garmentIds)record.visual.garmentIds=record.visual.garmentIds.map(value=>resolveCode(items,value).id);
const command={type:'upsert-owned-outfit',record,...(previous?{expected:previous}:{})};
const validated=applyCommand(state.data,command,items,referenceContext).outfits.find(o=>o.id===record.id);
if(previous&&JSON.stringify(previous)===JSON.stringify(validated)){console.log('搭配已存在，内容相同；未重复写入。');process.exit(0);}
const response=await fetch(origin+'/__yixu_local/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Yixu-Client':'3',Origin:origin},body:JSON.stringify({command,requestId:crypto.randomUUID()})});
const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败');
if(!result.data.outfits.some(o=>o.id===record.id))throw Error('保存结果未确认');
console.log(JSON.stringify({saved:record.id,code:result.data.outfits.find(o=>o.id===record.id).code,garments:Object.values(record.selection).map(id=>({id,code:resolveCode(items,id).code})),revision:result.revision},null,2));
