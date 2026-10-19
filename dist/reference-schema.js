import {classifySeason,seasonOrder} from './data/season-policy.js';
import {validateTypeCriteria} from './data/garment-taxonomy.js';
import {validateRecordCodes} from './communication-codes.js';

const roles=new Set(['outer','middle','inner','bottom','shoes','belt','bag','accessory']);
export function validateReferenceCatalog(data){
  if(data.codeRegistry)validateRecordCodes(data.formulas.flatMap(f=>f.styles),data.codeRegistry);
  if(data.schemaVersion!==1)throw Error('穿搭参考目录版本不支持');
  if(JSON.stringify(data.seasons.map(s=>s.id))!==JSON.stringify(seasonOrder))throw Error('四季顺序无效');
  const formulaIds=new Set(),styleIds=new Set();
  for(const f of data.formulas){
    if(formulaIds.has(f.id)||!f.styles?.length)throw Error('公式重复或没有穿法');formulaIds.add(f.id);
    if(f.seasons.length!==1||f.seasons[0]!==classifySeason(f.traits))throw Error('公式季节与结构不符');
    for(const s of f.styles){
      if(styleIds.has(s.id)||s.formula!==f.id)throw Error('穿法重复或归属错误');styleIds.add(s.id);
      if(JSON.stringify(s.seasons)!==JSON.stringify(f.seasons)||classifySeason(s.traits)!==f.seasons[0])throw Error('同套穿法不能跨季重复');
      if(!s.requirements?.length||!s.tips?.length)throw Error('穿法缺少规则或说明');
      for(const r of [...s.requirements,...(s.accessories||[]).flatMap(a=>a.requirement?[a.requirement]:[])]){
        if(!roles.has(r.slot)||!(r.layers||[r.layer]).every(l=>['outer','inner','bottom','shoes','accessory'].includes(l)))throw Error('衣物角色无效');
        if(r.subtypes?.includes('领带'))throw Error('不再支持领带穿法');
        if(r.subtypes)validateTypeCriteria(r.types);
      }
      for(const variants of [s.variants,...(s.accessories||[]).map(a=>a.variants)]){
        if(!variants?.length||new Set(variants.map(v=>v.id)).size!==variants.length)throw Error('配色为空或重复');
        for(const v of variants)if(!/^\/?assets\/formulas\/[\w/-]+\.(jpg|png|webp)$/.test(v.src)||!v.palette?.length)throw Error('参考图片或配色无效：'+v.id);
      }
      if(s.accessories&&(new Set(s.accessories.map(a=>a.id)).size!==s.accessories.length||!s.accessories.some(a=>a.id===s.defaultAccessory)))throw Error('配饰选项或默认项无效');
    }
  }
  const indexed=data.seasons.flatMap(s=>s.formulaIds);
  if(indexed.length!==formulaIds.size||new Set(indexed).size!==indexed.length||indexed.some(id=>!formulaIds.has(id)))throw Error('季节目录与公式不一致');
  for(const season of data.seasons)if(season.formulaIds.some(id=>data.formulas.find(f=>f.id===id).seasons[0]!==season.id))throw Error('季节索引错误');
  return data;
}


// Pure reference selection. No routes, personal preferences, draft or storage.
export function selectReference(formula,selection={}){
  const specified=value=>value!==undefined&&value!==null;
  const base=specified(selection.style)?formula.styles.find(s=>s.id===selection.style):formula.styles[0];
  if(!base)throw Error('指定的穿法不存在');
  const option=specified(selection.accessory)?base.accessories?.find(a=>a.id===selection.accessory):base.accessories?.find(a=>a.id===base.defaultAccessory);
  if(specified(selection.accessory)&&!option)throw Error('指定的配饰版本不存在');
  const style=option?{...base,variants:option.variants,requirements:[...base.requirements,...(option.requirement?[option.requirement]:[])]}:base;
  const variant=specified(selection.palette)?style.variants.find(v=>v.id===selection.palette):style.variants[0];
  if(!variant)throw Error('指定的配色不存在');
  return {season:base.seasons[0],style,variant,accessory:option?.id};
}
