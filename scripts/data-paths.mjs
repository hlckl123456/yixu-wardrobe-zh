import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Explicit configuration wins. Never infer private data from a source checkout.
export function dataDirectory(env=process.env,platform=process.platform){
  if(env.YIXU_DATA_DIR){if(!path.isAbsolute(env.YIXU_DATA_DIR))throw Error('YIXU_DATA_DIR 必须是绝对路径');return path.resolve(env.YIXU_DATA_DIR);}
  return fileURLToPath(new URL('../private-data',import.meta.url));
}
export const databaseFile=directory=>path.join(directory,'wardrobe.sqlite');
export function containedFile(root,relative){
  if(typeof relative!=='string'||!relative||relative.startsWith('/')||relative.includes('\\')||relative.includes('\0')||relative.split('/').some(p=>!p||p==='.'||p==='..'||p.startsWith('.')))throw Error('资源相对路径无效');
  const resolved=path.resolve(root,relative);
  if(!resolved.startsWith(path.resolve(root)+path.sep))throw Error('资源越界');
  return resolved;
}
