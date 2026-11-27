import test from 'node:test';
import assert from 'node:assert/strict';
import { conjugateRegularVerb } from '../js/morphology.js';

test('conjugateRegularVerb: machen', () => {
  const res = conjugateRegularVerb('machen');
  assert.equal(res.praesens.ich, 'mache');
  assert.equal(res.praesens.du, 'machst');
  assert.equal(res.praesens.er, 'macht');
  assert.equal(res.praeteritum, 'machte');
  assert.equal(res.partizip2, 'gemacht');
  assert.equal(res.confidence, 'guess');
});

test('conjugateRegularVerb: arbeiten (stem ends in -t)', () => {
  const res = conjugateRegularVerb('arbeiten');
  assert.equal(res.praesens.du, 'arbeitest');
  assert.equal(res.praesens.er, 'arbeitet');
  assert.equal(res.praeteritum, 'arbeitete');
  assert.equal(res.partizip2, 'gearbeitet');
});

test('conjugateRegularVerb: lernen', () => {
  const res = conjugateRegularVerb('lernen');
  assert.equal(res.praesens.du, 'lernst');
  assert.equal(res.praesens.er, 'lernt');
  assert.equal(res.partizip2, 'gelernt');
});

test('conjugateRegularVerb: öffnen (stem ends in consonant+n)', () => {
  const res = conjugateRegularVerb('öffnen');
  assert.equal(res.praesens.du, 'öffnest');
  assert.equal(res.praesens.er, 'öffnet');
  assert.equal(res.praeteritum, 'öffnete');
  assert.equal(res.partizip2, 'geöffnet');
});

test('conjugateRegularVerb: besuchen (inseparable prefix)', () => {
  const res = conjugateRegularVerb('besuchen');
  assert.equal(res.partizip2, 'besucht');
  assert.equal(res.separable, false);
});

test('conjugateRegularVerb: einkaufen (separable prefix)', () => {
  const res = conjugateRegularVerb('einkaufen');
  assert.equal(res.separable, true);
  assert.equal(res.prefix, 'ein');
  assert.equal(res.praesens.ich, 'kaufe ein');
  assert.equal(res.partizip2, 'eingekauft');
});

test('conjugateRegularVerb: irregular verb returns null', () => {
  assert.equal(conjugateRegularVerb('gehen'), null);
  assert.equal(conjugateRegularVerb('sein'), null);
});
