// P1b Etappe 0a (Peter 20.10.: „kein Abschmieren in der Luft, wenn ich Pfeil hinauf halte“):
//  • Eingabe: über den Absprung gehaltenes ↑ senkt die Nase nie; erst ein neuer Druck in der Luft nickt; ↓ hebt; Stick vorn
//    genauso; ?nase=alt = bisher
//  • Physik: Hülle (Nase nie tief unter die Flugbahn, nie in die Schlucht drücken, Decke), Landehilfe (aufrecht landen)
//  • Messung über beide Riesensprünge mit/ohne Pad-Kette (tools/luft_mess.mjs): ↑ dauerhaft 0 Abstürze, 0 Bauchlandungen,
//    Weite/Airtime wie neutral; Kürzer/Weiter-Spanne ≥ 80 % von vorher; ganze Runden mit ↑ ohne Abflug
// Aufruf: node --test tests/node/test_luft.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { leseRegler, NASE, ZEIT } from '../../src/config.js';
import { Eingabe } from '../../src/game/eingabe.js';
import { luftMessung, rundenMessung } from '../../tools/luft_mess.mjs';

const dt = ZEIT.schritt;
function lies(ein, tasten, luft) {
  ein.tasten.clear();
  for (const t of tasten) ein.tasten.add(t);
  return ein.lesen(dt, luft).nase;
}

test('Eingabe: ↑ über den Absprung gehalten = reines Gas, Nase bleibt; neuer Druck in der Luft senkt; ↓ hebt', () => {
  leseRegler('');
  const e = new Eingabe(null);
  assert.equal(lies(e, ['ArrowUp'], false), 0, 'am Boden nie Nase');
  assert.equal(e.roh.gas, 1, '↑ = Gas');
  for (let i = 0; i < 200; i++) assert.equal(lies(e, ['ArrowUp'], true), 0, 'gehaltenes ↑ in der Luft nickt nicht');
  assert.equal(e.roh.gas, 1, 'bleibt Gas');
  assert.equal(lies(e, [], true), 0, 'losgelassen');
  assert.equal(lies(e, ['ArrowUp'], true), -1, 'neu gedrückt in der Luft = Nase senken');
  assert.equal(lies(e, ['ArrowDown'], true), 1, '↓ = Nase heben');
  // W genauso wie ↑, Landung setzt die Sperre neu
  assert.equal(lies(e, ['KeyW'], false), 0);
  assert.equal(lies(e, ['KeyW'], true), 0, 'W über den Absprung gehalten');
  // ↓ über den Absprung gehalten hebt weiter die Nase (keine Sturz-Gefahr)
  assert.equal(lies(e, ['ArrowDown'], false), 0);
  assert.equal(lies(e, ['ArrowDown'], true), 1);
});

test('Eingabe: ?nase=alt = bisheriges Verhalten (↑ senkt in der Luft immer)', () => {
  leseRegler('?nase=alt');
  try {
    const e = new Eingabe(null);
    lies(e, ['ArrowUp'], false);
    assert.equal(lies(e, ['ArrowUp'], true), -1);
  } finally { leseRegler(''); }
});

test('Eingabe: Gamepad-Stick vorn über den Absprung gehalten nickt erst nach Rückkehr zur Mitte', () => {
  leseRegler('');
  const nav = globalThis.navigator, pad = { connected: true, axes: [0, -0.8], buttons: [] };
  const alt = nav.getGamepads;
  nav.getGamepads = () => [pad];
  try {
    const e = new Eingabe(null);
    lies(e, [], false);
    assert.equal(lies(e, [], true), 0, 'Stick vorn seit dem Boden: keine Nase');
    pad.axes[1] = 0; lies(e, [], true);
    pad.axes[1] = -0.8;
    assert.ok(lies(e, [], true) < -0.5, 'neu nach vorn = Nase senken');
    pad.axes[1] = 0.7;
    assert.ok(lies(e, [], true) > 0.5, 'zurück = Nase heben');
  } finally { nav.getGamepads = alt; }
});

test('Riesensprünge: ↑ dauerhaft 0 Abstürze/Bauchlandungen, Weite wie neutral; Kürzer/Weiter-Spanne ≥ 80 % von vorher', () => {
  const alt = luftMessung('?nase=alt'), neu = luftMessung('');
  leseRegler('');
  let spanneAlt = 0, spanneNeu = 0;
  for (let i = 0; i < neu.length; i++) {
    const a = alt[i], n = neu[i];
    console.log(`  ${n.sprung}: ↑ dauerhaft vorher ${a.hoch.absturz ? 'Absturz' : 'ok'}, jetzt ${n.hoch.luft.toFixed(2)} s / ${n.hoch.weite.toFixed(0)} m (neutral ${n.neutral.luft.toFixed(2)} s / ${n.neutral.weite.toFixed(0)} m), Spanne ${a.kurz && a.weit ? (a.weit.weite - a.kurz.weite).toFixed(0) : 0} → ${(n.weit.weite - n.kurz.weite).toFixed(0)} m`);
    assert.ok(!n.hoch.absturz && !n.hoch.bauch, `${n.sprung}: ↑ dauerhaft`);
    assert.ok(Math.abs(n.hoch.weite - n.neutral.weite) <= 0.05 * n.neutral.weite && Math.abs(n.hoch.luft - n.neutral.luft) <= 0.3, `${n.sprung}: wie neutral`);
    assert.ok(!n.neutral.absturz && !n.neutral.bauch, `${n.sprung}: neutral`);
    // Nase gehalten bis zum Anschlag: Hülle verhindert Absturz/Bauchlandung (über die Lücke hinaus segeln, in die Schlucht drücken)
    assert.ok(!n.weitLang.absturz && !n.weitLang.bauch, `${n.sprung}: ↓ 5 s`);
    assert.ok(!n.kurzLang.absturz && !n.kurzLang.bauch, `${n.sprung}: ↑ neu 5 s`);
    if (a.kurz && a.weit) spanneAlt += a.weit.weite - a.kurz.weite;
    spanneNeu += n.weit.weite - n.kurz.weite;
    assert.ok(n.kurzLang.nickMin > -NASE.unten - 3, `${n.sprung}: Nase höchstens ${NASE.unten}° unter der Flugbahn (${n.kurzLang.nickMin.toFixed(1)}°)`);
  }
  assert.ok(alt.some((a) => a.hoch.absturz), 'vorher stürzte ↑ dauerhaft ab (Messung greift)');
  assert.ok(spanneNeu >= 0.8 * spanneAlt, `Spanne ${spanneNeu.toFixed(0)} m ≥ 80 % von ${spanneAlt.toFixed(0)} m`);
});

test('Ganze Runden mit ↑ dauerhaft (KI lenkt): kein Abflug, keine schiefe Landung', () => {
  const r = rundenMessung('', 2, 'mittel');
  leseRegler('');
  console.log(`  2 Runden: ${r.luft} Luft-Phasen, längste ${r.maxLuft.toFixed(1)} s, Abflüge ${r.abfluege}, schief ${r.schief}`);
  assert.equal(r.abfluege, 0);
  assert.equal(r.schief, 0);
  assert.ok(r.luft >= 4, 'Riesensprünge geflogen');
});
