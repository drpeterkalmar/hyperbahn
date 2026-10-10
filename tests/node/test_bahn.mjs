// Strecken-Datenmodell + Spline-Generator: geschlossene Runde, stetige Übergänge, Pflicht-Passagen vorhanden,
// keine Selbstdurchdringung, Abfrage („Schwebe-Raycast“) liefert die Bahn-Koordinaten zurück.
// Aufruf: node --test tests/node/test_bahn.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { baueBahn, kruemmungen, rahmenBei, neueAbfrage, F_MAGNET, F_LUECKE, F_ROEHRE, F_SPRUNG, F_LANDEZONE } from '../../src/track/bahn.js';
import { strecke1, strecke1Abschnitte, SCHLUSS } from '../../src/track/strecke1.js';

const bahn = strecke1();
const N = bahn.N;
const ab = bahn.abschnitte;
const segNamen = (typ) => ab.map((a, k) => [a, k]).filter(([a]) => a.typ === typ);
const segBereich = (k) => {
  const s0 = bahn.segStart[k], s1 = s0 + ab[k].len;
  return [Math.round(s0 / bahn.ds), Math.min(N, Math.round(s1 / bahn.ds))];
};

test('Runde ist geschlossen (Rohfehler vor dem Verteilen < 1 m, < 0,1°)', () => {
  assert.ok(bahn.schluss.m < 1, `Lagefehler ${bahn.schluss.m.toFixed(2)} m`);
  assert.ok(bahn.schluss.grad < 0.1, `Rahmenfehler ${bahn.schluss.grad.toFixed(3)}°`);
  assert.ok(bahn.L > 9000 && bahn.L < 20000, `Länge ${bahn.L}`);
});

test('Rahmen orthonormal, Werte endlich', () => {
  for (let i = 0; i < N; i++) {
    const t = [bahn.tx[i], bahn.ty[i], bahn.tz[i]], u = [bahn.sux[i], bahn.suy[i], bahn.suz[i]], l = [bahn.slx[i], bahn.sly[i], bahn.slz[i]];
    const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    assert.ok(Math.abs(d(t, t) - 1) < 1e-6 && Math.abs(d(u, u) - 1) < 1e-6 && Math.abs(d(l, l) - 1) < 1e-6, `Länge bei ${i}`);
    assert.ok(Math.abs(d(t, u)) < 1e-6 && Math.abs(d(t, l)) < 1e-6 && Math.abs(d(u, l)) < 1e-6, `orthogonal bei ${i}`);
  }
});

test('Übergänge weich: Krümmung beschränkt und stetig, Querneigung stetig', () => {
  const k = kruemmungen(bahn);
  let maxK = 0, maxDK = 0, maxDB = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    const kk = Math.hypot(k.quer[i], k.laengs[i]);
    maxK = Math.max(maxK, kk);
    maxDK = Math.max(maxDK, Math.abs(k.quer[j] - k.quer[i]) + Math.abs(k.laengs[j] - k.laengs[i]));
    let db = Math.abs(bahn.bank[j] - bahn.bank[i]);
    if (j === 0) db = Math.abs(((bahn.bank[j] - bahn.bank[i]) % 360 + 540) % 360 - 180);
    maxDB = Math.max(maxDB, db);
  }
  // kleinster Radius ≥ 45 m (Looping), Krümmungssprung je 2 m < 0,002/m (kein Knick), Querneigung < 3° je 2 m
  assert.ok(maxK < 1 / 45, `max. Krümmung ${maxK.toFixed(4)} (Radius ${(1 / maxK).toFixed(0)} m)`);
  assert.ok(maxDK < 0.002, `Krümmungssprung ${maxDK.toFixed(5)}`);
  assert.ok(maxDB < 3, `Querneigungssprung ${maxDB.toFixed(2)}°`);
});

