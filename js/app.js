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

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js', { scope: './' });
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

init();
