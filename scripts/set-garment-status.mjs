import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {resolveCode} from '../dist/communication-codes.js';
import {garmentStatus,garmentStatuses} from '../dist/garment-status.js';
import {readResource,commit} from './api-client.mjs';
export async function setGarmentStatus(status,codes){
  if(!garmentStatuses.includes(status)||!codes.length||new Set(codes.map(c=>c.toUpperCase())).size!==codes.length)throw Error('请指定状态和无重复的明确衣物编号');
  const catalog=await readResource('catalog'),records=codes.map(code=>resolveCode(catalog.items,code)).filter(i=>garmentStatus(i)!==status);
  if(records.length)await commit({type:'set-garment-status',records,status});
  return {status:records.length?'updated':'unchanged',items:records.map(i=>({id:i.id,code:i.code,name:i.name,wardrobeStatus:status}))};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await setGarmentStatus(process.argv[2],process.argv.slice(3)),null,2));
