// SQL supplies membership; the browser only resolves current display records.
// No parsing names/HX codes and no second, manually maintained relationship map.
export function outfitsForGarment(garmentId,outfits,relationships){
  if(!relationships)return null;
  const ids=new Set(relationships.garments.filter(r=>r.garmentId===garmentId).map(r=>r.outfitId));
  return outfits.filter(o=>ids.has(o.id));
}
export function garmentUsageCounts(relationships){
  if(!relationships)return null;
  const sets=new Map();
  for(const r of relationships.garments){if(!sets.has(r.garmentId))sets.set(r.garmentId,new Set());sets.get(r.garmentId).add(r.outfitId);}
  return new Map([...sets].map(([id,outfits])=>[id,outfits.size]));
}
