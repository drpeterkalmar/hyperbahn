// Fahrgefühl nach dem Clean-Room-Datenblatt (Abschnitt 5, Messgrößen als Abnahme-Kriterien) – ohne Browser.
// Feld-Messung mit vielen Rennen (#9/#10) steht in tools/gefuehl_mess.mjs (hier nur eine Kurzfassung mit 2 Rennen).
// Aufruf: node --test tests/node/test_gefuehl.mjs   (~30 s)
import test from 'node:test';
import assert from 'node:assert/strict';
import { GEFUEHL, KLASSEN, KLASSEN_LISTE, Drift, startWertung, neustartErfuellt, leseGefuehl, bandBeschl, miniTurbo } from '../../src/physics/fahrgefuehl.js';
import { ITEMS_HB, ITEMS_REF, spaltenSummen, ziehe, itemZufall } from '../../src/game/items.js';
import { mess1, mess3, mess4, mess5, mess7, mess9, mess11, mess12, mess13 } from '../../tools/gefuehl_mess.mjs';
import { strecke1 } from '../../src/track/strecke1.js';
import { bauePlan, Pilot, PROFILE } from '../../src/ai/pilot.js';
import { VORLAGE } from '../../src/config.js';
import { Rennen, TEAMS } from '../../src/game/rennen.js';
import { ZEIT } from '../../src/config.js';

const dt = ZEIT.schritt;

test('#1/#2 Tempo-Bänder: Zeiten je Klasse im Zielband, leicht zieht früh, schwer überholt mittel oben', () => {
  const m = mess1();
  for (const k of KLASSEN_LISTE) {
    const c = m.klassen[k];
    console.log(`  ${k}: 0→50 % ${c.t50.toFixed(2)} s, 90 % ${c.t90.toFixed(2)} s, 100 % ${c.t100.toFixed(2)} s`);
    assert.ok(c.t50 >= 0.85 && c.t50 <= 1.3, `${k} T50 ${c.t50}`);
    assert.ok(c.t90 >= 2.4 && c.t90 <= 3.1, `${k} T90 ${c.t90}`);
    assert.ok(c.t100 >= 3.9 && c.t100 <= 4.7, `${k} T100 ${c.t100}`);
  }
  assert.ok(m.klassen.leicht.t50 < m.klassen.mittel.t50 && m.klassen.leicht.t50 < m.klassen.schwer.t50, 'leicht zieht früh');
  assert.ok(m.klassen.schwer.t90 < m.klassen.mittel.t90, 'schwer oben stark');
  assert.ok(m.kreuzSchwerMittel > 0.55 && m.kreuzSchwerMittel < 0.9, `Kreuzung ${m.kreuzSchwerMittel}`);
  assert.equal(bandBeschl(KLASSEN.mittel, 1.0), 0);
});

test('Drift-Automat: Stufe 1 nach 0,30 s, Pumpen hebt Stufe, zu lange = Stufe weg, Loslassen ab Stufe 2 = Mini-Turbo', () => {
  const d = new Drift();
  const e = (bremseL) => ({ boden: true, x: 0.9, lenk: 0.6, bremseL, bremseR: 0, magnet: false });
  const fahre = (sek, b) => { let o; for (let i = 0; i < sek / dt; i++) o = d.schritt(dt, e(b)); return o; };
  let o = d.schritt(dt, e(1)); assert.ok(o.aktiv && o.hupf, 'Einstieg mit Hüpfer');
  fahre(0.31, 1); fahre(0.05, 0); assert.equal(d.stufe, 1);
  fahre(0.16, 1); fahre(0.05, 0); assert.equal(d.stufe, 2);
  fahre(0.16, 1); fahre(0.05, 0); assert.equal(d.stufe, 3);
  // Loslassen → Ende mit Mini-Turbo Stufe 3
  let turbo = 0; for (let i = 0; i < 0.4 / dt; i++) { o = d.schritt(dt, e(0)); if (o.turbo) turbo = o.turbo; }
  assert.equal(turbo, 3); assert.equal(d.aktiv, false);
  // zu lange halten → Stufe verfällt
  const d2 = new Drift();
  for (let i = 0; i < 0.35 / dt; i++) d2.schritt(dt, e(1));
  for (let i = 0; i < 0.05 / dt; i++) d2.schritt(dt, e(0));
  assert.equal(d2.stufe, 1);
  let warn = false; for (let i = 0; i < 1.8 / dt; i++) { if (d2.schritt(dt, e(1)).zuLang) warn = true; }
  for (let i = 0; i < 0.05 / dt; i++) d2.schritt(dt, e(0));
  assert.ok(warn); assert.equal(d2.stufe, 0);
  // kein Hüpfer in Magnet-Zonen
  const d3 = new Drift();
  assert.equal(d3.schritt(dt, { ...e(1), magnet: true }).hupf, false);
  // Mini-Turbo-Verlauf: voll 0,6 s, Halbwertszeit 1,0 s
  assert.ok(Math.abs(miniTurbo(2, 0.3) - 0.18) < 1e-9 && Math.abs(miniTurbo(2, 1.6) - 0.09) < 1e-9);
});

