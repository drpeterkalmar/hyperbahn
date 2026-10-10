// Stadt-Plan: kein Turm im Fahrkorridor, Sonderbauten vorhanden und richtig gelegen, deterministisch, schnell.
// Aufruf: node --test tests/node/test_stadt.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { strecke1 } from '../../src/track/strecke1.js';
import { stadtPlan, SCHILD_TEXTE, schildAspekt } from '../../src/gfx/stadt_plan.js';

const bahn = strecke1();
const N = bahn.N;
const t0 = performance.now();
const plan = stadtPlan(bahn);
const dauer = performance.now() - t0;

const bereich = (name) => {
  const k = bahn.abschnitte.findIndex((a) => a.name === name);
  assert.ok(k >= 0, `Abschnitt ${name} fehlt`);
  return [Math.ceil(bahn.segStart[k] / bahn.ds), Math.floor((bahn.segStart[k] + bahn.abschnitte[k].len) / bahn.ds)];
};

test('Laufzeit < 2 s, Stadt ist dicht', () => {
  assert.ok(dauer < 2000, `stadtPlan dauerte ${dauer.toFixed(0)} ms`);
  assert.ok(plan.tuerme.length > 1500, `nur ${plan.tuerme.length} Türme`);
  assert.ok(plan.schilder.length > 60, `nur ${plan.schilder.length} Schilder`);
  for (const t of plan.tuerme) {
    assert.ok(t.h >= 60 && t.h <= 420, `Turmhöhe ${t.h}`);
    assert.ok(t.b > 0 && t.t > 0 && [t.x, t.z, t.b, t.t, t.h].every(Number.isFinite));
  }
  // dicht entlang der Strecke: in 300 m um jede 100. Stützstelle stehen Türme
  let leer = 0;
  for (let i = 0; i < N; i += 100) {
    if (!plan.tuerme.some((t) => Math.hypot(t.x - bahn.px[i], t.z - bahn.pz[i]) < 300)) leer++;
  }
  assert.ok(leer <= 2, `${leer} Strecken-Stellen ohne Türme in 300 m`);
});

test('kein Turm im Fahrkorridor (Abstand ≥ hw + 18 m oder ≥ 15 m unter der Bahn)', () => {
  const fehler = [];
  for (const t of plan.tuerme) {
    const hb = t.b / 2, ht = t.t / 2;
    for (let i = 0; i < N; i++) {
      const dx = Math.max(Math.abs(bahn.px[i] - t.x) - hb, 0), dz = Math.max(Math.abs(bahn.pz[i] - t.z) - ht, 0);
      const lim = bahn.hw[i] + 18;
      if (dx * dx + dz * dz < lim * lim && t.h > bahn.py[i] - 15) {
        fehler.push(`Turm (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) h ${t.h.toFixed(0)} bei Stützstelle ${i} (y ${bahn.py[i].toFixed(0)})`);
        break;
      }
    }
  }
  assert.equal(fehler.length, 0, fehler.slice(0, 5).join('\n'));
});

test('Häuserschlucht: hohe Türme auf beiden Seiten der Lücke', () => {
  const [a] = bereich('Häuserschlucht'), [, e] = bereich('Häuserschlucht Mitte');
  const m = (a + e) >> 1;
  const tx = bahn.tx[m], tz = bahn.tz[m], tl = Math.hypot(tx, tz);
  const seiten = { links: 0, rechts: 0 };
  for (const t of plan.tuerme) {
    if (t.art !== 'schlucht') continue;
    const rx = t.x - bahn.px[m], rz = t.z - bahn.pz[m];
    const laengs = (rx * tx + rz * tz) / tl, quer = (-rx * tz + rz * tx) / tl;
    if (Math.abs(laengs) > (e - a) * bahn.ds / 2 + 100 || Math.abs(quer) > 120) continue;
    if (t.h < bahn.py[m] + 80) continue;
    seiten[quer > 0 ? 'links' : 'rechts']++;
  }
  assert.ok(seiten.links >= 4 && seiten.rechts >= 4, JSON.stringify(seiten));
});

test('Fassaden-Turm direkt hinter der Wandfahrt (Gegenseite der Fahrflächen-Normale, Spalt 2–4 m)', () => {
  const F = plan.fassade;
  assert.ok(F, 'fassade fehlt');
  const [a, e] = F.lauf;
  assert.ok((e - a) * bahn.ds > 120, `Fassade nur ${(e - a) * bahn.ds} m lang`);
  for (let i = a; i <= e; i++) {
    const nH = Math.hypot(bahn.sux[i], bahn.suz[i]);
    assert.ok(nH > 0.95, `Fahrfläche bei ${i} nicht senkrecht`);
    const nx = bahn.sux[i] / nH, nz = bahn.suz[i] / nH;
    // Turmmitte liegt gegen die Normale
    assert.ok((F.x - bahn.px[i]) * nx + (F.z - bahn.pz[i]) * nz < -F.t / 2, `Turm auf der falschen Seite bei ${i}`);
    // Abstand Fahrfläche (Mittellinie) ↔ Vorderfläche
    const spalt = ((bahn.px[i] - F.x) * F.nx + (bahn.pz[i] - F.z) * F.nz) - F.t / 2;
    assert.ok(spalt >= 2 && spalt <= 4.5, `Spalt ${spalt.toFixed(2)} m bei ${i}`);
    // Längs innerhalb der Turmlänge
    const laengs = (bahn.px[i] - F.x) * F.ex + (bahn.pz[i] - F.z) * F.ez;
    assert.ok(Math.abs(laengs) <= F.b / 2 + 1);
  }
  assert.ok(F.h > F.yWand[1] + 40, 'Fassaden-Turm zu niedrig');
});

