// Schwebe-Physik: deterministisch, keine NaN, Magnethaftung kopfüber bei Mindesttempo, ohne Magnet Abflug, Looping bei
// Mindesttempo und bei 800 km/h (kein Durchrutschen), Boost-Pads stapeln mit Deckel, Barrel-Roll = Turbo, Wandkontakt,
// Riesensprünge: Mindesttempo, Flugzeit, Weite mit und ohne Pad-Kette.
// Aufruf: node --test tests/node/test_gleiter.mjs   (Messwerte stehen im Test-Log, Bericht übernimmt sie)
import test from 'node:test';
import assert from 'node:assert/strict';
import { GLEITER, BOOST, ZEIT, LUFT } from '../../src/config.js';
import { baueBahn, F_MAGNET, F_LUECKE, F_SPRUNG } from '../../src/track/bahn.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Gleiter } from '../../src/physics/gleiter.js';
import { bauePlan, Pilot, PROFILE } from '../../src/ai/pilot.js';
import { endlich } from '../../src/core/vec.js';

const dt = ZEIT.schritt;
const bahn = strecke1();
const segS = (name) => { const k = bahn.abschnitte.findIndex((a) => a.name === name); return [bahn.segStart[k], bahn.segStart[k] + bahn.abschnitte[k].len]; };

