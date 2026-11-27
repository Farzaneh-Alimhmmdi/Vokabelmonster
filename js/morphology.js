const INSEPARABLE_PREFIXES = ['be', 'ge', 'er', 'ver', 'zer', 'ent', 'emp', 'miss'];
const SEPARABLE_PREFIXES = [
  'zurück',
  'auf',
  'aus',
  'ein',
  'mit',
  'nach',
  'vor',
  'weg',
  'her',
  'hin',
  'ab',
  'an',
  'zu',
];

const IRREGULAR_VERBS = new Set([
  'sein', 'haben', 'werden', 'gehen', 'kommen', 'sehen', 'geben', 'nehmen',
  'lesen', 'sprechen', 'fahren', 'schlafen', 'essen', 'trinken', 'finden',
  'wissen', 'können', 'müssen', 'wollen', 'sollen', 'dürfen', 'mögen',
  'tun', 'stehen', 'bleiben', 'schreiben', 'laufen', 'fallen', 'halten',
  'lassen', 'heißen', 'rufen', 'schließen', 'ziehen', 'fliegen', 'liegen',
  'sitzen', 'bringen', 'denken', 'kennen', 'nennen', 'rennen', 'brennen',
  'senden', 'wenden', 'helfen', 'treffen', 'werfen', 'sterben', 'beginnen',
  'gewinnen', 'schwimmen', 'singen', 'springen', 'trinken', 'vergessen',
  'verlieren', 'verstehen', 'bekommen', 'empfangen', 'entscheiden',
]);

function needsE(stem) {
  if (stem.endsWith('t') || stem.endsWith('d')) return true;
  if (/[bcdfghjklmnpqrstvwxyzß][mn]$/.test(stem)) {
    // e.g. öffnen -> öffn, rechnen -> rechn, but NOT lernen -> lern (r+n)
    if (!/[lr][mn]$/.test(stem)) return true;
  }
  return false;
}

export function conjugateRegularVerb(rawLemma) {
  const lemma = String(rawLemma || '').trim().toLowerCase();
  if (!lemma || !lemma.endsWith('en') || lemma.length < 4) return null;
  if (IRREGULAR_VERBS.has(lemma)) return null;

  let separable = false;
  let prefix = '';
  let baseVerb = lemma;

  for (const p of SEPARABLE_PREFIXES) {
    if (lemma.startsWith(p) && lemma.length - p.length >= 4) {
      const rest = lemma.slice(p.length);
      if (IRREGULAR_VERBS.has(rest)) return null;
      separable = true;
      prefix = p;
      baseVerb = rest;
      break;
    }
  }

  const isInseparable =
    !separable && INSEPARABLE_PREFIXES.some((p) => baseVerb.startsWith(p) && baseVerb.length - p.length >= 3);

  const stem = baseVerb.slice(0, -2); // strip -en
  const e = needsE(stem) ? 'e' : '';
  const suffix = separable ? ` ${prefix}` : '';

  const duEnding =
    !e && (stem.endsWith('s') || stem.endsWith('ß') || stem.endsWith('z')) ? 't' : 'st';

  const praesens = {
    ich: `${stem}e${suffix}`,
    du: `${stem}${e}${duEnding}${suffix}`,
    er: `${stem}${e}t${suffix}`,
    wir: `${baseVerb}${suffix}`,
    ihr: `${stem}${e}t${suffix}`,
    sie: `${baseVerb}${suffix}`,
  };

  const praeteritum = `${stem}${e}te${suffix}`;
  const partizipBase = `${stem}${e}t`;
  const partizip2 = separable
    ? `${prefix}ge${partizipBase}`
    : isInseparable
    ? partizipBase
    : `ge${partizipBase}`;

  const imperativ = {
    du: `${stem}${e ? 'e' : ''}${suffix}`,
    ihr: `${stem}${e}t${suffix}`,
    Sie: `${baseVerb}${suffix} Sie`,
  };

  return {
    praesens,
    praeteritum,
    partizip2,
    hilfsverb: 'haben',
    separable,
    prefix: prefix || null,
    imperativ,
    confidence: 'guess',
  };
}
