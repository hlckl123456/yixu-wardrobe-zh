import {layers,wardrobeStructure} from '../garment-model.js';
import {esc,intro} from './shared.js';
import {isActiveGarment} from '../garment-status.js';
function categoryButtons(items,selected,attribute){
  return `<div class="wardrobe-tabs" aria-label="衣物大类">${layers.map(l=>`<button class="btn" data-${attribute}="${l.id}" aria-pressed="${selected===l.id}">${l.name}<span>${items.filter(i=>i.layer===l.id).length} 件</span></button>`).join('')}</div>`;
}
const emptyCategory=name=>`<div class="empty">衣橱里还没记录${esc(name)}。<br>可以先跳过；新增衣物请在聊天里发照片。</div>`;

export function analysis({items,analysisLayer='outer'}){return intro('衣橱结构','按类别核对日常衣橱的颜色；准备丢弃的衣物不计入。具体穿法的匹配在「穿搭参考」详情里查看。')+structure(items.filter(isActiveGarment),analysisLayer);}
function structure(items,analysisLayer){
  const layer=layers.find(l=>l.id===analysisLayer)||layers[0];
  const groups=wardrobeStructure(items,layer.id);
  return categoryButtons(items,layer.id,'analysis-layer')
    +`<section class="structure-panel"><h2>${layer.name} · 按具体类别看颜色</h2>${groups.length?`<div class="structure-table"><table><thead><tr><th scope="col">具体类别</th><th scope="col">已记录颜色</th><th scope="col">衣物</th></tr></thead><tbody>${groups.map(g=>`<tr><th scope="row">${esc(g.name)}</th><td>${g.colors.map(c=>`<span class="structure-color"><i class="dot" style="--swatch:${esc(c.hex)}"></i>${esc(c.name)} <b>${c.count}</b></span>`).join('')}</td><td><button class="btn" data-inspect-layer="${layer.id}" data-inspect-group="${esc(g.id)}" aria-label="查看${esc(g.name)} ${g.items.length}件">${g.items.length} 件 ↗</button></td></tr>`).join('')}</tbody></table></div>`:emptyCategory(layer.name)}<p class="flow-hint">黑色在针织、裤子、鞋里承担不同作用；不把它们加在一起判断“太多”。色块用于辨认，不是精确测色。</p></section>`;
}
