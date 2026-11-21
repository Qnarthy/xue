import { WORDS, WORD_BY_ID } from './data.js';
import * as st from './store.js';
import { speak, sfx, voiceName } from './audio.js';
import { syllables, parseSyl, checkPinyin, numToMarks, toneAccepted, toneSvg, TONE_NAME } from './pinyin.js';
import { recallNow, recallIn7 } from './fsrs.js';
import { esc, shuffle, pct, toast, ruby, actions, dispatchClick, ui, closeModal, levelLabel } from './ui.js';
import * as tutor from './tutor.js';
import * as pron from './pron.js';
import * as exam from './exam.js';

const app = document.getElementById('app');
const S = () => st.S;
const W = (id) => WORD_BY_ID[id];

// ================================================================
//  Navigation
// ================================================================
let tab = 'home';
let sess = null;

function render() {
  if (!S().onboarded) return renderOnboarding();
  if (sess) return renderSession();
  if (tutor.isOpen()) return tutor.renderView(app);
  if (pron.isOpen()) return pron.renderView(app);
  if (exam.isOpen()) return exam.renderView(app);
  const screens = { home: homeScreen, words: wordsScreen, ai: tutor.aiScreen, stats: statsScreen, settings: settingsScreen };
  app.innerHTML = `<div class="screen">${screens[tab]()}</div>${nav()}`;
  after[tab]?.();
  if (tab === 'ai') tutor.afterAiScreen();
}
ui.rerender = render;

function nav() {
  const items = [['home', '🏠', 'Accueil'], ['words', '📖', 'Mots'], ['ai', '🤖', 'Prof IA'], ['stats', '📊', 'Progrès'], ['settings', '⚙️', 'Réglages']];
  return `<nav class="nav">${items.map(([k, ic, l]) => `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}"><span class="ic">${ic}</span>${l}</button>`).join('')}</nav>`;
}

