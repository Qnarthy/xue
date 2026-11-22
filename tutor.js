// Prof IA : appel vocal, jeux de rôle avec missions, histoires sur mesure, explications de mots.
import * as st from './store.js';
import { WORDS, WORD_BY_ID } from './data.js';
import { speak, sfx } from './audio.js';
import { splitPinyin } from './pinyin.js';
import { esc, toast, actions, ui, openModal, closeModal, ruby, face, pyColor } from './ui.js';
import { chatJSON, transcribe, autoPickModel, listModels, hasKey, learnerProfile, AIError } from './ai.js';
import { openMic, closeMic, recordAuto } from './pitch.js';

const S = () => st.S;
let view = null; // vue plein écran en cours : discussion ou histoire
export const isOpen = () => !!view;

// ================================================================
//  Les scènes de jeu de rôle
// ================================================================
const SCENARIOS = [
  { id: 'free', icon: '🧑‍🏫', who: 'Lǎoshī', lvl: 'Tous niveaux', title: 'Conversation libre', desc: 'Parle de tout : ta vie, tes goûts, la Chine.', role: 'Tu es Lǎoshī 老师, un professeur chinois chaleureux et drôle. Conversation libre : la vie de l\'élève, ses goûts, ses projets, la Chine, la culture chinoise. Pose des questions sur lui.', goals: [] },
  { id: 'intro', icon: '👋', who: 'Lǐ Míng', lvl: 'HSK 1', title: 'Se présenter', desc: 'Tu rencontres Lǐ Míng, un étudiant chinois.', role: 'Tu es Lǐ Míng 李明, 22 ans, étudiant sympathique à Pékin. Tu rencontres l\'élève pour la première fois dans un café.', goals: ['Dire bonjour', 'Dire ton prénom', 'Dire ta nationalité', 'Demander son âge'] },
  { id: 'resto', icon: '🍜', who: 'Le serveur', lvl: 'HSK 1', title: 'Au restaurant', desc: 'Commande dans un petit restaurant de nouilles.', role: 'Tu es serveur dans un petit restaurant de nouilles à Pékin. Tu accueilles l\'élève, tu proposes le menu (面条, 米饭, 饺子, 茶, 啤酒…).', goals: ['Commander un plat', 'Commander une boisson', 'Demander le prix', 'Payer et dire merci'] },
  { id: 'taxi', icon: '🚕', who: 'Le chauffeur', lvl: 'HSK 1', title: 'Prendre un taxi', desc: 'Un chauffeur bavard à Shanghai.', role: 'Tu es chauffeur de taxi à Shanghai, bavard et curieux. L\'élève monte dans ton taxi.', goals: ['Dire où tu vas', 'Demander si c\'est loin', 'Répondre à une question perso', 'Payer et dire au revoir'] },
  { id: 'shop', icon: '🍎', who: 'La vendeuse', lvl: 'HSK 1', title: 'Au marché', desc: 'Marchande des fruits avec une vendeuse.', role: 'Tu es une vendeuse de fruits au marché, souriante mais tu annonces des prix un peu élevés et tu acceptes de négocier.', goals: ['Demander le prix', 'Dire que c\'est trop cher', 'Négocier un prix', 'Acheter des fruits'] },
  { id: 'way', icon: '🗺️', who: 'Un passant', lvl: 'HSK 1', title: 'Demander son chemin', desc: 'Trouve le métro dans les rues de Pékin.', role: 'Tu es un passant à Pékin. L\'élève est perdu. Le métro est à 10 minutes à pied : tout droit puis à gauche.', goals: ['Demander où est le métro', 'Comprendre la direction', 'Demander si c\'est loin', 'Remercier'] },
  { id: 'hotel', icon: '🏨', who: 'La réceptionniste', lvl: 'HSK 2', title: 'À l\'hôtel', desc: 'Arrivée à la réception d\'un hôtel.', role: 'Tu es réceptionniste dans un hôtel à Xi\'an. L\'élève arrive avec une réservation.', goals: ['Dire que tu as réservé', 'Donner ton nom', 'Demander l\'heure du petit-déjeuner', 'Demander le mot de passe wifi'] },
  { id: 'friend', icon: '☕', who: 'Wáng Fāng', lvl: 'HSK 2', title: 'Café avec une amie', desc: 'Discute loisirs et week-end avec Wáng Fāng.', role: 'Tu es Wáng Fāng 王芳, une amie chinoise de l\'élève. Vous buvez un café et parlez de vos loisirs et du week-end.', goals: ['Parler de tes loisirs', 'Parler de ton week-end', 'Proposer une activité', 'Fixer un jour et une heure'] },
  { id: 'doctor', icon: '🩺', who: 'La docteure', lvl: 'HSK 2-3', title: 'Chez le médecin', desc: 'Explique tes symptômes et comprends le conseil.', role: 'Tu es médecin dans un hôpital de Pékin, calme et rassurante. L\'élève est malade.', goals: ['Dire où tu as mal', 'Dire depuis quand', 'Comprendre le conseil du médecin', 'Remercier'] },
];

