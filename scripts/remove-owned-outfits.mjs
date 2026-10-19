// Explicit Codex-mediated removal. No website delete controls and no direct DB writer.
import crypto from 'node:crypto';
import {resolveCode,validCode} from '../dist/communication-codes.js';
import {applyCommand} from '../dist/data-commands.js';
const codes=process.argv.slice(2).map(c=>c.toUpperCase());
if(!codes.length||codes.length>100||codes.some(c=>!validCode(c,'DP'))||new Set(codes).size!==codes.length)throw Error('用法：node scripts/remove-owned-outfits.mjs DP01 DP02（明确编号，不支持范围或全部）');
const origin=process.env.YIXU_ORIGIN||'http://127.0.0.1:4183';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin))throw Error('只允许本机 loopback 服务');
const response=await fetch(origin+'/__yixu_local/api/state');if(!response.ok)throw Error('无法读取本地记录');
const state=await response.json();if(!state.initialized)throw Error('本地记录尚未初始化');
const records=codes.map(code=>resolveCode(state.data.outfits,code));
const command={type:'remove-owned-outfits',records};
applyCommand(state.data,command);
const result=await fetch(origin+'/__yixu_local/api/command',{method:'POST',headers:{'Content-Type':'application/json','X-Yixu-Client':'3',Origin:origin},body:JSON.stringify({command,requestId:crypto.randomUUID()})});
const saved=await result.json();if(!result.ok)throw Error(saved.error||'删除失败');
if(records.some(r=>saved.data.outfits.some(o=>o.id===r.id)))throw Error('删除结果未确认');
console.log(JSON.stringify({removed:records.map(r=>({id:r.id,code:r.code,title:r.displayTitle||r.title})),remaining:saved.data.outfits.length,revision:saved.revision,recoverable:true,assetsRetained:true},null,2));
