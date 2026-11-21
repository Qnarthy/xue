// Prof IA : jeux de rôle avec missions, saisie vocale (Whisper), histoires sur mesure, explications de mots.
import * as st from './store.js';
import { WORDS, WORD_BY_ID } from './data.js';
import { speak, sfx } from './audio.js';
import { splitPinyin } from './pinyin.js';
import { esc, toast, actions, ui, openModal, closeModal, ruby } from './ui.js';
import { chatJSON, transcribe, autoPickModel, listModels, hasKey, learnerProfile, AIError } from './ai.js';

const S = () => st.S;
let view = null; // vue plein écran en cours : discussion ou histoire
export const isOpen = () => !!view;

// ================================================================
//  Les scènes de jeu de rôle
// ================================================================
const SCENARIOS = [
  { id: 'intro', icon: '👋', title: 'Se présenter', desc: 'Tu rencontres Lǐ Míng, un étudiant chinois.', role: 'Tu es Lǐ Míng 李明, 22 ans, étudiant sympathique à Pékin. Tu rencontres l\'élève pour la première fois dans un café.', goals: ['Dire bonjour', 'Dire ton prénom', 'Dire ta nationalité', 'Demander son âge'] },
  { id: 'resto', icon: '🍜', title: 'Au restaurant', desc: 'Commande dans un petit restaurant de nouilles.', role: 'Tu es serveur dans un petit restaurant de nouilles à Pékin. Tu accueilles l\'élève, tu proposes le menu (面条, 米饭, 饺子, 茶, 啤酒…).', goals: ['Commander un plat', 'Commander une boisson', 'Demander le prix', 'Payer et dire merci'] },
  { id: 'taxi', icon: '🚕', title: 'Prendre un taxi', desc: 'Un chauffeur bavard à Shanghai.', role: 'Tu es chauffeur de taxi à Shanghai, bavard et curieux. L\'élève monte dans ton taxi.', goals: ['Dire où tu vas', 'Demander si c\'est loin', 'Répondre à une question perso', 'Payer et dire au revoir'] },
  { id: 'shop', icon: '🍎', title: 'Au marché', desc: 'Marchande des fruits avec une vendeuse.', role: 'Tu es une vendeuse de fruits au marché, souriante mais tu annonces des prix un peu élevés et tu acceptes de négocier.', goals: ['Demander le prix', 'Dire que c\'est trop cher', 'Négocier un prix', 'Acheter des fruits'] },
  { id: 'way', icon: '🗺️', title: 'Demander son chemin', desc: 'Trouve le métro dans les rues de Pékin.', role: 'Tu es un passant à Pékin. L\'élève est perdu. Le métro est à 10 minutes à pied : tout droit puis à gauche.', goals: ['Demander où est le métro', 'Comprendre la direction', 'Demander si c\'est loin', 'Remercier'] },
  { id: 'hotel', icon: '🏨', title: 'À l\'hôtel', desc: 'Arrivée à la réception d\'un hôtel.', role: 'Tu es réceptionniste dans un hôtel à Xi\'an. L\'élève arrive avec une réservation.', goals: ['Dire que tu as réservé', 'Donner ton nom', 'Demander l\'heure du petit-déjeuner', 'Demander le mot de passe wifi'] },
  { id: 'friend', icon: '☕', title: 'Café avec une amie', desc: 'Discute loisirs et week-end avec Wáng Fāng.', role: 'Tu es Wáng Fāng 王芳, une amie chinoise de l\'élève. Vous buvez un café et parlez de vos loisirs et du week-end.', goals: ['Parler de tes loisirs', 'Parler de ton week-end', 'Proposer une activité', 'Fixer un jour et une heure'] },
  { id: 'doctor', icon: '🏥', title: 'Chez le médecin', desc: 'Explique tes symptômes (HSK 2-3).', role: 'Tu es médecin dans un hôpital de Pékin, calme et rassurant. L\'élève est malade.', goals: ['Dire où tu as mal', 'Dire depuis quand', 'Comprendre le conseil du médecin', 'Remercier'] },
  { id: 'free', icon: '💬', title: 'Conversation libre', desc: 'Parle de tout : ta vie, la Chine, la culture…', role: 'Tu es Lǎoshī 老师, un professeur chinois chaleureux et drôle. Conversation libre : la vie de l\'élève, ses goûts, la Chine, la culture chinoise.', goals: [] },
];

