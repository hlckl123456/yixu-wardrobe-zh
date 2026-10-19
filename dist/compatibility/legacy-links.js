// Read-only URL adapter. Do not create legacy routes or restore retired workflows.
export function legacyReferenceId(id,style,season){
  const aliases={'summer-tee':'tee','shirt-tie':'shirt-solo','scarf-vest':'vest','cropped-knit':'short-jacket'};
  return aliases[id]||(id==='patterned-top'?(style==='stripe-camp'||(!style&&season==='summer')?'stripe-short':'stripe-long'):id);
}
export function legacyReferenceSelection(id,selection){
  const next={...selection};
  if(/^shorts-shirt-(necklace|scarf)$/.test(next.style||'')){next.accessory=next.style.slice('shorts-shirt-'.length);next.style='shorts-shirt';}
  if(id==='shorts-shirt'&&['necklace','scarf'].includes(next.accessory)&&next.palette?.endsWith('-'+next.accessory))next.palette=next.palette.slice(0,-next.accessory.length-1);
  if(id==='shirt-solo'&&next.style==='shirt-tie'){next.style='shirt-solo';next.palette=next.palette?.replace('shirt-tie-','shirt-solo-');}
  return next;
}
export const retiredReferences={'puffer-vest':'此旧参考已停用。已保存的搭配不受影响。'};

// Only documented historical moves may change a season in an old bookmark.
export function knownSeasonMove(season,id){
  return ({'transition:cardigan':'autumn','transition:shirt-tie':'transition','summer:summer-tee':'summer','summer:patterned-top':'summer','transition:patterned-top':'transition','autumn:scarf-vest':'autumn','winter:cropped-knit':'autumn'})[season+':'+id];
}
