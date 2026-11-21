// Petits outils d'interface partagés entre les écrans.
import { syllables } from './pinyin.js';

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
