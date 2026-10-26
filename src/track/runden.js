// Rundenzahl je Strecke (P1b Etappe 0, Peter 20.10.: „kürzere Rennen, max 5 min“): aus der gemessenen Median-Rundenzeit der
// KI „Mittel“ so viele Runden, dass Countdown + Startverlust (stehender Start, erste Runde) + n Runden ≤ ziel Sekunden
// bleiben; mindestens 1. Gilt für alle Strecken (Register strecken.js trägt die gemessenen Rundenzeiten).
export const RENNDAUER = { ziel: 300, countdown: 3, start: 5 };
export function rundenFuer(rundenzeit, r = RENNDAUER) {
  if (!(rundenzeit > 0)) return 2;
  return Math.max(1, Math.floor((r.ziel - r.countdown - r.start) / rundenzeit));
}