test('Pflicht-Passagen vorhanden', () => {
  // Großer Looping: Rahmen steht kopfüber (Rahmen-Oben zeigt nach unten), Magnet
  const [[, kl]] = segNamen('looping');
  let [i0, i1] = segBereich(kl), kopf = false;
  for (let i = i0; i < i1; i++) {
    if (bahn.uy[i] < -0.95) kopf = true;
    assert.ok(bahn.flags[i] & F_MAGNET, 'Looping ist Magnet-Abschnitt');
  }
  assert.ok(kopf, 'Looping erreicht Überkopf');
  // Korkenzieher-Röhre: Querneigung 0 → 360°, Röhre
  const [[, kk]] = segNamen('korkenzieher');
  [i0, i1] = segBereich(kk);
  assert.ok(Math.abs(bahn.bank[i1 - 1] - bahn.bank[i0] - 360) < 1 && bahn.flags[i0 + 5] & F_ROEHRE);
  // Überkopf: ≥ 500 m mit Fahrfläche nach unten (Fahrflächen-Oben y < −0,9)
  const [[, ku]] = segNamen('ueberkopf');
  [i0, i1] = segBereich(ku);
  let n = 0; for (let i = i0; i < i1; i++) if (bahn.suy[i] < -0.9) n++;
  assert.ok(n * bahn.ds >= 500, `Überkopf ${n * bahn.ds} m`);
  // Wandfahrt: ≥ 250 m mit ~90° (Fahrflächen-Oben waagrecht)
  const [[, kw]] = segNamen('wandfahrt');
  [i0, i1] = segBereich(kw);
  n = 0; for (let i = i0; i < i1; i++) if (Math.abs(bahn.suy[i]) < 0.1) n++;
  assert.ok(n * bahn.ds >= 250, `Wandfahrt ${n * bahn.ds} m`);
  // Möbius-Twist: erreicht 180° und kehrt auf 0° zurück
  const [[, kt]] = segNamen('twist');
  [i0, i1] = segBereich(kt);
  let mx = 0; for (let i = i0; i < i1; i++) mx = Math.max(mx, bahn.bank[i] - bahn.bank[i0]);
  assert.ok(mx > 179 && Math.abs(bahn.bank[i1 - 1] - bahn.bank[i0]) < 1, `Twist max ${mx}`);
  // Zwei Riesensprünge mit ≥ 400 m Lücke, davor jeweils eine Boost-Pad-Kette (≥ 3 Pads in 600 m vor dem Absprung)
  const spr = segNamen('sprung');
  assert.ok(spr.length >= 2);
  for (const [a, k] of spr) {
    // Lücke = zusammenhängende Abschnitte mit luecke (Sprung + Sprung-Mitte)
    let lk = 0, kk = k; while (ab[kk].luecke) { lk += ab[kk].len; kk++; }
    assert.ok(lk >= 400 && a.luecke, `${a.name}: Lücke ${lk} m`);
    const s0 = bahn.segStart[k - 1];   // Absprung-Rampe
    assert.equal(ab[k - 1].absprung, true);
    const pads = bahn.pads.filter((p) => p.s0 < s0 && p.s0 > s0 - 600);
    assert.ok(pads.length >= 3, `${a.name}: ${pads.length} Pads in der Kette`);
    assert.ok(ab[kk].landezone && ab[kk].breite >= 18, 'breite Landezone');
    const ringe = bahn.ringe.filter((r) => r.s >= bahn.segStart[k] && r.s <= bahn.segStart[kk]);
    assert.ok(ringe.length >= 2, 'Boost-Ringe in der Luft');
  }
  // Steilkurve ≥ 45°, Tunnel
  assert.ok(ab.some((a) => a.typ === 'kurve' && Math.max(...[].concat(a.bank)) >= 45));
  assert.ok(ab.some((a) => a.typ === 'tunnel' && a.roehre));
});

