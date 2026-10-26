// Prüfungen je Strecke (P2) – Grundlage von tests/node/test_strecken.mjs und des Berichts: Geometrie (Schließfehler,
// Stetigkeit, Selbstdurchdringung, Magnet an allen steilen/überkopf Stellen, Pflicht-Passagen), Sprünge (Mindesttempo an
// der Kante, Flug mit/ohne Pads), KI-Gate (8 Gleiter × n Runden) mit Wandtreffer-Rate je Gleiter-Minute.
// Aufruf: node tools/strecke_pruefen.mjs <id> [runden=10]
import { ZEIT, GLEITER } from '../src/config.js';
import { kruemmungen, F_MAGNET, F_LUECKE, F_LANDEZONE } from '../src/track/bahn.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { baueStrecke } from '../src/track/alle.js';
import { kiRennen } from './ki_rennen.mjs';

const dt = ZEIT.schritt;

export function geometrie(bahn) {
  const N = bahn.N, k = kruemmungen(bahn);
  let maxK = 0, maxDK = 0, maxDB = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    maxK = Math.max(maxK, Math.hypot(k.quer[i], k.laengs[i]));
    maxDK = Math.max(maxDK, Math.abs(k.quer[j] - k.quer[i]) + Math.abs(k.laengs[j] - k.laengs[i]));
    let db = Math.abs(bahn.bank[j] - bahn.bank[i]);
    if (j === 0) db = Math.abs(((bahn.bank[j] - bahn.bank[i]) % 360 + 540) % 360 - 180);
    maxDB = Math.max(maxDB, db);
  }
  // steil/überkopf ohne Magnet (außer Lücken)
  const ohneMagnet = [];
  for (let i = 0; i < N; i++) if (bahn.suy[i] < 0.3 && !(bahn.flags[i] & F_LUECKE) && !(bahn.flags[i] & F_MAGNET)) ohneMagnet.push(i * bahn.ds);
  // Selbstdurchdringung: Mittellinien-Abstand > Summe der Halbbreiten + 3 m (Gitter 40 m)
  const Z = 40, gitter = new Map();
  const key = (x, y, z) => `${Math.floor(x / Z)},${Math.floor(y / Z)},${Math.floor(z / Z)}`;
  for (let i = 0; i < N; i += 2) { const kk = key(bahn.px[i], bahn.py[i], bahn.pz[i]); if (!gitter.has(kk)) gitter.set(kk, []); gitter.get(kk).push(i); }
  let schlimmst = Infinity, wo = null;
  for (let i = 0; i < N; i += 2) {
    const cx = Math.floor(bahn.px[i] / Z), cy = Math.floor(bahn.py[i] / Z), cz = Math.floor(bahn.pz[i] / Z);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      for (const j of gitter.get(`${cx + a},${cy + b},${cz + c}`) || []) {
        let dsB = Math.abs(i - j) * bahn.ds; dsB = Math.min(dsB, bahn.L - dsB);
        if (dsB < 150) continue;
        const d = Math.hypot(bahn.px[i] - bahn.px[j], bahn.py[i] - bahn.py[j], bahn.pz[i] - bahn.pz[j]);
        const rest = d - (bahn.hw[i] + bahn.hw[j] + 3);
        if (rest < schlimmst) { schlimmst = rest; wo = [Math.round(i * bahn.ds), Math.round(j * bahn.ds), +d.toFixed(1)]; }
      }
    }
  }
  // Riesensprünge: zusammenhängende Lücken mit Absprung davor
  const spruenge = [];
  bahn.abschnitte.forEach((a, kk) => {
    if (a.typ !== 'sprung') return;
    let luecke = 0, e = kk; while (bahn.abschnitte[e].luecke) { luecke += bahn.abschnitte[e].len; e++; }
    const s0 = bahn.segStart[kk - 1];
    spruenge.push({ name: a.name, luecke, absprung: !!bahn.abschnitte[kk - 1].absprung,
      pads: bahn.pads.filter((p) => p.s0 < s0 && p.s0 > s0 - 600).length,
      ringe: bahn.ringe.filter((r) => r.s >= bahn.segStart[kk] && r.s <= bahn.segStart[e]).length,
      landezone: !!bahn.abschnitte[e].landezone, landeBreite: bahn.abschnitte[e].breite || 13, lichter: !!(bahn.flags[Math.round(bahn.segStart[e] / bahn.ds + 5) % N] & F_LANDEZONE) });
  });
  return { L: bahn.L, schluss: bahn.schluss, maxK, maxDK, maxDB, ohneMagnet, abstand: schlimmst, wo, spruenge, ketten: padKetten(bahn), ringe: bahn.ringe.length };
}

// Pad-Ketten: Gruppen von ≥ 2 Pads mit ≤ 120 m Abstand
export function padKetten(bahn) {
  const out = []; let n = 0, letzt = -1e9;
  for (const p of bahn.pads) { if (p.s0 - letzt <= 120) n++; else { if (n >= 2) out.push(n); n = 1; } letzt = p.s0; }
  if (n >= 2) out.push(n);
  return out;
}

