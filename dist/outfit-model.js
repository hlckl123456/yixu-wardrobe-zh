import {seasonOrder} from './data/season-policy.js';

// Owned looks are independent of reference membership; no title-based classification.
export const outfitSeasons=seasonOrder.map(id=>({id,name:({winter:'冬天',autumn:'秋冬',transition:'春秋',summer:'夏天'})[id]}));
export const outfitStyles=[{id:'minimal',name:'简约利落'},{id:'relaxed',name:'松弛休闲'},{id:'street',name:'街头叠穿'}];
export const outfitSeasonName=id=>outfitSeasons.find(s=>s.id===id)?.name||'待归类';
export const outfitStyleNames=outfit=>(outfit.styleTags||[]).map(id=>outfitStyles.find(s=>s.id===id)?.name).filter(Boolean);
export const outfitTitle=outfit=>outfit.displayTitle||outfit.title;
export function outfitListHref({season='all',style='all'}={}){
  const q=new URLSearchParams();if(season!=='all')q.set('season',season);if(style!=='all')q.set('style',style);
  return '#outfits'+(q.size?'?'+q:'');
}
export const mixListHref=options=>outfitListHref(options).replace('#outfits','#mix');
export function outfitFilters(outfits,{season='all',style='all'}={}){
  const seasons=[...outfitSeasons];
  if(outfits.some(o=>!o.season))seasons.push({id:'unclassified',name:'待归类'});
  const selectedSeason=seasons.some(s=>s.id===season)?season:'all';
  const inSeason=outfits.filter(o=>selectedSeason==='all'||(o.season||'unclassified')===selectedSeason);
  const styles=outfitStyles.map(s=>({...s,count:inSeason.filter(o=>o.styleTags?.includes(s.id)).length})).filter(s=>s.count);
  const selectedStyle=styles.some(s=>s.id===style)?style:'all';
  return {season:selectedSeason,style:selectedStyle,inSeason,seasons:seasons.map(s=>({...s,count:outfits.filter(o=>(o.season||'unclassified')===s.id).length})),styles,visible:inSeason.filter(o=>selectedStyle==='all'||o.styleTags?.includes(selectedStyle))};
}
