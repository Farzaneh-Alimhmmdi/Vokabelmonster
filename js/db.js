export const DB_NAME = 'vokabelmonster';
export const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        const cards = db.createObjectStore('cards', {
          keyPath: 'id',
          autoIncrement: true,
        });
        cards.createIndex('lemmaNorm', 'lemmaNorm', { unique: true });
        cards.createIndex('srsDue', 'srs.due', { unique: false });
        cards.createIndex('tags', 'tags', { unique: false, multiEntry: true });

        const reviewLog = db.createObjectStore('reviewLog', {
          keyPath: 'id',
          autoIncrement: true,
        });
        reviewLog.createIndex('cardId', 'cardId', { unique: false });
        reviewLog.createIndex('ts', 'ts', { unique: false });

        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('dictCache', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(req.error || new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
}

export async function getSetting(key, fallback = null) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : fallback);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoreCounts() {
  const db = await openDB();
  const stores = ['cards', 'reviewLog', 'settings', 'dictCache'];
  const counts = {};
  for (const name of stores) {
    counts[name] = await new Promise((resolve, reject) => {
      const tx = db.transaction(name, 'readonly');
      const req = tx.objectStore(name).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return counts;
}
