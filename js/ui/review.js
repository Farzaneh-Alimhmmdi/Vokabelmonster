import {
  getAllCards,
  updateCard,
  addReviewLog,
  deleteReviewLog,
  getReviewLogsSince,
  getSetting,
} from '../db.js';
import {
  RATING,
  schedule,
  formatInterval,
  getStudyDayStart,
  buildReviewQueue,
} from '../srs.js';
import { speakGerman } from '../tts.js';

let reviewState = {
  allCards: [],
  queue: [],
  mode: 'flashcard', // 'flashcard' | 'type' | 'mc' | 'cloze' | 'article'
  flipped: false,
  feedback: null, // { correct: boolean, message: string }
  reviewedCount: 0,
  lastAction: null,
  loaded: false,
  error: null,
};

async function loadQueue() {
  try {
    const [cards, todayLogs, newPerDay, maxReviewsPerDay] = await Promise.all([
      getAllCards(),
      getReviewLogsSince(getStudyDayStart()),
      getSetting('newPerDay', 10),
      getSetting('maxReviewsPerDay', 100),
    ]);
    reviewState.allCards = cards;
    reviewState.queue = buildReviewQueue(cards, todayLogs, {
      newPerDay,
      maxReviewsPerDay,
    });
    reviewState.flipped = false;
    reviewState.feedback = null;
    reviewState.loaded = true;
    reviewState.error = null;
  } catch (err) {
    reviewState.error = err.message || 'Failed to load review queue.';
    reviewState.loaded = true;
  }
}

async function applyRating(card, rating, rerender) {
  const prevSrs = card.srs;
  const newSrs = schedule(prevSrs, rating, Date.now());
  try {
    await updateCard(card.id, { srs: newSrs });
    const logId = await addReviewLog({
      cardId: card.id,
      ts: Date.now(),
      rating,
      prevInterval: prevSrs?.interval ?? 0,
      newInterval: newSrs.interval,
    });
    reviewState.queue.shift();
    reviewState.reviewedCount += 1;
    reviewState.lastAction = { card, prevSrs, logId };
    reviewState.flipped = false;
    reviewState.feedback = null;
    rerender();
  } catch (err) {
    reviewState.error = `Failed to save review: ${err.message}`;
    rerender();
  }
}

