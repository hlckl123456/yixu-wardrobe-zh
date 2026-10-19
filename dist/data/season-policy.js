// Personal browsing taxonomy, not a warmth or temperature prediction.
export const seasonOrder = ['winter','autumn','transition','summer'];
export const seasonRules = [
  ['冬天','最外层是大衣或羽绒服，并有完整长裤结构。'],
  ['夏天','没有冬季外层；短袖为主体，或轻薄衬衫配短裤。'],
  ['秋冬','不满足前两项；以厚针织、夹克或保温叠层为主体。'],
  ['春秋','其余已确认的轻长袖结构，包括长袖帽衫配短裤。']
];
export function classifySeason(traits) {
  if(!traits || !['none','coat','down'].includes(traits.winterShell))throw Error('必须明确冬季外层');
  if(!['long','short','layered-long'].includes(traits.sleeves))throw Error('必须明确上身袖长');
  if(!['long','short'].includes(traits.bottom))throw Error('必须明确裤长');
  if(!['light','substantial'].includes(traits.weight))throw Error('必须明确造型层次重量');
  if(traits.winterShell!=='none') {
    if(traits.bottom!=='long')throw Error('冬季公式需要完整长裤结构');
    return 'winter';
  }
  if(traits.sleeves==='short'||(traits.bottom==='short'&&traits.weight==='light'&&traits.upper==='shirt'))return 'summer';
  if(traits.weight==='substantial')return 'autumn';
  return 'transition';
}
export function seasonReason(traits){return seasonRules.find(([name])=>name===({winter:'冬天',summer:'夏天',autumn:'秋冬',transition:'春秋'})[classifySeason(traits)])[1];}
