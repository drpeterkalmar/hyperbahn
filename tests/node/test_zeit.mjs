// Zeit-Logik: Sim-Uhr fest + bildratenunabhängig, Zeitlupe nur offline (online timeScale immer 1, Schein-Effekte),
// Action-Regie (Abkühlzeit ≥ 8 s, Stufen Aus/Selten/Oft, nie bei Gefahr, Dauer-Grenzen, Bullet-Time ≤ 0,05×, Halbkreis),
// Blitz-Bremse (≤ 3 Blitze/s), Ereignis-Bus, Eingaben wirken auch in der Zeitlupe.
// Aufruf: node --test tests/node/test_zeit.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Uhr, ActionRegie, BlitzBremse, Bus, bus, actionMoment, rampTempo } from '../../src/core/zeit.js';
import { ZEIT, ACTION } from '../../src/config.js';
import { strecke1 } from '../../src/track/strecke1.js';
import { Gleiter } from '../../src/physics/gleiter.js';

test('Sim-Uhr: fester Schritt, unabhängig von der Bildrate', () => {
  const lauf = (fps) => { const u = new Uhr(); for (let i = 0; i < 10 * fps; i++) u.tick(1 / fps); return u.schritte; };
  const soll = 10 / ZEIT.schritt;
  for (const fps of [24, 30, 60, 90, 144]) assert.ok(Math.abs(lauf(fps) - soll) <= 1, `${fps} fps: ${lauf(fps)}`);
});

test('Zeitlupe nur offline: offline langsamer, online bleibt timeScale 1', () => {
  const off = new Uhr({ online: false }), on = new Uhr({ online: true });
  off.faktorExtern = 0.25; on.faktorExtern = 0.25;
  let nOff = 0, nOn = 0;
  for (let i = 0; i < 60; i++) { nOff += off.tick(1 / 60); nOn += on.tick(1 / 60); }
  assert.ok(Math.abs(nOff - 60) <= 1, `offline ${nOff}`);
  assert.ok(Math.abs(nOn - 240) <= 1, `online ${nOn}`);
  assert.equal(on.zeitFaktor, 1);
  assert.equal(on.akzent(), false, 'Absprung-Akzent online nur als Schein');
  assert.equal(off.akzent(), true);
  assert.ok(off.zeitFaktor < 1);
});

test('Absprung-Akzent ?slowmo=0 schaltet ab', () => {
  const alt = ZEIT.slowmo; ZEIT.slowmo = 0;
  try { assert.equal(new Uhr().akzent(), false); } finally { ZEIT.slowmo = alt; }
});

test('Speed-Ramp 1× → 0,1× → 1,5× → 1×', () => {
  const d = ACTION.liveMax;
  assert.ok(Math.abs(rampTempo(0, d) - 1) < 1e-9);
  let min = 9, max = 0; for (let t = 0; t <= d; t += 0.005) { min = Math.min(min, rampTempo(t, d)); max = Math.max(max, rampTempo(t, d)); }
  assert.ok(Math.abs(min - 0.1) < 0.01 && Math.abs(max - 1.5) < 0.01, `${min} … ${max}`);
  assert.ok(Math.abs(rampTempo(d, d) - 1) < 1e-9);
});

test('Regie: Abkühlzeit ≥ 8 s, Stufe Aus = nie, Gefahr blockt, Oft > Selten', () => {
  const strom = (stufe) => {
    const r = new ActionRegie({ stufe, seed: 3 });
    let ausl = 0, letzt = -99, minAbst = Infinity;
    for (let t = 0; t < 600; t += 0.05) {
      r.aktualisiere(t);
      if (Math.round(t / 0.05) % 20 === 0) {   // alle 1 s ein Kandidat
        const p = r.melde(['sprungScheitel', 'ueberholen', 'beinahe', 'ringKette'][Math.floor(t) % 4], 0.9, null, {}, t);
        if (p) { ausl++; minAbst = Math.min(minAbst, t - letzt); letzt = t; }
      }
    }
    return { ausl, minAbst };
  };
  const aus = strom(0), selten = strom(1), oft = strom(2);
  assert.equal(aus.ausl, 0);
  assert.ok(selten.ausl > 5 && oft.ausl > selten.ausl, `selten ${selten.ausl} oft ${oft.ausl}`);
  assert.ok(selten.minAbst >= 8 && oft.minAbst >= 8, `Abstand ${selten.minAbst} / ${oft.minAbst}`);
  const r = new ActionRegie({ stufe: 2 });
  assert.equal(r.melde('sprungScheitel', 1, null, { gefahr: true }, 100), null);
  assert.ok(r.melde('sprungScheitel', 1, null, {}, 100));
});

