// Primary navigation must work without loading the editorial reference catalog.
export function baseRoute(hash='') {
  const [path]=hash.replace(/^#/,'').split('?');
  const [page,section]=path.split('/');
  if(page==='outfits')return {page,id:section?decode(section):null};
  if(page==='mix'&&!section)return {page,id:null};
  if(page==='references')return {page:'formulas',section:'library',id:null,redirect:'#formulas/library'};
  if(page==='closet'||page==='discard'||page==='analysis'&&!section)return {page,id:null};
  if(page==='workbench'&&!section)return {page:'closet',id:null,redirect:'#closet'};
  if(page==='formulas'&&section==='notes')return {page,section:'notes',id:null};
  if(['formulas','workbench','analysis'].includes(page))return {page:'formulas',section:section||'library',id:null};
  return {page:'outfits',id:null};
}
function decode(value){try{return decodeURIComponent(value);}catch{return value;}}

// Runtime navigation is intentionally smaller than historical source-link
// resolution. Keep baseRoute compatible with stored provenance and CLI edits.
export function workspaceRoute(hash=''){
 const [path]=hash.replace(/^#/,'').split('?'),[page,section]=path.split('/');
 if(page==='notes'&&!section)return {page:'notes',id:null};
 if(page==='formulas'&&section==='notes')return {page:'notes',id:null,redirect:'#notes'};
 if(page==='analysis'||page==='closet'&&new URLSearchParams(hash.split('?')[1]||'').get('overview')==='1')return {page:'closet',id:null,redirect:'#closet?view=overview'};
 if(page==='references'||page==='formulas'||page==='workbench'&&section)return {page:'outfits',id:null,redirect:'#outfits'};
 return baseRoute(hash);
}
