import {inventory} from './garment-model.js';
import {baseRoute} from './app-route.js';
import {createLocalRepository} from './local-repository.js';
import {emptyPreferences} from './data-schema.js';
import {icon,esc} from './views/shared.js';
import {detailDialog,garmentOutfits} from './views/dialogs.js';
import {outfitsForGarment,garmentUsageCounts} from './outfit-relationships.js';
import {ownedCloset,pendingDiscardCloset} from './views/owned.js';
import {isActiveGarment,isPendingDiscard} from './garment-status.js';
import {realOutfits,ownedImageDialog} from './views/outfits.js';
import {notes} from './views/notes.js';
import {analysis} from './views/structure.js';
import {createJsonResource,validateCatalog,validateGuides} from './resource-repository.js';
import {dataStatus} from './views/data-status.js';

const $=selector=>document.querySelector(selector);
const storage=(()=>{try{return localStorage;}catch{return null;}})();
const repository=createLocalRepository(storage);
let data=emptyPreferences(),readError=null,personalStatus='loading',personalInitialized=false,personalPending=null,pendingRender=false,lightbox=null;
let referenceFeature=null,referenceStatus='loading';
const resources={catalog:createJsonResource('data/catalog.json',{validate:validateCatalog}),guides:createJsonResource('data/guides.json',{validate:validateGuides})};
const seasonBackgroundOpen={},positions=new Map(),dialogTriggers=new WeakMap();
let currentHash=location.hash;
history.scrollRestoration='manual';
window.addEventListener('scroll',()=>positions.set(currentHash,scrollY),{passive:true});
const items=()=>inventory(resources.catalog.state().data||{items:[]});
const titles={outfits:'我的搭配',closet:'我的衣橱',formulas:'穿搭参考',analysis:'衣橱结构',discard:'准备丢弃'};
$('#environment-label').textContent='本地衣橱 · 仅此设备';
$('#environment-label').title='个人记录保存在本机 SQLite；图片保存在本地项目。';
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));

