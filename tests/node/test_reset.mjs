// 1-Klick-Reset (p1c, Peter 22.10.): sofort mittig an die letzte sichere Stelle, ausgerichtet, mit Schwung; kein Abkürzen
// (im Sprung über der Lücke abgelehnt, Rücksprung zählt als negativer Fortschritt), Doppelklick-Schutz 1 s.
// Aufruf: node --test tests/node/test_reset.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZEIT, GLEITER } from '../../src/config.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { bauePlan, Pilot, PROFILE } from '../../src/ai/pilot.js';
import { Rennen } from '../../src/game/rennen.js';
import { RESET_SPERRE } from '../../src/physics/gleiter.js';
import { F_LUECKE } from '../../src/track/bahn.js';

const bahn = strecke1(), plan = bauePlan(bahn), dt = ZEIT.schritt;
const segS = (name) => bahn.segStart[bahn.abschnitte.findIndex((a) => a.name === name)];

// Rennen mit einem „Spieler“, den ein Profi-Pilot fährt (fliegend bei s0)
function rennenAb(s0, v0 = GLEITER.vmax * 0.85, mitPilot = true) {
  const r = new Rennen(bahn, [{ name: 'DU', spieler: true, pilot: mitPilot ? new Pilot(bahn, plan, PROFILE.profi, 3) : null }], { runden: 3, ohneCountdown: true });
  const t = r.alle[0];
  t.g.setzeAuf(s0, 0, v0); t.sAlt = t.g.s; t.fortschritt = s0;
  return { r, t, g: t.g };
}
const ROLLEN = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
const fahre = (r, sek, bis = () => false) => { for (let i = 0; i < sek / dt && !bis(); i++) { r.schritt(dt, r.alle[0].pilot ? null : ROLLEN); for (const g of r.gleiter) g.ereignisse.length = 0; } };

test('Reset beim Fahren: mittig an der sicheren Stelle, ausgerichtet, Schwung 45–70 %, nie vor der aktuellen Stelle', () => {
  const { r, g } = rennenAb(400);
  fahre(r, 3);
  g.p.x += g.links.x * 6; g.p.z += g.links.z * 6;   // seitlich versetzt
  const sVor = g.s;
  assert.equal(g.zuruecksetzen(), 'reset');
  assert.ok(g.s <= sVor + 0.5 && g.s > sVor - 60, `s ${g.s.toFixed(1)} vs ${sVor.toFixed(1)}`);
  assert.ok(Math.abs(g.u) < 0.5, `mittig (u ${g.u.toFixed(2)})`);
  const vmax = GLEITER.vmax * g.kl.top;
  assert.ok(g.tempo >= 0.45 * vmax - 0.01 && g.tempo <= 0.7 * vmax + 0.01, `Tempo ${g.tempo.toFixed(1)}`);
  assert.ok(g.vor.x * g.q.T.x + g.vor.y * g.q.T.y + g.vor.z * g.q.T.z > 0.99, 'in Fahrtrichtung');
  assert.equal(g.ereignisse.at(-1).art, 'reset');
});

test('Doppelklick-Schutz: zweiter Reset innerhalb 1 s wird abgelehnt, danach wieder möglich', () => {
  const { r, g } = rennenAb(400);
  fahre(r, 2);
  assert.equal(g.zuruecksetzen(), 'reset');
  fahre(r, RESET_SPERRE * 0.5);
  assert.equal(g.zuruecksetzen(), 'sperre');
  fahre(r, RESET_SPERRE * 0.6);
  assert.equal(g.zuruecksetzen(), 'reset');
});

test('Kein Abkürzen: im Flug über der Schlucht abgelehnt; Rücksprung zählt als negativer Fortschritt', () => {
  const { r, t, g } = rennenAb(segS('Häuserschlucht Anlauf'));
  fahre(r, 20, () => !g.boden && (g.q.flags & F_LUECKE) && g.luftZeit > 0.5);
  assert.ok(!g.boden && (g.q.flags & F_LUECKE), 'fliegt über der Lücke');
  const f0 = t.fortschritt, s0 = g.s;
  assert.equal(g.zuruecksetzen(), 'sprung');
  assert.equal(g.zustand, 'fahrt');
  fahre(r, 3, () => g.boden && !(g.q.flags & F_LUECKE) && g.sicherZeit > 0.6);
  assert.ok(t.fortschritt > f0, 'Sprung wird normal weitergeflogen');
  // veraltete sichere Stelle 250 m zurück (z. B. langer Flug abseits): Reset bucht den Rückweg ab
  fahre(r, 1);
  g.sicherS = (g.s - 250 + bahn.L) % bahn.L;
  const f1 = t.fortschritt;
  fahre(r, RESET_SPERRE);
  assert.equal(g.zuruecksetzen(), 'reset');
  r.schritt(dt, null);
  assert.ok(t.fortschritt < f1 - 200, `Fortschritt ${f1.toFixed(0)} → ${t.fortschritt.toFixed(0)}`);
  void s0;
});

test('Unter die Lücken-Bahn gefallen: Reset = Absturz (normaler Respawn hinter der Lücke), abgestürzt: Respawn sofort', () => {
  const { r, g } = rennenAb(segS('Häuserschlucht Anlauf') + 300, 30, false);   // ohne Gas, viel zu langsam für den Sprung
  fahre(r, 20, () => !g.boden && (g.q.flags & F_LUECKE) && g.h < -3);
  assert.ok(g.h < -3 && (g.q.flags & F_LUECKE), `fällt (h ${g.h.toFixed(1)})`);
  assert.equal(g.zuruecksetzen(), 'absturz');
  assert.equal(g.zustand, 'absturz');
  fahre(r, RESET_SPERRE + 0.05);
  assert.equal(g.zustand, 'absturz');
  assert.equal(g.zuruecksetzen(), 'respawn');
  assert.equal(g.zustand, 'fahrt');
  assert.ok(!(g.q.flags & F_LUECKE), 'hinter der Lücke');
});
