import { layers } from '../garment-model.js';
import { esc,cutoutImage,codeBadge,garmentImageBadge } from './shared.js';
import {isReconstructed,imageNotice} from '../garment-image.js';
import {garmentClassification,garmentCategories,garmentFacets} from '../data/garment-taxonomy.js';
import {isPendingDiscard} from '../garment-status.js';
import {outfitTitle} from '../outfit-model.js';

export function garmentOutfits(outfits,status='ready'){
  if(status==='loading')return '<h3>用在哪些搭配里</h3><p role="status">正在读取数据库关联…</p>';
  if(status!=='ready'||outfits===null)return '<h3>用在哪些搭配里</h3><p role="status">搭配关联暂未读取，不能判断是否用过。</p><button class="text-button" data-resource-retry="personal">重新读取</button>';
  return `<h3>出现在 ${outfits.length} 套搭配中</h3><p class="sources">只统计「我的搭配」，不是实际穿着次数；含未购单品的组合会另行标明。</p>${outfits.length?`<div class="related-outfits">${outfits.map(o=>`<a data-related-outfit href="#outfits/${encodeURIComponent(o.id)}" title="${esc(outfitTitle(o))}" aria-label="查看 ${esc(o.code||o.id)}：${esc(outfitTitle(o))}">${codeBadge(o)}<span>${esc(outfitTitle(o))}${o.outfitKind==='planned'?' · 含未购单品':''}</span></a>`).join('')}</div>`:'<p>目前没有正式搭配使用这件衣物。</p>'}`;
}

export function detailDialog(item,{outfits=null,status='loading'}={}) {
  const layer = layers.find(x => x.id === item.layer);
  const traits=garmentClassification(item);
  return `<div class="dialog-head">${codeBadge(item)}<h2 id="detail-title">${esc(item.name)}</h2><button class="close-btn" data-close="detail" aria-label="关闭详情">×</button></div>
    <div class="detail-grid"><div>
      <img id="detail-image" class="detail-image" src="${esc(cutoutImage(item))}" alt="${esc(item.name)}">
      ${isReconstructed(item)?`<p class="sources" data-image-notice>${imageNotice}</p>`:''}
    </div><div class="detail-meta">
      <span class="privacy-badge">${isReconstructed(item)?'已购单品':'真实衣物'}</span> ${garmentImageBadge(item)}
      ${isPendingDiscard(item)?'<p class="note-block">准备丢弃 · 档案和图片保留，不参与新搭配。需要恢复时，在 Codex 里告诉我编号。</p>':''}
      <section class="garment-outfits" data-garment-outfits="${esc(item.id)}">${garmentOutfits(outfits,status)}</section>
      <dl><dt>大类 / 子类</dt><dd>${layer.name} / ${garmentCategories[traits.category]}</dd>
        <dt>原档案款式</dt><dd>${esc(item.subtype)}</dd>
        <dt>领型 / 袖长</dt><dd>${garmentFacets.neckline[traits.neckline]} / ${garmentFacets.sleeve[traits.sleeve]}</dd>
        <dt>颜色 / 版型</dt><dd>${esc(item.color.name)} / ${esc(item.fit)}</dd>
        ${item.userConfirmedDetails?.length?`<dt>你已确认</dt><dd>${esc(item.userConfirmedDetails.join('；'))}</dd>`:''}
        <dt>图案 / 纹理</dt><dd>${esc(item.pattern||'待确认')} / ${esc(item.texture||'待确认')}</dd>
        <dt>材质 / 保暖</dt><dd>${esc(item.material || '待确认')} / ${esc(item.warmth || '待确认')}</dd></dl>
      <div class="receipt">内部档案 ID <code>${esc(item.id)}</code><p>图片细节以实物为准。</p>${esc(item.uncertainties.join('；'))}</div>
    </div></div>`;
}
