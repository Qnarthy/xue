// FSRS-4.5 : algorithme de répétition espacée (modèle mémoire stabilité / difficulté).
// Notes : 1 = raté, 2 = difficile, 3 = bien, 4 = facile
const W = [0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616, 0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466];
const DECAY = -0.5, FACTOR = 19 / 81;
const DAY = 86400000, MIN = 60000;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export const retrievability = (elapsedDays, S) => Math.pow(1 + (FACTOR * elapsedDays) / S, DECAY);
const initD = (g) => clamp(W[4] - (g - 3) * W[5], 1, 10);

export function newCard(now = Date.now()) {
  return { s: 0, d: 0, due: now, last: 0, reps: 0, lapses: 0 };
}

export function review(card, g, now = Date.now(), retention = 0.9) {
  const c = { ...card };
  if (c.reps === 0 || !c.s) {
    c.s = W[g - 1];
    c.d = initD(g);
  } else {
    const t = Math.max(0, (now - c.last) / DAY);
    const R = retrievability(t, c.s);
    let d = c.d - W[6] * (g - 3);
    c.d = clamp(W[7] * initD(3) + (1 - W[7]) * d, 1, 10);
    if (g === 1) {
      c.s = Math.min(c.s, W[11] * Math.pow(c.d, -W[12]) * (Math.pow(c.s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R)));
      c.lapses++;
    } else {
      const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
      c.s = c.s * (1 + Math.exp(W[8]) * (11 - c.d) * Math.pow(c.s, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy);
    }
  }
  c.s = Math.max(0.1, c.s);
  c.reps++;
  c.last = now;
  if (g === 1) {
    c.due = now + 10 * MIN;
  } else {
    const ivl = (c.s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
    const fuzz = ivl > 3 ? 1 + (Math.random() - 0.5) * 0.1 : 1;
    const days = Math.max(1, Math.round(ivl * fuzz));
    // échéance à 4h du matin pour que la carte soit prête au réveil
    const d = new Date(now + days * DAY); d.setHours(4, 0, 0, 0);
    c.due = d.getTime();
  }
  return c;
}

// Probabilité de se souvenir (0..1) maintenant, ou dans `inDays` jours ; 0 si jamais vue
export function recallNow(card, now = Date.now(), inDays = 0) {
  if (!card || !card.reps) return 0;
  return retrievability((now - card.last) / DAY + inDays, card.s);
}
export const recallIn7 = (card) => recallNow(card, Date.now(), 7);