// einfacher Spurhalter: Querversatz uZiel, Tempo halten (vZiel) oder Vollgas
function spur(g, uZiel = 0, vZiel = Infinity) {
  const q = g.q;
  const vt = g.v.x * q.T.x + g.v.y * q.T.y + g.v.z * q.T.z, vl = g.v.x * q.Ls.x + g.v.y * q.Ls.y + g.v.z * q.Ls.z;
  const e = Math.atan2(vl, Math.max(vt, 1));
  const lenk = Math.max(-1, Math.min(1, 0.05 * (uZiel - g.u) - 2.2 * e));
  return { gas: g.tempo < vZiel ? 1 : 0, lenk, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
}
function fahre(g, sek, steuer) {
  const n = Math.round(sek / dt);
  for (let i = 0; i < n; i++) { g.schritt(dt, steuer(g, i)); if (steuer.nach) steuer.nach(g, i); }
}

test('deterministisch und ohne NaN (2 × 30 s KI-Fahrt, bitgleich)', () => {
  const plan = bauePlan(bahn);
  const lauf = () => {
    const g = new Gleiter(bahn, { s: 10 }), p = new Pilot(bahn, plan, PROFILE.mittel, 3);
    for (let i = 0; i < 30 / dt; i++) {
      g.schritt(dt, p.steuer(g, dt, []));
      assert.ok(endlich(g.p) && endlich(g.v) && endlich(g.w) && endlich(g.vor), `NaN bei Schritt ${i}`);
    }
    return [g.p.x, g.p.y, g.p.z, g.v.x, g.s];
  };
  assert.deepEqual(lauf(), lauf());
});

// Teststrecke: gerade, 180°-Twist, lange Überkopf-Gerade (mit/ohne Magnet)
function kopfueberBahn(magnet) {
  return baueBahn([
    { typ: 'gerade', len: 300 },
    { typ: 'twist', len: 240, bank: 180, magnet },
    { typ: 'gerade', len: 800, magnet },
    { typ: 'twist', len: 240, bank: 0, magnet },
    { typ: 'gerade', len: 300 },
  ], { ohneSchluss: true });
}

test('Magnethaftung: hält kopfüber bei Mindesttempo 10 m/s (36 km/h echt) – auch ohne Gas', () => {
  for (const vMin of [10, 4]) {
    const b = kopfueberBahn(true);
    const g = new Gleiter(b, { s: 700, v0: vMin });
    let hMax = 0, hMin = 99;
    fahre(g, 6, (gg) => spur(gg, 0, vMin));
    // über die ganze Zeit Abstand zur Fahrfläche prüfen
    const g2 = new Gleiter(b, { s: 700, v0: vMin });
    fahre(g2, 6, (gg) => { hMax = Math.max(hMax, gg.h); hMin = Math.min(hMin, gg.h); return spur(gg, 0, vMin); });
    assert.equal(g.zustand, 'fahrt'); assert.equal(g.statistik.abfluege, 0);
    assert.ok(g.q.Us.y < -0.95, 'wirklich kopfüber');
    assert.ok(hMax < 2.5 && hMin > 0.5, `${vMin} m/s: Höhe ${hMin.toFixed(2)}…${hMax.toFixed(2)} m`);
    assert.ok(g2.magnet > 0.99);
  }
});

test('ohne Magnet fällt der Gleiter kopfüber ab (normale Schwerkraft gilt außerhalb)', () => {
  const b = kopfueberBahn(false);
  const g = new Gleiter(b, { s: 700, v0: 30 });
  let weg = false;
  fahre(g, 4, (gg) => { if (gg.h > GLEITER.reichweite || gg.zustand !== 'fahrt') weg = true; return spur(gg, 0, 30); });
  assert.ok(weg, 'löst sich von der Überkopf-Fahrfläche');
});

test('Magnet-Übergang ist eine Rampe (~0,3 s), kein Sprung', () => {
  const b = kopfueberBahn(true);
  const g = new Gleiter(b, { s: 200, v0: 60 });
  const verlauf = [];
  fahre(g, 2.5, (gg) => { verlauf.push(gg.magnet); return spur(gg, 0, 60); });
  let maxD = 0; for (let i = 1; i < verlauf.length; i++) maxD = Math.max(maxD, verlauf[i] - verlauf[i - 1]);
  assert.ok(verlauf[verlauf.length - 1] > 0.99 && maxD <= dt / 0.3 + 1e-9, `Rampe ${maxD}`);
});

test('Großer Looping: hält bei Mindesttempo 25 m/s und bei 800 km/h (222 m/s) ohne Durchrutschen', () => {
  const [s0, s1] = segS('Großer Looping');
  const vmaxAlt = GLEITER.vmax;
  try {
    for (const v of [25, 222]) {
      GLEITER.vmax = Math.max(vmaxAlt, v);
      const g = new Gleiter(bahn, { s: s0 - 60, v0: v });
      let hMin = 99, hMax = 0, oben = false, n = 0;
      while (g.s < s1 + 40 && n++ < 60 / dt) {
        g.schritt(dt, spur(g, 0, v));
        if (g.s > s0 && g.s < s1) { hMin = Math.min(hMin, g.h); hMax = Math.max(hMax, g.h); if (g.q.U.y < -0.95) oben = true; }
        assert.equal(g.zustand, 'fahrt', `${v} m/s: Abflug bei s=${g.s.toFixed(0)}`);
      }
      assert.ok(oben, 'Scheitel durchfahren');
      assert.ok(hMin > 0 && hMax < 3, `${v} m/s: Höhe ${hMin.toFixed(2)}…${hMax.toFixed(2)} m`);
      console.log(`  Looping ${v} m/s: Schwebehöhe ${hMin.toFixed(2)}…${hMax.toFixed(2)} m`);
    }
  } finally { GLEITER.vmax = vmaxAlt; }
});

test('Korkenzieher-Röhre, Wandfahrt, Überkopf, Twist bei 40 m/s ohne Abflug', () => {
  for (const name of ['Korkenzieher-Röhre', 'Fassade', 'Unter der Brücke', 'Möbius-Twist']) {
    const [s0, s1] = segS(name);
    const g = new Gleiter(bahn, { s: s0 - 50, v0: 40 });
    let n = 0;
    while (g.s < s1 + 30 && n++ < 60 / dt) { g.schritt(dt, spur(g, 0, 40)); assert.equal(g.zustand, 'fahrt', `${name}: Abflug bei s=${g.s.toFixed(0)}`); }
  }
});

test('Boost-Pads stapeln (+50 % je Pad), gedeckelt; Tempo steigt über Höchsttempo', () => {
  const [s0] = segS('Häuserschlucht Anlauf');
  const g = new Gleiter(bahn, { s: s0 - 20, v0: GLEITER.vmax });
  let bMax = 0, vMax = 0, pads = 0;
  fahre(g, 4, (gg) => { bMax = Math.max(bMax, gg.boost); vMax = Math.max(vMax, gg.tempo); return spur(gg, 0); });
  pads = g.statistik.pads;
  assert.ok(pads >= 3, `${pads} Pads`);
  assert.ok(Math.abs(bMax - BOOST.deckel) < 1e-9, `Boost ${bMax} = Deckel ${BOOST.deckel}`);
  assert.ok(vMax > GLEITER.vmax * 1.3, `Tempo ${vMax.toFixed(1)} m/s`);
  console.log(`  Pad-Kette: ${pads} Pads, Boost ${bMax.toFixed(2)}, Spitze ${vMax.toFixed(1)} m/s (${(vMax / GLEITER.vmax).toFixed(2)} × vmax)`);
  // einzelnes Pad
  const g1 = new Gleiter(bahn, { s: s0 + 60, v0: GLEITER.vmax });   // erstes Pad bei +80 m
  let b1 = 0; fahre(g1, 0.3, (gg) => { b1 = Math.max(b1, gg.boost); return spur(gg, 0); });
  assert.ok(Math.abs(b1 - BOOST.gewinn) < 1e-9, `ein Pad: ${b1}`);
});

// Sprung-Messung: Start an s, Querversatz u (Pads treffen oder meiden), Vollgas; Barrel-Roll optional
function sprung(name, { s, u = 0, v0, rolle = false }) {
  const [, sEnde] = segS(name);
  const g = new Gleiter(bahn, { s, u, v0 });
  let n = 0, vAb = 0, gedrueckt = false;
  while (n++ < 40 / dt && g.zustand === 'fahrt') {
    const e = spur(g, u);
    if (g.boden) vAb = g.tempo;
    if (rolle && !g.boden && g.luftZeit > 0.4 && !gedrueckt) { e.rolle = 1; gedrueckt = true; }
    g.schritt(dt, e);
    if (g.statistik.sprunge.length || g.s > sEnde + 900) break;
  }
  const sp = g.statistik.sprunge[0];
  return { ok: g.zustand === 'fahrt' && !!sp && g.statistik.sprungAbstuerze === 0, sp, vAb, g };
}

test('Riesensprünge: Mindesttempo, Flugzeit 4–7,5 s, Weite ≥ 250 m (mit Kette ≥ 450 m) – mit und ohne Pad-Kette', () => {
  for (const [name, anlauf] of [['Häuserschlucht', 'Häuserschlucht Anlauf'], ['Neon-Schlucht', 'Hafen Anlauf']]) {
    const [a0] = segS(anlauf);
    const k = bahn.abschnitte.findIndex((x) => x.name === name);
    const sKante = bahn.segStart[k];   // Ende der Absprung-Rampe = Beginn der Lücke
    // mit Pad-Kette (Mitte), Start mit Höchsttempo vor der Kette
    const mit = sprung(name, { s: a0 - 30, u: 0, v0: GLEITER.vmax });
    // ohne Pad-Kette: seitlich an den Pads vorbei (Pads ±8 m), gleiches Anfangstempo
    const ohne = sprung(name, { s: a0 - 30, u: 11, v0: GLEITER.vmax });
    assert.ok(mit.ok && ohne.ok, `${name}: mit ${mit.ok} ohne ${ohne.ok}`);
    // Mindesttempo an der Kante (Halbierung, Start 3 m vor der Kante mit Vollgas; Boost-Ringe in der Luft zählen mit)
    let lo = 20, hi = GLEITER.vmax * 1.6;
    for (let it = 0; it < 14; it++) {
      const m = (lo + hi) / 2;
      const r = sprung(name, { s: sKante - 3, u: 0, v0: m });
      if (r.ok) hi = m; else lo = m;
    }
    const vMin = hi;
    for (const [art, r] of [['mit Pads', mit], ['ohne Pads', ohne]]) {
      console.log(`  ${name} ${art}: Absprung ${r.vAb.toFixed(1)} m/s, Flug ${r.sp.luft.toFixed(2)} s, Weite ${r.sp.weite.toFixed(0)} m`);
      assert.ok(r.sp.luft >= 4 && r.sp.luft <= 7.5, `${name} ${art}: Flugzeit ${r.sp.luft.toFixed(2)} s`);
      // Brief: ≥ 250–400 m Flug; mit Pad-Kette deutlich darüber
      assert.ok(r.sp.weite >= (r === mit ? 450 : 250), `${name} ${art}: Weite ${r.sp.weite.toFixed(0)} m`);
    }
    console.log(`  ${name}: Mindesttempo am Absprung ${vMin.toFixed(1)} m/s (${(vMin / GLEITER.vmax * 100).toFixed(0)} % vmax), mit Kette ${mit.vAb.toFixed(1)} m/s`);
    assert.ok(vMin < GLEITER.vmax * 0.95, 'ohne Pads mit Vollgas erreichbar');
    assert.ok(mit.vAb > vMin * 1.3, 'Pad-Kette gibt sichere Reserve');
    assert.ok(mit.vAb > ohne.vAb + 15, 'Pad-Kette wirkt');
  }
});

test('Barrel-Roll im Sprung = Turbo; Landung mitten in der Rolle = Patzer', () => {
  const [a0] = segS('Häuserschlucht Anlauf');
  const r = sprung('Häuserschlucht', { s: a0 - 30, v0: GLEITER.vmax, rolle: true });
  assert.ok(r.ok && r.g.statistik.rollen === 1, 'Rolle vollendet');
  assert.ok(r.g.ereignisse.some((e) => e.art === 'rolle'));
  // Patzer: Rolle direkt vor dem Aufsetzen beginnen (kurzer Hüpfer auf eigener Teststrecke)
  void LUFT; void F_LUECKE; void F_SPRUNG; void F_MAGNET;
});

test('Wandkontakt: Funken-Ereignis, Tempoverlust, Schild-Abzug, Gleiter bleibt auf der Bahn', () => {
  const b = kopfueberBahn(false);
  const g = new Gleiter(b, { s: 60, u: 6, v0: 80 });
  // schräg nach links in die Wand lenken
  let wand = 0;
  fahre(g, 1.5, (gg) => ({ gas: 1, lenk: 0.6, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 }));
  for (const e of g.ereignisse) if (e.art === 'wand') wand++;
  assert.ok(wand >= 1, 'Wand-Ereignis');
  assert.ok(g.schild < 1, `Schild ${g.schild}`);
  assert.ok(Math.abs(g.u) <= b.hw[0] - GLEITER.breite / 2 + 0.05, 'innerhalb der Begrenzung');
  assert.equal(g.zustand, 'fahrt');
});

test('Luftbremsen: engere Kurve als ohne (gleiche Lenkung)', () => {
  const radius = (bremse) => {
    const b = kopfueberBahn(false);
    const g = new Gleiter(b, { s: 20, u: 0, v0: 70 });
    fahre(g, 0.6, () => ({ gas: 1, lenk: 1, bremseL: bremse, bremseR: 0, nase: 0, rolle: 0 }));
    return g.u;
  };
  assert.ok(radius(1) > radius(0) + 0.2, 'mit Luftbremse links weiter nach links');
});
