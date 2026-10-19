// Ownership and availability are separate: a planned discard is still an
// owned record, with its original ID, assets and historical relationships.
export const garmentStatuses=['active','pending-discard'];
export function garmentStatus(item){return item.wardrobeStatus===undefined?'active':item.wardrobeStatus;}
export function validateGarmentStatus(item){
  if(!garmentStatuses.includes(garmentStatus(item)))throw Error('衣物使用状态无效');
  if(item.wardrobeStatusChangedAt!==undefined&&(typeof item.wardrobeStatusChangedAt!=='string'||!Number.isFinite(Date.parse(item.wardrobeStatusChangedAt))))throw Error('衣物状态时间无效');
}
export function isActiveGarment(item){return item.collection==='owned'&&garmentStatus(item)==='active';}
export function isPendingDiscard(item){return item.collection==='owned'&&garmentStatus(item)==='pending-discard';}
