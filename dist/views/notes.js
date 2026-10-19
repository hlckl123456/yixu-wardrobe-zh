import {esc} from './shared.js';
import {dataStatus} from './data-status.js';
export function notes({guides,saved=[],dataError=false,personalStatus=dataError?'error':'ready',guidesStatus='ready'}){
  const personal=personalStatus==='ready'?saved.map(n=>`<article class="formula-card"><h3>${esc(n.title)}</h3><div class="formula-text">${esc(n.text)}</div></article>`).join('')||'<p class="empty">还没有自写笔记。</p>':dataStatus('personal','我的笔记',personalStatus);
  const reference=guidesStatus==='ready'?(guides?.formulas||[]).map(n=>`<article class="formula-card"><h3>${esc(n.title)}</h3><div class="formula-text">${esc(n.text)}</div><p>${esc(n.note)}</p></article>`).join('')||'<p class="empty">暂无参考笔记。</p>':dataStatus('guides','参考笔记',guidesStatus);
  return `<div class="intro"><div><h1>搭配笔记</h1><p>已有笔记完整保留。新增与修改在 Codex 中完成。</p></div><a class="btn" href="#outfits">← 我的搭配</a></div><h2>我的笔记</h2><div class="formula-grid">${personal}</div><h2>参考笔记</h2><div class="formula-grid">${reference}</div>`;
}
