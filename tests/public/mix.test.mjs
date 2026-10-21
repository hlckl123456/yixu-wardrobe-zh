import test from 'node:test';
import assert from 'node:assert/strict';
import {createOutfitMixer,mixableOutfits} from '../../dist/mix-model.js';
import {outfitFilters,mixListHref} from '../../dist/outfit-model.js';
import {baseRoute} from '../../dist/app-route.js';
import {mixOutfits} from '../../dist/views/mix.js';
import {realOutfits} from '../../dist/views/outfits.js';

// Synthetic records only; no owner inventory or photographs.
const items=[{id:'top',collection:'owned',name:'合成上衣'},{id:'bottom',collection:'owned',name:'合成长裤'}];
const looks=(n=12)=>Array.from({length:n},(_,i)=>({id:`look-${i}`,code:`DP${i+1}`,title:`合成搭配 ${i+1}`,selection:{inner:'top',bottom:'bottom'},season:i%2?'summer':'winter',styleTags:[i%3?'relaxed':'minimal'],visual:{src:`assets/synthetic/look-${i}.png`,kind:'ai',alt:'合成几何示意'}}));
const ids=batch=>batch.outfits.map(o=>o.id);
const mixer=()=>createOutfitMixer({random:()=>0.37});
const view=(pool,state=outfitFilters(pool),batch=mixer().select(state.visible))=>mixOutfits({items,mixPool:pool,mixFilters:state,mixBatch:batch});

test('shuffle visits the whole scope before repeating, retains each batch and avoids immediate repeats on a new round',()=>{
  const records=looks(),m=mixer(),batches=[];
  for(let i=0;i<3;i++){
    const batch=m.select(records,{advance:i>0});batches.push(ids(batch));
    assert.equal(batch.outfits.length,4);assert.equal(batch.batchNumber,i+1);assert.equal(batch.canAdvance,true);
    assert.deepEqual(ids(m.select(records)),ids(batch));
  }
  assert.equal(new Set(batches.flat()).size,12);
  const next=ids(m.select(records,{advance:true}));assert.equal(next.length,4);
  assert.ok(next.every(id=>!batches[2].includes(id)));
});

test('partial rounds include the remaining unseen look without duplicates, and small scopes never invent filler',()=>{
  const records=looks(5),m=mixer(),first=ids(m.select(records)),next=ids(m.select(records,{advance:true}));
  assert.equal(next.length,4);assert.equal(new Set(next).size,4);assert.equal(new Set([...first,...next]).size,5);
  for(const count of [0,1,3,4]){
    const small=mixer(),pool=looks(count),batch=small.select(pool);
    assert.equal(batch.outfits.length,count);assert.equal(batch.canAdvance,false);
    assert.deepEqual(small.select(pool,{advance:true}),batch);
    const html=view(pool,outfitFilters(pool),batch);
    assert.match(html,/data-mix-next disabled/);
    assert.match(html,count?new RegExp(`这个范围只有${count}套`):/暂时没有可用的已保存搭配/);
  }
});

test('scope switching restores the batch, reads updated records and invalidates removed memberships',()=>{
  const records=looks(),m=mixer(),first=m.select(records,{key:'winter'});
  m.select(records.slice(0,6),{key:'summer'});
  assert.deepEqual(ids(m.select(records,{key:'winter'})),ids(first));
  const updated=records.map(o=>({...o,visual:{...o.visual,src:'assets/synthetic/new-version.png'}}));
  const refreshed=m.select(updated,{key:'winter'});
  assert.deepEqual(ids(refreshed),ids(first));assert.ok(refreshed.outfits.every(o=>o.visual.src.endsWith('new-version.png')));
  const removed=first.outfits[0].id,remaining=records.filter(o=>o.id!==removed);
  const rebuilt=m.select(remaining,{key:'winter'});
  assert.equal(rebuilt.total,11);assert.equal(rebuilt.batchNumber,1);assert.ok(!ids(rebuilt).includes(removed));
});

test('eligible pool requires active owned members and a visual, excludes shopping concepts and preserves source records',()=>{
  const [base]=looks(1),records=[base,{...base,id:'pending',selection:{inner:'unavailable'}},{...base,id:'missing',selection:{inner:'absent'}},{...base,id:'concept',outfitKind:'planned'},{...base,id:'no-visual',visual:null},{...base,id:'empty',selection:{}},{...base,id:'reference',selection:{inner:'reference'}}];
  const garments=[...items,{id:'unavailable',collection:'owned',wardrobeStatus:'pending-discard'},{id:'reference',collection:'reference'}],before=structuredClone([records,garments]);
  assert.deepEqual(mixableOutfits(records,garments),[base]);assert.deepEqual([records,garments],before);
});

test('shared filters constrain every shuffled batch, and mix links keep the selected route',()=>{
  const records=looks(24),state=outfitFilters(records,{season:'summer',style:'relaxed'}),m=mixer();
  for(let i=0;i<4;i++)assert.ok(m.select(state.visible,{advance:i>0}).outfits.every(o=>o.season==='summer'&&o.styleTags.includes('relaxed')));
  assert.deepEqual(baseRoute('#mix?season=summer&style=relaxed'),{page:'mix',id:null});
  assert.equal(mixListHref({season:'summer',style:'relaxed'}),'#mix?season=summer&style=relaxed');
  const html=view(records,state);
  assert.equal((html.match(/<article class="real-outfit-card"/g)||[]).length,4);
  assert.match(html,/href="#mix\?season=summer&style=relaxed" aria-current="page"/);
  assert.match(html,/\?from=mix&season=summer&style=relaxed/);
  assert.match(html,/data-owned-image=/);assert.match(html,/这套的衣物编号/);
});

test('mix shares outfit details and disclosure, with a return link preserving filters; load errors do not appear empty',()=>{
  const records=looks(),detail=realOutfits({items:[],outfits:records,outfitId:records[1].id,outfitSeason:'summer',outfitStyle:'relaxed',outfitReturnTo:'mix'});
  assert.match(detail,/href="#mix\?season=summer&style=relaxed">← 随心配/);
  assert.match(detail,/AI 图不是本人试穿/);
  assert.match(realOutfits({items:[],outfits:records,outfitId:records[1].id}),/href="#outfits">← 我的搭配/);
  for(const status of ['loading','error']){
    const html=mixOutfits({personalStatus:status});assert.ok(!html.includes('暂时没有可用的已保存搭配'));
    assert.match(html,status==='loading'?/正在读取/:/data-resource-retry="personal"/);
  }
  assert.match(mixOutfits({catalogStatus:'error'}),/data-resource-retry="catalog"/);
});
