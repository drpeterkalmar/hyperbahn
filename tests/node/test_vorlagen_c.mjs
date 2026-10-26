// P1b Etappe C – Flugzeit-Boost (Stufen 0,8 / 1,6 / 3,0 s bei sauberer Landung) und Boost-Reserve mit Ketten-Deckel für
// Pad-Ketten (Datenblatt Abschnitt 3, Messgrößen 6 und 7). ?flugboost=0 / ?reserve=0 = bisher.
// Aufruf: node --test tests/node/test_vorlagen_c.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leseRegler, VORLAGE, GLEITER, ZEIT, BOOST } from '../../src/config.js';
import { baueBahn } from '../../src/track/bahn.js';
import { Gleiter } from '../../src/physics/gleiter.js';
import { vorlagenMessung } from '../../tools/vorlagen_mess.mjs';

const dt = ZEIT.schritt;
const mess = (regler, nur) => { const r = Object.fromEntries(vorlagenMessung(regler, nur).map((z) => [z.nr, z.r])); leseRegler(''); return r; };

test('Regler: ?flugboost=0, ?reserve=0 (bisher), ?reserve=3', () => {
  leseRegler('?flugboost=0&reserve=0');
  assert.ok(!VORLAGE.flug.an && !VORLAGE.reserve.an);
  leseRegler('?reserve=3');
  assert.ok(VORLAGE.flug.an && VORLAGE.reserve.an && VORLAGE.reserve.max === 3);
  leseRegler('');
});

test('#6 Flugzeit-Boost: jeder Riesensprung mit sauberer Landung = Stufe 3, Zeitgewinn 0,4–0,7 s', () => {
  const r = mess('', ['6'])[6];
  for (const x of r) {
    console.log(`  ${x.name}: Stufe ${x.stufe}, ${x.luft.toFixed(1)} s, Gewinn ${x.gewinn.toFixed(2)} s`);
    assert.equal(x.stufe, 3, x.name); assert.ok(x.sauber);
    assert.ok(x.gewinn >= 0.4 && x.gewinn <= 0.7, `${x.name}: ${x.gewinn}`);
  }
});

test('Flugzeit-Boost: Stufe nach Flugzeit, nur bei sauberer Landung (Nase ≤ 12°)', () => {
  leseRegler('');
  const b = baueBahn([{ typ: 'gerade', len: 3000, breite: 30 }], { ohneSchluss: true });
  const lande = (luft, nickGrad) => {
    const g = new Gleiter(b, { s: 200, v0: 60 });
    g.luftZeit = luft; g.absprung = { s: 100, x: g.p.x, y: g.p.y, z: g.p.z, v: 60, t: 0 };
    const w = nickGrad * Math.PI / 180, c = Math.cos(w), s = Math.sin(w), vor = { ...g.vor }, oben = { ...g.oben };
    Object.assign(g.vor, { x: vor.x * c + oben.x * s, y: vor.y * c + oben.y * s, z: vor.z * c + oben.z * s });
    g.gelandet(g.q);
    return { e: g.ereignisse.find((x) => x.art === 'flugBoost'), boost: g.boost, zeit: g.boostZeit };
  };
  assert.equal(lande(0.6, 0).e, undefined, 'unter 0,8 s nichts');
  const s1 = lande(1.0, 0), s2 = lande(2.0, 5), s3 = lande(4.0, -10), schief = lande(4.0, 25);
  assert.equal(s1.e.stufe, 1); assert.ok(Math.abs(s1.boost - 0.15) < 1e-9 && Math.abs(s1.zeit - 1.0) < 1e-9);
  assert.equal(s2.e.stufe, 2); assert.ok(Math.abs(s2.boost - 0.20) < 1e-9);
  assert.equal(s3.e.stufe, 3); assert.ok(Math.abs(s3.boost - 0.25) < 1e-9);
  assert.equal(schief.e.stufe, 0); assert.ok(!schief.e.sauber); assert.equal(schief.boost, 0);
});

// P3: je Pad +15 % (statt +10 %), Deckel +65 % (statt +80 %: bei 105 m/s Grundtempo ≈ 173 m/s wie bisher 95 × 1,8)
test('#7 Pad-Kette: +50/65 % (ab dem 2. Pad Deckel +65 %), nie darüber, Reserve ≤ 4 s; ?reserve=0 bisher sofort Deckel', () => {
  const r = mess('', ['7'])[7], alt = mess('?reserve=0', ['7'])[7];
  console.log(`  Stufen ${r.stufen.map((x) => Math.round(x * 100)).join('/')} %, Reserve max ${r.resMax.toFixed(2)} s; bisher ${alt.stufen.map((x) => Math.round(x * 100)).join('/')} %`);
  assert.deepEqual(r.stufen.slice(0, 4).map((x) => Math.round(x * 100)), [50, 65, 65, 65]);
  assert.ok(Math.max(...r.stufen) <= BOOST.deckel + 1e-9);
  assert.ok(r.resMax <= 4 + 1e-9 && r.resMax > 3.9);
  assert.equal(Math.round(alt.stufen[1] * 100), 65);
});

test('Reserve: Antrieb ×2 nur ohne gezogene Luftbremse; mit Bremse kein Zwangs-Vollgas', () => {
  leseRegler('');
  const b = baueBahn([{ typ: 'gerade', len: 4000, breite: 60 }], { ohneSchluss: true });
  const lauf = (bremse) => {
    const g = new Gleiter(b, { s: 100, v0: 60 });
    g.padBoost(BOOST.gewinn, true);
    const v0 = g.tempo;
    for (let i = 0; i < 0.5 / dt; i++) g.schritt(dt, { gas: bremse ? 0 : 1, lenk: 0, bremseL: bremse, bremseR: bremse, nase: 0, rolle: 0 });
    return g.tempo - v0;
  };
  assert.ok(lauf(0) > 8, 'beschleunigt kräftig');
  assert.ok(lauf(1) < 0, 'Gas weg + Luftbremsen bremsen trotz Reserve (vorher erzwang der Boost Vollgas)');
  void GLEITER;
});
