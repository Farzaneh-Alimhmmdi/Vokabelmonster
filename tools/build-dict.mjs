#!/usr/bin/env node
/**
 * Build /data/de-dict.json from a kaikki.org German JSONL extract.
 * Usage:
 *   node tools/build-dict.mjs path/to/kaikki.org-dictionary-German.jsonl [limit=20000]
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const inputPath = process.argv[2];
const limit = Number(process.argv[3] || 20000);

if (!inputPath || !fs.existsSync(inputPath)) {
  console.error('Usage: node tools/build-dict.mjs <kaikki-german.jsonl> [limit=20000]');
  process.exit(1);
}

const outDir = path.resolve('data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'de-dict.json');

const dict = {};
let count = 0;

const rl = readline.createInterface({
  input: fs.createReadStream(inputPath, { encoding: 'utf8' }),
  crlfDelay: Infinity,
});

for await (const line of rl) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }

  const lemma = entry.word;
  if (!lemma || lemma.includes(' ')) continue;
  const key = lemma.toLowerCase();
  if (dict[key]) continue;

  const pos = entry.pos || 'other';
  const gloss = entry.senses?.[0]?.glosses?.[0] || '';
  const examples = (entry.senses?.[0]?.examples || [])
    .slice(0, 2)
    .map((ex) => ({ de: ex.text }))
    .filter((ex) => ex.de);

  const forms = entry.forms || [];
  const findForm = (tag) => forms.find((f) => (f.tags || []).includes(tag))?.form || '';

  let article = null;
  if (pos === 'noun') {
    const tags = entry.head_templates?.[0]?.args || {};
    const g = tags['1'] || '';
    if (g.includes('m')) article = 'der';
    else if (g.includes('f')) article = 'die';
    else if (g.includes('n')) article = 'das';
  }

  dict[key] = {
    lemma,
    pos,
    article,
    plural: pos === 'noun' ? findForm('plural') : '',
    genitive: pos === 'noun' ? findForm('genitive') : '',
    meaningEn: gloss,
    examples,
  };

  count++;
  if (count >= limit) break;
}

fs.writeFileSync(outPath, JSON.stringify(dict));
console.log(`Wrote ${count} entries to ${outPath}`);