const after = {};
Object.assign(actions, {
  tab: (el) => { tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
  start: (el) => startSession(el.dataset.mode),
  speak: (el) => speak(el.dataset.text, el.dataset.slow ? 0.5 : undefined),
  word: (el) => openWord(el.dataset.id),
  close: () => closeModal(),
});

app.addEventListener('click', dispatchClick);

// ================================================================
//  Premier lancement
// ================================================================
function renderOnboarding() {
  app.innerHTML = `<div class="onb">
    <div class="logo">学</div>
    <h1>Bienvenue sur Xué</h1>
    <p class="muted">Ton appli perso pour apprendre le chinois.<br>Tes progrès restent sur ton téléphone.</p>
    <div class="card" style="text-align:left;margin-top:24px">
      <b>🔊 Test du son</b>
      <p class="muted small" style="margin:4px 0 10px">Touche le bouton : tu dois entendre « 你好 » (nǐ hǎo). Vérifie que ton iPhone n'est pas en mode silencieux.</p>
      <button class="btn ghost sm" data-act="speak" data-text="你好">🔊 Écouter</button>
    </div>
    <p class="sec-title" style="text-align:left">Où en es-tu ?</p>
    <button class="card choice" data-act="onb" data-lvl="0"><b>🌱 Je commence de zéro</b><span class="muted small">On démarre le HSK 1 depuis le début, 5 mots à la fois.</span></button>
    <button class="card choice" data-act="onb" data-lvl="1"><b>🚀 J'ai déjà fait le HSK 1 (Hello Chinese)</b><span class="muted small">Les 150 mots du HSK 1 sont ajoutés en révision sur 10 jours : l'appli teste ce que tu sais vraiment et ne réenseigne que ce que tu as oublié.</span></button>
  </div>`;
}
actions.onb = (el) => {
  if (el.dataset.lvl === '1') WORDS.filter(w => w.lvl === 1).forEach(w => st.introduce(w.id, 10));
  S().onboarded = true; st.save(true); render();
  toast('C\'est parti ! 加油 jiāyóu !');
};

// ================================================================
//  Accueil
// ================================================================
function homeScreen() {
  const s = S(), t = st.today();
  const due = st.dueCards();
  const newW = st.nextNewWords(s.settings.newPerLesson);
  const mins = Math.floor(t.secs / 60), goal = s.settings.goalMin;
  const lv = st.level();
  const streak = st.currentStreak();
  const introduced = Object.keys(s.intro).length;
  const C = 2 * Math.PI * 32, frac = Math.min(1, mins / goal);
  const leftNew = WORDS.length - introduced;

  let hero;
  if (newW.length || due.length) {
    hero = `<div class="card hero">
      <h2>Leçon du jour</h2>
      <p class="muted" style="margin:0 0 14px">${newW.length ? `${newW.length} nouveaux mots` : 'Pas de nouveau mot'} · ${Math.min(due.length, newW.length ? 15 : 30)} révisions</p>
      <button class="btn" data-act="start" data-mode="lesson">${introduced ? 'Continuer' : 'Commencer'} ▸</button>
    </div>`;
  } else {
    hero = `<div class="card hero"><h2>Tout est à jour 🎉</h2>
      <p class="muted" style="margin:0">${leftNew ? `Limite de nouveaux mots atteinte aujourd'hui. Tu peux t'entraîner librement ci-dessous.` : `Tu as vu tous les mots du HSK 3 !`}</p></div>`;
  }
  const lvls = [1, 2, 3].map(l => {
    const ws = WORDS.filter(w => w.lvl === l);
    const seen = ws.filter(w => s.intro[w.id]).length;
    const solid = ws.filter(w => st.mastery(w.id) >= 0.6).length;
    return `<div class="prog"><span class="lab">HSK ${l}</span><span class="track"><i class="a" style="width:${(seen / ws.length) * 100}%"></i><i class="b" style="width:${(solid / ws.length) * 100}%"></i></span><span class="num">${seen}/${ws.length}</span></div>`;
  }).join('');

  return `
  <div class="topbar">
    <h1>学 Xué</h1>
    <span class="pill ${streak ? 'fire' : 'dim'}" title="Série de jours">🔥 ${streak}</span>
    <span class="pill" title="Points d'expérience">⭐ ${s.xp}</span>
  </div>
  <div class="card goal">
    <div class="ring">
      <svg width="76" height="76" viewBox="0 0 76 76"><circle cx="38" cy="38" r="32" fill="none" stroke="var(--line)" stroke-width="8"/>
      <circle cx="38" cy="38" r="32" fill="none" stroke="${frac >= 1 ? 'var(--ok)' : 'var(--brand)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
      <div class="lbl"><div>${mins}<small>/ ${goal} min</small></div></div>
    </div>
    <div class="grow">
      <b>${frac >= 1 ? 'Objectif atteint ! 💪' : 'Objectif du jour'}</b>
      <div class="muted small">Niveau ${lv.n} · ${lv.into}/${lv.need} XP</div>
      <div class="lvlbar"><i style="width:${(lv.into / lv.need) * 100}%"></i></div>
    </div>
  </div>
  ${hero}
  <p class="sec-title">Entraînement</p>
  <div class="tiles">
    <button class="tile" data-act="start" data-mode="review"><span class="ic">🔁</span><b>Révisions</b><span class="muted small">Les mots à revoir</span>${due.length ? `<span class="badge">${due.length}</span>` : ''}</button>
    <button class="tile" data-act="start" data-mode="ton"><span class="ic">🎵</span><b>Tons</b><span class="muted small">Entraîne ton oreille</span></button>
    <button class="tile" data-act="start" data-mode="ecoute"><span class="ic">👂</span><b>Écoute</b><span class="muted small">Reconnaître à l'oral</span></button>
    <button class="tile" data-act="start" data-mode="trace"><span class="ic">✍️</span><b>Écriture</b><span class="muted small">Tracer les caractères</span></button>
    <button class="tile" data-act="start" data-mode="pinyin"><span class="ic">⌨️</span><b>Pinyin</b><span class="muted small">Écrire la prononciation</span></button>
    <button class="tile" data-act="start" data-mode="dictee"><span class="ic">🎧</span><b>Dictée</b><span class="muted small">Écrire ce que tu entends</span></button>
    <button class="tile" data-act="pron"><span class="ic">🎙️</span><b>Prononciation</b><span class="muted small">Ta courbe de tons</span></button>
    <button class="tile" data-act="exam"><span class="ic">📝</span><b>Examen HSK</b><span class="muted small">Examen blanc noté</span></button>
    <button class="tile" data-act="tab" data-tab="ai"><span class="ic">🤖</span><b>Prof IA</b><span class="muted small">Jeux de rôle, histoires</span></button>
  </div>
  <p class="sec-title">Progression HSK</p>
  <div class="card">${lvls}<p class="muted small" style="margin:6px 0 0">Clair : mots vus · Foncé : mots bien ancrés</p></div>`;
}

// ================================================================
//  Sessions d'exercices
// ================================================================
const PRACTICE = { ton: 15, ecoute: 15, trace: 8, pinyin: 12, dictee: 12 };
const FACET_OF = { dictee: 'ecoute' };
actions.pron = () => pron.openLab();
actions.recalib = () => { pron.recalibrate(); toast('Le calibrage sera refait au prochain atelier'); render(); };
actions.exam = () => exam.chooseLevel();

function startSession(mode) {
  const s = S();
  const facets = st.activeFacets();
  let q = [];
  if (mode === 'lesson') {
    const newW = st.nextNewWords(s.settings.newPerLesson);
    const due = st.dueCards();
    const rev = due.slice(0, newW.length ? 15 : 30).map(d => ({ k: 'ex', wid: d.wid, f: d.f }));
    for (let i = 0; i < newW.length; i += 2) {
      const grp = newW.slice(i, i + 2);
      grp.forEach(w => { q.push({ k: 'intro', wid: w.id }); q.push({ k: 'ex', wid: w.id, f: 'sens' }); });
      for (const f of facets.slice(1)) {
        grp.forEach(w => q.push({ k: 'ex', wid: w.id, f }));
        if (rev.length) q.push(rev.shift());
      }
    }
    q.push(...rev);
  } else if (mode === 'review') {
    q = st.dueCards().slice(0, 40).map(d => ({ k: 'ex', wid: d.wid, f: d.f }));
    if (!q.length) return toast('Aucune révision pour le moment ✨');
  } else {
    if (mode === 'trace' && !s.settings.trace) return toast('L\'écriture est désactivée dans les réglages');
    const known = Object.keys(s.intro);
    if (known.length < 4) return toast('Apprends d\'abord quelques mots dans la leçon du jour');
    q = known
      .map(wid => ({ wid, r: recallNow(st.getCard(wid, FACET_OF[mode] || mode)) + Math.random() * 0.15 }))
      .sort((a, b) => a.r - b.r)
      .slice(0, PRACTICE[mode])
      .map(x => ({ k: 'ex', wid: x.wid, f: FACET_OF[mode] || mode, v: FACET_OF[mode] ? mode : undefined }));
  }
  // évite deux fois de suite le même mot sur la même facette
  sess = { mode, q, i: 0, total: q.length, ok: 0, ko: 0, xp: 0, combo: 0, best: 0, t0: Date.now(), tItem: Date.now(), learned: [], state: null };
  render();
}

function quitSession() {
  if (sess && sess.i > 0 && !confirm('Quitter la session ? Tes réponses sont déjà enregistrées.')) return;
  logTime(); sess = null; render();
}
actions.quit = quitSession;

function logTime() {
  if (!sess) return;
  st.addTime((Date.now() - sess.tItem) / 1000);
  sess.tItem = Date.now();
}

function sessTop() {
  const p = sess.total ? (sess.i / sess.total) * 100 : 0;
  return `<div class="sess-top"><button class="x" data-act="quit" aria-label="Quitter">✕</button><div class="bar"><i style="width:${p}%"></i></div><span class="combo">${sess.combo >= 3 ? '🔥' + sess.combo : ''}</span></div>`;
}

function renderSession() {
  if (sess.i >= sess.q.length) return renderEnd();
  const it = sess.q[sess.i];
  const w = W(it.wid);
  sess.state = { item: it, w, answered: false, t: Date.now() };
  let body;
  if (it.k === 'intro') body = introView(w);
  else body = EX[it.v || it.f].view(w, it);
  app.innerHTML = `<div class="sess">${sessTop()}<div class="sess-body">${body}</div></div>`;
  if (it.k === 'intro') introAfter(w);
  else EX[it.v || it.f].after?.(w, it);
}

// ---------- Nouveau mot ----------
function introView(w) {
  const tones = syllables(w.p).map(parseSyl).filter(x => x.hasVowel);
  return `<span class="q-tag">Nouveau mot · ${levelLabel(w)}</span>
  <div class="prompt">${ruby(w, true)}
    <div class="fr" style="margin-top:6px">${esc(w.f)}</div>
    <div><button class="spk" data-act="speak" data-text="${esc(w.h)}" aria-label="Écouter">🔊</button><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}" aria-label="Écouter lentement">🐢</button></div>
  </div>
  <div class="writers" id="writers"></div>
  <div class="intro-tones">${tones.map(t => `<div>${toneSvg(t.tone, 34)}${TONE_NAME[t.tone]}</div>`).join('')}</div>
  <div class="actions" style="margin-top:auto"><button class="btn" data-act="introok">J'ai compris ▸</button></div>`;
}
function introAfter(w) {
  st.introduce(w.id);
  st.today().nw++;
  sess.learned.push(w.id);
  st.save();
  setTimeout(() => speak(w.h), 250);
  mountWriters(document.getElementById('writers'), w.h, 'animate');
}
actions.introok = () => { logTime(); sess.i++; renderSession(); };

function mountWriters(box, text, mode, size) {
  if (!box || !window.HanziWriter) return [];
  const chars = [...text];
  size ||= chars.length > 2 ? 86 : 110;
  return chars.map((c, i) => {
    const el = document.createElement('div');
    el.className = 'wbox';
    el.style.width = el.style.height = size + 'px';
    el.innerHTML = `<svg class="grid" viewBox="0 0 100 100" width="${size}" height="${size}"><path d="M0,0 L100,100 M100,0 L0,100 M50,0 L50,100 M0,50 L100,50" stroke="var(--line)" stroke-dasharray="3 3" stroke-width=".8"/></svg>`;
    box.appendChild(el);
    const writer = HanziWriter.create(el, c, {
      width: size, height: size, padding: 6, showOutline: mode !== 'quiz',
      strokeColor: getComputedStyle(document.body).getPropertyValue('--ink').trim() || '#222',
      outlineColor: 'rgba(150,140,130,.25)', radicalColor: null,
      strokeAnimationSpeed: 1.3, delayBetweenStrokes: 120, delayBetweenLoops: 1800,
      drawingWidth: 26, showCharacter: mode === 'static', highlightColor: '#F2A60C',
      onLoadCharDataError: () => { el.innerHTML = `<div class="hzf" style="font-size:${size * 0.7}px;text-align:center;line-height:${size}px">${c}</div>`; el.dataset.err = 1; },
    });
    if (mode === 'animate') setTimeout(() => writer.loopCharacterAnimation(), 300 + i * 400);
    return { writer, el };
  });
}

// ---------- Choix des distracteurs (les plus confusants possibles) ----------
function distractors(w, n, kind) {
  const base = syllables(w.p).map(s => parseSyl(s).base).join('');
  const len = [...w.h].length;
  const cands = WORDS.filter(x => x.id !== w.id && x.h !== w.h && x.f !== w.f
    // à l'oral, un homophone parfait (他/她 = tā) rendrait la question impossible
    && !(kind === 'sound' && x.p.toLowerCase() === w.p.toLowerCase())).map(x => {
    let sc = Math.random() * 2;
    if (S().intro[x.id]) sc += 3;
    if ([...x.h].length === len) sc += 2;
    if ([...x.h].some(c => w.h.includes(c))) sc += 2;
    if (x.lvl === w.lvl) sc += 1;
    if (kind === 'sound') {
      const b = syllables(x.p).map(s => parseSyl(s).base).join('');
      if (b === base) sc += 6; else if (b[0] === base[0]) sc += 1;
    }
    return { x, sc };
  }).sort((a, b) => b.sc - a.sc).slice(0, 10);
  const out = [], seenF = new Set([w.f]), seenH = new Set([w.h]);
  for (const { x } of shuffle(cands)) {
    if (seenF.has(x.f) || seenH.has(x.h)) continue;
    seenF.add(x.f); seenH.add(x.h); out.push(x);
    if (out.length === n) break;
  }
  return out;
}

// ---------- Les 5 types d'exercices ----------
const EX = {
  sens: {
    view(w) {
      const c = st.getCard(w.id, 'sens');
      const reverse = c && c.reps >= 2 && Math.random() < 0.5;
      const opts = shuffle([w, ...distractors(w, 3)]);
      sess.state.opts = opts;
      if (!reverse) {
        return `<span class="q-tag">Sens</span><p class="q-label">Que signifie ce mot ?</p>
          <div class="prompt">${ruby(w, st.showPinyin(w.id))}</div>
          <div class="opts">${opts.map((o, i) => `<button class="opt" data-act="mcq" data-i="${i}">${esc(o.f)}</button>`).join('')}</div>`;
      }
      return `<span class="q-tag">Sens</span><p class="q-label">Comment dit-on…</p>
        <div class="prompt"><div class="fr">« ${esc(w.f)} »</div></div>
        <div class="opts two">${opts.map((o, i) => `<button class="opt" data-act="mcq" data-i="${i}">${ruby(o, st.showPinyin(o.id))}</button>`).join('')}</div>`;
    },
  },
  ecoute: {
    view(w) {
      const opts = shuffle([w, ...distractors(w, 3, 'sound')]);
      sess.state.opts = opts;
      return `<span class="q-tag">Écoute</span><p class="q-label">Qu'est-ce que tu entends ?</p>
        <div class="prompt"><button class="spk big" data-act="speak" data-text="${esc(w.h)}" aria-label="Réécouter">🔊</button><br><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}" aria-label="Lentement">🐢</button></div>
        <div class="opts two">${opts.map((o, i) => `<button class="opt" data-act="mcq" data-i="${i}">${ruby(o, st.showPinyin(o.id))}</button>`).join('')}</div>`;
    },
    after(w) { setTimeout(() => speak(w.h), 300); },
  },
  ton: {
    view(w) {
      const chars = [...w.h], syls = syllables(w.p).map(parseSyl);
      sess.state.sel = syls.map(s => (s.hasVowel ? 0 : -1));
      const rows = syls.map((s, i) => !s.hasVowel ? '' : `<div class="tone-row">
        <div class="syl"><span class="hzf">${chars[i]}</span><span>${s.base.replace(/v/g, 'ü')}</span></div>
        <div class="tone-btns">${[1, 2, 3, 4, 5].map(t => `<button class="opt" data-act="tonepick" data-s="${i}" data-t="${t}">${toneSvg(t, 24)}${t === 5 ? '·' : t}</button>`).join('')}</div>
      </div>`).join('');
      return `<span class="q-tag">Tons</span><p class="q-label">Choisis le ton de chaque syllabe</p>
        <div class="prompt" style="padding:4px 0 10px"><button class="spk big" data-act="speak" data-text="${esc(w.h)}">🔊</button><br><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}">🐢</button>
        <div class="muted small">${esc(w.f)}</div></div>
        <div class="tone-rows">${rows}</div>
        <div class="actions"><button class="btn" id="tonego" data-act="tonego" disabled>Vérifier</button></div>`;
    },
    after(w) { setTimeout(() => speak(w.h), 300); },
  },
  pinyin: {
    view(w) {
      return `<span class="q-tag">Pinyin</span><p class="q-label">Écris le pinyin avec les tons</p>
        <div class="prompt" style="padding-bottom:10px">${ruby(w, false)}<div class="muted">${esc(w.f)}</div></div>
        <input id="pyin" class="pyin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ex : ni3 hao3" enterkeyhint="done">
        <div class="pyprev" id="pyprev"></div>
        <div class="keys">${[1, 2, 3, 4, 5].map(t => `<button class="opt" data-act="key" data-k="${t}">${t}<small>${t === 5 ? 'neutre' : ['ā', 'á', 'ǎ', 'à'][t - 1]}</small></button>`).join('')}<button class="opt" data-act="key" data-k="v">ü</button></div>
        <div class="actions" style="margin-top:auto">
          <button class="btn" data-act="pygo">Vérifier</button>
          <button class="btn ghost" data-act="dunno">Je ne sais pas</button>
        </div>`;
    },
    after() {
      const inp = document.getElementById('pyin');
      const prev = document.getElementById('pyprev');
      inp.addEventListener('input', () => { prev.textContent = numToMarks(inp.value); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions.pygo(); } });
      setTimeout(() => inp.focus(), 50);
    },
  },
  dictee: {
    view(w) {
      return `<span class="q-tag">Dictée</span><p class="q-label">Écris en pinyin ce que tu entends</p>
        <div class="prompt" style="padding:4px 0 10px"><button class="spk big" data-act="speak" data-text="${esc(w.h)}" aria-label="Réécouter">🔊</button><br><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}" aria-label="Lentement">🐢</button></div>
        <input id="pyin" class="pyin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ex : ni3 hao3" enterkeyhint="done">
        <div class="pyprev" id="pyprev"></div>
        <div class="keys">${[1, 2, 3, 4, 5].map(t => `<button class="opt" data-act="key" data-k="${t}">${t}<small>${t === 5 ? 'neutre' : ['ā', 'á', 'ǎ', 'à'][t - 1]}</small></button>`).join('')}<button class="opt" data-act="key" data-k="v">ü</button></div>
        <div class="actions" style="margin-top:auto">
          <button class="btn" data-act="pygo">Vérifier</button>
          <button class="btn ghost" data-act="dunno">Je ne sais pas</button>
        </div>`;
    },
    after(w) { EX.pinyin.after(w); setTimeout(() => speak(w.h), 300); },
  },
  trace: {
    view(w) {
      return `<span class="q-tag">Écriture</span><p class="q-label">Trace le mot, trait par trait</p>
        <div class="prompt" style="padding:0 0 10px"><div class="fr">${esc(w.f)}</div><div class="py">${esc(w.p)} <button class="spk" style="width:40px;height:40px;font-size:18px" data-act="speak" data-text="${esc(w.h)}">🔊</button></div></div>
        <div class="writers" id="writers"></div>
        <p class="muted small" style="text-align:center" id="tracemsg">Après 3 erreurs sur un trait, l'appli te montre où il commence.</p>
        <div class="actions" style="margin-top:auto">
          <button class="btn ghost" data-act="tracehint">💡 Indice</button>
          <button class="btn ghost" data-act="dunno">Passer</button>
        </div>`;
    },
    after(w) {
      const box = document.getElementById('writers');
      const chars = [...w.h];
      const size = Math.min(chars.length > 1 ? 150 : 250, Math.floor((Math.min(window.innerWidth, 560) - 40) / Math.min(chars.length, 2)) - 10);
      const ws = mountWriters(box, w.h, 'quiz', size);
      if (!ws.length) { toast('Écriture indisponible hors connexion'); sess.i++; return renderSession(); }
      let idx = 0, mistakes = 0, hints = 0;
      const quiz = () => {
        const { writer, el } = ws[idx];
        writer.quiz({
          showHintAfterMisses: 3, leniency: 1.1,
          onMistake: () => { mistakes++; },
          onComplete: () => { el.classList.remove('active'); el.classList.add('done'); idx++; setTimeout(run, 350); },
        });
      };
      const run = () => {
        if (sess?.state?.w !== w || sess.state.answered) return;
        if (idx >= ws.length) {
          const per = (mistakes + hints * 3) / chars.length;
          return answer(per <= 3, per <= 1 ? 3 : per <= 3 ? 2 : 1);
        }
        const { el } = ws[idx];
        if (el.dataset.err) { idx++; return run(); }
        el.classList.add('active');
        quiz();
      };
      // indice : montre l'animation du caractère en cours puis relance le tracé
      sess.state.trace = {
        hint: () => {
          if (idx >= ws.length) return;
          hints++;
          const { writer } = ws[idx];
          writer.cancelQuiz();
          writer.animateCharacter({ onComplete: () => setTimeout(() => { writer.hideCharacter(); quiz(); }, 500) });
        },
      };
      setTimeout(run, 200);
    },
  },
};

