import { getAllCards, addCard, updateCard, deleteCard } from '../db.js';
import { speakGerman } from '../tts.js';

const DEFAULT_TAGS = [
  'A1',
  'A2',
  'B1',
  'Behörden',
  'Arbeit',
  'Wohnung',
  'Arzt',
  'Alltag',
  'Einkaufen',
  'Verkehr',
];

let state = {
  search: '',
  activeTag: 'ALL',
  editingCard: null,
  showForm: false,
  banner: null,
  confirmDeleteId: null,
  visibleLimit: 50,
};

export function setPendingPrefill(prefillData) {
  state.editingCard = prefillData || null;
  state.showForm = true;
  state.banner = null;
}

function setBanner(type, text) {
  state.banner = text ? { type, text } : null;
}

function renderBanner(container) {
  if (!state.banner) return;
  const div = document.createElement('div');
  div.className = `banner ${state.banner.type === 'error' ? 'banner-error' : 'banner-success'}`;
  div.textContent = state.banner.text;
  container.appendChild(div);
}

function renderForm(container, onDone) {
  const card = state.editingCard;
  const isEdit = Boolean(card && card.id);
  const selectedTags = new Set(card?.tags || []);

  const section = document.createElement('section');
  section.className = 'card';

  const header = document.createElement('div');
  header.className = 'row-between';
  const h2 = document.createElement('h2');
  h2.textContent = isEdit ? 'Edit Word' : 'Add Word';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-sm';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    state.showForm = false;
    state.editingCard = null;
    setBanner(null, '');
    onDone();
  };
  header.append(h2, cancelBtn);
  section.appendChild(header);

  renderBanner(section);

  const form = document.createElement('form');

  const makeField = (labelText, inputEl) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.append(label, inputEl);
    return wrap;
  };

  const lemmaInput = document.createElement('input');
  lemmaInput.className = 'input';
  lemmaInput.required = true;
  lemmaInput.placeholder = 'e.g. Haus, gehen, schnell';
  lemmaInput.value = card?.lemma || '';

  const articleSelect = document.createElement('select');
  articleSelect.className = 'select';
  for (const opt of [
    { v: '', t: 'No article' },
    { v: 'der', t: 'der (masculine)' },
    { v: 'die', t: 'die (feminine)' },
    { v: 'das', t: 'das (neuter)' },
  ]) {
    const o = document.createElement('option');
    o.value = opt.v;
    o.textContent = opt.t;
    if ((card?.article || '') === opt.v) o.selected = true;
    articleSelect.appendChild(o);
  }

  const posSelect = document.createElement('select');
  posSelect.className = 'select';
  for (const p of ['noun', 'verb', 'adj', 'adv', 'phrase', 'other']) {
    const o = document.createElement('option');
    o.value = p;
    o.textContent = p;
    if ((card?.pos || 'noun') === p) o.selected = true;
    posSelect.appendChild(o);
  }

  const pluralInput = document.createElement('input');
  pluralInput.className = 'input';
  pluralInput.placeholder = 'e.g. Häuser';
  pluralInput.value = card?.plural || '';

  const levelSelect = document.createElement('select');
  levelSelect.className = 'select';
  for (const lvl of ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const o = document.createElement('option');
    o.value = lvl;
    o.textContent = lvl || 'No level';
    if ((card?.level || '') === lvl) o.selected = true;
    levelSelect.appendChild(o);
  }

  const meaningFaInput = document.createElement('input');
  meaningFaInput.className = 'input';
  meaningFaInput.dir = 'rtl';
  meaningFaInput.placeholder = 'معنی فارسی...';
  meaningFaInput.value = card?.meaningFa || '';

  const meaningEnInput = document.createElement('input');
  meaningEnInput.className = 'input';
  meaningEnInput.placeholder = 'English meaning (optional)';
  meaningEnInput.value = card?.meaningEn || '';

  const exDeInput = document.createElement('input');
  exDeInput.className = 'input';
  exDeInput.placeholder = 'Beispielsatz auf Deutsch';
  exDeInput.value = card?.examples?.[0]?.de || '';

  const exFaInput = document.createElement('input');
  exFaInput.className = 'input';
  exFaInput.dir = 'rtl';
  exFaInput.placeholder = 'ترجمه جمله مثال (اختیاری)';
  exFaInput.value = card?.examples?.[0]?.fa || '';

  const notesInput = document.createElement('textarea');
  notesInput.className = 'textarea';
  notesInput.placeholder = 'Notes, grammar hints...';
  notesInput.value = card?.notes || '';

  // Tag picker
  const tagWrap = document.createElement('div');
  tagWrap.className = 'field';
  const tagLabel = document.createElement('label');
  tagLabel.textContent = 'Tags';
  const chipsRow = document.createElement('div');
  chipsRow.className = 'chips-row';

  const allSuggested = Array.from(new Set([...DEFAULT_TAGS, ...selectedTags]));
  const renderChips = () => {
    chipsRow.innerHTML = '';
    for (const tag of allSuggested) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip ${selectedTags.has(tag) ? 'active' : ''}`;
      btn.textContent = tag;
      btn.onclick = () => {
        if (selectedTags.has(tag)) selectedTags.delete(tag);
        else selectedTags.add(tag);
        renderChips();
      };
      chipsRow.appendChild(btn);
    }
  };
  renderChips();

  const customTagRow = document.createElement('div');
  customTagRow.className = 'row-between';
  customTagRow.style.marginTop = '8px';
  const customTagInput = document.createElement('input');
  customTagInput.className = 'input';
  customTagInput.placeholder = 'Add custom tag...';
  const addTagBtn = document.createElement('button');
  addTagBtn.type = 'button';
  addTagBtn.className = 'btn btn-sm';
  addTagBtn.textContent = 'Add';
  addTagBtn.onclick = () => {
    const val = customTagInput.value.trim();
    if (!val) return;
    if (!allSuggested.includes(val)) allSuggested.push(val);
    selectedTags.add(val);
    customTagInput.value = '';
    renderChips();
  };
  customTagRow.append(customTagInput, addTagBtn);
  tagWrap.append(tagLabel, chipsRow, customTagRow);

  const row1 = document.createElement('div');
  row1.className = 'grid-2';
  row1.append(
    makeField('Article', articleSelect),
    makeField('Part of speech', posSelect)
  );

  const row2 = document.createElement('div');
  row2.className = 'grid-2';
  row2.append(
    makeField('Plural', pluralInput),
    makeField('Level', levelSelect)
  );

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.style.width = '100%';
  submitBtn.textContent = isEdit ? 'Save Changes' : 'Save Word';

  form.append(
    makeField('German Word (Lemma) *', lemmaInput),
    row1,
    row2,
    makeField('Persian Meaning', meaningFaInput),
    makeField('English Meaning', meaningEnInput),
    makeField('Example (German)', exDeInput),
    makeField('Example (Persian)', exFaInput),
    tagWrap,
    makeField('Notes', notesInput),
    submitBtn
  );

  form.onsubmit = async (e) => {
    e.preventDefault();
    const examples = [];
    if (exDeInput.value.trim()) {
      examples.push({
        de: exDeInput.value.trim(),
        fa: exFaInput.value.trim() || undefined,
      });
    }

    const payload = {
      lemma: lemmaInput.value.trim(),
      article: articleSelect.value || null,
      pos: posSelect.value || 'noun',
      plural: pluralInput.value.trim(),
      level: levelSelect.value || null,
      meaningFa: meaningFaInput.value.trim(),
      meaningEn: meaningEnInput.value.trim(),
      examples,
      notes: notesInput.value.trim(),
      tags: Array.from(selectedTags),
      verbForms: card?.verbForms || null,
    };

    try {
      if (isEdit) {
        await updateCard(card.id, payload);
        setBanner('success', `"${payload.lemma}" updated.`);
      } else {
        await addCard(payload);
        setBanner('success', `"${payload.lemma}" added.`);
      }
      state.showForm = false;
      state.editingCard = null;
      onDone();
    } catch (err) {
      setBanner('error', err.message || 'Could not save word.');
      onDone();
    }
  };

  section.appendChild(form);
  container.appendChild(section);
}

export async function renderWords(container) {
  container.innerHTML = '';

  const rerender = () => renderWords(container);

  if (state.showForm) {
    renderForm(container, rerender);
    return;
  }

  let cards = [];
  try {
    cards = await getAllCards();
  } catch (err) {
    setBanner('error', `Failed to load words: ${err.message}`);
  }

  // Header card
  const topCard = document.createElement('section');
  topCard.className = 'card';

  const topRow = document.createElement('div');
  topRow.className = 'row-between';
  const title = document.createElement('h2');
  title.style.margin = '0';
  title.textContent = `Words (${cards.length})`;

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn btn-primary btn-sm';
  addBtn.textContent = '+ Add Word';
  addBtn.onclick = () => {
    state.editingCard = null;
    state.showForm = true;
    setBanner(null, '');
    rerender();
  };
  topRow.append(title, addBtn);
  topCard.appendChild(topRow);

  renderBanner(topCard);

  // Search input
  const searchInput = document.createElement('input');
  searchInput.className = 'input';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search words, meanings, notes...';
  searchInput.style.marginTop = '12px';
  searchInput.value = state.search;
  searchInput.oninput = (e) => {
    state.search = e.target.value;
    rerender();
  };
  topCard.appendChild(searchInput);

  // Tag filter chips
  const usedTags = new Set();
  for (const c of cards) {
    for (const t of c.tags || []) usedTags.add(t);
  }
  if (usedTags.size > 0) {
    const filterRow = document.createElement('div');
    filterRow.className = 'chips-row';
    filterRow.style.marginTop = '10px';

    const makeFilterChip = (label, value) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip ${state.activeTag === value ? 'active' : ''}`;
      btn.textContent = label;
      btn.onclick = () => {
        state.activeTag = value;
        rerender();
      };
      return btn;
    };

    filterRow.appendChild(makeFilterChip('All', 'ALL'));
    for (const t of Array.from(usedTags).sort()) {
      filterRow.appendChild(makeFilterChip(t, t));
    }
    topCard.appendChild(filterRow);
  }

  container.appendChild(topCard);

  // Filter cards
  const q = state.search.trim().toLowerCase();
  const filtered = cards.filter((c) => {
    if (state.activeTag !== 'ALL' && !(c.tags || []).includes(state.activeTag)) {
      return false;
    }
    if (!q) return true;
    return (
      (c.lemma || '').toLowerCase().includes(q) ||
      (c.meaningFa || '').toLowerCase().includes(q) ||
      (c.meaningEn || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  });

  const listCard = document.createElement('section');
  listCard.className = 'card';
  listCard.style.padding = '0';

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent =
      cards.length === 0
        ? 'No words yet. Tap "+ Add Word" to add your first German word!'
        : 'No words match your search or tag filter.';
    listCard.appendChild(empty);
    container.appendChild(listCard);
    return;
  }

  const visibleCards = filtered.slice(0, state.visibleLimit);
  for (const card of visibleCards) {
    const item = document.createElement('div');
    item.className = 'word-item';

    const head = document.createElement('div');
    head.className = 'word-head';

    const lemmaWrap = document.createElement('div');
    lemmaWrap.className = 'word-lemma';
    if (card.article) {
      const art = document.createElement('span');
      art.className = `article-${card.article}`;
      art.textContent = `${card.article} `;
      lemmaWrap.appendChild(art);
    }
    const lem = document.createElement('span');
    lem.textContent = card.lemma;
    lemmaWrap.appendChild(lem);

    if (card.plural) {
      const pl = document.createElement('span');
      pl.className = 'muted';
      pl.textContent = ` (Pl. ${card.plural})`;
      lemmaWrap.appendChild(pl);
    }

    const meta = document.createElement('span');
    meta.className = 'badge';
    meta.textContent = [card.pos, card.level].filter(Boolean).join(' · ');

    head.append(lemmaWrap, meta);
    item.appendChild(head);

    if (card.meaningFa) {
      const fa = document.createElement('div');
      fa.className = 'word-meaning-fa';
      fa.dir = 'rtl';
      fa.textContent = card.meaningFa;
      item.appendChild(fa);
    }

    if (card.meaningEn) {
      const en = document.createElement('div');
      en.className = 'muted';
      en.textContent = card.meaningEn;
      item.appendChild(en);
    }

    if (card.tags && card.tags.length > 0) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'chips-row';
      tagsRow.style.marginTop = '8px';
      for (const t of card.tags) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = t;
        tagsRow.appendChild(b);
      }
      item.appendChild(tagsRow);
    }

    const actions = document.createElement('div');
    actions.className = 'word-actions';

    const speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'btn btn-sm';
    speakBtn.setAttribute('aria-label', 'Pronounce word');
    speakBtn.textContent = '🔊';
    speakBtn.onclick = () =>
      speakGerman(card.article ? `${card.article} ${card.lemma}` : card.lemma);
    actions.appendChild(speakBtn);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-sm';
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => {
      state.editingCard = card;
      state.showForm = true;
      setBanner(null, '');
      rerender();
    };
    actions.appendChild(editBtn);

    if (state.confirmDeleteId === card.id) {
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-danger btn-sm';
      confirmBtn.textContent = 'Confirm Delete';
      confirmBtn.onclick = async () => {
        try {
          await deleteCard(card.id);
          state.confirmDeleteId = null;
          setBanner('success', `"${card.lemma}" deleted.`);
          rerender();
        } catch (err) {
          setBanner('error', `Delete failed: ${err.message}`);
          rerender();
        }
      };

      const cancelDelBtn = document.createElement('button');
      cancelDelBtn.type = 'button';
      cancelDelBtn.className = 'btn btn-sm';
      cancelDelBtn.textContent = 'Cancel';
      cancelDelBtn.onclick = () => {
        state.confirmDeleteId = null;
        rerender();
      };
      actions.append(confirmBtn, cancelDelBtn);
    } else {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-danger btn-sm';
      delBtn.textContent = 'Delete';
      delBtn.onclick = () => {
        state.confirmDeleteId = card.id;
        rerender();
      };
      actions.appendChild(delBtn);
    }

    item.appendChild(actions);
    listCard.appendChild(item);
  }

  container.appendChild(listCard);

  if (filtered.length > state.visibleLimit) {
    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'btn';
    moreBtn.style.width = '100%';
    moreBtn.textContent = `Load more (${filtered.length - state.visibleLimit} remaining)`;
    moreBtn.onclick = () => {
      state.visibleLimit += 50;
      rerender();
    };
    container.appendChild(moreBtn);
  }
}