test('Brücken-Platte über der Überkopf-Passage (gegen die Fahrflächen-Normale)', () => {
  const B = plan.bruecke;
  assert.ok(B && B.stuecke.length >= 5, 'bruecke fehlt');
  const [a, e] = B.lauf;
  assert.ok((e - a) * bahn.ds > 300, `Brücke nur ${(e - a) * bahn.ds} m`);
  for (let i = a; i <= e; i++) assert.ok(bahn.suy[i] < -0.9, `Fahrfläche bei ${i} nicht kopfüber`);
  // jede Stützstelle liegt unter einem Stück, Unterkante über der Fahrfläche
  for (let i = a; i <= e; i++) {
    let ok = false;
    for (const s of B.stuecke) {
      const vx = s.bx - s.ax, vz = s.bz - s.az, l2 = vx * vx + vz * vz;
      const u = ((bahn.px[i] - s.ax) * vx + (bahn.pz[i] - s.az) * vz) / l2;
      if (u < -0.01 || u > 1.01) continue;
      const y = s.ay + (s.by - s.ay) * u;
      const kante = bahn.py[i] + bahn.hw[i] * Math.abs(bahn.sly[i]);   // höchste Kante der Fahrfläche
      if (y > kante && y < kante + 3) { ok = true; break; }
    }
    assert.ok(ok, `Stützstelle ${i} ohne Brücke darüber`);
  }
  assert.ok(B.pfeiler.length >= 2);
});

test('Fluss + Hafenbecken unter der Neon-Schlucht', () => {
  const F = plan.fluss;
  assert.ok(F && F.punkte.length > 10 && F.hafen, 'fluss fehlt');
  const [a] = bereich('Neon-Schlucht'), [, e] = bereich('Neon-Schlucht Mitte');
  // eine Lücken-Stützstelle liegt über dem Wasser
  let ueber = false;
  for (let i = a; i <= e && !ueber; i++) {
    for (let j = 0; j + 1 < F.punkte.length; j++) {
      const p = F.punkte[j], q = F.punkte[j + 1];
      const vx = q.x - p.x, vz = q.z - p.z, l2 = vx * vx + vz * vz;
      const u = Math.max(0, Math.min(1, ((bahn.px[i] - p.x) * vx + (bahn.pz[i] - p.z) * vz) / l2));
      if (Math.hypot(bahn.px[i] - p.x - vx * u, bahn.pz[i] - p.z - vz * u) < F.breite / 2) { ueber = true; break; }
    }
  }
  assert.ok(ueber, 'Neon-Schlucht kreuzt den Fluss nicht');
  // kein Turm im Wasser
  for (const t of plan.tuerme) {
    for (const p of F.punkte) assert.ok(Math.hypot(t.x - p.x, t.z - p.z) > F.breite / 2 - 1, 'Turm im Fluss');
  }
});

test('Neon-Schilder: eigene Schriftzüge, an Fassaden, zur Strecke hin', () => {
  for (const s of plan.schilder) {
    assert.ok(SCHILD_TEXTE.includes(s.text), s.text);
    assert.ok(Math.abs(Math.hypot(s.nx, s.nz) - 1) < 1e-9);
    assert.ok(Math.abs(s.b / s.h - schildAspekt(s.text)) < 1e-6);
    assert.ok(s.y - s.h / 2 > 0);
  }
  // die meisten zeigen zur nächsten Stützstelle
  let zur = 0;
  for (const s of plan.schilder) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < N; i += 2) {
      const d = (bahn.px[i] - s.x) ** 2 + (bahn.pz[i] - s.z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    if ((bahn.px[best] - s.x) * s.nx + (bahn.pz[best] - s.z) * s.nz > 0) zur++;
  }
  assert.ok(zur >= plan.schilder.length * 0.95, `${zur}/${plan.schilder.length} zur Strecke`);
  assert.ok(plan.schilder.some((s) => s.text === 'HYPERBAHN'));
});

test('deterministisch: gleicher Seed = gleiche Stadt, anderer Seed = andere', () => {
  const a = JSON.stringify(stadtPlan(bahn, { seed: 11 }));
  assert.equal(a, JSON.stringify(plan));
  assert.equal(a, JSON.stringify(stadtPlan(bahn, { seed: 11 })));
  assert.notEqual(a, JSON.stringify(stadtPlan(bahn, { seed: 12 })));
  const duenn = stadtPlan(bahn, { dichte: 0.5 });
  assert.ok(duenn.tuerme.length < plan.tuerme.length * 0.8);
});
