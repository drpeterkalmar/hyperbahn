// P1b Etappe 0b (Peter 20.10.: „kürzere Rennen, max 5 min“): Rundenzahl je Strecken-Fassung aus der Median-Rundenzeit,
// Kurzfassung der Megastadt (geschlossen, alle Passagen, Sprünge unverändert), Rennen KI „Mittel“ ≤ 5:00 inkl. Countdown,
// Bestzeiten je Fassung + Rundenzahl getrennt.
// Aufruf: node --test tests/node/test_runden.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leseRegler, SPIEL } from '../../src/config.js';
import { strecke1, FASSUNGEN, rundenFuer, rundenDerFassung, RENNDAUER, strecke1Abschnitte, SCHLUSS } from '../../src/track/strecke1.js';
import { rundenzeit } from '../../tools/rundenzeit_mess.mjs';
import { bestzeitSchluessel, leseBestzeit, trageBestzeitEin } from '../../src/game/bestzeiten.js';

test('rundenFuer: so viele Runden, dass Countdown + Start + n Runden ≤ 5:00, mindestens 1', () => {
  assert.equal(rundenFuer(134.5), 2);
  assert.equal(rundenFuer(165), 1, 'lange Runde: 2 Runden wären 5:30');
  assert.equal(rundenFuer(90), 3);
  assert.equal(rundenFuer(400), 1);
  assert.equal(rundenFuer(0), 2, 'ohne Messung: 2');
  for (const t of [60, 95, 134.5, 146, 200]) assert.ok(RENNDAUER.countdown + RENNDAUER.start + rundenFuer(t) * t <= RENNDAUER.ziel || rundenFuer(t) === 1);
  assert.equal(rundenDerFassung('kurz'), 2);
  assert.equal(rundenDerFassung('lang'), 1);
});

test('Regler: Standard Kurzfassung, ?strecke=lang, ?runden= überschreibt', () => {
  leseRegler('');
  assert.equal(SPIEL.strecke, 'kurz'); assert.equal(SPIEL.runden, 0);
  leseRegler('?strecke=lang&runden=3');
  assert.equal(SPIEL.strecke, 'lang'); assert.equal(SPIEL.runden, 3);
  assert.equal(strecke1().fassung, 'lang');
  leseRegler('');
  assert.equal(strecke1().fassung, 'kurz');
});

test('Kurzfassung: geschlossen, kürzer, gleiche Passagen; Sprung-Abschnitte unverändert', () => {
  const k = strecke1('kurz'), l = strecke1('lang');
  assert.ok(k.schluss.m < 1 && k.schluss.grad < 0.1, `Schließfehler ${k.schluss.m.toFixed(2)} m`);
  assert.ok(l.schluss.m < 1, 'lange Fassung weiter geschlossen');
  assert.ok(k.L < l.L * 0.86, `Länge ${k.L.toFixed(0)} vs ${l.L.toFixed(0)} m`);
  assert.deepEqual(k.abschnitte.map((a) => a.name), l.abschnitte.map((a) => a.name), 'alle Passagen in derselben Reihenfolge');
  for (const name of ['Großer Looping', 'Korkenzieher-Röhre', 'Häuserschlucht Anlauf', 'Absprung 1', 'Häuserschlucht', 'Häuserschlucht Mitte',
    'Landezone 1', 'Hafen Anlauf', 'Absprung 2', 'Neon-Schlucht', 'Neon-Schlucht Mitte', 'Landezone 2']) {
    const a = k.abschnitte.find((x) => x.name === name), b = l.abschnitte.find((x) => x.name === name);
    assert.deepEqual(a, b, `${name} unverändert`);
  }
  // lange Fassung = Original bis 0.1.3
  assert.deepEqual(strecke1Abschnitte(SCHLUSS, 'lang').map((a) => a.len), strecke1Abschnitte(SCHLUSS).map((a) => a.len));
});

test('Rennen über die Standard-Rundenzahl: KI „Mittel“ ≤ 5:00 inkl. Countdown, Spitze darunter; Rundenzeit-Tabelle passt', () => {
  const runden = rundenDerFassung('kurz');
  const m = rundenzeit('kurz', runden);
  leseRegler('');
  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, '0')}`;
  console.log(`  Kurzfassung ${runden} Runden: Profi ${fmt(m.ziel.profi)} · Mittel ${fmt(m.ziel.mittel)} · Leicht ${fmt(m.ziel.leicht)} · Spitze ${fmt(m.spitze)}, Median-Runde Mittel ${m.median.toFixed(1)} s`);
  assert.ok(m.ziel.mittel <= 300, `Mittel ${m.ziel.mittel.toFixed(0)} s`);
  assert.ok(m.spitze <= 285 && m.spitze < m.ziel.mittel, `Spitze ${m.spitze.toFixed(0)} s`);
  assert.ok(Math.abs(m.median - FASSUNGEN.kurz.rundenzeit) <= 6, `Tabelle ${FASSUNGEN.kurz.rundenzeit} s vs gemessen ${m.median.toFixed(1)} s`);
});

test('Bestzeiten je Fassung + Rundenzahl + Länge getrennt, nur bessere Zeiten ersetzen', () => {
  const daten = {};
  const sp = { getItem: (k) => daten[k] ?? null, setItem: (k, v) => { daten[k] = v; } };
  const k = strecke1('kurz'), l = strecke1('lang');
  const sk = bestzeitSchluessel(k, 2), sl = bestzeitSchluessel(l, 1);
  assert.notEqual(sk, sl); assert.notEqual(sk, bestzeitSchluessel(k, 3));
  let r = trageBestzeitEin(sp, sk, 280, 136);
  assert.ok(r.neuRennen && r.neuRunde && !r.alt);
  r = trageBestzeitEin(sp, sk, 290, 134);
  assert.ok(!r.neuRennen && r.neuRunde);
  assert.deepEqual(leseBestzeit(sp, sk), { rennen: 280, runde: 134 });
  assert.equal(leseBestzeit(sp, sl), null, 'lange Fassung nicht vermischt');
  assert.equal(leseBestzeit({ getItem: () => '{kaputt' }, sk), null, 'kaputter Speicher stört nicht');
});