actions.mcq = (el) => {
  if (sess.state.answered) return;
  const i = +el.dataset.i, opts = sess.state.opts, w = sess.state.w;
  const ok = opts[i].id === w.id;
  document.querySelectorAll('.opt[data-act=mcq]').forEach((b, j) => {
    if (opts[j].id === w.id) b.classList.add('right');
    else if (j === i) b.classList.add('wrong');
  });
  answer(ok);
};
actions.tonepick = (el) => {
  if (sess.state.answered) return;
  const s = +el.dataset.s, t = +el.dataset.t;
  sess.state.sel[s] = t;
  el.parentElement.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', b === el));
  document.getElementById('tonego').disabled = sess.state.sel.some(x => x === 0);
};
actions.tonego = () => {
  if (sess.state.answered) return;
  const w = sess.state.w, chars = [...w.h];
  const syls = syllables(w.p).map(parseSyl);
  let ok = true;
  syls.forEach((s, i) => {
    if (!s.hasVowel) return;
    const good = toneAccepted(chars[i], s.tone, sess.state.sel[i]);
    // statistiques de confusion à l'oreille
    const sel = sess.state.sel[i];
    if (!sess.state.item.retry && s.tone <= 4 && sel >= 1 && sel <= 4) S().toneEar[s.tone - 1][(good ? s.tone : sel) - 1]++;
    if (!good) ok = false;
    const btns = document.querySelectorAll(`.opt[data-s="${i}"]`);
    btns.forEach(b => {
      const t = +b.dataset.t;
      if (t === s.tone) b.classList.add('right');
      else if (t === sess.state.sel[i] && !good) b.classList.add('wrong');
      b.classList.remove('sel');
    });
  });
  answer(ok);
};
actions.key = (el) => {
  const inp = document.getElementById('pyin');
  inp.value += el.dataset.k === 'v' ? 'ü' : el.dataset.k;
  inp.dispatchEvent(new Event('input'));
  inp.focus();
};
actions.pygo = () => {
  if (sess.state.answered) return;
  const inp = document.getElementById('pyin');
  if (!inp.value.trim()) return toast('Écris le pinyin, ex : ni3 hao3');
  inp.blur();
  const r = checkPinyin(inp.value, sess.state.w);
  let note = '';
  if (!r.ok) note = r.lettersOk ? 'Les lettres sont bonnes, mais pas les tons.' : 'L\'orthographe n\'est pas correcte.';
  answer(r.ok, undefined, note);
};
actions.dunno = () => { if (!sess.state.answered) { sess.state.skipped = true; answer(false); } };
actions.tracehint = () => {
  const tr = sess.state.trace; if (!tr || sess.state.answered) return;
  tr.hint();
  toast('Regarde bien l\'ordre des traits 👀');
};

