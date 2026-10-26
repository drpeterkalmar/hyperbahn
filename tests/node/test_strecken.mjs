// P2-Strecken (alle außer der Megastadt, die test_bahn/test_gleiter/test_ki_gate prüfen): Geometrie, Pflicht-Passagen,
// Sprünge (Mindesttempo = Tabelle, „Spieler hält ↑“ ohne Absturz), KI-Gate 8 × 10 Runden, Rundenzeit = Register (±6 s,
// 1:15–1:40), Rennen ≤ 5:00, Wandtreffer-Rate nicht schlechter als die Megastadt.
// Aufruf: node --test tests/node/test_strecken.mjs   (~5 s je Strecke)
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE, baueStrecke } from '../../src/track/alle.js';
import { finde, rundenDer, zufallsStrecke, sichtbar } from '../../src/track/strecken.js';
import { RENNDAUER } from '../../src/track/runden.js';
import { GLEITER } from '../../src/config.js';
import { geometrie, mindesttempo, kiGate } from '../../tools/strecke_pruefen.mjs';
import { luftMessung } from '../../tools/luft_mess.mjs';

const P2 = Object.keys(MODULE).filter((id) => !id.startsWith('megastadt'));
// Megastadt (Kurzfassung) als Bezug der Wandtreffer-Rate: gemessen 0,36 je Gleiter-Minute (tools/strecke_pruefen.mjs)
const WAND_MEGASTADT = 0.36;

test('Register: jede Strecke hat Daten, „Zufällig“ wählt nie zweimal dieselbe', () => {
  for (const id of P2) assert.ok(finde(id), `${id} im Register`);
  for (const letzte of sichtbar().map((e) => e.id)) for (const z of [0, 0.3, 0.6, 0.99]) assert.notEqual(zufallsStrecke(letzte, z), letzte);
  assert.equal(finde('kurz').id, 'megastadt'); assert.equal(finde('lang').id, 'megastadt-lang');
});