const THEMES = [['🎲', 'Surprise'], ['✈️', 'Voyage en Chine'], ['🏠', 'Vie quotidienne'], ['🏮', 'Culture et fêtes chinoises'], ['❤️', 'Rencontre et amitié'], ['😂', 'Histoire drôle']];
let storyTheme = 0;

// ================================================================
//  Onglet « Prof IA »
// ================================================================
export function aiScreen() {
  if (!hasKey()) return setupCard();
  const s = S();
  const free = SCENARIOS[0];
  const done = SCENARIOS.filter(x => s.missions[x.id]).length;
  const list = SCENARIOS.slice(1).map(x => {
    const n = s.missions[x.id] || 0;
    return `<button class="scard" data-act="scen" data-id="${x.id}">
      <span class="scic">${x.icon}</span>
      <span class="grow"><b>${esc(x.title)}</b><span class="sub">${esc(x.desc)}</span>
        <span class="smeta"><span class="lvtag">${esc(x.lvl)}</span>${n ? `<span class="okmark">✓ Mission réussie${n > 1 ? ' ×' + n : ''}</span>` : `<span class="muted">${x.goals.length} objectifs</span>`}</span></span>
      <span class="chev">›</span></button>`;
  }).join('');
  const stories = s.stories.slice(0, 6).map((x, i) => `<button class="scard slim" data-act="storyopen" data-i="${i}">
      <span class="scic">📖</span><span class="grow"><b class="hzf">${esc(x.title_zh)}</b><span class="sub">${esc(x.title_fr)}</span></span>
      <span class="muted small">${x.score != null ? `${x.score}/${x.questions.length}` : 'à lire'}</span><span class="chev">›</span></button>`).join('');
  return `<div class="topbar"><h1>Prof IA</h1><span class="pill dim small" title="Modèle d'IA utilisé">⚡ ${esc((s.settings.groqModel || 'auto').split('/').pop().replace(/-instruct.*/, ''))}</span></div>
  <div class="callhero">
    <div class="ch-av">${free.icon}</div>
    <div class="grow"><span class="eyebrow">Ton prof perso</span><h2>Parle avec Lǎoshī</h2>
      <p>Il te répond à voix haute, corrige chaque phrase et s'adapte à tes mots.</p></div>
  </div>
  <div class="row two-btn">
    <button class="btn" data-act="call" data-id="free">📞 Appel vocal</button>
    <button class="btn ghost" data-act="write" data-id="free">💬 Écrire</button>
  </div>
  <div class="sec-row"><p class="sec-title">Jeux de rôle</p><span class="small muted">${done}/${SCENARIOS.length - 1} missions</span></div>
  <div class="slist">${list}</div>
  <p class="sec-title">Lecture sur mesure</p>
  <div class="card storygen">
    <b>Une histoire écrite pour toi</b>
    <p class="muted small" style="margin:4px 0 12px">Avec tes mots connus et 3 mots nouveaux maximum, suivie de questions.</p>
    <div class="themes">${THEMES.map(([ic, l], i) => `<button class="chip ${storyTheme === i ? 'on' : ''}" data-act="theme" data-i="${i}">${ic} ${esc(l)}</button>`).join('')}</div>
    <button class="btn" data-act="storygen">✨ Écrire mon histoire</button>
  </div>
  ${stories ? `<div class="slist">${stories}</div>` : ''}`;
}

