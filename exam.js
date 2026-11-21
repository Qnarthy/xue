// Examens blancs HSK 1-3 : écoute + lecture (+ phrases à trous écrites par l'IA si elle est connectée).
import * as st from './store.js';
import { WORDS } from './data.js';
import { speak, sfx } from './audio.js';
import { syllables } from './pinyin.js';
import { esc, toast, actions, ui, ruby, shuffle, openModal, closeModal } from './ui.js';
import { chatJSON, hasKey } from './ai.js';

const S = () => st.S;
let view = null;
export const isOpen = () => !!view;

const PARTS = [
  { id: 'L1', name: 'Écoute 1', label: 'Quel mot entends-tu ?' },
  { id: 'L2', name: 'Écoute 2', label: 'Vrai ou faux ?' },
  { id: 'R1', name: 'Lecture 1', label: 'Que signifie ce mot ?' },
  { id: 'R2', name: 'Lecture 2', label: 'Retrouve le mot chinois' },
  { id: 'R3', name: 'Lecture 3', label: 'Complète la phrase' },
];

// ---------- Choix du niveau ----------
export function chooseLevel() {
  const best = (l) => Math.max(-1, ...S().exams.filter(e => e.lvl === l).map(e => e.score));
  openModal(`<h2 style="margin:0 0 4px">📝 Examen blanc HSK</h2>
    <p class="muted small" style="margin:0 0 14px">Écoute et lecture, sur tout le vocabulaire du niveau (pas seulement les mots déjà appris). Réussite à 60/100, comme le vrai HSK. ${hasKey() ? 'Avec phrases à trous écrites par l\'IA.' : 'Connecte le Prof IA pour ajouter des phrases à trous.'}</p>
    ${[1, 2, 3].map(l => { const b = best(l); return `<button class="card choice" data-act="examgo" data-l="${l}"><b>HSK ${l}</b><span class="muted small">${l === 1 ? '150' : l === 2 ? '300' : '600'} mots · ~${hasKey() ? 12 : 10} min ${b >= 0 ? `· meilleur score : ${b}/100 ${b >= 60 ? '✅' : ''}` : ''}</span></button>`; }).join('')}
    <button class="btn ghost" data-act="close">Annuler</button>`);
}
actions.examgo = (el) => { closeModal(); startExam(+el.dataset.l); };

function pool(lvl) { return WORDS.filter(w => w.lvl && w.lvl <= lvl); }
function pick(arr, n, not = new Set()) { return shuffle(arr.filter(w => !not.has(w.id))).slice(0, n); }
function distract(w, src, n, sound) {
  const len = [...w.h].length;
  const c = shuffle(src.filter(x => x.id !== w.id && x.f !== w.f && x.h !== w.h && !(sound && x.p.toLowerCase() === w.p.toLowerCase())))
    .sort((a, b) => ([...b.h].length === len) - ([...a.h].length === len));
  const out = [], seen = new Set([w.f]);
  for (const x of c) { if (seen.has(x.f)) continue; seen.add(x.f); out.push(x); if (out.length === n) break; }
  return out;
}

async function startExam(lvl) {
  const all = pool(lvl), lvlWords = all.filter(w => w.lvl === lvl);
  const used = new Set(); const q = [];
  const take = (n) => { const ws = pick(lvlWords.length >= 40 ? lvlWords : all, n, used); ws.forEach(w => used.add(w.id)); return ws; };
  take(10).forEach(w => q.push({ part: 'L1', w, opts: shuffle([w, ...distract(w, all, 3, true)]) }));
  take(5).forEach(w => {
    const truth = Math.random() < 0.5;
    const other = distract(w, all, 1)[0];
    q.push({ part: 'L2', w, shown: truth ? w.f : other.f, truth });
  });
  take(10).forEach(w => q.push({ part: 'R1', w, opts: shuffle([w, ...distract(w, all, 3)]) }));
  take(5).forEach(w => q.push({ part: 'R2', w, opts: shuffle([w, ...distract(w, all, 3)]) }));
  view = { type: 'exam', lvl, q, i: 0, ans: [], t0: Date.now(), tq: Date.now(), py: lvl === 1 };
  if (hasKey()) {
    const m = openModal('<div class="loading"><div class="spinner"></div><b>Préparation de l\'examen…</b><p class="muted small">L\'IA écrit les phrases à trous</p></div>');
    try { (await gapItems(lvl, all)).forEach(it => q.push(it)); }
    catch (e) { toast('Phrases à trous indisponibles : examen sans cette partie', 3000); }
    m.remove();
  }
  ui.rerender();
}

