import test from 'node:test';
import assert from 'node:assert/strict';
import { cardsToCsv, parseCsvToCards } from '../js/csv.js';

test('cardsToCsv and parseCsvToCards round-trip', () => {
  const input = [
    {
      lemma: 'Haus',
      article: 'das',
      pos: 'noun',
      plural: 'Häuser',
      meaningFa: 'خانه',
      meaningEn: 'house',
      level: 'A1',
      tags: ['A1', 'Wohnung'],
      notes: 'Note, with comma',
    },
  ];
  const csv = cardsToCsv(input);
  const parsed = parseCsvToCards(csv);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].lemma, 'Haus');
  assert.equal(parsed[0].article, 'das');
  assert.deepEqual(parsed[0].tags, ['A1', 'Wohnung']);
  assert.equal(parsed[0].notes, 'Note, with comma');
});