function setupCard() {
  return `<div class="topbar"><h1>Prof IA</h1></div>
  <div class="callhero"><div class="ch-av">🧑‍🏫</div><div class="grow"><span class="eyebrow">Gratuit avec Groq</span><h2>Ton prof de chinois perso</h2>
    <p>Appels vocaux, jeux de rôle corrigés, histoires à ton niveau.</p></div></div>
  <div class="card">
    <b>Connecter l'IA (une seule fois, 2 min)</b>
    <ol class="steps">
      <li>Ouvre <b>console.groq.com</b> dans Safari et crée un compte gratuit (« Continuer avec Google » marche).</li>
      <li>Va dans <b>API Keys</b> puis touche <b>Create API Key</b>, nomme-la « Xué ».</li>
      <li>Copie la clé (elle commence par <code>gsk_</code>) et colle-la ci-dessous.</li>
    </ol>
    <input id="aikey" class="search" type="password" placeholder="gsk_…" autocomplete="off" autocapitalize="off" spellcheck="false" style="margin:6px 0 12px">
    <button class="btn" data-act="aiconnect">Connecter</button>
    <p class="muted small" style="margin:10px 0 0">🔒 La clé reste uniquement sur ce téléphone. Ne la partage jamais.</p>
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
actions.theme = (el) => { storyTheme = +el.dataset.i; document.querySelectorAll('[data-act=theme]').forEach(b => b.classList.toggle('on', b === el)); };
// une scène : on choisit appel vocal ou écrit
actions.scen = (el) => {
  const sc = SCENARIOS.find(x => x.id === el.dataset.id);
  openModal(`<div class="scmodal"><div class="scic big">${sc.icon}</div><h2>${esc(sc.title)}</h2><p class="muted">${esc(sc.desc)}</p>
    ${sc.goals.length ? `<div class="goalbox"><b>Ta mission</b>${sc.goals.map(g => `<div class="gl">○ ${esc(g)}</div>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn" data-act="call" data-id="${sc.id}">📞 En appel vocal</button><button class="btn ghost" data-act="write" data-id="${sc.id}">💬 Par écrit</button></div></div>`);
};
actions.call = (el) => { closeModal(); openChat(SCENARIOS.find(x => x.id === el.dataset.id), true); };
actions.write = (el) => { closeModal(); openChat(SCENARIOS.find(x => x.id === el.dataset.id), false); };
actions.storygen = () => generateStory();
actions.storyopen = (el) => openStory(S().stories[+el.dataset.i]);
actions.aiclose = () => closeView();

function closeView() {
  if (view?.type === 'chat') { logTime(); stopListening(true); closeMic(); }
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
  if (view.type === 'chat') return view.call ? renderCall(app) : renderChat(app);
  if (view.type === 'story') return renderStory(app);
}

// ================================================================
//  Discussion (jeu de rôle)
// ================================================================
function systemPrompt(sc) {
  const p = learnerProfile();
  return `Tu es un partenaire de conversation ET un professeur de chinois mandarin pour un élève francophone qui veut surtout apprendre à PARLER.
SCÈNE : ${sc.role}
OBJECTIFS DE L'ÉLÈVE : ${sc.goals.length ? sc.goals.map((g, i) => `${i}. ${g}`).join(' ; ') : 'aucun (conversation libre)'}
NIVEAU : ${p.level}. Vocabulaire connu : ${p.vocab}
RÈGLES :
1. Joue ton rôle en chinois simplifié très simple et naturel à l'oral : 1 à 2 phrases courtes${p.n < 150 ? ' (25 caractères maximum au total)' : ''}. Utilise presque uniquement le vocabulaire connu. Au maximum UN mot nouveau par réplique, seulement s'il est utile ; dans ce cas, décris-le dans "new_word".
2. Termine par une question simple pour faire parler l'élève et l'amener vers les objectifs pas encore atteints.
3. Analyse le DERNIER message de l'élève (sauf pour la toute première réplique : "correction": null) :
   - Si le message commence par « (oral) », c'est une transcription automatique de sa voix : ignore la ponctuation et les caractères homophones mal transcrits ; juge la grammaire, les mots et l'ordre des mots.
   - écrit en chinois ou en pinyin : "ok": true s'il est correct et naturel (ignore les tons absents et les petites fautes de frappe). Sinon "ok": false et donne la version correcte et naturelle.
   - écrit en français (il ne sait pas dire) : "ok": false et donne dans "corrected" la phrase chinoise qu'il aurait pu dire.
   - "explanation" : une phrase courte et bienveillante en français, avec la règle de grammaire si utile.
4. "suggestions" : exactement 3 réponses courtes et variées que l'élève pourrait dire ensuite, à son niveau.
5. "goals_done" : numéros de TOUS les objectifs que l'élève a atteints depuis le début (cumulés).
Réponds UNIQUEMENT avec ce JSON, sans aucun autre texte :
{"zh":"ta réplique","pinyin":"pinyin avec accents, un mot par groupe séparé par des espaces","fr":"traduction française","correction":null,"new_word":null,"goals_done":[],"suggestions":[{"zh":"…","pinyin":"…","fr":"…"}]}
où "correction" vaut null ou {"ok":true,"corrected":"…","pinyin":"…","explanation":"…"} et "new_word" vaut null ou {"h":"caractères","p":"pinyin, une syllabe par caractère séparées par des espaces","f":"sens en français"}.`;
}

function openChat(sc, call) {
  view = { type: 'chat', sc, call, msgs: [], api: [], goals: [], sugg: [], busy: false, done: false, t: Date.now(), sys: systemPrompt(sc), phase: 'idle', showSugg: false };
  ui.rerender();
  askAI('(Début de la scène : salue l\'élève et lance la conversation selon ton rôle.)', true);
}

// bloc chinois d'une réplique : mode oral = pinyin en premier
function zhBlock(zh, pinyin, big) {
  const py = S().settings.chatPinyin && pinyin;
  if (st.isOral() && py) return `<div class="lpy ${big ? 'big' : ''}">${pyColor(pinyin)}</div><div class="lzh sm hzf">${esc(zh)}</div>`;
  return `<div class="lzh hzf ${big ? 'big' : ''}">${esc(zh)}</div>${py ? `<div class="lpy sm">${pyColor(pinyin)}</div>` : ''}`;
}
function corrHtml(c) {
  if (!c) return '';
  if (c.ok) return `<div class="corr ok"><span class="cic">✓</span><span>${esc(c.explanation || 'Parfait !')}</span></div>`;
  return `<div class="corr ko"><div class="ctitle">💡 Plus naturel :</div>
    <div class="crow"><div class="grow">${zhBlock(c.corrected || '', c.pinyin || '')}</div><button class="spk sm2" data-act="speak" data-text="${esc(c.corrected || '')}" aria-label="Écouter">🔊</button></div>
    ${c.explanation ? `<div class="cexp">${esc(c.explanation)}</div>` : ''}</div>`;
}
function goalsHtml(v) {
  if (!v.sc.goals.length) return '';
  const n = v.goals.length, N = v.sc.goals.length;
  return `<div class="mission"><div class="mtop"><b>Mission</b><span class="muted small">${n}/${N}</span></div>
    <div class="mbar"><i style="width:${(n / N) * 100}%"></i></div>
    <div class="goals">${v.sc.goals.map((g, i) => `<span class="goal-chip ${v.goals.includes(i) ? 'done' : ''}">${v.goals.includes(i) ? '✓' : '○'} ${esc(g)}</span>`).join('')}</div></div>`;
}
function suggHtml(v) {
  if (!v.sugg.length || v.busy) return '';
  return `<div class="sugg-panel">${v.sugg.map((s, i) => `<div class="sgrow"><button class="grow sgtxt" data-act="sugg" data-i="${i}">${zhBlock(s.zh, s.pinyin || '')}<div class="sgfr">${esc(s.fr || '')}</div></button><button class="spk sm2" data-act="speak" data-text="${esc(s.zh)}" aria-label="Écouter">🔊</button></div>`).join('')}</div>`;
}

function renderChat(app) {
  const v = view, sc = v.sc;
  app.innerHTML = `<div class="chat">
    <div class="chat-top">
      <button class="x" data-act="aiclose" aria-label="Fermer">✕</button>
      <span class="avatar">${sc.icon}</span>
      <div class="grow"><b>${esc(sc.who)}</b><div class="small muted">${esc(sc.title)}</div></div>
      <button class="chip ${S().settings.chatPinyin ? 'on' : ''}" data-act="chatpy" title="Afficher le pinyin">拼音</button>
      <button class="iconbtn" data-act="tocall" aria-label="Passer en appel vocal">📞</button>
    </div>
    <div id="goalsbox"></div>
    <div class="msgs" id="msgs"></div>
    <div id="suggbox"></div>
    <div class="composer">
      <button class="ideas ${v.showSugg ? 'on' : ''}" data-act="ideas" aria-label="Idées de réponse">💡</button>
      <input id="chatin" placeholder="Chinois, pinyin ou français…" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send">
      <button class="mic" data-act="mic" id="micbtn" aria-label="Parler">🎤</button>
      <button class="send" data-act="send" aria-label="Envoyer">➤</button>
    </div>
  </div>`;
  const inp = document.getElementById('chatin');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); actions.send(); } });
  paintChat();
}

