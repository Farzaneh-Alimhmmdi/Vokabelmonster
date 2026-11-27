export function levenshtein(a, b) {
  const s = String(a || '').toLowerCase();
  const t = String(b || '').toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function generateVariants(query) {
  const q = String(query || '').trim();
  if (!q) return [];

  const baseForms = new Set([q]);
  baseForms.add(q.charAt(0).toUpperCase() + q.slice(1));
  baseForms.add(q.toLowerCase());

  const pairs = [
    ['ae', 'ä'],
    ['oe', 'ö'],
    ['ue', 'ü'],
    ['ss', 'ß'],
    ['Ae', 'Ä'],
    ['Oe', 'Ö'],
    ['Ue', 'Ü'],
  ];

  const out = new Set();
  for (const form of baseForms) {
    out.add(form);
    for (const [ascii, umlaut] of pairs) {
      if (form.includes(ascii)) out.add(form.replaceAll(ascii, umlaut));
      if (form.includes(umlaut)) out.add(form.replaceAll(umlaut, ascii));
    }
  }
  return Array.from(out);
}

export function rankLocalFuzzy(query, candidates) {
  const q = String(query || '').trim();
  if (!q) return [];
  const maxDist = q.length > 4 ? 2 : 1;

  const scored = [];
  const seen = new Set();
  for (const cand of candidates) {
    const c = String(cand || '').trim();
    if (!c) continue;
    const norm = c.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);

    const d = levenshtein(q, c);
    if (d <= maxDist) {
      scored.push({ word: c, dist: d });
    }
  }

  scored.sort((a, b) => a.dist - b.dist || a.word.localeCompare(b.word));
  return scored.slice(0, 5).map((s) => s.word);
}
