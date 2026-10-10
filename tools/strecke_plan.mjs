// Grundriss von Strecke 1 als Tabelle (Lage/Höhe/Kurs je Abschnittsanfang) – zum Entwerfen und für den Bericht.
// Aufruf: node tools/strecke_plan.mjs
import { strecke1 } from '../src/track/strecke1.js';
const b = strecke1();
const ab = b.abschnitte;
console.log(`${b.name}: ${(b.L / 1000).toFixed(2)} km, ${b.N} Stützstellen, Schließfehler ${b.schluss.m.toFixed(3)} m / ${b.schluss.grad.toFixed(4)}°`);
b.segStart.forEach((s0, k) => {
  const i = Math.round(s0 / b.ds) % b.N;
  const kurs = Math.atan2(-b.tx[i], -b.tz[i]) * 180 / Math.PI;
  console.log(String(k).padStart(2), ab[k].name.padEnd(24), `s ${s0.toFixed(0).padStart(6)}`, `x ${b.px[i].toFixed(0).padStart(6)}`,
    `z ${b.pz[i].toFixed(0).padStart(6)}`, `y ${b.py[i].toFixed(0).padStart(5)}`, `Kurs ${kurs.toFixed(0).padStart(5)}°`, ab[k].magnet ? 'MAGNET' : '');
});