function paintChat() {
  const v = view; if (!v || v.type !== 'chat') return;
  if (v.call) return paintCall();
  const sc = v.sc;
  const box = document.getElementById('msgs'); if (!box) return;
  box.innerHTML = v.msgs.map((m, i) => {
    if (m.role === 'sys') return `<div class="msg sys">${m.html}</div>`;
    if (m.role === 'ai') {
      const nw = m.new_word && m.new_word.h ? newWordChip(m.new_word, i) : '';
      return `<div class="msg ai"><div class="bubble">${zhBlock(m.zh, m.pinyin)}
        ${m.showFr ? `<div class="lfr">${esc(m.fr)}</div>` : ''}
        <div class="tools"><button data-act="speak" data-text="${esc(m.zh)}" aria-label="Écouter">🔊</button><button data-act="speak" data-slow="1" data-text="${esc(m.zh)}" aria-label="Lentement">🐢</button><button data-act="msgfr" data-i="${i}">${m.showFr ? 'Masquer' : 'Traduire'}</button></div>
      </div>${nw}</div>`;
    }
    return `<div class="msg me"><div class="bubble">${m.heard ? '<span class="heardtag">🎤</span>' : ''}${esc(m.text)}</div>${corrHtml(m.correction)}</div>`;
  }).join('') + (v.busy ? `<div class="msg ai"><div class="bubble typing"><i></i><i></i><i></i></div></div>` : '');
  box.scrollTop = box.scrollHeight;
  requestAnimationFrame(() => { box.scrollTop = box.scrollHeight; });
  document.getElementById('goalsbox').innerHTML = goalsHtml(v);
  document.getElementById('suggbox').innerHTML = v.showSugg ? suggHtml(v) : '';
  document.querySelector('.ideas')?.classList.toggle('on', v.showSugg);
}

