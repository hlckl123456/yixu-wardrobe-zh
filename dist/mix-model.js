import {isActiveGarment} from './garment-status.js';

// Only saved looks with a visual and currently usable owned garments enter the pool.
export function mixableOutfits(outfits,items){
  const active=new Set(items.filter(isActiveGarment).map(i=>i.id));
  return outfits.filter(o=>o.outfitKind!=='planned'&&o.visual?.src&&Object.values(o.selection||{}).length&&Object.values(o.selection).every(id=>active.has(id)));
}

export function createOutfitMixer({random=Math.random,batchSize=4}={}){
  const scopes=new Map();
  function shuffled(ids){
    const result=[...ids];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
  }
  return {
    select(outfits,{key='all',advance=false}={}){
      const records=new Map(outfits.map(o=>[o.id,o])),ids=[...records.keys()],signature=JSON.stringify(ids);
      let state=scopes.get(key);
      if(!state||state.signature!==signature){state={signature,remaining:shuffled(ids),current:[],batchNumber:0};scopes.set(key,state);}
      const size=Math.min(batchSize,ids.length);
      if(!state.batchNumber||advance&&ids.length>batchSize){
        const previous=new Set(state.current),chosen=state.remaining.splice(0,size);
        if(chosen.length<size){
          // Finish unseen looks first, then start another round. Avoid the previous
          // batch where the pool is large enough; never duplicate within one batch.
          const selected=new Set(chosen),fresh=shuffled(ids.filter(id=>!selected.has(id)));
          state.remaining=[...fresh.filter(id=>!previous.has(id)),...fresh.filter(id=>previous.has(id))];
          chosen.push(...state.remaining.splice(0,size-chosen.length));
        }
        state.current=chosen;state.batchNumber++;
      }
      return {outfits:state.current.map(id=>records.get(id)),total:ids.length,batchNumber:state.batchNumber,canAdvance:ids.length>batchSize};
    }
  };
}