const THEMES = [['🎲', 'Surprise'], ['✈️', 'Voyage en Chine'], ['🏠', 'Vie quotidienne'], ['🏮', 'Culture et fêtes chinoises'], ['❤️', 'Rencontre et amitié'], ['😂', 'Histoire drôle']];
let storyTheme = 0;

// ================================================================
//  Onglet « Prof IA »
// ================================================================
export function aiScreen() {
  if (!hasKey()) return setupCard();
  const s = S();
  const sc = SCENARIOS.map(x => {
    const n = s.missions[x.id] || 0;
    return `<button class="tile" data-act="scen" data-id="${x.id}"><span class="ic">${x.icon}</span><b>${esc(x.title)}</b><span class="muted small">${esc(x.desc)}</span>${n ? `<span class="badge ok">✓${n > 1 ? ' ×' + n : ''}</span>` : ''}</button>`;
  }).join('');
  const stories = s.stories.slice(0, 6).map((x, i) => `<button class="wrow" data-act="storyopen" data-i="${i}"><span class="hzf" style="font-size:18px;min-width:0">📖</span><span class="grow"><div class="fr"><b>${esc(x.title_zh)}</b></div><div class="py">${esc(x.title_fr)}</div></span><span class="muted small">${x.score != null ? x.score + '/' + x.questions.length : ''}</span></button>`).join('');
  return `<div class="topbar"><h1>Prof IA</h1><span class="pill dim small" title="Modèle utilisé">⚡ ${esc((s.settings.groqModel || 'auto').split('/').pop())}</span></div>
  <p class="sec-title" style="margin-top:4px">Jeux de rôle</p>
  <p class="muted small" style="margin:-4px 4px 12px">Parle (🎤) ou écris en chinois, en pinyin, ou même en français si tu bloques : le prof corrige chaque phrase et te propose des réponses.</p>
  <div class="tiles">${sc}</div>
  <p class="sec-title">Lecture sur mesure</p>
  <div class="card">
    <b>Une histoire écrite pour toi</b>
    <p class="muted small" style="margin:4px 0 10px">Avec les mots que tu connais déjà, et seulement 3 nouveaux. Suivie de questions de compréhension.</p>
    <div class="chips" style="flex-wrap:wrap">${THEMES.map(([ic, l], i) => `<button class="chip ${storyTheme === i ? 'on' : ''}" data-act="theme" data-i="${i}">${ic} ${esc(l)}</button>`).join('')}</div>
    <button class="btn" data-act="storygen">✨ Écrire mon histoire</button>
  </div>
  ${stories ? `<p class="sec-title">Mes histoires</p><div class="wlist">${stories}</div>` : ''}`;
}

function setupCard() {
  return `<div class="topbar"><h1>Prof IA</h1></div>
  <div class="card hero"><h2>🤖 Ton prof de chinois perso</h2><p class="muted" style="margin:0">Jeux de rôle corrigés, histoires adaptées à ton niveau, explications de grammaire. Gratuit grâce à Groq.</p></div>
  <div class="card">
    <b>Connecter l'IA (une seule fois, 2 min)</b>
    <ol class="steps">
      <li>Ouvre <b>console.groq.com</b> dans Safari et crée un compte gratuit (tu peux utiliser « Continuer avec Google »).</li>
      <li>Va dans <b>API Keys</b> puis touche <b>Create API Key</b>. Donne-lui un nom, par exemple « Xué ».</li>
      <li>Copie la clé (elle commence par <code>gsk_</code>) et colle-la ci-dessous.</li>
    </ol>
    <input id="aikey" class="search" type="password" placeholder="gsk_…" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin:6px 0 12px">
    <button class="btn" data-act="aiconnect">Connecter</button>
    <p class="muted small" style="margin:10px 0 0">🔒 La clé reste uniquement sur ce téléphone. Ne la partage jamais et ne la mets pas sur GitHub.</p>
  </div>`;
}
export function afterAiScreen() {}

actions.aiconnect = async (el) => {
  const v = document.getElementById('aikey').value.trim();
  if (!v) return toast('Colle ta clé Groq');
  S().settings.groqKey = v; S().settings.groqModel = ''; st.save(true);
  el.disabled = true; el.textContent = 'Connexion…';
  try {
    const { best } = await autoPickModel();
    toast('Connecté ✓ ' + best.split('/').pop());
    ui.rerender();
  } catch (e) {
    S().settings.groqKey = ''; st.save(true);
    el.disabled = false; el.textContent = 'Connecter';
    toast(e.message || 'Connexion impossible', 3500);
  }
};
actions.theme = (el) => { storyTheme = +el.dataset.i; ui.rerender(); };
actions.scen = (el) => openChat(SCENARIOS.find(x => x.id === el.dataset.id));
actions.storygen = () => generateStory();
actions.storyopen = (el) => openStory(S().stories[+el.dataset.i]);
actions.aiclose = () => closeView();

