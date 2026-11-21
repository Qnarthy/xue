// Atelier de prononciation : tu parles, l'appli dessine ta courbe de tons à côté de la courbe idéale.
import * as st from './store.js';
import { WORDS, WORD_BY_ID } from './data.js';
import { speak, sfx } from './audio.js';
import { syllables, parseSyl, toneSvg, TONE_CONTOUR } from './pinyin.js';
import { recallNow } from './fsrs.js';
import { esc, toast, actions, ui, ruby, shuffle } from './ui.js';
import { openMic, closeMic, startRecording, decode, pitchTrack, analyzeWord, spokenTones } from './pitch.js';
import { transcribe, hasKey } from './ai.js';

const S = () => st.S;
let view = null;
export const isOpen = () => !!view;
const TONE_ORD = { 1: '1er', 2: '2e', 3: '3e', 4: '4e', 5: 'neutre' };

export async function openLab() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Micro non disponible sur cet appareil');
  try { await openMic(); } catch (e) { return toast('Autorise le micro pour Xué (Safari : aA → Réglages du site)', 4000); }
  const known = Object.keys(S().intro).filter(id => WORD_BY_ID[id]);
  const pool = known.length >= 5 ? known : WORDS.filter(w => w.lvl === 1).slice(0, 30).map(w => w.id);
  const queue = pool
    .map(id => ({ id, r: recallNow(st.getCard(id, 'ton')) + Math.random() * 0.3 }))
    .sort((a, b) => a.r - b.r).slice(0, 10).map(x => x.id);
  view = { type: 'pron', step: S().voice?.base == null ? 'calib' : 'word', queue, i: 0, res: null, rec: null, busy: false, okCount: 0, t: Date.now() };
  ui.rerender();
}
function close() {
  view?.rec?.stop();
  if (view) st.addTime((Date.now() - view.t) / 1000);
  closeMic(); view = null; ui.rerender();
}
actions.pronclose = () => close();

export function renderView(app) {
  const v = view;
  const top = `<div class="sess-top"><button class="x" data-act="pronclose" aria-label="Quitter">✕</button><div class="bar"><i style="width:${v.step === 'calib' ? 0 : (v.i / v.queue.length) * 100}%"></i></div><span class="combo">${v.okCount ? '✓' + v.okCount : ''}</span></div>`;
  app.innerHTML = `<div class="sess">${top}<div class="sess-body" id="pronbody"></div></div>`;
  paint();
}

function recBtn(label) {
  const r = view.rec;
  return `<button class="recbtn ${r ? 'on' : ''}" data-act="precord" ${view.busy ? 'disabled' : ''}>
    <span class="dotrec"></span>${view.busy ? 'Analyse…' : r ? 'Stop' : label}</button>`;
}

function paint() {
  const box = document.getElementById('pronbody'); if (!box) return;
  const v = view;
  if (v.step === 'calib') {
    box.innerHTML = `<span class="q-tag">Calibrage de ta voix · une seule fois</span>
      <p class="q-label">Compte de 1 à 5 en chinois, à voix normale</p>
      <div class="prompt"><span class="hz" style="font-size:40px">一 二 三 四 五</span><div class="py">yī · èr · sān · sì · wǔ</div>
      <button class="spk" data-act="speak" data-text="一，二，三，四，五">🔊</button></div>
      <p class="muted small" style="text-align:center">L'appli mesure la hauteur moyenne de ta voix pour savoir ce qui est « haut » ou « bas » pour toi.</p>
      ${v.calibMsg ? `<div class="card" style="text-align:center">${v.calibMsg}</div>` : ''}
      <div class="actions" style="margin-top:auto">${v.calibDone ? '<button class="btn" data-act="pronnext">C\'est parti ▸</button>' : recBtn('Appuie et compte')}</div>`;
    return;
  }
  if (v.i >= v.queue.length) {
    box.innerHTML = `<div class="end"><div class="big">🎙️</div><h1 style="margin:6px 0">Atelier terminé !</h1>
      <div class="kpis"><div class="kpi"><b>${v.okCount}/${v.queue.length}</b><span>mots justes</span></div><div class="kpi"><b>${pctTones()}</b><span>tons justes</span></div><div class="kpi"><b>${Math.max(1, Math.round((Date.now() - v.t) / 60000))}</b><span>min</span></div></div>
      <p class="muted small">Le détail de tes confusions de tons est dans l'onglet Progrès.</p></div>
      <div class="actions" style="margin-top:auto"><button class="btn" data-act="pronclose">Terminer</button></div>`;
    st.touchStreak();
    return;
  }
  const w = WORD_BY_ID[v.queue[v.i]];
  const syls = syllables(w.p).map(parseSyl);
  const tones = syls.filter(s => s.hasVowel).map(s => s.tone);
  const spoken = spokenTones(tones);
  const r = v.res;
  box.innerHTML = `<span class="q-tag">Prononciation · ${v.i + 1}/${v.queue.length}</span>
    <div class="prompt" style="padding:6px 0 4px">${ruby(w, true)}<div class="muted">${esc(w.f)}</div>
      <div class="intro-tones" style="margin-top:8px">${spoken.map((t, k) => `<div>${toneSvg(t, 30)}${TONE_ORD[t]}${spoken[k] !== tones[k] ? ' *' : ''}</div>`).join('')}</div>
      ${spoken.some((t, k) => t !== tones[k]) ? '<p class="muted small" style="margin:4px 0 0">* Deux 3e tons de suite : le premier se prononce au 2e ton.</p>' : ''}
      <div><button class="spk" data-act="speak" data-text="${esc(w.h)}" aria-label="Modèle">🔊</button><button class="spk" data-act="speak" data-slow="1" data-text="${esc(w.h)}" aria-label="Lentement">🐢</button></div>
    </div>
    ${r ? resultHtml(w, r) : '<p class="muted small" style="text-align:center">Écoute le modèle, puis enregistre-toi. Exagère un peu les tons !</p>'}
    <div class="actions" style="margin-top:auto">
      ${r && !r.error ? `<div class="row"><button class="btn ghost" data-act="pronplay">▶ Ma voix</button>${recBtn('Réessayer')}</div><button class="btn ${r.allOk ? 'ok' : ''}" data-act="pronnext">Suivant ▸</button>` : recBtn('Appuie et parle')}
      ${r?.error ? '<button class="btn ghost" data-act="pronnext">Passer</button>' : ''}
    </div>`;
}