test('Steile/überkopf Fahrfläche nur in Magnet-Abschnitten (außer Sprung-Lücken)', () => {
  for (let i = 0; i < N; i++) {
    if (bahn.suy[i] < 0.3 && !(bahn.flags[i] & F_LUECKE)) assert.ok(bahn.flags[i] & F_MAGNET, `i=${i} s=${i * bahn.ds} suy=${bahn.suy[i].toFixed(2)} ohne Magnet`);
  }
});

test('Keine Selbstdurchdringung (Mittellinien-Abstand > Summe der Halbbreiten + 3 m)', () => {
  // Grobe Gitter-Suche: Zellen à 40 m
  const Z = 40, gitter = new Map();
  const key = (x, y, z) => `${Math.floor(x / Z)},${Math.floor(y / Z)},${Math.floor(z / Z)}`;
  for (let i = 0; i < N; i += 2) {
    const k = key(bahn.px[i], bahn.py[i], bahn.pz[i]);
    if (!gitter.has(k)) gitter.set(k, []);
    gitter.get(k).push(i);
  }
  let schlimmst = Infinity, wo = null;
  for (let i = 0; i < N; i += 2) {
    const cx = Math.floor(bahn.px[i] / Z), cy = Math.floor(bahn.py[i] / Z), cz = Math.floor(bahn.pz[i] / Z);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      for (const j of gitter.get(`${cx + a},${cy + b},${cz + c}`) || []) {
        let dsBogen = Math.abs(i - j) * bahn.ds; dsBogen = Math.min(dsBogen, bahn.L - dsBogen);
        if (dsBogen < 150) continue;
        const d = Math.hypot(bahn.px[i] - bahn.px[j], bahn.py[i] - bahn.py[j], bahn.pz[i] - bahn.pz[j]);
        const rest = d - (bahn.hw[i] + bahn.hw[j] + 3);
        if (rest < schlimmst) { schlimmst = rest; wo = [i * bahn.ds, j * bahn.ds, d]; }
      }
    }
  }
  assert.ok(schlimmst > 0, `zu nah: s=${wo && wo[0]} / s=${wo && wo[1]}, Abstand ${wo && wo[2].toFixed(1)} m`);
});

test('Abfrage findet (s, u, h) zurück – auch im Looping, kopfüber und an der Wand', () => {
  const q = neueAbfrage(), p = { x: 0, y: 0, z: 0 };
  let maxFs = 0, maxFu = 0, maxFh = 0;
  for (let i = 0; i < N; i += 7) {
    const s = i * bahn.ds + 0.7, u = ((i * 37) % 21) - 10, h = 0.4 + ((i * 13) % 50) / 10;
    bahn.punkt(s, u, h, p);
    bahn.abfrage(p, i + 3, q);
    assert.ok(q.ok, `ok bei s=${s}`);
    let fs = Math.abs(q.s - s); fs = Math.min(fs, bahn.L - fs);
    maxFs = Math.max(maxFs, fs); maxFu = Math.max(maxFu, Math.abs(q.u - u)); maxFh = Math.max(maxFh, Math.abs(q.h - h));
  }
  // Querebenen-Projektion auf einer gekrümmten Bahn: wenige cm Abweichung bei 10 m Querversatz im Looping-Radius
  assert.ok(maxFs < 0.6 && maxFu < 0.3 && maxFh < 0.3, `Fehler s ${maxFs.toFixed(3)} u ${maxFu.toFixed(3)} h ${maxFh.toFixed(3)}`);
});

test('Generator deterministisch und Schließ-Parameter wirken', () => {
  const b2 = strecke1();
  assert.equal(b2.N, N);
  for (let i = 0; i < N; i += 97) assert.equal(b2.px[i], bahn.px[i]);
  const schief = baueBahn(strecke1Abschnitte({ ...SCHLUSS, a: SCHLUSS.a + 50 }));
  assert.ok(schief.schluss.m > 40, 'Schließfehler reagiert auf Parameter');
  const r = rahmenBei(bahn, 0);
  assert.ok(Math.abs(r.Us.y - 1) < 1e-3, 'Start waagrecht');
  void F_SPRUNG; void F_LANDEZONE;
});