function closeView() {
  if (view?.type === 'chat') { logTime(); stopRecording(true); }
  if (view?.type === 'story') logTime();
  speechSynthesis?.cancel?.();
  view = null; ui.rerender();
}
function logTime() {
  if (!view) return;
  st.addTime((Date.now() - view.t) / 1000);
  view.t = Date.now();
}

export function renderView(app) {
  if (view.type === 'chat') return renderChat(app);
  if (view.type === 'story') return renderStory(app);
}

// ================================================================
//  Discussion (jeu de rôle)
// ================================================================
function systemPrompt(sc) {
  const p = learnerProfile();
  return `Tu es un partenaire de conversation ET un professeur de chinois mandarin pour un élève francophone.
SCÈNE : ${sc.role}
OBJECTIFS DE L'ÉLÈVE : ${sc.goals.length ? sc.goals.map((g, i) => `${i}. ${g}`).join(' ; ') : 'aucun (conversation libre)'}
NIVEAU : ${p.level}. Vocabulaire connu : ${p.vocab}
RÈGLES :
1. Joue ton rôle en chinois simplifié très simple : 1 à 2 phrases courtes${p.n < 150 ? ' (25 caractères maximum au total)' : ''}. Utilise presque uniquement le vocabulaire connu. Au maximum UN mot nouveau par réplique, seulement s'il est utile à la scène ; dans ce cas, décris-le dans "new_word".
2. Termine par une question simple pour faire parler l'élève et l'amener vers les objectifs pas encore atteints.
3. Analyse le DERNIER message de l'élève (sauf pour la toute première réplique : "correction": null) :
   - écrit en chinois ou en pinyin : vérifie grammaire, choix des mots, ordre des mots. "ok": true s'il est correct et naturel (ignore la ponctuation, les tons absents et les petites fautes de frappe en pinyin). Sinon "ok": false et donne la version correcte.
   - écrit en français (il ne sait pas dire) : "ok": false et donne dans "corrected" la phrase chinoise qu'il aurait pu dire.
   - "explanation" : une phrase courte et bienveillante en français, avec la règle de grammaire si utile.
4. "suggestions" : exactement 3 réponses courtes et variées que l'élève pourrait dire ensuite, à son niveau.
5. "goals_done" : numéros de TOUS les objectifs que l'élève a atteints depuis le début (cumulés).
Réponds UNIQUEMENT avec ce JSON, sans aucun autre texte :
{"zh":"ta réplique","pinyin":"pinyin avec accents, mots séparés par des espaces","fr":"traduction française","correction":null,"new_word":null,"goals_done":[],"suggestions":[{"zh":"…","pinyin":"…","fr":"…"}]}
où "correction" vaut null ou {"ok":true,"corrected":"…","pinyin":"…","explanation":"…"} et "new_word" vaut null ou {"h":"caractères","p":"pinyin, une syllabe par caractère séparées par des espaces","f":"sens en français"}.`;
}

function openChat(sc) {
  view = { type: 'chat', sc, msgs: [], api: [], goals: [], sugg: [], busy: false, done: false, t: Date.now(), sys: systemPrompt(sc) };
  ui.rerender();
  askAI('(Début de la scène : salue l\'élève et lance la conversation selon ton rôle.)', true);
}

function renderChat(app) {
  const v = view, sc = v.sc;
  app.innerHTML = `<div class="chat">
    <div class="chat-top">
      <button class="x" data-act="aiclose" aria-label="Fermer">✕</button>
      <div class="grow"><b>${sc.icon} ${esc(sc.title)}</b>${sc.goals.length ? `<div class="small muted" id="goalcount"></div>` : ''}</div>
      <button class="chip ${S().settings.chatPinyin ? 'on' : ''}" data-act="chatpy" title="Afficher le pinyin">拼音</button>
    </div>
    ${sc.goals.length ? `<div class="goals" id="goals"></div>` : ''}
    <div class="msgs" id="msgs"></div>
    <div class="sugg" id="sugg"></div>
    <div class="composer">
      <button class="mic" data-act="mic" id="micbtn" aria-label="Parler">🎤</button>
      <input id="chatin" placeholder="Écris en chinois, pinyin ou français…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send">
      <button class="send" data-act="send" aria-label="Envoyer">➤</button>
    </div>
  </div>`;
  const inp = document.getElementById('chatin');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions.send(); } });
  paintChat();
}

