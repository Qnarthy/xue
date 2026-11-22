// Sauvegarde locale (sur le téléphone) + statistiques, XP et série de jours.
import { newCard, review, recallNow } from './fsrs.js';
import { WORDS, WORD_BY_ID } from './data.js';
import { SENTENCES, SENT_BY_ID } from './sentences.js';

const KEY = 'xue-data-v1';
export const FACETS = ['sens', 'ecoute', 'ton', 'parler', 'pinyin', 'trace'];
export const SFACETS = ['ecoute', 'construire', 'parler'];
export const FACET_LABEL = { sens: 'Sens', ecoute: 'Écoute', ton: 'Tons', parler: 'Parler', pinyin: 'Pinyin', trace: 'Écriture' };

const DEFAULTS = {
  cards: {},          // "motId|facette" -> carte FSRS
  intro: {},          // motId -> date d'introduction
  days: {},           // "2026-11-21" -> { xp, secs, rev, ok, nw }
  xp: 0,
  streak: { count: 0, last: '' },
  onboarded: false,
  custom: [],         // mots ajoutés depuis les histoires de l'IA
  stories: [],        // dernières histoires générées
  aiCache: {},        // explications de mots déjà demandées
  missions: {},       // jeux de rôle réussis : id -> nombre de fois
  voice: { base: null },  // hauteur moyenne de la voix (demi-tons), mesurée au calibrage
  toneEar: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],   // [ton attendu][ton choisi] à l'oreille
  toneVoice: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], // [ton attendu][ton entendu] à la voix
  exams: [],          // examens blancs : { lvl, score, date, parts }
  sintro: {},         // phrases vues : id -> date
  scards: {},         // "phraseId|ecoute" ou "phraseId|construire" -> carte FSRS
  reteach: {},        // mots très oubliés réexpliqués : id -> date
  speakPause: 0,      // « je ne peux pas parler maintenant » : jusqu'à quand
  settings: {
    newPerLesson: 5, newPerDay: 20, goalMin: 30, pinyinMode: 'auto',
    rate: 0.8, trace: true, groqKey: '', groqModel: '', chatPinyin: true,
    studyMode: 'oral', toneColors: true, newSentences: 3, speaking: true, smartPace: true, voiceAuto: true,
  },
};

export let S = load();
indexCustom();

// Ajoute les mots perso à la liste globale des mots
function indexCustom() {
  for (const w of S.custom || []) if (!WORD_BY_ID[w.id]) { WORDS.push(w); WORD_BY_ID[w.id] = w; }
}
export function addCustomWord(h, p, f) {
  const id = h + '_' + p.replace(/\s/g, '');
  if (WORD_BY_ID[id]) return WORD_BY_ID[id];
  const w = { id, h, p, f, lvl: 0, ord: 9000 + S.custom.length };
  S.custom.push(w); WORDS.push(w); WORD_BY_ID[id] = w;
  introduce(id);
  save();
  return w;
}

// Ajoute les cartes des compétences arrivées après coup (ex. « Parler ») aux mots et phrases déjà appris,
// étalées sur 2 semaines pour ne pas créer une montagne de révisions d'un coup.
function ensureCards() {
  const now = Date.now(); let added = 0;
  const spread = () => now + Math.floor(Math.random() * 14) * 86400000;
  for (const wid of Object.keys(S.intro)) for (const f of FACETS) {
    if (!S.cards[wid + '|' + f]) { S.cards[wid + '|' + f] = newCard(spread()); added++; }
  }
  for (const sid of Object.keys(S.sintro || {})) for (const f of SFACETS) {
    if (!S.scards[sid + '|' + f]) { S.scards[sid + '|' + f] = newCard(spread()); added++; }
  }
  if (added) save();
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      return { ...structuredClone(DEFAULTS), ...d, settings: { ...DEFAULTS.settings, ...(d.settings || {}) } };
    }
  } catch (e) { /* stockage indisponible */ }
  return structuredClone(DEFAULTS);
}

let saveTimer;
export function save(now = false) {
  clearTimeout(saveTimer);
  const doIt = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('Sauvegarde impossible', e); } };
  if (now) doIt(); else saveTimer = setTimeout(doIt, 300);
}

export const dayKey = (t = Date.now()) => {
  const d = new Date(t - 4 * 3600000); // la journée change à 4h du matin
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const today = () => (S.days[dayKey()] ||= { xp: 0, secs: 0, rev: 0, ok: 0, nw: 0 });

export const cardId = (wid, f) => wid + '|' + f;
export const getCard = (wid, f) => S.cards[cardId(wid, f)];
export const isOral = () => S.settings.studyMode === 'oral';
// Mode oral : le pinyin passe au premier plan, pas d'écriture ni de saisie du pinyin d'après les caractères
export const speakingOn = () => S.settings.speaking && Date.now() > (S.speakPause || 0);
export const activeFacets = () => {
  const base = isOral() ? ['sens', 'ecoute', 'ton', 'parler'] : FACETS.filter(f => f !== 'trace' || S.settings.trace);
  return S.settings.speaking ? base : base.filter(f => f !== 'parler');
};

export function introduce(wid, dueSpread = 0) {
  if (S.intro[wid]) return;
  S.intro[wid] = Date.now();
  for (const f of FACETS) {
    S.cards[cardId(wid, f)] = newCard(Date.now() + (dueSpread ? Math.floor(Math.random() * dueSpread) * 86400000 : 0));
  }
}

export function grade(wid, f, g) {
  const id = cardId(wid, f);
  const c = S.cards[id] || newCard();
  S.cards[id] = review(c, g);
  const t = today();
  t.rev++; if (g > 1) t.ok++;
  save();
}

export function addXp(n) { S.xp += n; today().xp += n; save(); }
export function addTime(secs) { today().secs += Math.min(secs, 120); save(); }

export function touchStreak() {
  const k = dayKey();
  if (S.streak.last === k) return false;
  const y = dayKey(Date.now() - 86400000);
  S.streak.count = S.streak.last === y ? S.streak.count + 1 : 1;
  S.streak.last = k;
  save();
  return true;
}
export function currentStreak() {
  const k = dayKey(), y = dayKey(Date.now() - 86400000);
  return S.streak.last === k || S.streak.last === y ? S.streak.count : 0;
}

export function level(xp = S.xp) {
  // niveau n atteint à 50·n·(n−1) XP
  const n = Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2);
  const base = 50 * n * (n - 1), next = 50 * (n + 1) * n;
  return { n, into: xp - base, need: next - base };
}

