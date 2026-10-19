import {garmentClassification} from './data/garment-taxonomy.js';
import {validateRecordCodes} from './communication-codes.js';
import {validateImageEvidence} from './garment-image.js';
import {validateGarmentStatus} from './garment-status.js';
import {validateLayeringLimits} from './layering-limits.js';

export function validateCatalog(value){
  if(!value||!Array.isArray(value.items))throw Error('衣物档案格式无效');
  const ids=new Set();
  for(const item of value.items){
    if(!item?.id||ids.has(item.id)||item.collection!=='owned'||!['outer','inner','bottom','shoes','accessory'].includes(item.layer)||typeof item.name!=='string'||typeof item.subtype!=='string'||!item.color?.name||!item.assets?.cutout||!Array.isArray(item.uncertainties))throw Error('衣物档案含无效或重复记录');
    if(item.texture!=null&&(typeof item.texture!=='string'||!item.texture.trim()||item.texture.length>500))throw Error('衣物纹理字段无效');
    ids.add(item.id);garmentClassification(item);validateImageEvidence(item);validateGarmentStatus(item);validateLayeringLimits(item);
  }
  if(value.codeRegistry)validateRecordCodes(value.items,value.codeRegistry);
  return value;
}
export function validateGuides(value){
  if(!value||!Array.isArray(value.formulas)||value.formulas.some(n=>!n||['title','text','note'].some(k=>typeof n[k]!=='string')))throw Error('参考笔记格式无效');
  return value;
}

// One request per resource at a time. Failed or invalid responses never replace
// the last validated value or its version. Personal SQLite has its own revision.
export function createJsonResource(url,{validate,fetcher=globalThis.fetch}={}){
  let state={status:'loading',data:null,error:null,version:null},pending=null;
  async function read(){
    const before=JSON.stringify(state);
    try{
      const response=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(15000),headers:state.version?{'If-None-Match':state.version}:{}});
      if(response.status===304){if(!state.data)throw Error('资源版本缺少对应内容');state={...state,status:'ready',error:null};}
      else{
        if(!response.ok)throw Error('读取失败（'+response.status+'）');
        const data=validate(await response.json());
        state={status:'ready',data,error:null,version:response.headers.get('ETag')};
      }
    }catch(error){state={...state,status:'error',error:error.message};}
    return before!==JSON.stringify(state);
  }
  return {state:()=>state,refresh(){if(!pending)pending=read().finally(()=>{pending=null;});return pending;}};
}
