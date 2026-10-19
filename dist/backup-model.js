import {normalizePreferences, validateBackup} from './data-schema.js';

export function createBackup(data) {
  return {format:'yixu-backup', version:data.curation ? 3 : 2, ...normalizePreferences(data)};
}

export function backupContents(data) {
  return validateBackup({format:'yixu-backup', version:data.curation ? 3 : data.selections ? 2 : 1, ...data});
}

// Compare canonical values, not incidental property ordering in JSON files.
// Aliases are assigned by the owning store, not user-authored outfit content.
const content=record=>{const {code,...rest}=record;return JSON.stringify(rest);};
export function previewBackup(previous, backup) {
  const current = normalizePreferences(previous), incoming = backupContents(backup);
  const entries = [];
  for (const kind of ['outfits','saved']) {
    const existing = new Map(current[kind].map(record => [record.id, record]));
    for (const record of incoming[kind]) {
      const before = existing.get(record.id);
      entries.push({kind, before, record, status:!before ? 'new' : content(before) === content(record) ? 'identical' : 'conflict'});
    }
  }
  return {
    entries, added:entries.filter(x => x.status === 'new').length,
    identical:entries.filter(x => x.status === 'identical').length,
    conflicts:entries.filter(x => x.status === 'conflict'),
    hasDraft:!!incoming.selections, hasCuration:!!incoming.curation
  };
}

export function mergeBackup(previous, backup, {conflicts = 'keep-current', restoreDraft = false} = {}) {
  if (!['keep-current','keep-both'].includes(conflicts)) throw Error('请选择有效的冲突处理方式');
  const data = normalizePreferences(previous), incoming = backupContents(backup);
  for (const kind of ['outfits','saved']) {
    const occupied = new Set([...data[kind], ...incoming[kind]].map(x => x.id));
    for (const {record, status} of previewBackup(data, incoming).entries.filter(x => x.kind === kind)) {
      if (status === 'identical') continue;
      if (status === 'new') {data[kind].push(record); continue;}
      if (conflicts === 'keep-current') continue;
      // A repeated import of the same conflict must not create more copies.
      const equivalent = data[kind].some(x => x.id.startsWith(record.id+'~import-') && content({...x,id:record.id}) === content(record));
      if (equivalent) continue;
      let n = 1;
      while (occupied.has(record.id+'~import-'+n)) n++;
      const id = record.id+'~import-'+n;
      occupied.add(id);
      data[kind].push({...record,id});
    }
  }
  if (restoreDraft && incoming.selections) data.selections = incoming.selections;
  if(incoming.curation){
    // Read-preserve compatibility only; importing does not re-enable formula membership.
    const retained=data.curation||[];
    data.curation=[...retained,...incoming.curation.filter(r=>!retained.some(old=>old.styleId===r.styleId))];
  }
  return normalizePreferences(data);
}
