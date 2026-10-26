// P1b Etappe D – Start-Varianten (abgestuft für Touch/Tastatur, Drehzahl-Band für den analogen Gas-Abzug), KI-Revanche,
// Seitwärts-Schub (Gamepad/Tastatur), G-Vignette (Datenblatt Abschnitt 3, Messgrößen 10, 11, 13).
// Aufruf: node --test tests/node/test_vorlagen_d.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leseRegler, VORLAGE, SPIEL, ZEIT } from '../../src/config.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Rennen, startStaerke } from '../../src/game/rennen.js';
import { Eingabe } from '../../src/game/eingabe.js';
import { gVignetteDeckkraft } from '../../src/game/gvignette.js';
import { vorlagenMessung, m10 } from '../../tools/vorlagen_mess.mjs';

const dt = ZEIT.schritt;
const AUS = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
const mess = (regler, nur) => { const r = Object.fromEntries(vorlagenMessung(regler, nur).map((z) => [z.nr, z.r])); leseRegler(''); return r; };

test('Regler ?startgrad=0 ?startband=0 ?revanche=0 ?strafe=0 ?gvignette=0', () => {
  leseRegler('?startgrad=0&startband=0&revanche=0&strafe=0&gvignette=0');
  const V = VORLAGE;
  assert.ok(!V.start.grad && !V.start.band && !V.revanche.an && !V.strafe.an && !V.gvignette.an);
  assert.equal(gVignetteDeckkraft(9), 0);
  leseRegler('');
  assert.ok(V.start.grad && V.start.band && V.revanche.an && V.strafe.an && V.gvignette.an);
});

test('Abgestufter Start-Boost: 100 % am Idealpunkt (0,25 s vor Grün), 30 % am Fensterrand, außerhalb nichts', () => {
  leseRegler('');
  assert.equal(startStaerke(-0.25), 1);
  assert.ok(Math.abs(startStaerke(-0.45) - 0.3) < 1e-9 && Math.abs(startStaerke(-0.05) - 0.3) < 1e-9);
  assert.ok(Math.abs(startStaerke(-0.15) - 0.65) < 1e-9);
  assert.equal(startStaerke(0.1), 0); assert.equal(startStaerke(-0.8), 0); assert.equal(startStaerke(null), 0);
  const r = Object.fromEntries(vorlagenMessung('', ['11']).map((z) => [z.nr, z.r]))[11];
  console.log(`  KI Ø-Stärke: leicht ${(r.leicht.staerke * 100).toFixed(0)} %, mittel ${(r.mittel.staerke * 100).toFixed(0)} %, profi ${(r.profi.staerke * 100).toFixed(0)} %`);
  assert.ok(r.leicht.staerke < r.mittel.staerke && r.mittel.staerke < r.profi.staerke);
});

test('Drehzahl-Band (analoger Gas-Abzug): bei Grün 85–90 % = voller Start-Boost, darüber Stotterer, darunter nichts', () => {
  leseRegler('');
  const bahn = strecke1();
  const start = (drehzahl) => {
    const r = new Rennen(bahn, [{ name: 'DU' }], { runden: 1, gummiband: 0 });
    let n = 0;
    while (r.zeit < 0.5 && n++ < 2000) r.schritt(dt, { ...AUS, gas: drehzahl }, { gas: drehzahl > 0.5 ? 1 : 0, drehzahl });
    const g = r.alle[0].g;
    return { boost: g.statistik.startboost, stotter: g.ereignisse.some((e) => e.art === 'stotterer') || g.stotter > 0 };
  };
  assert.deepEqual(start(0.87), { boost: 1, stotter: false });
  assert.equal(start(0.97).stotter, true);
  assert.deepEqual(start(0.6), { boost: 0, stotter: false });
});

test('#10 KI-Revanche: Zurück-Überholquote der KI „Mittel“ höher als ohne (Messung 20 Rennen: 25–40 %); nie online', () => {
  const r = m10(6);
  leseRegler('');
  console.log(`  6 Rennen: mit ${(r.mit.quote * 100).toFixed(0)} % (${r.mit.revs} Revanchen), ohne ${(r.ohne.quote * 100).toFixed(0)} %`);
  assert.ok(r.mit.revs > 0 && r.mit.quote > r.ohne.quote);
  // online: keine Revanche
  SPIEL.online = true;
  try {
    const bahn = strecke1();
    const r2 = new Rennen(bahn, [{ name: 'DU', spieler: true }, { name: 'K', pilot: { profil: { name: 'Mittel' }, steuer: () => AUS, startGas: () => 0 } }], { runden: 1, ohneCountdown: true });
    r2.alle[1].warVor = true; r2.alle[1].fortschritt = 0; r2.alle[0].fortschritt = 5;
    r2.revancheSchritt();
    assert.equal(r2.alle[1].g.revanche, 0);
  } finally { SPIEL.online = false; }
});

test('Seitwärts-Schub: Versatz ohne Drehung, kostet kein Tempo; Tasten Y/X (Codes KeyZ/KeyX); ?strafe=0 aus', () => {
  const r = mess('', ['S']).S, aus = mess('?strafe=0', ['S']).S;
  console.log(`  1 s: Versatz ${r.versatz.toFixed(1)} m, Tempo ${r.tempo.toFixed(2)} m/s, Drehung ${r.dreh.toFixed(1)}°`);
  assert.ok(r.versatz > 1.5 && Math.abs(r.tempo) < 0.5 && r.dreh < 1);
  assert.ok(Math.abs(aus.versatz) < 0.05);
  const e = new Eingabe(null);
  e.tasten.add('KeyZ'); assert.equal(e.lesen(dt).strafe, 1);
  e.tasten.clear(); e.tasten.add('KeyX'); assert.equal(e.lesen(dt).strafe, -1);
});

test('#13 G-Vignette: erscheint in jedem Looping, nie über 35 %, aus mit „Blitze reduzieren“', () => {
  const r = mess('', ['13'])[13];
  console.log(`  Looping-Durchfahrten ${r.durch.map((x) => Math.round(x * 100)).join('/')} %, max ${Math.round(r.max * 100)} %`);
  assert.ok(r.durch.length >= 2 && r.durch.every((x) => x > 0.1));
  assert.ok(r.max <= 0.35 + 1e-9);
  assert.equal(r.maxRed, 0);
  assert.equal(gVignetteDeckkraft(1.2), 0, 'geradeaus nichts');
});