test('Regie: Dauer-Grenzen, Bullet-Time ≤ 0,05× mit Halbkreis-Orbit, online nur Schein', () => {
  for (const online of [false, true]) {
    const r = new ActionRegie({ stufe: 2, online, seed: 1 });
    const p = r.melde('sprungScheitel', 1, { x: 0, y: 0, z: 0 }, {}, 10);
    assert.ok(p && p.typ === 'bullet' && p.dauer <= 1.5);
    let minF = 9, orbitMax = 0, dauer = 0;
    for (let t = 10; t < 13; t += 1 / 120) {
      const fx = r.aktualisiere(t);
      if (fx.ende) break;
      dauer = t - 10; minF = Math.min(minF, fx.zeitFaktor); orbitMax = Math.max(orbitMax, Math.abs(fx.orbit));
    }
    assert.ok(dauer <= 1.5 + 1e-6, `Bullet-Time ${dauer}`);
    assert.ok(Math.abs(orbitMax - Math.PI) < 0.05, `Halbkreis ${orbitMax}`);
    if (online) assert.equal(minF, 1, 'online kein echter Zeitfaktor');
    else assert.ok(minF <= 0.05, `offline ${minF}`);
    // Speed-Ramp ≤ 1,2 s
    const r2 = new ActionRegie({ stufe: 2, online, seed: 1 });
    const p2 = r2.melde('ueberholen', 1, null, {}, 0);
    assert.ok(p2.dauer <= 1.2);
  }
});

test('Blitz-Bremse: höchstens 3 Blitze je Sekunde, Strobos gedämpft; Standard = volle Show', () => {
  const b = new BlitzBremse({ reduziert: true });
  let n = 0; for (let t = 0; t < 1; t += 0.02) if (b.blitz(t, 1) > 0) n++;
  assert.ok(n <= 3, `${n} Blitze`);
  assert.ok(b.strobo(12, 1).freq <= 3 && b.strobo(12, 1).staerke < 1);
  const voll = new BlitzBremse({ reduziert: false });
  let m = 0; for (let t = 0; t < 1; t += 0.02) if (voll.blitz(t, 1) > 0) m++;
  assert.equal(m, 50);
});

test('Ereignis-Bus actionMoment(art, stärke, pos) erreicht die Regie', () => {
  const r = new ActionRegie({ stufe: 2 });
  const ab = r.verbinde(bus);
  r.t = 50;
  actionMoment('explosion', 1, { x: 1, y: 2, z: 3 });   // Phase-2-Art über dieselbe Schnittstelle
  ab();
  assert.equal(r.statistik.gemeldet, 1);
  assert.ok(r.aktiv && r.aktiv.art === 'explosion');
  const b2 = new Bus(); let x = 0; const off = b2.on('a', (d) => { x += d; }); b2.emit('a', 2); off(); b2.emit('a', 5); assert.equal(x, 2);
});

test('Eingaben wirken auch in der Zeitlupe (Physik nur langsamer, gleiche Antwort je Sim-Schritt)', () => {
  const bahn = strecke1();
  const lenken = (faktor) => {
    const u = new Uhr(); u.faktorExtern = faktor;
    const g = new Gleiter(bahn, { s: 100, v0: 60 });
    let schritte = 0;
    while (schritte < 120) {
      const n = u.tick(1 / 60);
      for (let i = 0; i < n && schritte < 120; i++, schritte++) g.schritt(ZEIT.schritt, { gas: 1, lenk: 1, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 });
    }
    return g.u;
  };
  const normal = lenken(1), zeitlupe = lenken(0.1);
  assert.ok(normal > 0.05, 'Lenken wirkt');
  assert.equal(zeitlupe, normal, 'gleiche Sim-Schritte → gleiche Wirkung (kein Vor-/Nachteil)');
});
