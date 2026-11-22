import { WORDS, WORD_BY_ID } from './data.js';
import { SENTENCES, SENT_BY_ID } from './sentences.js';
import * as st from './store.js';
import { speak, sfx, voiceName } from './audio.js';
import { syllables, parseSyl, checkPinyin, numToMarks, toneAccepted, toneSvg, TONE_NAME } from './pinyin.js';
import { recallNow, recallIn7 } from './fsrs.js';
import { esc, shuffle, pct, toast, ruby, face, pyHtml, sentHtml, actions, dispatchClick, ui, closeModal, levelLabel } from './ui.js';
import * as tutor from './tutor.js';
import * as pron from './pron.js';
import * as exam from './exam.js';
import * as oral from './oral.js';
import { openMic, closeMic, recordAuto, analyzeWord, spokenTones } from './pitch.js';
import { transcribe, hasKey } from './ai.js';

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

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  words: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5zM13 3h5.5A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5H13z"/>',
  ai: '<path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4z"/><path d="M9 10h.01M15 10h.01" stroke-width="3"/>',
  stats: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
};
const icon = (k) => `<svg class="ico" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
function nav() {
  const items = [['home', 'Accueil'], ['words', 'Mots'], ['ai', 'Prof IA'], ['stats', 'Progrès'], ['settings', 'Réglages']];
  return `<nav class="nav">${items.map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${icon(k)}${l}</button>`).join('')}</nav>`;
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
  const oral = st.isOral();
  const due = st.dueCards(), sdue = st.dueSentences();
  const pace = st.smartPace();
  const newW = st.nextNewWords(pace.n);
  const newS = st.nextNewSentences(s.settings.newSentences, newW.map(w => w.id));
  const mins = Math.floor(t.secs / 60), goal = s.settings.goalMin;
  const paceMsg = pace.why === 'fast' ? `🚀 ${Math.round(pace.acc * 100)} % de réussite : on accélère` : pace.why === 'slow' ? '🧠 On consolide : moins de mots nouveaux' : pace.why === 'pause' ? '🧠 Révisions d\'abord : pas de mot nouveau' : '';
  const lv = st.level();
  const streak = st.currentStreak();
  const introduced = Object.keys(s.intro).length;
  const C = 2 * Math.PI * 26, frac = Math.min(1, mins / goal);
  const leftNew = WORDS.length - introduced;
  const nRev = Math.min(due.length, newW.length ? 12 : 25) + Math.min(sdue.length, newW.length ? 6 : 12);
  const hour = new Date().getHours();
  const [hello, helloPy] = hour < 5 || hour >= 18 ? ['晚上好', 'wǎn shang hǎo'] : hour < 12 ? ['早上好', 'zǎo shang hǎo'] : ['你好', 'nǐ hǎo'];

  const ring = `<div class="ring">
      <svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="6"/>
      <circle cx="32" cy="32" r="26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
      <div class="lbl"><div>${mins}<small>/${goal} min</small></div></div></div>`;
  let hero;
  if (newW.length || due.length || sdue.length || newS.length) {
    const chips = [newW.length && `${newW.length} mots`, newS.length && `${newS.length} phrases`, nRev && `${nRev} révisions`].filter(Boolean);
    hero = `<div class="hero">
      <div class="hero-top"><div class="grow"><span class="eyebrow">Leçon du jour</span>
        <h2>${introduced ? 'On continue ?' : 'Première leçon'}</h2>
        <div class="hero-chips">${chips.map(c => `<span>${c}</span>`).join('')}</div>${paceMsg ? `<div class="hero-pace">${paceMsg}</div>` : ''}</div>${ring}</div>
      <button class="btn white" data-act="start" data-mode="lesson">${introduced ? 'Continuer' : 'Commencer'}<span class="arrow">→</span></button>
    </div>`;
  } else {
    hero = `<div class="hero"><div class="hero-top"><div class="grow"><span class="eyebrow">Leçon du jour</span><h2>Tout est à jour 🎉</h2>
      <p class="hero-sub">${leftNew ? 'Limite de nouveaux mots atteinte. Entraîne-toi librement ci-dessous.' : 'Tu as vu tous les mots du HSK 3 !'}</p></div>${ring}</div></div>`;
  }
  const tile = (act, mode, ic, color, title, sub, badge = '') => `<button class="tile" data-act="${act}" ${mode ? `data-${act === 'tab' ? 'tab' : 'mode'}="${mode}"` : ''}>
      <span class="tic" style="--c:${color}">${ic}</span><span class="grow"><b>${title}</b><span class="sub">${sub}</span></span>${badge}</button>`;
  const sSeen = Object.keys(s.sintro).length;
  const tiles = [
    tile('start', 'parler', '🗣️', '#1F9D55', 'Parler', 'Dis-le à voix haute', s.settings.speaking && due.some(d => d.f === 'parler') ? `<span class="badge">${due.filter(d => d.f === 'parler').length}</span>` : ''),
    tile('start', 'review', '🔁', '#E5484D', 'Révisions', 'Les mots à revoir', due.length ? `<span class="badge">${due.length}</span>` : ''),
    tile('start', 'phrases', '💬', '#3E7BFA', 'Phrases', sSeen ? `${sSeen} phrases vues` : 'Phrases du quotidien', sdue.length ? `<span class="badge">${sdue.length}</span>` : ''),
    tile('start', 'ecoute', '👂', '#8B5CF6', 'Écoute', "Comprendre à l'oral"),
    tile('start', 'ton', '🎵', '#F59E0B', 'Tons', 'Entraîne ton oreille'),
    tile('pron', '', '🎙️', '#10B981', 'Prononciation', 'Ta courbe de tons'),
    tile('start', 'dictee', '🎧', '#0EA5E9', 'Dictée', 'Écrire ce que tu entends'),
    ...(oral ? [] : [
      tile('start', 'pinyin', '⌨️', '#64748B', 'Pinyin', 'Écrire la prononciation'),
      tile('start', 'trace', '✍️', '#B45309', 'Écriture', 'Tracer les caractères'),
    ]),
    tile('exam', '', '📝', '#DB2777', 'Examen HSK', 'Examen blanc noté'),
    tile('tab', 'ai', '🤖', '#0F766E', 'Prof IA', 'Jeux de rôle, histoires'),
  ].join('');
  const lvls = [1, 2, 3].map(l => {
    const ws = WORDS.filter(w => w.lvl === l);
    const seen = ws.filter(w => s.intro[w.id]).length;
    const solid = ws.filter(w => st.mastery(w.id) >= 0.6).length;
    return `<div class="prog"><span class="lab">HSK ${l}</span><span class="track"><i class="a" style="width:${(seen / ws.length) * 100}%"></i><i class="b" style="width:${(solid / ws.length) * 100}%"></i></span><span class="num">${seen}/${ws.length}</span></div>`;
  }).join('');

  return `
  <div class="topbar">
    <div class="grow"><div class="hello-py">${pyHtml(helloPy, false)}</div><div class="hello hzf">${hello}</div></div>
    <span class="pill ${streak ? 'fire' : 'dim'}" title="Série de jours">🔥 ${streak}</span>
    <span class="pill" title="Niveau ${lv.n} · ${lv.into}/${lv.need} XP">⭐ ${s.xp}</span>
  </div>
  ${hero}
  <p class="sec-title">S'entraîner</p>
  <div class="tiles">${tiles}</div>
  <p class="sec-title">Progression HSK</p>
  <div class="card">${lvls}<p class="muted small" style="margin:6px 0 0">Clair : mots vus · Foncé : mots bien ancrés · Niveau ${lv.n}</p></div>`;
}

// ================================================================
//  Sessions d'exercices
// ================================================================
const PRACTICE = { sens: 15, ton: 15, ecoute: 15, trace: 8, pinyin: 12, dictee: 12 };
const FACET_OF = { dictee: 'ecoute' };
actions.pron = () => pron.openLab();
actions.recalib = () => { pron.recalibrate(); toast('Le calibrage sera refait au prochain atelier'); render(); };
actions.exam = () => exam.chooseLevel();

// mélange régulièrement les éléments de b dans a
function interleave(a, b) {
  if (!b.length) return a;
  const out = [], step = Math.max(1, Math.floor(a.length / (b.length + 1)));
  let j = 0;
  a.forEach((x, i) => { out.push(x); if ((i + 1) % step === 0 && j < b.length) out.push(b[j++]); });
  return out.concat(b.slice(j));
}

