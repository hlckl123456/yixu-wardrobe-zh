// Deliberately synthetic geometric fixtures. No photographs or owner information.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {createRelationalStore} from './relational-store.mjs';
export function fixturePNG(rgb=[90,130,160]){
  const w=120,h=160,raw=Buffer.alloc(h*(1+w*4));
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(y>20&&y<145&&x>20&&x<100){const p=y*(1+w*4)+1+x*4;raw.set([...rgb,255],p);}
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;};
  const chunk=(type,bytes)=>{const out=Buffer.alloc(12+bytes.length);out.writeUInt32BE(bytes.length);out.write(type,4);bytes.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,-4)),out.length-4);return out;};
  const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
export function syntheticSeed(directory){
  const mediaRoot=path.join(directory,'public'),assets=[],items=[];
  for(const [index,layer,subtype,family,name,color] of [[1,'inner','短袖T恤','blue','合成示例·蓝色上衣',[90,130,160]],[2,'bottom','长裤','gray','合成示例·灰色长裤',[110,110,110]],[3,'outer','夹克','brown','合成示例·棕色夹克',[150,110,80]]]){
    const id='YW-'+String(index).padStart(4,'0'),url=`assets/items/${id}/cutout.png`,bytes=fixturePNG(color);
    fs.mkdirSync(path.dirname(path.join(mediaRoot,url)),{recursive:true});fs.writeFileSync(path.join(mediaRoot,url),bytes);
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');assets.push({url,sha256});
    items.push({id,name,collection:'owned',layer,subtype,color:{family,name:family,hex:'#778899'},fit:'示例',pattern:'纯色',styles:[],seasons:[],material:null,warmth:null,uncertainties:['仅为测试用几何图形，不是真实衣物'],assets:{cutout:url},provenance:{kind:'synthetic-demo',originalSha256:sha256,cutoutSha256:sha256,processingMethod:'segmentation',review:{approved:true,notes:'Synthetic geometry'}}});
  }
  return {catalog:{schemaVersion:1,items},assets,mediaRoot};
}
export function createDemo(directory){
  const file=path.join(directory,'wardrobe.sqlite');if(fs.existsSync(file))throw Error('示例只能创建在新的独立目录，不覆盖已有衣橱');
  const store=createRelationalStore(file,syntheticSeed(directory));
  store.initialize();store.commit({type:'upsert-owned-outfit',record:{id:'demo-outfit',title:'合成示例搭配（非真实衣物）',selection:{inner:'YW-0001',bottom:'YW-0002'}}},crypto.randomUUID());
  store.close();return file;
}