// ---------- Correction / notation ----------
function answer(ok, forcedGrade, note = '') {
  const s = sess.state; if (s.answered) return;
  s.answered = true;
  const it = s.item, w = s.w;
  const secs = (Date.now() - s.t) / 1000;
  logTime();
  if (!it.retry) {
    const g = forcedGrade ?? (ok ? (secs > (it.f === 'pinyin' || it.f === 'ton' || it.v ? 20 : 12) ? 2 : 3) : 1);
    st.grade(w.id, it.f, ok ? Math.max(2, g) : 1);
  }
  if (ok) {
    sess.combo++; sess.best = Math.max(sess.best, sess.combo);
    const gain = it.retry ? 5 : 10 + Math.min(sess.combo - 1, 5);
    sess.xp += gain; st.addXp(gain);
    if (!it.retry) sess.ok++;
    sfx.ok();
  } else {
    sess.combo = 0;
    if (!it.retry) sess.ko++;
    sfx.ko();
    // on redonne l'exercice un peu plus tard dans la session (2 fois max ; pas si l'écriture a été passée)
    const tries = it.retry || 0;
    if (tries < 2 && !(it.f === 'trace' && s.skipped)) {
      const pos = Math.min(sess.q.length, sess.i + 3 + ((Math.random() * 3) | 0));
      sess.q.splice(pos, 0, { ...it, retry: tries + 1 });
      sess.total++;
    }
  }
  const praise = ['Bravo !', 'Excellent !', 'Parfait !', '太好了 !', 'Super !', '很好 !'];
  const sheet = document.createElement('div');
  sheet.className = 'sheet ' + (ok ? 'ok' : 'ko');
  sheet.innerHTML = `<h3>${ok ? praise[(Math.random() * praise.length) | 0] : 'Pas tout à fait…'}</h3>
    <div class="ans">${ruby(w, true)}<div class="grow"><b>${esc(w.f)}</b>${note ? `<div class="small muted">${esc(note)}</div>` : ''}</div>
    <button class="spk" data-act="speak" data-text="${esc(w.h)}">🔊</button>${S().settings.groqKey ? `<button class="spk" data-act="explain" data-id="${esc(w.id)}" aria-label="Explication par l'IA">🤖</button>` : ''}</div>
    <button class="btn ${ok ? 'ok' : 'ko'}" data-act="next">Continuer</button>`;
  const sessEl = document.querySelector('.sess');
  sessEl.appendChild(sheet);
  sessEl.style.paddingBottom = sheet.offsetHeight + 16 + 'px';
  sheet.scrollIntoView({ block: 'end' });
  if (it.f !== 'ecoute' || !ok) setTimeout(() => speak(w.h), 200);
  const top = document.querySelector('.sess-top');
  if (top) top.outerHTML = sessTop();
}
actions.next = () => { sess.i++; renderSession(); window.scrollTo(0, 0); };

