import { APP_VERSION } from '../version.js';
import { getErrorLog } from '../app.js';
import {
  DB_NAME,
  DB_VERSION,
  getStoreCounts,
  getSetting,
  setSetting,
  getAllCards,
  getCardByLemma,
  normalizeLemma,
  exportFullBackup,
  exportShareList,
  importCardsMerge,
  importFullBackup,
} from '../db.js';
import { cardsToCsv, parseCsvToCards } from '../csv.js';

let settingsBanner = null;
let pendingImport = null; // { mode: 'backup'|'cards', data, newCount, existingCount }

function addRow(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'kv-row';
  const k = document.createElement('span');
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'badge';
  v.textContent = value;
  row.append(k, v);
  parent.appendChild(row);
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function shareOrDownload(filename, content, mimeType) {
  const file = new File([content], filename, { type: mimeType });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title: 'Vokabelmonster Word List',
      files: [file],
    });
    return;
  }
  downloadFile(filename, content, mimeType);
}

export async function renderSettings(container) {
  container.innerHTML = '';
  const rerender = () => renderSettings(container);

  if (settingsBanner) {
    const b = document.createElement('div');
    b.className = `banner ${settingsBanner.type === 'error' ? 'banner-error' : 'banner-success'}`;
    b.textContent = settingsBanner.text;
    container.appendChild(b);
  }

  // 1. Study Limits
  const limitsCard = document.createElement('section');
  limitsCard.className = 'card';
  const lh2 = document.createElement('h2');
  lh2.textContent = 'Study Settings';
  limitsCard.appendChild(lh2);

  const [newPerDay, maxReviewsPerDay, dailyGoal, lastBackup, dictMode] = await Promise.all([
    getSetting('newPerDay', 10),
    getSetting('maxReviewsPerDay', 100),
    getSetting('dailyGoal', 20),
    getSetting('lastBackupTs', null),
    getSetting('dictMode', 'online'),
  ]);

  const form = document.createElement('form');
  const makeNumField = (label, val) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const inp = document.createElement('input');
    inp.className = 'input';
    inp.type = 'number';
    inp.min = '1';
    inp.max = '999';
    inp.value = String(val);
    wrap.append(l, inp);
    return { wrap, inp };
  };

  const fNew = makeNumField('New cards per day', newPerDay);
  const fMax = makeNumField('Max reviews per day', maxReviewsPerDay);
  const fGoal = makeNumField('Daily goal (ring)', dailyGoal);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'submit';
  saveBtn.className = 'btn btn-primary';
  saveBtn.style.width = '100%';
  saveBtn.textContent = 'Save Settings';

  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      await setSetting('newPerDay', Math.max(1, Number(fNew.inp.value) || 10));
      await setSetting('maxReviewsPerDay', Math.max(1, Number(fMax.inp.value) || 100));
      await setSetting('dailyGoal', Math.max(1, Number(fGoal.inp.value) || 20));
      settingsBanner = { type: 'success', text: 'Settings saved.' };
      rerender();
    } catch (err) {
      settingsBanner = { type: 'error', text: err.message };
      rerender();
    }
  };

  form.append(fNew.wrap, fMax.wrap, fGoal.wrap, saveBtn);
  limitsCard.appendChild(form);
  container.appendChild(limitsCard);

  // 1b. Dictionary Mode
  const dictCard = document.createElement('section');
  dictCard.className = 'card';
  const dh2 = document.createElement('h2');
  dh2.textContent = 'Dictionary Mode';
  dictCard.appendChild(dh2);

  let hasOfflineFile = false;
  try {
    const headRes = await fetch('./data/de-dict.json', { method: 'HEAD' });
    hasOfflineFile = headRes.ok;
  } catch {
    hasOfflineFile = false;
  }

  const effectiveMode = !hasOfflineFile && dictMode !== 'online' ? 'online' : dictMode;
  const modes = [
    { id: 'online', label: 'Online', desc: 'فقط اینترنت' },
    { id: 'offline', label: 'Offline', desc: 'فقط فایل داخل اپ' },
    { id: 'auto', label: 'Auto', desc: 'اول فایل داخل اپ، بعد اینترنت' },
  ];

  for (const m of modes) {
    const row = document.createElement('label');
    row.className = 'kv-row';
    row.style.cursor = 'pointer';

    const left = document.createElement('div');
    const title = document.createElement('div');
    title.style.fontWeight = '600';
    title.textContent = m.label;
    const desc = document.createElement('div');
    desc.className = 'muted';
    desc.dir = 'rtl';
    desc.style.fontSize = '12px';
    desc.textContent = m.desc;
    left.append(title, desc);

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'dictMode';
    radio.value = m.id;
    radio.checked = effectiveMode === m.id;
    if (!hasOfflineFile && m.id !== 'online') {
      radio.disabled = true;
    }
    radio.onchange = async () => {
      await setSetting('dictMode', m.id);
      settingsBanner = { type: 'success', text: `Dictionary mode: ${m.label}` };
      rerender();
    };

    row.append(left, radio);
    dictCard.appendChild(row);
  }

  if (!hasOfflineFile) {
    const warn = document.createElement('p');
    warn.className = 'muted';
    warn.dir = 'rtl';
    warn.style.fontSize = '12px';
    warn.textContent = 'فایل آفلاین data/de-dict.json موجود نیست؛ حالت‌های offline و auto غیرفعال هستند.';
    dictCard.appendChild(warn);
  }

  // Collapsible Dictionary Debug panel
  const dbg = getLastDictDebug();
  const details = document.createElement('details');
  details.style.marginTop = '10px';
  const summary = document.createElement('summary');
  summary.style.cursor = 'pointer';
  summary.style.fontWeight = '600';
  summary.textContent = 'Dictionary debug';
  details.appendChild(summary);

  const dbgBox = document.createElement('div');
  dbgBox.className = 'muted';
  dbgBox.style.fontSize = '12px';
  dbgBox.style.marginTop = '8px';
  if (!dbg) {
    dbgBox.textContent = 'No dictionary lookup performed yet in this session.';
  } else {
    for (const [k, v] of [
      ['URL', dbg.url],
      ['HTTP Status', String(dbg.status)],
      ['Response Time', `${dbg.ms} ms`],
      ['Error', dbg.error || 'None'],
      ['Response Size', `${dbg.bytes} bytes`],
      ['Article', dbg.parsed?.article],
      ['Plural', dbg.parsed?.plural],
      ['Genitive', dbg.parsed?.genitive],
      ['Verb Forms', dbg.parsed?.verbForms],
    ]) {
      const line = document.createElement('div');
      line.style.wordBreak = 'break-all';
      line.textContent = `${k}: ${v}`;
      dbgBox.appendChild(line);
    }
  }
  details.appendChild(dbgBox);
  dictCard.appendChild(details);
  container.appendChild(dictCard);

  // 2. Backup, Export & Share
  const backupCard = document.createElement('section');
  backupCard.className = 'card';
  const bh2 = document.createElement('h2');
  bh2.textContent = 'Backup & Share';
  backupCard.appendChild(bh2);

  const lastStr = lastBackup
    ? new Date(lastBackup).toLocaleDateString()
    : 'Never (please back up!)';
  addRow(backupCard, 'Last Backup', lastStr);

  const btnStack = document.createElement('div');
  btnStack.style.display = 'flex';
  btnStack.style.flexDirection = 'column';
  btnStack.style.gap = '10px';
  btnStack.style.marginTop = '12px';

  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'btn btn-primary';
  shareBtn.textContent = 'Share my word list (for partner)';
  shareBtn.onclick = async () => {
    try {
      const payload = await exportShareList();
      await shareOrDownload(
        'vokabelmonster-share.json',
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      settingsBanner = { type: 'success', text: 'Word list ready to share.' };
      rerender();
    } catch (err) {
      settingsBanner = { type: 'error', text: `Share failed: ${err.message}` };
      rerender();
    }
  };

  const exportJsonBtn = document.createElement('button');
  exportJsonBtn.type = 'button';
  exportJsonBtn.className = 'btn';
  exportJsonBtn.textContent = 'Export Full Backup (JSON)';
  exportJsonBtn.onclick = async () => {
    try {
      const data = await exportFullBackup();
      downloadFile(
        `vokabelmonster-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        'application/json'
      );
      await setSetting('lastBackupTs', Date.now());
      settingsBanner = { type: 'success', text: 'Full JSON backup downloaded.' };
      rerender();
    } catch (err) {
      settingsBanner = { type: 'error', text: `Export failed: ${err.message}` };
      rerender();
    }
  };

  const exportCsvBtn = document.createElement('button');
  exportCsvBtn.type = 'button';
  exportCsvBtn.className = 'btn';
  exportCsvBtn.textContent = 'Export Words (CSV)';
  exportCsvBtn.onclick = async () => {
    try {
      const cards = await getAllCards();
      downloadFile(
        `vokabelmonster-words-${new Date().toISOString().slice(0, 10)}.csv`,
        cardsToCsv(cards),
        'text/csv;charset=utf-8'
      );
      settingsBanner = { type: 'success', text: 'CSV exported.' };
      rerender();
    } catch (err) {
      settingsBanner = { type: 'error', text: `CSV export failed: ${err.message}` };
      rerender();
    }
  };

  const importLabel = document.createElement('label');
  importLabel.className = 'btn';
  importLabel.textContent = 'Import JSON or CSV (Merge)';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,.csv,application/json,text/csv';
  fileInput.style.display = 'none';
  fileInput.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      let mode = 'cards';
      let data = null;
      let cardsList = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        cardsList = parseCsvToCards(text);
        data = cardsList;
      } else {
        const json = JSON.parse(text);
        if (json.type === 'vokabelmonster-backup') {
          mode = 'backup';
          data = json;
          cardsList = Array.isArray(json.cards) ? json.cards : [];
        } else if (Array.isArray(json.cards)) {
          cardsList = json.cards;
          data = cardsList;
        } else {
          throw new Error('Unrecognized JSON format.');
        }
      }

      let newCount = 0;
      let existingCount = 0;
      for (const c of cardsList) {
        const norm = normalizeLemma(c.lemma);
        if (!norm) continue;
        const exists = await getCardByLemma(norm);
        if (exists) existingCount++;
        else newCount++;
      }

      pendingImport = { mode, data, newCount, existingCount };
      settingsBanner = null;
      rerender();
    } catch (err) {
      pendingImport = null;
      settingsBanner = { type: 'error', text: `Import failed: ${err.message}` };
      rerender();
    }
  };
  importLabel.appendChild(fileInput);

  btnStack.append(shareBtn, exportJsonBtn, exportCsvBtn, importLabel);
  backupCard.appendChild(btnStack);

  if (pendingImport) {
    const prevBox = document.createElement('div');
    prevBox.className = 'banner banner-success';
    prevBox.style.marginTop = '12px';
    const msg = document.createElement('div');
    msg.textContent = `Preview: ${pendingImport.newCount} new, ${pendingImport.existingCount} already exist.`;
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginTop = '8px';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-primary btn-sm';
    confirmBtn.textContent = 'Confirm Import';
    confirmBtn.onclick = async () => {
      try {
        const res =
          pendingImport.mode === 'backup'
            ? await importFullBackup(pendingImport.data)
            : await importCardsMerge(pendingImport.data, { includeSrs: false });
        pendingImport = null;
        settingsBanner = {
          type: 'success',
          text: `Imported: ${res.added} added, ${res.skipped} skipped.`,
        };
        rerender();
      } catch (err) {
        pendingImport = null;
        settingsBanner = { type: 'error', text: `Import failed: ${err.message}` };
        rerender();
      }
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => {
      pendingImport = null;
      rerender();
    };

    row.append(confirmBtn, cancelBtn);
    prevBox.append(msg, row);
    backupCard.appendChild(prevBox);
  }

  container.appendChild(backupCard);

  // 3. Diagnostics
  const infoCard = document.createElement('section');
  infoCard.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = 'Diagnostics';
  infoCard.appendChild(h2);

  addRow(infoCard, 'App Version', `v${APP_VERSION}`);
  addRow(infoCard, 'Network', navigator.onLine ? 'Online' : 'Offline');

  let persistText = 'Unsupported';
  if (navigator.storage && navigator.storage.persisted) {
    try {
      const persisted = await navigator.storage.persisted();
      persistText = persisted ? 'Persistent' : 'Best-effort';
    } catch {
      persistText = 'Unknown';
    }
  }
  addRow(infoCard, 'Storage Persistence', persistText);

  try {
    const counts = await getStoreCounts();
    addRow(infoCard, 'IndexedDB', `${DB_NAME} (v${DB_VERSION}) OK`);
    addRow(infoCard, 'Cards stored', String(counts.cards));
  } catch (err) {
    addRow(infoCard, 'IndexedDB', `Error: ${err.message}`);
  }

  const note = document.createElement('p');
  note.className = 'muted';
  note.textContent =
    'Note: On iOS, Safari and the installed Home Screen app have separate storage. Always use the installed app for your real word list.';
  infoCard.appendChild(note);

  container.appendChild(infoCard);

  const errs = getErrorLog();
  if (errs.length > 0) {
    const errCard = document.createElement('section');
    errCard.className = 'card';
    const eh2 = document.createElement('h2');
    eh2.textContent = `Error Log (${errs.length})`;
    errCard.appendChild(eh2);
    for (const e of errs.slice(0, 5)) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.style.fontSize = '12px';
      p.textContent = `${e.ts.slice(11, 19)} — ${e.msg}`;
      errCard.appendChild(p);
    }
    container.appendChild(errCard);
  }
}