function newWordChip(nw, i) {
  const exists = WORDS.find(w => w.h === nw.h);
  const valid = !!splitPinyin(nw.p, [...nw.h].length);
  const btn = exists ? (S().intro[exists.id] ? '<span class="small muted">déjà appris</span>' : `<button class="chip" data-act="addword" data-i="${i}">+ Apprendre</button>`)
    : valid ? `<button class="chip" data-act="addword" data-i="${i}">+ Apprendre</button>` : '';
  return `<div class="newword"><span class="nwtag">Mot nouveau</span><span class="grow"><b>${pyColor(nw.p || '')}</b> <span class="hzf">${esc(nw.h)}</span> · ${esc(nw.f || '')}</span>${btn}</div>`;
}

actions.chatpy = () => { S().settings.chatPinyin = !S().settings.chatPinyin; st.save(); document.querySelector('[data-act=chatpy]')?.classList.toggle('on'); paintChat(); };
actions.msgfr = (el) => { const m = view.msgs[+el.dataset.i]; m.showFr = !m.showFr; paintChat(); };
actions.ideas = () => { view.showSugg = !view.showSugg; paintChat(); };
actions.sugg = (el) => {
  const s = view.sugg[+el.dataset.i];
  speak(s.zh);
  if (view.call) return;
  const inp = document.getElementById('chatin'); inp.value = s.zh;
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
  sendText(text, view.lastHeard === text);
  view.lastHeard = null;
};
function sendText(text, heard) {
  view.msgs.push({ role: 'me', text, heard });
  view.showSugg = false;
  askAI(heard ? '(oral) ' + text : text, false);
}

