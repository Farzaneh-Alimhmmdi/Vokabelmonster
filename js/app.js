import { openDB } from './db.js';
import { renderSearch } from './ui/search.js';
import { renderReview } from './ui/review.js';
import { renderWords } from './ui/words.js';
import { renderStats } from './ui/stats.js';
import { renderSettings } from './ui/settings.js';

const ROUTES = {
  search: renderSearch,
  review: renderReview,
  words: renderWords,
  stats: renderStats,
  settings: renderSettings,
};

function getRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES[hash] ? hash : 'search';
}

function updateNetworkStatus() {
  const pill = document.getElementById('network-status');
  if (!pill) return;
  if (navigator.onLine) {
    pill.textContent = 'Online';
    pill.classList.remove('offline');
  } else {
    pill.textContent = 'Offline';
    pill.classList.add('offline');
  }
}

async function renderCurrentRoute() {
  const route = getRoute();
  const main = document.getElementById('app-main');
  if (!main) return;

  document.querySelectorAll('.tab-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === route);
  });

  try {
    await ROUTES[route](main);
  } catch (err) {
    main.innerHTML = '';
    const card = document.createElement('section');
    card.className = 'card';
    const p = document.createElement('p');
    p.textContent = `Error rendering view: ${err.message}`;
    card.appendChild(p);
    main.appendChild(card);
  }
}

const errorLog = [];

export function getErrorLog() {
  return [...errorLog];
}

function logAppError(msg) {
  errorLog.unshift({ ts: new Date().toISOString(), msg: String(msg) });
  if (errorLog.length > 20) errorLog.pop();
}

window.addEventListener('error', (e) => {
  logAppError(e.message || 'Unknown error');
});

window.addEventListener('unhandledrejection', (e) => {
  logAppError(e.reason?.message || String(e.reason || 'Unhandled rejection'));
});

function showUpdateToast() {
  if (document.getElementById('sw-update-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'sw-update-toast';
  toast.className = 'update-toast';

  const txt = document.createElement('span');
  txt.textContent = 'New version available!';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary btn-sm';
  btn.textContent = 'Reload';
  btn.onclick = () => window.location.reload();

  toast.append(txt, btn);
  document.body.appendChild(toast);
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.waiting && navigator.serviceWorker.controller) {
      showUpdateToast();
    }
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateToast();
        }
      });
    });
  } catch (err) {
    console.warn('Service worker registration failed:', err);
  }
}

async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // Ignore if unsupported
    }
  }
}

async function init() {
  updateNetworkStatus();
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  window.addEventListener('hashchange', renderCurrentRoute);

  try {
    await openDB();
  } catch (err) {
    console.error('IndexedDB init failed:', err);
  }

  await requestPersistence();
  await registerSW();
  await renderCurrentRoute();
}

init().catch((err) => {
  const main = document.getElementById('app-main');
  if (!main) return;
  main.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = 'Startup Error';
  const p = document.createElement('p');
  p.className = 'banner banner-error';
  p.textContent = err?.message || String(err);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Reload';
  btn.onclick = () => window.location.reload();
  card.append(h2, p, btn);
  main.appendChild(card);
});
