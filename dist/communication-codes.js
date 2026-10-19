// Short human-facing aliases. Internal IDs remain the relationship keys.
export const garmentPrefixes={outer:'WT',inner:'SY',bottom:'KZ',shoes:'XZ',accessory:'PS'};
const prefixes=['WT','SY','KZ','XZ','PS','DP','CK'];
export function validCode(code,prefix){
  if(typeof code!=='string'||!/^([A-Z]{2})(\d{2,})$/.test(code))return false;
  const head=code.slice(0,2),n=Number(code.slice(2));
  return prefixes.includes(head)&&(!prefix||head===prefix)&&Number.isSafeInteger(n)&&n>0&&code===head+String(n).padStart(2,'0');
}
export function validateRegistry(registry){
  if(!registry||typeof registry!=='object'||Array.isArray(registry))throw Error('短编号登记表无效');
  const values=Object.values(registry);
  if(values.some(c=>!validCode(c))||new Set(values).size!==values.length)throw Error('短编号无效或重复');
  return registry;
}
// Retain all issued aliases, including deleted records. Never derive a code
// from the current list order, filter or count. Reclassification keeps its alias.
export function assignCodes(records,previous={},prefixFor,{importing=false}={}){
  const registry={...validateRegistry(previous)},used=new Set(Object.values(registry));
  const seen=new Set();
  const reserve=(id,code)=>{Object.defineProperty(registry,id,{value:code,enumerable:true,configurable:true,writable:true});used.add(code);};
  // Reserve explicit existing aliases before filling gaps in a mixed old/new
  // import. A preceding unnumbered row must not steal a later row's alias.
  for(const record of records){
    if(!record.id||seen.has(record.id))throw Error('短编号对应的内部 ID 重复或缺失');
    seen.add(record.id);
    const prefix=prefixFor(record);
    if(!prefixes.includes(prefix))throw Error('未知的短编号类别');
    const code=Object.hasOwn(registry,record.id)?registry[record.id]:null;
    if(record.code!==undefined&&!validCode(record.code))throw Error('短编号格式无效');
    if(code&&record.code&&record.code!==code&&!importing)throw Error('不能修改已分配的短编号');
    if(!code&&record.code){
      if(!used.has(record.code)&&validCode(record.code,prefix))reserve(record.id,record.code);
      else if(!importing)throw Error('短编号已占用或类别不符');
    }
  }
  const numbered=records.map(record=>{
    let code=Object.hasOwn(registry,record.id)?registry[record.id]:null;
    if(!code){
      const prefix=prefixFor(record);
      const max=Math.max(0,...[...used].filter(c=>c.startsWith(prefix)).map(c=>Number(c.slice(2))));
      code=prefix+String(max+1).padStart(2,'0');
      if(!validCode(code,prefix))throw Error('短编号已超过可用范围');
      reserve(record.id,code);
    }
    return {...record,code};
  });
  return {records:numbered,registry};
}
export function validateRecordCodes(records,registry){
  validateRegistry(registry);
  if(records.some(r=>!Object.hasOwn(registry,r.id)||registry[r.id]!==r.code))throw Error('记录与短编号登记表不一致');
  if(new Set(records.map(r=>r.code)).size!==records.length)throw Error('记录短编号重复');
}
export const displayCode=record=>record.code||record.id;
export function resolveCode(records,value){
  const matches=records.filter(r=>r.id===value||r.code===String(value).toUpperCase());
  if(matches.length!==1)throw Error('编号不存在或不唯一：'+value);
  return matches[0];
}