export function dueCards(now = Date.now()) {
  const out = [];
  const facets = new Set(activeFacets());
  for (const [id, c] of Object.entries(S.cards)) {
    const [wid, f] = id.split('|');
    if (!facets.has(f) || !WORD_BY_ID[wid]) continue;
    if (c.due <= now) out.push({ wid, f, c, r: recallNow(c, now) });
  }
  // les plus fragiles d'abord (jamais vues puis faible rappel)
  out.sort((a, b) => (a.c.reps === 0) - (b.c.reps === 0) || a.r - b.r);
  return out;
}

// Rythme intelligent : moins de nouveaux mots quand tu oublies beaucoup ou que les révisions s'accumulent,
// plus quand tout est solide.
export function smartPace() {
  const base = S.settings.newPerLesson;
  if (!S.settings.smartPace) return { n: base, why: '' };
  let rev = 0, ok = 0;
  for (let i = 0; i < 3; i++) { const d = S.days[dayKey(Date.now() - i * 86400000)]; if (d) { rev += d.rev; ok += d.ok; } }
  const acc = rev >= 25 ? ok / rev : null;
  const backlog = dueCards().length;
  if (backlog > 150) return { n: 0, why: 'pause', acc, backlog };
  if (backlog > 80 || (acc !== null && acc < 0.75)) return { n: Math.max(2, Math.round(base / 2)), why: 'slow', acc, backlog };
  if (acc !== null && acc >= 0.9 && backlog < 30) return { n: base + 3, why: 'fast', acc, backlog };
  return { n: base, why: '', acc, backlog };
}

export function nextNewWords(n) {
  const left = Math.max(0, S.settings.newPerDay - today().nw);
  return WORDS.filter(w => !S.intro[w.id]).slice(0, Math.min(n, left));
}

// Maîtrise d'un mot (0..1) = moyenne du rappel à 30 jours sur les facettes
export function mastery(wid) {
  const fs = activeFacets();
  let sum = 0;
  for (const f of fs) {
    const c = getCard(wid, f);
    if (c && c.reps) sum += Math.min(1, c.s / 30);
  }
  return sum / fs.length;
}

// Afficher le pinyin au-dessus des caractères ?
export function showPinyin(wid) {
  const m = S.settings.pinyinMode;
  if (m === 'always') return true;
  if (m === 'never') return false;
  const c = getCard(wid, 'sens');
  return !c || c.s < 10; // s'efface quand le mot est solide (> 10 jours)
}

// ---------- Phrases ----------
// (SFACETS est défini en haut du fichier)
export function introduceSentence(sid) {
  if (S.sintro[sid]) return;
  S.sintro[sid] = Date.now();
  for (const f of SFACETS) S.scards[sid + '|' + f] = newCard(Date.now());
}
export function gradeSentence(sid, f, g) {
  const id = sid + '|' + f;
  S.scards[id] = review(S.scards[id] || newCard(), g);
  const t = today(); t.rev++; if (g > 1) t.ok++;
  save();
}
export const getSCard = (sid, f) => S.scards[sid + '|' + f];
// une phrase est disponible quand tous ses mots HSK ont été appris
export const sentenceReady = (s, extra) => s.toks.every(t => !t.wid || S.intro[t.wid] || extra?.has(t.wid));
// prefer : mots qu'on vient d'apprendre (ils comptent comme connus et passent en priorité)
export function nextNewSentences(n, prefer = []) {
  const extra = new Set(prefer);
  const ready = SENTENCES.filter(s => !S.sintro[s.id] && sentenceReady(s, extra));
  // d'abord celles qui contiennent les mots qu'on vient d'apprendre
  const pref = new Set(prefer);
  ready.sort((a, b) => (b.toks.some(t => pref.has(t.wid)) - a.toks.some(t => pref.has(t.wid))) || a.ord - b.ord);
  return ready.slice(0, n);
}
export function dueSentences(now = Date.now()) {
  const out = [];
  for (const [id, c] of Object.entries(S.scards)) {
    const [sid, f] = id.split('|');
    if (f === 'parler' && !S.settings.speaking) continue;
    if (SENT_BY_ID[sid] && c.due <= now) out.push({ sid, f, c, r: recallNow(c, now) });
  }
  out.sort((a, b) => (a.c.reps === 0) - (b.c.reps === 0) || a.r - b.r);
  return out;
}

export function exportData() { return JSON.stringify(S); }
export function importData(json) {
  const d = JSON.parse(json);
  if (!d.cards || !d.settings) throw new Error('Fichier invalide');
  S = { ...structuredClone(DEFAULTS), ...d, settings: { ...DEFAULTS.settings, ...d.settings } };
  indexCustom();
  save(true);
}
export function resetAll() { S = structuredClone(DEFAULTS); save(true); }

// cartes manquantes (nouvelles compétences) : à la fin, quand tout est initialisé
ensureCards();