function paintChat() {
  const v = view; if (!v || v.type !== 'chat') return;
  const py = S().settings.chatPinyin;
  const box = document.getElementById('msgs');
  box.innerHTML = v.msgs.map((m, i) => {
    if (m.role === 'sys') return `<div class="msg sys">${m.html}</div>`;
    if (m.role === 'ai') {
      const nw = m.new_word && m.new_word.h ? newWordChip(m.new_word, i) : '';
      return `<div class="msg ai"><div class="bubble">
        <div class="zh hzf">${esc(m.zh)}</div>${py ? `<div class="py">${esc(m.pinyin)}</div>` : ''}${m.showFr ? `<div class="fr">${esc(m.fr)}</div>` : ''}
        <div class="tools"><button data-act="speak" data-text="${esc(m.zh)}" aria-label="Écouter">🔊</button><button data-act="speak" data-slow="1" data-text="${esc(m.zh)}" aria-label="Lentement">🐢</button><button data-act="msgfr" data-i="${i}">${m.showFr ? 'Masquer' : 'Traduire'}</button></div>
      </div>${nw}</div>`;
    }
    const c = m.correction;
    let corr = '';
    if (c) {
      corr = c.ok
        ? `<div class="corr ok">✓ ${esc(c.explanation || 'Parfait !')}</div>`
        : `<div class="corr ko"><div class="small">Tu pourrais dire :</div><div class="row" style="gap:8px"><div class="grow"><div class="hzf" style="font-size:20px">${esc(c.corrected)}</div><div class="small muted">${esc(c.pinyin || '')}</div></div><button class="spk" style="width:38px;height:38px;font-size:16px;margin:0" data-act="speak" data-text="${esc(c.corrected)}">🔊</button></div>${c.explanation ? `<div class="small" style="margin-top:4px">${esc(c.explanation)}</div>` : ''}</div>`;
    }
    return `<div class="msg me"><div class="bubble">${m.heard ? '<span class="small muted">🎤 </span>' : ''}${esc(m.text)}</div>${corr}</div>`;
  }).join('') + (v.busy ? '<div class="msg ai"><div class="bubble typing"><i></i><i></i><i></i></div></div>' : '');
  box.scrollTop = box.scrollHeight;
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });

  const sg = document.getElementById('sugg');
  sg.innerHTML = v.busy ? '' : v.sugg.map((s, i) => `<button class="sg" data-act="sugg" data-i="${i}"><span class="hzf">${esc(s.zh)}</span>${py ? `<small>${esc(s.pinyin || '')}</small>` : ''}<small class="muted">${esc(s.fr || '')}</small></button>`).join('');

  const goals = document.getElementById('goals');
  if (goals) {
    goals.innerHTML = v.sc.goals.map((g, i) => `<span class="goal-chip ${v.goals.includes(i) ? 'done' : ''}">${v.goals.includes(i) ? '✓' : '○'} ${esc(g)}</span>`).join('');
    document.getElementById('goalcount').textContent = `Mission : ${v.goals.length}/${v.sc.goals.length} objectifs`;
  }
}

function newWordChip(nw, i) {
  const exists = WORDS.find(w => w.h === nw.h);
  const valid = !!splitPinyin(nw.p, [...nw.h].length);
  const btn = exists ? (S().intro[exists.id] ? '<span class="small muted">déjà appris</span>' : `<button class="chip" data-act="addword" data-i="${i}">+ Apprendre</button>`)
    : valid ? `<button class="chip" data-act="addword" data-i="${i}">+ Ajouter</button>` : '';
  return `<div class="newword">✨ <b class="hzf">${esc(nw.h)}</b> ${esc(nw.p || '')} — ${esc(nw.f || '')} ${btn}</div>`;
}

actions.chatpy = () => { S().settings.chatPinyin = !S().settings.chatPinyin; st.save(); document.querySelector('[data-act=chatpy]').classList.toggle('on'); paintChat(); };
actions.msgfr = (el) => { const m = view.msgs[+el.dataset.i]; m.showFr = !m.showFr; paintChat(); };
actions.sugg = (el) => {
  const s = view.sugg[+el.dataset.i];
  const inp = document.getElementById('chatin'); inp.value = s.zh;
  speak(s.zh);
};
actions.addword = (el) => {
  const nw = view.msgs[+el.dataset.i].new_word;
  addWord(nw); paintChat();
};
actions.send = () => {
  if (!view || view.busy) return;
  const inp = document.getElementById('chatin');
  const text = inp.value.trim();
  if (!text) return toast('Écris ou dis quelque chose 🙂');
  inp.value = '';
  view.msgs.push({ role: 'me', text, heard: view.lastHeard === text });
  view.lastHeard = null;
  askAI(text, false);
};

