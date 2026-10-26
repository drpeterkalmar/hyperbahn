// Messgrößen aus dem Vorlagen-Datenblatt (Abschnitt 5) als Tabelle „Ziel / gemessen“ – Node, ohne Browser.
// Aufruf: node tools/vorlagen_mess.mjs [url-regler] [--nur 1,2,3]     z. B. "?schwebe=0&bremse=0" für den Vorher-Stand
// Jede Messung baut ihre eigene kleine Teststrecke (gerade, breit) bzw. nutzt Strecke 1.
import { leseRegler, GLEITER, ZEIT, G, BOOST } from '../src/config.js';
import { leseGefuehl } from '../src/physics/fahrgefuehl.js';
import { baueBahn } from '../src/track/bahn.js';
import { strecke1, SPRUNG_MINDEST } from '../src/track/strecke1.js';
import { Gleiter } from '../src/physics/gleiter.js';

const dt = ZEIT.schritt;
const RAD = 180 / Math.PI;
const AUS = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
const ebene = (breite = 13, len = 4000) => baueBahn([{ typ: 'gerade', len, breite }], { ohneSchluss: true });
const PUNKT_TIEFE = 0.2;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const fahre = (g, sek, ein) => { const n = Math.round(sek / dt); for (let i = 0; i < n; i++) g.schritt(dt, typeof ein === 'function' ? ein(g, i * dt) : ein); };

// 1) Schwebe-Ruhelage und Federweg nach Landung aus 10 m
export function m1() {
  const b = ebene();
  const g = new Gleiter(b, { s: 100, v0: 0 });
  fahre(g, 3, AUS);
  let hSum = 0, n = 0; fahre(g, 1, (gg) => { hSum += gg.h; n++; return AUS; });
  const ruhe = hSum / n - PUNKT_TIEFE;   // Höhe der Schwebe-Punkte (0,2 m unter der Gleiter-Mitte)
  // aus 10 m Höhe fallen lassen (Luft-Schwerkraft wie im Spiel), mit 40 m/s vorwärts
  const g2 = new Gleiter(b, { s: 100, v0: 40 });
  g2.p.y += 10;
  let hMin = 99, tLand = -1, tRuhig = -1, durch = 0, t = 0;
  for (let i = 0; i < 6 / dt; i++) {
    g2.schritt(dt, { ...AUS, gas: 0.4 });
    t += dt;
    for (const e of g2.ereignisse) if (e.art === 'aufsetzer') durch++;
    g2.ereignisse.length = 0;
    if (tLand < 0 && g2.h - PUNKT_TIEFE < GLEITER.hoehe + 0.3) tLand = t;
    const hp = g2.h - PUNKT_TIEFE;
    if (tLand >= 0) { hMin = Math.min(hMin, hp); if (Math.abs(hp - ruhe) > 0.05) tRuhig = -1; else if (tRuhig < 0) tRuhig = t; }
  }
  return { ruhe, einfedern: ruhe - hMin, hMin, ruhig: tRuhig - tLand, durchschlag: durch };
}

// 2) Kurvenradius bei Top mit/ohne eine Luftbremse (Kreisfahrt auf breiter Ebene, Vollgas, voller Einschlag)
function kreis(bremse) {
  const b = ebene(300, 6000);
  const g = new Gleiter(b, { s: 200, v0: GLEITER.vmax });
  fahre(g, 1.5, { ...AUS, gas: 1 });
  let psi0 = null, t = 0, vSum = 0, n = 0, slipMax = 0;
  const kurs = (gg) => Math.atan2(gg.v.x, -gg.v.z);
  let alt = kurs(g), dreh = 0;
  for (let i = 0; i < 2.5 / dt; i++) {
    g.schritt(dt, { ...AUS, gas: 1, lenk: 1, bremseL: bremse ? 1 : 0 });
    t += dt;
    const k = kurs(g); let d = k - alt; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; alt = k;
    const slip = Math.abs(Math.atan2(dot(g.v, g.links), Math.max(1, dot(g.v, g.vor)))) * RAD;
    slipMax = Math.max(slipMax, slip);
    if (t > 1) { dreh += d; vSum += g.tempo; n++; }
  }
  void psi0;
  const zeit = n * dt, v = vSum / n, rate = Math.abs(dreh) / zeit;
  // Rückkehr des Schiebewinkels nach dem Lösen (< 2°)
  let zurueck = -1, tz = 0;
  for (let i = 0; i < 3 / dt; i++) {
    g.schritt(dt, { ...AUS, gas: 1 });
    tz += dt;
    const slip = Math.abs(Math.atan2(dot(g.v, g.links), Math.max(1, dot(g.v, g.vor)))) * RAD;
    if (slip < 2 && zurueck < 0) zurueck = tz;
  }
  return { radius: v / rate, v, slipMax, zurueck, drift: g.statistik.driftStufen.reduce((a, c) => a + c, 0) };
}
export function m2() { const ohne = kreis(false), mit = kreis(true); return { ohne, mit, verhaeltnis: mit.radius / ohne.radius }; }

