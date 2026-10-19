// Category is a garment construction; collar and sleeve are independent facets.
// Legacy Chinese subtypes are mapped exactly here, never parsed with regexes.
export const garmentCategories=Object.fromEntries([
  ['cardigan','针织开衫'],['shirt-jacket','衬衫外套'],['denim-jacket','牛仔外套'],['fleece','抓绒外套'],
  ['shirt','衬衫'],['knit','针织衫'],['sweatshirt','卫衣'],['tee','T 恤'],['vest','针织马甲'],['polo','Polo 衫'],
  ['jeans','牛仔裤'],['trousers','休闲长裤'],['joggers','运动长裤'],['shorts','短裤'],
  ['blazer','西装外套'],['jacket','夹克'],['coat','大衣'],['padded-jacket','绗缝 / 蓬松外套'],['outer-vest','外穿马甲'],
  ['leather-jacket','皮衣'],['cargo-trousers','工装裤'],['henley','亨利领上衣'],
  ['lace-shoes','系带鞋'],['backless-shoes','后空鞋'],['derby-shoes','德比鞋'],['canvas-shoes','帆布鞋'],['sneakers','运动鞋'],['glasses','眼镜'],['belt','皮带'],['bag','包袋'],['necklace','项链'],['scarf','围巾 / 丝巾'],['tie','历史领带'],['unknown','未分类']
]);
export const garmentFacets={
  neckline:{unknown:'待确认',crew:'圆领',turtleneck:'高领',stand:'立领',turn:'翻领',hood:'连帽',v:'V 领',polo:'Polo 领',henley:'亨利领'},
  sleeve:{unknown:'待确认',long:'长袖',short:'短袖',sleeveless:'无袖'},
  closure:{unknown:'待确认',pullover:'套头',zip:'拉链',open:'开襟',halfzip:'半拉链'},
  silhouette:{unknown:'待确认',wide:'宽腿',straight:'直筒'},
  length:{unknown:'待确认',short:'短款'}
};
const definitions=[
  ['cardigan','unknown','unknown','open',['针织开衫','短袖开衫']],
  ['cardigan','unknown','unknown','zip',['拉链针织开衫']],
  ['shirt-jacket','turn','unknown','open',['衬衫外套']],['denim-jacket','unknown','unknown','unknown',['牛仔外套']],['fleece','unknown','unknown','unknown',['抓绒外套']],
  ['shirt','turn','long','open',['长袖衬衫']],['shirt','turn','short','open',['短袖衬衫']],
  ['knit','crew','unknown','pullover',['圆领针织衫']],['knit','turn','unknown','unknown',['翻领针织衫']],
  ['knit','turtleneck','unknown','pullover',['高领针织衫']],['knit','unknown','short','unknown',['短袖针织衫']],
  ['knit','unknown','unknown','pullover',['毛衣','针织衫']],['knit','unknown','unknown','zip',['半拉链针织衫']],
  ['sweatshirt','crew','unknown','pullover',['圆领卫衣']],['sweatshirt','hood','unknown','pullover',['套头帽衫','连帽卫衣']],
  ['sweatshirt','hood','unknown','zip',['拉链帽衫','拉链连帽卫衣']],
  ['sweatshirt','polo','long','unknown',['长袖Polo卫衣']],['sweatshirt','turn','unknown','unknown',['翻领卫衣']],['sweatshirt','unknown','unknown','zip',['半拉链卫衣']],
  ['tee','unknown','long','pullover',['长袖T恤','拼色长袖T恤']],['tee','unknown','short','pullover',['短袖T恤','拼色短袖T恤']],['tee','unknown','sleeveless','pullover',['无袖T恤']],
  ['vest','unknown','sleeveless','unknown',['针织马甲','无袖针织衫']],['vest','v','sleeveless','unknown',['V领马甲']],
  ['polo','polo','unknown','unknown',['Polo衫']],['polo','polo','short','unknown',['短袖Polo衫','短袖Polo']],['polo','polo','long','unknown',['长袖Polo衫','长袖Polo']],
  ['jeans','unknown','unknown','unknown',['宽腿牛仔裤','直筒牛仔裤','牛仔裤']],['trousers','unknown','unknown','unknown',['休闲长裤','阔腿休闲裤','宽腿长裤','直筒长裤']],['joggers','unknown','unknown','unknown',['运动长裤']],['shorts','unknown','unknown','unknown',['阔腿短裤','短裤']],
  ['blazer','unknown','unknown','open',['西装外套']],['jacket','turn','unknown','unknown',['翻领外套']],['jacket','hood','unknown','unknown',['连帽夹克']],['jacket','unknown','unknown','unknown',['工装夹克']],
  ['coat','unknown','unknown','open',['大衣','羊毛大衣','长大衣']],['padded-jacket','unknown','unknown','unknown',['绗缝外套','羽绒服']],['outer-vest','unknown','sleeveless','unknown',['绗缝马甲','羽绒马甲']],
  ['backless-shoes','unknown','unknown','unknown',['后空系带鞋','搭扣后空鞋']],['lace-shoes','unknown','unknown','unknown',['低帮系带鞋']],['glasses','unknown','unknown','unknown',['眼镜']],
  ['belt','unknown','unknown','unknown',['皮带','腰带']],['bag','unknown','unknown','unknown',['斜挎包','单肩包','背包','手提包']],['necklace','unknown','unknown','unknown',['项链']],['scarf','unknown','unknown','unknown',['丝巾','围巾']],['tie','unknown','unknown','unknown',['领带']]
];
export const legacyGarmentTypes=Object.fromEntries(definitions.flatMap(([category,neckline,sleeve,closure,subtypes])=>subtypes.map(subtype=>[subtype,{category,neckline,sleeve,closure}])));
// Exact legacy labels are translated once at the data boundary. Rules, grouping
// and slot eligibility below consume canonical IDs, not display-name heuristics.
for(const [subtype,value] of Object.entries({
  '亨利领T恤':{category:'henley',neckline:'henley'},'亨利领上衣':{category:'henley',neckline:'henley'},
  '皮衣':{category:'leather-jacket'},'夹克':{category:'jacket'},'短夹克':{category:'jacket',length:'short'},
  '宽工装裤':{category:'cargo-trousers',silhouette:'wide'},'德比鞋':{category:'derby-shoes'},'厚底德比鞋':{category:'derby-shoes'},
  '帆布鞋':{category:'canvas-shoes'},'运动鞋':{category:'sneakers'},
  '圆领针织马甲':{category:'vest',neckline:'crew',sleeve:'sleeveless'},
  '方巾':{category:'scarf'},'领巾':{category:'scarf'}
}))legacyGarmentTypes[subtype]=value;
for(const subtype of ['宽腿牛仔裤','阔腿休闲裤','宽腿长裤','阔腿短裤'])legacyGarmentTypes[subtype].silhouette='wide';
for(const subtype of ['直筒牛仔裤','直筒长裤'])legacyGarmentTypes[subtype].silhouette='straight';
legacyGarmentTypes['短袖开衫'].sleeve='short';
for(const subtype of ['半拉链针织衫','半拉链卫衣'])legacyGarmentTypes[subtype].closure='halfzip';
export function validateClassification(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.hasOwn(garmentCategories,value.category))throw Error('衣物类别编号无效');
  const result={category:value.category};
  for(const [key,choices] of Object.entries(garmentFacets)){
    const field=value[key]??'unknown';if(!Object.hasOwn(choices,field))throw Error('衣物属性无效：'+key);result[key]=field;
  }
  return result;
}
export function garmentClassification(item){
  return validateClassification(item.classification||legacyGarmentTypes[item.subtype]||{category:'unknown'});
}

