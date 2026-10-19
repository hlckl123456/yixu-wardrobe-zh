// Read-only migration sources. Never write, clear or repair browser storage here.
export const storageKey = 'yixu-v2';
export const legacyStorageKey = 'yixu-v1';
const migrationBackupKey = 'yixu-v1-before-v2';
export const recoveryKey = 'yixu-damaged-before-recovery';
export const beforeImportKey = 'yixu-before-import';

function source(storage) {
  if (!storage) throw Error('浏览器未允许读取本地记录');
  const current = storage.getItem(storageKey);
  return current != null ? {key:storageKey,raw:current} : {key:legacyStorageKey,raw:storage.getItem(legacyStorageKey) ?? null};
}

export function createLegacySource(storage){return {source:()=>source(storage),rescue:()=>{if(!storage)throw Error('浏览器未允许读取本地记录');return {format:'yixu-recovery',version:1,entries:Object.fromEntries([storageKey,legacyStorageKey,migrationBackupKey,beforeImportKey,recoveryKey].map(key=>[key,storage.getItem(key)??null]).filter(([,value])=>value!==null))};}};}
