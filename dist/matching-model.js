import {layers,fitsSlot} from './garment-model.js';
import {typeCriteria,matchGarmentType} from './data/garment-taxonomy.js';
import {isActiveGarment} from './garment-status.js';
import {canLayerOver,layerOrder} from './layering-limits.js';

// Explicit editorial tags, never image guesses or assumptions about fabric/warmth.
export function matchingRules(formula){
  const rules=formula.requirements.map(r=>({...r,slot:r.slot||r.layer}));
  if(!rules.some(r=>(r.slot||r.layer)==='shoes'))rules.push({slot:'shoes',layer:'shoes',label:'鞋型未限定 · 结合裤脚与场合选择',optional:true,unrestricted:true});
  return rules;
}
function classify(item,rule){
  const pending=[],mismatch=[];
  if(rule.families){
    if(!item.color?.family||item.color.family==='unknown')pending.push('色系待确认');
    else if(!rule.families.includes(item.color.family))mismatch.push('色系不符');
  }
  const pattern=item.pattern;
  if(rule.pattern==='solid'){
    if(!pattern||/未知|待确认|不明/.test(pattern))pending.push('是否纯色待确认');
    else if(pattern!=='纯色')mismatch.push('不是纯色');
  }
  if(rule.patternTag){
    const texture=['提花','绞花'].includes(rule.patternTag);
    const evidence=texture?[item.texture,pattern].filter(Boolean).join(' '):pattern;
    const recorded=evidence&&(evidence.includes(rule.patternTag)||(rule.patternTag==='绞花'&&evidence.includes('麻花')));
    if(!recorded){
      // A plain-colored knit can still have cable texture. Missing texture metadata
      // is uncertainty, never proof that the garment lacks that construction.
      if(texture||!evidence||/未知|待确认|不明/.test(evidence)||!/(纯色|条纹|格纹|圆点)/.test(evidence))pending.push(`${rule.patternTag}待确认`);
      else mismatch.push(`不是${rule.patternTag}`);
    }
  }
  return {item,pending,mismatch};
}
function ruleMatch(items,rule){
  const types=rule.types||(rule.subtypes?typeCriteria(rule.subtypes):null);
  const sameLayer=items.filter(i=>(rule.layers||[rule.layer]).includes(i.layer)&&fitsSlot(i,rule.slot));
  const classified=sameLayer.flatMap(item=>{
    const type=matchGarmentType(item,types);if(type.state==='excluded')return [];
    const result=classify(item,rule);return [{...result,pending:[...type.pending,...result.pending]}];
  });
  const matches=classified.filter(c=>!c.pending.length&&!c.mismatch.length);
  const uncertain=classified.filter(c=>c.pending.length&&!c.mismatch.length);
  return {...rule,matches,uncertain,excluded:classified.filter(c=>c.mismatch.length).length,
    state:matches.length?'matched':uncertain.length?'uncertain':rule.optional?'optional-empty':'missing'};
}
// A garment cannot fill two required layers at once.
function canFillDistinct(rows){
  const owners=new Map();
  function assign(index,seen){
    for(const {item} of rows[index].matches){
      if(seen.has(item.id))continue;seen.add(item.id);
      if(!owners.has(item.id)||assign(owners.get(item.id),seen)){owners.set(item.id,index);return true;}
    }return false;
  }
  return rows.every((_,i)=>assign(i,new Set()));
}
export function wardrobeMatches(items,formula){
  items=items.filter(isActiveGarment);
  const rows=matchingRules(formula).map(r=>ruleMatch(items,r));
  // Remove an upper layer when every available required under-layer is known
  // to violate an owner-confirmed fit limit. Unknown size is not a mismatch.
  for(const row of rows){
    const index=layerOrder.indexOf(row.slot);if(index<0)continue;
    const lower=rows.filter(r=>!r.optional&&layerOrder.indexOf(r.slot)>index);
    const allowed=({item})=>lower.every(r=>{const options=[...r.matches,...r.uncertain];return !options.length||options.some(o=>canLayerOver(item,o.item));});
    const before=row.matches.length+row.uncertain.length;
    row.matches=row.matches.filter(allowed);row.uncertain=row.uncertain.filter(allowed);
    row.excluded+=before-row.matches.length-row.uncertain.length;
    row.state=row.matches.length?'matched':row.uncertain.length?'uncertain':row.optional?'optional-empty':'missing';
  }
  const required=rows.filter(r=>!r.optional);
  const missing=required.filter(r=>r.state==='missing');
  const uncertain=required.filter(r=>r.state==='uncertain');
  const sharedConflict=!missing.length&&!uncertain.length&&!canFillDistinct(required);
  return {rows,missing,uncertain,sharedConflict,groups:layers.map(layer=>({...layer,rows:rows.filter(r=>{
    const group=r.slot==='middle'?'inner':['bag','belt','tie'].includes(r.slot)?'accessory':r.slot;
    return group===layer.id;
  })}))};
}
