// P1b Etappe B – Energie = Schild = Boost (Datenblatt Abschnitt 3): manueller Boost ab Runde 2 (12 %, nie unter 1 %),
// Boxengasse (35 %/s), Notlauf bei leerem Balken, Rot-Warnung, Barrel-Roll kostet Energie (1× je Sprung, Turbo nach der
// Landung). ?energie=0 = bisher. P3 (26.10.2026): Energie standardmäßig AUS – diese Tests laufen mit ?energie=1 (E);
// der letzte Test prüft den neuen Standard (kein Balken/Boost/Box/Notlauf, Rolle kostenlos 1× je Sprung, Turbo bei der Landung).
// Aufruf: node --test tests/node/test_vorlagen_b.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leseRegler, VORLAGE, GLEITER, ZEIT } from '../../src/config.js';
import { baueBahn, inBox } from '../../src/track/bahn.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Gleiter } from '../../src/physics/gleiter.js';
import { Rennen } from '../../src/game/rennen.js';
import { vorlagenMessung } from '../../tools/vorlagen_mess.mjs';

const dt = ZEIT.schritt;
const E = '?energie=1';
const AUS = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0, boost: 0 };
const ebene = () => baueBahn([{ typ: 'gerade', len: 20000, breite: 30 }], { ohneSchluss: true });
const ereignisse = (g, art) => { const n = g.ereignisse.filter((e) => e.art === art).length; g.ereignisse.length = 0; return n; };

test('Regler: Standard aus (P3), ?energie=1 an, ?energie=0 aus, ?boostkosten= ?box= ?rollkosten= in %', () => {
  leseRegler('?energie=0&boostkosten=20&box=50&rollkosten=0');
  assert.ok(!VORLAGE.energie.an); assert.equal(VORLAGE.energie.kosten, 0.2); assert.equal(VORLAGE.energie.box, 0.5); assert.equal(VORLAGE.energie.rolle, 0);
  leseRegler('');
  assert.ok(!VORLAGE.energie.an, 'P3: Standard aus');
  leseRegler(E);
  assert.ok(VORLAGE.energie.an); assert.equal(VORLAGE.energie.kosten, 0.12); assert.equal(VORLAGE.energie.box, 0.35);
  leseRegler('');
});

test('#5 Energie-Boost: erst ab Freigabe, 12 % je Boost, 8 aus vollem Balken, nie unter 1 %; +35 % Höchsttempo 1,6 s', () => {
  leseRegler(E);
  const g = new Gleiter(ebene(), { s: 100, v0: GLEITER.vmax });
  g.schritt(dt, { ...AUS, gas: 1, boost: 1 });
  assert.equal(ereignisse(g, 'boostNein'), 1, 'gesperrt vor Runde 2');
  assert.equal(g.schild, 1);
  g.boostFrei = true;
  g.schritt(dt, { ...AUS, gas: 1, boost: 0 });
  g.schritt(dt, { ...AUS, gas: 1, boost: 1 });
  assert.equal(ereignisse(g, 'energieBoost'), 1);
  assert.ok(Math.abs(g.schild - 0.88) < 1e-9 && Math.abs(g.boost - 0.35) < 1e-9 && Math.abs(g.boostZeit - 1.6) < 0.01);
  g.schritt(dt, { ...AUS, gas: 1, boost: 1 });
  assert.equal(ereignisse(g, 'energieBoost'), 0, 'gehaltene Taste = ein Boost');
  const r = Object.fromEntries(vorlagenMessung(E, ['5']).map((z) => [z.nr, z.r]))[5];
  leseRegler('');
  console.log(`  ${r.boosts} Boosts, Energie min ${(r.minE * 100).toFixed(0)} %, Boxengasse voll nach ${r.boxVoll.toFixed(2)} s`);
  assert.equal(r.boosts, 8);
  assert.ok(r.minE >= 0.01);
  assert.ok(r.boxVoll >= 2.5 && r.boxVoll <= 3.5);
});

