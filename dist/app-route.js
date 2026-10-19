// Primary navigation must work without loading the editorial reference catalog.
export function baseRoute(hash='') {
  const [path]=hash.replace(/^#/,'').split('?');
  const [page,section]=path.split('/');
  if(page==='outfits')return {page,id:section?decode(section):null};
  if(page==='references')return {page:'formulas',section:'library',id:null,redirect:'#formulas/library'};
  if(page==='closet'||page==='discard'||page==='analysis'&&!section)return {page,id:null};
  if(page==='workbench'&&!section)return {page:'closet',id:null,redirect:'#closet'};
  if(page==='formulas'&&section==='notes')return {page,section:'notes',id:null};
  if(['formulas','workbench','analysis'].includes(page))return {page:'formulas',section:section||'library',id:null};
  return {page:'outfits',id:null};
}
function decode(value){try{return decodeURIComponent(value);}catch{return value;}}
