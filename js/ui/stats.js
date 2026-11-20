import { getAllCards, getReviewLogsSince, getSetting } from '../db.js';
import { getStudyDayStart } from '../srs.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function computeStreak(logs, now = Date.now()) {
  if (!logs.length) return 0;
  const dayStarts = new Set(logs.map((l) => getStudyDayStart(l.ts)));
  let cursor = getStudyDayStart(now);
  if (!dayStarts.has(cursor)) {
    cursor -= DAY_MS;
    if (!dayStarts.has(cursor)) return 0;
  }
  let streak = 0;
  while (dayStarts.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function getLast7DaysCounts(logs, now = Date.now()) {
  const todayStart = getStudyDayStart(now);
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const start = todayStart - i * DAY_MS;
    const end = start + DAY_MS;
    const count = logs.filter((l) => l.ts >= start && l.ts < end).length;
    const d = new Date(start);
    const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
    buckets.push({ label, count });
  }
  return buckets;
}

function createProgressRing(done, goal) {
  const pct = goal > 0 ? Math.min(1, done / goal) : 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '92');
  svg.setAttribute('height', '92');
  svg.setAttribute('viewBox', '0 0 92 92');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', '46');
  bg.setAttribute('cy', '46');
  bg.setAttribute('r', String(r));
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'var(--border)');
  bg.setAttribute('stroke-width', '8');

  const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fg.setAttribute('cx', '46');
  fg.setAttribute('cy', '46');
  fg.setAttribute('r', String(r));
  fg.setAttribute('fill', 'none');
  fg.setAttribute('stroke', 'var(--accent)');
  fg.setAttribute('stroke-width', '8');
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', String(c));
  fg.setAttribute('stroke-dashoffset', String(offset));
  fg.setAttribute('transform', 'rotate(-90 46 46)');

  const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  txt.setAttribute('x', '46');
  txt.setAttribute('y', '51');
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', 'var(--text)');
  txt.setAttribute('font-size', '16');
  txt.setAttribute('font-weight', '700');
  txt.textContent = `${done}`;

  svg.append(bg, fg, txt);
  return svg;
}

function createBarChart(buckets) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '110');
  svg.setAttribute('viewBox', '0 0 280 110');

  buckets.forEach((b, idx) => {
    const x = idx * 40 + 10;
    const barH = Math.round((b.count / max) * 65);
    const y = 80 - barH;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', '22');
    rect.setAttribute('height', String(Math.max(2, barH)));
    rect.setAttribute('rx', '4');
    rect.setAttribute('fill', b.count > 0 ? 'var(--accent)' : 'var(--border)');

    const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    lbl.setAttribute('x', String(x + 11));
    lbl.setAttribute('y', '100');
    lbl.setAttribute('text-anchor', 'middle');
    lbl.setAttribute('fill', 'var(--text-muted)');
    lbl.setAttribute('font-size', '11');
    lbl.textContent = b.label;

    svg.append(rect, lbl);
  });

  return svg;
}

export async function renderStats(container) {
  container.innerHTML = '';

  let cards = [];
  let logs = [];
  let dailyGoal = 20;
  try {
    [cards, logs, dailyGoal] = await Promise.all([
      getAllCards(),
      getReviewLogsSince(0),
      getSetting('dailyGoal', 20),
    ]);
  } catch (err) {
    const errCard = document.createElement('section');
    errCard.className = 'card';
    const b = document.createElement('div');
    b.className = 'banner banner-error';
    b.textContent = `Failed to load stats: ${err.message}`;
    errCard.appendChild(b);
    container.appendChild(errCard);
    return;
  }

  const todayStart = getStudyDayStart();
  const todayCount = logs.filter((l) => l.ts >= todayStart).length;
  const streak = computeStreak(logs);

  // Summary + Progress Ring
  const summaryCard = document.createElement('section');
  summaryCard.className = 'card';
  const sumRow = document.createElement('div');
  sumRow.className = 'row-between';

  const left = document.createElement('div');
  const h2 = document.createElement('h2');
  h2.textContent = 'Today & Streak';
  const streakP = document.createElement('p');
  streakP.className = 'muted';
  streakP.textContent = `🔥 Streak: ${streak} day(s)`;
  const totalP = document.createElement('p');
  totalP.className = 'muted';
  totalP.textContent = `Total reviews: ${logs.length}`;
  left.append(h2, streakP, totalP);

  sumRow.append(left, createProgressRing(todayCount, dailyGoal));
  summaryCard.appendChild(sumRow);
  container.appendChild(summaryCard);

  // Counts by state
  const counts = { new: 0, learning: 0, review: 0 };
  for (const c of cards) {
    const st = c.srs?.state || 'new';
    counts[st] = (counts[st] || 0) + 1;
  }

  const stateCard = document.createElement('section');
  stateCard.className = 'card';
  const stateTitle = document.createElement('h2');
  stateTitle.textContent = `Cards (${cards.length})`;
  stateCard.appendChild(stateTitle);

  for (const [label, val] of [
    ['New', counts.new],
    ['Learning', counts.learning],
    ['Review', counts.review],
  ]) {
    const row = document.createElement('div');
    row.className = 'kv-row';
    const k = document.createElement('span');
    k.textContent = label;
    const v = document.createElement('span');
    v.className = 'badge';
    v.textContent = String(val);
    row.append(k, v);
    stateCard.appendChild(row);
  }
  container.appendChild(stateCard);

  // 7-day chart
  const chartCard = document.createElement('section');
  chartCard.className = 'card';
  const chartTitle = document.createElement('h2');
  chartTitle.textContent = 'Last 7 Days';
  chartCard.append(chartTitle, createBarChart(getLast7DaysCounts(logs)));
  container.appendChild(chartCard);

  // Difficult words (lapses >= 3)
  const difficult = cards.filter((c) => (c.srs?.lapses || 0) >= 3);
  const diffCard = document.createElement('section');
  diffCard.className = 'card';
  const diffTitle = document.createElement('h2');
  diffTitle.textContent = `Difficult Words (${difficult.length})`;
  diffCard.appendChild(diffTitle);

  if (difficult.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No difficult words yet (lapses ≥ 3).';
    diffCard.appendChild(p);
  } else {
    for (const c of difficult.slice(0, 10)) {
      const row = document.createElement('div');
      row.className = 'kv-row';
      const k = document.createElement('span');
      k.textContent = c.article ? `${c.article} ${c.lemma}` : c.lemma;
      const v = document.createElement('span');
      v.className = 'badge';
      v.textContent = `${c.srs.lapses} lapses`;
      row.append(k, v);
      diffCard.appendChild(row);
    }
  }
  container.appendChild(diffCard);
}