test('#3/#4 Mini-Turbo-Gewinn je Kurve und Drift-Quote der Profi-KI', () => {
  const m = mess3();
  console.log(`  Gewinn Stufe 2: ${m.gewinn2.toFixed(2)} s, Stufe 3: ${m.gewinn3.toFixed(2)} s`);
  assert.ok(m.gewinn2 >= 0.2 && m.gewinn2 <= 0.5, `Stufe 2 ${m.gewinn2}`);
  assert.ok(m.gewinn3 >= 0.35 && m.gewinn3 <= 0.7 && m.gewinn3 > m.gewinn2, `Stufe 3 ${m.gewinn3}`);
  const q = mess4();
  console.log(`  Drift-Quote Profi: ${q.mitStufe2}/${q.kurven}`);
  assert.ok(q.quote >= 0.8);
});

test('#5 Abkürzen über das Störfeld lohnt sich nicht (≥ 0,3 s langsamer)', () => {
  const m = mess5();
  console.log(`  Innenkante ${m.verlust.toFixed(2)} s langsamer`);
  assert.ok(m.verlust >= 0.3);
});

test('Start-Boost-Fenster, Überdrehen, Neustart-Rhythmus', () => {
  const f = GEFUEHL.startfenster / 2;
  assert.equal(startWertung(-f + 0.01, 0), 'boost');
  assert.equal(startWertung(f - 0.01, 0), 'boost');
  assert.equal(startWertung(-f - 0.05, 0), null);
  assert.equal(startWertung(-0.05, GEFUEHL.ueberdrehen + 0.1), 'stotterer');
  assert.ok(neustartErfuellt([0, 0.1, 0.2, 0.3, 0.4]));
  assert.ok(!neustartErfuellt([0, 0.2, 0.4, 0.6, 0.8]), 'zu langsam');
  assert.ok(!neustartErfuellt([0, 0.1, 0.2, 0.3]), 'zu wenige');
  // im Rennen: Spieler tippt genau auf Grün, Gegner hält Dauergas → Start-Boost bzw. Stotterer
  const bahn = strecke1();
  // Tipp-Zeitpunkt → Start-Boost: bisher (?startgrad=0) auf Grün, ab P1b abgestuft am Idealpunkt 0,25 s vor Grün
  const tippe = (tipp, grad) => {
    const alt = VORLAGE.start.grad; VORLAGE.start.grad = grad;
    try {
      const r = new Rennen(bahn, [{ name: 'A' }, { name: 'B', spieler: true }], { runden: 1, gummiband: 0 });
      // A = Spieler (Eingabe), B wird hier nur über startSpieler gesteuert – beide sind Menschen ohne Pilot
      let n = 0;
      while (r.zeit < 0.5 && n++ < 2000) {
        const rel = r.phase === 'countdown' ? -r.countdown : r.zeit;
        r.schritt(dt, { gas: 1, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 }, { gas: rel > tipp ? 1 : 0 });
      }
      return r.alle[0];
    } finally { VORLAGE.start.grad = alt; }
  };
  assert.equal(tippe(-0.03, 0).g.statistik.startboost, 1, 'bisher: Tipp auf Grün = Start-Boost');
  const ideal = tippe(-0.25, 1), rand = tippe(-0.43, 1), daneben = tippe(-0.03, 1);
  assert.equal(ideal.g.statistik.startboost, 1); assert.ok(ideal.start.staerke > 0.97, `ideal ${ideal.start.staerke}`);
  assert.ok(rand.start.staerke > 0.3 && rand.start.staerke < 0.45, `Rand ${rand.start.staerke}`);
  assert.equal(daneben.g.statistik.startboost, 0, 'auf Grün ist zu spät (Idealpunkt davor)');
  const r2 = new Rennen(bahn, [{ name: 'A' }], { runden: 1, gummiband: 0 });
  let n = 0; while (r2.zeit < 0.5 && n++ < 2000) r2.schritt(dt, { gas: 1, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 });
  assert.ok(r2.alle[0].g.stotter > 0 || r2.alle[0].g.ereignisse.some((e) => e.art === 'stotterer'), 'Dauergas = Stotterer');
});

test('#7/#8 Treffer: Mensch 0,8–1,2 s, gerettet ≤ 0,2 s, Neustart spart Zeit, KI verliert 1,5–2× so viel', () => {
  const m = mess7();
  console.log(`  Mensch ${m.mensch.toFixed(2)} s, gerettet ${m.gerettet.toFixed(2)} s, Neustart ${m.mitNeustart.toFixed(2)} s, KI ${m.ki.toFixed(2)} s (${m.verhaeltnis.toFixed(2)}×)`);
  assert.ok(m.mensch >= 0.75 && m.mensch <= 1.25);
  assert.ok(m.gerettet <= 0.2);
  assert.ok(m.neustartAusgeloest >= 1 && m.mitNeustart < m.mensch - 0.15);
  assert.ok(m.verhaeltnis >= 1.5 && m.verhaeltnis <= 2.1);
});

