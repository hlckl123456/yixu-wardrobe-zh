import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {normalizePreferences,emptyPreferences} from '../dist/data-schema.js';
import {createBackup,mergeBackup} from '../dist/backup-model.js';
import {applyCommand} from '../dist/data-commands.js';
import {assertCurrentCommand} from '../dist/compatibility/retired-commands.js';
import {assignCodes,garmentPrefixes} from '../dist/communication-codes.js';
import {validateCatalog,validateGuides} from '../dist/resource-repository.js';
import {validateReferenceCatalog} from '../dist/reference-schema.js';
import {garmentStatus} from '../dist/garment-status.js';
import {containedFile} from './data-paths.mjs';

const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value);
const parse=value=>JSON.parse(value);

/** SQLite is the only mutable source. JSON returned to readers is a projection. */
export function createRelationalStore(filename=':memory:',{catalog,items,mediaRoot,documents={},assets=[]}={}){
  const directory=filename===':memory:'?null:path.dirname(filename);
  if(directory)fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
  if(directory){fs.chmodSync(filename,0o600);db.exec('PRAGMA journal_mode=WAL;');}
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>2){db.close();throw Error('数据库版本较新，未修改原数据');}
  const tx=run=>{db.exec('BEGIN IMMEDIATE');try{const result=run();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const meta=k=>db.prepare('SELECT value FROM metadata WHERE key=?').get(k)?.value;
  const setMeta=(k,v)=>db.prepare('INSERT INTO metadata VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,String(v));
  const revision=()=>Number(meta('revision')||0);
  const bump=()=>setMeta('revision',revision()+1);
  const registry=kind=>Object.fromEntries(db.prepare('SELECT id,code FROM identities WHERE kind=?').all(kind).map(r=>[r.id,r.code]));
  function reserve(kind,id,code){
    const old=db.prepare('SELECT code,kind FROM identities WHERE id=?').get(id);
    if(old&&(old.code!==code||old.kind!==kind))throw Error('稳定编号或 ID 不可改写');
    db.prepare('INSERT OR IGNORE INTO identities(id,kind,code) VALUES(?,?,?)').run(id,kind,code);
  }
  function number(records,kind,importing=false){
    const result=assignCodes(records,registry(kind),r=>kind==='outfit'?'DP':garmentPrefixes[r.layer],{importing});
    for(const [id,code] of Object.entries(result.registry))reserve(kind,id,code);
    return result.records;
  }
  function checkMedia(relative,expected){
    const registered=db.prepare('SELECT * FROM media_assets WHERE url=?').get(relative);
    if(!registered)throw Error('图片尚未登记：'+relative);
    if(registered.kind==='retired'||registered.kind.startsWith('redirect:'))throw Error('资源已从页面移除，不能重新引用：'+relative);
    if(expected&&registered.sha256!==expected)throw Error('图片校验值不符：'+relative);
    return registered;
  }
  function registerAsset(record){
    if(!mediaRoot)throw Error('未配置私人图片目录');
    const relative=record.url.replace(/^\//,'');
    if(!/^(assets|reviews)\//.test(relative))throw Error('仅允许登记图片和候选资源');
    if(record.kind==='retired'||record.kind?.startsWith('redirect:'))throw Error('资源访问状态须通过显式维护命令修改');
    const file=containedFile(mediaRoot,relative),real=fs.realpathSync(file);
    if(!real.startsWith(fs.realpathSync(mediaRoot)+path.sep)||!fs.statSync(real).isFile())throw Error('资源路径越界');
    const bytes=fs.readFileSync(real),digest=hash(bytes);
    if(record.sha256&&record.sha256!==digest)throw Error('资源校验失败：'+relative);
    const old=db.prepare('SELECT sha256 FROM media_assets WHERE url=?').get(relative);
    if(old&&old.sha256!==digest)throw Error('已登记文件不可覆盖，请使用新的版本路径');
    db.prepare('INSERT OR IGNORE INTO media_assets VALUES (?,?,?,?,?)').run(relative,relative,digest,bytes.length,record.kind||'media');
    return {...record,url:relative,sha256:digest,size:bytes.length};
  }
  function retireAssets(records){
    if(!Array.isArray(records)||!records.length||records.length>500||new Set(records.map(r=>r?.expected?.url)).size!==records.length)throw Error('请指定无重复的确切资源');
    const updates=records.map(record=>{
      const expected=record?.expected,actual=db.prepare('SELECT * FROM media_assets WHERE url=?').get(expected?.url);
      if(!actual||!expected||Object.keys(expected).length!==Object.keys(actual).length||Object.keys(actual).some(k=>actual[k]!==expected[k]))throw Error('资源记录已改变，请重新核对');
      const url=actual.url;
      if(!/^(reviews\/[\w-]+\/|assets\/(items|outfits)\/)/.test(url))throw Error('只允许维护确切的衣物、搭配和候选资源');
      const used=db.prepare(`SELECT 1 FROM garment_versions v JOIN garments g ON g.id=v.garment_id
        WHERE g.deleted_at IS NULL AND (v.asset_url=? OR EXISTS(SELECT 1 FROM json_tree(v.data) WHERE type='text' AND value=?))
        UNION ALL SELECT 1 FROM outfit_visuals v WHERE v.asset_url=? OR EXISTS(SELECT 1 FROM json_tree(v.data) WHERE type='text' AND value=?)
        UNION ALL SELECT 1 FROM documents d WHERE d.key IN ('thumbnails','reference-catalog','guides') AND EXISTS(SELECT 1 FROM json_tree(d.data) WHERE type='text' AND value=?) LIMIT 1`).get(url,url,url,url,url);
      if(used)throw Error('资源仍被当前衣物、搭配或资料使用：'+url);
      if(record.redirectTo!==undefined){
        const target=record.redirectTo;
        if(typeof target!=='string'||!/^reviews\/[\w-]+\/[\w/.-]+\.(html|json|js|css)$/.test(url)||!/^reviews\/[\w-]+\/[\w/.-]+\.(html|json|js|css)$/.test(target)||target.split('/').some(p=>p==='..'||p.startsWith('.'))||target===url)throw Error('候选跳转路径无效');
        checkMedia(target);
        if(records.some(r=>r?.expected?.url===target))throw Error('跳转目标不能同时移除');
        return {url,kind:'redirect:'+target};
      }
      return {url,kind:'retired'};
    });
    // Keep immutable bytes and identity history for private recovery; only revoke
    // their public URL. Validate the full batch before changing any access state.
    for(const u of updates)db.prepare('UPDATE media_assets SET kind=? WHERE url=?').run(u.kind,u.url);
  }
  function writeGarment(record,position){
    const {id,code,assets:currentAssets,provenance,imageHistory,wardrobeStatus,...payload}=record;
    reserve('garment',id,code);
    validateCatalog({items:[record]});
    const versions=[{assets:currentAssets,provenance},...(imageHistory||[])];
    for(const v of versions)for(const [role,url] of Object.entries(v.assets))checkMedia(url,v.provenance?.[role+'Sha256']);
    const old=db.prepare('SELECT deleted_at FROM garments WHERE id=?').get(id);
    if(old?.deleted_at)throw Error('已删除衣物不能自动恢复或重用编号');
    db.prepare(`INSERT INTO garments(id,position,status,status_explicit,history_explicit,data) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status,status_explicit=excluded.status_explicit,history_explicit=excluded.history_explicit,data=excluded.data`).run(id,position,garmentStatus(record),Number(wardrobeStatus!==undefined),Number(imageHistory!==undefined),json(payload));
    // Versions are immutable. Preserve previously reviewed history even on updates.
    const existing=db.prepare('SELECT version,data FROM garment_versions WHERE garment_id=? ORDER BY version').all(id);
    const current=existing.find(v=>v.version===-1);
    if(current&&current.data!==json(versions[0])){
      const previous=parse(current.data);
      if(!versions.slice(1).some(v=>v.assets.cutout===previous.assets.cutout))throw Error('更新图片必须保留上一版本的 imageHistory');
    }
    for(const v of existing.filter(v=>v.version>=0))if(!versions.slice(1).some(next=>json(next)===v.data))throw Error('图片历史不可丢失');
    db.prepare('DELETE FROM garment_versions WHERE garment_id=?').run(id);
    const insert=db.prepare('INSERT INTO garment_versions VALUES(?,?,?,?)');
    versions.forEach((v,i)=>insert.run(id,i-1,v.assets.cutout,json(v)));
  }
  function readCatalog(){
    const items=db.prepare('SELECT g.*,i.code FROM garments g JOIN identities i ON i.id=g.id WHERE g.deleted_at IS NULL ORDER BY g.position').all().map(row=>{
      const versions=db.prepare('SELECT version,data FROM garment_versions WHERE garment_id=? ORDER BY version').all(row.id).map(v=>parse(v.data));
      return {id:row.id,...parse(row.data),...versions[0],code:row.code,...(row.status_explicit?{wardrobeStatus:row.status}:{}),...(row.history_explicit?{imageHistory:versions.slice(1)}:{})};
    });
    return {...parse(meta('catalog_meta')||'{"schemaVersion":1}'),items,codeRegistry:registry('garment')};
  }
  function outfit(row){
    const selection=Object.fromEntries(db.prepare('SELECT slot,garment_id FROM outfit_items WHERE outfit_id=? ORDER BY position').all(row.id).map(r=>[r.slot,r.garment_id]));
    const source=db.prepare('SELECT source_id FROM outfit_sources WHERE outfit_id=?').get(row.id)?.source_id;
    const visual=db.prepare('SELECT data FROM outfit_visuals WHERE outfit_id=? ORDER BY version DESC LIMIT 1').get(row.id);
    return {id:row.id,...parse(row.data),selection,code:db.prepare('SELECT code FROM identities WHERE id=?').get(row.id).code,...(source?{derivedFromOutfitId:source}:{}),...(visual?{visual:parse(visual.data)}:{})};
  }
  function activeRecords(){return {outfits:db.prepare('SELECT * FROM outfits ORDER BY position').all().map(outfit),saved:db.prepare('SELECT data FROM notes ORDER BY position').all().map(r=>parse(r.data))};}
  function read(){return normalizePreferences({...activeRecords(),selections:parse(meta('selections')||'{"owned":{}}'),curation:db.prepare('SELECT style_id AS styleId,state,season,position FROM formula_preferences ORDER BY position,style_id').all()});}
  function writeOutfit(record,position){
    const {id,selection,code,derivedFromOutfitId,visual,...payload}=record;
    reserve('outfit',id,code);
    for(const garmentId of Object.values(selection))if(!db.prepare('SELECT 1 FROM garments WHERE id=? AND deleted_at IS NULL').get(garmentId))throw Error('搭配引用不存在的衣物：'+garmentId);
    if(derivedFromOutfitId&&!db.prepare("SELECT 1 FROM identities WHERE id=? AND kind='outfit'").get(derivedFromOutfitId))throw Error('来源 ID 未保留，无法确认关系');
    const old=db.prepare('SELECT data FROM outfits WHERE id=?').get(id);
    const oldPayload=old?parse(old.data):{};
    // Normalize the old payload with its old memberships, not the incoming ones.
    // A purchased outer may now fill a slot previously occupied by a concept.
    const oldSelection=old?Object.fromEntries(db.prepare('SELECT slot,garment_id FROM outfit_items WHERE outfit_id=? ORDER BY position').all(id).map(r=>[r.slot,r.garment_id])):{};
    const known=new Set(old?Object.keys(normalizePreferences({outfits:[{id,selection:oldSelection,...oldPayload}]}).outfits[0]):[]);
    const opaque=Object.fromEntries(Object.entries(oldPayload).filter(([key])=>!known.has(key)));
    db.prepare('INSERT INTO outfits VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id,position,json({...opaque,...payload}));
    db.prepare('DELETE FROM outfit_items WHERE outfit_id=?').run(id);
    Object.entries(selection).forEach(([slot,garmentId],index)=>db.prepare('INSERT INTO outfit_items VALUES(?,?,?,?)').run(id,slot,garmentId,index));
    db.prepare('DELETE FROM outfit_sources WHERE outfit_id=?').run(id);
    if(derivedFromOutfitId)db.prepare('INSERT INTO outfit_sources VALUES(?,?)').run(id,derivedFromOutfitId);
    if(visual){
      checkMedia(visual.src.replace(/^\//,''));
      const previous=db.prepare('SELECT version,data FROM outfit_visuals WHERE outfit_id=? ORDER BY version DESC LIMIT 1').get(id);
      if(previous?.data!==json(visual))db.prepare('INSERT INTO outfit_visuals VALUES(?,?,?,?)').run(id,(previous?.version||0)+1,visual.src.replace(/^\//,''),json(visual));
    }else if(db.prepare('SELECT 1 FROM outfit_visuals WHERE outfit_id=?').get(id))throw Error('不能静默清除已有搭配图片；请明确提供新版本');
  }
  function relationships(){return {
    garments:db.prepare('SELECT garment_id AS garmentId,outfit_id AS outfitId,slot FROM outfit_items ORDER BY outfit_id,slot').all(),
    origins:db.prepare(`SELECT r.outfit_id AS outfitId,r.source_id AS sourceId,i.code AS sourceCode,
      COALESCE(json_extract(s.data,'$.displayTitle'),json_extract(s.data,'$.title')) AS sourceTitle,s.id IS NOT NULL AS available
      FROM outfit_sources r JOIN identities i ON i.id=r.source_id LEFT JOIN outfits s ON s.id=r.source_id ORDER BY r.outfit_id`).all()
  };}
  const envelope=()=>({data:read(),relationships:relationships(),revision:revision(),initialized:meta('initialized')==='1',storage:'sqlite'});
  function snapshot(label,contents){
    if(!directory)return null;
    const backupDir=path.join(directory,'backups');fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
    const target=path.join(backupDir,`${new Date().toISOString().replaceAll(':','-')}-${label}-${crypto.randomUUID()}.json`);
    const fd=fs.openSync(target,'wx',0o600);try{fs.writeFileSync(fd,json(contents));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return path.basename(target);
  }
  const fullBackup=()=>({format:'yixu-database-snapshot',version:2,createdAt:new Date().toISOString(),tables:Object.fromEntries(['metadata','identities','garments','garment_versions','outfits','outfit_items','outfit_sources','outfit_visuals','notes','formula_preferences','imports','commands','media_assets','documents'].map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]))});
  function replaceForImport(data){
    const normalized=normalizePreferences(data);normalized.outfits=number(normalized.outfits,'outfit',true);
    // Merge/import must not erase version history by deleting and reinserting
    // surviving outfits. Only explicitly absent entities are removed.
    const retained=new Set(normalized.outfits.map(r=>r.id));
    for(const row of db.prepare('SELECT id FROM outfits').all())if(!retained.has(row.id))db.prepare('DELETE FROM outfits WHERE id=?').run(row.id);
    db.exec('DELETE FROM notes; DELETE FROM formula_preferences;');
    normalized.outfits.forEach(writeOutfit);
    normalized.saved.forEach((r,i)=>db.prepare('INSERT INTO notes VALUES (?,?,?)').run(r.id,i,json(r)));
    for(const r of normalized.curation||[])db.prepare('INSERT INTO formula_preferences VALUES (?,?,?,?)').run(r.styleId,r.state,r.season,r.position);
    setMeta('selections',json(normalized.selections));bump();
  }
  try{tx(()=>{
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS outfits(id TEXT PRIMARY KEY,position INTEGER NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notes(id TEXT PRIMARY KEY,position INTEGER NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS formula_preferences(style_id TEXT PRIMARY KEY,state TEXT NOT NULL CHECK(state IN ('selected','available','hidden')),season TEXT NOT NULL CHECK(season IN ('winter','autumn','transition','summer')),position INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS imports(fingerprint TEXT PRIMARY KEY,imported_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS commands(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS identities(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('garment','outfit')),code TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS media_assets(url TEXT PRIMARY KEY,relative_path TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL CHECK(length(sha256)=64),size INTEGER NOT NULL CHECK(size>0),kind TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS documents(key TEXT PRIMARY KEY,data TEXT NOT NULL CHECK(json_valid(data)));
      CREATE TABLE IF NOT EXISTS garments(id TEXT PRIMARY KEY REFERENCES identities(id) ON DELETE RESTRICT,position INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('active','pending-discard')),status_explicit INTEGER NOT NULL,history_explicit INTEGER NOT NULL,data TEXT NOT NULL CHECK(json_valid(data)),deleted_at TEXT);
      CREATE TABLE IF NOT EXISTS garment_versions(garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE RESTRICT,version INTEGER NOT NULL,asset_url TEXT NOT NULL REFERENCES media_assets(url) ON DELETE RESTRICT,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(garment_id,version));
      CREATE TABLE IF NOT EXISTS outfit_items(outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,slot TEXT NOT NULL CHECK(slot IN ('outer','middle','inner','tie','bottom','shoes','belt','bag','accessory')),garment_id TEXT NOT NULL REFERENCES garments(id) ON DELETE RESTRICT,position INTEGER NOT NULL,PRIMARY KEY(outfit_id,slot),UNIQUE(outfit_id,garment_id));
      CREATE INDEX IF NOT EXISTS outfit_items_garment ON outfit_items(garment_id,outfit_id);
      CREATE TABLE IF NOT EXISTS outfit_sources(outfit_id TEXT PRIMARY KEY REFERENCES outfits(id) ON DELETE CASCADE,source_id TEXT NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,CHECK(outfit_id<>source_id));
      CREATE TABLE IF NOT EXISTS outfit_visuals(outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,version INTEGER NOT NULL,asset_url TEXT NOT NULL REFERENCES media_assets(url) ON DELETE RESTRICT,data TEXT NOT NULL CHECK(json_valid(data)),PRIMARY KEY(outfit_id,version));
      CREATE TRIGGER IF NOT EXISTS reserved_identity_update BEFORE UPDATE ON identities BEGIN SELECT RAISE(ABORT,'Identities are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS reserved_identity_delete BEFORE DELETE ON identities BEGIN SELECT RAISE(ABORT,'Identities are permanent reservations'); END;
      CREATE TRIGGER IF NOT EXISTS prevent_referenced_tombstone BEFORE UPDATE OF deleted_at ON garments WHEN NEW.deleted_at IS NOT NULL AND EXISTS(SELECT 1 FROM outfit_items WHERE garment_id=NEW.id) BEGIN SELECT RAISE(ABORT,'Garment is in an outfit'); END;
      CREATE TRIGGER IF NOT EXISTS prevent_deleted_membership BEFORE INSERT ON outfit_items WHEN (SELECT deleted_at FROM garments WHERE id=NEW.garment_id) IS NOT NULL BEGIN SELECT RAISE(ABORT,'Garment is deleted'); END;
      CREATE TRIGGER IF NOT EXISTS require_outfit_identity BEFORE INSERT ON outfits WHEN NOT EXISTS(SELECT 1 FROM identities WHERE id=NEW.id AND kind='outfit') BEGIN SELECT RAISE(ABORT,'Outfit identity required'); END;
      CREATE TRIGGER IF NOT EXISTS require_garment_identity BEFORE INSERT ON garments WHEN NOT EXISTS(SELECT 1 FROM identities WHERE id=NEW.id AND kind='garment') BEGIN SELECT RAISE(ABORT,'Garment identity required'); END;
      CREATE TRIGGER IF NOT EXISTS require_source_identity BEFORE INSERT ON outfit_sources WHEN NOT EXISTS(SELECT 1 FROM identities WHERE id=NEW.source_id AND kind='outfit') BEGIN SELECT RAISE(ABORT,'Outfit source identity required'); END;
      CREATE TRIGGER IF NOT EXISTS prevent_source_cycle BEFORE INSERT ON outfit_sources WHEN EXISTS(WITH RECURSIVE ancestors(id) AS (SELECT NEW.source_id UNION SELECT s.source_id FROM outfit_sources s JOIN ancestors a ON s.outfit_id=a.id) SELECT 1 FROM ancestors WHERE id=NEW.outfit_id) BEGIN SELECT RAISE(ABORT,'Outfit source cycle'); END;
    `);
    if(version<2){
      if(version===1&&!catalog)throw Error('旧数据库需要明确的衣物目录；未自动猜测或迁移');
      for(const asset of assets)registerAsset(asset);
      const seed=catalog||(items?{schemaVersion:1,items:typeof items==='function'?items():items}:null);
      if(seed){
        validateCatalog(seed);for(const [id,code] of Object.entries(seed.codeRegistry||{}))reserve('garment',id,code);
        number(seed.items,'garment').forEach(writeGarment);
        const {items:ignored,codeRegistry:ignoredCodes,...metadata}=seed;setMeta('catalog_meta',json(metadata));
      }
      const old=db.prepare('SELECT * FROM outfits ORDER BY position').all();
      for(const [id,code] of Object.entries(parse(meta('outfit_codes')||'{}')))reserve('outfit',id,code);
      const records=number(old.map(r=>parse(r.data)),'outfit');records.forEach((r,i)=>writeOutfit(r,old[i].position));
      db.prepare("DELETE FROM metadata WHERE key='outfit_codes'").run();
      for(const [key,value] of Object.entries(documents))db.prepare('INSERT INTO documents VALUES (?,?)').run(key,json(value));
      db.exec(`DROP VIEW IF EXISTS outfit_garments; DROP VIEW IF EXISTS outfit_origins;
        CREATE VIEW outfit_garments AS SELECT outfit_id,slot,garment_id FROM outfit_items;
        CREATE VIEW outfit_origins AS SELECT outfit_id,source_id FROM outfit_sources;
        PRAGMA user_version=2;`);
    }
    if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('迁移关系验证失败');
  });}catch(e){db.close();throw e;}
  return {
    read:envelope,catalog:readCatalog,document:key=>{const row=db.prepare('SELECT data FROM documents WHERE key=?').get(key);return row?parse(row.data):null;},
    asset:url=>db.prepare('SELECT * FROM media_assets WHERE url=?').get(url.replace(/^\//,'')),
    assets:()=>db.prepare('SELECT * FROM media_assets ORDER BY url').all(),
    initialize(source={key:null,raw:null}){
      if(!source||(source.raw!==null&&typeof source.raw!=='string'))throw Error('迁移来源格式无效');
      const fingerprint=hash(json(source));return tx(()=>{
        if(db.prepare('SELECT 1 FROM imports WHERE fingerprint=?').get(fingerprint))return envelope();
        snapshot('browser-before-migration',source);
        const incoming=source.raw===null?emptyPreferences():normalizePreferences(parse(source.raw),{repairDuplicates:true});
        const current=read();if(meta('initialized')==='1')snapshot('before-migration',fullBackup());
        const next=mergeBackup(current,createBackup(incoming),{conflicts:'keep-both',restoreDraft:!Object.keys(current.selections.owned).length});
        if(meta('initialized')!=='1')next.curation=incoming.curation||[];
        replaceForImport(next);setMeta('initialized','1');db.prepare('INSERT INTO imports VALUES (?,?)').run(fingerprint,new Date().toISOString());return envelope();
      });
    },
    commit(command,requestId,resolveReference){
      if(typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw Error('缺少有效的请求编号');
      if(!command||typeof command!=='object')throw Error('数据操作格式无效');
      const maintenance=['set-garment-status','upsert-garment','restore-garments','remove-garments','register-assets','retire-assets','set-document','swap-outfit-positions'];
      if(!maintenance.includes(command.type))assertCurrentCommand(command.type);
      const fingerprint=hash(json(command));return tx(()=>{
        const existing=db.prepare('SELECT fingerprint FROM commands WHERE id=?').get(requestId);
        if(existing){if(existing.fingerprint!==fingerprint)throw Error('请求编号已被其他操作使用');return envelope();}
        if(meta('initialized')!=='1')throw Error('请先完成浏览器记录迁移');
        snapshot('before-'+command.type,fullBackup());
        if(command.type==='swap-outfit-positions'){
          const current=read().outfits;
          if(json(command.expectedOrder)!==json(current.map(o=>o.id)))throw Error('搭配顺序已改变，请重新读取');
          if(!Array.isArray(command.records)||command.records.length!==2||command.records[0]?.id===command.records[1]?.id)throw Error('请指定两套不同的搭配');
          for(const record of command.records){
            const actual=current.find(o=>o.id===record?.id);
            if(!actual||json(actual)!==json(record))throw Error('搭配已变化，请重新读取');
          }
          const [a,b]=command.records.map(r=>db.prepare('SELECT id,position FROM outfits WHERE id=?').get(r.id));
          db.prepare('UPDATE outfits SET position=? WHERE id=?').run(b.position,a.id);
          db.prepare('UPDATE outfits SET position=? WHERE id=?').run(a.position,b.id);
          bump();
        }else if(maintenance.includes(command.type)){
          const catalog=readCatalog();
          if(command.type==='register-assets'){
            if(!Array.isArray(command.assets)||!command.assets.length)throw Error('缺少资源');
            for(const asset of command.assets)registerAsset(asset);
          }else if(command.type==='retire-assets'){
            retireAssets(command.records);
          }else if(command.type==='set-document'){
            if(!['reference-catalog','guides','thumbnails','preferences'].includes(command.key))throw Error('文档键无效');
            const old=db.prepare('SELECT data FROM documents WHERE key=?').get(command.key);
            if(json(command.expected??null)!==(old?.data||'null'))throw Error('资料已改变，请重新核对');
            if(command.key==='reference-catalog'){
              validateReferenceCatalog(command.data);
              for(const [id,code] of Object.entries(old?parse(old.data).codeRegistry||{}:{}))if(command.data.codeRegistry?.[id]!==code)throw Error('参考编号保留记录不可删除或改写');
              for(const f of command.data.formulas)for(const s of f.styles)for(const v of [...s.variants,...(s.accessories||[]).flatMap(a=>a.variants)])checkMedia(v.src.replace(/^\//,''));
            }
            if(command.key==='guides')validateGuides(command.data);
            if(command.key==='thumbnails')for(const [id,url] of Object.entries(command.data)){
              const item=catalog.items.find(i=>i.id===id);if(!item||!url.endsWith('-'+item.provenance.cutoutSha256.slice(0,12)+'.webp'))throw Error('缩略图与当前衣物不匹配');checkMedia(url);
            }
            db.prepare('INSERT INTO documents VALUES (?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').run(command.key,json(command.data));
          }else if(command.type==='restore-garments'){
            // Restoration is deliberately separate from intake. A reserved ID
            // can only return with its original alias and archived evidence;
            // unrelated records, outfits and retired URLs are never revived.
            if(typeof command.reason!=='string'||!command.reason.trim())throw Error('恢复须明确提供原因');
            if(!Array.isArray(command.records)||!command.records.length||command.records.length>100||new Set(command.records.map(r=>r?.record?.id)).size!==command.records.length)throw Error('请指定无重复的确切恢复记录');
            const sameRow=(a,b)=>a===undefined||b===undefined?a===b:isDeepStrictEqual(parse(json(a)),parse(json(b)));
            const base=({assets,provenance,imageHistory,wardrobeStatus,wardrobeStatusChangedAt,...rest})=>rest;
            const source=({review,...rest})=>rest;
            const sources=new Set(catalog.items.map(i=>json([i.provenance.originalSha256,i.provenance.sourceItemKey??null])));
            const prepared=command.records.map(entry=>{
              const {record,archivedRecord,expectedIdentity,expectedStored,expectedVersions}=entry;
              if(!record||!archivedRecord||!Object.hasOwn(entry,'expectedStored')||!Array.isArray(expectedVersions))throw Error('缺少恢复档案或删除状态快照');
              const identity=db.prepare('SELECT * FROM identities WHERE id=?').get(record.id)||null;
              if(!identity||identity.kind!=='garment'||!sameRow(identity,expectedIdentity)||record.code!==identity.code||archivedRecord.id!==identity.id||archivedRecord.code!==identity.code)throw Error('恢复只能使用原有衣物 ID 和编号');
              const stored=db.prepare('SELECT * FROM garments WHERE id=?').get(record.id)||null;
              const versions=db.prepare('SELECT * FROM garment_versions WHERE garment_id=? ORDER BY version').all(record.id);
              if(!sameRow(stored,expectedStored)||!sameRow(versions,expectedVersions))throw Error('删除状态已改变，请重新核对');
              if(stored&&!stored.deleted_at)throw Error('衣物仍在目录中，不能重复恢复');
              if(!sameRow(base(record),base(archivedRecord))||!sameRow(source(record.provenance),source(archivedRecord.provenance)))throw Error('恢复须保留原档案及图片证据');
              if(stored&&!sameRow(base({id:record.id,...parse(stored.data),code:identity.code}),base(archivedRecord)))throw Error('恢复档案与删除记录不符');
              if(!/^[a-f0-9]{64}$/.test(record.provenance.originalSha256)||!/^[a-f0-9]{64}$/.test(record.provenance.cutoutSha256))throw Error('恢复缺少原始图片校验值');
              const key=json([record.provenance.originalSha256,record.provenance.sourceItemKey??null]);
              if(sources.has(key))throw Error('重复来源，请核对已有衣物');
              sources.add(key);validateCatalog({items:[record]});
              return {record,stored};
            });
            if(command.assets)for(const asset of command.assets)registerAsset(asset);
            let position=db.prepare('SELECT COALESCE(MAX(position),-1)+1 AS n FROM garments').get().n;
            for(const {record,stored} of prepared){
              if(stored)db.prepare('UPDATE garments SET deleted_at=NULL WHERE id=?').run(record.id);
              writeGarment(record,stored?.position??position++);
            }
          }else if(command.type==='upsert-garment'){
            const record=command.record;
            const old=catalog.items.find(i=>i.id===record?.id);
            if(json(command.expected??null)!==json(old||null))throw Error('衣物档案已改变，请重新核对');
            if(!old&&db.prepare('SELECT 1 FROM identities WHERE id=?').get(record?.id))throw Error('ID 已被保留，不能重用');
            if(!old){
              const p=record.provenance;
              if(catalog.items.some(i=>i.provenance.originalSha256===p?.originalSha256&&i.provenance.sourceItemKey===p?.sourceItemKey))throw Error('重复来源，请核对已有衣物');
            }
            if(command.assets)for(const asset of command.assets)registerAsset(asset);
            writeGarment(number([record],'garment')[0],catalog.items.length);
          }else{
            if(!Array.isArray(command.records)||!command.records.length||new Set(command.records.map(r=>r.id)).size!==command.records.length)throw Error('请指定无重复的确切衣物');
            for(const record of command.records)if(json(catalog.items.find(i=>i.id===record.id))!==json(record))throw Error('衣物档案已改变，请重新核对');
            if(command.type==='set-garment-status'){
              if(!['active','pending-discard'].includes(command.status))throw Error('衣物状态无效');
              for(const record of command.records)writeGarment({...record,wardrobeStatus:command.status,wardrobeStatusChangedAt:new Date().toISOString()},0);
            }else{
              const related=new Set(command.records.flatMap(r=>db.prepare('SELECT outfit_id FROM outfit_items WHERE garment_id=?').all(r.id).map(x=>x.outfit_id)));
              if(related.size){
                const expected=command.relatedOutfits;
                if(!Array.isArray(expected)||expected.length!==related.size||expected.some(o=>!related.has(o.id)||json(read().outfits.find(r=>r.id===o.id))!==json(o)))throw Error('衣物仍被搭配使用；先核对并明确提供 relatedOutfits，不能自动删除');
                for(const o of expected)db.prepare('DELETE FROM outfits WHERE id=?').run(o.id);
              }
              for(const r of command.records)db.prepare('UPDATE garments SET deleted_at=? WHERE id=?').run(new Date().toISOString(),r.id);
            }
          }
          setMeta('catalog_meta',json({...parse(meta('catalog_meta')||'{"schemaVersion":1}'),updatedAt:new Date().toISOString()}));bump();
        }else{
          const current=command.type==='import-backup'?read():activeRecords();
          if(['upsert-owned-outfit','upsert-planned-outfit'].includes(command.type)&&!current.outfits.some(o=>o.id===command.record?.id)&&db.prepare('SELECT 1 FROM identities WHERE id=?').get(command.record?.id))throw Error('已删除的搭配 ID 已保留；恢复须显式导入备份，不能重用');
          const next=applyCommand(current,command,readCatalog().items,resolveReference);
          if(command.type==='import-backup')replaceForImport(next);
          else if(command.type==='remove-owned-outfits'){
            for(const r of command.records)db.prepare('DELETE FROM outfits WHERE id=?').run(r.id);bump();
          }else{
            const isNote=command.type==='save-note',record=next[isNote?'saved':'outfits'].find(r=>r.id===command.record.id);
            const table=isNote?'notes':'outfits';
            const position=db.prepare(`SELECT position FROM ${table} WHERE id=?`).get(record.id)?.position??db.prepare(`SELECT COALESCE(MAX(position),-1)+1 AS n FROM ${table}`).get().n;
            if(isNote)db.prepare('INSERT INTO notes VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(record.id,position,json(record));
            else writeOutfit(number([record],'outfit')[0],position);bump();
          }
        }
        db.prepare('INSERT INTO commands VALUES (?,?)').run(requestId,fingerprint);return envelope();
      });
    },
    backup(){return {backup:createBackup(read()),snapshot:snapshot('manual',fullBackup())};},
    fullBackup,
    integrity:()=>db.prepare('PRAGMA integrity_check').get().integrity_check,
    foreignKeys:()=>db.prepare('PRAGMA foreign_key_check').all(),
    close:()=>db.close()
  };
}
