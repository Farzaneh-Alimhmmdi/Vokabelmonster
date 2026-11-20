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

let reviewState = {
  queue: [],
  flipped: false,
  reviewedCount: 0,
  lastAction: null, // { card, prevSrs, logId }
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
    reviewState.queue = buildReviewQueue(cards, todayLogs, {
      newPerDay,
      maxReviewsPerDay,
    });
    reviewState.flipped = false;
    reviewState.loaded = true;
    reviewState.error = null;
  } catch (err) {
    reviewState.error = err.message || 'Failed to load review queue.';
    reviewState.loaded = true;
  }
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

  // Top bar: remaining count + Undo + Refresh
  const topBar = document.createElement('div');
  topBar.className = 'row-between';
  topBar.style.marginBottom = '12px';

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

  const flashcard = document.createElement('section');
  flashcard.className = 'card';
  flashcard.style.textAlign = 'center';
  flashcard.style.padding = '24px 16px';

  const meta = document.createElement('div');
  meta.className = 'muted';
  meta.textContent = [card.pos, card.level].filter(Boolean).join(' · ');
  flashcard.appendChild(meta);

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

  // Back of card
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

  // 4 Rating buttons
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

    btn.onclick = async () => {
      const prevSrs = card.srs;
      const newSrs = schedule(prevSrs, b.rating, Date.now());
      try {
        await updateCard(card.id, { srs: newSrs });
        const logId = await addReviewLog({
          cardId: card.id,
          ts: Date.now(),
          rating: b.rating,
          prevInterval: prevSrs?.interval ?? 0,
          newInterval: newSrs.interval,
        });
        reviewState.queue.shift();
        reviewState.reviewedCount += 1;
        reviewState.lastAction = { card, prevSrs, logId };
        reviewState.flipped = false;
        rerender();
      } catch (err) {
        reviewState.error = `Failed to save review: ${err.message}`;
        rerender();
      }
    };

    ratingsGrid.appendChild(btn);
  }

  container.appendChild(ratingsGrid);
}
