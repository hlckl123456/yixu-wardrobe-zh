import {thumbnails} from '../thumbnail-manifest.js';
import {isReconstructed,imageNotice} from '../garment-image.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export const codeBadge=record=>record.code?`<span class="communication-code" data-code="${esc(record.code)}" aria-label="编号 ${esc(record.code)}">${esc(record.code)}</span>`:'';
export const garmentImageBadge=item=>isReconstructed(item)?`<span class="garment-ai-badge" data-ai-garment-image title="${esc(imageNotice)}">AI 整理示意</span>`:'';

const paths = {
  layout: 'M3 3h7v18H3z M14 3h7v8h-7z M14 15h7v6h-7z',
  shuffle: 'M3 7h3c5 0 7 10 12 10h3 M18 14l3 3-3 3 M3 17h3c2 0 4-2 6-5 M14 9c1-1 2-2 4-2h3 M18 4l3 3-3 3',
  shirt: 'm8 3-5 3-2 5 5 2v8h12v-8l5-2-2-5-5-3c0 4-8 4-8 0',
  coat: 'm8 3-5 3v15h7l2-15 2 15h7V6l-5-3-4 3z',
  pants: 'M5 3h14l2 18h-7l-2-12-2 12H3z',
  shoe: 'M3 10v9h18v-4l-9-3-3-5-3 4z',
  belt: 'M3 8h18v8H3z M8 6h8v12H8z',
  book: 'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3z M12 6v15',
  chart: 'M4 20V11h4v9 M10 20V4h4v16 M16 20V8h4v12',
  trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  lock: 'M6 10h12v11H6z M8 10V6a4 4 0 0 1 8 0v4'
};

export const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.shirt}"/></svg>`;

export function sources(ids, guides) {
  return ids.map(id => {
    const source = guides.sources.find(x => x.id === id);
    return source?.url
      ? `<a href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.title)}</a>`
      : esc(source?.title || '');
  }).join(' · ');
}

export function intro(title, subtitle) {
  return `<section class="intro"><div><h1>${title}</h1><p>${subtitle}</p></div></section>`;
}

export const empty = () => '<div class="empty">衣橱里还没记录衣物。<br>在聊天里发照片，整理后会加入本地衣橱。</div>';

// Derived thumbnails are optional; the reviewed cutout is the retained image.
const imageVersion=item=>/^[a-f0-9]{64}$/.test(item.provenance?.cutoutSha256||'')?item.provenance.cutoutSha256.slice(0,12):null;
export const cutoutImage=item=>item.assets.cutout+(imageVersion(item)?'?v='+imageVersion(item):'');
export function thumbnail(item){
  const cached=thumbnails[item.id],version=imageVersion(item);
  // The JS thumbnail manifest may predate a live catalog update. Never reuse an
  // old garment image just because the stable garment ID is unchanged.
  return cached&&version&&cached.endsWith('-'+version+'.webp')?cached:cutoutImage(item);
}