// P1b: 3 statt 2 Rennen – bei 2 Rennen nimmt der „Median“ das schlechtere (Streuung durch Energie-Boost/Boxengasse der KI)
test('#9/#10 Gummiband (Kurzfassung, 3 Rennen à 2 Runden): Feld enger als ohne', () => {
  const m = mess9(3, 2);
  console.log(`  mit: P1-Abstand ${m.mit.medianAbstandP1.toFixed(1)} s, Spreizung ${m.mit.medianSpreizung.toFixed(1)} s; ohne: ${m.ohne.medianSpreizung.toFixed(1)} s`);
  assert.ok(m.mit.medianAbstandP1 <= 4.5);
  assert.ok(m.ohne.medianSpreizung > m.mit.medianSpreizung * 1.5);
});

test('Gummiband greift nie in Rennen ohne Menschen (KI-Gate unverändert) und nie über das Profil hinaus', () => {
  const bahn = strecke1(), plan = bauePlan(bahn);
  const r = new Rennen(bahn, TEAMS.slice(0, 3).map((t, k) => ({ ...t, pilot: new Pilot(bahn, plan, PROFILE.mittel, k + 1) })), { runden: 1, ohneCountdown: true, gummiband: 1 });
  for (let i = 0; i < 2 / dt; i++) r.schritt(dt, null);
  for (const t of r.alle) assert.equal(t.pilot.gummi, null);
});

test('#11 Item-Tabellen: Spalten = 100 %, Ziehung ±1 Prozentpunkt, deterministisch', () => {
  for (const tab of [ITEMS_HB, ITEMS_REF]) assert.deepEqual(spaltenSummen(tab), [100, 100, 100, 100, 100, 100, 100, 100]);
  const m = mess11();
  assert.ok(m.maxAbweichungPP <= 1.6, `${m.maxAbweichungPP}`);   // 10 000 Ziehungen: 1σ ≈ 0,5 PP
  const a = ziehe(5, itemZufall(42, 3, 7)), b = ziehe(5, itemZufall(42, 3, 7));
  assert.equal(a, b);
  assert.equal(ziehe(1, () => 0.999), 'lenkrakete'); assert.equal(ziehe(1, () => 0), 'boostZelle');
});

test('#12 Stoß-Verhältnis leicht/schwer: weich (p1c) ≈ 5×, höchstens 6 m/s; ?stoss=alt ≈ 7,6×', () => {
  const m = mess12();
  // weich: leicht bekommt min(6 m/s, 0,42·8·2) = 6 m/s, schwer 0,42·8·0,36 ≈ 1,2 m/s → ≈ 4,9×
  assert.ok(m.verhaeltnis > 4 && m.verhaeltnis < 6, `${m.verhaeltnis}`);
  assert.ok(m.leicht <= GEFUEHL.stossMax + 1e-6, `leicht ${m.leicht}`);
  const alt = GEFUEHL.stossModus;
  try {
    GEFUEHL.stossModus = 'alt';
    const a = mess12();
    assert.ok(Math.abs(a.verhaeltnis - (2.2 / 0.8) / (0.8 / 2.2)) < 0.3, `alt ${a.verhaeltnis}`);
    assert.ok(a.leicht > 2 * m.leicht, `alt leicht ${a.leicht} vs weich ${m.leicht}`);
  } finally { GEFUEHL.stossModus = alt; }
});

test('#13/#14 Kamera: +12° in ≤ 0,3 s, zurück ≤ 0,55 s, Grundwert 62°, Nachlauf 3–6 % der Folgedistanz', () => {
  const m = mess13();
  assert.ok(Math.abs(m.fovBasis - GEFUEHL.fov) < 0.5);
  assert.ok(m.kickHoch <= 0.32 && m.kickZurueck <= 0.55, `${m.kickHoch} / ${m.kickZurueck}`);
  const anteil = m.maxVersatz / 9.5;
  assert.ok(anteil >= 0.025 && anteil <= 0.07, `${anteil}`);
});

test('URL-Regler werden gelesen (?gummiband=0|1|2, ?items=, ?drift=)', () => {
  const alt = { ...GEFUEHL };
  try {
    leseGefuehl('?gummiband=2&items=ref&drift=1.5&fov=70');
    assert.equal(GEFUEHL.gummiband, 1); assert.equal(GEFUEHL.items, 'ref'); assert.equal(GEFUEHL.drift, 1.5); assert.equal(GEFUEHL.fov, 70);
    leseGefuehl('?gummiband=0'); assert.equal(GEFUEHL.gummiband, 0);
  } finally { Object.assign(GEFUEHL, alt); }
});