function spur(g, uZiel = 0) {
  const q = g.q;
  const vt = g.v.x * q.T.x + g.v.y * q.T.y + g.v.z * q.T.z, vl = g.v.x * q.Ls.x + g.v.y * q.Ls.y + g.v.z * q.Ls.z;
  const e = Math.atan2(vl, Math.max(vt, 1));
  return { gas: 1, lenk: Math.max(-1, Math.min(1, 0.05 * (uZiel - g.u) - 2.2 * e)), bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
}
// ein Sprung: Start bei s mit Tempo v0 und Querversatz u, Vollgas, Spurhalter; ok = gelandet ohne Abflug
export function sprung(bahn, { s, u = 0, v0 }) {
  const g = new Gleiter(bahn, { s, u, v0 });
  for (let n = 0; n < 30 / dt && g.zustand === 'fahrt'; n++) {
    g.schritt(dt, spur(g, u));
    if (g.statistik.sprungLandungen > 0 && g.boden) break;
  }
  const sp = g.statistik.sprunge[0];
  return { ok: g.statistik.abfluege === 0 && g.statistik.sprungLandungen > 0, sp, vAb: sp ? sp.v : 0 };
}
// Mindesttempo an der Kante (Halbierung, Start 3 m vor der Lücke mit Vollgas)
export function mindesttempo(bahn, name) {
  const k = bahn.abschnitte.findIndex((a) => a.name === name), sK = bahn.segStart[k];
  let lo = 20, hi = GLEITER.vmax * 1.8;
  for (let it = 0; it < 14; it++) { const m = (lo + hi) / 2; if (sprung(bahn, { s: sK - 3, v0: m }).ok) hi = m; else lo = m; }
  return hi;
}

// KI-Gate: 8 Gleiter × runden; Wandtreffer je Gleiter-Minute; Median der Runden je Profil
export function kiGate(id, runden = 10) {
  const { r, profile, zaehl } = kiRennen(runden, '', () => {}, id);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const je = {};
  for (const t of r.alle) (je[profile[t.k]] ||= []).push(...t.rundenZeiten.slice(1));
  const fahrer = r.alle.map((t) => ({ name: t.name, profil: profile[t.k], weg: t.pilot.plan.weg, abfluege: t.g.statistik.abfluege, sprungAbstuerze: t.g.statistik.sprungAbstuerze,
    landungen: t.g.statistik.sprungLandungen, wand: t.g.statistik.wandTreffer, runden: t.rundenZeiten.length, beste: t.beste }));
  return { phase: r.phase, zeit: r.zeit, fahrer, median: Object.fromEntries(Object.entries(je).map(([k, v]) => [k, median(v)])),
    wandJeMin: zaehl.wand / (8 * r.zeit / 60), abfluege: zaehl.absturz };
}

if (process.argv[1] && process.argv[1].endsWith('strecke_pruefen.mjs')) {
  const id = process.argv[2] || 'wueste', runden = +(process.argv[3] || 10);
  const bahn = baueStrecke(id), g = geometrie(bahn);
  console.log(`${bahn.name}: ${(g.L / 1000).toFixed(2)} km, Schließfehler ${g.schluss.m.toFixed(3)} m / ${g.schluss.grad.toFixed(4)}°, kleinster Radius ${(1 / g.maxK).toFixed(0)} m, Krümmungssprung ${g.maxDK.toFixed(5)}, Querneigung ${g.maxDB.toFixed(2)}°/2 m`);
  console.log(`  Abstand zu sich selbst (Rest über Halbbreiten + 3 m): ${g.abstand.toFixed(1)} m bei ${JSON.stringify(g.wo)}; steil ohne Magnet: ${g.ohneMagnet.length}`);
  console.log(`  Pad-Ketten ${JSON.stringify(g.ketten)}, Ringe ${g.ringe}`);
  for (const s of g.spruenge) console.log(`  Sprung ${s.name}: Lücke ${s.luecke} m, Pads davor ${s.pads}, Ringe ${s.ringe}, Landezone ${s.landezone} (${s.landeBreite * 2} m breit), Mindesttempo ${mindesttempo(bahn, s.name).toFixed(1)} m/s (Tabelle ${(bahn.sprungMindest || {})[s.name]})`);
  const ki = kiGate(id, runden);
  console.log(`KI-Gate ${runden} Runden: Phase ${ki.phase}, Abflüge ${ki.abfluege}, Wand ${ki.wandJeMin.toFixed(2)} je Gleiter-Minute, Median ${JSON.stringify(Object.fromEntries(Object.entries(ki.median).map(([k, v]) => [k, +v.toFixed(1)])))}`);
  for (const f of ki.fahrer) console.log(`  ${f.name.padEnd(8)} ${f.profil.padEnd(6)} ${f.weg.padEnd(7)} Runden ${f.runden} beste ${f.beste.toFixed(1)} Abflüge ${f.abfluege} Landungen ${f.landungen} Wand ${f.wand}`);
}
