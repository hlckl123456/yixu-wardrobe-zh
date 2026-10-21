import test from 'node:test';
import assert from 'node:assert/strict';
import {savedOutfitsView,mixView,closetView,outfitDetailView,refinedMixFilters} from '../../dist/views/personal.js';
import {outfitFilters} from '../../dist/outfit-model.js';
import {createOutfitMixer} from '../../dist/mix-model.js';

const looks=Array.from({length:9},(_,i)=>({id:'synthetic-'+i,code:'DP'+(i+1),title:'合成搭配｜组合'+i,selection:{inner:'synthetic-top'},season:i%2?'summer':'winter',styleTags:['relaxed'],visual:{kind:'ai',src:'assets/synthetic/geometry.png',alt:'合成几何图形'}}));
test('refined saved-outfit browser retains every record and saved order, independently of the four-look mixer',()=>{
 const original=structuredClone(looks),html=savedOutfitsView({outfits:looks});
 const rendered=[...html.matchAll(/data-outfit-id="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(rendered,looks.map(o=>o.id));assert.deepEqual(looks,original);
 assert.equal((html.match(/class="look"/g)||[]).length,9);assert.ok(!html.includes('data-next'));assert.ok(!html.includes('data-mood'));
 const summer=savedOutfitsView({outfits:looks,season:'summer'});
 assert.deepEqual([...summer.matchAll(/data-outfit-id="([^"]+)"/g)].map(m=>m[1]),looks.filter(o=>o.season==='summer').map(o=>o.id));
 assert.ok(!html.includes('<select'));assert.match(html,/aria-label="季节范围"/);assert.match(html,/aria-label="搭配风格"/);
 assert.match(summer,/href="#outfits\?season=summer&style=street"/);
 const filters=outfitFilters(looks),batch=createOutfitMixer({random:()=>.4}).select(filters.visible),mix=mixView({filters,batch});
 assert.equal((mix.match(/class="look"/g)||[]).length,4);assert.match(mix,/松弛一下/);assert.match(mix,/利落出门/);assert.match(mix,/叠穿一点/);assert.match(mix,/data-next/);
 assert.ok(!mix.includes('<select'));assert.match(mix,/aria-label="季节范围"/);
});
test('a mood with no matches in a chosen season stays empty instead of silently widening the scope',()=>{
 const filters=refinedMixFilters(looks,{season:'winter',style:'street'});
 assert.equal(filters.season,'winter');assert.equal(filters.style,'street');assert.deepEqual(filters.visible,[]);
 const batch=createOutfitMixer().select(filters.visible),html=mixView({filters,batch});
 assert.match(html,/data-next disabled/);assert.match(html,/这个范围暂时没有搭配/);
 assert.match(savedOutfitsView({outfits:looks,season:'winter',style:'street'}),/0套搭配/);
 assert.equal(refinedMixFilters(looks,{style:'invalid'}).style,'all');
});
test('compact card copy preserves incomplete ownership and assumptions; closet does not truncate active inventory',()=>{
 const planned={...looks[0],outfitKind:'planned',suggestedPieces:[{name:'合成待购外套'}]},basic={kind:'basic-tee',sleeve:'short',color:{name:'米白'},exposure:'窄领边'},assumed={...looks[1],assumedBasics:[basic]};
 assert.match(savedOutfitsView({outfits:[planned,assumed]}),/含未购单品/);assert.match(savedOutfitsView({outfits:[planned,assumed]}),/含假设内搭/);
 assert.match(outfitDetailView(planned,[]),/尚未配齐/);assert.match(outfitDetailView(assumed,[]),/未计入衣橱/);
 const items=Array.from({length:27},(_,i)=>({id:'piece-'+i,code:'SY'+i,collection:'owned',layer:'inner',subtype:'短袖T恤',name:'合成上衣',assets:{cutout:'assets/synthetic/geometry.png'}}));
 const html=closetView({items:[...items,{...items[0],id:'pending',wardrobeStatus:'pending-discard'}]});
 assert.equal((html.match(/data-garment-id=/g)||[]).length,27);assert.ok(!html.includes('data-garment-id="pending"'));
});
