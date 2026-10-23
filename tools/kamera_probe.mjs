// Kamera-Probe ohne Browser (p1c, Peter 22.10.: „Kamera clippt im Looping durch den Boden“): ein KI-Gleiter fährt eine
// Runde, die Verfolger-Kamera läuft je Bild (60 Hz) mit; je Bild wird die Kamera-Lage über der Fahrfläche abgefragt
// (Bahn-Raycast entlang der lokalen Normale, wie die Schwebe-Punkte). Ausgabe je Abschnitt: kleinste Kamera-Höhe über der
// Fahrbahn und Anzahl Bilder „hinter/unter der Fahrbahn“ (Höhe < 0,3 m innerhalb der Fahrbahnbreite + 2 m).
// Zusätzlich: Bullet-Time-Halbkreis (Action-Kamera) an jeder 25. Stelle erzwungen (--orbit).
// Aufruf: node tools/kamera_probe.mjs [url-regler, z. B. "?camloop=0&camboden=0" = alt] [--orbit] [--tempo 1.0]
import { leseRegler, ZEIT, GLEITER } from '../src/config.js';
import { strecke1 } from '../src/track/strecke1.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { bauePlan, Pilot, PROFILE } from '../src/ai/pilot.js';
import { KameraRig, leseKamera } from '../src/gfx/kamera.js';
import { neueAbfrage, F_LUECKE } from '../src/track/bahn.js';

const arg = process.argv.slice(2);
const regler = arg.find((a) => a.startsWith('?')) || '';
const orbit = arg.includes('--orbit');
leseRegler(regler); leseKamera(regler);
const bahn = strecke1(), plan = bauePlan(bahn), dt = ZEIT.schritt;
const abschnitt = (s) => { let k = 0; while (k + 1 < bahn.segStart.length && bahn.segStart[k + 1] <= s) k++; return bahn.abschnitte[k].name; };

const g = new Gleiter(bahn, { s: 5, v0: GLEITER.vmax * 0.85 });
const pi = new Pilot(bahn, plan, PROFILE.profi, 7), rig = new KameraRig();
const q = neueAbfrage(), proBild = Math.round(1 / 60 / dt);
const je = new Map();   // Abschnitt → { min, unter, bilder }
let gefahren = 0, sAlt = g.s, bild = 0, unterGesamt = 0, bilderGesamt = 0;
for (let n = 0; n < 240 * 400 && gefahren < bahn.L; n++) {
  g.schritt(dt, pi.steuer(g, dt, []));
  g.ereignisse.length = 0;
  let d = g.s - sAlt; if (d < -bahn.L / 2) d += bahn.L; if (d > bahn.L / 2) d -= bahn.L;
  sAlt = g.s; if (g.zustand === 'fahrt') gefahren += d;
  if (n % proBild) continue;
  bild++;
  const fx = orbit && bild % 25 < 12 ? { orbitAn: 1, orbit: (bild % 25) / 12 * Math.PI, fov: 0, zoom: 1, shake: 0 } : null;
  rig.update(1 / 60, g, fx, { bahn });
  const r = bahn.abfrage(rig.pos, g.hint, q);
  if (!r.ok || g.zustand !== 'fahrt') continue;
  const ueber = !(r.flags & F_LUECKE) && Math.abs(r.u) <= r.hw + 2;
  const name = abschnitt(g.s);
  const e = je.get(name) || { min: 99, unter: 0, bilder: 0 };
  e.bilder++; bilderGesamt++;
  if (ueber) { e.min = Math.min(e.min, r.h); if (r.h < 0.3) { e.unter++; unterGesamt++; } }
  je.set(name, e);
}
console.log(`Regler "${regler}"${orbit ? ' + Bullet-Time-Halbkreis' : ''}: ${bilderGesamt} Bilder, davon ${unterGesamt} mit Kamera hinter/unter der Fahrbahn`);
console.log('| Abschnitt | Bilder | min. Kamera-Höhe über Fahrbahn (m) | Bilder unter Fahrbahn |\n|---|---|---|---|');
for (const [name, e] of je) console.log(`| ${name} | ${e.bilder} | ${e.min === 99 ? '–' : e.min.toFixed(2)} | ${e.unter} |`);
