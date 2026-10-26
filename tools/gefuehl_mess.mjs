// Messgrößen „Fühlt es sich wie der Referenz-Racer an?“ (Datenblatt Fahrgefühl, Abschnitt 5) als Node-Simulation.
// Aufruf: node tools/gefuehl_mess.mjs [--rennen 8] [--nur 1,3,9]   → Markdown-Tabelle „Referenz / Hyperbahn-Ziel / gemessen“
// Die Funktionen werden auch von tests/node/test_gefuehl.mjs genutzt (dort mit weniger Rennen).
// Browser-Größen (#6 Start-Boost-Quote bei Testern) bleiben für den Heavy-Job; #13/#14 (Kamera) rechnet hier die reine
// Kamera-Mathe (gfx/kamera.js) ohne Bild.
import { ZEIT, GLEITER, leseRegler } from '../src/config.js';
import { leseGefuehl } from '../src/physics/fahrgefuehl.js';
import { GEFUEHL, KLASSEN_LISTE } from '../src/physics/fahrgefuehl.js';
import { baueBahn } from '../src/track/bahn.js';
import { strecke1 } from '../src/track/strecke1.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { bauePlan, Pilot, PROFILE } from '../src/ai/pilot.js';
import { Rennen, TEAMS, STOSS } from '../src/game/rennen.js';
import { ITEMS_HB, ziehe } from '../src/game/items.js';
import { KameraRig } from '../src/gfx/kamera.js';
import { rng } from '../src/core/util.js';

const dt = ZEIT.schritt;
const NULL = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
const gerade = () => baueBahn([{ typ: 'gerade', len: 9000, breite: 13 }], { ohneSchluss: true });
function spur(g, u = 0) {
  const q = g.q, vt = g.v.x * q.T.x + g.v.y * q.T.y + g.v.z * q.T.z, vl = g.v.x * q.Ls.x + g.v.y * q.Ls.y + g.v.z * q.Ls.z;
  return Math.max(-1, Math.min(1, 0.05 * (u - g.u) - 2.2 * Math.atan2(vl, Math.max(vt, 1))));
}

// #1/#2: Zeit bis 50/90/100 % Höchsttempo je Klasse (Vollgas, gerade, ohne Pads); Kreuzung der Kurven
export function mess1() {
  const b = gerade(), out = {};
  for (const k of KLASSEN_LISTE) {
    const g = new Gleiter(b, { s: 50, v0: 0, klasse: k }), vm = GLEITER.vmax * g.kl.top;
    const T = {}; let t = 0; const verlauf = [];
    while (t < 12) {
      g.schritt(dt, { ...NULL, gas: 1, lenk: spur(g) }); t += dt;
      verlauf.push(g.tempo / vm);
      for (const p of [50, 80, 90, 99.5]) if (T[p] == null && g.tempo >= vm * p / 100) T[p] = t;
    }
    out[k] = { t50: T[50], t80: T[80], t90: T[90], t100: T[99.5], verlauf };
  }
  // Kreuzung: Tempo-Anteil, ab dem schwer vor mittel liegt (gleiche Zeit, höheres Tempo)
  const vm = out.mittel.verlauf, vs = out.schwer.verlauf;
  let kreuz = null;
  for (let i = 1; i < vm.length; i++) if (vs[i] > vm[i] && vs[i - 1] <= vm[i - 1] && vm[i] > 0.3) { kreuz = vm[i]; break; }
  return { klassen: out, kreuzSchwerMittel: kreuz };
}