async function gapItems(lvl, all) {
  const words = shuffle(all.filter(w => w.lvl === lvl)).slice(0, 80).map(w => w.h).join('、');
  const r = await chatJSON([
    { role: 'system', content: 'Tu es concepteur d\'examens HSK officiels. Tu réponds uniquement en JSON valide.' },
    { role: 'user', content: `Crée 5 questions « phrase à trous » de niveau HSK ${lvl}, comme dans la partie lecture du vrai HSK.
Chaque phrase en chinois simplifié contient « ___ » à la place d'un mot. Utilise uniquement du vocabulaire HSK ${lvl} ou inférieur. Mots possibles pour les réponses : ${words}.
Les 4 options sont des mots chinois du même type ; une seule est correcte et naturelle.
JSON : {"items":[{"sentence":"我___中国人。","pinyin":"wǒ ___ zhōngguó rén.","fr":"Je suis chinois.","options":["是","有","在","去"],"answer":"是"}]}` },
  ], { temperature: 0.7 });
  return (r.items || [])
    .filter(it => it && typeof it.sentence === 'string' && it.sentence.includes('___') && Array.isArray(it.options) && it.options.includes(it.answer) && new Set(it.options).size === it.options.length)
    .slice(0, 5)
    .map(it => ({ part: 'R3', gap: { ...it, options: shuffle([...it.options]) } }));
}

function close() { view = null; ui.rerender(); }
actions.examquit = () => {
  if (view.i < view.q.length && view.i > 0 && !confirm('Abandonner l\'examen ? Il ne sera pas noté.')) return;
  close();
};

export function renderView(app) {
  const v = view;
  if (v.i >= v.q.length) return renderResult(app);
  const it = v.q[v.i], part = PARTS.find(p => p.id === it.part);
  const pyOpt = (o) => (v.py ? ruby(o, true) : `<span class="hz">${esc(o.h)}</span>`);
  let body = '';
  if (it.part === 'L1') {
    body = `<div class="prompt"><button class="spk big" data-act="speak" data-text="${esc(it.w.h)}">🔊</button></div>
      <div class="opts two">${it.opts.map((o, k) => `<button class="opt" data-act="exans" data-k="${k}">${pyOpt(o)}</button>`).join('')}</div>`;
  } else if (it.part === 'L2') {
    body = `<div class="prompt"><button class="spk big" data-act="speak" data-text="${esc(it.w.h)}">🔊</button><div class="fr" style="margin-top:14px">« ${esc(it.shown)} »</div><p class="muted small">Le mot entendu a-t-il ce sens ?</p></div>
      <div class="opts two"><button class="opt" data-act="exans" data-k="1">✓ Vrai</button><button class="opt" data-act="exans" data-k="0">✗ Faux</button></div>`;
  } else if (it.part === 'R1') {
    body = `<div class="prompt">${v.py ? ruby(it.w, true) : `<span class="hz">${esc(it.w.h)}</span>`}</div>
      <div class="opts">${it.opts.map((o, k) => `<button class="opt" data-act="exans" data-k="${k}">${esc(o.f)}</button>`).join('')}</div>`;
  } else if (it.part === 'R2') {
    body = `<div class="prompt"><div class="fr">« ${esc(it.w.f)} »</div></div>
      <div class="opts two">${it.opts.map((o, k) => `<button class="opt" data-act="exans" data-k="${k}">${pyOpt(o)}</button>`).join('')}</div>`;
  } else {
    const g = it.gap;
    body = `<div class="prompt"><div class="hzf" style="font-size:26px;line-height:1.5">${esc(g.sentence).replace('___', '<span class="gap">＿＿</span>')}</div>${v.py ? `<div class="py">${esc(g.pinyin || '')}</div>` : ''}</div>
      <div class="opts two">${g.options.map((o, k) => `<button class="opt" data-act="exans" data-k="${k}"><span class="hz">${esc(o)}</span></button>`).join('')}</div>`;
  }
  const mins = Math.floor((Date.now() - v.t0) / 60000);
  app.innerHTML = `<div class="sess">
    <div class="sess-top"><button class="x" data-act="examquit" aria-label="Quitter">✕</button><div class="bar"><i style="width:${(v.i / v.q.length) * 100}%"></i></div><span class="combo" style="color:var(--ink-3)">${v.i + 1}/${v.q.length}</span></div>
    <div class="sess-body"><span class="q-tag">HSK ${v.lvl} · ${part.name} · ${mins} min</span><p class="q-label">${part.label}</p>${body}</div></div>`;
  if (it.part === 'L1' || it.part === 'L2') setTimeout(() => speak(it.w.h), 300);
}

