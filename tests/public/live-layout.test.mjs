import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceRoute,baseRoute} from '../../dist/app-route.js';
import {closetOverviewData,closetOverview} from '../../dist/closet-overview.js';
import {closetView,garmentDetailView,outfitDetailView,outfitZoomView} from '../../dist/views/personal.js';

const items=[
 {id:'upper',code:'SY01',collection:'owned',layer:'inner',subtype:'短袖T恤',name:'合成上衣',color:{name:'蓝',family:'blue',hex:'#8899aa'},assets:{cutout:'assets/synthetic/geometry.png'}},
 {id:'lower',code:'KZ01',collection:'owned',layer:'bottom',subtype:'长裤',name:'合成长裤',color:{name:'灰',family:'gray',hex:'#777777'},assets:{cutout:'assets/synthetic/geometry.png'}},
 {id:'pending',code:'SY02',collection:'owned',layer:'inner',subtype:'短袖T恤',name:'合成待整理',wardrobeStatus:'pending-discard',color:{name:'红',family:'red',hex:'#aa6655'},assets:{cutout:'assets/synthetic/geometry.png'}}
];
const outfit={id:'synthetic-look',code:'DP01',title:'合成搭配',selection:{inner:'upper',bottom:'lower'},season:'summer',visual:{src:'assets/synthetic/geometry.png',kind:'ai'}};
test('removed reference and analysis entry points redirect without altering legacy provenance resolution',()=>{
 assert.deepEqual(workspaceRoute('#formulas/library'),{page:'outfits',id:null,redirect:'#outfits'});
 assert.equal(workspaceRoute('#references').redirect,'#outfits');
 assert.equal(workspaceRoute('#analysis?layer=bottom').redirect,'#closet?view=overview');
 assert.equal(workspaceRoute('#closet?overview=1').redirect,'#closet?view=overview');
 assert.equal(workspaceRoute('#workbench/old-source').redirect,'#outfits');
 assert.equal(workspaceRoute('#formulas/notes').redirect,'#notes');
 assert.deepEqual(workspaceRoute('#discard'),{page:'discard',id:null});
 assert.deepEqual(workspaceRoute('#outfits/DP01'),{page:'outfits',id:'DP01'});
 assert.deepEqual(baseRoute('#formulas/winter/legacy-source'),{page:'formulas',section:'winter',id:null});
});
test('overview counts only active inventory, preserves records and provides charts without garment drill-down',()=>{
 const before=structuredClone(items),summary=closetOverviewData(items);
 assert.equal(summary.total,2);assert.equal(summary.categories.reduce((n,c)=>n+c.count,0),2);
 assert.equal(summary.colors.reduce((n,c)=>n+c.count,0),2);assert.ok(!summary.colors.some(c=>c.id==='red'));
 assert.deepEqual(items,before);const html=closetOverview(items);
 assert.equal((html.match(/role="img"/g)||[]).length,2);assert.ok(!html.includes('data-garment'));assert.ok(!html.includes('<button'));
});
test('discard is a secondary closet destination, remains read-only and has separate membership',()=>{
 const main=closetView({items}),pending=closetView({items,pending:true});
 assert.match(main,/href="#discard">准备丢弃 · 1/);assert.match(main,/href="#closet\?view=overview"/);
 assert.ok(!main.includes('id="closet-overview"'));
 const overview=closetView({items,layer:'bottom',overview:true});
 assert.ok(!overview.includes('data-garment-id='));assert.ok(!overview.includes('<select'));
 assert.match(overview,/2件在用衣物/);assert.equal((overview.match(/role="img"/g)||[]).length,2);
 assert.ok(!main.includes('data-garment-id="pending"'));assert.ok(pending.includes('data-garment-id="pending"'));
 assert.ok(!pending.includes('data-garment-id="upper"'));assert.ok(!pending.includes('id="closet-overview"'));
 assert.match(pending,/href="#closet">← 我的衣橱/);assert.ok(!pending.includes('data-remove'));
 const usage=closetView({items,usage:'unused',usageCounts:new Map([['upper',1],['lower',0]])});
 assert.ok(!usage.includes('data-garment-id="upper"'));assert.ok(usage.includes('data-garment-id="lower"'));
 assert.match(closetView({items,usage:'unused',personalStatus:'error'}),/搭配关联暂未读取/);
});
test('garment details use SQL memberships and distinguish unavailable relationships from zero; zoom retains ownership labels',()=>{
 const links={garments:[{garmentId:'upper',outfitId:outfit.id,slot:'inner'}],origins:[]};
 assert.match(garmentDetailView(items[0],[outfit],{relationships:links}),/出现在1套/);
 assert.match(garmentDetailView(items[0],[outfit],{relationships:null}),/搭配关联暂时无法读取/);
 assert.match(outfitDetailView(outfit,[],{catalogStatus:'error'}),/衣物档案暂时无法读取/);
 const planned={...outfit,outfitKind:'planned',suggestedPieces:[{name:'合成待购外层'}]};
 assert.match(outfitZoomView(planned),/含未购单品/);assert.match(outfitZoomView(planned),/未计入衣橱/);
 assert.ok(!outfitDetailView(outfit,items).includes('#formulas/'));
});