test('Boxengasse liegt auf der Start-Ziel-Geraden, lädt nur dort; ?energie=0 lädt nie', () => {
  const bahn = strecke1(), x = bahn.box;
  assert.ok(x && x.s1 - x.s0 >= 250, 'Boxengasse vorhanden');
  const k = bahn.abschnitte.findIndex((a) => a.name === 'Start-Ziel');
  assert.ok(x.s0 >= bahn.segStart[k] && x.s1 <= bahn.segStart[k] + bahn.abschnitte[k].len);
  assert.ok(inBox(bahn, (x.s0 + x.s1) / 2, x.u) && !inBox(bahn, (x.s0 + x.s1) / 2, 0) && !inBox(bahn, x.s1 + 5, x.u));
  // keine Überschneidung mit Pads oder dem Störfeld-Rand
  for (const p of bahn.pads) assert.ok(p.s1 < x.s0 || p.s0 > x.s1 || Math.abs(p.u - x.u) > p.b + x.b);
  assert.ok(Math.abs(x.u) + x.b <= 13 - 2.8 + 0.01, 'innerhalb des Störfeld-Rands');
  for (const [regler, laedt] of [[E, true], ['?energie=0', false], ['', false]]) {
    leseRegler(regler);
    const g = new Gleiter(bahn, { s: x.s0 + 20, u: x.u, v0: 30 }); g.schild = 0.5;
    for (let i = 0; i < 1 / dt; i++) g.schritt(dt, { ...AUS, gas: 0.3 });
    assert.equal(g.schild > 0.8, laedt, regler || 'Standard');
  }
  leseRegler('');
});

test('Notlauf: leerer Balken = Höchsttempo × 0,7 + Ereignis; Warnung unter 25 %', () => {
  leseRegler(E);
  const lauf = (e0) => {
    const g = new Gleiter(ebene(), { s: 100, v0: GLEITER.vmax }); g.schild = e0;
    let notlauf = 0, warn = 0;
    for (let i = 0; i < 8 / dt; i++) { g.schritt(dt, { ...AUS, gas: 1 }); notlauf += ereignisse(g, 'notlauf'); }
    void warn;
    return { v: g.tempo, notlauf };
  };
  const voll = lauf(1), leer = lauf(0);
  assert.equal(leer.notlauf, 1);
  assert.ok(Math.abs(leer.v / voll.v - 0.7) < 0.03, `${(leer.v / voll.v).toFixed(2)}`);
  const g = new Gleiter(ebene(), { s: 100, v0: 60 }); g.schild = 0.3;
  g.boostFrei = true;
  g.schritt(dt, { ...AUS, gas: 1, boost: 1 });   // 30 % → 18 %: unter die Schwelle
  assert.ok(g.ereignisse.some((e) => e.art === 'energieWarnung'));
  leseRegler('');
});

// Häuserschlucht mit Pad-Kette, einfacher Spurhalter; Rolle zu den Luftzeiten `druecke`
const BAHN1 = strecke1();
function spur(g) {
  const q = g.q, vt = g.v.x * q.T.x + g.v.y * q.T.y + g.v.z * q.T.z, vl = g.v.x * q.Ls.x + g.v.y * q.Ls.y + g.v.z * q.Ls.z;
  return Math.max(-1, Math.min(1, -0.05 * g.u - 2.2 * Math.atan2(vl, Math.max(vt, 1))));
}
function springe(e0, druecke) {
  const k = BAHN1.abschnitte.findIndex((a) => a.name === 'Häuserschlucht Anlauf');
  const g = new Gleiter(BAHN1, { s: BAHN1.segStart[k] - 30, v0: GLEITER.vmax }); g.schild = e0;
  const art = [];
  let n = 0, geflogen = false, luftMax = 0;
  for (let i = 0; i < 12 / dt; i++) {
    const tick = !g.boden && g.luftZeit > 0.3 && druecke.some((t) => Math.abs(g.luftZeit - t) < dt / 2 + 1e-9);
    g.schritt(dt, { ...AUS, gas: 1, lenk: spur(g), rolle: tick ? 1 : 0 });
    for (const e of g.ereignisse) art.push(e.art);
    g.ereignisse.length = 0;
    luftMax = Math.max(luftMax, g.luftZeit);
    if (g.luftZeit > 1) geflogen = true;
    if (geflogen && g.boden) n++;
    if (n > 240) break;
  }
  assert.ok(luftMax > 1.6, `Flug ${luftMax.toFixed(2)} s`);
  return { g, art };
}