function pctTones() {
  const a = view.tonesOk || 0, b = view.tonesAll || 0;
  return b ? Math.round((a / b) * 100) + '%' : '—';
}

function resultHtml(w, r) {
  if (r.error) return `<div class="card" style="text-align:center">⚠️ ${esc(r.error)}</div>`;
  const ps = syllables(w.p).filter(p => parseSyl(p).hasVowel);
  const lines = r.syl.map((s, k) => {
    if (s.ok == null) return `<span class="sylres">${esc(ps[k] || '')} <small class="muted">neutre</small></span>`;
    return `<span class="sylres ${s.ok ? 'ok' : 'ko'}">${s.ok ? '✓' : '✗'} ${esc(ps[k] || '')}${s.ok ? '' : `<small>entendu : ${TONE_ORD[s.got]} ton</small>`}</span>`;
  }).join('');
  return `<div class="card pron-card">
    <div class="pron-title">${r.allOk ? '🎉 Tons justes !' : r.syl.some(s => s.ok) ? '👍 Presque !' : '🔁 Encore un essai'}</div>
    ${chartSvg(r)}
    <div class="legend small muted"><span><i class="lg ideal"></i>courbe idéale</span><span><i class="lg you"></i>ta voix</span></div>
    <div class="sylrow">${lines}</div>
    ${r.heard != null ? `<p class="small" style="margin:8px 0 0">${r.heardOk ? '✅' : '❓'} Whisper a compris : <b class="hzf">${esc(r.heard || '(rien)')}</b></p>` : ''}
    <p class="muted small" style="margin:6px 0 0">Analyse approximative : sers-t'en comme d'un miroir, pas comme d'un juge.</p>
  </div>`;
}

// Graphique : courbe idéale (bande grise) et courbe de la voix (ligne colorée)
function chartSvg(r) {
  const W = 320, H = 150, pad = 10;
  const t = r.track, segs = r.syl;
  const i0 = Math.max(0, segs[0].start - 6), i1 = Math.min(t.length - 1, segs[segs.length - 1].end + 6);
  const vals = t.slice(i0, i1 + 1).filter(f => f.st != null).map(f => f.st);
  const lo = Math.min(r.base - 7, ...vals) - 1, hi = Math.max(r.base + 7, ...vals) + 1;
  const X = (i) => pad + ((i - i0) / Math.max(1, i1 - i0)) * (W - 2 * pad);
  const Y = (v) => pad + ((hi - v) / (hi - lo)) * (H - 2 * pad);
  const chao = (L) => r.base + (L - 3) * 2.4;
  let ideal = '', voice = '';
  for (const s of segs) {
    const tone = s.spoken === 5 ? 5 : s.spoken;
    const pts = TONE_CONTOUR[tone];
    const xa = X(s.start), xb = X(s.end);
    if (pts.length === 3) {
      ideal += `<path d="M${xa},${Y(chao(pts[0]))} Q${(xa + xb) / 2},${Y(chao(pts[1])) + 22} ${xb},${Y(chao(pts[2]))}" class="ideal"/>`;
    } else {
      ideal += `<path d="M${xa},${Y(chao(pts[0]))} L${xb},${Y(chao(pts[1]))}" class="ideal"/>`;
    }
    const cls = s.ok == null ? 'neutral' : s.ok ? 'ok' : 'ko';
    const line = t.slice(s.start, s.end + 1).map((f, k) => (f.st == null ? null : `${X(s.start + k).toFixed(1)},${Y(f.st).toFixed(1)}`)).filter(Boolean);
    if (line.length > 1) voice += `<polyline points="${line.join(' ')}" class="voice ${cls}"/>`;
  }
  const grid = [1, 2, 3, 4, 5].map(L => `<line x1="${pad}" x2="${W - pad}" y1="${Y(chao(L))}" y2="${Y(chao(L))}" class="grid"/>`).join('');
  return `<svg class="pron-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de ta voix comparée à la courbe idéale">${grid}${ideal}${voice}</svg>`;
}