async function askAI(userText, hidden) {
  const v = view;
  v.api.push({ role: 'user', content: userText });
  v.busy = true; v.phase = 'think'; paintChat();
  try {
    const r = await chatJSON([{ role: 'system', content: v.sys }, ...v.api.slice(-18)], { temperature: 0.8 });
    if (view !== v) return; // fermé entre-temps
    if (!r.zh) throw new AIError('Réponse vide, réessaie.');
    v.api.push({ role: 'assistant', content: JSON.stringify({ zh: r.zh, goals_done: r.goals_done || [] }) });
    const me = !hidden && [...v.msgs].reverse().find(m => m.role === 'me');
    if (me && r.correction) me.correction = r.correction;
    v.msgs.push({ role: 'ai', zh: r.zh, pinyin: r.pinyin || '', fr: r.fr || '', new_word: r.new_word || null });
    v.sugg = Array.isArray(r.suggestions) ? r.suggestions.filter(s => s && s.zh).slice(0, 3) : [];
    if (!hidden) {
      logTime();
      const good = me?.correction?.ok;
      st.addXp(good ? 8 : 4);
      v.turns = (v.turns || 0) + 1; if (good) v.good = (v.good || 0) + 1;
      if (good) sfx.ok();
    }
    const gd = (Array.isArray(r.goals_done) ? r.goals_done : []).map(Number).filter(n => n >= 0 && n < v.sc.goals.length);
    for (const g of gd) if (!v.goals.includes(g)) v.goals.push(g);
    if (v.sc.goals.length && !v.done && v.goals.length === v.sc.goals.length) {
      v.done = true;
      S().missions[v.sc.id] = (S().missions[v.sc.id] || 0) + 1;
      st.addXp(50); st.touchStreak(); st.save();
      v.msgs.push({ role: 'sys', html: '🎉 <b>Mission accomplie !</b> +50 XP<br><span class="small">Tu peux continuer à discuter ou terminer.</span>' });
      setTimeout(() => sfx.done(), 900);
    }
    v.busy = false; v.phase = 'speak'; paintChat();
    // en appel : quand le prof a fini de parler, le micro s'ouvre tout seul
    speak(r.zh, undefined, () => {
      if (view !== v) return;
      v.phase = 'idle';
      if (v.call && S().settings.voiceAuto) startListening(); else paintChat();
    });
    return;
  } catch (e) {
    if (view !== v) return;
    v.api.pop();
    v.msgs.push({ role: 'sys', html: `⚠️ ${esc(e.message || 'Erreur')} <button class="chip" data-act="retry">Réessayer</button>` });
    v.retry = { userText, hidden };
  }
  v.busy = false; v.phase = 'idle'; paintChat();
}
actions.retry = () => {
  const v = view; if (!v?.retry || v.busy) return;
  v.msgs = v.msgs.filter(m => m.role !== 'sys' || !m.html.includes('data-act="retry"'));
  const { userText, hidden } = v.retry; v.retry = null;
  askAI(userText, hidden);
};

// ---------- Micro : on parle, Whisper écrit (arrêt automatique au silence) ----------
async function startListening() {
  const v = view; if (!v || v.busy || v.phase === 'listen') return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Micro non disponible sur cet appareil');
  try { await openMic(); } catch (e) { v.phase = 'idle'; paintChat(); return toast('Autorise le micro pour Xué (Safari : aA → Réglages du site)', 4000); }
  speechSynthesis?.cancel?.();
  v.phase = 'listen'; v.cancelRec = false; paintChat();
  const t0 = Date.now();
  v.rec = await recordAuto({ maxMs: 15000, silenceMs: 1400, onLevel: (l) => document.querySelectorAll('.lvl-ring').forEach(e => e.style.setProperty('--lv', l.toFixed(2))) });
  const blob = await v.rec.done;
  v.rec = null;
  if (view !== v || v.cancelRec) { if (view === v) { v.phase = 'idle'; paintChat(); } return; }
  if (Date.now() - t0 < 700) { v.phase = 'idle'; paintChat(); return toast('Trop court : parle un peu plus longtemps'); }
  v.phase = 'transcribe'; paintChat();
  try {
    const text = await transcribe(blob, v.recExt || (blob.type.includes('mp4') ? 'mp4' : 'webm'));
    if (view !== v) return;
    if (!text || !/[㐀-鿿A-Za-z]/.test(text)) { v.phase = 'idle'; v.lastMiss = true; paintChat(); return toast('Je n\'ai rien entendu, réessaie'); }
    v.lastMiss = false;
    if (v.call || S().settings.voiceAuto) { v.phase = 'idle'; sendText(text, true); }
    else { v.phase = 'idle'; const inp = document.getElementById('chatin'); if (inp) inp.value = text; v.lastHeard = text; paintChat(); toast('Vérifie puis envoie ➤'); }
  } catch (e) { if (view === v) { v.phase = 'idle'; paintChat(); } toast(e.message || 'Transcription impossible', 3500); }
}
function stopListening(cancel) {
  const v = view; if (!v?.rec) return;
  v.cancelRec = cancel;
  v.rec.stop();
}
actions.mic = () => {
  const v = view; if (!v) return;
  if (v.phase === 'listen') return stopListening(false);
  if (v.phase === 'speak') { speechSynthesis?.cancel?.(); v.phase = 'idle'; }
  if (v.busy || v.phase === 'transcribe') return;
  startListening();
};
actions.tocall = () => { view.call = true; ui.rerender(); };
actions.totext = () => { stopListening(true); view.call = false; ui.rerender(); };
actions.replay = () => { const m = [...view.msgs].reverse().find(x => x.role === 'ai'); if (m) speak(m.zh); };
actions.replayslow = () => { const m = [...view.msgs].reverse().find(x => x.role === 'ai'); if (m) speak(m.zh, 0.55); };
actions.callfr = () => { view.callFr = !view.callFr; paintChat(); };