// #3/#4: Mini-Turbo-Gewinn je Kurve (gleiche Kurve mit/ohne Drift, Profi-Pilot ohne Fehler) und Drift-Quote auf Strecke 1
function kurvenBahn() {
  return baueBahn([{ typ: 'gerade', len: 700 }, { typ: 'kurve', len: 640, gier: 90, bank: [12, 12, 0] }, { typ: 'gerade', len: 1500 }], { ohneSchluss: true });
}
export function mess3() {
  const b = kurvenBahn(), plan = bauePlan(b);
  const lauf = (drift) => {
    const g = new Gleiter(b, { s: 20, v0: GLEITER.vmax }), p = new Pilot(b, plan, { ...PROFILE.profi, drift, linie: 0, wackler: 0 }, 2);
    let t = 0;
    while (g.s < 2600 && t < 60) { g.schritt(dt, p.steuer(g, dt, [])); t += dt; g.ereignisse.length = 0; }
    return { t, mt: g.statistik.miniturbos, stufen: g.statistik.driftStufen.slice(), wand: g.statistik.wandTreffer };
  };
  const ohne = lauf(0), mit3 = lauf(1);
  const alt = GEFUEHL.mtGewinn[3]; GEFUEHL.mtGewinn[3] = GEFUEHL.mtGewinn[2];
  const mit2 = lauf(1);
  GEFUEHL.mtGewinn[3] = alt;
  return { ohne, gewinn2: ohne.t - mit2.t, gewinn3: ohne.t - mit3.t, mit3 };
}
export function mess4() {
  const b = strecke1(), plan = bauePlan(b);
  const g = new Gleiter(b, { s: 5, v0: GLEITER.vmax }), p = new Pilot(b, plan, PROFILE.profi, 4);
  const erreicht = new Set(); let t = 0, weg = 0, s0 = g.s;
  while (weg < b.L && t < 400) {
    g.schritt(dt, p.steuer(g, dt, []));
    for (const e of g.ereignisse) if (e.art === 'driftStufe' && e.stufe >= 2) erreicht.add(plan.kurveId[Math.round(g.s / b.ds) % b.N]);
    g.ereignisse.length = 0; t += dt;
    let d = g.s - s0; if (d < -b.L / 2) d += b.L; weg += d; s0 = g.s;
  }
  erreicht.delete(-1);
  return { kurven: plan.kurven.length, mitStufe2: erreicht.size, quote: erreicht.size / Math.max(1, plan.kurven.length), runde: t };
}

// #5: Abkürzen über das Störfeld (Innenkante) gegen die Ideallinie, gleiche Kurve
export function mess5() {
  const b = kurvenBahn(), plan = bauePlan(b);
  const kante = { ...plan, u: Float64Array.from(plan.u, (x, i) => (b.flags[i] ? 0 : 0) + Math.sign(plan.kSign[i] || 0) * (b.hw[i] - 1.6)) };
  // Innenkante nur in der Kurve, sonst Mitte
  for (let i = 0; i < b.N; i++) if (Math.abs(plan.kSign[i]) < 1 / 3000) kante.u[i] = plan.u[i];
  const lauf = (pl) => {
    const g = new Gleiter(b, { s: 20, v0: GLEITER.vmax }), p = new Pilot(b, pl, { ...PROFILE.profi, drift: 0, linie: 0, wackler: 0 }, 2);
    let t = 0, rand = 0;
    while (g.s < 2600 && t < 60) { g.schritt(dt, p.steuer(g, dt, [])); t += dt; if (g.imRand) rand += dt; g.ereignisse.length = 0; }
    return { t, rand };
  };
  const ideal = lauf(plan), innen = lauf(kante);
  return { ideal: ideal.t, innen: innen.t, verlust: innen.t - ideal.t, randZeit: innen.rand };
}

// #7/#8: Zeitverlust je Treffer (Mensch/KI), gerettet, mit Neustart-Rhythmus
export function mess7() {
  const b = gerade();
  const lauf = (art, ki = false) => {
    const g = new Gleiter(b, { s: 50, v0: GLEITER.vmax, ki });
    let t = 0; const tipps = [];
    while (t < 14) {
      const e = { ...NULL, gas: 1, lenk: spur(g) };
      if (art !== 'kein' && Math.abs(t - 1) < dt / 2) g.treffer(1);
      if (art === 'gerettet' && t > 1.3 && t < 1.4) { e.bremseL = 1; e.bremseR = 1; }
      if (art === 'neustart' && g.treff && g.treff.phase === 'dreher') {
        // 5 Tipper im 0,1-s-Takt: Gas 0,05 s los, 0,05 s drücken
        const k = Math.floor((t - 2.0) / 0.05);
        if (t > 2.0 && k < 10) e.gas = k % 2 ? 1 : 0;
        tipps.push(e.gas);
      }
      g.schritt(dt, e); t += dt; g.ereignisse.length = 0;
    }
    return { s: g.s, neustarts: g.statistik.neustarts };
  };
  const basis = lauf('kein').s, v = GLEITER.vmax;
  const mensch = (basis - lauf('dreher').s) / v, ki = (basis - lauf('dreher', true).s) / v;
  const gerettet = (basis - lauf('gerettet').s) / v;
  const ns = lauf('neustart');
  return { mensch, ki, gerettet, mitNeustart: (basis - ns.s) / v, neustartAusgeloest: ns.neustarts, verhaeltnis: ki / mensch };
}

