// Analyse de la voix dans le téléphone : enregistrement, détection de la hauteur (algorithme YIN),
// découpage en syllabes et reconnaissance approximative des tons.

// ---------- Enregistrement ----------
let stream = null;
export async function openMic() {
  if (stream && stream.active) return stream;
  stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
  return stream;
}
export function closeMic() { stream?.getTracks().forEach(t => t.stop()); stream = null; }

export function startRecording(maxMs = 4000) {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  const t = types.find(x => window.MediaRecorder?.isTypeSupported?.(x)) || '';
  const mr = new MediaRecorder(stream, t ? { mimeType: t } : undefined);
  const chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise(res => { mr.onstop = () => res(new Blob(chunks, { type: mr.mimeType || t || 'audio/webm' })); });
  mr.start();
  const timer = setTimeout(() => mr.state === 'recording' && mr.stop(), maxMs);
  return {
    ext: (mr.mimeType || t).includes('mp4') ? 'mp4' : 'webm',
    stop: () => { clearTimeout(timer); if (mr.state === 'recording') mr.stop(); return done; },
    done,
  };
}

// Enregistre et s'arrête tout seul après un silence (une fois que tu as parlé).
// onLevel(0..1) permet d'animer le bouton pendant que tu parles.
export async function recordAuto({ maxMs = 5000, silenceMs = 900, onLevel } = {}) {
  const rec = startRecording(maxMs);
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') await actx.resume();
    const src = actx.createMediaStreamSource(stream);
    const an = actx.createAnalyser(); an.fftSize = 1024;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    const t0 = Date.now();
    let floor = 0.004, spoke = false, lastVoice = 0, n = 0;
    const tick = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let e = 0; for (let i = 0; i < buf.length; i++) e += buf[i] * buf[i];
      const rms = Math.sqrt(e / buf.length);
      if (Date.now() - t0 < 250) { floor = Math.max(floor, rms); return; } // bruit de fond
      n++;
      const thr = Math.max(0.012, floor * 2.5);
      onLevel?.(Math.min(1, rms / (thr * 4)));
      if (rms > thr) { spoke = true; lastVoice = Date.now(); }
      else if (spoke && Date.now() - lastVoice > silenceMs) rec.stop();
    }, 50);
    rec.done.then(() => { clearInterval(tick); try { src.disconnect(); } catch (e) { /* déjà fait */ } });
  } catch (e) { /* sans analyse, on garde l'arrêt manuel ou au bout du temps maximum */ }
  return rec;
}

// ---------- Détection de la hauteur ----------
let actx;
export async function decode(blob) {
  actx ||= new (window.AudioContext || window.webkitAudioContext)();
  const buf = await blob.arrayBuffer();
  return new Promise((res, rej) => {
    const p = actx.decodeAudioData(buf, res, rej);
    if (p && p.then) p.then(res, rej);
  });
}

const st = (f) => 12 * Math.log2(f / 100); // hertz -> demi-tons (100 Hz = 0)

// Renvoie une suite de trames { t (s), st (demi-tons) | null }
export function pitchTrack(samples, sampleRate) {
  // ré-échantillonnage simple vers ~16 kHz pour aller vite
  const step = Math.max(1, Math.floor(sampleRate / 16000));
  const fs = sampleRate / step;
  const n = Math.floor(samples.length / step);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = samples[i * step];

  const W = Math.round(fs * 0.035), hop = Math.round(fs * 0.01);
  const minLag = Math.floor(fs / 450), maxLag = Math.min(W - 1, Math.ceil(fs / 70));
  const frames = [];
  let maxRms = 0;
  for (let s = 0; s + W + maxLag < n; s += hop) {
    let e = 0; for (let i = 0; i < W; i++) e += x[s + i] * x[s + i];
    const rms = Math.sqrt(e / W);
    frames.push({ s, rms }); if (rms > maxRms) maxRms = rms;
  }
  const thr = Math.max(0.008, maxRms * 0.12);
  const d = new Float32Array(maxLag + 1);
  return frames.map(({ s, rms }) => {
    const t = s / fs;
    if (rms < thr) return { t, st: null };
    // fonction de différence YIN
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0;
      for (let i = 0; i < W; i++) { const v = x[s + i] - x[s + i + tau]; sum += v * v; }
      d[tau] = sum;
    }
    let run = 0, best = -1;
    const cm = new Float32Array(maxLag + 1); cm[0] = 1;
    for (let tau = 1; tau <= maxLag; tau++) { run += d[tau]; cm[tau] = run ? (d[tau] * tau) / run : 1; }
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cm[tau] < 0.18) { while (tau + 1 <= maxLag && cm[tau + 1] < cm[tau]) tau++; best = tau; break; }
    }
    if (best < 0) return { t, st: null };
    // interpolation parabolique pour plus de précision
    const a = cm[best - 1] ?? cm[best], b = cm[best], c = cm[best + 1] ?? cm[best];
    const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
    const f0 = fs / (best + (Math.abs(shift) < 1 ? shift : 0));
    return { t, st: f0 >= 70 && f0 <= 450 ? st(f0) : null };
  });
}

