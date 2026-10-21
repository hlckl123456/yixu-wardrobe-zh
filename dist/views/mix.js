import {icon} from './shared.js';
import {dataStatus} from './data-status.js';
import {mixListHref} from '../outfit-model.js';
import {outfitFilterControls,outfitCards} from './outfits.js';

export function mixOutfits({items=[],mixPool=[],mixFilters,mixBatch,personalStatus='ready',catalogStatus='ready'}){
  const intro='<div class="intro lookbook-intro"><div><span class="eyebrow">OUTFIT SHUFFLE</span><h1>随心配</h1><p>选个范围，每次看4套。换一批，换个心情。</p></div></div>';
  if(personalStatus!=='ready')return intro+dataStatus('personal','已保存搭配',personalStatus);
  if(catalogStatus!=='ready')return intro+dataStatus('catalog','衣物档案',catalogStatus);
  const {outfits,total,batchNumber,canAdvance}=mixBatch;
  const query=new URLSearchParams({from:'mix'});
  if(mixFilters.season!=='all')query.set('season',mixFilters.season);
  if(mixFilters.style!=='all')query.set('style',mixFilters.style);
  return intro+outfitFilterControls(mixPool,mixFilters,{href:mixListHref})+
    `<div class="outfit-page-tools mix-toolbar"><span role="status" aria-live="polite" aria-atomic="true">第${batchNumber}批 · 本批${outfits.length}套 · 范围内${total}套</span><button class="btn primary" type="button" data-mix-next ${canAdvance?'':'disabled'}>${icon('shuffle')}换一批</button></div>
    <p class="lookbook-disclaimer">从已有配图、衣物仍在用的已保存搭配中挑选，优先看还没展示过的。AI图不是本人试穿。</p>
    ${total>0&&!canAdvance?`<p class="mix-pool-note">这个范围只有${total}套，已全部展示。扩大范围可以换一批。</p>`:''}
    <div class="outfits-grid real-outfits mix-outfits">${outfits.length?outfitCards(outfits,items,{query:query.toString()}):`<section class="empty"><h2>${mixPool.length?'这个范围还没有可用搭配':'暂时没有可用的已保存搭配'}</h2><p>${mixPool.length?'试试其他季节或风格。':'先去我的搭配看看，或在聊天里加入喜欢的搭配。'}</p><a class="btn" href="${mixPool.length?'#mix':'#outfits'}">${mixPool.length?'查看全部范围':'查看我的搭配'}</a></section>`}</div>`;
}