async function askAI(userText, hidden) {
  const v = view;
  v.api.push({ role: 'user', content: userText });
  v.busy = true; paintChat();
  try {
    const r = await chatJSON([{ role: 'system', content: v.sys }, ...v.api.slice(-18)], { temperature: 0.8 });
    if (view !== v) return; // fermé entre-temps
    if (!r.zh) throw new AIError('Réponse vide, réessaie.');
    v.api.push({ role: 'assistant', content: JSON.stringify({ zh: r.zh, goals_done: r.goals_done || [] }) });
    const me = !hidden && [...v.msgs].reverse().find(m => m.role === 'me');
    if (me && r.correction && r.correction.corrected !== undefined) me.correction = r.correction;
    else if (me && r.correction) me.correction = r.correction;
    v.msgs.push({ role: 'ai', zh: r.zh, pinyin: r.pinyin || '', fr: r.fr || '', new_word: r.new_word || null });
    v.sugg = Array.isArray(r.suggestions) ? r.suggestions.filter(s => s && s.zh).slice(0, 3) : [];
    if (!hidden) {
      logTime();
      const good = me?.correction?.ok;
      st.addXp(good ? 8 : 4);
      if (good) sfx.ok();
    }
    const gd = (Array.isArray(r.goals_done) ? r.goals_done : []).map(Number).filter(n => n >= 0 && n < v.sc.goals.length);
    for (const g of gd) if (!v.goals.includes(g)) v.goals.push(g);
    if (v.sc.goals.length && !v.done && v.goals.length === v.sc.goals.length) {
      v.done = true;
      S().missions[v.sc.id] = (S().missions[v.sc.id] || 0) + 1;
      st.addXp(50); st.touchStreak(); st.save();
      v.msgs.push({ role: 'sys', html: '🎉 <b>Mission accomplie !</b> +50 XP<br><span class="small">Tu peux continuer à discuter ou fermer la scène.</span>' });
      setTimeout(() => sfx.done(), 900);
    }
    speak(r.zh);
  } catch (e) {
    if (view !== v) return;
    v.api.pop();
    v.msgs.push({ role: 'sys', html: `⚠️ ${esc(e.message || 'Erreur')} <button class="chip" data-act="retry">Réessayer</button>` });
    v.retry = { userText, hidden };
  }
  v.busy = false; paintChat();
}
actions.retry = () => {
  const v = view; if (!v?.retry || v.busy) return;
  v.msgs = v.msgs.filter(m => m.role !== 'sys' || !m.html.includes('data-act="retry"'));
  const { userText, hidden } = v.retry; v.retry = null;
  askAI(userText, hidden);
};

// ---------- Micro : on parle, Whisper écrit ----------
let rec = null;
function pickMime() {
  if (!window.MediaRecorder) return null;
  for (const [t, ext] of [['audio/mp4', 'mp4'], ['audio/webm;codecs=opus', 'webm'], ['audio/webm', 'webm'], ['audio/ogg', 'ogg']]) {
    if (MediaRecorder.isTypeSupported?.(t)) return { t, ext };
  }
  return { t: '', ext: 'webm' };
}
actions.mic = async () => {
  if (rec) return stopRecording(false);
  const mime = pickMime();
  if (!mime || !navigator.mediaDevices?.getUserMedia) return toast('Micro non disponible sur cet appareil');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, mime.t ? { mimeType: mime.t } : undefined);
    const chunks = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec = { mr, stream, chunks, ext: mime.ext, cancel: false, t: Date.now() };
    mr.onstop = () => onRecorded(rec);
    mr.start();
    speechSynthesis?.cancel?.();
    document.getElementById('micbtn')?.classList.add('rec');
    toast('🎙️ Parle… touche à nouveau pour terminer', 3000);
  } catch (e) {
    toast('Autorise le micro pour Xué dans Safari (aA → Réglages du site)', 4000);
  }
};
function stopRecording(cancel) {
  if (!rec) return;
  rec.cancel = cancel;
  try { rec.mr.stop(); } catch (e) { /* déjà arrêté */ }
  rec.stream.getTracks().forEach(t => t.stop());
  document.getElementById('micbtn')?.classList.remove('rec');
}
async function onRecorded(r) {
  rec = null;
  if (r.cancel || !view) return;
  if (Date.now() - r.t < 600) return toast('Trop court : parle un peu plus longtemps');
  const blob = new Blob(r.chunks, { type: r.mr.mimeType || 'audio/' + r.ext });
  const inp = document.getElementById('chatin');
  const btn = document.getElementById('micbtn');
  if (btn) { btn.textContent = '…'; btn.disabled = true; }
  try {
    const text = await transcribe(blob, r.ext);
    if (!text) toast('Je n\'ai rien entendu, réessaie');
    else if (inp) { inp.value = text; view.lastHeard = text; toast('Vérifie puis envoie ➤'); }
  } catch (e) { toast(e.message || 'Transcription impossible', 3500); }
  if (btn) { btn.textContent = '🎤'; btn.disabled = false; }
}