function getDistractors(card, allCards, count = 3) {
  const pool = allCards.filter(
    (c) => c.id !== card.id && (c.meaningFa || c.meaningEn)
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export async function renderReview(container) {
  if (!reviewState.loaded) {
    await loadQueue();
  }

  container.innerHTML = '';
  const rerender = () => renderReview(container);

  if (reviewState.error) {
    const errCard = document.createElement('section');
    errCard.className = 'card';
    const b = document.createElement('div');
    b.className = 'banner banner-error';
    b.textContent = reviewState.error;
    errCard.appendChild(b);
    container.appendChild(errCard);
    return;
  }

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'row-between';
  topBar.style.marginBottom = '10px';

  const countBadge = document.createElement('span');
  countBadge.className = 'badge';
  countBadge.textContent = `Remaining: ${reviewState.queue.length} · Done: ${reviewState.reviewedCount}`;

  const btnGroup = document.createElement('div');
  btnGroup.style.display = 'flex';
  btnGroup.style.gap = '8px';

  if (reviewState.lastAction) {
    const undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'btn btn-sm';
    undoBtn.textContent = 'Undo';
    undoBtn.onclick = async () => {
      const { card, prevSrs, logId } = reviewState.lastAction;
      try {
        const restored = await updateCard(card.id, { srs: prevSrs });
        if (logId) await deleteReviewLog(logId);
        reviewState.queue.unshift(restored);
        reviewState.reviewedCount = Math.max(0, reviewState.reviewedCount - 1);
        reviewState.lastAction = null;
        reviewState.flipped = false;
        reviewState.feedback = null;
        rerender();
      } catch (err) {
        reviewState.error = `Undo failed: ${err.message}`;
        rerender();
      }
    };
    btnGroup.appendChild(undoBtn);
  }

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'btn btn-sm';
  refreshBtn.textContent = 'Refresh';
  refreshBtn.onclick = async () => {
    reviewState.loaded = false;
    await loadQueue();
    rerender();
  };
  btnGroup.appendChild(refreshBtn);

  topBar.append(countBadge, btnGroup);
  container.appendChild(topBar);

  // Monster mascot status
  const isHungry = reviewState.queue.length > 0;
  const monsterBar = document.createElement('div');
  monsterBar.className = 'card';
  monsterBar.style.display = 'flex';
  monsterBar.style.alignItems = 'center';
  monsterBar.style.gap = '12px';
  monsterBar.style.padding = '10px 14px';

  const monsterEmoji = document.createElement('span');
  monsterEmoji.style.fontSize = '28px';
  monsterEmoji.textContent = isHungry ? '👾' : '🥳';

  const monsterText = document.createElement('div');
  const deMsg = document.createElement('div');
  deMsg.style.fontWeight = '600';
  deMsg.style.fontSize = '14px';
  deMsg.textContent = isHungry
    ? 'Ich habe Hunger! Gib mir Wörter!'
    : 'Super gemacht! Ich bin satt!';

  const faMsg = document.createElement('div');
  faMsg.className = 'muted';
  faMsg.dir = 'rtl';
  faMsg.style.fontSize = '13px';
  faMsg.textContent = isHungry
    ? 'گرسنه‌ام! بهم کلمه بده!'
    : 'آفرین! امروز سیر شدم!';

  monsterText.append(deMsg, faMsg);
  monsterBar.append(monsterEmoji, monsterText);
  container.appendChild(monsterBar);

  // Mode selector
  const modesRow = document.createElement('div');
  modesRow.className = 'chips-row';
  modesRow.style.marginBottom = '12px';
  for (const m of [
    { id: 'flashcard', label: 'Flashcard' },
    { id: 'type', label: 'Type' },
    { id: 'mc', label: 'Multiple Choice' },
    { id: 'cloze', label: 'Cloze' },
    { id: 'article', label: 'Article' },
  ]) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `chip ${reviewState.mode === m.id ? 'active' : ''}`;
    chip.textContent = m.label;
    chip.onclick = () => {
      reviewState.mode = m.id;
      reviewState.flipped = false;
      reviewState.feedback = null;
      rerender();
    };
    modesRow.appendChild(chip);
  }
  container.appendChild(modesRow);

  if (reviewState.queue.length === 0) {
    const doneCard = document.createElement('section');
    doneCard.className = 'card empty-state';
    const h2 = document.createElement('h2');
    h2.textContent = 'All caught up!';
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent =
      reviewState.reviewedCount > 0
        ? `Great job! You reviewed ${reviewState.reviewedCount} card(s) in this session.`
        : 'No cards due right now. Add more words or come back later!';
    doneCard.append(h2, p);
    container.appendChild(doneCard);
    return;
  }

  const card = reviewState.queue[0];

  // Determine effective mode (fallback if card lacks required data)
  let effectiveMode = reviewState.mode;
  if (effectiveMode === 'article' && !card.article) {
    effectiveMode = 'flashcard';
  }
  if (
    effectiveMode === 'cloze' &&
    !(card.examples?.[0]?.de && card.examples[0].de.toLowerCase().includes(card.lemma.toLowerCase()))
  ) {
    effectiveMode = 'type';
  }
  if (effectiveMode === 'mc' && reviewState.allCards.length < 2) {
    effectiveMode = 'flashcard';
  }

  const flashcard = document.createElement('section');
  flashcard.className = 'card';
  flashcard.style.textAlign = 'center';
  flashcard.style.padding = '22px 16px';

  const topCardRow = document.createElement('div');
  topCardRow.className = 'row-between';
  const meta = document.createElement('span');
  meta.className = 'muted';
  meta.textContent = [card.pos, card.level].filter(Boolean).join(' · ');

  const speakBtn = document.createElement('button');
  speakBtn.type = 'button';
  speakBtn.className = 'btn btn-sm';
  speakBtn.setAttribute('aria-label', 'Pronounce word');
  speakBtn.textContent = '🔊';
  speakBtn.onclick = () =>
    speakGerman(card.article ? `${card.article} ${card.lemma}` : card.lemma);

  topCardRow.append(meta, speakBtn);
  flashcard.appendChild(topCardRow);

  if (effectiveMode === 'type' || effectiveMode === 'cloze') {
    const promptEl = document.createElement('div');
    promptEl.style.margin = '16px 0';
    if (effectiveMode === 'cloze') {
      const ex = card.examples[0].de;
      const masked = ex.replace(new RegExp(card.lemma, 'i'), '______');
      promptEl.style.fontSize = '18px';
      promptEl.textContent = masked;
    } else {
      promptEl.dir = card.meaningFa ? 'rtl' : 'ltr';
      promptEl.style.fontSize = '20px';
      promptEl.style.fontWeight = '600';
      promptEl.textContent = card.meaningFa || card.meaningEn || '(No meaning)';
    }
    flashcard.appendChild(promptEl);

    if (reviewState.feedback) {
      const fb = document.createElement('div');
      fb.className = `banner ${reviewState.feedback.correct ? 'banner-success' : 'banner-error'}`;
      fb.textContent = reviewState.feedback.message;
      flashcard.appendChild(fb);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn btn-primary';
      nextBtn.style.width = '100%';
      nextBtn.textContent = 'Continue';
      nextBtn.onclick = () =>
        applyRating(
          card,
          reviewState.feedback.correct ? RATING.GOOD : RATING.AGAIN,
          rerender
        );
      flashcard.appendChild(nextBtn);
    } else {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.className = 'input';
      input.placeholder = 'Type the German word...';
      input.autocomplete = 'off';
      input.autocapitalize = 'none';

      const checkBtn = document.createElement('button');
      checkBtn.type = 'submit';
      checkBtn.className = 'btn btn-primary';
      checkBtn.style.width = '100%';
      checkBtn.style.marginTop = '10px';
      checkBtn.textContent = 'Check';

      form.onsubmit = (e) => {
        e.preventDefault();
        const ans = input.value.trim().toLowerCase();
        const target = card.lemma.trim().toLowerCase();
        const ok = ans === target;
        reviewState.feedback = {
          correct: ok,
          message: ok ? `Correct! (${card.lemma})` : `Wrong — answer: ${card.lemma}`,
        };
        rerender();
      };
      form.append(input, checkBtn);
      flashcard.appendChild(form);
    }

    container.appendChild(flashcard);
    return;
  }

  if (effectiveMode === 'article') {
    const lemmaEl = document.createElement('div');
    lemmaEl.style.fontSize = '28px';
    lemmaEl.style.fontWeight = '700';
    lemmaEl.style.margin = '16px 0';
    lemmaEl.textContent = card.lemma;
    flashcard.appendChild(lemmaEl);

    if (reviewState.feedback) {
      const fb = document.createElement('div');
      fb.className = `banner ${reviewState.feedback.correct ? 'banner-success' : 'banner-error'}`;
      fb.textContent = reviewState.feedback.message;
      flashcard.appendChild(fb);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn btn-primary';
      nextBtn.style.width = '100%';
      nextBtn.textContent = 'Continue';
      nextBtn.onclick = () =>
        applyRating(
          card,
          reviewState.feedback.correct ? RATING.GOOD : RATING.AGAIN,
          rerender
        );
      flashcard.appendChild(nextBtn);
    } else {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = 'repeat(3, 1fr)';
      row.style.gap = '10px';
      for (const art of ['der', 'die', 'das']) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn article-${art}`;
        b.textContent = art;
        b.onclick = () => {
          const ok = art === card.article;
          reviewState.feedback = {
            correct: ok,
            message: ok
              ? `Correct! ${card.article} ${card.lemma}`
              : `Wrong — it is ${card.article} ${card.lemma}`,
          };
          rerender();
        };
        row.appendChild(b);
      }
      flashcard.appendChild(row);
    }

    container.appendChild(flashcard);
    return;
  }

  if (effectiveMode === 'mc') {
    const lemmaEl = document.createElement('div');
    lemmaEl.style.fontSize = '28px';
    lemmaEl.style.fontWeight = '700';
    lemmaEl.style.margin = '16px 0';
    lemmaEl.textContent = card.article ? `${card.article} ${card.lemma}` : card.lemma;
    flashcard.appendChild(lemmaEl);

    if (reviewState.feedback) {
      const fb = document.createElement('div');
      fb.className = `banner ${reviewState.feedback.correct ? 'banner-success' : 'banner-error'}`;
      fb.textContent = reviewState.feedback.message;
      flashcard.appendChild(fb);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn btn-primary';
      nextBtn.style.width = '100%';
      nextBtn.textContent = 'Continue';
      nextBtn.onclick = () =>
        applyRating(
          card,
          reviewState.feedback.correct ? RATING.GOOD : RATING.AGAIN,
          rerender
        );
      flashcard.appendChild(nextBtn);
    } else {
      const distractors = getDistractors(card, reviewState.allCards, 3);
      const options = [card, ...distractors].sort(() => Math.random() - 0.5);
      const optsWrap = document.createElement('div');
      optsWrap.style.display = 'flex';
      optsWrap.style.flexDirection = 'column';
      optsWrap.style.gap = '8px';

      for (const opt of options) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.dir = opt.meaningFa ? 'rtl' : 'ltr';
        b.textContent = opt.meaningFa || opt.meaningEn || opt.lemma;
        b.onclick = () => {
          const ok = opt.id === card.id;
          const correctText = card.meaningFa || card.meaningEn || card.lemma;
          reviewState.feedback = {
            correct: ok,
            message: ok ? 'Correct!' : `Wrong — meaning: ${correctText}`,
          };
          rerender();
        };
        optsWrap.appendChild(b);
      }
      flashcard.appendChild(optsWrap);
    }

    container.appendChild(flashcard);
    return;
  }

  // Default: Flashcard mode
  const lemmaEl = document.createElement('div');
  lemmaEl.style.fontSize = '28px';
  lemmaEl.style.fontWeight = '700';
  lemmaEl.style.margin = '14px 0';
  if (card.article) {
    const art = document.createElement('span');
    art.className = `article-${card.article}`;
    art.textContent = `${card.article} `;
    lemmaEl.appendChild(art);
  }
  const lem = document.createElement('span');
  lem.textContent = card.lemma;
  lemmaEl.appendChild(lem);
  flashcard.appendChild(lemmaEl);

  if (!reviewState.flipped) {
    const flipBtn = document.createElement('button');
    flipBtn.type = 'button';
    flipBtn.className = 'btn btn-primary';
    flipBtn.style.width = '100%';
    flipBtn.style.marginTop = '12px';
    flipBtn.textContent = 'Show Answer';
    flipBtn.onclick = () => {
      reviewState.flipped = true;
      rerender();
    };
    flashcard.appendChild(flipBtn);
    container.appendChild(flashcard);
    return;
  }

  const divider = document.createElement('hr');
  divider.style.border = 'none';
  divider.style.borderTop = '1px solid var(--border)';
  divider.style.margin = '14px 0';
  flashcard.appendChild(divider);

  if (card.meaningFa) {
    const fa = document.createElement('div');
    fa.dir = 'rtl';
    fa.style.fontSize = '20px';
    fa.style.fontWeight = '600';
    fa.textContent = card.meaningFa;
    flashcard.appendChild(fa);
  }

  if (card.meaningEn) {
    const en = document.createElement('div');
    en.className = 'muted';
    en.style.marginTop = '4px';
    en.textContent = card.meaningEn;
    flashcard.appendChild(en);
  }

  if (card.plural) {
    const pl = document.createElement('div');
    pl.className = 'muted';
    pl.style.marginTop = '6px';
    pl.textContent = `Plural: ${card.plural}`;
    flashcard.appendChild(pl);
  }

  if (card.examples && card.examples.length > 0) {
    const ex = document.createElement('div');
    ex.className = 'muted';
    ex.style.marginTop = '8px';
    ex.textContent = `“${card.examples[0].de}”`;
    flashcard.appendChild(ex);
  }

  if (card.notes) {
    const notes = document.createElement('div');
    notes.className = 'muted';
    notes.style.marginTop = '6px';
    notes.textContent = card.notes;
    flashcard.appendChild(notes);
  }

  container.appendChild(flashcard);

  const ratingsGrid = document.createElement('div');
  ratingsGrid.className = 'grid-2';
  ratingsGrid.style.marginTop = '12px';

  const buttons = [
    { label: 'Again', rating: RATING.AGAIN, cls: 'btn btn-danger' },
    { label: 'Hard', rating: RATING.HARD, cls: 'btn' },
    { label: 'Good', rating: RATING.GOOD, cls: 'btn btn-primary' },
    { label: 'Easy', rating: RATING.EASY, cls: 'btn' },
  ];

  const now = Date.now();
  for (const b of buttons) {
    const preview = schedule(card.srs, b.rating, now);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = b.cls;
    btn.style.flexDirection = 'column';
    btn.style.padding = '8px';
    btn.textContent = `${b.label} (${formatInterval(preview.interval)})`;
    btn.onclick = () => applyRating(card, b.rating, rerender);
    ratingsGrid.appendChild(btn);
  }

  container.appendChild(ratingsGrid);
}
