// Rennlogik: Startaufstellung hinter dem Strich, Countdown hält das Feld, Rundenzähler/Rangliste, Rückwärtsfahren zählt
// negativ (kein Abkürzen), Gleiter-Stöße trennen und tauschen Impuls.
// Aufruf: node --test tests/node/test_rennen.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZEIT } from '../../src/config.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { bauePlan, Pilot, PROFILE } from '../../src/ai/pilot.js';
import { Rennen, TEAMS, START } from '../../src/game/rennen.js';

const bahn = strecke1(), plan = bauePlan(bahn), dt = ZEIT.schritt;
const NULL = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };

test('Startaufstellung: 8 Gleiter hinter dem Strich in Zweierreihen, Countdown hält das Feld', () => {
  const r = new Rennen(bahn, TEAMS.map((t, k) => ({ ...t, pilot: k ? new Pilot(bahn, plan, PROFILE.mittel, k) : null })), { runden: 1 });
  for (const t of r.alle) { assert.ok(t.fortschritt < 0); assert.ok(t.g.s > bahn.L - 120); }
  const p0 = r.alle.map((t) => t.g.s);
  for (let i = 0; i < (START.countdown - 0.5) / dt; i++) r.schritt(dt, { ...NULL, gas: 1 });
  assert.equal(r.phase, 'countdown');
  r.alle.forEach((t, k) => assert.equal(t.g.s, p0[k]));
  for (let i = 0; i < 1 / dt; i++) r.schritt(dt, { ...NULL, gas: 1 });
  assert.equal(r.phase, 'rennen');
});

test('Rundenzähler + Rangliste + Ziel (KI-Rennen über 1 Runde)', () => {
  const r = new Rennen(bahn, TEAMS.slice(0, 4).map((t, k) => ({ ...t, pilot: new Pilot(bahn, plan, PROFILE[['profi', 'mittel', 'leicht', 'mittel'][k]], k + 1) })), { runden: 1, ohneCountdown: true });
  let n = 0;
  while (r.phase !== 'ziel' && n++ < 260 / dt) { r.schritt(dt, null); for (const g of r.gleiter) g.ereignisse.length = 0; }
  assert.equal(r.phase, 'ziel');
  assert.equal(r.zielReihenfolge.length, 4);
  r.rangliste.forEach((t, i) => { assert.equal(t.platz, i + 1); assert.equal(t.rundenZeiten.length, 1); });
  for (let i = 1; i < 4; i++) assert.ok(r.zielReihenfolge[i].ziel.zeit >= r.zielReihenfolge[i - 1].ziel.zeit);
});

test('Rückwärts über den Strich zählt keine Runde', () => {
  const r = new Rennen(bahn, [{ name: 'DU' }], { runden: 1, ohneCountdown: true });
  const t = r.alle[0];
  // Spieler steht vor dem Strich, setzt zurück über den Strich und wieder vor: Fortschritt bleibt < L
  t.g.setzeAuf(20, 0, 0); t.sAlt = t.g.s; t.fortschritt = 20;
  t.g.setzeAuf(bahn.L - 10, 0, 0); r.fortschritt();
  assert.ok(t.fortschritt < 0, `Fortschritt ${t.fortschritt}`);
  t.g.setzeAuf(30, 0, 0); r.fortschritt();
  assert.equal(t.runde, 0);
});

test('Stoß: überlappende Gleiter werden getrennt und tauschen Impuls', () => {
  const r = new Rennen(bahn, [{ name: 'A' }, { name: 'B' }], { runden: 1, ohneCountdown: true });
  const [a, b] = r.gleiter;
  a.setzeAuf(500, 0, 60); b.setzeAuf(503, 0, 30);
  const vrel0 = a.tempo - b.tempo;
  r.stoesse();
  const d = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y, a.p.z - b.p.z);
  assert.ok(d > 3, `Abstand ${d}`);
  const va = Math.hypot(a.v.x, a.v.y, a.v.z), vb = Math.hypot(b.v.x, b.v.y, b.v.z);
  assert.ok(va - vb < vrel0, 'Relativtempo kleiner');
  assert.ok(a.ereignisse.some((e) => e.art === 'stoss'));
});
