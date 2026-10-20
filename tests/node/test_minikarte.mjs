// 3D-Minikarte (ohne Browser): Band-Geometrie endlich, Sprung-Lücken offen, Magnet-Abschnitte markiert, Pads als Punkte,
// echte Höhen (Spannweite > 100 m), Karte baut mit three in Node (ohne WebGL-Rendern).
// Aufruf: node --test tests/node/test_minikarte.mjs
import './three_haken.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { strecke1 } from '../../src/track/strecke1.js';
import { F_LUECKE, F_MAGNET } from '../../src/track/bahn.js';

const bahn = strecke1();
const { karteGeometrie, KARTE } = await import('../../src/gfx/minikarte.js');
const g = karteGeometrie(bahn);

test('Band: endlich, Indizes gültig, Größe passt zur Strecke', () => {
  assert.ok(g.pos.every(Number.isFinite) && g.col.every(Number.isFinite));
  const nv = g.pos.length / 3;
  assert.ok(g.idx.length > 1000 && g.idx.every((i) => i >= 0 && i < nv));
  assert.ok((g.hi[1] - g.lo[1]) / KARTE.hoehe > 100, 'echte Höhen fehlen');
});

test('Sprung-Lücken bleiben offen, Magnet-Abschnitte markiert, Pads vorhanden', () => {
  const k = KARTE.schritt;
  const mitDreieck = new Set();
  for (let t = 0; t < g.idx.length; t += 6) mitDreieck.add(g.idx[t] >> 1);
  let luecken = 0, offen = 0;
  for (let j = 0; j < g.n - 1; j++) {
    const i = (j * k) % bahn.N;
    if (bahn.flags[i] & F_LUECKE) { luecken++; if (!mitDreieck.has(j)) offen++; }
  }
  assert.ok(luecken > 50 && offen === luecken, `Lücken ${luecken}, offen ${offen}`);
  let mag = 0; for (const m of g.mag) mag += m;
  let soll = 0; for (let j = 0; j < g.n; j++) if (bahn.flags[(j * k) % bahn.N] & F_MAGNET) soll += 2;
  assert.equal(mag, soll);
  assert.equal(g.pads.length / 3, bahn.pads.length);
});

test('Minikarte baut (Szene, Pfeil, Punkte) ohne Renderer-Aufruf', async () => {
  const { Minikarte } = await import('../../src/gfx/minikarte.js');
  const r = { getPixelRatio: () => 2 };
  const m = new Minikarte(r, bahn, { modus: '3d' });
  assert.ok(m.szene.children.length >= 6);
  assert.ok(m.radius > 500);
  m.dispose();
});
