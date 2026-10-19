// Shared by candidate previews and persisted outfits. Assumptions are not
// photographed inventory and never carry a garment ID or affect closet counts.
export function validateAssumedBasics(value=[]){
  if(!Array.isArray(value)||value.length>1)throw Error('基础内搭假设最多一件');
  for(const b of value){
    if(!b||b.kind!=='basic-tee'||!['short','long'].includes(b.sleeve)||b.neckline!=='crew'||b.provenance!=='user-authorized-assumption')throw Error('只允许已授权的圆领基础 T 恤或长袖');
    if(typeof b.color?.name!=='string'||!b.color.name.trim()||b.color.name.length>80||!/^#[a-f\d]{6}$/i.test(b.color.hex))throw Error('基础内搭颜色无效');
    if(!Number.isFinite(b.maxVisibleBandCm)||b.maxVisibleBandCm<=0||b.maxVisibleBandCm>3||typeof b.exposure!=='string'||!b.exposure.trim()||b.exposure.length>500)throw Error('基础内搭只能小面积露出');
    if(['id','code','asset','assets','garmentId'].some(key=>key in b))throw Error('假设基础内搭不能冒充已核实衣物');
  }
  return value;
}
export function normalizeAssumedBasics(value){
  return validateAssumedBasics(value).map(b=>({kind:b.kind,sleeve:b.sleeve,neckline:b.neckline,color:{name:b.color.name,hex:b.color.hex},maxVisibleBandCm:b.maxVisibleBandCm,exposure:b.exposure,provenance:b.provenance}));
}
export const basicName=b=>`${b.color.name}圆领${b.sleeve==='long'?'长袖 T 恤':'短袖 T 恤'}`;