function focusKey(element){
  if(!element?.matches('button,a'))return null;
  for(const attribute of ['data-detail','data-owned-image','data-study-image','data-study-palette','data-study-accessory','href'])if(element.hasAttribute(attribute)){
    const selector=element.tagName.toLowerCase()+`[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
    return {selector,index:[...document.querySelectorAll(selector)].indexOf(element)};
  }
  return null;
}
function restoreFocus(key){if(key)document.querySelectorAll(key.selector)[key.index]?.focus({preventScroll:true});}
function openDialog(id,html,trigger){const dialog=$('#'+id);dialogTriggers.set(dialog,{key:focusKey(trigger),hash:location.hash});dialog.innerHTML=html;dialog.showModal();}
function renderWhenSafe(){if(document.querySelector('dialog[open]'))pendingRender=true;else render(true);}
function refresh(){
  if(!personalPending)personalPending=(async()=>{
    const before=JSON.stringify([data,personalStatus,repository.relationships()]);
    try{data=await (personalInitialized?repository.read():repository.initialize());personalInitialized=true;readError=null;personalStatus='ready';return true;}
    catch(error){readError=error;personalStatus='error';return false;}
    finally{if(before!==JSON.stringify([data,personalStatus,repository.relationships()])){refreshOpenRelationships();renderWhenSafe();}}
  })().finally(()=>{personalPending=null;});
  return personalPending;
}
function refreshOpenRelationships(){
  const section=$('#detail[open] [data-garment-outfits]');if(!section)return;
  const focus=focusKey(document.activeElement),html=garmentOutfits(outfitsForGarment(section.dataset.garmentOutfits,data.outfits,repository.relationships()),personalStatus);
  if(section.innerHTML!==html){section.innerHTML=html;restoreFocus(focus);}
}
async function refreshResource(name){if(await resources[name].refresh())renderWhenSafe();}
async function loadReferences(){
  let timer;
  try{
    referenceFeature=await Promise.race([import('./reference-feature.js'),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('参考读取超时')),15000);})]);
    referenceStatus='ready';
  }catch{referenceStatus='error';}
  finally{clearTimeout(timer);renderWhenSafe();}
}
function route(hash){const base=baseRoute(hash);return base.page==='formulas'&&base.section!=='notes'&&referenceFeature?referenceFeature.appRoute(hash):base;}
const referenceContext=hash=>referenceFeature?.referenceContext(hash)||null;
function resolveReference(hash){const f=referenceContext(hash);return f?referenceFeature.referenceHref(f,f.studyStyle,f.studyVariant.id,f.studyAccessory):null;}
function currentRoute(){
  let r=route(location.hash);
  if(r.redirect){history.replaceState(null,'',r.redirect);currentHash=location.hash;r=route(r.redirect);}
  return r;
}
function render(preserve=false){
  const focus=preserve?focusKey(document.activeElement):null,y=scrollY;
  document.querySelectorAll('[data-season-background]').forEach(el=>seasonBackgroundOpen[el.dataset.seasonBackground]=el.open);
  const r=currentRoute(),q=new URLSearchParams(location.hash.split('?')[1]||'');
  const title=r.section==='notes'?'搭配笔记':titles[r.page];
  document.title=`衣序 · ${title}`;$('#breadcrumb').textContent='我的空间 / '+title;
  $('#nav-count').textContent=resources.catalog.state().status==='ready'?items().filter(isActiveGarment).length:'—';
  $('#discard-nav-count').textContent=resources.catalog.state().status==='ready'?items().filter(isPendingDiscard).length:'—';
  $('#outfit-nav-count').textContent=personalStatus==='ready'?data.outfits.length:'—';
  $('#outfit-nav-count').setAttribute('aria-label',personalStatus==='ready'?`共 ${data.outfits.length} 套搭配`:'搭配总数暂未读取');
  document.querySelectorAll('[data-route]').forEach(a=>{if(a.dataset.route===(r.section==='notes'?'outfits':r.page))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const catalogStatus=resources.catalog.state().status,guidesStatus=resources.guides.state().status;
  const context={items:items(),guides:resources.guides.state().data,catalogStatus,guidesStatus,personalStatus,referenceStatus,resolveReference,outfits:data.outfits,saved:data.saved,dataError:!!readError,outfitId:r.id,
    relationships:repository.relationships(),usageCounts:personalStatus==='ready'?garmentUsageCounts(repository.relationships()):null,closetUsage:q.get('usage')||'all',
    formulaRoute:r,studyFormula:referenceContext(location.hash),seasonBackgroundOpen,
    closetLayer:q.get('layer')||(r.page==='discard'?'all':'outer'),closetGroup:q.get('group')||'all',analysisLayer:q.get('layer')||'outer',
    outfitSeason:q.get('season')||'all',outfitStyle:q.get('style')||'all'};
  const recovery=readError&&r.page==='outfits'?`<section class="data-recovery" role="alert"><h2>本地记录暂时无法读取</h2><p>这不表示搭配或笔记为空。原数据未被修改。</p><button class="btn" data-resource-retry="personal">重新读取</button><p>${esc(readError.message)}</p></section>`:'';
  const referenceView=referenceStatus==='ready'?referenceFeature.referenceLibrary:()=>'<div class="intro"><h1>穿搭参考</h1></div>'+dataStatus('references','穿搭参考',referenceStatus)+'<p>不影响查看我的衣橱、已有搭配和笔记。</p>';
  const pages={outfits:realOutfits,closet:ownedCloset,discard:pendingDiscardCloset,formulas:r.section==='notes'?notes:referenceView,analysis};
  const catalogPage=['closet','analysis','discard'].includes(r.page);
  $('#main').innerHTML=recovery+(catalogPage&&catalogStatus!=='ready'?`<div class="intro"><h1>${title}</h1></div>`+dataStatus('catalog','衣物档案',catalogStatus):pages[r.page](context));
  const filters=$('.subcategory-tabs'),active=filters?.querySelector('[aria-current]');
  if(filters&&active){
    const bounds=filters.getBoundingClientRect(),selected=active.getBoundingClientRect();
    if(selected.right>bounds.right)filters.scrollLeft+=selected.right-bounds.right+8;
    else if(selected.left<bounds.left)filters.scrollLeft-=bounds.left-selected.left+8;
  }
  if(preserve){restoreFocus(focus);window.scrollTo(0,y);}
}
function showLightbox(){const {formula,images,index}=lightbox;$('#formula-image').innerHTML=referenceFeature.formulaImageDialog(formula,images,index);}
function openImages(formula,images,index,trigger){if(!images.length)return;lightbox={formula,images,index};openDialog('formula-image',referenceFeature.formulaImageDialog(formula,images,index),trigger);}
function scrollMatches(){$('#owned-matches')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('#owned-matches')?.focus({preventScroll:true});}
document.addEventListener('click',async event=>{
  if(event.target.closest('a.skip')){event.preventDefault();$('#main').focus();return;}
  const related=event.target.closest('a[data-related-outfit]');
  if(related){$('#detail').close();if(related.hash===location.hash)$('#main').focus();return;}
  const button=event.target.closest('button');if(!button)return;
  const a=button.dataset;
  if(a.resourceRetry){if(a.resourceRetry==='references'){location.reload();return;}if(a.resourceRetry==='personal')await refresh();else if(resources[a.resourceRetry])await refreshResource(a.resourceRetry);return;}
  if(a.close){$('#'+a.close)?.close();return;}
  if(a.detail){const item=items().find(i=>i.id===a.detail);if(item)openDialog('detail',detailDialog(item,{outfits:outfitsForGarment(item.id,data.outfits,repository.relationships()),status:personalStatus}),button);return;}
  if(a.ownedImage){const outfit=data.outfits.find(o=>o.id===a.ownedImage);if(outfit?.visual)openDialog('outfit-image',ownedImageDialog(outfit),button);return;}
  if(button.hasAttribute('data-scroll-matches')){scrollMatches();return;}
  if(a.studyPalette||a.studyAccessory){
    const f=referenceContext(location.hash);if(!f)return;
    const option=referenceFeature.selectReference(f,{style:f.studyStyle.id,accessory:a.studyAccessory||f.studyAccessory});
    const palette=a.studyPalette||(option.style.variants.some(v=>v.id===f.studyVariant.id)?f.studyVariant.id:undefined);
    const selected=referenceFeature.selectReference(f,{style:f.studyStyle.id,palette,accessory:option.accessory});
    history.replaceState(null,'',referenceFeature.referenceHref(f,selected.style,selected.variant.id,selected.accessory));currentHash=location.hash;
    render();$(`[data-${a.studyPalette?'study-palette':'study-accessory'}="${CSS.escape(a.studyPalette||a.studyAccessory)}"]`)?.focus({preventScroll:true});return;
  }
  if(a.studyImage){const f=referenceContext(location.hash);if(f)openImages(f,f.studyStyle.variants,f.studyStyle.variants.indexOf(f.studyVariant),button);return;}
  if(a.galleryStep&&lightbox){const index=lightbox.index+Number(a.galleryStep);if(index>=0&&index<lightbox.images.length){lightbox.index=index;showLightbox();}return;}
  if(a.formulaSources&&referenceFeature){openDialog('formula-sources',referenceFeature.formulaSources(),button);return;}
  if(a.inspectLayer){location.hash='closet?'+new URLSearchParams({layer:a.inspectLayer,group:a.inspectGroup});return;}
  if(a.analysisLayer){location.hash='analysis?layer='+a.analysisLayer;return;}
});
window.addEventListener('hashchange',()=>{currentHash=location.hash;for(const d of document.querySelectorAll('dialog[open]'))d.close();render();window.scrollTo(0,positions.get(currentHash)||0);});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{
  if(pendingRender&&!document.querySelector('dialog[open]')){pendingRender=false;render(true);}
  const trigger=dialogTriggers.get(dialog);if(trigger?.hash===location.hash)restoreFocus(trigger.key);
});
$('#formula-image').addEventListener('keydown',event=>{if(!lightbox||!['ArrowLeft','ArrowRight'].includes(event.key))return;const index=lightbox.index+(event.key==='ArrowRight'?1:-1);if(index>=0&&index<lightbox.images.length){event.preventDefault();lightbox.index=index;showLightbox();$('#formula-image [data-close]').focus();}});
function sync(){if(document.hidden)return;void refresh();for(const name of Object.keys(resources))void refreshResource(name);}
window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);setInterval(sync,5000);
render();
void refresh();for(const name of Object.keys(resources))void refreshResource(name);void loadReferences();
