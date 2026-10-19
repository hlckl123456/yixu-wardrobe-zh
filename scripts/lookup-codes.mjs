// Read-only AI lookup. No database writer and no browser controls.
import fs from 'node:fs';
import {resolveCode} from '../dist/communication-codes.js';
import {garmentStatus} from '../dist/garment-status.js';
import {readResource} from './api-client.mjs';
const queries=process.argv.slice(2),all=!queries.length;
const records=[];
if(all||queries.some(q=>!/^DP|^owned-|^CK/i.test(q))){
  const catalog=await readResource('catalog');
  records.push(...catalog.items.map(i=>({kind:'garment',code:i.code,id:i.id,name:i.name,layer:i.layer,subtype:i.subtype,wardrobeStatus:garmentStatus(i),asset:i.assets.cutout})));
}
if(all||queries.some(q=>/^DP|^owned-/i.test(q))){
  const origin=process.env.YIXU_ORIGIN||'http://127.0.0.1:4183';
  if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('只允许本机 loopback 服务');
  const response=await fetch(origin+'/__yixu_local/api/state',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('无法读取本地搭配，未猜测编号');
  const state=await response.json();
  records.push(...state.data.outfits.map(o=>({kind:'outfit',code:o.code,id:o.id,name:o.displayTitle||o.title,selection:o.selection,href:'#outfits/'+encodeURIComponent(o.id)})));
}
if(all||queries.some(q=>/^CK/i.test(q))){
  const library=await readResource('references'),{referenceHref}=await import('../dist/navigation-model.js');
  records.push(...library.formulas.flatMap(f=>f.styles.map(s=>({kind:'reference',code:s.code,id:s.id,name:s.name,season:s.seasons[0],href:referenceHref(f,s)}))));
}
console.log(JSON.stringify(all?records:queries.map(q=>resolveCode(records,q)),null,2));