// ================================================================
//  Histoires sur mesure
// ================================================================
async function generateStory() {
  const p = learnerProfile();
  const theme = THEMES[storyTheme][1];
  const nSent = p.n < 100 ? 6 : p.n < 300 ? 8 : 10;
  const m = openModal(`<div class="loading"><div class="spinner"></div><b>L'IA écrit ton histoire…</b><p class="muted small">Thème : ${esc(theme)}</p></div>`);
  const prompt = `Écris une courte histoire originale en chinois simplifié pour un élève francophone.
NIVEAU : ${p.level}. THÈME : ${theme === 'Surprise' ? 'au choix, original et amusant' : theme}.
LONGUEUR : ${nSent} phrases courtes et simples.
VOCABULAIRE : utilise presque uniquement ces mots connus : ${p.vocab}
Tu peux introduire AU MAXIMUM 3 mots nouveaux utiles, à lister dans "new_words".
Ajoute 3 questions de compréhension en français (4 choix chacune, une seule bonne réponse, indice "answer" commençant à 0).
Réponds UNIQUEMENT avec ce JSON :
{"title_zh":"…","title_fr":"…","sentences":[{"zh":"…","pinyin":"pinyin avec accents","fr":"traduction"}],"new_words":[{"h":"…","p":"pinyin, une syllabe par caractère séparées par des espaces","f":"sens en français"}],"questions":[{"q":"…","options":["…","…","…","…"],"answer":0}]}`;
  try {
    const r = await chatJSON([{ role: 'system', content: 'Tu es un auteur de lectures graduées pour apprenants de chinois. Tu réponds uniquement en JSON valide.' }, { role: 'user', content: prompt }], { temperature: 0.9, max_tokens: 2500 });
    if (!Array.isArray(r.sentences) || !r.sentences.length) throw new AIError('Histoire incomplète, réessaie.');
    const story = {
      title_zh: r.title_zh || '故事', title_fr: r.title_fr || 'Histoire', theme, date: Date.now(),
      sentences: r.sentences.filter(x => x && x.zh),
      new_words: (r.new_words || []).filter(x => x && x.h).slice(0, 3),
      questions: (r.questions || []).filter(q => q && Array.isArray(q.options) && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length).slice(0, 3),
      score: null,
    };
    S().stories.unshift(story); S().stories = S().stories.slice(0, 15); st.save();
    m.remove();
    openStory(story);
  } catch (e) {
    m.remove();
    toast(e.message || 'Erreur', 3500);
  }
}

function openStory(story) {
  view = { type: 'story', s: story, open: new Set(), answers: {}, t: Date.now() };
  ui.rerender();
  window.scrollTo(0, 0);
}

