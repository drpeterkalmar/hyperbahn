// Fahrhilfe (Peters Regel: Hilfen nehmen nie die Kontrolle weg, kein Schienenfahren) und Auslöser der Action-Momente.
// Aufruf: node --test tests/node/test_fahrhilfe_momente.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZEIT, GLEITER } from '../../src/config.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Gleiter } from '../../src/physics/gleiter.js';
import { bauePlan } from '../../src/ai/pilot.js';
import { Fahrhilfe, AUS_ZEIT, ZURUECK_ZEIT } from '../../src/game/fahrhilfe.js';
import { MomentWaechter } from '../../src/game/momente.js';
import { kiRennen } from '../../tools/ki_rennen.mjs';

const dt = ZEIT.schritt;
const bahn = strecke1();
const plan = bauePlan(bahn);
const NULL = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };

test('Leicht ohne Eingabe: Auto-Gas + Lenkzug bringen den Gleiter durch die erste Kurvenfolge', () => {
  const g = new Gleiter(bahn, { s: 5 }), h = new Fahrhilfe(bahn, plan, 'leicht');
  for (let i = 0; i < 25 / dt; i++) g.schritt(dt, h.anwenden(g, NULL, dt));
  assert.equal(g.zustand, 'fahrt');
  assert.ok(g.s > 1500, `gefahren ${g.s.toFixed(0)} m`);
  assert.ok(g.tempo > GLEITER.vmax * 0.8, 'Auto-Gas');
});

test('Deutliche Eingabe blendet den Zug in ≤ 0,3 s aus, Loslassen führt sanft zurück', () => {
  const g = new Gleiter(bahn, { s: 100, v0: 80 }), h = new Fahrhilfe(bahn, plan, 'leicht');
  let t = 0;
  while (h.gewicht > 0) { h.anwenden(g, { ...NULL, lenk: 1 }, dt); t += dt; }
  assert.ok(t <= 0.3 + 1e-9, `aus nach ${t.toFixed(3)} s`);
  let t2 = 0;
  for (let i = 0; i < 0.2 / dt; i++) { h.anwenden(g, NULL, dt); t2 += dt; }
  assert.ok(h.gewicht < 0.4, 'kein Zurückschnappen');
  while (h.gewicht < 1) { h.anwenden(g, NULL, dt); t2 += dt; }
  assert.ok(Math.abs(t2 - ZURUECK_ZEIT) < 0.05, `zurück nach ${t2.toFixed(2)} s`);
  void AUS_ZEIT;
});

test('Kein Schienenfahren: auch auf Leicht kann man an die Wand lenken', () => {
  const g = new Gleiter(bahn, { s: 100, v0: 80 }), h = new Fahrhilfe(bahn, plan, 'leicht');
  let wand = false;
  for (let i = 0; i < 2 / dt; i++) {
    g.schritt(dt, h.anwenden(g, { ...NULL, lenk: 1 }, dt));
    if (g.ereignisse.some((e) => e.art === 'wand')) wand = true;
  }
  assert.ok(wand, 'Wand erreicht');
});

test('Profi: keine Hilfe (Eingabe = Ausgabe), Mittel: kein Auto-Gas', () => {
  const g = new Gleiter(bahn, { s: 100, v0: 80 });
  const p = new Fahrhilfe(bahn, plan, 'profi');
  const e = p.anwenden(g, { ...NULL, gas: 0.4, lenk: 0.2 }, dt);
  assert.equal(e.gas, 0.4); assert.equal(e.lenk, 0.2);
  const m = new Fahrhilfe(bahn, plan, 'mittel');
  assert.equal(m.anwenden(g, NULL, dt).gas, 0);
});

test('Action-Auslöser: Sprung-Scheitel, Ring-Kette, Ziel auf Platz 1 werden gemeldet', () => {
  const gemeldet = [];
  const { r } = kiRennen(1, '', () => {});
  // Spieler-Sicht nachstellen: ein Gleiter fährt mit Wächter einen Sprung
  const w = new MomentWaechter(bahn, plan, (art, st, pos, k) => gemeldet.push({ art, st, k }));
  const k = bahn.abschnitte.findIndex((a) => a.name === 'Häuserschlucht Anlauf');
  const g = new Gleiter(bahn, { s: bahn.segStart[k] - 20, v0: GLEITER.vmax });
  for (let i = 0; i < 14 / dt; i++) {
    const q = g.q, vt = g.v.x * q.T.x + g.v.y * q.T.y + g.v.z * q.T.z, vl = g.v.x * q.Ls.x + g.v.y * q.Ls.y + g.v.z * q.Ls.z;
    g.schritt(dt, { ...NULL, gas: 1, lenk: Math.max(-1, Math.min(1, -0.05 * g.u - 2.2 * Math.atan2(vl, Math.max(vt, 1)))) });
    w.pruefe(g, null);
    g.ereignisse.length = 0;
  }
  const arten = new Set(gemeldet.map((x) => x.art));
  assert.ok(arten.has('sprungScheitel'), [...arten].join());
  assert.ok(arten.has('ringKette') || g.statistik.ringe < 2, 'Ring-Kette bei ≥ 2 Ringen');
  // Ziel auf Platz 1
  const w2 = new MomentWaechter(bahn, plan, (art) => gemeldet.push({ art }));
  const sieger = r.rangliste[0].g;
  sieger.ereignisse.push({ art: 'ziel', platz: 1 });
  w2.pruefe(sieger, null);
  assert.ok(gemeldet.some((x) => x.art === 'zielSieg'));
});

test('Gefahr-Erkennung: vor engen Kurven/an der Wand keine Momente', () => {
  const w = new MomentWaechter(bahn, plan, () => {});
  // an der Wand
  const g = new Gleiter(bahn, { s: 100, u: 11, v0: 60 });
  assert.equal(w.gefahr(g), true);
  const g2 = new Gleiter(bahn, { s: 100, u: 0, v0: 30 });
  assert.equal(w.gefahr(g2), false);
});
