import {createLegacySource} from './compatibility/legacy-storage.js';
import {normalizePreferences} from './data-schema.js';

export function createLocalRepository(storage, {fetcher=globalThis.fetch}={}) {
  const legacy=createLegacySource(storage);
  let lastRevision=-1;
  let cached;
  let relationships=null;
  async function request(endpoint,payload) {
    let response;
    try {
      response=await fetcher('/__yixu_local/api/'+endpoint,{
        method:payload===undefined?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(15000),
        ...(payload===undefined?{}:{headers:{'Content-Type':'application/json','X-Yixu-Client':'3'},body:JSON.stringify(payload)})
      });
    }catch {throw Error('本地数据库暂时无法连接。请恢复本地服务后重试；原记录未修改。');}
    const result=await response.json();
    if(!response.ok)throw Error(result.error||'本地记录读取失败');
    return result;
  }
  function accept(result) {
    if(result.revision<lastRevision&&cached)return cached;
    const next=normalizePreferences(result.data);
    const links=result.relationships;
    if(links!==undefined&&(!Array.isArray(links.garments)||!Array.isArray(links.origins)||links.garments.some(r=>typeof r.garmentId!=='string'||typeof r.outfitId!=='string'||typeof r.slot!=='string')||links.origins.some(r=>typeof r.outfitId!=='string'||typeof r.sourceId!=='string')))throw Error('数据库关联读取失败；不能将未知数量当作零');
    lastRevision=Math.max(lastRevision,result.revision);
    cached=next;
    relationships=links||null;
    return cached;
  }
  return {
    async initialize() {
      const current=await request('state');
      let source;
      try{source=legacy.source();}catch(error){if(!current.initialized)throw error;return accept(current);}
      if(source.raw!==null||!current.initialized)return accept(await request('migrate',{source}));
      return accept(current);
    },
    read:async()=>{const result=await request('state');if(!result.initialized)throw Error('尚未完成旧记录迁移，请重新打开页面；原数据仍保留。');return accept(result);},
    revision:()=>lastRevision,
    relationships:()=>relationships
  };
}
