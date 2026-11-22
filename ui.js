// Petits outils d'interface partagés entre les écrans.
import { syllables, parseSyl } from './pinyin.js';
import * as st from './store.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pct = (x) => Math.round(x * 100) + '%';

export function toast(msg, ms = 2400) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), ms);
}

// Caractères avec le pinyin au-dessus de chacun
export function ruby(w, show = true) {
  const ps = syllables(w.p);
  return `<span class="hz">${[...w.h].map((c, i) => `<ruby>${c}<rt>${show ? esc(ps[i] || '') : '&nbsp;'}</rt></ruby>`).join('')}</span>`;
}

// Pinyin coloré selon le ton (syllabes d'un même mot collées : « nǐhǎo »)
export function pyHtml(p, join = true) {
  const col = st.S.settings.toneColors;
  return syllables(p).map(x => `<span class="${col ? 't' + parseSyl(x).tone : ''}">${esc(x)}</span>`).join(join ? '' : ' ');
}
// Affichage d'un mot : mode oral = pinyin en grand + caractères en petit ; mode complet = caractères + pinyin au-dessus
export function face(w, showPy = true) {
  if (!st.isOral()) return ruby(w, showPy);
  return `<span class="face"><span class="fpy">${pyHtml(w.p)}</span><span class="fhz hzf">${esc(w.h)}</span></span>`;
}
// Une phrase : chaque mot avec son pinyin au-dessus (mode oral : pinyin en grand)
export function sentHtml(s, { tap = false, py = true } = {}) {
  const oral = st.isOral();
  return `<span class="sent-line ${oral ? 'oral' : ''}">${s.toks.map((t, i) => t.punct
    ? `<span class="tk punct"><span class="tpy">,</span><span class="thz">，</span></span>`
    : `<span class="tk"${tap ? ` data-act="gloss" data-i="${i}"` : ''}><span class="tpy">${py ? pyHtml(t.p) : '&nbsp;'}</span><span class="thz hzf">${esc(t.h)}</span></span>`).join('')}<span class="tk punct"><span class="tpy">&nbsp;</span><span class="thz">${s.end}</span></span></span>`;
}

// Registre des actions déclenchées par data-act="…" (clic délégué)
export const actions = {};
export function dispatchClick(e) {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e);
}

// Redessine l'écran courant (branché par app.js)
export const ui = { rerender: () => {} };

export function openModal(html) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); else dispatchClick(e); });
  document.body.appendChild(bg);
  return bg;
}
export function closeModal() { document.querySelectorAll('.modal-bg').forEach(m => m.remove()); }

export const levelLabel = (w) => (w.lvl ? `HSK ${w.lvl}` : 'Mot perso');
