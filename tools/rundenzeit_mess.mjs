// Rundenzeit je Strecke (P1b, Peter 20.10.: „kürzere Rennen, max 5 min“; P2: alle Strecken): KI-Rennen (8 Gleiter,
// Profile wie im KI-Gate) über n Runden; Median der Rundenzeiten der KI „Mittel“ ohne die erste Runde (stehender Start) =
// Wert für `rundenzeit` im Strecken-Register (src/track/strecken.js). Dazu: Rundenzahl laut rundenFuer() und die Renndauer
// eines echten Rennens mit dieser Rundenzahl (inkl. Countdown) je Profil.
// Aufruf: node tools/rundenzeit_mess.mjs [runden=6] [kurz|lang|beide|alle|<id>…]
import { kiRennen } from './ki_rennen.mjs';
import { rundenFuer, RENNDAUER } from '../src/track/runden.js';
import { finde, sichtbar } from '../src/track/strecken.js';
import { START } from '../src/game/rennen.js';

const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// Median der Mittel-Runden (ohne Runde 1) und Rennzeit je Profil für `runden` Runden (inkl. Countdown)
export function rundenzeit(strecke, runden = 6) {
  const { r, profile } = kiRennen(runden, '', () => {}, strecke);
  const mittel = [];
  const ziel = {};
  for (const t of r.alle) {
    if (profile[t.k] === 'mittel') mittel.push(...t.rundenZeiten.slice(1));
    (ziel[profile[t.k]] ||= []).push(t.ziel ? t.ziel.zeit + START.countdown : Infinity);
  }
  const spitze = Math.min(...Object.values(ziel).flat());
  const langsamst = Math.max(...Object.values(ziel).flat());
  return { median: median(mittel), spitze, langsamst, ziel: Object.fromEntries(Object.entries(ziel).map(([k, v]) => [k, median(v)])) };
}

if (process.argv[1] && process.argv[1].endsWith('rundenzeit_mess.mjs')) {
  const n = +(process.argv[2] || 6), wahl = process.argv.slice(3);
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, '0')}`;
  const liste = !wahl.length || wahl[0] === 'beide' ? ['kurz', 'lang'] : wahl[0] === 'alle' ? sichtbar().map((e) => e.id) : wahl;
  for (const id of liste) {
    const e = finde(id);
    const m = rundenzeit(id, n);
    const runden = rundenFuer(m.median);
    const rennen = rundenzeit(id, runden);
    console.log(`${e.id}: Median Runde (KI Mittel, ohne Runde 1) ${m.median.toFixed(1)} s (eingetragen ${e.rundenzeit} s) → ${runden} Runde(n) (Ziel ≤ ${RENNDAUER.ziel} s)`);
    console.log(`  Rennen über ${runden} Runde(n) inkl. Countdown (Median je Profil): ${Object.entries(rennen.ziel).map(([k, v]) => `${k} ${fmt(v)}`).join(' · ')} · Spitze ${fmt(rennen.spitze)} · Letzter ${fmt(rennen.langsamst)}`);
  }
}
