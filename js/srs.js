const DAY_MS = 24 * 60 * 60 * 1000;

export const RATING = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4,
};

export function getStudyDayStart(now = Date.now()) {
  const d = new Date(now);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(4, 0, 0, 0);
  return d.getTime();
}

export function schedule(srs, rating, now = Date.now()) {
  const prev = srs || {
    due: now,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReview: null,
  };

  let ease = prev.ease ?? 2.5;
  let reps = prev.reps ?? 0;
  let lapses = prev.lapses ?? 0;
  let interval = prev.interval ?? 0;
  let state = prev.state || 'new';

  if (rating === RATING.AGAIN) {
    reps = 0;
    lapses += 1;
    interval = 0; // re-learn today / tomorrow
    ease = Math.max(1.3, ease - 0.2);
    state = 'learning';
    return {
      due: now + 10 * 60 * 1000, // 10 minutes
      interval,
      ease: Number(ease.toFixed(2)),
      reps,
      lapses,
      state,
      lastReview: now,
    };
  }

  if (reps === 0) {
    if (rating === RATING.HARD) interval = 1;
    else if (rating === RATING.GOOD) interval = 1;
    else if (rating === RATING.EASY) interval = 4;
    reps = 1;
  } else if (reps === 1) {
    if (rating === RATING.HARD) interval = 3;
    else if (rating === RATING.GOOD) interval = 6;
    else if (rating === RATING.EASY) interval = 8;
    reps = 2;
  } else {
    const mult =
      rating === RATING.HARD ? 1.2 : rating === RATING.GOOD ? ease : ease * 1.3;
    interval = Math.max(1, Math.round(interval * mult));
    reps += 1;
  }

  if (rating === RATING.HARD) {
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === RATING.EASY) {
    ease = Math.min(3.0, ease + 0.15);
  }

  state = 'review';

  return {
    due: now + interval * DAY_MS,
    interval,
    ease: Number(ease.toFixed(2)),
    reps,
    lapses,
    state,
    lastReview: now,
  };
}

export function formatInterval(days) {
  if (!days || days <= 0) return '10m';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

export function buildReviewQueue(
  cards,
  todayLogs = [],
  limits = { newPerDay: 10, maxReviewsPerDay: 100 },
  now = Date.now()
) {
  const newLimit = limits.newPerDay ?? 10;
  const maxReviews = limits.maxReviewsPerDay ?? 100;

  const reviewedTodayCount = todayLogs.length;
  const remainingTotal = Math.max(0, maxReviews - reviewedTodayCount);
  if (remainingTotal === 0) return [];

  const newCardsSeenToday = new Set(
    todayLogs.filter((l) => l.prevInterval === 0).map((l) => l.cardId)
  ).size;
  const remainingNew = Math.max(0, newLimit - newCardsSeenToday);

  const dueCards = cards
    .filter((c) => c.srs && c.srs.state !== 'new' && (c.srs.due ?? 0) <= now)
    .sort((a, b) => (a.srs.due ?? 0) - (b.srs.due ?? 0));

  const newCards = cards
    .filter((c) => !c.srs || c.srs.state === 'new')
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .slice(0, remainingNew);

  return [...dueCards, ...newCards].slice(0, remainingTotal);
}
