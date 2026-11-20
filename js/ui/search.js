import { lookupWord } from '../dictionary.js';
import { getCardByLemma, getDictCache, setDictCache } from '../db.js';
import { setPendingPrefill } from './words.js';
import { speakGerman } from '../tts.js';

let searchState = {
  query: '',
  loading: false,
  error: null,
  result: null,
  fromCache: false,
  alreadyInList: false,
};

let debounceTimer = null;

async function runSearch(query, rerender) {
  const q = String(query || '').trim();
  searchState.query = q;
  if (!q) {
    searchState.loading = false;
    searchState.error = null;
    searchState.result = null;
    searchState.fromCache = false;
    searchState.alreadyInList = false;
    rerender();
    return;
  }

  searchState.loading = true;
  searchState.error = null;
  rerender();

  try {
    const cached = await getDictCache(q);
    let data = cached?.data || null;
    let fromCache = Boolean(data);

    if (!data) {
      if (!navigator.onLine) {
        throw new Error('You are offline and this word is not cached.');
      }
      data = await lookupWord(q);
      await setDictCache(q, data);
      fromCache = false;
    }

    const existing = await getCardByLemma(data.lemma);
    searchState.result = data;
    searchState.fromCache = fromCache;
    searchState.alreadyInList = Boolean(existing);
    searchState.loading = false;
    rerender();
  } catch (err) {
    searchState.loading = false;
    searchState.result = null;
    searchState.error = err.message || 'Lookup failed.';
    rerender();
  }
}

export function renderSearch(container) {
  container.innerHTML = '';
  const rerender = () => renderSearch(container);

  const searchCard = document.createElement('section');
  searchCard.className = 'card';

  const h2 = document.createElement('h2');
  h2.textContent = 'Dictionary Search';
  searchCard.appendChild(h2);

  const form = document.createElement('form');
  form.className = 'row-between';
  form.style.marginTop = '8px';

  const input = document.createElement('input');
  input.className = 'input';
  input.type = 'search';
  input.placeholder = 'Type a German word (e.g. Haus, gehen)...';
  input.value = searchState.query;

  input.oninput = (e) => {
    const val = e.target.value;
    searchState.query = val;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (val.trim().length >= 2) {
        runSearch(val, rerender);
      }
    }, 450);
  };

  const btn = document.createElement('button');
  btn.type = 'submit';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Search';

  form.onsubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    runSearch(input.value, rerender);
  };

  form.append(input, btn);
  searchCard.appendChild(form);
  container.appendChild(searchCard);

  if (searchState.loading) {
    const loadCard = document.createElement('section');
    loadCard.className = 'card';
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Searching Wiktionary & MyMemory...';
    loadCard.appendChild(p);
    container.appendChild(loadCard);
    return;
  }

  if (searchState.error) {
    const errCard = document.createElement('section');
    errCard.className = 'card';

    const banner = document.createElement('div');
    banner.className = 'banner banner-error';
    banner.textContent = searchState.error;

    const manualBtn = document.createElement('button');
    manualBtn.type = 'button';
    manualBtn.className = 'btn btn-primary';
    manualBtn.textContent = 'Add Manually';
    manualBtn.onclick = () => {
      setPendingPrefill({ lemma: searchState.query.trim() });
      window.location.hash = '#/words';
    };

    errCard.append(banner, manualBtn);
    container.appendChild(errCard);
    return;
  }

  if (!searchState.result) {
    const emptyCard = document.createElement('section');
    emptyCard.className = 'card empty-state';
    emptyCard.textContent =
      'Search any German word to see its article, plural, Persian meaning, and examples.';
    container.appendChild(emptyCard);
    return;
  }

  const r = searchState.result;
  const resCard = document.createElement('section');
  resCard.className = 'card';

  const head = document.createElement('div');
  head.className = 'word-head';

  const lemmaWrap = document.createElement('div');
  lemmaWrap.className = 'word-lemma';
  if (r.article) {
    const art = document.createElement('span');
    art.className = `article-${r.article}`;
    art.textContent = `${r.article} `;
    lemmaWrap.appendChild(art);
  }
  const lem = document.createElement('span');
  lem.textContent = r.lemma;
  lemmaWrap.appendChild(lem);

  if (r.plural) {
    const pl = document.createElement('span');
    pl.className = 'muted';
    pl.textContent = ` (Pl. ${r.plural})`;
    lemmaWrap.appendChild(pl);
  }

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = searchState.fromCache ? `${r.pos} · cached` : r.pos;

  const speakBtn = document.createElement('button');
  speakBtn.type = 'button';
  speakBtn.className = 'btn btn-sm';
  speakBtn.setAttribute('aria-label', 'Pronounce word');
  speakBtn.textContent = '🔊';
  speakBtn.onclick = () => speakGerman(r.article ? `${r.article} ${r.lemma}` : r.lemma);

  const rightGroup = document.createElement('div');
  rightGroup.style.display = 'flex';
  rightGroup.style.alignItems = 'center';
  rightGroup.style.gap = '8px';
  rightGroup.append(speakBtn, badge);

  head.append(lemmaWrap, rightGroup);
  resCard.appendChild(head);

  if (r.meaningFa) {
    const fa = document.createElement('div');
    fa.className = 'word-meaning-fa';
    fa.dir = 'rtl';
    fa.textContent = r.meaningFa;
    resCard.appendChild(fa);
  }

  if (r.meaningEn) {
    const en = document.createElement('div');
    en.className = 'muted';
    en.style.marginTop = '4px';
    en.textContent = r.meaningEn;
    resCard.appendChild(en);
  }

  if (r.verbForms) {
    const vf = document.createElement('div');
    vf.className = 'muted';
    vf.style.marginTop = '8px';
    vf.textContent = `Verb forms: ${[
      r.verbForms.praeteritum,
      r.verbForms.partizip2,
      r.verbForms.hilfsverb,
    ]
      .filter(Boolean)
      .join(' · ')}`;
    resCard.appendChild(vf);
  }

  if (r.examples && r.examples.length > 0) {
    const exBox = document.createElement('div');
    exBox.style.marginTop = '10px';
    for (const ex of r.examples) {
      const p = document.createElement('p');
      p.className = 'muted';
      p.style.margin = '4px 0';
      p.textContent = `• ${ex.de}`;
      exBox.appendChild(p);
    }
    resCard.appendChild(exBox);
  }

  const footer = document.createElement('div');
  footer.style.marginTop = '14px';

  if (searchState.alreadyInList) {
    const inList = document.createElement('span');
    inList.className = 'badge';
    inList.textContent = '✓ Already in your list';
    footer.appendChild(inList);
  } else {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-primary';
    addBtn.style.width = '100%';
    addBtn.textContent = '+ Add to my list';
    addBtn.onclick = () => {
      setPendingPrefill(r);
      window.location.hash = '#/words';
    };
    footer.appendChild(addBtn);
  }

  resCard.appendChild(footer);
  container.appendChild(resCard);
}