// 3) Tempo-Verlust Dauer-Luftbremse 3 s (geradeaus, Vollgas, eine bzw. beide)
export function m3() {
  const lauf = (bl, br) => {
    const b = ebene(400, 6000);
    const g = new Gleiter(b, { s: 200, v0: GLEITER.vmax });
    fahre(g, 1, { ...AUS, gas: 1 });
    const v0 = GLEITER.vmax;
    fahre(g, 3, { ...AUS, gas: 1, bremseL: bl, bremseR: br });
    return g.tempo / v0;
  };
  return { eine: lauf(1, 0), beide: lauf(1, 1) };
}

// 4) Gleitwinkel beim Bremsen-Drift: aus m2 (Schiebewinkel max., Rückkehr nach dem Lösen)
export function m4() { const k = kreis(true); return { slipMax: k.slipMax, zurueck: k.zurueck }; }

// 8) Wandtreffer 30° bei Top: Tempo- und Energie-Verlust
export function m8() {
  const b = ebene(13, 3000);
  const g = new Gleiter(b, { s: 200, u: 0, v0: GLEITER.vmax });
  // Gleiter um 30° nach links drehen (Nase und Tempo), dann geradeaus in die Wand
  const w = 30 / RAD, c = Math.cos(w), s = Math.sin(w);
  const vor = { ...g.vor }, links = { ...g.links };
  const neu = (a, bb, ca, sa) => ({ x: a.x * ca + bb.x * sa, y: a.y * ca + bb.y * sa, z: a.z * ca + bb.z * sa });
  const nv = neu(vor, links, c, s), nl = neu(links, vor, c, -s);
  Object.assign(g.vor, nv); Object.assign(g.links, nl);
  const v = g.tempo || GLEITER.vmax;
  g.v.x = nv.x * v; g.v.y = nv.y * v; g.v.z = nv.z * v;
  const e0 = g.energie ?? g.schild, v0 = g.tempo;
  let treffer = 0, tTreffer = -1, t = 0, vNach = v0, eNach = e0;
  for (let i = 0; i < 1.5 / dt; i++) {
    // nach dem Einschlag lenkt der Fahrer von der Wand weg (wie ein Mensch), sonst schleift er weiter
    g.schritt(dt, { ...AUS, gas: 1, lenk: tTreffer >= 0 ? -0.6 : 0 });
    t += dt;
    for (const e of g.ereignisse) if (e.art === 'wand') { treffer++; if (tTreffer < 0) tTreffer = t; }
    g.ereignisse.length = 0;
    if (tTreffer >= 0 && t - tTreffer <= 0.25) { vNach = g.tempo; eNach = g.energie ?? g.schild; }
  }
  return { tempo: vNach / v0 - 1, energie: eNach - e0, treffer };
}

// 9) Sprung verfehlt: Zeitverlust gegenüber einem knapp geschafften Sprung (gleicher Anlauf, Ziel = Ende der Landezone + 200 m)
export function m9() {
  const bahn = strecke1();
  const k = bahn.abschnitte.findIndex((a) => a.name === 'Häuserschlucht');
  const kL = bahn.abschnitte.findIndex((a) => a.name === 'Landezone 1');
  const sKante = bahn.segStart[k], sZiel = bahn.segStart[kL] + bahn.abschnitte[kL].len + 200;
  const vmin = SPRUNG_MINDEST['Häuserschlucht'];
  const lauf = (v0) => {
    const g = new Gleiter(bahn, { s: sKante - 3, v0 });
    let t = 0, gefahren = 0, sAlt = g.s, minS = Infinity;
    for (let i = 0; i < 40 / dt; i++) {
      g.schritt(dt, { ...AUS, gas: 1 });
      t += dt;
      let d = g.s - sAlt; if (d < -bahn.L / 2) d += bahn.L; sAlt = g.s;
      if (Math.abs(d) < 600) gefahren += d;
      if (g.zustand === 'fahrt' && g.boden) minS = Math.min(minS, g.s);
      if (g.zustand === 'fahrt' && g.s > sZiel - 1 && g.s < sZiel + 50) break;
    }
    return { t, abfluege: g.statistik.abfluege, vorDemSprung: minS < sKante - 5 };
  };
  const gut = lauf(vmin + 2), schlecht = lauf(vmin - 12);
  return { verlust: schlecht.t - gut.t, gut, schlecht };
}