actions.exans = (el) => {
  const v = view, it = v.q[v.i], k = +el.dataset.k;
  let ok;
  if (it.part === 'L2') ok = (k === 1) === it.truth;
  else if (it.part === 'R3') ok = it.gap.options[k] === it.gap.answer;
  else ok = it.opts[k].id === it.w.id;
  v.ans[v.i] = { ok, k };
  st.addTime((Date.now() - v.tq) / 1000); v.tq = Date.now();
  el.classList.add('sel');
  setTimeout(() => { v.i++; renderView(document.getElementById('app')); }, 180);
};

function renderResult(app) {
  const v = view;
  if (!v.saved) {
    const n = v.q.length, good = v.ans.filter(a => a?.ok).length;
    v.score = Math.round((good / n) * 100);
    v.parts = PARTS.map(p => {
      const idx = v.q.map((q, i) => (q.part === p.id ? i : -1)).filter(i => i >= 0);
      return { id: p.id, name: p.name, n: idx.length, ok: idx.filter(i => v.ans[i]?.ok).length };
    }).filter(p => p.n);
    S().exams.push({ lvl: v.lvl, score: v.score, date: Date.now(), parts: v.parts.map(p => [p.id, p.ok, p.n]) });
    st.addXp(30 + Math.round(v.score / 2)); st.touchStreak(); st.save();
    v.saved = true;
    v.score >= 60 ? sfx.done() : sfx.ko();
  }
  const pass = v.score >= 60;
  const wrong = v.q.map((q, i) => ({ q, a: v.ans[i] })).filter(x => !x.a?.ok);
  const wrongWords = [...new Map(wrong.filter(x => x.q.w).map(x => [x.q.w.id, x.q.w])).values()];
  app.innerHTML = `<div class="screen" style="padding-bottom:30px">
    <div class="end" style="padding-top:10px"><div class="big">${pass ? '🎓' : '📚'}</div>
      <h1 style="margin:4px 0">${v.score}/100</h1>
      <span class="pill ${pass ? '' : 'dim'}" style="color:${pass ? 'var(--ok)' : 'var(--ko)'}">${pass ? 'HSK ' + v.lvl + ' réussi ✓' : 'Pas encore : 60 requis'}</span>
    </div>
    <div class="card" style="margin-top:18px">${v.parts.map(p => `<div class="meter"><span class="lab">${p.name}</span><span class="track"><i style="width:${(p.ok / p.n) * 100}%"></i></span><span class="v">${p.ok}/${p.n}</span></div>`).join('')}</div>
    ${wrong.length ? `<p class="sec-title">À revoir (${wrong.length})</p><div class="wlist">${wrong.map(({ q }) => q.w
      ? `<button class="wrow" data-act="speak" data-text="${esc(q.w.h)}"><span class="hzf">${esc(q.w.h)}</span><span class="grow"><div class="py">${esc(q.w.p)}</div><div class="fr">${esc(q.w.f)}</div></span><span>🔊</span></button>`
      : `<div class="wrow"><span class="grow"><div class="hzf">${esc(q.gap.sentence.replace('___', '【' + q.gap.answer + '】'))}</div><div class="fr">${esc(q.gap.fr || '')}</div></span></div>`).join('')}</div>
      ${wrongWords.length ? `<button class="btn" data-act="examadd" style="margin-top:12px">➕ Ajouter ces ${wrongWords.length} mots à mes révisions</button>` : ''}` : ''}
    <button class="btn ghost" data-act="examquit" style="margin-top:10px">Terminer</button>
  </div>`;
  v.wrongWords = wrongWords;
}
actions.examadd = (el) => {
  const now = Date.now();
  let n = 0;
  for (const w of view.wrongWords) {
    if (!S().intro[w.id]) { st.introduce(w.id); n++; }
    else { const c = st.getCard(w.id, 'sens'); if (c) c.due = now; }
  }
  st.save();
  el.disabled = true; el.textContent = '✓ Ajoutés';
  toast(n ? `${n} nouveaux mots ajoutés, les autres repassent en révision` : 'Ces mots repassent en révision');
};
