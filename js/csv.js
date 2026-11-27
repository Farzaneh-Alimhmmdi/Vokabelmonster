function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function cardsToCsv(cards) {
  const header = [
    'lemma',
    'article',
    'pos',
    'plural',
    'meaningFa',
    'meaningEn',
    'level',
    'tags',
    'notes',
  ];
  const rows = [header.join(',')];
  for (const c of cards) {
    rows.push(
      [
        c.lemma,
        c.article || '',
        c.pos || '',
        c.plural || '',
        c.meaningFa || '',
        c.meaningEn || '',
        c.level || '',
        (c.tags || []).join(';'),
        c.notes || '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return rows.join('\n');
}

export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function parseCsvToCards(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name) => headers.indexOf(name.toLowerCase());

  const cards = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const lemma = (cols[idx('lemma')] || '').trim();
    if (!lemma) continue;

    const tagsRaw = cols[idx('tags')] || '';
    const tags = tagsRaw
      ? tagsRaw
          .split(';')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    cards.push({
      lemma,
      article: (cols[idx('article')] || '').trim() || null,
      pos: (cols[idx('pos')] || '').trim() || 'noun',
      plural: (cols[idx('plural')] || '').trim(),
      meaningFa: (cols[idx('meaningfa')] || '').trim(),
      meaningEn: (cols[idx('meaningen')] || '').trim(),
      level: (cols[idx('level')] || '').trim() || null,
      tags,
      notes: (cols[idx('notes')] || '').trim(),
    });
  }
  return cards;
}