// ---------- Fin de session ----------
function renderEnd() {
  logTime();
  const newStreak = st.touchStreak();
  const acc = sess.ok + sess.ko ? sess.ok / (sess.ok + sess.ko) : 1;
  const mins = Math.max(1, Math.round((Date.now() - sess.t0) / 60000));
  if (sess.ok + sess.ko > 0 && acc >= 0.9) { st.addXp(20); sess.xp += 20; }
  sfx.done();
  const learned = sess.learned.map(W);
  app.innerHTML = `<div class="sess"><div class="end">
    <div class="big">${acc >= 0.9 ? '🏆' : acc >= 0.7 ? '🎉' : '💪'}</div>
    <h1 style="margin:6px 0">${acc >= 0.9 ? 'Session parfaite !' : 'Session terminée !'}</h1>
    ${newStreak ? `<p class="pill fire" style="margin-top:8px">🔥 Série : ${st.currentStreak()} jour${st.currentStreak() > 1 ? 's' : ''}</p>` : ''}
    <div class="kpis">
      <div class="kpi"><b>+${sess.xp}</b><span>XP</span></div>
      <div class="kpi"><b>${pct(acc)}</b><span>Réussite</span></div>
      <div class="kpi"><b>${mins}</b><span>min</span></div>
    </div>
    ${acc >= 0.9 && sess.ok + sess.ko > 0 ? '<p class="muted small">+20 XP bonus pour 90 % de réussite</p>' : ''}
    ${learned.length ? `<div class="card" style="text-align:left"><b>Nouveaux mots appris</b><div class="row" style="flex-wrap:wrap;gap:14px;margin-top:10px">${learned.map(w => `<button data-act="speak" data-text="${esc(w.h)}" style="text-align:center"><div class="hzf" style="font-size:28px">${w.h}</div><div class="small muted">${esc(w.p)}</div></button>`).join('')}</div></div>` : ''}
  </div><div class="actions" style="margin-top:auto"><button class="btn" data-act="endok">Continuer</button></div></div>`;
  confetti();
  sess.finished = true;
}
actions.endok = () => { sess = null; tab = 'home'; render(); };

