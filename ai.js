// Client Groq (API gratuite, compatible OpenAI) : discussion en JSON + transcription Whisper.
import * as st from './store.js';
import { WORDS } from './data.js';

const BASE = 'https://api.groq.com/openai/v1';
// Modèles préférés, du meilleur en chinois au plus générique (le premier disponible est choisi)
export const PREFERRED = [
  'moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b',
  'openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b',
];

export class AIError extends Error {}

const key = () => {
  const k = (st.S.settings.groqKey || '').trim();
  if (!k) throw new AIError('Ajoute d\'abord ta clé Groq (onglet Prof IA).');
  return k;
};
export const hasKey = () => !!(st.S.settings.groqKey || '').trim();

async function call(path, init) {
  let res;
  try {
    res = await fetch(BASE + path, { ...init, headers: { Authorization: 'Bearer ' + key(), ...(init.headers || {}) } });
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError('Pas de connexion internet.');
  }
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error?.message || ''; } catch (e) { /* pas de JSON */ }
    const err = new AIError(
      res.status === 401 ? 'Clé API invalide : vérifie-la dans les réglages.'
        : res.status === 429 ? 'Limite gratuite atteinte : réessaie dans une minute.'
          : res.status === 413 ? 'Message trop long.'
            : `Erreur de l'IA (${res.status}) ${msg.slice(0, 140)}`);
    err.status = res.status; err.raw = msg;
    throw err;
  }
  return res.json();
}

export async function listModels() {
  const d = await call('/models', { method: 'GET' });
  return d.data.map(m => m.id)
    .filter(id => !/whisper|guard|tts|playai|orpheus|distil|compound|allam|saba/i.test(id))
    .sort();
}

// Choisit automatiquement le meilleur modèle disponible
export async function autoPickModel() {
  const models = await listModels();
  const best = PREFERRED.find(p => models.includes(p)) || models[0];
  st.S.settings.groqModel = best; st.save();
  return { models, best };
}

function extractJSON(text) {
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b < a) throw new AIError('Réponse de l\'IA illisible, réessaie.');
  try { return JSON.parse(text.slice(a, b + 1)); }
  catch (e) { throw new AIError('Réponse de l\'IA illisible, réessaie.'); }
}

// Envoie une conversation et renvoie l'objet JSON produit par le modèle
export async function chatJSON(messages, { temperature = 0.7, max_tokens = 1400 } = {}) {
  messages = [...messages]; // ne modifie pas l'historique de l'appelant
  if (!st.S.settings.groqModel) await autoPickModel();
  const model = st.S.settings.groqModel;
  const body = { model, messages, temperature, max_tokens, response_format: { type: 'json_object' } };
  if (/qwen3/i.test(model)) messages[0] = { ...messages[0], content: messages[0].content + '\n/no_think' };
  if (/gpt-oss/i.test(model)) body.reasoning_effort = 'low';
  let d;
  try {
    d = await call('/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    // modèle retiré ou mode JSON refusé : on s'adapte une fois
    if (e.status === 404 || (e.status === 400 && /model/i.test(e.raw) && !/json/i.test(e.raw))) {
      await autoPickModel();
      return chatJSON(messages, { temperature, max_tokens });
    }
    if (e.status === 400 && /json|response_format/i.test(e.raw)) {
      delete body.response_format;
      d = await call('/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else throw e;
  }
  return extractJSON(d.choices?.[0]?.message?.content || '');
}

// Transcrit un enregistrement en chinois (Whisper)
export async function transcribe(blob, ext) {
  const send = async (model) => {
    const fd = new FormData();
    fd.append('file', blob, 'voix.' + ext);
    fd.append('model', model);
    fd.append('language', 'zh');
    fd.append('prompt', '以下是普通话的句子，使用简体中文。'); // pousse vers les caractères simplifiés
    fd.append('response_format', 'json');
    fd.append('temperature', '0');
    return call('/audio/transcriptions', { method: 'POST', body: fd });
  };
  let d;
  try { d = await send('whisper-large-v3-turbo'); }
  catch (e) { if (e.status === 404 || e.status === 400) d = await send('whisper-large-v3'); else throw e; }
  return (d.text || '').trim();
}

// ---------- Profil de l'élève transmis à l'IA ----------
export function learnerProfile() {
  const ids = Object.keys(st.S.intro);
  const known = ids.map(id => id.split('_')[0]);
  const n = known.length;
  const level = n < 60 ? 'grand débutant (début du HSK 1)' : n < 150 ? 'débutant (HSK 1 en cours)' : n < 300 ? 'HSK 1 acquis, HSK 2 en cours' : n < 600 ? 'HSK 2 acquis, HSK 3 en cours' : 'HSK 3';
  // un débutant a besoin d'une base minimale pour converser
  const base = n < 60 ? WORDS.filter(w => w.lvl === 1).slice(0, 80).map(w => w.h) : [];
  const vocab = [...new Set([...known, ...base])].slice(0, 700).join('、');
  return { level, vocab, n };
}