function renderStory(app) {
  const { s, open, answers } = view;
  const py = S().settings.chatPinyin;
  const allText = s.sentences.map(x => x.zh).join('');
  const qs = s.questions.map((q, qi) => {
    const a = answers[qi];
    return `<div class="card"><b>${qi + 1}. ${esc(q.q)}</b><div class="opts" style="margin-top:10px">${q.options.map((o, oi) => {
      const cls = a == null ? '' : oi === q.answer ? 'right' : oi === a ? 'wrong' : '';
      return `<button class="opt ${cls}" data-act="sq" data-q="${qi}" data-o="${oi}">${esc(o)}</button>`;
    }).join('')}</div></div>`;
  }).join('');
  const done = s.questions.length && Object.keys(answers).length === s.questions.length;
  app.innerHTML = `<div class="screen story">
    <div class="chat-top" style="padding:0 0 10px">
      <button class="x" data-act="aiclose" aria-label="Fermer">✕</button>
      <div class="grow"><b class="hzf" style="font-size:20px">${esc(s.title_zh)}</b><div class="small muted">${esc(s.title_fr)}</div></div>
      <button class="chip ${py ? 'on' : ''}" data-act="storypy">拼音</button>
    </div>
    <div class="row" style="margin-bottom:12px"><button class="btn sm" data-act="speak" data-text="${esc(allText)}">▶ Tout écouter</button><button class="btn sm ghost" data-act="speak" data-slow="1" data-text="${esc(allText)}">🐢 Lentement</button></div>
    <p class="muted small" style="margin:0 0 10px">Touche une phrase pour voir la traduction.</p>
    <div class="card" style="padding:6px 14px">${s.sentences.map((x, i) => `<div class="sent" data-act="sent" data-i="${i}">
      <div class="row" style="align-items:flex-start"><div class="grow"><div class="hzf zh">${esc(x.zh)}</div>${py ? `<div class="py">${esc(x.pinyin || '')}</div>` : ''}${open.has(i) ? `<div class="fr">${esc(x.fr || '')}</div>` : ''}</div>
      <button class="spk" style="width:38px;height:38px;font-size:16px;margin:0;flex:none" data-act="speak" data-text="${esc(x.zh)}" aria-label="Écouter">🔊</button></div></div>`).join('')}</div>
    ${s.new_words.length ? `<p class="sec-title">Mots nouveaux</p><div class="card">${s.new_words.map((w, i) => {
      const ex = WORDS.find(x => x.h === w.h); const valid = !!splitPinyin(w.p, [...w.h].length);
      const btn = ex && S().intro[ex.id] ? '<span class="small muted">déjà appris</span>' : (ex || valid) ? `<button class="chip" data-act="storyword" data-i="${i}">+ Apprendre</button>` : '';
      return `<div class="row" style="padding:8px 0"><button data-act="speak" data-text="${esc(w.h)}" class="hzf" style="font-size:26px">${esc(w.h)}</button><div class="grow"><div>${esc(w.p)}</div><div class="small muted">${esc(w.f)}</div></div>${btn}</div>`;
    }).join('')}</div>` : ''}
    ${qs ? `<p class="sec-title">Compréhension</p>${qs}` : ''}
    ${done ? `<div class="card" style="text-align:center"><div style="font-size:42px">${s.score === s.questions.length ? '🏆' : '👍'}</div><b>${s.score}/${s.questions.length} bonnes réponses</b></div>` : ''}
    <button class="btn ghost" data-act="aiclose" style="margin-top:8px">Terminer</button>
  </div>`;
}
actions.storypy = () => { S().settings.chatPinyin = !S().settings.chatPinyin; st.save(); ui.rerender(); };
actions.sent = (el, e) => {
  if (e.target.closest('[data-act=speak]')) return;
  const i = +el.dataset.i; view.open.has(i) ? view.open.delete(i) : view.open.add(i); ui.rerender();
};
actions.sq = (el) => {
  const q = +el.dataset.q, o = +el.dataset.o, s = view.s;
  if (view.answers[q] != null) return;
  view.answers[q] = o;
  const ok = o === s.questions[q].answer;
  ok ? sfx.ok() : sfx.ko();
  if (Object.keys(view.answers).length === s.questions.length) {
    const score = s.questions.filter((qq, i) => view.answers[i] === qq.answer).length;
    const first = s.score == null;
    s.score = score; logTime();
    if (first) { st.addXp(10 + score * 5); st.touchStreak(); toast(`+${10 + score * 5} XP`); }
    st.save();
  }
  const y = window.scrollY; ui.rerender(); window.scrollTo(0, y);
};
actions.storyword = (el) => {
  const w = view.s.new_words[+el.dataset.i];
  addWord(w);
  const y = window.scrollY; ui.rerender(); window.scrollTo(0, y);
};

function addWord(nw) {
  const ex = WORDS.find(x => x.h === nw.h);
  if (ex) { st.introduce(ex.id); st.save(); toast(`« ${ex.h} » ajouté à tes révisions`); return; }
  const py = splitPinyin(nw.p, [...nw.h].length);
  if (!py) return toast('Pinyin incomplet, mot non ajouté');
  const w = st.addCustomWord(nw.h, py, (nw.f || '').trim());
  toast(`« ${w.h} » ajouté à tes mots ✓`);
}