// #9/#10: Feld-Abstand mit/ohne Gummiband (Autopilot-Mensch „mittel“ + 7 KI), n Rennen à 2 Runden
export function mess9(n = 8, runden = 2) {
  const b = strecke1(), plan = bauePlan(b);
  const lauf = (staerke) => {
    const gaps = [], spreads = [], wechsel = [];
    for (let r = 0; r < n; r++) {
      const profile = ['mittel', 'profi', 'profi', 'mittel', 'mittel', 'mittel', 'leicht', 'leicht'];
      const teil = TEAMS.map((t, k) => ({ ...t, klasse: KLASSEN_LISTE[(k + r) % 3], spieler: k === 0, pilot: new Pilot(b, plan, k === 0 ? { ...PROFILE[profile[k]], streu: 0 } : PROFILE[profile[k]], 1000 * r + 31 * k + 7) }));   // P3: Mensch ohne KI-Handschrift
      const rn = new Rennen(b, teil, { runden, gummiband: staerke, ohneCountdown: true });
      let n2 = 0, ordnung = null, w = 0, tProbe = 0;
      while (rn.phase !== 'ziel' && n2++ < 240 * 200 * runden) {
        rn.schritt(dt, null);
        for (const g of rn.gleiter) g.ereignisse.length = 0;
        // Platzwechsel in der Endrunde (Stichprobe alle 0,5 s)
        tProbe += dt;
        if (tProbe >= 0.5 && rn.rangliste && rn.alle[0].runde >= runden - 1) {
          tProbe = 0;
          const o = rn.rangliste.map((t) => t.k).join(',');
          if (ordnung && o !== ordnung) w++;
          ordnung = o;
        }
      }
      const z = rn.alle.map((t) => t.ziel ? t.ziel.zeit : rn.zeit);
      gaps.push(z[0] - Math.min(...z));
      spreads.push(Math.max(...z) - Math.min(...z));
      wechsel.push(w);
    }
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    return { medianAbstandP1: med(gaps), medianSpreizung: med(spreads), medianWechsel: med(wechsel), gaps, spreads };
  };
  const mit = lauf(GEFUEHL.gummiband || 0.5), ohne = lauf(0);
  return { mit, ohne, faktor: ohne.medianSpreizung / Math.max(0.01, mit.medianSpreizung) };
}

// #11: Item-Ziehung Monte-Carlo (10 000 je Platz) gegen Tabelle
export function mess11(n = 10000) {
  const r = rng(99); let maxAbw = 0;
  for (let platz = 1; platz <= 8; platz++) {
    const z = {};
    for (let i = 0; i < n; i++) { const a = ziehe(platz, r, ITEMS_HB); z[a] = (z[a] || 0) + 1; }
    for (const [art, zeile] of Object.entries(ITEMS_HB)) maxAbw = Math.max(maxAbw, Math.abs(100 * (z[art] || 0) / n - zeile[platz - 1]));
  }
  return { maxAbweichungPP: maxAbw };
}

// #12: Seitenstoß leicht gegen schwer bei gleichem Tempo → Verhältnis der Quer-Tempo-Änderungen
export function mess12() {
  const b = gerade();
  const r = new Rennen(b, [{ name: 'L', klasse: 'leicht' }, { name: 'S', klasse: 'schwer' }], { runden: 1, ohneCountdown: true, gummiband: 0 });
  const [l, s] = r.gleiter;
  l.setzeAuf(500, 1.0, 80); s.setzeAuf(500, -1.0, 80);
  const q0l = l.v.x * l.links.x + l.v.y * l.links.y + l.v.z * l.links.z;
  // aufeinander zu: leicht nach rechts, schwer nach links (je 4 m/s quer)
  for (const [g, sg] of [[l, -1], [s, 1]]) { g.v.x += g.links.x * 4 * sg; g.v.y += g.links.y * 4 * sg; g.v.z += g.links.z * 4 * sg; }
  // p1c: weicher Stoß wird über STOSS.schritte Schritte ausgezahlt (?stoss=alt: sofort)
  for (let k = 0; k <= (GEFUEHL.stossModus === 'alt' ? 0 : STOSS.schritte); k++) r.stoesse();
  const dq = (g, sg) => Math.abs((g.v.x * g.links.x + g.v.y * g.links.y + g.v.z * g.links.z) - 4 * sg);
  void q0l;
  return { leicht: dq(l, -1), schwer: dq(s, 1), verhaeltnis: dq(l, -1) / Math.max(1e-6, dq(s, 1)) };
}

