import {esc,thumbnail,codeBadge,garmentImageBadge} from './shared.js';
import {displayCode} from '../communication-codes.js';
import {compactSelection} from '../data-schema.js';
import {ownedCard} from './owned.js';
import {roleNames} from '../garment-model.js';
import {outfitFilters,outfitListHref,mixListHref,outfitTitle,outfitSeasonName,outfitStyleNames} from '../outfit-model.js';
import {dataStatus} from './data-status.js';
import {basicName} from '../assumed-basics.js';

const visualLabel=outfit=>(outfit.visual.kind==='ai'?(outfit.outfitKind==='planned'?'AI 搭配示意':'AI 实物搭配示意'):'实际穿着照片')+(outfit.outfitKind==='planned'?' · 含未购单品':'')+(outfit.assumedBasics?.length?' · 含假设基础内搭':'');
function shoppingDetails(outfit){
  if(outfit.outfitKind!=='planned')return '';
  return `<section class="note-block" data-planned-outfit><h3>待购搭配 · 尚未配齐</h3>${outfit.suggestedPieces.map(p=>`<p><strong>${esc(p.name)}</strong> · ${esc(p.color.name)} · ${esc(roleNames[p.slot])}未购</p><p>${esc(p.specification)}</p>`).join('')}<p>已按你的选择保存在「我的搭配」。上面的未购单品不在衣橱中，不计入已拥有衣物；其余衣物关联仍来自数据库。</p></section>`;
}
function assumptionDetails(outfit){
  if(!outfit.assumedBasics?.length)return '';
  return `<div class="sources" data-assumed-basics><p>假设基础内搭 · 按你的授权假设已有，未计入衣橱。</p><ul>${outfit.assumedBasics.map(b=>`<li>${esc(basicName(b))}：${esc(b.exposure)}；仅小面积露出（不超过 ${b.maxVisibleBandCm} cm）。</li>`).join('')}</ul></div>`;
}
function outfitHero(outfit,items,catalogStatus='ready'){
  if(outfit.visual)return `<button class="outfit-visual" data-owned-image="${esc(outfit.id)}" aria-label="放大搭配：${esc(outfitTitle(outfit))}"><img src="${esc(outfit.visual.src)}" alt="${esc(outfit.visual.alt)}" loading="lazy" width="1024" height="1536"><span>${visualLabel(outfit)}<b>放大 ↗</b></span></button>`;
  if(catalogStatus!=='ready')return dataStatus('catalog','衣物档案',catalogStatus);
  return `<div class="outfit-composition">${Object.entries(compactSelection(outfit.selection)).map(([slot,id])=>{const item=items.find(i=>i.id===id);return `<div class="outfit-piece"><span>${roleNames[slot]}</span>${item?`<img src="${esc(thumbnail(item))}" alt="${esc(item.name)}" loading="lazy">${garmentImageBadge(item)}`:`<p>衣物 ${esc(id)} 暂不在档案中</p>`}</div>`;}).join('')}</div><p class="outfit-caption">${outfit.outfitKind==='planned'?'含未购单品的组合':'真实衣物组合'} · 尚无上身示意图</p>`;
}
function garmentIds(outfit,items,catalogStatus='ready'){
  if(catalogStatus!=='ready')return `<p class="sources">${Object.values(compactSelection(outfit.selection)).map(esc).join(' · ')} · 档案暂未读取</p>`;
  return `<div class="outfit-id-list" aria-label="这套的衣物编号">${Object.entries(compactSelection(outfit.selection)).map(([slot,id])=>{const item=items.find(i=>i.id===id);return item?`<button class="outfit-id" data-detail="${esc(id)}" title="${esc(item.name)}" aria-label="${roleNames[slot]} ${esc(displayCode(item))}：${esc(item.name)}">${roleNames[slot]} <b>${esc(displayCode(item))}</b></button>`:`<span class="outfit-id">${esc(id)} 暂不在档案中</span>`;}).join('')}${(outfit.suggestedPieces||[]).map(p=>`<span class="outfit-id" data-unowned-piece>${esc(roleNames[p.slot])}未购 · ${esc(p.name)}</span>`).join('')}</div>`;
}
const categories=outfit=>[outfitSeasonName(outfit.season),...outfitStyleNames(outfit)].join(' · ');
export function outfitFilterControls(outfits,state,{href=outfitListHref}={}){
  const link=(href,label,count,active)=>`<a class="btn" href="${href}" ${active?'aria-current="page"':''}>${label}<span>${count} 套</span></a>`;
  return `<div class="outfit-filters"><nav class="wardrobe-tabs owned-layers" aria-label="搭配季节">${link(href(),'全部',outfits.length,state.season==='all')}${state.seasons.map(s=>link(href({season:s.id}),s.name,s.count,state.season===s.id)).join('')}</nav><nav class="wardrobe-tabs subcategory-tabs" aria-label="搭配风格">${link(href({season:state.season}),'全部风格',state.inSeason.length,state.style==='all')}${state.styles.map(s=>link(href({season:state.season,style:s.id}),s.name,s.count,state.style===s.id)).join('')}</nav></div>`;
}
export function outfitCards(outfits,items,{catalogStatus='ready',query=''}={}){
  return outfits.map(o=>`<article class="real-outfit-card" data-outfit-id="${esc(o.id)}">${outfitHero(o,items,catalogStatus)}<div class="outfit-card-copy"><a class="code-link" href="#outfits/${encodeURIComponent(o.id)}${query?'?'+query:''}" aria-label="查看搭配 ${esc(o.code||o.id)}">${codeBadge(o)}</a><p class="outfit-category">${categories(o)}</p><h2><a href="#outfits/${encodeURIComponent(o.id)}${query?'?'+query:''}">${esc(outfitTitle(o))}</a></h2>${o.wearingNotes?.length?`<p class="outfit-wearing-cue">${esc(o.wearingNotes[0])}</p>`:''}${garmentIds(o,items,catalogStatus)}<a class="outfit-card-link text-button" href="#outfits/${encodeURIComponent(o.id)}${query?'?'+query:''}">衣物与穿法说明 ↗</a></div></article>`).join('');
}
export function realOutfits({outfits=[],items=[],dataError=false,personalStatus='ready',catalogStatus='ready',referenceStatus='ready',resolveReference=()=>null,relationships=null,outfitId=null,outfitSeason='all',outfitStyle='all',outfitReturnTo='outfits'}){
  if(personalStatus==='loading')return '<div class="intro"><h1>我的搭配</h1></div>'+dataStatus('personal','我的搭配','loading');
  const state=outfitFilters(outfits,{season:outfitSeason,style:outfitStyle});
  const selected=outfitId&&outfits.find(o=>o.id===outfitId||o.code===outfitId);
  if(outfitId&&!dataError)return selected?outfitDetail(selected,items,state,catalogStatus,resolveReference,referenceStatus,relationships,outfitReturnTo):'<div class="intro"><div><h1>暂未找到这套搭配</h1><p>记录可能尚未同步；没有修改已有搭配。</p><a class="btn" href="#outfits">返回我的搭配</a></div></div>';
  const query=outfitListHref(state).split('?')[1];
  const planned=outfits.filter(o=>o.outfitKind==='planned').length;
  return `<div class="intro lookbook-intro"><div><span class="eyebrow">MY OUTFIT LOOKBOOK</span><h1>我的搭配</h1><p>直接看上身与穿法。以你的衣物为主，假设基础内搭另行标明。</p>${planned?`<p class="sources" data-planned-summary>其中 ${planned} 套含未购单品，已在卡片标明；未购单品不计入衣橱。</p>`:''}</div></div>
    ${!dataError?outfitFilterControls(outfits,state):''}<div class="outfit-page-tools"><span role="status">${dataError?'暂未读取':state.visible.length+' 套搭配'}</span><a class="text-button" href="#formulas/notes">搭配笔记</a></div>
    <p class="lookbook-disclaimer">AI 实物搭配示意 · 不是本人试穿，细节与合身度以实物为准。</p>
    ${!dataError?dataStatus('catalog','衣物档案',catalogStatus):''}
    <div class="outfits-grid real-outfits">${dataError?'<p>记录恢复后会在这里显示，不代表搭配为空。</p>':outfitCards(state.visible,items,{catalogStatus,query})||`<section class="empty"><h2>${outfits.length?'这个季节还没有保存的搭配':'从已有衣物，留下第一套搭配'}</h2><p>在 Codex 里告诉我喜欢的穿法或衣物编号，我会核对组合并生成搭配图。</p><a class="btn" href="${outfits.length?'#outfits':'#closet'}">${outfits.length?'查看全部搭配':'看已有衣物'}</a></section>`}</div>
    `;
}
function outfitDetail(outfit,items,state,catalogStatus,resolveReference,referenceStatus,relationships,returnTo){
  const href=resolveReference(outfit.sourceReference||outfit.route);
  const hasReference=outfit.sourceReference||/^#(?:formulas|workbench|analysis)\/[^?/#]+/.test(outfit.route||'');
  const reference=href?`<a class="text-button" href="${esc(href)}">查看来源穿法 ↗</a>`:hasReference?`<p class="sources">${referenceStatus!=='ready'?'来源参考暂未读取；不影响查看这套搭配。':'原参考链接暂不可用；当前搭配仍保留。'}</p>`:'';
  const origin=relationships?.origins.find(r=>r.outfitId===outfit.id);
  const derived=outfit.derivedFromOutfitId?(origin?origin.available?`<p class="sources">由 <a class="text-button" data-outfit-origin href="#outfits/${encodeURIComponent(origin.sourceId)}">${esc(origin.sourceCode||origin.sourceTitle)} 延伸 ↗</a></p>`:'<p class="sources">原搭配已移除；当前搭配及其衣物关联仍保留。</p>':'<p class="sources">原搭配关联暂未读取；当前搭配仍保留。</p>'):'';
  const source=derived+reference;
  const garments=catalogStatus==='ready'?`<div class="flow-cards">${Object.entries(compactSelection(outfit.selection)).map(([slot,id])=>{const item=items.find(i=>i.id===id);return `<div><h3>${roleNames[slot]}</h3>${item?ownedCard(item):`<p class="empty">${esc(id)} 暂不在档案中，已保留原搭配关联。</p>`}</div>`;}).join('')}</div>`:dataStatus('catalog','衣物档案',catalogStatus);
  return `<div class="intro"><div><span class="eyebrow">${categories(outfit)}</span>${codeBadge(outfit)}<h1>${esc(outfitTitle(outfit))}</h1><p>${outfit.outfitKind==='planned'?'含未购单品的待购搭配，尚未配齐。':'你的衣物，你的搭配。'}点图可放大查看。</p></div><a class="btn" href="${returnTo==='mix'?mixListHref(state):outfitListHref(state)}">← ${returnTo==='mix'?'随心配':'我的搭配'}</a></div>
    <div class="outfit-detail-layout"><section class="outfit-detail-hero">${outfitHero(outfit,items,catalogStatus)}</section><section class="outfit-wearing"><h2>图里这样穿</h2>${outfit.wearingNotes?.length?`<ul>${outfit.wearingNotes.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:'<p>这套保留了已选的真实衣物，尚未补充专属穿法说明。</p>'}${garmentIds(outfit,items,catalogStatus)}${source}<p class="sources">AI 图不是本人试穿；衣物的细纹、字标与实际合身度以实物为准。</p></section></div>
    <section class="outfit-garments"><h2>这套用到的衣物</h2>${shoppingDetails(outfit)}${assumptionDetails(outfit)}${garments}</section>`;
}
export function ownedImageDialog(outfit){
  return `<div class="dialog-head">${codeBadge(outfit)}<h2 id="outfit-image-title">${esc(outfitTitle(outfit))}</h2><button class="close-btn" data-close="outfit-image" aria-label="关闭搭配大图">×</button></div><img class="owned-lightbox-image" src="${esc(outfit.visual.src)}" alt="${esc(outfit.visual.alt)}"><p class="sources">${visualLabel(outfit)} · 细节与合身度以实物为准</p>${shoppingDetails(outfit)}${assumptionDetails(outfit)}`;
}
