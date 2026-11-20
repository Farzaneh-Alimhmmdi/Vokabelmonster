function extractField(wikitext, fieldName) {
  const re = new RegExp(`\\|\\s*${fieldName}\\s*=\\s*([^\\n|}]*)`, 'i');
  const m = wikitext.match(re);
  if (!m) return '';
  return m[1].replace(/\[\[|\]\]|'''?|{{[^}]*}}/g, '').trim();
}

function mapGenusToArticle(genus) {
  const g = (genus || '').toLowerCase().trim();
  if (g === 'm') return 'der';
  if (g === 'f') return 'die';
  if (g === 'n') return 'das';
  return null;
}

function detectPos(wikitext) {
  const m = wikitext.match(/\{\{Wortart\|([^|}]+)\|Deutsch\}\}/i);
  if (!m) return 'other';
  const raw = m[1].toLowerCase();
  if (raw.includes('substantiv')) return 'noun';
  if (raw.includes('verb')) return 'verb';
  if (raw.includes('adjektiv')) return 'adj';
  if (raw.includes('adverb')) return 'adv';
  return 'other';
}

function extractExamples(wikitext) {
  const sec = wikitext.match(/\{\{Beispiele\}\}([\s\S]*?)(?:\n\{\{|\n==|$)/);
  if (!sec) return [];
  const lines = sec[1]
    .split('\n')
    .map((l) => l.replace(/^:\[\d+\]\s*/, '').replace(/''+|{{[^}]*}}|\[\[|\]\]/g, '').trim())
    .filter((l) => l.length > 3 && !l.startsWith('{{'));
  return lines.slice(0, 2).map((de) => ({ de }));
}

export async function fetchWiktionary(word) {
  const url = `https://de.wiktionary.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&origin=*&titles=${encodeURIComponent(
    word
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiktionary HTTP ${res.status}`);
  const json = await res.json();
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) {
    return null;
  }

  const content =
    page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'] || '';
  if (!content) return null;

  const pos = detectPos(content);
  const genus = extractField(content, 'Genus');
  const article = mapGenusToArticle(genus);
  const plural = extractField(content, 'Nominativ Plural');

  let verbForms = null;
  if (pos === 'verb') {
    const praet = extractField(content, 'Präteritum_ich');
    const part2 = extractField(content, 'Partizip II');
    const hilf = extractField(content, 'Hilfsverb');
    if (praet || part2 || hilf) {
      verbForms = {
        praeteritum: praet || '',
        partizip2: part2 || '',
        hilfsverb: hilf || '',
      };
    }
  }

  return {
    lemma: page.title || word,
    article,
    pos,
    plural,
    examples: extractExamples(content),
    verbForms,
    source: 'de.wiktionary.org',
  };
}

export async function fetchMyMemory(word, targetLang = 'fa') {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    word
  )}&langpair=de|${targetLang}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const json = await res.json();
  const text = json?.responseData?.translatedText || '';
  if (!text || text.toLowerCase() === word.toLowerCase()) return '';
  return text.trim();
}

export async function lookupWord(query) {
  const clean = String(query || '').trim();
  if (!clean) throw new Error('Empty query');

  const [wikiRes, faRes, enRes] = await Promise.allSettled([
    fetchWiktionary(clean),
    fetchMyMemory(clean, 'fa'),
    fetchMyMemory(clean, 'en'),
  ]);

  const wiki = wikiRes.status === 'fulfilled' ? wikiRes.value : null;
  const meaningFa = faRes.status === 'fulfilled' ? faRes.value : '';
  const meaningEn = enRes.status === 'fulfilled' ? enRes.value : '';

  if (!wiki && !meaningFa && !meaningEn) {
    throw new Error('No dictionary results found (or network unavailable).');
  }

  return {
    lemma: wiki?.lemma || clean,
    article: wiki?.article || null,
    pos: wiki?.pos || 'noun',
    plural: wiki?.plural || '',
    meaningFa,
    meaningEn,
    examples: wiki?.examples || [],
    verbForms: wiki?.verbForms || null,
    source: wiki ? 'Wiktionary + MyMemory' : 'MyMemory',
  };
}
