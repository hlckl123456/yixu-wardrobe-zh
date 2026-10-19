// Shopping concepts are not owner inventory or authorized assumed basics.
export function validateSuggestedPieces(value=[]){
  if(!Array.isArray(value)||value.length>1)throw Error('每个购买意向方案最多新增一件');
  for(const p of value){
    if(!p||typeof p!=='object'||!['inner','outer'].includes(p.slot)||p.provenance!=='shopping-concept')throw Error('购买意向单品来源无效');
    if(['id','code','asset','garmentId'].some(k=>k in p))throw Error('购买建议不能冒充已拥有的衣物');
    for(const k of ['name','reason','specification'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>1000)throw Error('购买意向说明无效');
    if(typeof p.color?.name!=='string'||!p.color.name.trim()||!/^#[a-f\d]{6}$/i.test(p.color.hex))throw Error('建议配色无效');
  }
  return value;
}
