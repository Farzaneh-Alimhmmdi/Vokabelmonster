import test from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, generateVariants, rankLocalFuzzy } from '../js/fuzzy.js';

test('levenshtein handles typos', () => {
  assert.equal(levenshtein('Hause', 'Haus'), 1);
  assert.equal(levenshtein('gehn', 'gehen'), 1);
  assert.equal(levenshtein('schnel', 'schnell'), 1);
  assert.equal(levenshtein('Anmeldnug', 'Anmeldung'), 2);
});

test('generateVariants handles umlauts, ß, and capitalization', () => {
  assert.ok(generateVariants('Maedchen').includes('Mädchen'));
  assert.ok(generateVariants('Strasse').includes('Straße'));
  assert.ok(generateVariants('haus').includes('Haus'));
});

test('rankLocalFuzzy finds closest matches within threshold', () => {
  const dict = ['Haus', 'gehen', 'schnell', 'Anmeldung', 'Mädchen', 'Straße'];
  assert.equal(rankLocalFuzzy('Hause', dict)[0], 'Haus');
  assert.equal(rankLocalFuzzy('gehn', dict)[0], 'gehen');
  assert.equal(rankLocalFuzzy('schnel', dict)[0], 'schnell');
  assert.equal(rankLocalFuzzy('Anmeldnug', dict)[0], 'Anmeldung');
});
