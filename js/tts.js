export function isTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakGerman(text, rate = 0.95) {
  if (!isTtsSupported()) {
    return { ok: false, error: 'Speech synthesis is not supported on this device.' };
  }
  const clean = String(text || '').trim();
  if (!clean) return { ok: false, error: 'Nothing to speak.' };

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'de-DE';
    utter.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const deVoice =
      voices.find((v) => v.lang === 'de-DE') ||
      voices.find((v) => v.lang && v.lang.startsWith('de'));
    if (deVoice) {
      utter.voice = deVoice;
    }

    window.speechSynthesis.speak(utter);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message || 'Speech failed.' };
  }
}
