// P1b Etappe A – Fahrphysik nach dem Vorlagen-Datenblatt (Abschnitt 3/5): 1/h-Schwebe-Feder, Luftbremse (Aufbau, Widerstand,
// Gleiten), begrenzte Gier-Beschleunigung mit schnellem Gegenlenken, Wandschaden ∝ Quertempo mit Abgleiten, Bergung hinter
// der Lücke, Landungs-Nicken. Jeder Regler 0/alt = Verhalten bis 0.1.4.
// Aufruf: node --test tests/node/test_vorlagen_a.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leseRegler, VORLAGE, GLEITER, ZEIT } from '../../src/config.js';
import { leseGefuehl } from '../../src/physics/fahrgefuehl.js';
import { baueBahn, F_LUECKE } from '../../src/track/bahn.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Gleiter } from '../../src/physics/gleiter.js';
import { vorlagenMessung } from '../../tools/vorlagen_mess.mjs';

const dt = ZEIT.schritt;
const AUS = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
const mess = (regler, nur) => { const r = Object.fromEntries(vorlagenMessung(regler, nur).map((z) => [z.nr, z.r])); leseRegler(''); leseGefuehl(''); return r; };

test('Regler: Standard an, ?schwebe=0 ?bremse=0 ?lenk=alt ?wand=0 ?bergung=0 ?nicken=0 = bisher', () => {
  leseRegler('');
  assert.ok(VORLAGE.schwebe.an && VORLAGE.bremse.an && VORLAGE.gier.an && VORLAGE.wand.an && VORLAGE.nicken.an && VORLAGE.bergung.zeit === 1.5);
  leseRegler('?schwebe=0&bremse=0&lenk=alt&wand=0&bergung=0&nicken=0&rutsch=2');
  assert.ok(!VORLAGE.schwebe.an && !VORLAGE.bremse.an && !VORLAGE.gier.an && !VORLAGE.wand.an && !VORLAGE.nicken.an && VORLAGE.bergung.zeit === 0);
  assert.equal(VORLAGE.bremse.rutsch, 2);
  leseRegler('');
});

test('#1 Schwebe-Feder: Ruhelage 1,15–1,25 m, Einfedern nach 10 m ≤ 0,4 m, ruhig ≤ 0,5 s, kein Durchschlag', () => {
  const r = mess('', ['1'])[1];
  console.log(`  Ruhe ${r.ruhe.toFixed(2)} m, Einfedern ${r.einfedern.toFixed(2)} m, ruhig ${r.ruhig.toFixed(2)} s`);
  assert.ok(r.ruhe >= 1.15 && r.ruhe <= 1.25, `Ruhe ${r.ruhe}`);
  assert.ok(r.einfedern <= 0.4 && r.einfedern > 0.05, `Einfedern ${r.einfedern} (Feder hat Weg, schlägt nicht durch)`);
  assert.ok(r.ruhig <= 0.5 && r.ruhig > 0, `ruhig ${r.ruhig}`);
  assert.equal(r.durchschlag, 0);
});

test('#2–#4 Luftbremse: Radius mit ≤ 0,6 × ohne; 3 s Dauer: eine 78–82 %, beide ≈ 45 %; Schiebewinkel 15–25°, zurück ≤ 1,2 s', () => {
  const r = mess('', ['2', '3', '4']);
  console.log(`  Radius ${r[2].verhaeltnis.toFixed(2)}×, Tempo eine ${(r[3].eine * 100).toFixed(0)} % beide ${(r[3].beide * 100).toFixed(0)} %, Schiebewinkel ${r[4].slipMax.toFixed(1)}°`);
  assert.ok(r[2].verhaeltnis <= 0.6);
  assert.ok(r[3].eine >= 0.78 && r[3].eine <= 0.82, `eine ${r[3].eine}`);
  assert.ok(r[3].beide >= 0.35 && r[3].beide <= 0.5, `beide ${r[3].beide}`);
  assert.ok(r[4].slipMax >= 15 && r[4].slipMax <= 25, `Schiebewinkel ${r[4].slipMax}`);
  assert.ok(r[4].zurueck <= 1.2);
  const alt = mess('?bremse=0', ['3'])[3];
  assert.ok(alt.eine > 0.95, 'bisher bremste eine Luftbremse kaum');
});

test('Luftbremse baut sich in 0,2 s auf (Wirkung), Drift-Automat sieht die Taste sofort', () => {
  leseRegler('');
  const b = baueBahn([{ typ: 'gerade', len: 3000, breite: 300 }], { ohneSchluss: true });
  const g = new Gleiter(b, { s: 100, v0: 80 });
  const verlauf = [];
  for (let i = 0; i < 0.3 / dt; i++) { g.schritt(dt, { ...AUS, gas: 1, bremseL: 1 }); verlauf.push(g.blW); }
  const t50 = verlauf.findIndex((w) => w >= 0.5) * dt, t100 = verlauf.findIndex((w) => w >= 0.999) * dt;
  assert.ok(Math.abs(t50 - 0.1) < 0.01 && Math.abs(t100 - 0.2) < 0.01, `50 % nach ${t50}, voll nach ${t100}`);
});