// ================================================================
//  Appel vocal : plein écran, on parle, il répond à voix haute
// ================================================================
function renderCall(app) {
  const v = view, sc = v.sc;
  app.innerHTML = `<div class="call">
    <div class="chat-top">
      <button class="x" data-act="aiclose" aria-label="Raccrocher">✕</button>
      <div class="grow"><b>${esc(sc.title)}</b><div class="small muted" id="calltimer">Appel vocal</div></div>
      <button class="chip ${S().settings.chatPinyin ? 'on' : ''}" data-act="chatpy">拼音</button>
      <button class="iconbtn" data-act="totext" aria-label="Voir la discussion écrite">💬</button>
    </div>
    <div id="goalsbox"></div>
    <div class="call-body" id="callbody"></div>
  </div>`;
  paintCall();
}
function paintCall() {
  const v = view, sc = v.sc;
  const body = document.getElementById('callbody'); if (!body) return;
  document.getElementById('goalsbox').innerHTML = goalsHtml(v);
  const lastAi = [...v.msgs].reverse().find(m => m.role === 'ai');
  const lastMe = [...v.msgs].reverse().find(m => m.role === 'me');
  const sys = v.msgs.length && v.msgs[v.msgs.length - 1].role === 'sys' ? v.msgs[v.msgs.length - 1].html : '';
  const status = { think: `${sc.who} réfléchit…`, speak: `${sc.who} parle…`, listen: 'Je t\'écoute…', transcribe: 'Je note ce que tu as dit…', idle: v.lastMiss ? 'Je n\'ai rien entendu' : 'À toi ! Touche le micro' }[v.busy ? 'think' : v.phase];
  body.innerHTML = `
    <div class="call-av ${v.phase === 'speak' || v.busy ? 'talk' : ''}"><span>${sc.icon}</span></div>
    <div class="call-name">${esc(sc.who)}</div>
    <div class="call-status ${v.phase === 'listen' ? 'live' : ''}">${status}</div>
    ${lastAi ? `<div class="call-line">${zhBlock(lastAi.zh, lastAi.pinyin, true)}
      ${v.callFr ? `<div class="lfr">${esc(lastAi.fr)}</div>` : ''}
      <div class="tools center"><button data-act="replay">🔊 Réécouter</button><button data-act="replayslow">🐢</button><button data-act="callfr">${v.callFr ? 'Masquer' : 'Traduire'}</button></div>
      ${lastAi.new_word?.h ? newWordChip(lastAi.new_word, v.msgs.indexOf(lastAi)) : ''}</div>` : '<div class="call-line ghost"><div class="spinner"></div></div>'}
    ${lastMe ? `<div class="call-me"><div class="small muted">Tu as dit</div><div class="saidtxt hzf">${esc(lastMe.text)}</div>${corrHtml(lastMe.correction)}</div>` : ''}
    ${sys ? `<div class="msg sys" style="align-self:center">${sys}</div>` : ''}
    <div class="call-foot">
      ${v.showSugg ? suggHtml(v) : ''}
      <div class="call-ctrls">
        <button class="roundbtn" data-act="ideas" aria-label="Idées de réponse">💡<small>Idées</small></button>
        <button class="callmic ${v.phase === 'listen' ? 'on' : ''}" data-act="mic" ${v.busy || v.phase === 'transcribe' ? 'disabled' : ''} aria-label="Parler"><span class="lvl-ring"></span><span class="mi">${v.phase === 'listen' ? '■' : '🎙️'}</span></button>
        <button class="roundbtn" data-act="aiclose" aria-label="Terminer">📵<small>Fin</small></button>
      </div>
      <p class="muted small" style="text-align:center;margin:8px 0 0">${v.phase === 'listen' ? 'Le micro s\'arrête tout seul quand tu as fini' : 'Parle en chinois… ou en français si tu bloques'}</p>
    </div>`;
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
LONGUEUR : ${nSent} phrases courtes et simples, avec des dialogues si possible.
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
      return `<button class="opt left ${cls}" data-act="sq" data-q="${qi}" data-o="${oi}">${esc(o)}</button>`;
    }).join('')}</div></div>`;
  }).join('');
  const done = s.questions.length && Object.keys(answers).length === s.questions.length;
  app.innerHTML = `<div class="screen story">
    <div class="chat-top" style="padding:0 0 12px">
      <button class="x" data-act="aiclose" aria-label="Fermer">✕</button>
      <div class="grow"><b class="hzf" style="font-size:20px">${esc(s.title_zh)}</b><div class="small muted">${esc(s.title_fr)}</div></div>
      <button class="chip ${py ? 'on' : ''}" data-act="storypy">拼音</button>
    </div>
    <div class="row" style="margin-bottom:14px"><button class="btn sm" data-act="speak" data-text="${esc(allText)}">▶ Tout écouter</button><button class="btn sm ghost" data-act="speak" data-slow="1" data-text="${esc(allText)}">🐢 Lentement</button></div>
    <div class="card story-card">${s.sentences.map((x, i) => `<div class="sent ${open.has(i) ? 'open' : ''}" data-act="sent" data-i="${i}">
      <div class="grow">${zhBlock(x.zh, x.pinyin || '')}${open.has(i) ? `<div class="lfr">${esc(x.fr || '')}</div>` : ''}</div>
      <button class="spk sm2" data-act="speak" data-text="${esc(x.zh)}" aria-label="Écouter">🔊</button></div>`).join('')}</div>
    <p class="muted small" style="margin:-4px 4px 0">Touche une phrase pour voir sa traduction.</p>
    ${s.new_words.length ? `<p class="sec-title">Mots nouveaux</p><div class="card">${s.new_words.map((w, i) => {
      const ex = WORDS.find(x => x.h === w.h); const valid = !!splitPinyin(w.p, [...w.h].length);
      const btn = ex && S().intro[ex.id] ? '<span class="small muted">déjà appris</span>' : (ex || valid) ? `<button class="chip" data-act="storyword" data-i="${i}">+ Apprendre</button>` : '';
      return `<div class="nwrow"><button data-act="speak" data-text="${esc(w.h)}" class="nwface"><b>${pyColor(w.p || '')}</b><span class="hzf">${esc(w.h)}</span></button><div class="grow small">${esc(w.f)}</div>${btn}</div>`;
    }).join('')}</div>` : ''}
    ${qs ? `<p class="sec-title">Compréhension</p>${qs}` : ''}
    ${done ? `<div class="card" style="text-align:center"><div style="font-size:42px">${s.score === s.questions.length ? '🏆' : '👍'}</div><b>${s.score}/${s.questions.length} bonnes réponses</b></div>` : ''}
    <button class="btn ghost" data-act="aiclose" style="margin-top:8px">Terminer</button>
  </div>`;
}
actions.storypy = () => { S().settings.chatPinyin = !S().settings.chatPinyin; st.save(); ui.rerender(); };
actions.sent = (el, e) => {
  if (e.target.closest('[data-act=speak]')) return;
  const i = +el.dataset.i; view.open.has(i) ? view.open.delete(i) : view.open.add(i);
  const y = window.scrollY; ui.rerender(); window.scrollTo(0, y);
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
  return `<div style="text-align:center" class="mword">${st.isOral() ? face(w) : ruby(w, true).replace('class="hz"', 'class="hz" style="font-size:46px"')}<div style="font-weight:700;margin-top:6px">${esc(w.f)}</div>
    <button class="spk" data-act="speak" data-text="${esc(w.h)}">🔊</button></div>
    <div class="card"><b>📘 Explication</b><p style="margin:6px 0 0">${esc(r.explication || '')}</p>${r.caracteres ? `<p class="muted small" style="margin:8px 0 0">🧩 ${esc(r.caracteres)}</p>` : ''}</div>
    ${(r.exemples || []).length ? `<div class="card"><b>💬 Exemples</b>${r.exemples.map(x => `<div class="exrow"><div class="grow">${zhBlock(x.zh, x.pinyin || '')}<div class="lfr">${esc(x.fr || '')}</div></div><button class="spk sm2" data-act="speak" data-text="${esc(x.zh)}">🔊</button></div>`).join('')}</div>` : ''}
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
