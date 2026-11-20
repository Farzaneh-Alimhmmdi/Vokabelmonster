import { APP_VERSION } from '../version.js';
import { DB_NAME, DB_VERSION, getStoreCounts } from '../db.js';

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

export async function renderSettings(container) {
  container.innerHTML = '';

  const infoCard = document.createElement('section');
  infoCard.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = 'Settings & Diagnostics';
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
}