// #13/#14: Sichtfeld-Kick bei Boost und Kamera-Nachlauf (reine Kamera-Mathe, 60 Bilder/s)
export function mess13() {
  const b = gerade();
  const g = new Gleiter(b, { s: 100, v0: GLEITER.vmax * 0.98 }), rig = new KameraRig();
  const proBild = Math.round(1 / 60 / dt);
  let t = 0, fov0 = null, tHoch = null, tZurueck = null, maxVersatz = 0, eingeschwungen = null, boostAn = null, boostAus = null;
  for (let i = 0; i < 9 / dt; i++) {
    if (Math.abs(t - 2) < dt / 2) { g.padBoost(); boostAn = t; }
    g.schritt(dt, { ...NULL, gas: 1, lenk: spur(g) }); t += dt;
    if (i % proBild === 0) {
      rig.update(1 / 60, g, null, {});
      if (t < 1.9) fov0 = rig.fov;
      if (boostAn != null && tHoch == null && rig.fov >= fov0 + GEFUEHL.fovBoost - 0.05) tHoch = t - boostAn;
      if (boostAn != null && g.boost <= 0 && boostAus == null) boostAus = t;
      if (boostAus != null && tZurueck == null && rig.fov <= fov0 + 0.05) tZurueck = t - boostAus;
      const vs = Math.hypot(rig.versatz.x, rig.versatz.y, rig.versatz.z);
      if (boostAn != null && t - boostAn < 1.5) {
        if (vs > maxVersatz) maxVersatz = vs;
        if (eingeschwungen == null && maxVersatz > 0 && vs >= 0.9 * maxVersatz && t - boostAn > 0.02) eingeschwungen = t - boostAn;
      }
    }
  }
  return { fovBasis: fov0, kickHoch: tHoch, kickZurueck: tZurueck, maxVersatz, eingeschwungen };
}

function f(x, n = 2) { return x == null ? '–' : typeof x === 'number' ? x.toFixed(n).replace('.', ',') : String(x); }