function confetti() {
  const box = document.createElement('div'); box.className = 'confetti';
  const colors = ['#E5484D', '#F2A60C', '#1F9D55', '#3E7BFA', '#B44CF0'];
  for (let i = 0; i < 60; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[i % colors.length];
    c.style.animationDuration = 1.6 + Math.random() * 1.8 + 's';
    c.style.animationDelay = Math.random() * 0.5 + 's';
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

// ================================================================
//  Liste des mots
// ================================================================
let wq = '', wlvl = 0;
function wordsScreen() {
  return `<div class="topbar"><h1>Mots</h1><span class="pill">${Object.keys(S().intro).length}/${WORDS.length}</span></div>
    <input class="search" id="wsearch" type="search" placeholder="Chercher : 你好, ni hao, bonjour…" value="${esc(wq)}" autocomplete="off" autocapitalize="off">
    <div class="chips">${[[0, 'Tous'], [1, 'HSK 1'], [2, 'HSK 2'], [3, 'HSK 3'], ...(WORDS.some(w => !w.lvl) ? [[4, 'Perso']] : []), [9, 'Appris'], [8, 'À renforcer']].map(([v, l]) => `<button class="chip ${wlvl === v ? 'on' : ''}" data-act="wlvl" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="wlist" id="wlist"></div>`;
}
function fillWords() {
  const box = document.getElementById('wlist'); if (!box) return;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s/g, '');
  const q = norm(wq);
  let list = WORDS.filter(w => {
    if (wlvl && wlvl < 4 && w.lvl !== wlvl) return false;
    if (wlvl === 4 && w.lvl) return false;
    if (wlvl === 9 && !S().intro[w.id]) return false;
    if (wlvl === 8 && (!S().intro[w.id] || st.mastery(w.id) >= 0.35)) return false;
    if (!q) return true;
    return w.h.includes(wq.trim()) || norm(w.p).includes(q) || norm(w.f).includes(q);
  });
  if (wlvl === 8) list.sort((a, b) => st.mastery(a.id) - st.mastery(b.id));
  box.innerHTML = list.slice(0, 300).map(w => {
    const m = S().intro[w.id] ? st.mastery(w.id) : -1;
    const cls = m < 0 ? '' : m < 0.2 ? 'l1' : m < 0.6 ? 'l2' : 'l3';
    return `<button class="wrow" data-act="word" data-id="${esc(w.id)}"><span class="hzf">${w.h}</span><span class="grow"><div class="py">${esc(w.p)}</div><div class="fr">${esc(w.f)}</div></span><span class="dot ${cls}" title="${m < 0 ? 'Pas encore vu' : 'Maîtrise ' + pct(m)}"></span></button>`;
  }).join('') || '<p class="muted" style="padding:16px;text-align:center">Aucun mot trouvé</p>';
}
after.words = () => {
  fillWords();
  document.getElementById('wsearch').addEventListener('input', (e) => { wq = e.target.value; fillWords(); });
};
actions.wlvl = (el) => { wlvl = +el.dataset.v; render(); };

function openWord(id) {
  const w = W(id), seen = S().intro[id];
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  const meters = st.activeFacets().map(f => {
    const c = st.getCard(id, f), r = recallIn7(c);
    const lab = !c || !c.reps ? '—' : pct(r);
    return `<div class="meter"><span class="lab">${st.FACET_LABEL[f]}</span><span class="track"><i style="width:${c && c.reps ? r * 100 : 0}%"></i></span><span class="v">${lab}</span></div>`;
  }).join('');
  bg.innerHTML = `<div class="modal">
    <div style="text-align:center">${ruby(w, true).replace('class="hz"', 'class="hz" style="font-size:60px"')}
      <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(w.f)}</div>
      <div class="muted small">${levelLabel(w)}</div>
      <button class="spk" data-act="speak" data-text="${esc(w.h)}">🔊</button><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}">🐢</button>
    </div>
    <div class="writers" id="mwriters"></div>
    <button class="btn ghost" data-act="explain" data-id="${esc(w.id)}" style="margin-bottom:10px">🤖 Explique-moi ce mot</button>
    ${seen ? `<p class="sec-title">Mémoire dans 7 jours</p><div class="card">${meters}<p class="muted small" style="margin:8px 0 0">Chance de t'en souvenir dans une semaine sans réviser, pour chaque compétence.</p></div>` : '<p class="muted" style="text-align:center">Pas encore appris — il arrivera dans une prochaine leçon.</p>'}
    <button class="btn ghost" data-act="close">Fermer</button>
  </div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  bg.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e); });
  mountWriters(bg.querySelector('#mwriters'), w.h, 'animate', 96);
  speak(w.h);
}

// ================================================================
//  Progrès
// ================================================================
function statsScreen() {
  const s = S(), ids = Object.keys(s.intro);
  const solid = ids.filter(id => st.mastery(id) >= 0.6).length;
  const days = Object.entries(s.days);
  const totalMin = Math.round(days.reduce((a, [, d]) => a + d.secs, 0) / 60);
  const cut = st.dayKey(Date.now() - 30 * 86400000);
  const last30 = days.filter(([k]) => k >= cut);
  const rev = last30.reduce((a, [, d]) => a + d.rev, 0), ok = last30.reduce((a, [, d]) => a + d.ok, 0);

  // 14 derniers jours (minutes)
  const series = [];
  for (let i = 13; i >= 0; i--) {
    const t = Date.now() - i * 86400000, k = st.dayKey(t), d = s.days[k];
    series.push({ k, m: d ? Math.round(d.secs / 60) : 0, lab: new Date(t - 4 * 3600000).toLocaleDateString('fr-FR', { weekday: 'narrow' }) });
  }
  const maxM = Math.max(s.settings.goalMin, ...series.map(x => x.m));

  // prévision des révisions sur 7 jours
  const fc = [];
  const facets = new Set(st.activeFacets());
  for (let i = 0; i < 7; i++) {
    const end = new Date(); end.setHours(4, 0, 0, 0); const e = end.getTime() + (i + 1) * 86400000;
    const startT = i === 0 ? 0 : end.getTime() + i * 86400000;
    let n = 0;
    for (const [cid, c] of Object.entries(s.cards)) if (facets.has(cid.split('|')[1]) && c.due < e && c.due >= startT) n++;
    fc.push({ n, lab: i === 0 ? 'Auj.' : new Date(Date.now() + i * 86400000).toLocaleDateString('fr-FR', { weekday: 'short' }) });
  }
  const maxF = Math.max(1, ...fc.map(x => x.n));

  // point fort / point faible par compétence
  const fstats = st.activeFacets().map(f => {
    let sum = 0, n = 0;
    for (const id of ids) { const c = st.getCard(id, f); if (c && c.reps) { sum += recallIn7(c); n++; } }
    return { f, v: n ? sum / n : null };
  });
  const valid = fstats.filter(x => x.v !== null);
  const weakest = valid.length > 1 ? valid.reduce((a, b) => (b.v < a.v ? b : a)) : null;

  const bars = (arr, max, fmt) => `<div class="chart"><div class="bars">${arr.map((x, i) => `<button data-act="bar" data-tip="${esc(fmt(x))}" class="${x.n === 0 || x.m === 0 ? 'zero' : ''}" aria-label="${esc(fmt(x))}"><i style="height:${(((x.m ?? x.n) || 0) / max) * 100}%"></i></button>`).join('')}</div>
    <div class="xlabels">${arr.map(x => `<span>${esc(x.lab)}</span>`).join('')}</div></div>`;

  return `<div class="topbar"><h1>Progrès</h1></div>
  <div class="kpis" style="margin-top:0">
    <div class="kpi"><b>${ids.length}</b><span>mots vus</span></div>
    <div class="kpi"><b>${solid}</b><span>mots ancrés</span></div>
    <div class="kpi"><b>${rev ? pct(ok / rev) : '—'}</b><span>réussite 30 j</span></div>
    <div class="kpi"><b>${totalMin}</b><span>min au total</span></div>
    <div class="kpi"><b>${st.currentStreak()}</b><span>jours de série</span></div>
    <div class="kpi"><b>${st.level().n}</b><span>niveau</span></div>
  </div>
  <div class="card"><h2>Minutes d'étude</h2><p class="muted small" style="margin:0 0 12px">14 derniers jours · objectif ${s.settings.goalMin} min</p>${bars(series, maxM, x => `${x.k.slice(8)}/${x.k.slice(5, 7)} : ${x.m} min`)}</div>
  <div class="card"><h2>Tes compétences</h2><p class="muted small" style="margin:0 0 8px">Chance moyenne de t'en souvenir dans 7 jours (mots vus)</p>
    ${fstats.map(x => `<div class="meter"><span class="lab">${st.FACET_LABEL[x.f]}</span><span class="track"><i style="width:${(x.v || 0) * 100}%"></i></span><span class="v">${x.v === null ? '—' : pct(x.v)}</span></div>${weakest && weakest.f === x.f ? `<div class="weak">↑ Point faible : l'appli te le fera travailler en priorité</div>` : ''}`).join('')}
  </div>
  <div class="card"><h2>Révisions à venir</h2><p class="muted small" style="margin:0 0 12px">Nombre d'exercices prévus par jour</p>${bars(fc, maxF, x => `${x.lab} : ${x.n} exercices`)}</div>
  ${heatmapCard()}
  ${toneCard()}
  ${examsCard()}
  ${hardWordsCard()}`;
}

