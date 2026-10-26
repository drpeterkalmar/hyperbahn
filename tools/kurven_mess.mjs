// P3 Kurven-Messung (Peter 26.10.: „schärfere Kurven … ich verwende die Airbrakes nie“):
//  1. kleinster fahrbarer Radius bei Höchsttempo: ebene, breite Bahn, Vollgas, Lenkung voll eingeschlagen – Radius der
//     Bahnkurve nach 2 s (stationär) und das Tempo dabei
//  2. je Strecke eine Runde mit einem „Spieler ohne Luftbremse“ (Ideallinie ohne Fehler, Luftbremsen nie):
//     (a) Vollgas-Lenker: Gas immer voll – so fährt man am Handy (Touch hat Auto-Gas)
//     (b) Handy (Touch, Fahrhilfe Leicht): Auto-Gas der Fahrhilfe (P3: nimmt vor engen Kurven selbst Gas weg), Lenken wie (a)
//     (c) Gas-weg-Lenker: nimmt vor Kurven das Gas weg (Tempoplan), aber nie Luftbremse
//     je Kurven-Abschnitt (Gier ≥ 15°) „geschafft“ = ohne kräftigen Wandtreffer (Stärke > 0,15) und ohne Abflug
// Aufruf: node tools/kurven_mess.mjs [?regler]   (vorher: im Stand bis 0.1.17 ohne Regler)
import { leseRegler, ZEIT, GLEITER } from '../src/config.js';
import { baueBahn } from '../src/track/bahn.js';
import { baueStrecke } from '../src/track/alle.js';
import { bauePlaene, Pilot, PROFILE } from '../src/ai/pilot.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { Fahrhilfe } from '../src/game/fahrhilfe.js';

const dt = ZEIT.schritt;
const AUS = { gas: 1, lenk: 1, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };

export function radiusMessung(regler = '') {
  leseRegler(regler);
  const b = baueBahn([{ typ: 'gerade', len: 30000, breite: 3000 }], { ohneSchluss: true });
  const g = new Gleiter(b, { s: 15000, v0: GLEITER.vmax });
  for (let i = 0; i < 2 / dt; i++) g.schritt(dt, AUS);
  const p0 = { x: g.p.x, z: g.p.z }, h0 = Math.atan2(g.v.x, g.v.z);
  let weg = 0;
  for (let i = 0; i < 0.5 / dt; i++) { const x = g.p.x, z = g.p.z; g.schritt(dt, AUS); weg += Math.hypot(g.p.x - x, g.p.z - z); }
  let dh = Math.atan2(g.v.x, g.v.z) - h0; if (dh > Math.PI) dh -= 2 * Math.PI; if (dh < -Math.PI) dh += 2 * Math.PI;
  void p0;
  return { radius: weg / Math.abs(dh), tempo: g.tempo, vmax: GLEITER.vmax };
}

export function kurvenRunde(id, modus = 'vollgas', regler = '') {
  leseRegler(regler);
  const bahn = baueStrecke(id), plan = bauePlaene(bahn).sicher;
  const pi = new Pilot(bahn, plan, { ...PROFILE.profi, linie: 0, wackler: 0, drift: 0, rolle: 0, streu: 0 }, 3);
  const g = new Gleiter(bahn, { s: 20, v0: GLEITER.vmax * 0.9 });
  const hilfe = modus === 'handy' ? new Fahrhilfe(bahn, bauePlaene(bahn), 'leicht') : null;
  const seg = (s) => { let k = 0; while (k + 1 < bahn.segStart.length && bahn.segStart[k + 1] <= s) k++; return k; };
  const treffer = new Map(), abflug = new Map();
  let s0 = g.s, gefahren = 0;
  for (let i = 0; i < 400 / dt && gefahren < bahn.L; i++) {
    const e = pi.steuer(g, dt, []);
    const ein = hilfe ? { ...hilfe.anwenden(g, { gas: 1, autoGas: true, lenk: e.lenk, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 }, dt) }
      : { ...e, bremseL: 0, bremseR: 0, gas: modus === 'vollgas' ? 1 : e.gas };
    g.schritt(dt, ein);
    for (const x of g.ereignisse) {
      const k = seg(x.s);
      if (x.art === 'wand' && x.staerke > 0.15) treffer.set(k, (treffer.get(k) || 0) + 1);
      if (x.art === 'absturz') abflug.set(k, (abflug.get(k) || 0) + 1);
    }
    g.ereignisse.length = 0;
    let d = g.s - s0; if (d < -bahn.L / 2) d += bahn.L; if (d > bahn.L / 2) d -= bahn.L;
    if (Math.abs(d) < 80) gefahren += d;
    s0 = g.s;
  }
  const kurven = [];
  bahn.abschnitte.forEach((a, k) => {
    if (!a.gier || Math.abs(a.gier) < 15) return;
    const r0 = a.rampe != null ? Math.min(a.rampe, a.len / 2) : Math.min(a.len / 3, 120);
    kurven.push({ name: a.name, radius: (a.len - r0) / (Math.abs(a.gier) * Math.PI / 180), scharf: !!a.scharf, ok: !treffer.get(k) && !abflug.get(k), wand: treffer.get(k) || 0, abflug: abflug.get(k) || 0 });
  });
  return { id, modus, kurven, geschafft: kurven.filter((x) => x.ok).length, n: kurven.length, abfluege: g.statistik.abfluege };
}

if (process.argv[1] && process.argv[1].endsWith('kurven_mess.mjs')) {
  const regler = process.argv.slice(2).find((a) => a.startsWith('?')) || '';
  const r = radiusMessung(regler);
  console.log(`Kurven-Messung ${regler || '(Standard)'}`);
  console.log(`Kleinster Radius bei Höchsttempo (Vollgas, voll eingeschlagen): ${r.radius.toFixed(0)} m bei ${r.tempo.toFixed(1)} m/s (Höchsttempo ${r.vmax.toFixed(0)} m/s)`);
  for (const id of ['megastadt', 'wueste', 'riff', 'gebirge', 'orbit']) {
    for (const modus of ['vollgas', 'handy', 'gasweg']) {
      const k = kurvenRunde(id, modus, regler);
      const eng = k.kurven.slice().sort((a, b) => a.radius - b.radius).slice(0, 4).map((x) => `${x.name} R${x.radius.toFixed(0)}${x.ok ? ' ✓' : ` ✗(${x.wand}W${x.abflug ? ` ${x.abflug}A` : ''})`}`).join(', ');
      console.log(`${id.padEnd(9)} ${modus.padEnd(7)} Kurven geschafft ${k.geschafft}/${k.n}, Abflüge ${k.abfluege} · engste: ${eng}`);
    }
  }
}
