import {inventory} from './garment-model.js';
import {workspaceRoute} from './app-route.js';
import {createLocalRepository} from './local-repository.js';
import {emptyPreferences} from './data-schema.js';
import {esc} from './views/shared.js';
import {createJsonResource,validateCatalog} from './resource-repository.js';
import {dataStatus} from './views/data-status.js';
import {garmentUsageCounts} from './outfit-relationships.js';
import {createOutfitMixer,mixableOutfits} from './mix-model.js';
import {outfitListHref,mixListHref} from './outfit-model.js';
import {savedOutfitsView,mixView,closetView,outfitDetailView,garmentDetailView,outfitZoomView,personalNotesView,refinedMixFilters} from './views/personal.js';

const $=selector=>document.querySelector(selector);
const storage=(()=>{try{return localStorage;}catch{return null;}})();
const repository=createLocalRepository(storage),catalog=createJsonResource('data/catalog.json',{validate:validateCatalog}),mixer=createOutfitMixer();
const positions=new Map(),lastRoutes=new Map(),dialogRecords=new WeakMap();
let data=emptyPreferences(),personalStatus='loading',readError=null,personalInitialized=false,personalPending=null,pendingRender=false;
let currentHash=location.hash,advance=false,pendingFocus=null;
history.scrollRestoration='manual';
window.addEventListener('scroll',()=>positions.set(currentHash,scrollY),{passive:true});
const items=()=>inventory(catalog.state().data||{items:[]});
function focusKey(element){
 if(!element?.matches('button,a,select'))return null;
 for(const attribute of ['data-filter-key','data-close','data-outfit','data-garment','data-outfit-image','data-related-outfit','data-next','data-filter','data-closet-filter','data-mood','href'])if(element.hasAttribute(attribute)){
  const selector=element.tagName.toLowerCase()+`[${attribute}="${CSS.escape(element.getAttribute(attribute))}"]`;
  return {selector,index:[...document.querySelectorAll(selector)].indexOf(element)};
 }
 return null;
}
function restoreFocus(key){if(key)document.querySelectorAll(key.selector)[key.index]?.focus({preventScroll:true});}
function route(){
 let r=workspaceRoute(location.hash);
 if(r.redirect){history.replaceState(null,'',r.redirect);currentHash=location.hash;r=workspaceRoute(location.hash);}
 return {...r,q:new URLSearchParams(location.hash.split('?')[1]||'')};
}
const titles={outfits:'我的搭配',mix:'随心配',closet:'我的衣橱',discard:'准备丢弃',notes:'搭配笔记'};
function render(preserve=false){
 const y=scrollY,focus=preserve?focusKey(document.activeElement):null,disclosures=preserve?[...document.querySelectorAll('#main details')].map(d=>d.open):[];
 const {page,id,q}=route(),catalogStatus=catalog.state().status,season=q.get('season')||'all',style=q.get('style')||'all';
 if(!id&&['outfits','mix','closet'].includes(page))lastRoutes.set(page,location.hash||'#outfits');
 document.title='衣序 · '+(page==='closet'&&q.get('view')==='overview'?'衣橱概览':titles[page]);
 document.querySelectorAll('[data-page]').forEach(a=>{a.href=lastRoutes.get(a.dataset.page)||'#'+a.dataset.page;if(a.dataset.page===(page==='discard'?'closet':page==='notes'?'outfits':page))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 $('#notes-footer').hidden=personalStatus!=='ready'||data.saved.length===0;
 let content;
 if(['outfits','mix','notes'].includes(page)&&personalStatus!=='ready')content=`<section class="page-heading"><h1>${titles[page]}</h1></section>`+dataStatus('personal',titles[page],personalStatus);
 else if(['closet','discard','mix'].includes(page)&&catalogStatus!=='ready')content=`<section class="page-heading"><h1>${titles[page]}</h1></section>`+dataStatus('catalog','衣物档案',catalogStatus);
 else if(page==='outfits'&&id){
  const outfit=data.outfits.find(o=>o.id===id||o.code===id),fromMix=q.get('from')==='mix',back=fromMix?mixListHref({season,style}):outfitListHref({season,style});
  content=outfit?`<div class="detail-page-heading"><a class="quiet-link" href="${back}">← ${fromMix?'随心配':'我的搭配'}</a></div><div class="detail-page">${outfitDetailView(outfit,items(),{asPage:true,catalogStatus,relationships:repository.relationships()})}</div>`:'<section class="empty"><h1>暂未找到这套搭配</h1><p>可以先返回列表查看。</p><a href="#outfits">返回我的搭配</a></section>';
 }else if(page==='outfits')content=(catalogStatus==='ready'?'':dataStatus('catalog','衣物档案',catalogStatus))+savedOutfitsView({outfits:data.outfits,season,style});
 else if(page==='mix'){
  const filters=refinedMixFilters(mixableOutfits(data.outfits,items()),{season,style}),batch=mixer.select(filters.visible,{key:filters.season+'|'+filters.style,advance});
  content=mixView({filters,batch});
 }else if(page==='notes')content=personalNotesView(data.saved);
 else content=closetView({items:items(),layer:q.get('layer')||'all',group:q.get('group')||'all',usage:q.get('usage')||'all',usageCounts:personalStatus==='ready'?garmentUsageCounts(repository.relationships()):null,personalStatus,pending:page==='discard',overview:q.get('view')==='overview'});
 advance=false;
 $('#main').innerHTML=content;
 if(readError&&personalStatus==='error')$('#main [data-resource-state]')?.setAttribute('title',readError.message);
 if(preserve){document.querySelectorAll('#main details').forEach((d,i)=>{if(disclosures[i]!==undefined)d.open=disclosures[i];});restoreFocus(focus);window.scrollTo(0,y);}
 if(pendingFocus){restoreFocus(pendingFocus);pendingFocus=null;}
}
function dialogHtml(meta){
 if(meta.kind==='garment'){
  const item=items().find(i=>i.id===meta.recordId);
  return item?garmentDetailView(item,data.outfits,{relationships:repository.relationships(),personalStatus}):'<button class="close" data-close="garment-detail" aria-label="关闭衣物详情">×</button><p class="empty">这件衣物暂时不在当前档案中。</p>';
 }
 const outfit=data.outfits.find(o=>o.id===meta.recordId);
 if(!outfit)return `<button class="close" data-close="${meta.kind==='image'?'outfit-image':'outfit-detail'}" aria-label="关闭搭配详情">×</button><p class="empty">这套搭配暂时不在当前列表中。</p>`;
 return meta.kind==='image'?outfitZoomView(outfit):outfitDetailView(outfit,items(),{catalogStatus:catalog.state().status,relationships:repository.relationships()});
}
function openDialog(id,kind,recordId,trigger){
 const dialog=$('#'+id),meta={kind,recordId,trigger:focusKey(trigger),hash:location.hash};
 dialogRecords.set(dialog,meta);dialog.innerHTML=dialogHtml(meta);dialog.showModal();
}
function refreshOpenDialogs(){
 const focus=focusKey(document.activeElement);
 for(const dialog of document.querySelectorAll('dialog[open]')){
  const meta=dialogRecords.get(dialog);if(!meta)continue;
  const html=dialogHtml(meta);if(dialog.innerHTML!==html){const y=dialog.scrollTop;dialog.innerHTML=html;dialog.scrollTop=y;}
 }
 restoreFocus(focus);
}
function renderWhenSafe(){refreshOpenDialogs();if(document.querySelector('dialog[open]'))pendingRender=true;else render(true);}
function refresh(){
 if(!personalPending)personalPending=(async()=>{
  const before=JSON.stringify([data,personalStatus,repository.relationships()]);
  try{data=await(personalInitialized?repository.read():repository.initialize());personalInitialized=true;personalStatus='ready';readError=null;}
  catch(error){readError=error;personalStatus='error';}
  finally{if(before!==JSON.stringify([data,personalStatus,repository.relationships()]))renderWhenSafe();}
 })().finally(()=>{personalPending=null;});
 return personalPending;
}
async function refreshCatalog(){if(await catalog.refresh())renderWhenSafe();}
document.addEventListener('click',async event=>{
 const skip=event.target.closest('a.skip');if(skip){event.preventDefault();$('#main').focus();return;}
 const origin=event.target.closest('.origin-note a');if(origin)for(const d of document.querySelectorAll('dialog[open]'))d.close();
 const filter=event.target.closest('[data-filter-link]');if(filter&&new URL(filter.href).hash!==location.hash)pendingFocus=focusKey(filter);
 const button=event.target.closest('button');if(!button)return;const a=button.dataset;
 if(a.resourceRetry){if(a.resourceRetry==='personal')await refresh();else if(a.resourceRetry==='catalog')await refreshCatalog();return;}
 if(a.close){$('#'+a.close)?.close();return;}
 if(button.hasAttribute('data-next')){advance=true;render(true);return;}
 if(a.outfit){openDialog('outfit-detail','outfit',a.outfit,button);return;}
 if(a.garment){openDialog('garment-detail','garment',a.garment,button);return;}
 if(a.outfitImage){openDialog('outfit-image','image',a.outfitImage,button);return;}
 if(a.relatedOutfit){$('#garment-detail').close();if($('#outfit-detail').open)$('#outfit-detail').close();openDialog('outfit-detail','outfit',a.relatedOutfit,button);return;}
});
document.addEventListener('change',event=>{
 const key=event.target.dataset.filter||event.target.dataset.closetFilter;if(!key)return;
 const {page,q}=route();if(event.target.value==='all')q.delete(key);else q.set(key,event.target.value);
 if(key==='season'&&page==='outfits')q.delete('style');
 location.hash=page+(q.size?'?'+q:'');
});
window.addEventListener('hashchange',()=>{
 currentHash=location.hash;for(const d of document.querySelectorAll('dialog[open]'))d.close();render();
 window.scrollTo(0,positions.get(currentHash)||0);
});
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{
 if(pendingRender&&!document.querySelector('dialog[open]')){pendingRender=false;render(true);}
 const meta=dialogRecords.get(dialog);if(meta?.hash===location.hash)restoreFocus(meta.trigger);
});
function sync(){if(document.hidden)return;void refresh();void refreshCatalog();}
window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);setInterval(sync,5000);
render();void refresh();void refreshCatalog();
