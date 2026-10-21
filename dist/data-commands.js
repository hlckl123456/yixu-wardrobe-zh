import {normalizePreferences} from './data-schema.js';
import {fitsSlot} from './garment-model.js';
import {mergeBackup} from './backup-model.js';
import {assertCurrentCommand} from './compatibility/retired-commands.js';
import {isActiveGarment} from './garment-status.js';
import {assertLayeringSelection} from './layering-limits.js';

// Pure business operations: no DOM, navigation, storage, or view state.
export function applyCommand(previous, command, items = [], resolveReference) {
  assertCurrentCommand(command?.type);
  const data = normalizePreferences(previous);
  switch (command.type) {
    case 'upsert-owned-outfit':
    case 'upsert-planned-outfit': {
      const record=normalizePreferences({outfits:[command.record]}).outfits[0];
      if((command.type==='upsert-planned-outfit')!==(record.outfitKind==='planned'))throw Error('请明确区分已有搭配和含未购单品的待购搭配');
      if(record.sourceReference&&!resolveReference?.(record.sourceReference))throw Error('参考穿法链接无效或未读取，未保存搭配');
      const entries=Object.entries(record.selection);
      if(!entries.length||new Set(entries.map(([,id])=>id)).size!==entries.length)throw Error('真实搭配须包含衣物，且不能重复占用同一件');
      for(const [slot,id] of entries){
        const item=items.find(i=>i.id===id&&i.collection==='owned');
        if(!item||!fitsSlot(item,slot))throw Error('衣物不存在或不适用于该位置：'+id);
        if(!isActiveGarment(item))throw Error('衣物已移入准备丢弃，请先确认是否恢复使用：'+(item.code||id));
      }
      assertLayeringSelection(record.selection,items);
      const index=data.outfits.findIndex(o=>o.id===record.id);
      if(record.derivedFromOutfitId){
        const source=data.outfits.find(o=>o.id===record.derivedFromOutfitId);
        if(!source&&data.outfits[index]?.derivedFromOutfitId!==record.derivedFromOutfitId)throw Error('原搭配不存在，未保存关联');
        const visited=new Set([record.id]);let current=source;
        while(current){if(visited.has(current.id))throw Error('原搭配关联不能形成循环');visited.add(current.id);current=data.outfits.find(o=>o.id===current.derivedFromOutfitId);}
      }
      if(index!==-1&&JSON.stringify(data.outfits[index])!==JSON.stringify(command.expected))throw Error('搭配已变化，需重新读取后再修改');
      if(index===-1&&command.expected)throw Error('待修改的搭配已不存在');
      if(index!==-1&&data.outfits[index].code){
        if(record.code&&record.code!==data.outfits[index].code)throw Error('不能修改已分配的搭配短编号');
        record.code=data.outfits[index].code;
      }
      if(index===-1)data.outfits.push(record);else data.outfits[index]=record;
      break;
    }
    case 'remove-owned-outfits': {
      // Codex maintenance only: exact IDs plus full stale-write guards, never
      // list positions or a wildcard. Validate the entire batch before removal.
      if(!Array.isArray(command.records)||!command.records.length||command.records.length>100)throw Error('请明确指定要删除的搭配');
      const ids=command.records.map(r=>r?.id);
      if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('删除搭配编号无效或重复');
      for(const expected of command.records){
        const actual=data.outfits.find(o=>o.id===expected.id);
        if(!actual)throw Error('待删除的搭配已不存在：'+expected.id);
        if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('搭配已变化，需重新读取后再删除：'+expected.id);
      }
      data.outfits=data.outfits.filter(o=>!ids.includes(o.id));
      break;
    }
    case 'save-note': {
      const index = data.saved.findIndex(x => x.id === command.record.id);
      if ((index!==-1||command.expected) && JSON.stringify(data.saved[index]) !== JSON.stringify(command.expected)) throw Error('这条笔记已改变，请重新读取后再编辑');
      if (index === -1) data.saved.push(command.record);
      else data.saved[index] = command.record;
      break;
    }
    case 'import-backup': {
      if (command.expected && JSON.stringify(data) !== JSON.stringify(normalizePreferences(command.expected))) throw Error('记录已在另一页面改变，请重新选择备份查看最新预览');
      return mergeBackup(data, command.data, command.options);
    }
    default: throw Error('未知的数据操作');
  }
  return normalizePreferences(data);
}