// bloc d'apprentissage des nouvelles phrases : présentation + construction, puis écoute un peu plus tard
function sentenceBlock(newS) {
  const first = [], later = [];
  newS.forEach(x => { first.push({ k: 'sintro', sid: x.id }); if (x.toks.filter(t => !t.punct).length >= 2) first.push({ k: 'sx', sid: x.id, f: 'construire' }); });
  newS.forEach(x => later.push({ k: 'sx', sid: x.id, f: 'ecoute' }));
  if (S().settings.speaking) newS.forEach(x => later.push({ k: 'sx', sid: x.id, f: 'parler' }));
  return { first, later };
}

function startSession(mode) {
  const s = S();
  const facets = st.activeFacets();
  let q = [];
  if (mode === 'lesson') {
    const newW = st.nextNewWords(st.smartPace().n);
    const newS = st.nextNewSentences(s.settings.newSentences, newW.map(w => w.id));
    const due = st.dueCards(), sdue = st.dueSentences();
    const rev = [];
    // mots souvent oubliés : on les réexplique (une fois tous les 3 jours) avant de les retester
    for (const d of due.slice(0, newW.length ? 12 : 25)) {
      if (d.c.lapses >= 4 && Date.now() - (s.reteach[d.wid] || 0) > 3 * 86400000 && !rev.some(x => x.k === 'intro' && x.wid === d.wid)) {
        rev.push({ k: 'intro', wid: d.wid, reteach: true });
      }
      rev.push({ k: 'ex', wid: d.wid, f: d.f });
    }
    const srev = sdue.slice(0, newW.length ? 6 : 12).map(d => ({ k: 'sx', sid: d.sid, f: d.f }));
    const mixed = interleave(rev, srev);
    for (let i = 0; i < newW.length; i += 2) {
      const grp = newW.slice(i, i + 2);
      grp.forEach(w => { q.push({ k: 'intro', wid: w.id }); q.push({ k: 'ex', wid: w.id, f: 'sens' }); });
      for (const f of facets.slice(1)) {
        grp.forEach(w => q.push({ k: 'ex', wid: w.id, f }));
        if (mixed.length) q.push(mixed.shift());
      }
    }
    const sb = sentenceBlock(newS);
    q.push(...sb.first);
    q.push(...interleave(mixed, sb.later));
    if (!q.length) return toast('Rien à faire pour le moment ✨');
  } else if (mode === 'review') {
    q = st.dueCards().slice(0, 40).map(d => ({ k: 'ex', wid: d.wid, f: d.f }));
    if (!q.length) return toast('Aucune révision pour le moment ✨');
  } else if (mode === 'hard') {
    const fs = ['sens', 'ecoute', ...(st.speakingOn() ? ['parler'] : [])];
    const ws = hardList().map(([id]) => id);
    if (!ws.length) return toast('Aucun mot difficile pour le moment ✨');
    for (const f of fs) q.push(...shuffle([...ws]).map(wid => ({ k: 'ex', wid, f })));
  } else if (mode === 'parler') {
    if (!s.settings.speaking) { s.settings.speaking = true; st.save(); }
    s.speakPause = 0;
    const known = Object.keys(s.intro).filter(id => W(id));
    if (known.length < 4) return toast('Apprends d\'abord quelques mots dans la leçon du jour');
    const now = Date.now();
    const wd = st.dueCards().filter(d => d.f === 'parler').slice(0, 6).map(d => ({ k: 'ex', wid: d.wid, f: 'parler' }));
    const sd = st.dueSentences().filter(d => d.f === 'parler').slice(0, 6).map(d => ({ k: 'sx', sid: d.sid, f: 'parler' }));
    const have = new Set([...wd.map(x => x.wid), ...sd.map(x => x.sid)]);
    // on complète avec les mots et phrases les plus fragiles à l'oral
    const fillW = known.filter(id => !have.has(id)).map(id => ({ id, r: recallNow(st.getCard(id, 'parler'), now) + Math.random() * 0.25 }))
      .sort((a, b) => a.r - b.r).slice(0, Math.max(0, 7 - wd.length)).map(x => ({ k: 'ex', wid: x.id, f: 'parler' }));
    const seenS = Object.keys(s.sintro).filter(id => SENT_BY_ID[id] && !have.has(id));
    const fillS = seenS.map(id => ({ id, r: recallNow(st.getSCard(id, 'parler'), now) + Math.random() * 0.25 }))
      .sort((a, b) => a.r - b.r).slice(0, Math.max(0, 6 - sd.length)).map(x => ({ k: 'sx', sid: x.id, f: 'parler' }));
    q = interleave([...wd, ...fillW], [...sd, ...fillS]);
  } else if (mode === 'phrases') {
    const seen = Object.keys(s.sintro).filter(id => SENT_BY_ID[id]);
    const due = st.dueSentences().slice(0, 14).map(d => ({ k: 'sx', sid: d.sid, f: d.f }));
    const newS = st.nextNewSentences(due.length >= 8 ? 2 : 4);
    const sb = sentenceBlock(newS);
    let extra = [];
    if (due.length + newS.length * 2 < 10 && seen.length) {
      // pas assez de révisions dues : on reprend les phrases les plus fragiles
      const dueIds = new Set(due.map(d => d.sid + d.f));
      extra = seen.flatMap(id => st.SFACETS.map(f => ({ sid: id, f, r: recallNow(st.getSCard(id, f)) + Math.random() * 0.2 })))
        .filter(x => !dueIds.has(x.sid + x.f)).sort((a, b) => a.r - b.r).slice(0, 10 - due.length)
        .map(x => ({ k: 'sx', sid: x.sid, f: x.f }));
    }
    q = [...sb.first, ...interleave([...due, ...extra], sb.later)];
    if (!q.length) return toast('Apprends d\'abord quelques mots : les phrases arrivent avec eux');
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
  sess = { mode, q, i: 0, total: q.length, ok: 0, ko: 0, xp: 0, combo: 0, best: 0, t0: Date.now(), tItem: Date.now(), learned: [], slearned: [], state: null };
  render();
}

function quitSession() {
  if (sess && sess.i > 0 && !confirm('Quitter la session ? Tes réponses sont déjà enregistrées.')) return;
  clearTimeout(sess?.state?.auto);
  sess?.state?.sp?.rec?.stop();
  closeMic();
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
  const w = it.wid ? W(it.wid) : null, sn = it.sid ? SENT_BY_ID[it.sid] : null;
  if ((it.wid && !w) || (it.sid && !sn)) { sess.i++; return renderSession(); }
  if (it.f === 'parler' && (!st.speakingOn() || sess.noMic)) { sess.i++; return renderSession(); }
  sess.state = { item: it, w, sn, answered: false, t: Date.now() };
  let body;
  if (it.k === 'intro') body = introView(w);
  else if (it.k === 'sintro') body = sIntroView(sn);
  else if (it.k === 'sx') body = SEX[it.f].view(sn, it);
  else body = EX[it.v || it.f].view(w, it);
  app.innerHTML = `<div class="sess">${sessTop()}<div class="sess-body">${body}</div></div>`;
  if (it.k === 'intro') introAfter(w);
  else if (it.k === 'sintro') sIntroAfter(sn);
  else if (it.k === 'sx') SEX[it.f].after?.(sn, it);
  else EX[it.v || it.f].after?.(w, it);
}

// boutons d'écoute (normal + lent)
const spk = (text, big) => `<button class="spk ${big ? 'big' : ''}" data-act="speak" data-text="${esc(text)}" aria-label="Écouter">🔊</button><button class="spk slow" data-act="speak" data-slow="1" data-text="${esc(text)}" aria-label="Écouter lentement">🐢</button>`;

// phrase d'exemple contenant le mot (la plus courte)
function exampleFor(w) {
  return SENTENCES.filter(x => x.toks.some(t => t.wid === w.id) && x.toks.length > 1).sort((a, b) => a.toks.length - b.toks.length)[0];
}

// ---------- Nouveau mot ----------
function introView(w) {
  const tones = syllables(w.p).map(parseSyl).filter(x => x.hasVowel);
  const ex = exampleFor(w);
  const oral = st.isOral();
  const re = sess?.state?.item?.reteach;
  return `<span class="q-tag ${re ? 'gold' : ''}">${re ? 'Mot difficile · on le revoit' : 'Nouveau mot · ' + levelLabel(w)}</span>
  <div class="prompt intro">${oral ? face(w) : ruby(w, true)}
    <div class="fr">${esc(w.f)}</div>
    <div>${spk(w.h)}</div>
  </div>
  ${oral ? '' : '<div class="writers" id="writers"></div>'}
  <div class="intro-tones">${tones.map(t => `<div class="t${t.tone}">${toneSvg(t.tone, 30)}<span>${TONE_NAME[t.tone]}</span></div>`).join('')}</div>
  ${ex ? `<button class="example" data-act="speak" data-text="${esc(ex.text)}"><span class="eyebrow">Exemple 🔊</span>${sentHtml(ex)}<span class="small muted">${esc(ex.fr)}</span></button>` : ''}
  ${re && S().settings.groqKey ? `<button class="btn ghost" data-act="explain" data-id="${esc(w.id)}" style="margin-top:10px">🤖 Une astuce pour le retenir</button>` : ''}
  <div class="actions" style="margin-top:auto"><button class="btn" data-act="introok">J'ai compris</button></div>`;
}
function introAfter(w) {
  if (sess.state.item.reteach) { S().reteach[w.id] = Date.now(); st.save(); setTimeout(() => speak(w.h), 250); return; }
  st.introduce(w.id);
  st.today().nw++;
  sess.learned.push(w.id);
  st.save();
  setTimeout(() => speak(w.h), 250);
  if (!st.isOral()) mountWriters(document.getElementById('writers'), w.h, 'animate');
}
actions.introok = () => { logTime(); sess.i++; renderSession(); };

// ---------- Nouvelle phrase ----------
function sIntroView(sn) {
  return `<span class="q-tag blue">Nouvelle phrase</span>
  <div class="prompt sprompt">${sentHtml(sn, { tap: true })}
    <div class="fr">${esc(sn.fr)}</div>
    <div>${spk(sn.text)}</div>
  </div>
  <div class="gloss" id="gloss">Touche un mot pour voir son sens</div>
  <div class="actions" style="margin-top:auto"><button class="btn" data-act="introok">Suivant</button></div>`;
}
function sIntroAfter(sn) {
  st.introduceSentence(sn.id);
  sess.slearned.push(sn.id);
  st.save();
  setTimeout(() => speak(sn.text), 250);
}
actions.gloss = (el) => {
  const sn = sess?.state?.sn; if (!sn) return;
  const t = sn.toks[+el.dataset.i];
  document.querySelectorAll('.tk.on').forEach(x => x.classList.remove('on'));
  el.classList.add('on');
  const g = document.getElementById('gloss');
  if (g) g.innerHTML = `<b class="hzf">${esc(t.h)}</b> <span>${pyHtml(t.p, false)}</span> : ${esc(t.f || '—')}`;
  speak(t.h);
};

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

const pinyinKeys = () => `<div class="keys">${[1, 2, 3, 4, 5].map(t => `<button class="opt" data-act="key" data-k="${t}">${t}<small>${t === 5 ? 'neutre' : ['ā', 'á', 'ǎ', 'à'][t - 1]}</small></button>`).join('')}<button class="opt" data-act="key" data-k="v">ü</button></div>`;

// ---------- Exercices sur les mots ----------
const EX = {
  parler: { view: (w, it) => speakView(w, it), after: (w) => speakAfter(w) },
  sens: {
    view(w) {
      const c = st.getCard(w.id, 'sens');
      const reverse = c && c.reps >= 2 && Math.random() < 0.5;
      const opts = shuffle([w, ...distractors(w, 3)]);
      sess.state.opts = opts;
      if (!reverse) {
        return `<span class="q-tag">Sens</span><p class="q-label">Que signifie ce mot ?</p>
          <div class="prompt">${face(w, st.showPinyin(w.id))}<div>${spk(w.h)}</div></div>
          <div class="opts">${opts.map((o, i) => `<button class="opt" data-act="mcq" data-i="${i}">${esc(o.f)}</button>`).join('')}</div>`;
      }
      return `<span class="q-tag">Sens</span><p class="q-label">Comment dit-on…</p>
        <div class="prompt"><div class="fr big">« ${esc(w.f)} »</div></div>
        <div class="opts two">${opts.map((o, i) => `<button class="opt" data-act="mcq" data-i="${i}">${face(o, st.showPinyin(o.id))}</button>`).join('')}</div>`;
    },
  },
  ecoute: {
    view(w) {
      const oral = st.isOral();
      const opts = shuffle([w, ...distractors(w, 3, 'sound')]);
      sess.state.opts = opts;
      return `<span class="q-tag">Écoute</span><p class="q-label">${oral ? 'Que veut dire ce mot ?' : 'Qu\'est-ce que tu entends ?'}</p>
        <div class="prompt">${spk(w.h, true)}</div>
        <div class="opts ${oral ? '' : 'two'}">${opts.map((o, i) => `<button class="opt" data-act="mcq" data-i="${i}">${oral ? esc(o.f) : ruby(o, st.showPinyin(o.id))}</button>`).join('')}</div>`;
    },
    after(w) { setTimeout(() => speak(w.h), 300); },
  },
  ton: {
    view(w) {
      const chars = [...w.h], syls = syllables(w.p).map(parseSyl);
      sess.state.sel = syls.map(s => (s.hasVowel ? 0 : -1));
      const rows = syls.map((s, i) => !s.hasVowel ? '' : `<div class="tone-row">
        <div class="syl"><b>${s.base.replace(/v/g, 'ü')}</b><span class="hzf">${chars[i]}</span></div>
        <div class="tone-btns">${[1, 2, 3, 4, 5].map(t => `<button class="opt t${t}" data-act="tonepick" data-s="${i}" data-t="${t}">${toneSvg(t, 24)}<small>${t === 5 ? 'neutre' : t}</small></button>`).join('')}</div>
      </div>`).join('');
      return `<span class="q-tag">Tons</span><p class="q-label">Quel ton entends-tu ?</p>
        <div class="prompt" style="padding:4px 0 10px">${spk(w.h, true)}
        <div class="muted small">${esc(w.f)}</div></div>
        <div class="tone-rows">${rows}</div>`;
    },
    after(w) { setTimeout(() => speak(w.h), 300); },
  },
  pinyin: {
    view(w) {
      return `<span class="q-tag">Pinyin</span><p class="q-label">Écris le pinyin avec les tons</p>
        <div class="prompt" style="padding-bottom:10px">${ruby(w, false)}<div class="muted">${esc(w.f)}</div></div>
        <input id="pyin" class="pyin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ex : ni3 hao3" enterkeyhint="done">
        <div class="pyprev" id="pyprev"></div>
        ${pinyinKeys()}
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
        <div class="prompt" style="padding:4px 0 10px">${spk(w.h, true)}</div>
        <input id="pyin" class="pyin" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ex : ni3 hao3" enterkeyhint="done">
        <div class="pyprev" id="pyprev"></div>
        ${pinyinKeys()}
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

// ---------- Exercices sur les phrases ----------
// phrases distractrices : de préférence déjà vues et qui partagent des mots (plus confusantes)
function sentDistractors(sn, n) {
  const words = new Set(sn.toks.map(t => t.h));
  return shuffle(SENTENCES.filter(x => x.id !== sn.id && x.fr !== sn.fr).map(x => ({
    x, sc: Math.random() * 2 + (S().sintro[x.id] ? 2 : 0) + x.toks.filter(t => words.has(t.h)).length * 1.5 - Math.abs(x.toks.length - sn.toks.length) * 0.3,
  })).sort((a, b) => b.sc - a.sc).slice(0, n + 3)).slice(0, n).map(o => o.x);
}
const tileHtml = (t, i, where) => `<button class="wtile" data-act="${where}" data-i="${i}"><span class="tpy">${pyHtml(t.p)}</span><span class="thz hzf">${esc(t.h)}</span></button>`;

const SEX = {
  parler: { view: (sn, it) => speakView(sn, it), after: (sn) => speakAfter(sn) },
  ecoute: {
    view(sn) {
      const opts = shuffle([sn, ...sentDistractors(sn, 3)]);
      sess.state.opts = opts;
      return `<span class="q-tag blue">Phrase · Écoute</span><p class="q-label">Que veut dire cette phrase ?</p>
        <div class="prompt">${spk(sn.text, true)}</div>
        <div class="opts">${opts.map((o, i) => `<button class="opt left" data-act="mcq" data-i="${i}">${esc(o.fr)}</button>`).join('')}</div>`;
    },
    after(sn) { setTimeout(() => speak(sn.text), 300); },
  },
  construire: {
    view(sn) {
      const need = sn.toks.filter(t => !t.punct);
      const have = new Set(need.map(t => t.h));
      // 2 mots pièges pris dans d'autres phrases
      const pool = shuffle(SENTENCES.flatMap(x => x.toks)).filter(t => !t.punct && !have.has(t.h));
      const traps = [];
      for (const t of pool) { if (!traps.some(x => x.h === t.h)) traps.push(t); if (traps.length === 2) break; }
      const bank = shuffle([...need, ...traps]);
      sess.state.bank = bank; sess.state.pick = []; sess.state.need = need;
      return `<span class="q-tag blue">Phrase · Construire</span><p class="q-label">Traduis en chinois</p>
        <div class="prompt" style="padding:6px 0 12px"><div class="fr big">« ${esc(sn.fr)} »</div></div>
        <div class="build-ans" id="bans"><span class="ph">Touche les mots dans l'ordre</span></div>
        <div class="bank" id="bank">${bank.map((t, i) => tileHtml(t, i, 'bpick')).join('')}</div>
        <div class="actions" style="margin-top:auto">
          <button class="btn" id="bgo" data-act="bgo" disabled>Vérifier</button>
          <button class="btn ghost" data-act="dunno">Je ne sais pas</button>
        </div>`;
    },
  },
};
function drawBuild() {
  const st_ = sess.state;
  const ans = document.getElementById('bans'), bank = document.getElementById('bank');
  ans.innerHTML = st_.pick.length ? st_.pick.map((bi, k) => tileHtml(st_.bank[bi], k, 'bdrop')).join('') : '<span class="ph">Touche les mots dans l\'ordre</span>';
  bank.querySelectorAll('.wtile').forEach((b, i) => b.classList.toggle('used', st_.pick.includes(i)));
  document.getElementById('bgo').disabled = st_.pick.length !== st_.need.length;
}
actions.bpick = (el) => {
  const st_ = sess.state; if (st_.answered) return;
  const i = +el.dataset.i; if (st_.pick.includes(i)) return;
  st_.pick.push(i); speak(st_.bank[i].h); drawBuild();
};
actions.bdrop = (el) => { const st_ = sess.state; if (st_.answered) return; st_.pick.splice(+el.dataset.i, 1); drawBuild(); };
actions.bgo = () => {
  const st_ = sess.state; if (st_.answered) return;
  const got = st_.pick.map(i => st_.bank[i].h).join('');
  const ok = got === st_.need.map(t => t.h).join('');
  document.getElementById('bans').classList.add(ok ? 'right' : 'wrong');
  answer(ok, undefined, ok ? '' : 'Ta réponse : ' + st_.pick.map(i => st_.bank[i].p.replace(/\s/g, '')).join(' '));
};

actions.mcq = (el) => {
  if (sess.state.answered) return;
  const i = +el.dataset.i, opts = sess.state.opts, target = sess.state.w || sess.state.sn;
  const ok = opts[i].id === target.id;
  document.querySelectorAll('.opt[data-act=mcq]').forEach((b, j) => {
    if (opts[j].id === target.id) b.classList.add('right');
    else if (j === i) b.classList.add('wrong');
  });
  answer(ok);
};
actions.tonepick = (el) => {
  if (sess.state.answered) return;
  const s = +el.dataset.s, t = +el.dataset.t;
  sess.state.sel[s] = t;
  el.parentElement.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', b === el));
  // vérification automatique dès que chaque syllabe a un ton
  clearTimeout(sess.state.toneT);
  if (!sess.state.sel.some(x => x === 0)) sess.state.toneT = setTimeout(actions.tonego, 280);
};
actions.tonego = () => {
  if (sess.state.answered) return;
  const w = sess.state.w, chars = [...w.h];
  const syls = syllables(w.p).map(parseSyl);
  let ok = true;
  syls.forEach((s, i) => {
    if (!s.hasVowel) return;
    const good = toneAccepted(chars[i], s.tone, sess.state.sel[i]);
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


// ================================================================
//  Expression orale : « Dis-le en chinois » et « Répète »
// ================================================================
// mode répétition (on voit et on entend le modèle) la première fois, puis production (on ne voit que le français)
function speakMode(card, it) { return !card || card.reps === 0 || it.retry ? 'repeat' : 'produce'; }
function speakView(target, it) {
  const isS = !target.h;
  const card = isS ? st.getSCard(target.id, 'parler') : st.getCard(target.id, 'parler');
  const mode = speakMode(card, it);
  sess.state.sp = { mode, hint: mode === 'repeat', phase: 'idle' };
  const text = isS ? target.text : target.h;
  const shown = isS ? sentHtml(target) : face(target);
  const fr = isS ? target.fr : target.f;
  return `<span class="q-tag green">${isS ? 'Phrase · ' : ''}Parler</span>
    <p class="q-label">${mode === 'repeat' ? 'Écoute, puis répète à voix haute' : 'Dis-le en chinois'}</p>
    <div class="prompt ${isS ? 'sprompt' : ''}">
      ${mode === 'repeat' ? `${shown}<div class="muted" style="margin-top:8px">${esc(fr)}</div><div>${spk(text)}</div>`
        : `<div class="fr big">« ${esc(fr)} »</div><div id="sphint" class="sphint"><button class="chip" data-act="shint">💡 Indice</button></div>`}
    </div>
    <div class="spres" id="spres"></div>
    <div class="actions" style="margin-top:auto" id="spact">
      <button class="micbig" id="micbig" data-act="srec"><span class="mi">🎙️</span><span id="miclbl">Touche et parle</span></button>
      <button class="linkbtn" data-act="snospeak">Je ne peux pas parler maintenant</button>
    </div>`;
}
function speakAfter(target) {
  if (sess.state.sp.mode === 'repeat') setTimeout(() => speak(target.h || target.text), 300);
}
actions.shint = () => {
  const stt = sess.state, t = stt.w || stt.sn; if (!stt.sp) return;
  stt.sp.hint = true;
  document.getElementById('sphint').innerHTML = `${stt.sn ? sentHtml(stt.sn) : face(stt.w)}<div>${spk(stt.sn ? stt.sn.text : stt.w.h)}</div>`;
};
actions.snospeak = () => {
  S().speakPause = Date.now() + 30 * 60000; st.save();
  toast('OK, pas d\'oral pendant 30 minutes 🤫');
  sess.i++; renderSession();
};
actions.srec = async () => {
  const stt = sess.state, sp = stt.sp; if (!sp || stt.answered || sp.phase === 'busy') return;
  if (sp.phase === 'rec') { sp.rec?.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { sess.noMic = true; toast('Micro non disponible sur cet appareil'); sess.i++; return renderSession(); }
  try { await openMic(); } catch (e) { sess.noMic = true; toast('Autorise le micro pour Xué (Safari : aA → Réglages du site)', 4000); sess.i++; return renderSession(); }
  speechSynthesis?.cancel?.();
  const isS = !!stt.sn;
  const btn = document.getElementById('micbig');
  sp.phase = 'rec'; btn.classList.add('on'); document.getElementById('miclbl').textContent = 'Je t\'écoute…';
  sp.rec = await recordAuto({ maxMs: isS ? 9000 : 4000, silenceMs: isS ? 1300 : 900, onLevel: (l) => btn.style.setProperty('--lv', l.toFixed(2)) });
  const blob = await sp.rec.done;
  if (sess?.state !== stt) return;
  sp.phase = 'busy'; btn.classList.remove('on'); btn.classList.add('busy'); document.getElementById('miclbl').textContent = 'Analyse…';
  if (sp.url) URL.revokeObjectURL(sp.url);
  sp.url = URL.createObjectURL(blob);
  await evalSpeech(blob, sp.rec.ext);
};
actions.splay = () => { const u = sess?.state?.sp?.url; if (u) new Audio(u).play().catch(() => {}); };

async function evalSpeech(blob, ext) {
  const stt = sess.state, sp = stt.sp, isS = !!stt.sn;
  const target = isS ? oral.targetOfSentence(stt.sn) : oral.targetOfWord(stt.w);
  // tons de la voix (mots seulement : sur une phrase, l'analyse serait trop approximative)
  let pitch = null;
  if (!isS) {
    const tones = syllables(stt.w.p).map(parseSyl).filter(x => x.hasVowel).map(x => x.tone);
    pitch = await analyzeWord(blob, tones, S().voice?.base).catch(() => null);
    if (pitch?.error) pitch = null;
  }
  const pitchOk = pitch ? pitch.syl.filter(x => x.ok != null).every(x => x.ok) : false;
  const toneChips = pitch ? `<div class="small muted">Ta courbe de tons :</div><div class="sylrow">${pitch.syl.map((x, k) => {
    const py = target.filter(t => parseSyl(t.p).hasVowel)[k]?.p || '';
    return x.ok == null ? `<span class="sylres">${esc(py)}</span>` : `<span class="sylres ${x.ok ? 'ok' : 'ko'}">${x.ok ? '✓' : '✗'} ${esc(py)}${x.ok ? '' : `<small>entendu : ${x.got === 1 ? '1er' : x.got + 'e'} ton</small>`}</span>`;
  }).join('')}</div>` : '';
  let heard = null;
  if (hasKey()) heard = await transcribe(blob, ext).catch(() => null);
  if (sess?.state !== stt) return;
  if (heard != null) {
    const cmp = oral.compare(target, heard);
    const v = oral.verdict(cmp, { isSentence: isS, hint: sp.hint && sp.mode === 'produce', pitchOk });
    // Whisper a compris, mais ta courbe de voix suggère un autre ton : réussi, mais à surveiller
    if (!isS && v.ok && pitch && !pitchOk) { v.grade = 2; v.msg = 'Compris ! Mais ta courbe de voix ressemble à un autre ton : exagère-le un peu.'; }
    const marked = isS ? markedSentence(stt.sn, cmp.marks) : '';
    const extra = `<div class="heard"><span class="muted small">Whisper a entendu :</span> <b class="hzf">${esc(cmp.heard || '(rien)')}</b></div>${marked}${toneChips}
      <button class="chip" data-act="splay">▶ Ma voix</button>`;
    if (!isS && st.isOral() && pitch) recordToneVoice(pitch);
    answer(v.ok, v.ok ? v.grade : 1, v.msg, extra);
    return;
  }
  // sans clé Groq (ou hors connexion) : tu compares toi-même ta voix au modèle
  sp.phase = 'self';
  document.getElementById('spres').innerHTML = `<div class="card selfcheck"><b>Compare ta voix au modèle</b>
      <div class="row" style="justify-content:center;margin:10px 0"><button class="btn ghost sm" data-act="splay">▶ Ma voix</button><button class="btn ghost sm" data-act="speak" data-text="${esc(isS ? stt.sn.text : stt.w.h)}">🔊 Modèle</button></div>
      ${toneChips}
      ${hasKey() ? '' : '<p class="small muted" style="margin:8px 0 0">Connecte le prof IA (clé Groq gratuite) pour une correction automatique par Whisper.</p>'}</div>`;
  document.getElementById('spact').innerHTML = `<div class="row"><button class="btn ko" data-act="sself" data-ok="0">À revoir</button><button class="btn ok" data-act="sself" data-ok="1">C'était bien</button></div>`;
  if (pitch) recordToneVoice(pitch);
}
actions.sself = (el) => {
  const stt = sess.state; if (stt.answered) return;
  const ok = el.dataset.ok === '1';
  answer(ok, ok ? (stt.sp.hint && stt.sp.mode === 'produce' ? 2 : 3) : 1, '', '<button class="chip" data-act="splay">▶ Ma voix</button>');
};
// statistiques des tons à la voix (onglet Progrès)
function recordToneVoice(pitch) {
  if (sess.state.item.retry) return;
  const M = (S().toneVoice ||= [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  for (const x of pitch.syl) {
    if (x.ok == null) continue;
    const want = x.ok ? x.got : x.spoken;
    if (want >= 1 && want <= 4 && x.got >= 1 && x.got <= 4) M[want - 1][x.got - 1]++;
  }
}
// la phrase avec les mots mal compris en rouge
function markedSentence(sn, marks) {
  let k = 0;
  const html = sn.toks.filter(t => !t.punct).map(t => {
    const n = oral.targetOfSentence({ toks: [t] }).length;
    const ms = marks.slice(k, k + n); k += n;
    const cls = ms.every(m => m.sound && m.tone) ? 'ok' : ms.some(m => m.sound) ? 'mid' : 'ko';
    return `<span class="mk ${cls}">${pyHtml(t.p)}</span>`;
  }).join(' ');
  return `<div class="marked">${html}</div>`;
}

// ---------- Correction / notation ----------
function answer(ok, forcedGrade, note = '', extra = '') {
  const s = sess.state; if (s.answered) return;
  s.answered = true;
  const it = s.item, w = s.w, sn = s.sn;
  const secs = (Date.now() - s.t) / 1000;
  logTime();
  if (!it.retry) {
    const slow = sn ? 25 : (it.f === 'pinyin' || it.f === 'ton' || it.f === 'parler' || it.v ? 20 : 12);
    const g = forcedGrade ?? (ok ? (secs > slow ? 2 : 3) : 1);
    if (sn) st.gradeSentence(sn.id, it.f, ok ? Math.max(2, g) : 1);
    else st.grade(w.id, it.f, ok ? Math.max(2, g) : 1);
  }
  if (ok) {
    sess.combo++; sess.best = Math.max(sess.best, sess.combo);
    const gain = it.retry ? 5 : (sn ? 15 : 10) + Math.min(sess.combo - 1, 5);
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
  const text = sn ? sn.text : w.h;
  const sheet = document.createElement('div');
  sheet.className = 'sheet ' + (ok ? 'ok' : 'ko');
  const body = sn
    ? `<div class="ans col">${sentHtml(sn)}<div><b>${esc(sn.fr)}</b>${note ? `<div class="small muted">${esc(note)}</div>` : ''}</div></div>`
    : `<div class="ans">${face(w)}<div class="grow"><b>${esc(w.f)}</b>${note ? `<div class="small muted">${esc(note)}</div>` : ''}</div></div>`;
  sheet.innerHTML = `<div class="sheet-head"><h3>${ok ? praise[(Math.random() * praise.length) | 0] : 'Pas tout à fait…'}</h3>
    <span class="sheet-tools"><button class="spk sm" data-act="speak" data-text="${esc(text)}" aria-label="Réécouter">🔊</button>${w && S().settings.groqKey ? `<button class="spk sm" data-act="explain" data-id="${esc(w.id)}" aria-label="Explication par l'IA">🤖</button>` : ''}</span></div>
    ${body}${extra ? `<div class="extra">${extra}</div>` : ''}
    <button class="btn ${ok ? 'ok auto' : 'ko'}" data-act="next">Continuer</button>`;
  const sessEl = document.querySelector('.sess');
  sessEl.appendChild(sheet);
  sessEl.style.paddingBottom = sheet.offsetHeight + 16 + 'px';
  sheet.scrollIntoView({ block: 'end' });
  if (!(it.f === 'ecoute' && ok && !sn) && !(it.f === 'parler' && ok)) setTimeout(() => speak(text), 200);
  const top = document.querySelector('.sess-top');
  if (top) top.outerHTML = sessTop();
  // bonne réponse : on passe tout seul à la suite (sauf si tu touches la fiche)
  if (ok) {
    const delay = it.f === 'parler' ? 2800 : sn ? 2600 : 1400;
    s.auto = setTimeout(() => { if (sess && sess.state === s && !s.hold) actions.next(); }, delay);
    sheet.querySelector('.btn.auto').style.setProperty('--d', delay + 'ms');
    sheet.addEventListener('click', (e) => { if (!e.target.closest('[data-act=next]')) { s.hold = true; sheet.querySelector('.btn')?.classList.remove('auto'); } });
  }
}
actions.next = () => { clearTimeout(sess?.state?.auto); sess.i++; renderSession(); window.scrollTo(0, 0); };

// ---------- Fin de session ----------
function renderEnd() {
  logTime();
  const newStreak = st.touchStreak();
  const acc = sess.ok + sess.ko ? sess.ok / (sess.ok + sess.ko) : 1;
  const mins = Math.max(1, Math.round((Date.now() - sess.t0) / 60000));
  if (sess.ok + sess.ko > 0 && acc >= 0.9) { st.addXp(20); sess.xp += 20; }
  sfx.done();
  const learned = sess.learned.map(W);
  const slearned = sess.slearned.map(id => SENT_BY_ID[id]);
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
    ${learned.length ? `<div class="card" style="text-align:left"><b>Nouveaux mots appris</b><div class="row" style="flex-wrap:wrap;gap:14px;margin-top:10px">${learned.map(w => `<button data-act="speak" data-text="${esc(w.h)}" class="lw">${face(w)}</button>`).join('')}</div></div>` : ''}
    ${slearned.length ? `<div class="card" style="text-align:left"><b>Nouvelles phrases</b>${slearned.map(x => `<button class="srow" data-act="speak" data-text="${esc(x.text)}"><span class="fpy">${x.toks.filter(t => !t.punct).map(t => pyHtml(t.p)).join(' ')}</span><span class="small muted">${esc(x.fr)}</span></button>`).join('')}</div>` : ''}
  </div><div class="actions" style="margin-top:auto"><button class="btn" data-act="endok">Continuer</button></div></div>`;
  confetti();
  sess.finished = true;
}
actions.endok = () => { closeMic(); sess = null; tab = 'home'; render(); };

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
    <div class="chips">${[[0, 'Tous'], [1, 'HSK 1'], [2, 'HSK 2'], [3, 'HSK 3'], ...(WORDS.some(w => !w.lvl) ? [[4, 'Perso']] : []), [9, 'Appris'], [8, 'À renforcer'], [7, 'Phrases']].map(([v, l]) => `<button class="chip ${wlvl === v ? 'on' : ''}" data-act="wlvl" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="wlist" id="wlist"></div>`;
}
function fillWords() {
  const box = document.getElementById('wlist'); if (!box) return;
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s/g, '');
  const q = norm(wq);
  if (wlvl === 7) {
    const list = SENTENCES.filter(x => !q || x.text.includes(wq.trim()) || norm(x.toks.map(t => t.p).join('')).includes(q) || norm(x.fr).includes(q));
    box.innerHTML = list.map(x => {
      const seen = S().sintro[x.id], ready = st.sentenceReady(x);
      return `<button class="wrow srow2 ${seen ? '' : 'locked'}" data-act="speak" data-text="${esc(x.text)}"><span class="grow"><div class="fpy">${x.toks.filter(t => !t.punct).map(t => pyHtml(t.p)).join(' ')}</div><div class="hzf small muted">${esc(x.hz)}</div><div class="fr">${esc(x.fr)}</div></span><span class="dot ${seen ? 'l3' : ready ? 'l1' : ''}" title="${seen ? 'Déjà vue' : ready ? 'Prête à apprendre' : 'Bientôt (mots pas encore appris)'}"></span></button>`;
    }).join('') || '<p class="muted" style="padding:16px;text-align:center">Aucune phrase trouvée</p>';
    return;
  }
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
    if (st.isOral()) return `<button class="wrow" data-act="word" data-id="${esc(w.id)}"><span class="wpy">${pyHtml(w.p)}<small class="hzf">${esc(w.h)}</small></span><span class="grow fr">${esc(w.f)}</span><span class="dot ${cls}" title="${m < 0 ? 'Pas encore vu' : 'Maîtrise ' + pct(m)}"></span></button>`;
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
    <div style="text-align:center" class="mword">${st.isOral() ? face(w) : ruby(w, true).replace('class="hz"', 'class="hz" style="font-size:60px"')}
      <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(w.f)}</div>
      <div class="muted small">${levelLabel(w)}</div>
      <button class="spk" data-act="speak" data-text="${esc(w.h)}">🔊</button><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}">🐢</button>
    </div>
    ${st.isOral() ? '' : '<div class="writers" id="mwriters"></div>'}
    ${(() => { const ex = exampleFor(w); return ex ? `<button class="example" data-act="speak" data-text="${esc(ex.text)}"><span class="eyebrow">Exemple 🔊</span>${sentHtml(ex)}<span class="small muted">${esc(ex.fr)}</span></button>` : ''; })()}
    <button class="btn ghost" data-act="explain" data-id="${esc(w.id)}" style="margin-bottom:10px">🤖 Explique-moi ce mot</button>
    ${seen ? `<p class="sec-title">Mémoire dans 7 jours</p><div class="card">${meters}<p class="muted small" style="margin:8px 0 0">Chance de t'en souvenir dans une semaine sans réviser, pour chaque compétence.</p></div>` : '<p class="muted" style="text-align:center">Pas encore appris — il arrivera dans une prochaine leçon.</p>'}
    <button class="btn ghost" data-act="close">Fermer</button>
  </div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
  bg.addEventListener('click', (e) => { const el = e.target.closest('[data-act]'); if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e); });
  if (!st.isOral()) mountWriters(bg.querySelector('#mwriters'), w.h, 'animate', 96);
  speak(w.h);
}

// ================================================================
//  Progrès
// ================================================================
// État d'un mot : 0 pas vu · 1 découvert · 2 connu (≥ 70 % de chance de s'en souvenir dans 7 jours) · 3 maîtrisé
function wordTier(id) {
  if (!S().intro[id]) return 0;
  if (st.mastery(id) >= 0.5) return 3;
  let sum = 0, n = 0;
  for (const f of st.activeFacets()) { const c = st.getCard(id, f); if (c && c.reps) { sum += recallIn7(c); n++; } }
  return n && sum / n >= 0.7 ? 2 : 1;
}
const FACET_ICON = { sens: '🧠', ecoute: '👂', ton: '🎵', parler: '🗣️', pinyin: '⌨️', trace: '✍️' };
const FACET_HINT = { sens: 'Reconnaître le sens', ecoute: "Comprendre à l'oral", ton: 'Entendre les tons', parler: 'Le dire à voix haute', pinyin: 'Écrire le pinyin', trace: 'Tracer les caractères' };

function statsScreen() {
  const s = S(), ids = Object.keys(s.intro).filter(id => W(id));
  const tiers = [0, 0, 0, 0];
  const tierOf = {};
  for (const id of ids) { const t = wordTier(id); tierOf[id] = t; tiers[t]++; }
  const known = tiers[2] + tiers[3];
  const totalMin = Math.round(Object.values(s.days).reduce((a, d) => a + d.secs, 0) / 60);
  const goal = s.settings.goalMin;

  // ---- résumé
  const nextLvl = [1, 2, 3].find(l => WORDS.filter(w => w.lvl === l).some(w => (tierOf[w.id] || 0) < 2)) || 3;
  const lvlWords = WORDS.filter(w => w.lvl <= nextLvl);
  const lvlKnown = lvlWords.filter(w => (tierOf[w.id] || 0) >= 2).length;
  const hero = `<div class="pg-hero">
    <span class="eyebrow">Ton vocabulaire</span>
    <div class="pg-big"><b>${known}</b><span>mot${known > 1 ? 's' : ''} connu${known > 1 ? 's' : ''}</span></div>
    <p class="pg-sub">${ids.length} découverts · ${tiers[3]} maîtrisés · ${Object.keys(s.sintro).length} phrases</p>
    <div class="pg-goal"><div class="pg-goal-top"><span>Objectif HSK ${nextLvl}</span><b>${lvlKnown}/${lvlWords.length}</b></div>
      <span class="pg-gtrack"><i style="width:${(lvlKnown / lvlWords.length) * 100}%"></i></span></div>
  </div>`;

  // ---- petites tuiles
  let rev7 = 0, ok7 = 0;
  for (let i = 0; i < 7; i++) { const d = s.days[st.dayKey(Date.now() - i * 86400000)]; if (d) { rev7 += d.rev; ok7 += d.ok; } }
  const fmtTime = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`);
  const tiles = `<div class="pg-tiles">
    <div class="pg-tile"><span class="pg-ic">🔥</span><b>${st.currentStreak()}</b><span>jour${st.currentStreak() > 1 ? 's' : ''} de série</span></div>
    <div class="pg-tile"><span class="pg-ic">🎯</span><b>${rev7 ? pct(ok7 / rev7) : '—'}</b><span>réussite 7 j</span></div>
    <div class="pg-tile"><span class="pg-ic">⏱️</span><b>${fmtTime(totalMin)}</b><span>au total</span></div>
  </div>`;

  return `<div class="topbar"><h1>Progrès</h1></div>
  ${hero}${tiles}
  ${focusCard()}
  ${weekCard(goal)}
  ${hskCard(tierOf)}
  ${skillsCard(ids)}
  ${toneCard()}
  ${hardWordsCard()}
  ${heatmapCard()}
  ${examsCard()}
  ${forecastLine()}`;
}

// Le conseil du jour : la compétence la plus faible, avec un bouton pour la travailler
function skillStats(ids) {
  return st.activeFacets().map(f => {
    let sum = 0, n = 0;
    for (const id of ids) { const c = st.getCard(id, f); if (c && c.reps) { sum += recallIn7(c); n++; } }
    return { f, v: n ? sum / n : null, n };
  });
}
function focusCard() {
  const ids = Object.keys(S().intro).filter(id => W(id));
  const valid = skillStats(ids).filter(x => x.v !== null && x.n >= 5);
  if (valid.length < 2) return `<div class="pg-focus"><span class="pg-fic">🌱</span><div class="grow"><b>Tes statistiques arrivent</b><span>Fais quelques leçons : l'appli trouvera ton point faible et te dira quoi travailler.</span></div></div>`;
  const w = valid.reduce((a, b) => (b.v < a.v ? b : a));
  const best = valid.reduce((a, b) => (b.v > a.v ? b : a));
  if (best.v - w.v < 0.05) return `<div class="pg-focus good"><span class="pg-fic">✨</span><div class="grow"><b>Tout est équilibré</b><span>Tes compétences sont au même niveau. Continue la leçon du jour.</span></div></div>`;
  return `<button class="pg-focus" data-act="start" data-mode="${w.f}">
    <span class="pg-fic">${FACET_ICON[w.f]}</span>
    <div class="grow"><span class="eyebrow">À travailler</span><b>${st.FACET_LABEL[w.f]} : ${pct(w.v)}</b><span>C'est ta compétence la plus fragile. 5 minutes suffisent.</span></div>
    <span class="pg-go">Go</span></button>`;
}

// Minutes de la semaine (lundi → dimanche) avec la ligne d'objectif
function weekCard(goal) {
  const s = S();
  const today0 = new Date(Date.now() - 4 * 3600000); today0.setHours(12, 0, 0, 0);
  const dow = (today0.getDay() + 6) % 7;
  const mins = (t) => Math.round((s.days[st.dayKey(t + 4 * 3600000)]?.secs || 0) / 60);
  const days = [], last = [];
  for (let i = 0; i < 7; i++) {
    const t = today0.getTime() + (i - dow) * 86400000;
    days.push({ t, m: i <= dow ? mins(t) : null, lab: 'LMMJVSD'[i], today: i === dow });
    last.push(mins(t - 7 * 86400000));
  }
  const tot = days.reduce((a, d) => a + (d.m || 0), 0);
  const lastTot = last.slice(0, dow + 1).reduce((a, b) => a + b, 0);
  const max = Math.max(goal * 1.25, ...days.map(d => d.m || 0));
  const hit = days.filter(d => d.m >= goal).length;
  const diff = tot - lastTot;
  const cmp = lastTot || tot ? (diff >= 0 ? `<span class="pg-up">▲ ${diff} min</span> par rapport à la semaine dernière à la même date` : `<span class="pg-down">▼ ${-diff} min</span> par rapport à la semaine dernière à la même date`) : '';
  return `<div class="card"><div class="pg-head"><h2>Cette semaine</h2><span class="pg-kpi">${tot} min</span></div>
    <p class="muted small pg-note">Objectif atteint ${hit} jour${hit > 1 ? 's' : ''} sur 7${cmp ? ' · ' + cmp : ''}</p>
    <div class="chart pg-week">
      <div class="pg-wplot"><div class="pg-goalline" style="bottom:${(goal / max) * 100}%"><span>${goal} min</span></div>
      <div class="bars">${days.map(d => {
        const tip = `${new Date(d.t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} : ${d.m === null ? 'à venir' : d.m + ' min'}`;
        return `<button data-act="bar" data-tip="${esc(tip)}" class="${!d.m ? 'zero' : ''} ${d.m >= goal ? 'hit' : ''}" aria-label="${esc(tip)}"><i style="height:${d.m ? Math.max(3, (d.m / max) * 100) : 0}%"></i></button>`;
      }).join('')}</div></div>
      <div class="xlabels">${days.map(d => `<span class="${d.today ? 'on' : ''}">${d.lab}</span>`).join('')}</div>
    </div></div>`;
}

// Niveaux HSK : barre segmentée (maîtrisés, connus, découverts) dans une seule couleur
function hskCard(tierOf) {
  const rows = [1, 2, 3].map(l => {
    const ws = WORDS.filter(w => w.lvl === l), n = ws.length;
    const c = [0, 0, 0, 0]; ws.forEach(w => c[tierOf[w.id] || 0]++);
    const seg = (k, cls, lab) => c[k] ? `<i class="${cls}" style="flex:${c[k]}" title="${lab} : ${c[k]}"></i>` : '';
    return `<div class="pg-hsk"><div class="pg-hsk-top"><b>HSK ${l}</b><span><b>${c[2] + c[3]}</b> / ${n} connus</span></div>
      <div class="pg-stack">${seg(3, 's3', 'Maîtrisés')}${seg(2, 's2', 'Connus')}${seg(1, 's1', 'Découverts')}<i class="s0" style="flex:${c[0]}"></i></div></div>`;
  }).join('');
  return `<div class="card"><h2>Niveaux HSK</h2>${rows}
    <div class="pg-legend"><span><i class="s3"></i>Maîtrisés</span><span><i class="s2"></i>Connus</span><span><i class="s1"></i>Découverts</span></div>
    <p class="muted small pg-note" style="margin:8px 0 0">Connu : plus de 70 % de chance de t'en souvenir dans une semaine. Maîtrisé : solide pour des semaines.</p></div>`;
}

// Compétences : chaque ligne lance un entraînement
function skillsCard(ids) {
  const fs = skillStats(ids);
  return `<div class="card pg-skills"><div class="pg-head"><h2>Tes compétences</h2></div>
    <p class="muted small pg-note">Chance de t'en souvenir dans 7 jours. Touche une ligne pour t'entraîner.</p>
    ${fs.map(x => `<button class="pg-skill" data-act="start" data-mode="${x.f}">
      <span class="pg-sic">${FACET_ICON[x.f]}</span>
      <span class="grow"><span class="pg-srow"><b>${st.FACET_LABEL[x.f]}</b><span class="pg-sv">${x.v === null ? '—' : pct(x.v)}</span></span>
        <span class="pg-strack"><i style="width:${(x.v || 0) * 100}%"></i></span>
        <span class="pg-shint">${FACET_HINT[x.f]}</span></span>
      <span class="chev">›</span></button>`).join('')}
  </div>`;
}

// Tons : réussite par ton, à l'oreille et à la voix
function toneCard() {
  const s = S();
  const acc = (M, i) => { const n = M[i].reduce((a, b) => a + b, 0); return n >= 3 ? { p: M[i][i] / n, n } : null; };
  const anyData = [0, 1, 2, 3].some(i => acc(s.toneEar, i) || acc(s.toneVoice, i));
  const marks = ['ā', 'á', 'ǎ', 'à'], names = ['1er ton', '2e ton', '3e ton', '4e ton'], shape = ['plat et haut', 'qui monte', 'qui descend puis remonte', 'qui tombe'];
  const cell = (a) => a ? `<span class="pg-tcell"><span class="pg-ttrack"><i style="width:${a.p * 100}%"></i></span><b>${pct(a.p)}</b></span>` : `<span class="pg-tcell none">—</span>`;
  let worst = null;
  for (const [M, src] of [[s.toneEar, "à l'oreille"], [s.toneVoice, 'en parlant']]) {
    M.forEach((r, i) => {
      const n = r.reduce((a, b) => a + b, 0); if (n < 5) return;
      r.forEach((v, j) => { if (i !== j && v / n > 0.15 && (!worst || v / n > worst.p)) worst = { i, j, p: v / n, src }; });
    });
  }
  const body = anyData ? `<div class="pg-tones">
      <div class="pg-trow pg-thead"><span></span><span>👂 Oreille</span><span>🎙️ Voix</span></div>
      ${[0, 1, 2, 3].map(i => `<div class="pg-trow"><span class="pg-tname"><span class="pg-tmark t${i + 1}">${marks[i]}</span><span><b>${names[i]}</b><small>${shape[i]}</small></span></span>${cell(acc(s.toneEar, i))}${cell(acc(s.toneVoice, i))}</div>`).join('')}
    </div>
    ${worst ? `<p class="insight">💡 ${worst.src === 'en parlant' ? 'En parlant' : "À l'oreille"}, ton <b>${names[worst.i]}</b> devient souvent un <b>${names[worst.j]}</b> (${Math.round(worst.p * 100)} % des cas).</p>` : ''}`
    : `<p class="muted small pg-note" style="margin:0">Fais l'exercice 🎵 Tons ou l'atelier 🎙️ Prononciation : tu verras ici quels tons tu réussis.</p>`;
  return `<div class="card"><div class="pg-head"><h2>Tes tons</h2>${anyData ? '<button class="pg-link" data-act="start" data-mode="ton">S\'entraîner ›</button>' : ''}</div>${body}</div>`;
}

function hardList() {
  const lapses = {};
  for (const [id, c] of Object.entries(S().cards)) {
    if (!c.lapses) continue;
    const wid = id.split('|')[0];
    if (W(wid)) lapses[wid] = (lapses[wid] || 0) + c.lapses;
  }
  return Object.entries(lapses).sort((a, b) => b[1] - a[1]).slice(0, 8);
}
function hardWordsCard() {
  const top = hardList().slice(0, 6);
  if (!top.length) return '';
  return `<div class="card"><div class="pg-head"><h2>Mots difficiles</h2></div>
    <p class="muted small pg-note">Ceux que tu oublies le plus souvent</p>
    <div class="pg-hard">${top.map(([id, n]) => { const w = W(id); return `<button class="pg-hw" data-act="word" data-id="${esc(id)}">
      <span class="pg-hwf">${face(w, true)}</span><span class="grow pg-hwfr">${esc(w.f)}</span><span class="pg-hwn">${n}×</span></button>`; }).join('')}</div>
    <button class="btn" data-act="start" data-mode="hard" style="margin-top:12px">Réviser ces mots</button></div>`;
}

// Calendrier des 12 dernières semaines
function heatmapCard() {
  const s = S(), goal = s.settings.goalMin;
  const today0 = new Date(Date.now() - 4 * 3600000); today0.setHours(12, 0, 0, 0);
  const dow = (today0.getDay() + 6) % 7;
  const start = today0.getTime() - (11 * 7 + dow) * 86400000;
  const cells = [];
  let active = 0;
  for (let i = 0; i < 84; i++) {
    const t = start + i * 86400000;
    if (t > today0.getTime()) { cells.push('<span class="hm-cell empty"></span>'); continue; }
    const m = Math.round((s.days[st.dayKey(t + 4 * 3600000)]?.secs || 0) / 60);
    if (m) active++;
    const lv = m === 0 ? 0 : m < goal / 3 ? 1 : m < (2 * goal) / 3 ? 2 : m < goal ? 3 : 4;
    const d = new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    cells.push(`<button class="hm-cell l${lv} ${t === today0.getTime() ? 'today' : ''}" data-act="bar" data-tip="${esc(d)} : ${m} min" aria-label="${esc(d)} : ${m} min"></button>`);
  }
  const months = [];
  for (let w = 0; w < 12; w++) {
    const d = new Date(start + w * 7 * 86400000);
    const prev = w ? new Date(start + (w - 1) * 7 * 86400000) : null;
    const nx = new Date(start + (w + 1) * 7 * 86400000);
    months.push((prev ? prev.getMonth() !== d.getMonth() : nx.getMonth() === d.getMonth()) ? d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : '');
  }
  return `<div class="card"><div class="pg-head"><h2>Régularité</h2><span class="pg-kpi">${active} j</span></div>
    <p class="muted small pg-note">Jours d'étude sur les 12 dernières semaines</p>
    <div class="chart pg-cal">
      <div class="pg-months"><span></span>${months.map(m => `<span>${m}</span>`).join('')}</div>
      <div class="pg-calgrid"><div class="pg-dows">${'LMMJVSD'.split('').map((d, i) => `<span>${i % 2 ? '' : d}</span>`).join('')}</div><div class="heatmap">${cells.join('')}</div></div>
    </div>
    <div class="hm-legend small muted">Moins ${[0, 1, 2, 3, 4].map(l => `<span class="hm-cell l${l}"></span>`).join('')} Plus <span class="grow"></span>foncé = objectif atteint</div></div>`;
}

function examsCard() {
  const ex = S().exams;
  if (!ex.length) return '';
  const rows = [1, 2, 3].map(l => {
    const mine = ex.filter(e => e.lvl === l);
    if (!mine.length) return '';
    const b = Math.max(...mine.map(e => e.score));
    return `<div class="pg-exam"><b>HSK ${l}</b><span class="pg-strack"><i style="width:${b}%"></i><em style="left:60%"></em></span><span class="pg-ev ${b >= 60 ? 'ok' : ''}">${b}${b >= 60 ? ' ✓' : ''}</span></div>`;
  }).join('');
  return `<div class="card"><div class="pg-head"><h2>Examens blancs</h2><button class="pg-link" data-act="exam">Passer ›</button></div>
    <p class="muted small pg-note">Meilleur score sur 100 · réussite à 60 (le trait)</p>${rows}</div>`;
}

function forecastLine() {
  const s = S(), facets = new Set(st.activeFacets());
  const end = new Date(); end.setHours(4, 0, 0, 0);
  const t1 = end.getTime() + 2 * 86400000, t7 = end.getTime() + 8 * 86400000;
  let tom = 0, week = 0;
  const tomStart = end.getTime() + 86400000;
  for (const [cid, c] of Object.entries(s.cards)) {
    if (!facets.has(cid.split('|')[1]) || !c.reps) continue;
    if (c.due >= tomStart && c.due < t1) tom++;
    if (c.due < t7) week++;
  }
  if (!week) return '';
  return `<p class="pg-fore">📅 Demain : <b>${tom}</b> révision${tom > 1 ? 's' : ''} · 7 prochains jours : <b>${week}</b></p>`;
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
    <div class="set"><label>Mode d'étude<span class="muted">${st.isOral() ? 'Pinyin en grand, caractères en petit, pas d\'écriture' : 'Caractères, pinyin et écriture à la main'}</span></label>${sel('studyMode', [['oral', 'Oral (pinyin)'], ['complet', 'Complet']])}</div>
    <div class="set"><label>Couleurs des tons<span class="muted">${pyHtml('yī yí yǐ yì yi', false)}</span></label><input type="checkbox" class="switch" data-set="toneColors" ${s.toneColors ? 'checked' : ''}></div>
    <div class="set"><label>Exercices oraux<span class="muted">Dire les mots et les phrases à voix haute</span></label><input type="checkbox" class="switch" data-set="speaking" ${s.speaking ? 'checked' : ''}></div>
    <div class="set"><label>Rythme intelligent<span class="muted">Adapte le nombre de mots nouveaux à ta réussite</span></label><input type="checkbox" class="switch" data-set="smartPace" ${s.smartPace ? 'checked' : ''}></div>
    <div class="set"><label>Nouvelles phrases par leçon</label>${sel('newSentences', [[0, '0'], [2, '2'], [3, '3'], [5, '5']])}</div>
    <div class="set"><label>Nouveaux mots par leçon</label>${sel('newPerLesson', [[3, '3'], [5, '5'], [8, '8'], [10, '10']])}</div>
    <div class="set"><label>Nouveaux mots max / jour</label>${sel('newPerDay', [[10, '10'], [15, '15'], [20, '20'], [30, '30'], [50, '50']])}</div>
    <div class="set"><label>Objectif quotidien</label>${sel('goalMin', [[10, '10 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '60 min']])}</div>
    ${st.isOral() ? '' : `<div class="set"><label>Pinyin au-dessus des caractères<span class="muted">Auto : disparaît quand tu connais bien le mot</span></label>${sel('pinyinMode', [['auto', 'Auto'], ['always', 'Toujours'], ['never', 'Jamais']])}</div>`}
    <div class="set"><label>Calibrage de la voix<span class="muted">${S().voice?.base != null ? 'Voix calibrée : ~' + Math.round(100 * Math.pow(2, S().voice.base / 12)) + ' Hz' : 'Pas encore fait'}</span></label><button class="btn ghost sm" data-act="recalib">Refaire</button></div>
    ${st.isOral() ? '' : `<div class="set"><label>Exercices d'écriture<span class="muted">Tracer les caractères au doigt</span></label><input type="checkbox" class="switch" data-set="trace" ${s.trace ? 'checked' : ''}></div>`}
  </div>
  <p class="sec-title">Audio</p>
  <div class="card">
    <div class="set"><label>Vitesse de la voix<span class="muted">${esc(voiceName())}</span></label>${sel('rate', [[0.6, 'Lente'], [0.8, 'Normale'], [1, 'Rapide']])}</div>
    <div class="set"><label>Prof IA : envoi direct de la voix<span class="muted">Ce que tu dis au micro part tout de suite</span></label><input type="checkbox" class="switch" data-set="voiceAuto" ${s.voiceAuto ? 'checked' : ''}></div>
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
  <p class="muted small" style="text-align:center;margin-top:24px">Xué v4.2 · ${WORDS.length} mots HSK 1-3 · ${SENTENCES.length} phrases · Mémoire FSRS</p>`;
}
after.settings = () => {
  tutor.afterSettings();
  app.querySelectorAll('[data-set]').forEach(el => {
    el.addEventListener('change', () => {
      const k = el.dataset.set; let v = el.type === 'checkbox' ? el.checked : el.value;
      if (['newPerLesson', 'newPerDay', 'goalMin', 'rate', 'newSentences'].includes(k)) v = +v;
      S().settings[k] = v; st.save();
      toast('Enregistré ✓');
      if (k === 'studyMode' || k === 'toneColors') render();
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
