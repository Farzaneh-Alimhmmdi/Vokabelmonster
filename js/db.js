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

export function normalizeLemma(lemma) {
  return String(lemma || '').trim().toLowerCase();
}

export function createDefaultSrs(now = Date.now()) {
  return {
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReview: null,
  };
}

export async function getAllCards() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readonly');
    const req = tx.objectStore('cards').getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getCardById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readonly');
    const req = tx.objectStore('cards').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getCardByLemma(lemma) {
  const norm = normalizeLemma(lemma);
  if (!norm) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readonly');
    const req = tx.objectStore('cards').index('lemmaNorm').get(norm);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function addCard(cardData) {
  const lemma = String(cardData.lemma || '').trim();
  const lemmaNorm = normalizeLemma(lemma);
  if (!lemmaNorm) {
    throw new Error('Lemma is required');
  }

  const existing = await getCardByLemma(lemmaNorm);
  if (existing) {
    const err = new Error(`"${lemma}" is already in your word list.`);
    err.code = 'DUPLICATE_LEMMA';
    throw err;
  }

  const now = Date.now();
  const record = {
    lemma,
    lemmaNorm,
    article: cardData.article || null,
    pos: cardData.pos || 'noun',
    plural: String(cardData.plural || '').trim(),
    meaningFa: String(cardData.meaningFa || '').trim(),
    meaningEn: String(cardData.meaningEn || '').trim(),
    examples: Array.isArray(cardData.examples) ? cardData.examples : [],
    notes: String(cardData.notes || '').trim(),
    tags: Array.isArray(cardData.tags) ? cardData.tags : [],
    level: cardData.level || null,
    verbForms: cardData.verbForms || null,
    createdAt: now,
    srs: cardData.srs || createDefaultSrs(now),
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readwrite');
    const req = tx.objectStore('cards').add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

export async function updateCard(id, patch) {
  const current = await getCardById(id);
  if (!current) {
    throw new Error('Card not found');
  }

  const nextLemma =
    patch.lemma !== undefined ? String(patch.lemma).trim() : current.lemma;
  const nextNorm = normalizeLemma(nextLemma);
  if (!nextNorm) {
    throw new Error('Lemma is required');
  }

  if (nextNorm !== current.lemmaNorm) {
    const existing = await getCardByLemma(nextNorm);
    if (existing && existing.id !== id) {
      const err = new Error(`"${nextLemma}" is already in your word list.`);
      err.code = 'DUPLICATE_LEMMA';
      throw err;
    }
  }

  const updated = {
    ...current,
    ...patch,
    id,
    lemma: nextLemma,
    lemmaNorm: nextNorm,
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readwrite');
    const req = tx.objectStore('cards').put(updated);
    req.onsuccess = () => resolve(updated);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCard(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cards', 'readwrite');
    tx.objectStore('cards').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDictCache(key) {
  const norm = normalizeLemma(key);
  if (!norm) return null;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictCache', 'readonly');
    const req = tx.objectStore('dictCache').get(norm);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function setDictCache(key, data) {
  const norm = normalizeLemma(key);
  if (!norm) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('dictCache', 'readwrite');
    tx.objectStore('dictCache').put({ key: norm, data, ts: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function addReviewLog(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviewLog', 'readwrite');
    const req = tx.objectStore('reviewLog').add(entry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReviewLog(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviewLog', 'readwrite');
    tx.objectStore('reviewLog').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getReviewLogsSince(ts) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('reviewLog', 'readonly');
    const index = tx.objectStore('reviewLog').index('ts');
    const range = IDBKeyRange.lowerBound(ts);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function exportFullBackup() {
  const [cards, reviewLog] = await Promise.all([
    getAllCards(),
    getReviewLogsSince(0),
  ]);
  return {
    type: 'vokabelmonster-backup',
    dbVersion: DB_VERSION,
    exportedAt: Date.now(),
    cards,
    reviewLog,
  };
}

export async function exportShareList() {
  const cards = await getAllCards();
  const stripped = cards.map((c) => ({
    lemma: c.lemma,
    article: c.article || null,
    pos: c.pos || 'noun',
    plural: c.plural || '',
    meaningFa: c.meaningFa || '',
    meaningEn: c.meaningEn || '',
    examples: c.examples || [],
    notes: c.notes || '',
    tags: c.tags || [],
    level: c.level || null,
    verbForms: c.verbForms || null,
  }));
  return {
    type: 'vokabelmonster-share',
    exportedAt: Date.now(),
    cards: stripped,
  };
}

export async function importCardsMerge(incomingCards, { includeSrs = false } = {}) {
  let added = 0;
  let skipped = 0;
  for (const c of incomingCards) {
    const norm = normalizeLemma(c.lemma);
    if (!norm) {
      skipped++;
      continue;
    }
    const existing = await getCardByLemma(norm);
    if (existing) {
      skipped++;
      continue;
    }
    await addCard({
      ...c,
      srs: includeSrs && c.srs ? c.srs : undefined,
    });
    added++;
  }
  return { added, skipped };
}

export async function importFullBackup(data) {
  const cards = Array.isArray(data?.cards) ? data.cards : [];
  const res = await importCardsMerge(cards, { includeSrs: true });
  const logs = Array.isArray(data?.reviewLog) ? data.reviewLog : [];
  for (const l of logs) {
    if (l && l.cardId && l.ts) {
      await addReviewLog({
        cardId: l.cardId,
        ts: l.ts,
        rating: l.rating,
        prevInterval: l.prevInterval ?? 0,
        newInterval: l.newInterval ?? 0,
      });
    }
  }
  return res;
}
