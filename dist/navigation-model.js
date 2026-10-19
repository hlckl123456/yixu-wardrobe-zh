import {library,selectReference} from './reference-model.js';
import {baseRoute} from './app-route.js';
import {legacyReferenceId,legacyReferenceSelection,retiredReferences,knownSeasonMove} from './compatibility/legacy-links.js';

// The reference catalog is editorial. Historical personal curation never filters it.
export function referenceHref(formula,style,variant,accessory) {
  return `#formulas/${style.seasons[0]}/${formula.id}?${new URLSearchParams({style:style.id,...(variant?{palette:variant}:{}),...(accessory?{accessory}:{})})}`;
}
export function appRoute(hash='',catalog=library) {
  const library=catalog;
  const base=baseRoute(hash);
  if(base.redirect)return base;
  if(base.page!=='formulas'||base.section==='notes')return base;
  const [path,query='']=hash.replace(/^#/,'').split('?');
  const [page,section,id,...extra]=path.split('/');
  const q=new URLSearchParams(query);
  if(['formulas','workbench','analysis'].includes(page)){
    const requestedId=page==='formulas'?id:section;
    const requestedSeason=page==='formulas'?section:q.get('season');
    const invalid=message=>({page:'formulas',section:library.seasons.some(s=>s.id===requestedSeason)?requestedSeason:'library',id:null,error:message});
    if(extra.length||page!=='formulas'&&id)return invalid('参考链接路径无效');
    if(['style','palette','accessory'].some(key=>q.getAll(key).length>1))return invalid('参考链接包含重复选项');
    if(Object.hasOwn(retiredReferences,requestedId))return {page:'formulas',section:'winter',id:null,retired:requestedId,notice:retiredReferences[requestedId]};
    const resolvedId=legacyReferenceId(requestedId,q.get('style'),page==='formulas'?section:q.get('season'));
    const f=library.formulas.find(f=>f.id===resolvedId);
    if(f){
      let selected;
      try{selected=selectReference(f,legacyReferenceSelection(f.id,Object.fromEntries(q)));}catch(error){return invalid(error.message);}
      if(requestedSeason&&requestedSeason!==selected.season&&knownSeasonMove(requestedSeason,requestedId)!==selected.season)return invalid('链接季节与这套穿法不一致');
      const canonical=referenceHref(f,selected.style,selected.variant.id,selected.accessory);
      const adapted=legacyReferenceSelection(f.id,Object.fromEntries(q));
      const migrated=page!=='formulas'||resolvedId!==requestedId||requestedSeason!==selected.season||adapted.style!==q.get('style')&&q.has('style')||adapted.palette!==q.get('palette')&&q.has('palette');
      return {page:'formulas',section:selected.season,id:f.id,styleId:selected.style.id,selection:selected,...(migrated?{redirect:canonical}:{})};
    }
    if(requestedId)return invalid('指定的参考公式不存在');
    if(page!=='formulas'||section&&section!=='library'&&!library.seasons.some(s=>s.id===section))return invalid('指定的参考季节不存在');
    return {page:'formulas',section:section||'library',id:null};
  }
  return {page:'outfits',id:null};
}
export function referenceContext(hash,catalog=library){
  const r=appRoute(hash,catalog);
  if(r.page!=='formulas'||!r.id)return null;
  const formula=catalog.formulas.find(f=>f.id===r.id);
  const selected=r.selection;
  return {...formula,studyStyle:selected.style,studyVariant:selected.variant,studyAccessory:selected.accessory,studySeason:selected.season,requirements:selected.style.requirements};
}
