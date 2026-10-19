import {garmentCategories,garmentClassification,garmentSlots} from './data/garment-taxonomy.js';
export {garmentClassification} from './data/garment-taxonomy.js';
export const layers = [
  { id: 'outer', name: '外套', hint: '先定轮廓与主色', icon: 'coat' },
  { id: 'inner', name: '内搭', hint: '补足领口与层次', icon: 'shirt' },
  { id: 'bottom', name: '下装', hint: '用裤型平衡比例', icon: 'pants' },
  { id: 'shoes', name: '鞋', hint: '衔接裤脚与鞋面', icon: 'shoe' },
  { id: 'accessory', name: '配饰', hint: '衣服成立后再决定', icon: 'belt' }
];
export const roleNames={outer:'外层',middle:'中层',inner:'内搭',bottom:'下装',shoes:'鞋',belt:'皮带',bag:'包袋',accessory:'配饰',tie:'历史配饰'};
export function fitsSlot(item,slot) {
  return garmentSlots(item).includes(slot);
}
export function inventory(catalog) {
  return catalog.items.filter(item => item.collection === 'owned');
}
export function statistics(items, layer) {
  const selected = items.filter(x => x.layer === layer);
  const colors = new Map();
  for (const item of selected) {
    const key = item.color.name;
    const entry = colors.get(key) || {name:key,hex:item.color.hex,count:0};
    entry.count++; colors.set(key,entry);
  }
  return { total: selected.length, colors: [...colors.values()].sort((a,b)=>b.count-a.count) };
}
export function describeSelection(items,selection={}){return Object.keys(roleNames).map(role=>items.find(i=>i.id===selection[role])).filter(Boolean).map(i=>i.color.name+i.subtype).join(' ＋ ');}
export function garmentGroup(item){
  const {category}=garmentClassification(item);return {id:category,name:garmentCategories[category]};
}
export function canonicalGarmentGroup(id){
  if(['long-tee','short-tee'].includes(id))return 'tee';
  if(id?.startsWith('subtype:'))return garmentGroup({subtype:id.slice(8)}).id;
  return id;
}
export function groupedGarments(items){
  const result=new Map();
  for(const item of items){const group=garmentGroup(item);if(!result.has(group.id))result.set(group.id,{...group,items:[]});result.get(group.id).items.push(item);}
  return [...result.values()];
}
export function wardrobeStructure(items,layer){
  return groupedGarments(items.filter(i=>i.layer===layer)).map(group=>({...group,colors:statistics(group.items,layer).colors}));
}
