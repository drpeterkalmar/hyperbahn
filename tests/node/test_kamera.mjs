// Kamera ohne Browser: folgt der Bahn-Normale durch Looping/Röhre stetig (kein Umklappen), „Horizont halten“ bleibt in
// der Steilkurve nahe Welt-Oben, Panorama zieht bei Riesensprüngen zurück, Bullet-Time-Orbit, keine NaN.
// Aufruf: node --test tests/node/test_kamera.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZEIT } from '../../src/config.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Gleiter } from '../../src/physics/gleiter.js';
import { bauePlan, Pilot, PROFILE } from '../../src/ai/pilot.js';
import { KameraRig, KAM } from '../../src/gfx/kamera.js';
import { endlich } from '../../src/core/vec.js';
import { neueAbfrage, F_LUECKE } from '../../src/track/bahn.js';

const bahn = strecke1(), plan = bauePlan(bahn), dt = ZEIT.schritt;
const segS = (name) => { const k = bahn.abschnitte.findIndex((a) => a.name === name); return [bahn.segStart[k], bahn.segStart[k] + bahn.abschnitte[k].len]; };

function fahrt(s0, sek, opt = {}, jeBild = () => {}) {
  const g = new Gleiter(bahn, { s: s0, v0: 90 }), p = new Pilot(bahn, plan, PROFILE.profi, 5), rig = new KameraRig();
  const proBild = Math.round(1 / 60 / dt);
  for (let i = 0; i < sek / dt; i++) {
    g.schritt(dt, p.steuer(g, dt, []));
    if (i % proBild === 0) { rig.update(1 / 60, g, opt.fx || null, opt); jeBild(rig, g); }
  }
  return { g, rig };
}

test('Looping + Korkenzieher: Kamera-Oben dreht stetig mit (≤ 6° je Bild), keine NaN', () => {
  for (const name of ['Großer Looping', 'Korkenzieher-Röhre', 'Unter der Brücke']) {
    const [s0, s1] = segS(name);
    let alt = null, maxW = 0, minOben = 1;
    fahrt(s0 - 150, (s1 - s0 + 300) / 90, {}, (rig) => {
      assert.ok(endlich(rig.pos) && endlich(rig.oben) && Number.isFinite(rig.fov));
      if (alt) maxW = Math.max(maxW, Math.acos(Math.min(1, alt.x * rig.oben.x + alt.y * rig.oben.y + alt.z * rig.oben.z)) * 180 / Math.PI);
      alt = { ...rig.oben };
      minOben = Math.min(minOben, rig.oben.y);
    });
    assert.ok(maxW <= 6, `${name}: ${maxW.toFixed(2)}° je Bild`);
    assert.ok(minOben < -0.5, `${name}: Horizont dreht mit (oben.y min ${minOben.toFixed(2)})`);
  }
});

test('Horizont halten: in der Steilkurve bleibt Oben nahe Welt-Oben', () => {
  const [s0, s1] = segS('Große Steilkurve');
  const mitte = (s0 + s1) / 2;
  const messe = (horizontHalten) => {
    let min = 1;
    fahrt(mitte - 200, 3, { horizontHalten }, (rig, g) => { if (g.s > mitte - 60) min = Math.min(min, rig.oben.y); });
    return min;
  };
  const halten = messe(true), folgen = messe(false);
  assert.ok(halten > 0.95, `halten ${halten.toFixed(3)}`);
  assert.ok(folgen < halten - 0.05, `folgen ${folgen.toFixed(3)}`);
});

test('Riesensprung: Panorama zieht zurück; Bullet-Time fährt Halbkreis', () => {
  const [a0] = segS('Häuserschlucht Anlauf');
  let maxD = 0;
  fahrt(a0 - 50, 12, {}, (rig) => { maxD = Math.max(maxD, rig.dist); });
  assert.ok(maxD > KAM.abstand + 4, `Abstand ${maxD.toFixed(1)}`);
  const g = new Gleiter(bahn, { s: 300, v0: 0 }), rig = new KameraRig();
  rig.update(1 / 60, g, null);
  const vorher = { x: rig.pos.x - g.p.x, z: rig.pos.z - g.p.z };
  rig.update(1 / 60, g, { orbitAn: 1, orbit: Math.PI, fov: 0, zoom: 1, shake: 0 });
  const nachher = { x: rig.pos.x - g.p.x, z: rig.pos.z - g.p.z };
  assert.ok(vorher.x * nachher.x + vorher.z * nachher.z < 0, 'Kamera auf der Gegenseite');
});

// p1c (Peter 22.10.: „Kamera clippt im Looping durch den Boden“): Kamera nie hinter/unter der Fahrbahn – Looping,
// Korkenzieher, Wand, Überkopf, Twist; mit und ohne Bullet-Time-Halbkreis; Looping-Höhe steigt weich
test('Kamera bleibt über der Fahrbahn (Looping, Röhre, Wand, Überkopf, Twist), Looping-Höhe steigt', () => {
  const q = neueAbfrage();
  for (const name of ['Großer Looping', 'Korkenzieher-Röhre', 'Fassade', 'Unter der Brücke', 'Möbius-Twist']) {
    for (const orbit of [false, true]) {
      const [s0, s1] = segS(name);
      let minH = 99, maxLoop = 0, bild = 0;
      fahrt(s0 - 150, (s1 - s0 + 250) / 90, {}, (rig, g) => {
        bild++;
        if (orbit && bild % 30 < 15) rig.update(1 / 60, g, { orbitAn: 1, orbit: (bild % 30) / 15 * Math.PI, fov: 0, zoom: 1, shake: 0 });
        const r = bahn.abfrage(rig.pos, g.hint, q);
        if (r.ok && !(r.flags & F_LUECKE) && Math.abs(r.u) <= r.hw + 2) minH = Math.min(minH, r.h);
        maxLoop = Math.max(maxLoop, rig.loopK);
      });
      assert.ok(minH >= KAM.boden - 0.01, `${name}${orbit ? ' (Bullet-Time)' : ''}: Kamera ${minH.toFixed(2)} m über der Fahrbahn`);
      assert.ok(maxLoop > 0.8, `${name}: Looping-Anteil ${maxLoop.toFixed(2)}`);
    }
  }
});