// ================================================================
//  « Explique-moi ce mot »
// ================================================================
actions.explain = async (el) => {
  if (!hasKey()) return toast('Connecte d\'abord l\'IA dans l\'onglet Prof IA');
  const w = WORD_BY_ID[el.dataset.id];
  closeModal();
  const cached = S().aiCache[w.id];
  const m = openModal(cached ? explainHtml(w, cached) : `<div class="loading"><div class="spinner"></div><b>Le prof prépare l'explication…</b></div>`);
  if (cached) return;
  const p = learnerProfile();
  try {
    const r = await chatJSON([
      { role: 'system', content: 'Tu es un professeur de chinois mandarin pédagogue pour francophones. Tu réponds uniquement en JSON valide.' },
      { role: 'user', content: `Explique le mot « ${w.h} » (${w.p}) qui signifie « ${w.f} » à un élève de niveau ${p.level}.
Réponds avec ce JSON :
{"explication":"2 à 3 phrases en français : sens, usage, nuances, grammaire (place dans la phrase, mots qui vont avec)","caracteres":"sens ou image de chaque caractère, en une phrase courte en français","exemples":[{"zh":"phrase simple","pinyin":"pinyin avec accents","fr":"traduction"}],"astuce":"un moyen mnémotechnique ou un piège fréquent pour un francophone"}
Donne exactement 3 exemples courts avec un vocabulaire simple, de préférence parmi : ${p.vocab.slice(0, 1500)}` },
    ], { temperature: 0.5 });
    S().aiCache[w.id] = r; st.save();
    m.querySelector('.modal').innerHTML = explainHtml(w, r);
  } catch (e) {
    m.querySelector('.modal').innerHTML = `<p>⚠️ ${esc(e.message || 'Erreur')}</p><button class="btn ghost" data-act="close">Fermer</button>`;
  }
};
function explainHtml(w, r) {
  return `<div style="text-align:center">${ruby(w, true).replace('class="hz"', 'class="hz" style="font-size:46px"')}<div style="font-weight:700">${esc(w.f)}</div>
    <button class="spk" data-act="speak" data-text="${esc(w.h)}">🔊</button></div>
    <div class="card"><b>📘 Explication</b><p style="margin:6px 0 0">${esc(r.explication || '')}</p>${r.caracteres ? `<p class="muted small" style="margin:8px 0 0">🧩 ${esc(r.caracteres)}</p>` : ''}</div>
    ${(r.exemples || []).length ? `<div class="card"><b>💬 Exemples</b>${r.exemples.map(x => `<div class="row" style="padding:8px 0;border-bottom:1px solid var(--line)"><div class="grow"><div class="hzf" style="font-size:19px">${esc(x.zh)}</div><div class="small muted">${esc(x.pinyin || '')}</div><div class="small">${esc(x.fr || '')}</div></div><button class="spk" style="width:38px;height:38px;font-size:16px;margin:0;flex:none" data-act="speak" data-text="${esc(x.zh)}">🔊</button></div>`).join('')}</div>` : ''}
    ${r.astuce ? `<div class="card"><b>💡 Astuce</b><p style="margin:6px 0 0">${esc(r.astuce)}</p></div>` : ''}
    <button class="btn ghost" data-act="close">Fermer</button>`;
}

// ================================================================
//  Réglages IA
// ================================================================
let modelList = null;
export function settingsSection() {
  const s = S().settings;
  const models = modelList || (s.groqModel ? [s.groqModel] : []);
  return `<div class="card">
    <div class="set"><label>Clé API Groq<span class="muted">Stockée uniquement sur ce téléphone</span></label><input type="password" data-set="groqKey" value="${esc(s.groqKey)}" placeholder="gsk_…" autocomplete="off"></div>
    <div class="set"><label>Modèle d'IA<span class="muted">Auto = le meilleur en chinois disponible</span></label>
      <select data-set="groqModel">${models.map(m => `<option value="${esc(m)}" ${m === s.groqModel ? 'selected' : ''}>${esc(m.split('/').pop())}</option>`).join('') || '<option value="">Auto</option>'}</select></div>
    <div class="set"><label>Vérifier la connexion</label><button class="btn ghost sm" data-act="aitest">Tester</button></div>
  </div>`;
}
export function afterSettings() {}
actions.aitest = async (el) => {
  if (!hasKey()) return toast('Colle d\'abord ta clé Groq');
  el.disabled = true; el.textContent = '…';
  try {
    if (!S().settings.groqModel) await autoPickModel();
    modelList = await listModels();
    if (!modelList.includes(S().settings.groqModel)) await autoPickModel();
    toast('Connexion OK ✓');
    ui.rerender();
  } catch (e) {
    toast(e.message || 'Erreur', 3500);
    el.disabled = false; el.textContent = 'Tester';
  }
};