actions.precord = async () => {
  const v = view; if (!v || v.busy) return;
  if (v.rec) { v.rec.stop(); return; }
  speechSynthesis?.cancel?.();
  st.addTime((Date.now() - v.t) / 1000); v.t = Date.now();
  try { v.rec = startRecording(v.step === 'calib' ? 5000 : 3500); }
  catch (e) { return toast('Impossible d\'enregistrer'); }
  paint();
  const blob = await v.rec.done;
  const ext = v.rec.ext;
  v.rec = null;
  if (view !== v) return;
  v.busy = true; paint();
  try {
    if (v.step === 'calib') await doCalib(blob);
    else await doWord(blob, ext);
  } catch (e) {
    console.warn(e);
    if (v.step === 'calib') v.calibMsg = '⚠️ Enregistrement illisible, réessaie.';
    else v.res = { error: 'Enregistrement illisible, réessaie.' };
  }
  v.busy = false; paint();
};

async function doCalib(blob) {
  const audio = await decode(blob);
  const vals = pitchTrack(audio.getChannelData(0), audio.sampleRate).filter(f => f.st != null).map(f => f.st).sort((a, b) => a - b);
  if (vals.length < 30) { view.calibMsg = '⚠️ Je ne t\'ai pas bien entendu. Parle un peu plus fort et réessaie.'; return; }
  const base = vals[vals.length >> 1];
  S().voice = { base, date: Date.now() }; st.save();
  const hz = Math.round(100 * Math.pow(2, base / 12));
  view.calibMsg = `✅ Voix calibrée : environ <b>${hz} Hz</b>.<br><span class="small muted">Tu pourras recommencer dans les réglages si besoin.</span>`;
  view.calibDone = true;
}

async function doWord(blob, ext) {
  const v = view;
  const w = WORD_BY_ID[v.queue[v.i]];
  const tones = syllables(w.p).map(parseSyl).filter(s => s.hasVowel).map(s => s.tone);
  const whisper = hasKey() ? transcribe(blob, ext).catch(() => null) : null;
  const r = await analyzeWord(blob, tones, S().voice?.base);
  if (v.url) URL.revokeObjectURL(v.url);
  v.url = URL.createObjectURL(blob);
  if (!r.error) {
    const evald = r.syl.filter(s => s.ok != null);
    r.allOk = evald.every(s => s.ok);
    // statistiques de confusion des tons (voix)
    const M = (S().toneVoice ||= [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
    for (const s of evald) {
      const want = s.ok ? s.got : s.spoken;
      if (want >= 1 && want <= 4 && s.got >= 1 && s.got <= 4) M[want - 1][s.got - 1]++;
    }
    if (!v.tried) {
      v.tonesAll = (v.tonesAll || 0) + evald.length;
      v.tonesOk = (v.tonesOk || 0) + evald.filter(s => s.ok).length;
    }
    v.tried = true;
    if (r.allOk && !v.counted) { v.okCount++; v.counted = true; st.addXp(10); sfx.ok(); }
    else if (!r.allOk) sfx.ko();
    st.save();
  }
  if (whisper) {
    const heard = await whisper;
    if (heard != null) {
      r.heard = heard;
      r.heardOk = heard.replace(/[\s，。！？,.!?、]/g, '').includes(w.h);
    }
  }
  v.res = r;
}

actions.pronplay = () => { if (view?.url) new Audio(view.url).play().catch(() => {}); };
actions.pronnext = () => {
  const v = view;
  if (v.step === 'calib') { v.step = 'word'; v.calibMsg = null; return renderView(document.getElementById('app')); }
  v.i++; v.res = null; v.tried = false; v.counted = false;
  renderView(document.getElementById('app'));
  if (v.i < v.queue.length) setTimeout(() => speak(WORD_BY_ID[v.queue[v.i]].h), 250);
};
export function recalibrate() { if (S().voice) S().voice.base = null; st.save(); }