for (const id of P2) {
  const bahn = baueStrecke(id);
  test(`${id}: Geometrie – geschlossen, stetig, ohne Selbstdurchdringung, Magnet an allen steilen Stellen`, () => {
    const g = geometrie(bahn);
    assert.ok(g.schluss.m < 1 && g.schluss.grad < 0.1, `Schließfehler ${g.schluss.m.toFixed(2)} m / ${g.schluss.grad.toFixed(3)}°`);
    assert.ok(g.L > 6000 && g.L < 12000, `Länge ${g.L.toFixed(0)}`);
    assert.ok(g.maxK < 1 / 40, `kleinster Radius ${(1 / g.maxK).toFixed(0)} m`);
    assert.ok(g.maxDK < 0.002, `Krümmungssprung ${g.maxDK.toFixed(5)}`);
    assert.ok(g.maxDB < 3, `Querneigung ${g.maxDB.toFixed(2)}° je 2 m`);
    assert.equal(g.ohneMagnet.length, 0, `steil/überkopf ohne Magnet bei s=${g.ohneMagnet.slice(0, 5).join(', ')}`);
    assert.ok(g.abstand > 0, `zu nah: ${JSON.stringify(g.wo)}`);
  });
  test(`${id}: Pflicht – Pad-Ketten, Boost-Ringe, Riesensprung mit Kette, Ringen und breiter Landezone`, () => {
    const g = geometrie(bahn);
    assert.ok(g.ketten.filter((n) => n >= 3).length >= 2, `Pad-Ketten ${JSON.stringify(g.ketten)}`);
    assert.ok(g.spruenge.length >= 1, 'Riesensprung');
    const gross = g.spruenge.filter((s) => s.luecke >= 350 && s.absprung && s.pads >= 3 && s.ringe >= 2 && s.landezone && s.landeBreite >= 18);
    assert.ok(gross.length >= 1, `Riesensprung: ${JSON.stringify(g.spruenge)}`);
  });
  test(`${id}: Sprünge – Mindesttempo passt zur Tabelle (±4 m/s), mit Vollgas ohne Pads erreichbar`, () => {
    for (const s of geometrie(bahn).spruenge) {
      const v = mindesttempo(bahn, s.name);
      console.log(`  ${s.name}: Mindesttempo ${v.toFixed(1)} m/s`);
      assert.ok(v < GLEITER.vmax * 0.95, `${s.name}: ${v.toFixed(1)} m/s`);
      assert.ok(Math.abs((bahn.sprungMindest || {})[s.name] - v) <= 4, `SPRUNG_MINDEST[${s.name}] = ${(bahn.sprungMindest || {})[s.name]} ≠ ${v.toFixed(1)}`);
    }
  });
  test(`${id}: Spieler hält ↑ über alle Sprünge (mit und ohne Pads) – 0 Abstürze, 0 Bauchlandungen`, () => {
    for (const z of luftMessung('', id)) {
      console.log(`  ${z.sprung}: ${z.hoch.absturz ? 'ABSTURZ ' + z.hoch.grund : 'ok'} ${z.hoch.luft.toFixed(1)} s ${z.hoch.weite.toFixed(0)} m`);
      assert.ok(!z.hoch.absturz && !z.hoch.bauch, `${z.sprung}: ${JSON.stringify({ absturz: z.hoch.absturz, bauch: z.hoch.bauch, grund: z.hoch.grund })}`);
    }
  });
  test(`${id}: KI-Gate 8 × 10 Runden – 0 Abflüge, alle Sprünge gelandet, Runde 1:15–1:40, Rennen ≤ 5:00`, () => {
    const ki = kiGate(id, 10), e = finde(id);
    console.log(`  Median ${JSON.stringify(ki.median)}, Wand ${ki.wandJeMin.toFixed(2)}/Gleiter-min, Register ${e.rundenzeit} s`);
    assert.equal(ki.phase, 'ziel');
    const nSpr = geometrie(bahn).spruenge.length;
    for (const f of ki.fahrer) {
      assert.ok(f.runden >= 10, `${f.name}: Runden`);   // wer weit vorn ist, fährt bis zum Zieleinlauf der Letzten weiter
      assert.equal(f.abfluege, 0, `${f.name} (${f.profil}, ${f.weg}): Abflüge`);
      assert.ok(f.landungen >= 10 * nSpr, `${f.name}: ${f.landungen} Sprung-Landungen`);
    }
    assert.ok(ki.median.mittel >= 75 && ki.median.mittel <= 100, `Runde Mittel ${ki.median.mittel.toFixed(1)} s`);
    assert.ok(Math.abs(ki.median.mittel - e.rundenzeit) <= 6, `Register ${e.rundenzeit} ≠ gemessen ${ki.median.mittel.toFixed(1)}`);
    const n = rundenDer(id);
    for (const [p, m] of Object.entries(ki.median)) assert.ok(RENNDAUER.countdown + RENNDAUER.start + n * m <= RENNDAUER.ziel + 5, `${p}: Rennen ${n} × ${m.toFixed(1)} s`);
    assert.ok(ki.wandJeMin <= WAND_MEGASTADT, `Wandtreffer ${ki.wandJeMin.toFixed(2)} je Gleiter-Minute (Megastadt ${WAND_MEGASTADT})`);
  });
}

test('Gewitter-Pass: Blitze respektieren „Blitze reduzieren“ (≤ 3 je Sekunde, gedämpft, kein Flackern)', async () => {
  await import('./three_haken.mjs');
  const { GewitterTakt } = await import('../../src/gfx/kulisse_gebirge.js');
  const { BlitzBremse } = await import('../../src/core/zeit.js');
  for (const reduziert of [false, true]) {
    const takt = new GewitterTakt(5), bremse = new BlitzBremse({ reduziert });
    let pulse = 0, maxH = 0, an = false; const zeiten = [];
    for (let t = 0; t < 120; t += 1 / 60) {
      const h = takt.hell(t, bremse);
      maxH = Math.max(maxH, h);
      if (h > 0.3 && !an) { pulse++; zeiten.push(t); }
      an = h > 0.3;
    }
    let maxJeSek = 0;
    for (const t0 of zeiten) maxJeSek = Math.max(maxJeSek, zeiten.filter((t) => t >= t0 && t < t0 + 1).length);
    console.log(`  ${reduziert ? 'reduziert' : 'voll'}: ${pulse} Pulse in 120 s, max ${maxJeSek}/s, Helligkeit ≤ ${maxH.toFixed(2)}`);
    assert.ok(pulse >= 12, 'es gewittert');
    if (reduziert) { assert.ok(maxJeSek <= 1, 'kein Flackern'); assert.ok(maxH <= 0.56, 'gedämpft'); } else assert.ok(maxJeSek >= 2, 'Flacker-Folge');
  }
});
