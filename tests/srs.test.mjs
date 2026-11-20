import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RATING,
  schedule,
  formatInterval,
  getStudyDayStart,
  buildReviewQueue,
} from '../js/srs.js';

test('schedule: new card rated Good sets interval 1d and reps 1', () => {
  const now = 1_700_000_000_000;
  const res = schedule(null, RATING.GOOD, now);
  assert.equal(res.interval, 1);
  assert.equal(res.reps, 1);
  assert.equal(res.state, 'review');
  assert.equal(res.due, now + 24 * 60 * 60 * 1000);
});

test('schedule: second Good sets interval 6d and reps 2', () => {
  const now = 1_700_000_000_000;
  const s1 = schedule(null, RATING.GOOD, now);
  const s2 = schedule(s1, RATING.GOOD, now + 86400000);
  assert.equal(s2.interval, 6);
  assert.equal(s2.reps, 2);
});

test('schedule: Again resets reps to 0, increments lapses, sets learning', () => {
  const now = 1_700_000_000_000;
  const s1 = schedule(null, RATING.GOOD, now);
  const s2 = schedule(s1, RATING.AGAIN, now + 86400000);
  assert.equal(s2.reps, 0);
  assert.equal(s2.lapses, 1);
  assert.equal(s2.interval, 0);
  assert.equal(s2.state, 'learning');
  assert.ok(s2.ease < s1.ease);
});

test('formatInterval formats minutes, days, months', () => {
  assert.equal(formatInterval(0), '10m');
  assert.equal(formatInterval(1), '1d');
  assert.equal(formatInterval(6), '6d');
  assert.equal(formatInterval(60), '2mo');
});

test('getStudyDayStart rolls over at 4:00 AM local time', () => {
  const before4am = new Date(2026, 10, 20, 3, 30, 0).getTime();
  const after4am = new Date(2026, 10, 20, 4, 30, 0).getTime();
  const startBefore = new Date(getStudyDayStart(before4am));
  const startAfter = new Date(getStudyDayStart(after4am));
  assert.equal(startBefore.getDate(), 19);
  assert.equal(startBefore.getHours(), 4);
  assert.equal(startAfter.getDate(), 20);
  assert.equal(startAfter.getHours(), 4);
});

test('buildReviewQueue respects newPerDay and maxReviewsPerDay', () => {
  const now = 1_700_000_000_000;
  const cards = [
    { id: 1, createdAt: 1, srs: { state: 'new', due: now } },
    { id: 2, createdAt: 2, srs: { state: 'new', due: now } },
    { id: 3, createdAt: 3, srs: { state: 'review', due: now - 1000 } },
    { id: 4, createdAt: 4, srs: { state: 'review', due: now + 100000 } },
  ];
  const queue = buildReviewQueue(cards, [], { newPerDay: 1, maxReviewsPerDay: 10 }, now);
  assert.deepEqual(
    queue.map((c) => c.id),
    [3, 1]
  );
});
