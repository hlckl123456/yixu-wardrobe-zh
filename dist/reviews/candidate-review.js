import {outfitFilters,outfitSeasons,outfitSeasonName,outfitStyleNames} from '../outfit-model.js';
import {validateAssumedBasics,basicName} from '../assumed-basics.js';
import {validateSuggestedPieces} from './suggested-pieces.js';
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots={outer:'外层',middle:'中间层',inner:'内搭',bottom:'下装',shoes:'鞋',belt:'皮带',bag:'包',accessory:'配饰'};
let candidates=[],withheldCandidates=[],withdrawnCandidates=[],season='all',style='all',trigger=null;
const expectedCount=Number(document.body.dataset.expectedCount);
const ready=c=>c.status==='reviewed'&&c.visual;
function assumptionSummary(c){return (c.suggestedPieces||[]).length?' · 含未购单品':(c.assumedBasics||[]).length?' · 含假设基础内搭':'';}
function assumptions(c){return (c.assumedBasics||[]).length?`<h3>假设已有的基础内搭</h3><ul>${c.assumedBasics.map(b=>`<li><span style="display:inline-block;width:14px;height:14px;background:${esc(b.color.hex)};border:1px solid #aaa;border-radius:50%;vertical-align:middle"></span> ${esc(basicName(b))}：${esc(b.exposure)}</li>`).join('')}</ul><p class="notice">按你的许可作配色假设；没有实拍档案、衣物编号，也未计入衣橱。选中后仍保留这项说明。</p>`:'';}
function suggestions(c){return c.suggestedPieces?.length?`<section data-shopping-concept><h3>建议单品 · 尚未拥有</h3>${c.suggestedPieces.map(p=>`<p><strong>${esc(p.name)}</strong> · ${esc(p.color.name)}</p><p>${esc(p.reason)}</p><p>挑选要点：${esc(p.specification)}</p>`).join('')}<p class="notice">这是购买方向，不是已拥有衣物，也不是精确商品效果。先告诉我是否喜欢，再确认单品；本页不会把建议加入衣橱或正式搭配。</p></section>`:'';}
function comparison(c){
  if(!c.comparison)return '';
  const swap=c.comparison.kind==='garment-swap',original=swap?'原搭配':'原配色',proposal=swap?'换单件后':'建议配色';
  return `<p class="notice">${swap?'已有搭配的单件替换':'已有搭配的内搭配色方案'}：<a href="/#outfits/${encodeURIComponent(c.comparison.outfitId)}">${esc(c.comparison.code)} 原搭配</a>。原记录和图片未改动。</p>${c.comparison.visualSrc?`<details class="color-comparison"><summary>${swap?'展开原搭配与换单件对照':'展开原图与新配色对照'}</summary><div class="comparison-pair"><figure><img src="/${esc(c.comparison.visualSrc)}" alt="${esc(c.comparison.code)} ${original}" loading="lazy"><figcaption>${esc(c.comparison.code)} ${original}</figcaption></figure><figure><img src="${esc(c.visual.src)}" alt="${esc(c.code)} ${proposal}" loading="lazy"><figcaption>${esc(c.code)} ${proposal}</figcaption></figure></div></details>`:''}`;
}
function chip(id,name,count,selected,type){return `<button type="button" data-${type}="${esc(id)}" aria-pressed="${id===selected}">${esc(name)}<small>${count}</small></button>`;}
function render(){
  const f=outfitFilters(candidates,{season,style});season=f.season;style=f.style;
  $('seasons').innerHTML=chip('all','全部',candidates.length,season,'season')+f.seasons.map(s=>chip(s.id,s.name,s.count,season,'season')).join('');
  $('styles').innerHTML=chip('all','全部风格',f.inSeason.length,style,'style')+f.styles.map(s=>chip(s.id,s.name,s.count,style,'style')).join('');
  const q=$('query').value.trim().toLowerCase(),visible=f.visible.filter(c=>!q||[c.code,c.title,c.comparison?.code,...c.garments.flatMap(g=>[g.code,g.name]),...(c.suggestedPieces||[]).flatMap(p=>[p.name,p.color.name,'未购'])].join(' ').toLowerCase().includes(q));
  $('count').textContent=`${visible.length} 套 · ${visible.filter(ready).length} 套配图已复核`;
  $('grid').innerHTML=visible.map(c=>`<article class="card"><button type="button" class="image-button" data-code="${c.code}" aria-label="查看 ${c.code} ${esc(c.title)}" ${ready(c)?'':'disabled'}>${ready(c)?`<img src="${esc(c.visual.thumbnail)}" width="480" height="720" alt="${esc(c.title)}，AI 上身示意" loading="lazy">`:'<span class="placeholder">配图制作中<small>复核后开放查看</small></span>'}<span class="code">${c.code}</span></button><h3>${esc(c.title)}</h3><p class="meta">${outfitSeasonName(c.season)} · ${outfitStyleNames(c).join(' / ')}${ready(c)?' · AI 示意':''}</p><p class="garment-codes">${c.garments.map(g=>g.code).join(' · ')}</p></article>`).join('');
  $('grid').querySelectorAll('.card .meta').forEach((el,n)=>{el.textContent+=assumptionSummary(visible[n]);});
  $('empty').hidden=visible.length>0;
}
function openCandidate(code){
  const c=candidates.find(c=>c.code===code);if(!c){const held=[...withheldCandidates,...withdrawnCandidates].find(c=>c.code===code);$('error').textContent=held?`${held.code}：${held.reason}`:'这个候选编号不存在。请检查 HX 编号。';$('error').hidden=false;return;}
  if(!ready(c)){$('error').textContent=`${code} 的配图仍在复核，请稍后查看。`;$('error').hidden=false;return;}
  $('error').hidden=true;
  $('detail-body').innerHTML=`<img class="detail-visual" src="${esc(c.visual.src)}" alt="${esc(c.title)}，AI 上身示意"><section class="detail-copy"><div class="detail-code">${c.code}</div><h2 id="detail-title">${esc(c.title)}</h2><p class="meta">${outfitSeasonName(c.season)} · ${outfitStyleNames(c).join(' / ')}</p><p class="notice">喜欢这套？直接告诉我「${c.code}」。此页不保存选择，也不会自动录入。</p><h3>这样穿</h3><ol>${c.wearingNotes.map(n=>`<li>${esc(n)}</li>`).join('')}</ol><h3>用到你的这些衣物</h3><div class="pieces">${c.garments.map(g=>`<a class="piece" href="/${esc(g.asset)}" target="_blank" rel="noopener" aria-label="在新标签页查看 ${g.code} 衣物整理图"><img src="/${esc(g.asset)}" alt="${esc(g.name)}" loading="lazy"><strong>${g.code}</strong>${esc(g.name)}<br><span>${slots[g.slot]||esc(g.slot)}</span></a>`).join('')}</div><p class="notice">AI 上身示意，不代表实物尺寸或精确试穿。衣物原有图案及面料细节以实物为准。</p></section>`;
  $('detail-body').querySelector('.detail-copy').insertAdjacentHTML('beforeend',assumptions(c)+suggestions(c)+comparison(c));
  if(!$('detail').open)$('detail').showModal();$('detail').scrollTop=0;$('close').focus();
}
function syncHash(){let code;try{code=decodeURIComponent(location.hash.slice(1));}catch{code='invalid';}if(code)openCandidate(code.toUpperCase());else if($('detail').open)$('detail').close();}
$('seasons').addEventListener('click',e=>{const b=e.target.closest('[data-season]');if(!b)return;season=b.dataset.season;style='all';render();$('seasons').querySelector('[aria-pressed=true]')?.focus();});
$('styles').addEventListener('click',e=>{const b=e.target.closest('[data-style]');if(!b)return;style=b.dataset.style;render();$('styles').querySelector('[aria-pressed=true]')?.focus();});
$('query').addEventListener('input',render);
$('grid').addEventListener('click',e=>{const b=e.target.closest('[data-code]');if(!b||b.disabled)return;trigger=b;location.hash=b.dataset.code;});
$('close').addEventListener('click',()=>$('detail').close());
$('detail').addEventListener('close',()=>{history.replaceState(null,'',location.pathname+location.search);trigger?.focus({preventScroll:true});});
window.addEventListener('hashchange',syncHash);
try{
  const response=await fetch('candidates.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!Number.isSafeInteger(expectedCount)||expectedCount<1||!Array.isArray(data.candidates)||data.candidates.length!==expectedCount)throw Error('候选清单不完整');
  if(new Set(data.candidates.map(c=>c.code)).size!==expectedCount||data.candidates.some(c=>!/^HX\d{3,}$/.test(c.code)||!Array.isArray(c.garments)||!Array.isArray(c.wearingNotes)))throw Error('候选编号或内容无效');
  for(const c of data.candidates){
    validateAssumedBasics(c.assumedBasics);validateSuggestedPieces(c.suggestedPieces);
    if(c.suggestedPieces?.some(p=>c.selection?.[p.slot]))throw Error('建议单品不能与真实衣物占用同一位置');
    if(c.comparison?.visualSrc&&!/^assets\/outfits\/[\w/-]+\.(png|jpg|webp)$/.test(c.comparison.visualSrc))throw Error('原搭配图片路径无效');
  }
  const held=data.withheldCandidates||[];
  if(!Array.isArray(held)||held.some(c=>!/^HX\d{3,}$/.test(c.code)||typeof c.reason!=='string'||!c.reason.trim()||data.candidates.some(active=>active.code===c.code))||new Set(held.map(c=>c.code)).size!==held.length)throw Error('暂缓候选记录无效');
  withheldCandidates=held;
  const removed=data.withdrawnCandidates||[];
  if(!Array.isArray(removed)||removed.some(c=>!/^HX\d{3,}$/.test(c.code)||typeof c.reason!=='string'||!c.reason.trim()||data.candidates.some(active=>active.code===c.code)||held.some(h=>h.code===c.code))||new Set(removed.map(c=>c.code)).size!==removed.length)throw Error('移除候选记录无效');
  withdrawnCandidates=removed;
  candidates=data.candidates;const complete=candidates.filter(ready).length;
  $('progress').textContent=`${complete} / ${expectedCount} 套配图已复核 · ${outfitSeasons.map(s=>s.name+' '+candidates.filter(c=>c.season===s.id).length).join(' / ')}`;render();syncHash();
}catch(error){$('progress').textContent='候选清单读取失败';$('error').textContent='暂时无法读取候选搭配，请刷新页面重试。';$('error').hidden=false;console.error(error);}
