import {esc,thumbnail,intro,icon,codeBadge,garmentImageBadge} from './shared.js';
import {layers} from '../garment-model.js';
import {groupedGarments,garmentGroup,canonicalGarmentGroup} from '../garment-model.js';
import {wardrobeMatches} from '../matching-model.js';
import {isActiveGarment,isPendingDiscard} from '../garment-status.js';

export function ownedCard(item,{pending=[],usageCount=null}={}){
  return `<article class="garment owned-card"><button class="garment-image-button" data-detail="${esc(item.id)}" aria-label="查看${esc(item.name)}详情"><img class="garment-image" src="${esc(thumbnail(item))}" alt="${esc(item.name)}" loading="lazy"></button><div class="garment-info">${codeBadge(item)}${garmentImageBadge(item)}<h3><button class="card-title-button" data-detail="${esc(item.id)}">${esc(item.name)}</button></h3><p>${esc(item.subtype)} · ${esc(item.color?.name)}</p>${usageCount!==null?`<p class="usage-count">出现在 ${usageCount} 套搭配中</p>`:''}<small>${pending.length?' · '+esc(pending.join('；')):''}</small><button class="text-button" data-detail="${esc(item.id)}">查看衣物</button></div></article>`;
}
export function ownedCloset({items,closetLayer='outer',closetGroup='all',closetUsage='all',usageCounts=null,personalStatus='ready'}){
  return garmentCollection({items:items.filter(isActiveGarment),closetLayer,closetGroup,closetUsage,usageCounts,personalStatus,route:'closet',title:'我的衣橱',description:'日常会继续使用的衣物。告诉 Codex 卡片上的编号，就能指定这件衣物。'});
}
export function pendingDiscardCloset({items,closetLayer='all',closetGroup='all'}){
  return garmentCollection({items:items.filter(isPendingDiscard),closetLayer,closetGroup,route:'discard',title:'准备丢弃',description:'暂时移出日常衣橱，不参与穿搭参考匹配或新搭配。档案、图片和编号仍保留；想恢复时，在 Codex 里告诉我编号。',includeAll:true});
}
function garmentCollection({items,closetLayer,closetGroup,route,title,description,includeAll=false,closetUsage='all',usageCounts=null,personalStatus='ready'}){
  closetGroup=canonicalGarmentGroup(closetGroup);
  const options=includeAll?[{id:'all',name:'全部',icon:'shirt'},...layers]:layers;
  const layer=options.find(l=>l.id===closetLayer)||options[0];
  const candidates=items.filter(i=>layer.id==='all'||i.layer===layer.id),groups=groupedGarments(candidates);
  const active=groups.some(g=>g.id===closetGroup)?closetGroup:'all';
  const inGroup=active==='all'?candidates:candidates.filter(i=>garmentGroup(i).id===active);
  const usage=route==='closet'&&['unused','low'].includes(closetUsage)?closetUsage:'all';
  const count=item=>usageCounts?.get(item.id)||0;
  const matches=(item,filter)=>filter==='all'||(filter==='unused'?count(item)===0:count(item)>=1&&count(item)<=2);
  const visible=inGroup.filter(i=>usage==='all'||usageCounts&&matches(i,usage));
  const href=(layerId=layer.id,groupId='all',filter=usage)=>`#${route}?${new URLSearchParams({layer:layerId,...(groupId!=='all'?{group:groupId}:{}),...(filter!=='all'?{usage:filter}:{})})}`;
  const usageFilters=route==='closet'?`<nav class="wardrobe-tabs usage-filters" aria-label="正式搭配使用情况">${[['all','全部衣物'],['unused','未用到'],['low','仅用在 1–2 套']].map(([id,label])=>`<a class="btn" href="${href(layer.id,active,id)}" ${usage===id?'aria-current="page"':''}>${label}<span>${id==='all'?inGroup.length:usageCounts?inGroup.filter(i=>matches(i,id)).length:'—'} 件</span></a>`).join('')}</nav><p class="sources">按当前分类统计正式搭配引用；不是实际穿着次数。</p>`:'';
  return intro(title,description)+
  `<nav class="wardrobe-tabs owned-layers" aria-label="衣物大类">${options.map(l=>`<a class="btn" href="${href(l.id)}" ${layer.id===l.id?'aria-current="page"':''}>${icon(l.icon)}${l.name}<span>${items.filter(i=>l.id==='all'||i.layer===l.id).length} 件</span></a>`).join('')}</nav>
  <section class="flow-picker"><div class="flow-picker-head"><h2>${layer.name}</h2><span aria-live="polite">${usage!=='all'&&!usageCounts?'—':visible.length} 件</span></div><nav class="wardrobe-tabs subcategory-tabs" aria-label="衣物子类"><a class="btn" href="${href()}" ${active==='all'?'aria-current="page"':''}>全部 · ${candidates.length}</a>${groups.map(g=>`<a class="btn" href="${href(layer.id,g.id)}" ${active===g.id?'aria-current="page"':''}>${esc(g.name)} · ${g.items.length}</a>`).join('')}</nav>${usageFilters}${usage!=='all'&&!usageCounts?`<p role="status">${personalStatus==='loading'?'正在读取数据库关联…':'搭配关联暂未读取，不能判断哪些衣物未用到。'}</p><button class="text-button" data-resource-retry="personal">重新读取</button>`:`<div class="flow-cards">${visible.map(i=>ownedCard(i,{usageCount:usageCounts?count(i):null})).join('')}</div>${!visible.length?`<p class="empty">${usage!=='all'?'当前分类没有符合此使用情况的衣物。':route==='discard'?'这里没有准备丢弃的衣物。':'这里还没有衣物记录。录入请在 Codex 里发送实物照片。'}</p>`:''}`}</section>`;
}
export function matchingPanel(items,formula){
  const result=wardrobeMatches(items,formula);
  const summary=result.missing.length?`${result.missing.length} 个必要位置暂无符合标签的衣物`:result.uncertain.length?`${result.uncertain.length} 个必要位置仍待确认`:result.sharedConflict?'有衣物同时匹配多个位置，需要不同衣物完成叠穿':'必要位置均有类别候选；实际搭配仍需核对版型与穿法';
  return `<section id="owned-matches" class="owned-matches" tabindex="-1"><header><span class="eyebrow">FROM YOUR WARDROBE</span><h2>用我的衣物看这套穿法</h2><p class="match-summary" role="status">${summary}</p><p>按款式、已记录的图案与明确色系要求初筛。切换示意图配色不会自动排除衣物；尺寸、厚薄、叠穿空间与实际颜色仍需确认。</p></header>
    ${result.groups.map(g=>`<section class="match-group" data-match-group="${g.id}"><h3>${g.name}${g.id==='inner'?' / 中层':''}</h3>${!g.rows.length?`<p class="match-empty">${g.id==='outer'?'这套穿法不需要外套。':g.id==='accessory'?'这套没有指定配饰，不计缺项。':'这套没有指定这一层，不计缺项。'}</p>`:g.rows.map(r=>`<div class="match-rule" data-match-state="${r.state}"><div class="match-rule-heading"><h4>${esc(r.label)}</h4><span>${r.optional?'可选 · ':''}${r.matches.length?'类别符合 '+r.matches.length+' 件':r.uncertain.length?'待确认':r.optional?'暂无记录':'暂无匹配'}</span></div>
    ${r.subtypes?.length?`<p class="match-criteria">类别：${esc(r.subtypes.join(' / '))}${r.pattern==='solid'?' · 纯色':''}${r.patternTag?' · '+esc(r.patternTag):''}</p>`:''}
    ${r.matches.length?`<div class="match-cards">${r.matches.map(c=>ownedCard(c.item)).join('')}</div>`:''}
    ${r.uncertain.length?`<h5>待确认 · 不能算已满足</h5><div class="match-cards">${r.uncertain.map(c=>ownedCard(c.item,{pending:c.pending})).join('')}</div>`:''}
    ${!r.matches.length&&!r.uncertain.length?`<p class="match-empty">${r.optional?'可省略，不构成购买缺口。':'目前档案里没有符合上述条件的衣物。先确认档案是否完整，再决定替换穿法或补充这一类。'}</p>`:''}
    ${r.excluded?`<p class="match-excluded">另有 ${r.excluded} 件同类衣物不符合已记录的图案、色系或叠穿限制，未列为候选。</p>`:''}</div>`).join('')}</section>`).join('')}
    <p class="note-block">喜欢这套？在 Codex 里告诉我参考编号 ${esc(formula.studyStyle?.code||'')}，以及你想用的衣物编号。我会核对组合、保存到「我的搭配」，需要时再生成基于实物的搭配示意图。这里不自动下单，也不把参考图当成你的衣服。</p></section>`;
}
