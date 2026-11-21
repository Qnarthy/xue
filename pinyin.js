// Outils pinyin : tons, conversion chiffres ⇄ accents, vérification des réponses.
const MARKS = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', v: 'ǖǘǚǜ',
};
const MARKED = {};
for (const [base, s] of Object.entries(MARKS)) [...s].forEach((c, i) => (MARKED[c] = [base, i + 1]));

// "zhōng" -> { base: "zhong", tone: 1 } ; ü est noté v dans base
export function parseSyl(syl) {
  let tone = 5, base = '';
  for (const ch of syl.toLowerCase()) {
    if (MARKED[ch]) { base += MARKED[ch][0]; tone = MARKED[ch][1]; }
    else if (ch === 'ü') base += 'v';
    else base += ch;
  }
  return { base, tone, hasVowel: /[aeiouv]/.test(base) };
}

export const syllables = (p) => p.split(/\s+/).filter(Boolean);
export const tonesOf = (p) => syllables(p).map(s => parseSyl(s).tone);

// Place l'accent au bon endroit : a/e d'abord, puis o dans "ou", sinon la dernière voyelle
export function markSyl(base, tone) {
  base = base.replace(/u:/g, 'v');
  if (!tone || tone === 5 || tone === 0) return base.replace(/v/g, 'ü');
  let idx = base.search(/[ae]/);
  if (idx < 0) idx = base.indexOf('ou');
  if (idx < 0) {
    for (let i = base.length - 1; i >= 0; i--) if ('iouv'.includes(base[i])) { idx = i; break; }
  }
  if (idx < 0) return base.replace(/v/g, 'ü');
  const v = base[idx];
  return (base.slice(0, idx) + MARKS[v][tone - 1] + base.slice(idx + 1)).replace(/v/g, 'ü');
}

// Aperçu en direct : "ni3 hao3" -> "nǐ hǎo"
export function numToMarks(text) {
  return text.toLowerCase().replace(/([a-züv:]+)([0-5])/g, (_, b, t) => markSyl(b, +t)).replace(/v/g, 'ü');
}

// Prononciation réelle de 一 et 不 selon le ton suivant (changement de ton)
const SANDHI = { '一': [1, 2, 4], '不': [2, 4] };

// Vérifie la saisie de l'utilisateur. Renvoie { ok, lettersOk, perSyl: [bool] }
export function checkPinyin(input, word) {
  const syls = syllables(word.p).map(parseSyl);
  const chars = [...word.h];
  const expectedLetters = syls.map(s => s.base).join('');
  // bornes des syllabes en indices de lettres
  const ends = []; let acc = 0;
  for (const s of syls) { acc += s.base.length; ends.push(acc); }
  const sylAt = (letterIdx) => {
    let k = ends.findIndex(e => letterIdx < e);
    if (k < 0) k = syls.length - 1;
    while (k > 0 && !syls[k].hasVowel) k--; // le ton du « r » (儿) revient à la syllabe précédente
    return k;
  };

  const user = input.toLowerCase().replace(/u:/g, 'v').replace(/ü/g, 'v');
  let letters = ''; const userTones = new Array(syls.length).fill(undefined);
  for (const ch of user) {
    if (/[a-z]/.test(ch)) letters += ch;
    else if (MARKED[ch]) { letters += MARKED[ch][0]; const k = sylAt(letters.length - 1); if (k >= 0) userTones[k] = MARKED[ch][1]; }
    else if (/[0-5]/.test(ch) && letters.length) { const k = sylAt(letters.length - 1); if (k >= 0) userTones[k] = +ch; }
  }
  const lettersOk = letters === expectedLetters;
  const perSyl = syls.map((s, i) => {
    if (!s.hasVowel) return true;
    const u = userTones[i] === 0 || userTones[i] === undefined ? 5 : userTones[i];
    return toneAccepted(chars[i], s.tone, u);
  });
  return { ok: lettersOk && perSyl.every(Boolean), lettersOk, perSyl };
}

export function toneAccepted(char, expected, given) {
  if (given === expected) return true;
  if (SANDHI[char] && SANDHI[char].includes(given) && SANDHI[char].includes(expected)) return true;
  return false;
}

// Courbe du ton (échelle 1-5 de Chao) pour les petits dessins SVG
export const TONE_CONTOUR = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 4], 4: [5, 1], 5: [3, 3] };
export const TONE_NAME = { 1: '1er ton — haut et plat', 2: '2e ton — montant', 3: '3e ton — descend puis remonte', 4: '4e ton — descendant', 5: 'ton neutre — court et léger' };

export function toneSvg(tone, size = 28, cls = '') {
  const pts = TONE_CONTOUR[tone];
  const pad = 4, w = size, h = size;
  const xy = pts.map((v, i) => [pad + (i * (w - 2 * pad)) / (pts.length - 1), pad + ((5 - v) * (h - 2 * pad)) / 4]);
  const d = tone === 5
    ? `M${w / 2 - 3},${h / 2} h6`
    : 'M' + xy.map(p => p.join(',')).join(pts.length === 3 ? ' Q' : ' L');
  const path = pts.length === 3
    ? `M${xy[0]} Q${xy[1][0]},${xy[1][1] + 6} ${xy[2]}`
    : d;
  return `<svg class="tone-svg ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`;
}

// Découpe un pinyin collé (« xíngli ») en n syllabes (« xíng li ») ; null si impossible
const INITIALS = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w', ''];
const FINALS = ['iang', 'iong', 'uang', 'ueng', 'ang', 'eng', 'ing', 'ong', 'ian', 'iao', 'uai', 'uan', 'van', 'ai', 'ei', 'ao', 'ou', 'an', 'en', 'er', 'ia', 'ie', 'iu', 'in', 'ua', 'uo', 'ui', 'un', 'vn', 've', 'ue', 'a', 'o', 'e', 'i', 'u', 'v'];
const SYLS = new Set(['r']);
for (const i of INITIALS) for (const f of FINALS) SYLS.add(i + f);
export function splitPinyin(p, n) {
  if (!p) return null;
  const words = p.trim().split(/\s+/).filter(Boolean);
  if (words.length === n && words.every(x => SYLS.has(parseSyl(x).base))) return words.join(' ');
  const s = p.replace(/[\s'’\-.,!?。，！？]/g, '');
  const base = [...s].map(c => { const l = c.toLowerCase(); return MARKED[l]?.[0] ?? (l === 'ü' ? 'v' : l); }).join('');
  const chars = [...s];
  if (base.length !== chars.length) return null;
  const out = [];
  const go = (pos, k) => {
    if (pos === base.length) return k === n;
    if (k >= n) return false;
    for (let len = 6; len >= 1; len--) {
      if (pos + len > base.length || !SYLS.has(base.slice(pos, pos + len))) continue;
      out.push(chars.slice(pos, pos + len).join(''));
      if (go(pos + len, k + 1)) return true;
      out.pop();
    }
    return false;
  };
  return go(0, 0) ? out.join(' ') : null;
}
