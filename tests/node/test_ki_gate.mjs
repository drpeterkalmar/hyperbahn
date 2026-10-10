// KI-Gate (Brief): 8 Gleiter (7 KI-Gegner + Autopilot als Spieler) fahren 10 Runden mit derselben Schwebe-Physik –
// kein Abflug (inkl. aller Magnet-Abschnitte), alle Riesensprünge gelandet, Rundenzeiten plausibel (2–3 min).
// Aufruf: node --test tests/node/test_ki_gate.mjs   (~15 s)
import test from 'node:test';
import assert from 'node:assert/strict';
import { kiRennen } from '../../tools/ki_rennen.mjs';

test('KI-Gate: 10 Runden ohne Abflug, alle Sprünge gelandet, Rundenzeiten plausibel', () => {
  const t0 = Date.now();
  const { r, profile, zaehl } = kiRennen(10, '', (z) => console.log('  ' + z));
  console.log(`  Rechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s, Rennzeit ${r.zeit.toFixed(0)} s, Ereignisse ${JSON.stringify(zaehl)}`);
  assert.equal(r.phase, 'ziel');
  const schnitt = {};
  for (const t of r.alle) {
    const st = t.g.statistik;
    console.log(`  ${t.platz}. ${t.name} (${profile[t.k]}): beste ${t.beste.toFixed(1)} s, Abflüge ${st.abfluege}, Sprung-Landungen ${st.sprungLandungen}, Wand ${st.wandTreffer}, Rollen ${st.rollen}`);
    assert.equal(t.rundenZeiten.length, 10, `${t.name}: 10 Runden`);
    assert.equal(st.abfluege, 0, `${t.name}: Abflüge`);
    assert.equal(st.sprungAbstuerze, 0, `${t.name}: Sprung-Abstürze`);
    assert.ok(st.sprungLandungen >= 20, `${t.name}: ${st.sprungLandungen} Sprung-Landungen`);
    for (const rz of t.rundenZeiten) assert.ok(rz > 120 && rz < 200, `${t.name}: Rundenzeit ${rz.toFixed(1)} s`);
    (schnitt[profile[t.k]] ||= []).push(t.rundenZeiten.reduce((a, b) => a + b, 0) / 10);
  }
  const m = (k) => schnitt[k].reduce((a, b) => a + b, 0) / schnitt[k].length;
  assert.ok(m('profi') < m('mittel') && m('mittel') < m('leicht'), 'Stärke-Stufen geordnet');
});
