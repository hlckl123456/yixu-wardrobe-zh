import {esc} from './shared.js';
export function dataStatus(resource,label,status='loading'){
  if(status==='ready')return '';
  const failed=status==='error';
  return `<section class="data-status" data-resource-state="${resource}:${status}" role="${failed?'alert':'status'}"><h2>${esc(label)}${failed?'暂时无法读取':'正在读取'}</h2><p>${failed?`这不表示内容为空${resource==='catalog'?'，也不表示缺少衣物':''}；原文件和记录没有被修改。`:'读取完成后会自动显示，无需刷新整个页面。'}</p>${failed?`<button class="btn" data-resource-retry="${resource}">${resource==='references'?'重新打开页面':'重试'+esc(label)}</button>`:''}</section>`;
}