// L) Lenkwechsel (Vorlage: Gier-Beschleunigung begrenzt, Gegenlenken doppelt so schnell): bei 60 m/s volle Linkskurve, dann
// voll rechts – Zeit bis die Gierrate die Richtung gewechselt hat und bis 90 % der neuen Rate; dazu Anlenken aus geradeaus
export function mL() {
  const b = ebene(400, 6000);
  const g = new Gleiter(b, { s: 200, v0: 60 });
  const halte = (gg) => ({ ...AUS, gas: gg.tempo < 60 ? 1 : 0 });
  fahre(g, 0.5, halte);
  const gier = (gg) => dot(gg.w, gg.oben);
  let t = 0, t90an = -1;
  for (let i = 0; i < 1.5 / dt; i++) { g.schritt(dt, { ...halte(g), lenk: 1 }); t += dt; if (t90an < 0 && gier(g) > 0.9 * 0.73) t90an = t; }
  const voll = gier(g);
  let tNull = -1, t90 = -1; t = 0;
  for (let i = 0; i < 1.5 / dt; i++) { g.schritt(dt, { ...halte(g), lenk: -1 }); t += dt; if (tNull < 0 && gier(g) < 0) tNull = t; if (t90 < 0 && gier(g) < -0.9 * voll) t90 = t; }
  return { voll, anlenken: t90an, wechselNull: tNull, wechsel90: t90 };
}

const MESS = {
  1: ['Schwebe-Ruhelage & Federweg nach Landung aus 10 m', '1,15–1,25 m; Einfedern ≤ 0,4 m, ruhig ≤ 0,5 s, kein Durchschlag',
    (r) => `Ruhe ${r.ruhe.toFixed(2)} m · Einfedern ${r.einfedern.toFixed(2)} m (tiefste ${r.hMin.toFixed(2)} m) · ruhig nach ${r.ruhig.toFixed(2)} s · Aufsetzer ${r.durchschlag}`, m1],
  2: ['Kurvenradius bei Top mit/ohne eine Luftbremse', 'mit ≤ 0,6 × ohne',
    (r) => `ohne ${r.ohne.radius.toFixed(0)} m (${r.ohne.v.toFixed(0)} m/s) · mit ${r.mit.radius.toFixed(0)} m (${r.mit.v.toFixed(0)} m/s) · ${r.verhaeltnis.toFixed(2)} ×`, m2],
  3: ['Tempo nach 3 s Dauer-Luftbremse (Top)', 'eine 78–82 %, beide ≈ 45 %',
    (r) => `eine ${(r.eine * 100).toFixed(0)} % · beide ${(r.beide * 100).toFixed(0)} %`, m3],
  4: ['Gleitwinkel beim Bremsen-Drift', 'max. 15–25°, zurück ≤ 1,2 s',
    (r) => `max. ${r.slipMax.toFixed(1)}° · zurück nach ${r.zurueck.toFixed(2)} s`, m4],
  8: ['Wandtreffer 30° bei Top', '−15…−25 % Tempo, −4…−8 % Energie',
    (r) => `Tempo ${(r.tempo * 100).toFixed(0)} % · Energie ${(r.energie * 100).toFixed(1)} %`, m8],
  L: ['Lenkwechsel bei 60 m/s (Gegenlenken)', 'Gegenlenken ≈ doppelt so schnell wie Anlenken (Vorlage), Gierrate ≤ 100°/s',
    (r) => `volle Gierrate ${(r.voll * RAD).toFixed(0)}°/s · Anlenken bis 90 % ${r.anlenken.toFixed(2)} s · Gegenlenken: Richtungswechsel nach ${r.wechselNull.toFixed(2)} s, 90 % nach ${r.wechsel90.toFixed(2)} s`, mL],
  9: ['Sprung verfehlt (Häuserschlucht)', 'Zeitverlust 2,0–3,0 s, nie vor den Sprung zurück',
    (r) => `Zeitverlust ${r.verlust.toFixed(2)} s · Abflüge ${r.schlecht.abfluege} · vor den Sprung zurück: ${r.schlecht.vorDemSprung ? 'JA' : 'nein'}`, m9],
};

export function vorlagenMessung(regler = '', nur = null) {
  leseRegler(regler); leseGefuehl(regler);
  const out = [];
  for (const [nr, [name, ziel, fmt, fn]] of Object.entries(MESS)) {
    if (nur && !nur.includes(nr)) continue;
    const r = fn();
    out.push({ nr, name, ziel, text: fmt(r), r });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('vorlagen_mess.mjs')) {
  const args = process.argv.slice(2);
  const iNur = args.indexOf('--nur');
  const nur = iNur >= 0 ? args[iNur + 1].split(',') : null;
  const regler = args.find((a) => a.startsWith('?')) || '';
  console.log(`Vorlagen-Messgrößen ${regler || '(Standard)'}`);
  for (const z of vorlagenMessung(regler, nur)) console.log(`#${z.nr} ${z.name}\n   Ziel: ${z.ziel}\n   gemessen: ${z.text}`);
  void G; void BOOST;
}
