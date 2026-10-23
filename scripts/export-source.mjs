import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function exportSource(target){
  if(!path.isAbsolute(target)||fs.existsSync(target)||target.startsWith(root))throw Error('请选择仓库外、尚不存在的绝对目录');
  const files=[];
  function allowed(relative){
    if(relative==='docs/AGENT-WORKFLOW.md')return true;
    if(['docs/media/README.md','docs/media/video-poster.png','docs/media/outfits.png','docs/media/wardrobe.png','docs/media/shuffle.png','docs/media/overview.png','docs/media/preview.gif'].includes(relative))return true;
    if(['README.md','AGENTS.md','LICENSE','SECURITY.md','package.json','.gitignore','启动衣橱.command','停止衣橱.command','Start Wardrobe.command','Stop Wardrobe.command','docs/ARCHITECTURE.md','docs/MAINTENANCE.md','docs/DEMO.md','docs/ci-workflow.yml.example','.github/workflows/test.yml'].includes(relative))return true;
    if(/^scripts\/(?:english-|localize-english|finalize-english)/.test(relative))return false;
    if(/^scripts\/[\w-]+\.(mjs|zsh)$/.test(relative)||/^tests\/public\/[\w.-]+\.(mjs|js)$/.test(relative))return true;
    if(/^dist\/(?:[\w-]+\.(js|css|html)|(?:data|views|compatibility)\/[\w-]+\.(js|json)|reviews\/(?:candidate-review|suggested-pieces)\.js)$/.test(relative))return true;
    return false;
  }
  function walk(dir,relative=''){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const name=relative?relative+'/'+entry.name:entry.name;if(entry.isSymbolicLink())continue;
      if(entry.isDirectory()){if(['dist','scripts','tests','tests/public','docs','docs/media','dist/data','dist/views','dist/compatibility','dist/reviews','.github','.github/workflows'].includes(name))walk(path.join(dir,entry.name),name);}
      else if(allowed(name))files.push(name);
    }
  }
  walk(root);fs.mkdirSync(target,{recursive:true,mode:0o700});
  const empty={
    'dist/data/catalog.json':'{"schemaVersion":1,"items":[],"codeRegistry":{}}\n',
    'dist/data/guides.json':'{"formulas":[],"sources":[]}\n',
    'dist/data/reference-catalog.js':'export {default} from "./empty-references.js";\n',
    'dist/thumbnail-manifest.js':'export const thumbnails = {};\n'
  };
  for(const file of files){const to=path.join(target,file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,empty[file]??fs.readFileSync(path.join(root,file)),{flag:'wx',mode:fs.statSync(path.join(root,file)).mode&0o777});}
  return {target,files:files.length,gitIncluded:false,privateMediaIncluded:false};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(exportSource(process.argv[2]),null,2));
