// Persisted selections contain occupied slots only; UI placeholders are projections.
import {legacyOutfitLink,normalizeHistoricalCuration} from './compatibility/personal-history.js';
import {outfitSeasons,outfitStyles} from './outfit-model.js';
import {validCode} from './communication-codes.js';
import {normalizeAssumedBasics} from './assumed-basics.js';
import {validateSuggestedPieces} from './reviews/suggested-pieces.js';
export const selectionSlots = ['outer', 'middle', 'inner', 'tie', 'bottom', 'shoes', 'belt', 'bag', 'accessory'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const emptyPreferences = () => ({selections: {owned: {}}, outfits: [], saved: []});

export function compactSelection(value = {}) {
  if (!object(value)) throw Error('搭配衣物格式无效');
  const entries = Object.entries(value).filter(([, id]) => id != null);
  if (entries.some(([slot, id]) => !selectionSlots.includes(slot) || typeof id !== 'string' || !id)) throw Error('搭配含无效的衣物位置或编号');
  return Object.fromEntries(selectionSlots.filter(slot => value[slot] != null).map(slot => [slot, value[slot]]));
}

function records(value, kind, repairDuplicates) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw Error(`${kind}格式无效`);
  const seen = new Set(), reserved = new Set(value.map(x => x?.id));
  return value.map(record => {
    if (!object(record) || typeof record.id !== 'string' || !record.id || typeof record.title !== 'string') throw Error(`${kind}记录无效`);
    let id = record.id;
    if (seen.has(id)) {
      if (!repairDuplicates) throw Error(`${kind}编号重复：${id}`);
      let n = 2;
      while (reserved.has(`${id}~${n}`) || seen.has(`${id}~${n}`)) n++;
      id = `${id}~${n}`;
    }
    seen.add(id);
    if (kind === '笔记') {
      if (typeof record.text !== 'string') throw Error('笔记内容无效');
      return {id, title: record.title, text: record.text};
    }
    if (!object(record.selection)) throw Error('搭配衣物格式无效');
    return {
      id, title: record.title, selection: compactSelection(record.selection),
      ...legacyOutfitLink(record),
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
      ...outfitPresentation(record)
    };
  });
}

function outfitPresentation(record){
  const result={};
  if(record.outfitKind!==undefined&&!['owned','planned'].includes(record.outfitKind))throw Error('搭配类型无效');
  if(record.outfitKind==='planned'){
    validateSuggestedPieces(record.suggestedPieces);
    if(!record.suggestedPieces?.length)throw Error('待购搭配须保留未购单品说明');
    if(record.suggestedPieces.some(p=>record.selection[p.slot]||p.slot==='inner'&&record.assumedBasics?.length))throw Error('未购单品不能与真实衣物或基础内搭占用同一位置');
    result.outfitKind='planned';
    result.suggestedPieces=JSON.parse(JSON.stringify(record.suggestedPieces));
  }else if(record.suggestedPieces!==undefined&&(!Array.isArray(record.suggestedPieces)||record.suggestedPieces.length))throw Error('含未购单品的方案不能作为已有搭配保存，请显式保存为待购搭配');
  if(record.code!==undefined){
    if(!validCode(record.code,'DP'))throw Error('搭配短编号无效');
    result.code=record.code;
  }
  if(record.displayTitle!==undefined){
    if(typeof record.displayTitle!=='string'||!record.displayTitle.trim()||record.displayTitle.length>120)throw Error('搭配短标题无效');
    result.displayTitle=record.displayTitle;
  }
  if(record.season!==undefined){
    if(!outfitSeasons.some(s=>s.id===record.season))throw Error('搭配季节无效');
    result.season=record.season;
  }
  if(record.styleTags!==undefined){
    if(!Array.isArray(record.styleTags)||!record.styleTags.length||new Set(record.styleTags).size!==record.styleTags.length||record.styleTags.some(id=>!outfitStyles.some(s=>s.id===id)))throw Error('搭配风格标签无效');
    result.styleTags=[...record.styleTags];
  }
  if(record.wearingNotes!==undefined){
    if(!Array.isArray(record.wearingNotes)||record.wearingNotes.some(t=>typeof t!=='string'||t.length>3000))throw Error('穿法说明格式无效');
    result.wearingNotes=[...record.wearingNotes];
  }
  if(record.assumedBasics!==undefined)result.assumedBasics=normalizeAssumedBasics(record.assumedBasics);
  if(record.derivedFromOutfitId!==undefined){
    if(typeof record.derivedFromOutfitId!=='string'||!record.derivedFromOutfitId.trim()||record.derivedFromOutfitId.length>200||record.derivedFromOutfitId===record.id)throw Error('原搭配关联无效');
    result.derivedFromOutfitId=record.derivedFromOutfitId;
  }
  if(record.sourceReference!==undefined){
    if(typeof record.sourceReference!=='string'||!/^#formulas\/[a-z-]+\/[a-z-]+(?:\?[^\s]*)?$/.test(record.sourceReference))throw Error('参考穿法链接无效');
    result.sourceReference=record.sourceReference;
  }
  if(record.visual!==undefined){
    const v=record.visual;
    if(!object(v)||!['ai','photo'].includes(v.kind)||typeof v.src!=='string'||!/^assets\/outfits\/[\w/-]+\.(png|jpg|jpeg|webp)$/.test(v.src)||v.src.includes('..')||typeof v.alt!=='string'||!v.alt.trim())throw Error('搭配图片必须为本地 outfits 图片并注明来源');
    const ids=Object.values(compactSelection(record.selection)).sort();
    if(!Array.isArray(v.garmentIds)||v.garmentIds.some(id=>typeof id!=='string')||JSON.stringify([...v.garmentIds].sort())!==JSON.stringify(ids))throw Error('搭配图片的衣物编号必须与这套搭配一致');
    result.visual={src:v.src,alt:v.alt,kind:v.kind,garmentIds:[...v.garmentIds]};
  }
  return result;
}

export function normalizePreferences(data, {repairDuplicates = false} = {}) {
  if (!object(data) || (data.schemaVersion !== undefined && ![1, 2, 3].includes(data.schemaVersion))) throw Error('本地数据版本无法读取，请保留备份并更新页面');
  return {
    selections: {owned: compactSelection(data.selections?.owned ?? {})},
    outfits: records(data.outfits, '搭配', repairDuplicates),
    saved: records(data.saved, '笔记', repairDuplicates),
    ...(data.curation !== undefined ? {curation:normalizeHistoricalCuration(data.curation)} : {})
  };
}

export function validateBackup(data) {
  if (!object(data) || data.format !== 'yixu-backup' || ![1, 2, 3].includes(data.version) || !Array.isArray(data.outfits) || (data.version===3&&!Array.isArray(data.curation))) throw Error('不是支持的衣序备份文件');
  if (data.version >= 2 && (!object(data.selections) || !object(data.selections.owned))) throw Error('备份缺少搭配草稿');
  const {outfits, saved, selections, curation} = normalizePreferences(data);
  return {outfits, saved, ...(data.version >= 2 ? {selections} : {}), ...(data.version===3?{curation}:{})};
}