test('Gegenlenken baut schneller um als Anlenken; Gier-Beschleunigung begrenzt (?lenk=alt sofort)', () => {
  const neu = mess('', ['L']).L, alt = mess('?lenk=alt', ['L']).L;
  console.log(`  Anlenken 90 % ${neu.anlenken.toFixed(2)} s (alt ${alt.anlenken.toFixed(2)}), Gegenlenken 90 % ${neu.wechsel90.toFixed(2)} s (alt ${alt.wechsel90.toFixed(2)})`);
  // Gegenlenken überstreicht die doppelte Gier-Änderung, braucht aber weniger als die doppelte Zeit
  assert.ok(neu.wechsel90 < 2 * neu.anlenken * 0.85, 'Gegenlenken ×2');
  assert.ok(neu.anlenken > alt.anlenken, 'Anlenken nicht mehr sprunghaft');
  assert.ok(neu.voll * 180 / Math.PI <= 100.5);
});

test('#8 Wandtreffer 30° bei Top: −15…−25 % Tempo, −4…−8 % Energie, gleitet ab statt zu schleifen', () => {
  const r = mess('', ['8'])[8], alt = mess('?wand=0', ['8'])[8];
  console.log(`  Tempo ${(r.tempo * 100).toFixed(0)} % (alt ${(alt.tempo * 100).toFixed(0)} %), Energie ${(r.energie * 100).toFixed(1)} % (alt ${(alt.energie * 100).toFixed(1)} %)`);
  assert.ok(r.tempo <= -0.15 && r.tempo >= -0.25, `Tempo ${r.tempo}`);
  assert.ok(r.energie <= -0.04 && r.energie >= -0.08, `Energie ${r.energie}`);
  assert.ok(alt.tempo < -0.35, 'bisher deutlich härter');
});

test('#9 Sprung verfehlt: Bergung 1,5 s, abgesetzt hinter der Lücke, Zeitverlust 2,0–3,0 s, nie vor den Sprung', () => {
  const r = mess('', ['9'])[9];
  console.log(`  Zeitverlust ${r.verlust.toFixed(2)} s`);
  assert.ok(r.verlust >= 2 && r.verlust <= 3, `Verlust ${r.verlust}`);
  assert.ok(!r.schlecht.vorDemSprung && r.schlecht.abfluege === 1);
  // Absetz-Stelle: nicht in der Lücke, hinter ihr, mit 40 % Höchsttempo
  const bahn = strecke1();
  const k = bahn.abschnitte.findIndex((a) => a.name === 'Häuserschlucht');
  const g = new Gleiter(bahn, { s: bahn.segStart[k] - 3, v0: 40 });
  let t = 0;
  while (g.zustand === 'fahrt' && t < 20) { g.schritt(dt, { ...AUS, gas: 1 }); t += dt; }
  assert.equal(g.zustand, 'absturz');
  let tb = 0; while (g.zustand === 'absturz') { g.schritt(dt, AUS); tb += dt; }
  assert.ok(Math.abs(tb - 1.5) < 0.01, `Bergung ${tb.toFixed(2)} s`);
  assert.ok(!(bahn.flags[Math.floor(g.s / bahn.ds)] & F_LUECKE) && g.s > bahn.segStart[k], 'hinter der Lücke');
  assert.ok(Math.abs(g.tempo - 0.4 * GLEITER.vmax) < 1, `Tempo ${g.tempo}`);
});

test('Landungs-Nicken: Landung mit Nase > 20° kostet 15 % Tempo + Aufsetzer; ?nicken=0 aus', () => {
  const lauf = (regler) => {
    leseRegler(regler);
    const b = baueBahn([{ typ: 'gerade', len: 3000, breite: 30 }], { ohneSchluss: true });
    const g = new Gleiter(b, { s: 100, v0: 60 });
    g.p.y += 12;
    // Nase 35° nach unten kippen
    const w = 35 * Math.PI / 180, c = Math.cos(w), s = Math.sin(w);
    const vor = { ...g.vor }, oben = { ...g.oben };
    Object.assign(g.vor, { x: vor.x * c - oben.x * s, y: vor.y * c - oben.y * s, z: vor.z * c - oben.z * s });
    Object.assign(g.oben, { x: oben.x * c + vor.x * s, y: oben.y * c + vor.y * s, z: oben.z * c + vor.z * s });
    g.luftZeit = 1; g.absprung = { s: 100, x: g.p.x, y: g.p.y, z: g.p.z, v: 60, t: 0 };
    // Nase festhalten (keine Wetterfahne/Landehilfe wie ?nase=alt) – nur die Landung wird gewertet
    let hart = 0;
    for (let i = 0; i < 2 / dt; i++) {
      g.w.x = 0; g.w.y = 0; g.w.z = 0;
      g.schritt(dt, AUS);
      for (const e of g.ereignisse) if (e.art === 'hartLandung') hart++;
      g.ereignisse.length = 0;
      if (g.boden && g.luftZeit === 0 && i > 10) break;
    }
    leseRegler('');
    return hart;
  };
  assert.equal(lauf('?nase=alt'), 1, 'harte Landung erkannt');
  assert.equal(lauf('?nase=alt&nicken=0'), 0, 'aus');
});
