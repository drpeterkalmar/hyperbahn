// Strecken-Geometrie (ohne Browser): Teile vorhanden, Werte endlich, Fahrbahn-Normalen = Fahrflächen-Oben und Wicklung
// nach außen (Oberseite sichtbar), keine Fahrbahn über den Sprung-Lücken, Röhren-Normalen nach innen, three-Meshes bauen.
// Aufruf: node --test tests/node/test_bahn_geo.mjs
import './three_haken.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { strecke1 } from '../../src/track/strecke1.js';
import { baueBahnGeometrie, baueBahnInstanzen, bereiche } from '../../src/gfx/bahn_geo.js';
import { F_LUECKE } from '../../src/track/bahn.js';

const bahn = strecke1();
const teile = baueBahnGeometrie(bahn);

test('Teile vorhanden, Werte endlich, Indizes gültig', () => {
  for (const [name, b] of Object.entries(teile)) {
    if (!['teiler', 'teilerKante'].includes(name)) assert.ok(b.pos.length > 0, `${name} leer`);   // P2: Teiler nur an Gabelungen
    assert.ok(b.pos.every(Number.isFinite) && b.nor.every(Number.isFinite) && b.uv.every(Number.isFinite), `${name} NaN`);
    const nv = b.pos.length / 3;
    assert.ok(b.idx.every((i) => i >= 0 && i < nv), `${name} Index`);
  }
  const tris = Object.values(teile).reduce((a, b) => a + b.idx.length / 3, 0);
  console.log(`  Dreiecke gesamt ${tris}`);
  assert.ok(tris < 400000, 'Handy-Budget');
});

test('Fahrbahn: Wicklung nach oben (= Fahrflächen-Normale), auch kopfüber', () => {
  const b = teile.fahrbahn;
  let falsch = 0;
  for (let t = 0; t < b.idx.length; t += 3) {
    const [a, c, d] = [b.idx[t], b.idx[t + 1], b.idx[t + 2]];
    const P = (i) => [b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]];
    const A = P(a), B = P(c), D = P(d);
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nn = [b.nor[a * 3], b.nor[a * 3 + 1], b.nor[a * 3 + 2]];
    if (n[0] * nn[0] + n[1] * nn[1] + n[2] * nn[2] < 0) falsch++;
  }
  assert.equal(falsch, 0);
});

test('Keine Fahrbahn über den Lücken', () => {
  const luecken = bereiche(bahn, (i) => bahn.flags[i] & F_LUECKE);
  assert.ok(luecken.length >= 2);
  const b = teile.fahrbahn;
  for (const [i0, i1] of luecken) {
    // Mitte der Lücke: kein Fahrbahn-Punkt im Umkreis von 20 m
    const m = Math.floor((i0 + i1) / 2);
    const x = bahn.px[m], y = bahn.py[m], z = bahn.pz[m];
    for (let v = 0; v < b.pos.length; v += 3) {
      const d = Math.hypot(b.pos[v] - x, b.pos[v + 1] - y, b.pos[v + 2] - z);
      assert.ok(d > 20, 'Fahrbahn in der Lücke');
    }
  }
});

test('Instanzen: Ringe, Landezonen-Lichter, Stützen, Röhrenlichter', () => {
  const ins = baueBahnInstanzen(bahn);
  assert.equal(ins.ringe.length, bahn.ringe.length);
  assert.ok(ins.lichter.length > 40 && ins.stuetzen.length > 50 && ins.roehrenLichter.length > 10);
});

test('three.js-Meshes lassen sich bauen (ohne Browser)', async () => {
  const { baueBahnMesh } = await import('../../src/gfx/bahnmesh.js');
  const m = baueBahnMesh(bahn, { teile });
  assert.ok(m.gruppe.children.length >= 6);
  m.update(1.5, { blitze: null, boost: 0 });
});