export function garmentSlots(item){
  const c=garmentClassification(item),slots=new Set([item.layer]);
  if(item.layer==='accessory')return c.category==='belt'||c.category==='bag'||c.category==='tie'?[c.category]:['accessory'];
  if(!['outer','inner'].includes(item.layer))return [...slots];
  if(c.category==='cardigan'){slots.add('outer');slots.add('middle');}
  if(c.category==='vest'||c.category==='outer-vest')slots.add('middle');
  if(c.category==='shirt'&&c.sleeve==='long')slots.add('outer');
  if(c.category==='knit'&&c.neckline!=='turtleneck'&&c.sleeve!=='short'&&(['crew','turn'].includes(c.neckline)||['pullover','halfzip','zip'].includes(c.closure)))slots.add('outer');
  if(c.category==='sweatshirt'){
    // A crew-neck sweatshirt can be the outer layer over a tee or shirt,
    // just like a crew-neck knit; its catalog layer remains unchanged.
    if(c.neckline==='crew'&&c.sleeve!=='short')slots.add('outer');
    if(c.neckline==='hood'){slots.add('outer');slots.add('inner');}
    if(['turn','polo'].includes(c.neckline)){slots.add('outer');slots.add('middle');}
    if(c.closure==='halfzip')slots.add('outer');
  }
  if(c.category==='polo'){slots.add('outer');if(c.sleeve==='long')slots.add('middle');}
  return [...slots];
}

export function typeCriteria(subtypes){
  return subtypes.map(label=>{
    if(!legacyGarmentTypes[label])throw Error('未登记的衣物类别标签：'+label);
    return Object.fromEntries(Object.entries(garmentClassification({subtype:label})).filter(([,value])=>value!=='unknown'));
  });
}
export function validateTypeCriteria(types){
  if(!Array.isArray(types)||!types.length)throw Error('参考缺少衣物类别条件');
  for(const type of types){
    validateClassification(type);
    if(type.category==='unknown'||Object.keys(type).some(key=>key!=='category'&&!Object.hasOwn(garmentFacets,key)))throw Error('参考衣物类别条件无效');
  }
  return types;
}
export function matchGarmentType(item,types){
  if(!types)return {state:'matched',pending:[]};
  const c=garmentClassification(item);let uncertain=null;
  for(const type of types){
    const pending=[];let mismatch=false;
    for(const [key,expected] of Object.entries(type)){
      if(expected==='unknown')continue;
      if(c[key]==='unknown')pending.push(key==='category'?'类别待确认':({neckline:'领型',sleeve:'袖长',closure:'开合方式',silhouette:'裤型',length:'衣长'})[key]+'待确认');
      else if(c[key]!==expected)mismatch=true;
    }
    if(!mismatch&&!pending.length)return {state:'matched',pending:[]};
    if(!mismatch&&(!uncertain||pending.length<uncertain.length))uncertain=pending;
  }
  return uncertain?{state:'uncertain',pending:uncertain}:{state:'excluded',pending:[]};
}