// Calendrier des 12 dernières semaines (minutes d'étude par jour)
function heatmapCard() {
  const s = S(), goal = s.settings.goalMin;
  const today0 = new Date(Date.now() - 4 * 3600000); today0.setHours(12, 0, 0, 0);
  const dow = (today0.getDay() + 6) % 7; // lundi = 0
  const start = today0.getTime() - (11 * 7 + dow) * 86400000;
  const cells = [];
  let active = 0;
  for (let i = 0; i < 84; i++) {
    const t = start + i * 86400000;
    if (t > today0.getTime()) { cells.push('<span class="hm-cell empty"></span>'); continue; }
    const k = st.dayKey(t + 4 * 3600000), m = Math.round((s.days[k]?.secs || 0) / 60);
    if (m) active++;
    const lv = m === 0 ? 0 : m < goal / 3 ? 1 : m < (2 * goal) / 3 ? 2 : m < goal ? 3 : 4;
    const d = new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    cells.push(`<button class="hm-cell l${lv}" data-act="bar" data-tip="${esc(d)} : ${m} min" aria-label="${esc(d)} : ${m} min"></button>`);
  }
  return `<div class="card"><h2>Calendrier</h2><p class="muted small" style="margin:0 0 12px">12 dernières semaines · ${active} jours d'étude</p>
    <div class="chart"><div class="heatmap">${cells.join('')}</div></div>
    <div class="hm-legend small muted">Moins ${[0, 1, 2, 3, 4].map(l => `<span class="hm-cell l${l}"></span>`).join('')} Plus · foncé = objectif atteint</div></div>`;
}

// Matrices de confusion des tons (oreille et voix)
function toneCard() {
  const s = S();
  const total = (M) => M.flat().reduce((a, b) => a + b, 0);
  const mat = (M, title, sub) => {
    if (total(M) < 4) return `<div class="tm"><b>${title}</b><p class="muted small">${sub}</p></div>`;
    const rows = M.map((r, i) => {
      const n = r.reduce((a, b) => a + b, 0);
      return `<div class="tm-row"><span class="tm-h">${i + 1}</span>${r.map((v, j) => {
        const p = n ? v / n : 0;
        return `<span class="tm-c ${i === j ? 'diag' : ''}" style="--p:${p}" title="Ton ${i + 1} → ${j + 1} : ${Math.round(p * 100)} %">${n ? Math.round(p * 100) : '·'}</span>`;
      }).join('')}</div>`;
    }).join('');
    return `<div class="tm"><b>${title}</b><div class="tm-grid"><div class="tm-row"><span class="tm-h"></span>${[1, 2, 3, 4].map(j => `<span class="tm-h">${j}</span>`).join('')}</div>${rows}</div></div>`;
  };
  // plus grosse confusion
  let worst = null;
  for (const [M, src] of [[s.toneEar, 'à l\'oreille'], [s.toneVoice, 'en parlant']]) {
    M.forEach((r, i) => {
      const n = r.reduce((a, b) => a + b, 0); if (n < 5) return;
      r.forEach((v, j) => { if (i !== j && v / n > 0.15 && (!worst || v / n > worst.p)) worst = { i: i + 1, j: j + 1, p: v / n, src }; });
    });
  }
  const ord = (n) => (n === 1 ? '1er' : n + 'e');
  return `<div class="card"><h2>Tes tons</h2><p class="muted small" style="margin:0 0 10px">Lignes : le ton attendu · colonnes : ce que tu as choisi ou prononcé (%)</p>
    <div class="tm-wrap">${mat(s.toneEar, '👂 Oreille', 'Fais quelques exercices de tons')}${mat(s.toneVoice, '🎙️ Voix', 'Essaie l\'atelier de prononciation')}</div>
    ${worst ? `<p class="insight">💡 ${worst.src === 'en parlant' ? 'En parlant' : 'À l\'oreille'}, tu confonds souvent le <b>${ord(worst.i)} ton</b> avec le <b>${ord(worst.j)}</b> (${Math.round(worst.p * 100)} % des cas).</p>` : ''}</div>`;
}

function examsCard() {
  const ex = S().exams;
  if (!ex.length) return '';
  const best = [1, 2, 3].map(l => ({ l, b: Math.max(-1, ...ex.filter(e => e.lvl === l).map(e => e.score)) }));
  return `<div class="card"><h2>Examens blancs</h2>
    ${best.map(({ l, b }) => `<div class="meter"><span class="lab">HSK ${l}</span><span class="track"><i style="width:${Math.max(0, b)}%;${b >= 60 ? 'background:var(--ok)' : ''}"></i></span><span class="v">${b >= 0 ? b : '—'}</span></div>`).join('')}
    <p class="muted small" style="margin:8px 0 0">Meilleur score sur 100 · vert = réussi (60 et plus) · ${ex.length} examen${ex.length > 1 ? 's' : ''} passé${ex.length > 1 ? 's' : ''}</p></div>`;
}

