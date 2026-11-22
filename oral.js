// Expression orale : on compare ce que Whisper a entendu avec ce que tu devais dire.
// Whisper écrit des caractères ; on les retransforme en pinyin pour juger le SON et les TONS
// (un homophone écrit autrement, comme 他/她, compte donc comme juste).
import { WORDS } from './data.js';
import { SENTENCES } from './sentences.js';
import { syllables, parseSyl } from './pinyin.js';

// caractère -> pinyin, appris depuis le vocabulaire et les phrases
const CHAR = {};
for (const w of WORDS) {
  const ps = syllables(w.p), cs = [...w.h];
  if (ps.length === cs.length) cs.forEach((c, i) => { CHAR[c] ||= ps[i].toLowerCase(); });
}
for (const s of SENTENCES) for (const t of s.toks) {
  if (t.punct) continue;
  const ps = t.p.split(' '), cs = [...t.h];
  if (ps.length === cs.length) cs.forEach((c, i) => { CHAR[c] ||= ps[i].toLowerCase(); });
}
// quelques caractères fréquents que Whisper peut écrire
Object.assign(CHAR, { 嗯: 'ēn', 啊: 'a', 呀: 'ya', 哦: 'ò', 您: CHAR['您'] || 'nín', 妳: 'nǐ', 祢: 'nǐ', 牠: 'tā', 們: 'men', 這: 'zhè', 說: 'shuō', 謝: 'xiè', 個: 'gè', 嗎: 'ma', 麼: 'me', 國: 'guó', 學: 'xué', 對: 'duì', 沒: 'méi', 關: 'guān', 係: 'xi', 見: 'jiàn', 點: 'diǎn', 兒: 'r', 錢: 'qián', 買: 'mǎi', 賣: 'mài', 喝: 'hē', 吃: 'chī', 塊: 'kuài', 漢: 'hàn', 語: 'yǔ', 歲: 'suì', 幾: 'jǐ', 時: 'shí', 會: 'huì', 來: 'lái', 開: 'kāi', 車: 'chē', 電: 'diàn', 視: 'shì', 腦: 'nǎo', 飯: 'fàn', 館: 'guǎn', 書: 'shū', 東: 'dōng', 業: 'yè', 葉: 'yè' });

const baseOf = (p) => (p ? parseSyl(p).base : null);
const toneOf = (p) => (p ? parseSyl(p).tone : null);
const FLEX = new Set(['一', '不']); // ton variable selon le mot suivant

// Syllabes attendues : [{ c, p }]
export function targetOfWord(w) {
  const ps = syllables(w.p), cs = [...w.h];
  return cs.map((c, i) => ({ c, p: (ps[i] || '').toLowerCase() }));
}
export function targetOfSentence(sn) {
  const out = [];
  for (const t of sn.toks) {
    if (t.punct) continue;
    const ps = t.p.split(' '), cs = [...t.h];
    if (ps.length === cs.length) cs.forEach((c, i) => out.push({ c, p: ps[i].toLowerCase(), tok: t }));
    else {
      // 一点儿 (yì diǎnr) : le 儿 n'a pas sa propre syllabe
      cs.forEach((c, i) => out.push({ c, p: (ps[Math.min(i, ps.length - 1)] || '').toLowerCase(), tok: t, er: i >= ps.length }));
    }
  }
  return out.filter(x => !x.er);
}

export const cleanHeard = (text) => [...(text || '').replace(/[^㐀-鿿]/g, '')];

// Alignement (plus longue sous-suite commune) entre l'attendu et l'entendu.
// Renvoie pour chaque syllabe attendue : got (caractère entendu), sound (même son), tone (même ton)
export function compare(target, heardText) {
  const H = cleanHeard(heardText).map(c => ({ c, p: CHAR[c] || null }));
  const n = target.length, m = H.length;
  const same = (a, b) => a.c === b.c || (b.p && baseOf(a.p) === baseOf(b.p));
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
    dp[i][j] = same(target[i], H[j]) ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const marks = target.map(() => ({ got: null, sound: false, tone: false, exact: false }));
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (same(target[i], H[j]) && dp[i][j] === 1 + dp[i + 1][j + 1]) {
      const exact = target[i].c === H[j].c;
      const tone = exact || FLEX.has(target[i].c) || toneOf(target[i].p) === toneOf(H[j].p)
        || (toneOf(target[i].p) === 5 || toneOf(H[j].p) === 5); // ton neutre : on ne pénalise pas
      marks[i] = { got: H[j].c, sound: true, tone, exact };
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const sound = marks.filter(x => x.sound).length / Math.max(1, n);
  const tones = marks.filter(x => x.sound && x.tone).length / Math.max(1, n);
  const exact = cleanHeard(heardText).join('').includes(target.map(t => t.c).join(''));
  return { marks, sound, tones, exact, heard: cleanHeard(heardText).join(''), extra: Math.max(0, m - n) };
}

// Verdict pour un mot ou une phrase.
// ok : réussi ; grade FSRS ; msg : explication en français
export function verdict(cmp, { isSentence, hint, pitchOk } = {}) {
  if (cmp.exact) return { ok: true, grade: hint ? 2 : 3, msg: 'Parfait, Whisper a compris exactement.' };
  if (isSentence) {
    if (cmp.tones >= 0.85) return { ok: true, grade: hint ? 2 : (cmp.tones >= 0.95 ? 3 : 2), msg: `Compris à ${Math.round(cmp.tones * 100)} %.` };
    if (cmp.sound >= 0.85) return { ok: false, grade: 1, msg: 'Les sons sont bons, mais certains tons ne le sont pas.' };
    return { ok: false, grade: 1, msg: `Compris à ${Math.round(cmp.tones * 100)} % seulement. Réécoute et réessaie.` };
  }
  if (cmp.sound === 1 && cmp.tones === 1) return { ok: true, grade: hint ? 2 : 3, msg: 'Bien prononcé (Whisper a écrit un homophone).' };
  if (cmp.sound === 1) {
    // les sons sont justes : l'analyse des tons de ta voix tranche
    if (pitchOk) return { ok: true, grade: 2, msg: 'Sons justes, et ta courbe de tons est bonne.' };
    return { ok: false, grade: 1, msg: 'Les sons sont bons, mais le ton n\'est pas le bon.' };
  }
  return { ok: false, grade: 1, msg: cmp.heard ? 'Ce n\'est pas ce que Whisper a entendu.' : 'Whisper n\'a rien compris. Parle plus fort et plus près.' };
}
