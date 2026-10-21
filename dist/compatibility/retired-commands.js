// Explicit rejection is intentional: cached old tabs must not mutate retired state.
export const retiredCommands=['curate','choose','remove','clear-draft','restore-outfit','add-outfit','recover-backup'];
export const currentCommands=['upsert-owned-outfit','upsert-planned-outfit','remove-owned-outfits','save-note','import-backup'];
export function assertCurrentCommand(type){
  if(retiredCommands.includes(type)){
    const error=Error('此旧版操作已退役，请刷新页面。已有记录未修改；新增搭配请通过 Codex。');
    error.code='RETIRED_OPERATION';throw error;
  }
  if(!currentCommands.includes(type))throw Error('未知的数据操作');
}