if (process.argv[1] && process.argv[1].endsWith('gefuehl_mess.mjs')) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  leseRegler(arg('--regler', '')); leseGefuehl(arg('--regler', ''));   // z. B. --regler "?bremse=0&lenk=alt
  const nur = (arg('--nur', '') || '').split(',').filter(Boolean);
  const an = (k) => !nur.length || nur.includes(String(k));
  const zeilen = [];
  const t0 = Date.now();
  if (an(1)) {
    const m = mess1();
    for (const k of KLASSEN_LISTE) zeilen.push([`1 Zeit 0→50/90/100 % (${k})`, '1,2–1,7 / 3,2–4,1 / 3,8–5,4 s (Sollwert)', '0,9–1,2 / 2,5–3,0 / 4,0–4,5 s', `${f(m.klassen[k].t50)} / ${f(m.klassen[k].t90)} / ${f(m.klassen[k].t100)} s`]);
    zeilen.push(['2 Kurvenform (schwer überholt mittel bei)', 'schwer mittig zäh', 'Kreuzung 60–80 %', `${f(m.kreuzSchwerMittel * 100, 0)} %`]);
  }
  if (an(3)) {
    const m = mess3();
    zeilen.push(['3 Mini-Turbo-Gewinn je Kurve', '≈ 0,15 s (unsicher)', 'Stufe 2: 0,25–0,4 s · Stufe 3: 0,4–0,6 s', `Stufe 2: ${f(m.gewinn2)} s · Stufe 3: ${f(m.gewinn3)} s (Wand ${m.mit3.wand})`]);
  }
  if (an(4)) { const m = mess4(); zeilen.push(['4 Drift-Quote Profi (Stufe ≥ 2)', 'Stufe 2 nach ≥ 0,43 s Pumpen', '≥ 80 % der Kurven', `${m.mitStufe2}/${m.kurven} Kurven (${f(m.quote * 100, 0)} %), Runde ${f(m.runde, 1)} s`]); }
  if (an(5)) { const m = mess5(); zeilen.push(['5 Abkürzen übers Störfeld', 'Abzug fällt mit Boost weg', '≥ 0,3 s langsamer als Ideallinie', `${f(m.verlust)} s langsamer (${f(m.randZeit, 1)} s im Störfeld)`]); }
  zeilen.push(['6 Start-Boost-Quote', 'Fenster 0,13 s', '30–50 % bei Testern am Handy', 'Browser/Tester (Heavy-Job); Fenster 0,25 s, KI-Quote je Profil 15/40/70 %']);
  if (an(7)) {
    const m = mess7();
    zeilen.push(['7 Zeitverlust je Treffer (Mensch)', '≈ 0,8–1,0 s; gerettet ≈ 0', '0,8–1,2 s; gerettet ≤ 0,2 s; Neustart −0,3 s', `${f(m.mensch)} s; gerettet ${f(m.gerettet)} s; mit Neustart ${f(m.mitNeustart)} s (${m.neustartAusgeloest}×)`]);
    zeilen.push(['8 KI-/Mensch-Verlust', 'KI ≫ Mensch', '1,5–2×', `${f(m.verhaeltnis)}× (KI ${f(m.ki)} s)`]);
  }
  if (an(9)) {
    const n = +arg('--rennen', 8);
    const m = mess9(n);
    zeilen.push([`9 Feld mit Gummiband (${n} Rennen à 2 Runden)`, 'Führender ≤ 3–8 s vor dem Menschen', 'Median Abstand zu P1 ≤ 4 s; P1–P8 6–15 s; Endrunde ≥ 2 Wechsel', `${f(m.mit.medianAbstandP1, 1)} s; ${f(m.mit.medianSpreizung, 1)} s; ${m.mit.medianWechsel} Wechsel`]);
    zeilen.push(['10 Gummiband aus', '–', 'Feld streut ≥ 2× stärker', `${f(m.faktor, 2)}× (aus: ${f(m.ohne.medianSpreizung, 1)} s)`]);
  }
  if (an(11)) { const m = mess11(); zeilen.push(['11 Item-Verteilung (10 000 je Platz)', 'Tabelle nach Platz', '±1 Prozentpunkt zur Tabelle', `max. ${f(m.maxAbweichungPP)} PP`]); }
  if (an(12)) { const m = mess12(); zeilen.push(['12 Stoß-Verhältnis leicht/schwer', '≈ 10,7×', GEFUEHL.stossModus === 'alt' ? '≈ 7,6× (Deckel 3)' : '≈ 5,5× (Deckel 2, p1c), höchstens 6 m/s je Kontakt', `${f(m.verhaeltnis, 1)}×`]); }
  if (an(13)) {
    const m = mess13();
    zeilen.push(['13 Sichtfeld-Kick bei Boost', '+8° in ≈ 0,27 s, zurück ≈ 0,27 s', '+12° in ≤ 0,3 s, zurück in 0,5 s', `+${GEFUEHL.fovBoost}° in ${f(m.kickHoch)} s, zurück in ${f(m.kickZurueck)} s (Basis ${f(m.fovBasis, 1)}°)`]);
    zeilen.push(['14 Kamera-Nachlauf beim Boost-Start', '40 %/15 % je Tick', 'Versatz 3–6 % der Folgedistanz, ≤ 0,4 s', `max. ${f(m.maxVersatz)} m (= ${f(m.maxVersatz / 9.5 * 100, 1)} % von 9,5 m), 90 % davon nach ${f(m.eingeschwungen)} s; bleibt, solange beschleunigt wird`]);
  }
  console.log('| # Messgröße | Referenz (Datenblatt) | Hyperbahn-Ziel | gemessen (Node) |\n|---|---|---|---|');
  for (const z of zeilen) console.log('| ' + z.join(' | ') + ' |');
  console.log(`\nRechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