function hardWordsCard() {
  const lapses = {};
  for (const [id, c] of Object.entries(S().cards)) {
    if (!c.lapses) continue;
    const wid = id.split('|')[0];
    if (W(wid)) lapses[wid] = (lapses[wid] || 0) + c.lapses;
  }
  const top = Object.entries(lapses).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) return '';
  return `<div class="card" style="padding-bottom:6px"><h2>Mots les plus difficiles</h2><p class="muted small" style="margin:0 0 6px">Ceux que tu as oubliés le plus souvent</p>
    ${top.map(([id, n]) => { const w = W(id); return `<button class="wrow" style="padding:9px 0" data-act="word" data-id="${esc(id)}"><span class="hzf">${esc(w.h)}</span><span class="grow"><div class="py">${esc(w.p)}</div><div class="fr">${esc(w.f)}</div></span><span class="muted small">${n} oubli${n > 1 ? 's' : ''}</span></button>`; }).join('')}</div>`;
}
actions.bar = (el) => {
  const chart = el.closest('.chart');
  chart.querySelectorAll('.tip').forEach(t => t.remove());
  chart.querySelectorAll('.bars button').forEach(b => b.classList.toggle('on', b === el));
  const tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = el.dataset.tip;
  const r = el.getBoundingClientRect(), cr = chart.getBoundingClientRect();
  tip.style.left = Math.min(cr.width - 50, Math.max(50, r.left - cr.left + r.width / 2)) + 'px';
  chart.appendChild(tip);
};

// ================================================================
//  Réglages
// ================================================================
function settingsScreen() {
  const s = S().settings;
  const sel = (key, opts) => `<select data-set="${key}">${opts.map(([v, l]) => `<option value="${v}" ${String(s[key]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="topbar"><h1>Réglages</h1></div>
  <p class="sec-title">Apprentissage</p>
  <div class="card">
    <div class="set"><label>Nouveaux mots par leçon</label>${sel('newPerLesson', [[3, '3'], [5, '5'], [8, '8'], [10, '10']])}</div>
    <div class="set"><label>Nouveaux mots max / jour</label>${sel('newPerDay', [[10, '10'], [15, '15'], [20, '20'], [30, '30'], [50, '50']])}</div>
    <div class="set"><label>Objectif quotidien</label>${sel('goalMin', [[10, '10 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '60 min']])}</div>
    <div class="set"><label>Pinyin au-dessus des caractères<span class="muted">Auto : disparaît quand tu connais bien le mot</span></label>${sel('pinyinMode', [['auto', 'Auto'], ['always', 'Toujours'], ['never', 'Jamais']])}</div>
    <div class="set"><label>Calibrage de la voix<span class="muted">${S().voice?.base != null ? 'Voix calibrée : ~' + Math.round(100 * Math.pow(2, S().voice.base / 12)) + ' Hz' : 'Pas encore fait'}</span></label><button class="btn ghost sm" data-act="recalib">Refaire</button></div>
    <div class="set"><label>Exercices d'écriture<span class="muted">Tracer les caractères au doigt</span></label><input type="checkbox" class="switch" data-set="trace" ${s.trace ? 'checked' : ''}></div>
  </div>
  <p class="sec-title">Audio</p>
  <div class="card">
    <div class="set"><label>Vitesse de la voix<span class="muted">${esc(voiceName())}</span></label>${sel('rate', [[0.6, 'Lente'], [0.8, 'Normale'], [1, 'Rapide']])}</div>
    <div class="set"><label>Tester la voix</label><button class="btn ghost sm" data-act="speak" data-text="你好，我在学习中文。">🔊 你好</button></div>
    <p class="muted small" style="margin:8px 0 0">Astuce iPhone : pour une voix plus naturelle, va dans Réglages → Accessibilité → Contenu énoncé → Voix → Chinois, et télécharge une voix « améliorée ».</p>
  </div>
  <p class="sec-title">Prof IA (Groq)</p>
  ${tutor.settingsSection()}
  <p class="sec-title">Sauvegarde</p>
  <div class="card">
    <p class="muted small" style="margin:0 0 12px">Tes progrès sont enregistrés dans le téléphone. Fais une sauvegarde de temps en temps (fichier à garder dans « Fichiers » ou iCloud).</p>
    <div class="actions" style="margin-top:0">
      <button class="btn ghost" data-act="export">⬇️ Exporter mes progrès</button>
      <button class="btn ghost" data-act="import">⬆️ Importer une sauvegarde</button>
      <button class="btn ghost" data-act="reset" style="color:var(--ko)">Tout effacer</button>
    </div>
    <input type="file" id="impfile" accept=".json,application/json" hidden>
  </div>
  <p class="muted small" style="text-align:center;margin-top:24px">Xué v3.0 · ${WORDS.length} mots HSK 1-3 · Mémoire FSRS</p>`;
}
after.settings = () => {
  tutor.afterSettings();
  app.querySelectorAll('[data-set]').forEach(el => {
    el.addEventListener('change', () => {
      const k = el.dataset.set; let v = el.type === 'checkbox' ? el.checked : el.value;
      if (['newPerLesson', 'newPerDay', 'goalMin', 'rate'].includes(k)) v = +v;
      S().settings[k] = v; st.save();
      toast('Enregistré ✓');
    });
  });
  document.getElementById('impfile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { st.importData(await f.text()); toast('Sauvegarde importée ✓'); render(); }
    catch (err) { toast('Fichier invalide'); }
  });
};
actions.export = async () => {
  const name = `xue-sauvegarde-${st.dayKey()}.json`;
  const blob = new Blob([st.exportData()], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sauvegarde Xué' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
actions.import = () => document.getElementById('impfile').click();
actions.reset = () => {
  if (!confirm('Effacer TOUS tes progrès ? Cette action est irréversible.')) return;
  if (!confirm('Vraiment sûr ? Pense à exporter une sauvegarde avant.')) return;
  st.resetAll(); tab = 'home'; render();
};

// ================================================================
//  Démarrage
// ================================================================
document.addEventListener('visibilitychange', () => { if (document.hidden) { st.save(true); if (sess) logTime(); } else if (sess) sess.tItem = Date.now(); });
render();
window.__xue = { get sess() { return sess; }, st }; // accès de débogage (console)
// rafraîchit l'accueil si l'appli reste ouverte d'un jour à l'autre
setInterval(() => { if (!sess && tab === 'home' && !document.hidden) render(); }, 5 * 60000);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
