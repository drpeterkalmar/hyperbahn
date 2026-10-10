// Fahrt-Probe ohne Browser: ein KI-Gleiter fährt N Runden auf Strecke 1, Ausgabe Rundenzeiten, Sprünge, Abflüge,
// Tempo-Spitzen, Mindest-Schwebehöhe. Aufruf: node tools/fahrt_probe.mjs [runden=1] [profil=profi] [url-regler]
import { leseRegler, ZEIT, ANZEIGE } from '../src/config.js';
import { strecke1 } from '../src/track/strecke1.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { bauePlan, Pilot, PROFILE } from '../src/ai/pilot.js';

const runden = +(process.argv[2] || 1), prof = process.argv[3] || 'profi';
leseRegler(process.argv[4] || '');
const bahn = strecke1();
const t0 = Date.now();
const plan = bauePlan(bahn);
console.log('Plan', Date.now() - t0, 'ms, Strecke', (bahn.L / 1000).toFixed(2), 'km');
const g = new Gleiter(bahn, { s: 5, v0: 0 });
const pi = new Pilot(bahn, plan, PROFILE[prof], 7);
const dt = ZEIT.schritt;
let s0 = g.s, gefahren = 0, runde = 0, tR = 0, vmax = 0, minH = 99, ereig = {};
const zeiten = [];
const abschnitt = (s) => { let k = 0; while (k + 1 < bahn.segStart.length && bahn.segStart[k + 1] <= s) k++; return bahn.abschnitte[k].name; };
const t1 = Date.now();
for (let n = 0; n < 240 * 600 * runden && runde < runden; n++) {
  const e = pi.steuer(g, dt, []);
  g.schritt(dt, e);
  tR += dt;
  for (const ev of g.ereignisse) {
    ereig[ev.art] = (ereig[ev.art] || 0) + 1;
    if (ev.art === 'absturz') console.log('ABSTURZ', ev.grund, 's', ev.s.toFixed(0), abschnitt(ev.s), 't', g.zeit.toFixed(1));
    if (ev.art === 'landung' && ev.luft > 1.5) console.log(`Landung nach ${ev.luft.toFixed(2)} s, ${ev.weite.toFixed(0)} m, Landezone ${ev.landezone}`);
  }
  g.ereignisse.length = 0;
  if (g.zustand === 'fahrt') {
    let d = g.s - s0; if (d < -bahn.L / 2) d += bahn.L; if (d > bahn.L / 2) d -= bahn.L;
    gefahren += d; s0 = g.s;
    vmax = Math.max(vmax, g.tempo);
    if (g.boden) minH = Math.min(minH, g.h);
  } else s0 = g.s;
  if (gefahren >= bahn.L * (runde + 1)) { zeiten.push(tR); tR = 0; runde++; }
}
console.log('Rechenzeit', ((Date.now() - t1) / 1000).toFixed(1), 's');
console.log('Runden', zeiten.map((t) => t.toFixed(1)).join(' / '), 's');
console.log('Spitze', vmax.toFixed(1), 'm/s =', (vmax * 3.6 * ANZEIGE.faktor).toFixed(0), 'km/h Anzeige; min. Höhe am Boden', minH.toFixed(2), 'm');
console.log('Ereignisse', JSON.stringify(ereig));
console.log('Statistik', JSON.stringify({ ...g.statistik, sprunge: g.statistik.sprunge.map((x) => `${x.luft.toFixed(1)}s/${x.weite.toFixed(0)}m/v${x.v.toFixed(0)}`) }));