const median = (a) => { const b = [...a].sort((p, q) => p - q); return b.length ? b[b.length >> 1] : 0; };

// Lissage + correction des sauts d'octave
function clean(track) {
  const vals = track.filter(f => f.st != null).map(f => f.st);
  const med = median(vals);
  const out = track.map(f => {
    if (f.st == null) return f;
    let v = f.st;
    if (v - med > 8) v -= 12; else if (med - v > 8) v += 12;
    return { ...f, st: Math.abs(v - med) > 9 ? null : v };
  });
  // filtre médian sur 5 trames
  return out.map((f, i) => {
    if (f.st == null) return f;
    const win = out.slice(Math.max(0, i - 2), i + 3).filter(g => g.st != null).map(g => g.st);
    return { ...f, st: median(win) };
  });
}

// Découpe les zones voisées en n syllabes
export function segment(track, n) {
  const runs = [];
  let cur = null, gap = 0;
  track.forEach((f, i) => {
    if (f.st != null) {
      if (cur && gap <= 4) cur.end = i; else { cur = { start: i, end: i }; runs.push(cur); }
      gap = 0;
    } else if (cur) gap++;
  });
  let segs = runs.filter(r => r.end - r.start >= 4);
  if (!segs.length) return [];
  // trop de morceaux : on fusionne les plus proches
  while (segs.length > n) {
    let k = 0, g = Infinity;
    for (let i = 0; i < segs.length - 1; i++) { const gg = segs[i + 1].start - segs[i].end; if (gg < g) { g = gg; k = i; } }
    segs.splice(k, 2, { start: segs[k].start, end: segs[k + 1].end });
  }
  if (segs.length === n) return segs;
  // pas assez : on répartit les trames voisées en n parts égales
  const voiced = [];
  segs.forEach(r => { for (let i = r.start; i <= r.end; i++) if (track[i].st != null) voiced.push(i); });
  if (voiced.length < n * 4) return [];
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = voiced[Math.floor((k * voiced.length) / n)], b = voiced[Math.floor(((k + 1) * voiced.length) / n) - 1];
    out.push({ start: a, end: b });
  }
  return out;
}

// Reconnaît le ton (1-4) d'une syllabe à partir de sa courbe (demi-tons) et du niveau moyen de la voix
export function classify(vals, base) {
  const m = vals.length;
  if (m < 4) return null;
  const v = vals.slice(Math.floor(m * 0.12), Math.ceil(m * 0.92));
  const q = Math.max(1, Math.floor(v.length / 4));
  const start = v.slice(0, q).reduce((a, b) => a + b, 0) / q;
  const end = v.slice(-q).reduce((a, b) => a + b, 0) / q;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  let min = Infinity, minI = 0;
  v.forEach((x, i) => { if (x < min) { min = x; minI = i; } });
  const delta = end - start, lvl = mean - base, rel = minI / v.length;
  const dip = Math.min(start, end) - min;
  if (delta <= -3.5 && start - base > -1.5) return 4;
  if (delta >= 2.2) return rel > 0.3 && start - min > 1.8 ? 3 : 2;
  if (dip > 1.8 && rel > 0.2 && rel < 0.8) return 3;
  if (Math.abs(delta) < 2.2) return lvl < -2.5 ? 3 : 1;
  return start - base < -1 ? 3 : 4; // descente moyenne : 3e ton bas ou 4e ton mou
}

// Tons attendus à l'oral (deux 3e tons de suite : le premier se prononce au 2e ton)
export function spokenTones(tones) {
  return tones.map((t, i) => (t === 3 && tones[i + 1] === 3 ? 2 : t));
}

// Analyse complète d'un enregistrement pour un mot de n syllabes
export async function analyzeWord(blob, tones, base) {
  const audio = await decode(blob);
  const track = clean(pitchTrack(audio.getChannelData(0), audio.sampleRate));
  const voicedVals = track.filter(f => f.st != null).map(f => f.st);
  if (voicedVals.length < 8) return { error: 'Je n\'ai pas bien entendu ta voix. Parle un peu plus fort, près du micro.' };
  const recMedian = median(voicedVals);
  const b = base ?? recMedian;
  const segs = segment(track, tones.length);
  if (!segs.length) return { error: 'Je n\'arrive pas à séparer les syllabes. Réessaie en articulant bien.' };
  const expected = spokenTones(tones);
  const syl = segs.map((sg, i) => {
    const vals = track.slice(sg.start, sg.end + 1).filter(f => f.st != null).map(f => f.st);
    const want = tones[i];
    const got = want === 5 ? null : classify(vals, b);
    const ok = want === 5 || got == null ? null
      : got === expected[i] || (tones[i] === 3 && expected[i] === 2 && got === 3) || got === want;
    return { ...sg, want, spoken: expected[i], got, ok };
  });
  return { track, syl, base: b, recMedian, duration: audio.duration };
}
