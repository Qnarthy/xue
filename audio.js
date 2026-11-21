// Prononciation chinoise via la synthèse vocale de l'appareil (voix Apple sur iPhone)
// + petits sons de réussite / erreur.
import { S } from './store.js';

let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter(v => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'zh');
  // voix de meilleure qualité en priorité
  voice = vs.find(v => /premium|enhanced|améliorée/i.test(v.name)) || vs.find(v => /Tingting|Ting-Ting|Lili|Yu-shu|Xiaoxiao/i.test(v.name)) || vs[0] || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function hasVoice() { return 'speechSynthesis' in window; }
export function voiceName() { return voice ? voice.name : 'voix par défaut'; }

export function speak(text, rate) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  if (voice) u.voice = voice;
  u.rate = rate || S.settings.rate;
  speechSynthesis.speak(u);
}

let ctx;
function beep(freqs, dur = 0.12, type = 'sine', vol = 0.08) {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur);
      t += dur * 0.8;
    }
  } catch (e) { /* audio indisponible */ }
}
export const sfx = {
  ok: () => beep([660, 990]),
  ko: () => beep([220, 170], 0.16, 'triangle'),
  done: () => beep([523, 659, 784, 1046], 0.14),
};