test('Barrel-Roll kostet 10 %, nur 1× je Sprung, nicht unter 15 %; Turbo erst nach der Landung; ?rollkosten=0 = bisher', () => {
  leseRegler(E);
  const a = springe(1, [0.4, 1.2]);
  assert.equal(a.art.filter((x) => x === 'rolle').length, 1, 'eine Rolle');
  assert.ok(a.art.includes('rolleNein'), 'zweite abgelehnt');
  assert.ok(a.art.includes('rolleTurbo') && Math.abs(a.art.indexOf('rolleTurbo') - a.art.indexOf('landung')) === 1, 'Turbo bei der Landung');
  assert.ok(Math.abs(a.g.schild - 0.9) < 1e-9, `Energie ${a.g.schild}`);
  const b = springe(0.2, [0.4]);
  assert.equal(b.art.filter((x) => x === 'rolle').length, 0, '20 % reichen nicht (10 % + 15 % Rest)');
  leseRegler(E + '&rollkosten=0');
  const c = springe(1, [0.4, 1.2]);
  leseRegler('');
  assert.equal(c.art.filter((x) => x === 'rolle').length, 2, 'bisher: mehrere Rollen');
  assert.equal(c.g.schild, 1);
});

test('Rennen: Boost-Freigabe ab Runde 2 (1-Runden-Rennen: ab der Hälfte)', () => {
  const bahn = strecke1();
  for (const [runden, s, frei] of [[2, 100, false], [1, 100, false], [1, bahn.L * 0.55, true]]) {
    const r = new Rennen(bahn, [{ name: 'DU' }], { runden, ohneCountdown: true });
    const t = r.alle[0];
    t.g.setzeAuf(s, 0, 50); t.sAlt = t.g.s; t.fortschritt = s;
    r.schritt(dt, AUS);
    assert.equal(t.g.boostFrei, frei, `${runden} Runden, s=${s}`);
  }
  const r = new Rennen(bahn, [{ name: 'DU' }], { runden: 2, ohneCountdown: true });
  const t = r.alle[0]; t.runde = 1; t.fortschritt = bahn.L + 50; t.g.setzeAuf(50, 0, 50); t.sAlt = t.g.s;
  r.schritt(dt, AUS);
  assert.ok(t.g.boostFrei);
});

test('KI nutzt Energie-Boost und Boxengasse, ohne Notlauf (2 Runden)', () => {
  const r = Object.fromEntries(vorlagenMessung(E, ['K']).map((z) => [z.nr, z.r])).K;
  leseRegler('');
  console.log(`  Ø ${r.boosts.toFixed(1)} Boosts, ${r.boxen}/8 Boxengasse, Notlauf ${r.notlauf} s`);
  // P3: mit doppelt so vielen Pads läuft öfter schon ein Pad-Boost (dann zieht die KI keinen Energie-Boost) – Ø 0,4 statt ≥ 1
  assert.ok(r.boosts > 0.2);
  assert.equal(r.notlauf, 0);
});

test('P3 Standard ohne Energie: kein manueller Boost, keine Boxengasse, kein Notlauf; Rolle kostenlos, 1× je Sprung, Turbo bei der Landung', () => {
  leseRegler('');
  const g = new Gleiter(ebene(), { s: 100, v0: GLEITER.vmax }); g.boostFrei = true; g.schild = 0;
  g.schritt(dt, { ...AUS, gas: 1, boost: 1 });
  assert.equal(ereignisse(g, 'energieBoost'), 0);
  for (let i = 0; i < 4 / dt; i++) g.schritt(dt, { ...AUS, gas: 1 });
  assert.ok(!g.notlauf && g.tempo > GLEITER.vmax * 0.95, 'kein Notlauf trotz leerem Balken');
  const a = springe(0, [0.4, 1.2]);
  assert.equal(a.art.filter((x) => x === 'rolle').length, 1, 'eine Rolle auch mit leerem Balken');
  assert.ok(a.art.includes('rolleNein'), 'zweite abgelehnt (1× je Sprung)');
  assert.ok(a.art.includes('rolleTurbo') && Math.abs(a.art.indexOf('rolleTurbo') - a.art.indexOf('landung')) === 1, 'Turbo bei der Landung');
  assert.equal(a.g.schild, 0, 'kostet nichts');
});
