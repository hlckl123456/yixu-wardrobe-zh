import {library,selectReference} from '../reference-model.js';
import {referenceHref} from '../navigation-model.js';
import {referenceArticle} from './reference-reader.js';
import {matchingPanel} from './owned.js';
import {esc,codeBadge} from './shared.js';
import {dataStatus} from './data-status.js';

export function referenceLibrary({formulaRoute:r,studyFormula,items=[],seasonBackgroundOpen={},catalogStatus='ready'}){
  if(r.error)return `<div class="intro"><div><h1>参考链接无效</h1><p>没有替你选择其他穿法。</p></div></div><section class="data-recovery" role="alert"><p>${esc(r.error)}</p><a class="btn" href="#formulas/library">返回穿搭参考</a></section>`;
  const season=library.seasons.find(s=>s.id===r.section);
  const entries=library.formulas.flatMap(formula=>formula.styles.map(style=>({formula,style})));
  const visible=entries.filter(e=>!season||e.style.seasons[0]===season.id);
  const current=studyFormula;
  return `<div class="formula-library reference-library"><div class="fl-heading"><div><span class="eyebrow">STYLE REFERENCES</span>${current?codeBadge(current.studyStyle):''}<h1>${current?esc(current.studyStyle.name):'穿搭参考'}</h1><p>从喜欢的穿法，回看自己的衣橱。参考图不是你已拥有的搭配。</p></div></div>
    <nav class="collection-seasons" aria-label="参考季节"><a href="#formulas/library" ${!season?'aria-current="page"':''}>全部<span>${entries.length}</span></a>${library.seasons.map(s=>`<a href="#formulas/${s.id}" ${s.id===season?.id?'aria-current="page"':''}>${s.name}<span>${entries.filter(e=>e.style.seasons[0]===s.id).length}</span></a>`).join('')}</nav>
    ${r.notice?`<p class="note-block">${esc(r.notice)}</p>`:''}
    ${current?`<div class="reference-back"><a class="text-button" href="#formulas/${r.section}">← 返回${esc(season?.name)}参考</a><button class="btn" data-scroll-matches>看我的衣物与缺项 ↓</button></div>${referenceArticle(current)}${catalogStatus==='ready'?matchingPanel(items,current):`<section id="owned-matches" tabindex="-1">${dataStatus('catalog','衣物档案',catalogStatus)}</section>`}`:
    `${season?background(season,visible,seasonBackgroundOpen[season.id]):''}<div class="reference-count"><h2>${season?season.name:'全部'}穿法 <small>${visible.length} 套</small></h2><p>同一套只归一个季节；配色与配饰在详情内切换。</p></div><div class="collection-grid">${visible.map(({formula,style})=>{const selected=selectReference(formula,{style:style.id});return `<article class="collection-card" data-reference-card="${style.id}"><a class="collection-image" href="${referenceHref(formula,style)}"><img src="${selected.variant.src}" alt="${esc(style.name)}，AI 穿搭示意" loading="lazy" width="825" height="1100"><span>AI 参考 · 非我的衣物</span></a><div class="collection-card-body"><a class="code-link" href="${referenceHref(formula,style)}" aria-label="查看参考 ${esc(style.code||style.id)}">${codeBadge(style)}</a><h2><a href="${referenceHref(formula,style)}">${esc(style.name)}</a></h2><p>${library.seasons.find(s=>s.id===style.seasons[0]).name} · ${style.variants.length} 套配色</p><a class="text-button" href="${referenceHref(formula,style)}">看穿法与已有衣物 →</a></div></article>`;}).join('')}</div>`}
    <div class="fl-foot"><button class="text-button" data-formula-sources="true">来源与季节说明 ↗</button><span>类别匹配不等于实际试穿</span></div></div>`;
}
function background(season,entries,open){
  return `<details class="fl-season-background" data-season-background="${season.id}" ${open?'open':''}><summary><span>浏览季节灵感与穿搭原则</span><small>${entries.length} 套穿法 · ${season.principles.length} 条原则</small></summary><section class="fl-recent"><h2>本季灵感速览</h2><div class="fl-recent-strip">${entries.map(({formula,style})=>`<a href="${referenceHref(formula,style)}"><img src="${style.variants[0].src}" alt="" loading="lazy"><span>${esc(style.code)} · ${esc(style.name)}</span></a>`).join('')}</div></section><section class="fl-principles"><h2>穿搭原则</h2><div class="fl-principle-grid">${season.principles.map(([title,text],i)=>`<details><summary><span>0${i+1}</span> ${esc(title)}</summary><p>${esc(text)}</p></details>`).join('')}</div></section></details>`;
}
