// Strecken-Datenmodell + Spline-Generator (rein, ohne three.js; läuft im Browser und in Node-Tests).
//
// Eine Strecke ist eine Liste von Abschnitten („Schildkröten-Grafik“ im Raum): Jeder Abschnitt dreht den Bahn-Rahmen
// (vor, links, oben) mit einer Fensterfunktion um eine im Rahmen feste Achse. Weil die Achse im Rahmen fest ist, ist die
// Gesamtdrehung exakt (Looping 360° = Rahmen am Ausgang wie am Eingang) und Krümmung/Torsion laufen stetig von 0 hoch und
// wieder auf 0 (keine Knicke, Peter: „Übergänge weich“). Dazu kommt die Querneigung `bank` als eigenes, stetig
// interpoliertes Feld (Steilkurve, Wandfahrt 90°, Überkopf 180°, Twist, Korkenzieher 360°): die Fahrfläche ist der um
// `bank` um die Fahrtrichtung gedrehte Rahmen.
//
// Abschnitt (alle Winkel in Grad, Längen in Metern):
//   { typ, len, gier (+ = links), nick (+ = hoch), roll (Rahmen-Rolle, für versetzte Loopings), bank: Zahl | [Stützwerte],
//     rampe (Übergangslänge der Drehrate), breite (Halbbreite), magnet, roehre, luecke (keine Fahrbahn: Sprung),
//     pads: [{ at, u, b, l }], ringe: [{ at, h, r }], name,
//     P2 (Strecken): offen ('l' | 'r' | true: keine Bande auf der Seite – wer über die Kante fährt, stürzt ab),
//     teiler ({ u: Zahl | [Stützwerte], b, an, schnell }: Mittel-Wand einer Gabelung bei Querversatz u, Halbbreite b, auf den
//     ersten/letzten `an` m spitz zulaufend; schnell = +1/−1 Seite des schnelleren, riskanteren Wegs),
//     schwere (Faktor auf die Schwerkraft im Abschnitt, z. B. 0,25 = schwache Schwerkraft-Zone) }
//   bank: Zahl b → am Abschnittsende b; Array [b1…bn] → gleichmäßig verteilte Stützstellen (Start = vorheriger Wert).
//   Positive Querneigung kippt die Fahrfläche nach links (Innenseite einer Linkskurve tiefer).
//
// Ergebnis `baueBahn(abschnitte)` → Bahn mit gleichmäßigen Stützstellen (ds = 2 m), geschlossen (Rest-Schließfehler wird
// unmerklich über die Länge verteilt und in `schluss` berichtet), und `abfrage(p, hint, out)` = Schwebe-Raycast entlang
// der lokalen Bahn-Normale: liefert Bogenlänge s, Querversatz u, Höhe h über der Fahrfläche und den Rahmen dort.
import { v3, setze, kreuz, norm, dreheRahmen, orthoRahmen, drehe } from '../core/vec.js';
import { clamp, smootherstep } from '../core/util.js';

export const DS = 2;              // m Abstand der Stützstellen
const DS_INT = 0.5;               // m Integrationsschritt
export const BREITE_STD = 13;     // m Halbbreite (26 m Fahrbahn für 8 Gleiter)
export const F_MAGNET = 1, F_LUECKE = 2, F_ROEHRE = 4, F_PAD = 8, F_LANDEZONE = 16, F_SPRUNG = 32, F_BOX = 64;
// P2: offene Kante links/rechts (keine Bande), Gabelungs-Teiler, schwache Schwerkraft (flags sind 16 bit)
export const F_OFFEN_L = 128, F_TEILER = 256, F_SCHWACH = 512, F_OFFEN_R = 1024;
const RAD = Math.PI / 180;

// Fensterfunktion: Rampe hoch (smootherstep), Plateau, Rampe runter. Integral über [0, len] = len − r.
function fenster(s, len, r) {
  if (r <= 0) return 1;
  if (s < r) return smootherstep(s / r);
  if (s > len - r) return smootherstep((len - s) / r);
  return 1;
}

export function baueBahn(abschnitte, opt = {}) {
  const start = opt.start || { p: v3(0, 60, 0), vor: v3(0, 0, -1), links: v3(-1, 0, 0) };
  // Gesamtlänge, Stützstellen-Anzahl
  let L = 0;
  for (const a of abschnitte) L += a.len;
  const N = Math.round(L / DS);
  const proRec = Math.round(DS / DS_INT);   // Integrationsschritte je Stützstelle
  const nInt = N * proRec;
  const dsI = L / nInt;            // tatsächlicher Integrationsschritt (L exakt getroffen)
  const ds = L / N;

  const b = neueBahnFelder(N);
  b.L = L; b.N = N; b.ds = ds; b.abschnitte = abschnitte;

  // Abschnitts-Anfänge
  const seg0 = []; let acc = 0;
  for (const a of abschnitte) { seg0.push(acc); acc += a.len; }
  b.segStart = seg0;

  // Querneigungs-Stützstellen (s, Grad)
  // Jeder Abschnitt mit `bank` beginnt mit dem bisherigen Wert (sonst finge die Drehung schon im Vorgänger an)
  const bk = [{ s: 0, w: opt.bank0 || 0 }];
  abschnitte.forEach((a, k) => {
    if (a.bank == null) return;
    const arr = Array.isArray(a.bank) ? a.bank : [a.bank];
    const vorher = bk[bk.length - 1].w;
    if (seg0[k] > bk[bk.length - 1].s) bk.push({ s: seg0[k], w: vorher });
    // nach vollen Umdrehungen (Korkenzieher 360°) gelten die Stützwerte relativ zur erreichten Umdrehung
    const umlauf = 360 * Math.round(vorher / 360);
    arr.forEach((w, j) => bk.push({ s: seg0[k] + a.len * (j + 1) / arr.length, w: w + umlauf }));
  });
  const bankBei = (s) => {
    if (s <= bk[0].s) return bk[0].w;
    for (let j = 1; j < bk.length; j++) {
      if (s <= bk[j].s) {
        const a = bk[j - 1], c = bk[j];
        return a.w + (c.w - a.w) * smootherstep((s - a.s) / Math.max(1e-6, c.s - a.s));
      }
    }
    return bk[bk.length - 1].w;
  };
  // Halbbreite: weich über 40 m zwischen Abschnitten
  const breiteBei = (s) => {
    const k = segIndex(seg0, s);
    const a = abschnitte[k], hw = a.breite || BREITE_STD;
    const ds0 = s - seg0[k];
    if (k > 0 && ds0 < 20) {
      const hp = abschnitte[k - 1].breite || BREITE_STD;
      return hp + (hw - hp) * smootherstep(0.5 + ds0 / 40);
    }
    if (k < abschnitte.length - 1 && a.len - ds0 < 20) {
      const hn = abschnitte[k + 1].breite || BREITE_STD;
      return hw + (hn - hw) * smootherstep(0.5 - (a.len - ds0) / 40);
    }
    return hw;
  };

  // Integration
  const P = v3(start.p.x, start.p.y, start.p.z);
  const T = norm(v3(), start.vor), Lf = norm(v3(), start.links), U = v3();
  orthoRahmen(T, Lf, U);
  const T0 = { ...T }, L0 = { ...Lf }, U0 = { ...U }, P0 = { ...P };
  let seg = 0, s = 0;
  const raten = abschnitte.map((a) => {
    const r = a.rampe != null ? Math.min(a.rampe, a.len / 2) : Math.min(a.len / 3, 120);
    const norm0 = a.len - r;   // Fensterintegral
    return {
      r,
      roll: ((a.roll || 0) * RAD) / norm0,
      nick: ((a.nick || 0) * RAD) / norm0,
      gier: ((a.gier || 0) * RAD) / norm0,
    };
  });
  const schreib = (i) => {
    b.px[i] = P.x; b.py[i] = P.y; b.pz[i] = P.z;
    b.tx[i] = T.x; b.ty[i] = T.y; b.tz[i] = T.z;
    b.lx[i] = Lf.x; b.ly[i] = Lf.y; b.lz[i] = Lf.z;
    b.ux[i] = U.x; b.uy[i] = U.y; b.uz[i] = U.z;
  };
  schreib(0);
  for (let k = 1; k <= nInt; k++) {
    // Mittelpunkt-Regel: halbe Drehung, Schritt, halbe Drehung
    const sm = s + dsI / 2;
    while (seg < abschnitte.length - 1 && sm >= seg0[seg] + abschnitte[seg].len) seg++;
    const a = abschnitte[seg], rt = raten[seg];
    const w = fenster(sm - seg0[seg], a.len, rt.r);
    // Körper-Drehrate (vor, links, oben): Rolle um vor, Nicken (hoch) = negative Drehung um links, Gieren um oben
    const cr = rt.roll * w * dsI / 2, cp = -rt.nick * w * dsI / 2, cy = rt.gier * w * dsI / 2;
    dreheRahmen(T, Lf, U, T.x * cr + Lf.x * cp + U.x * cy, T.y * cr + Lf.y * cp + U.y * cy, T.z * cr + Lf.z * cp + U.z * cy);
    P.x += T.x * dsI; P.y += T.y * dsI; P.z += T.z * dsI;
    dreheRahmen(T, Lf, U, T.x * cr + Lf.x * cp + U.x * cy, T.y * cr + Lf.y * cp + U.y * cy, T.z * cr + Lf.z * cp + U.z * cy);
    s += dsI;
    if (k % proRec === 0) schreib(k / proRec);
  }
  // Schließfehler (Index N = Index 0)
  const dP = v3(P0.x - P.x, P0.y - P.y, P0.z - P.z);
  const winkel = rahmenWinkel(T, Lf, U, T0, L0, U0);
  b.schluss = { m: Math.hypot(dP.x, dP.y, dP.z), grad: winkel.w / RAD };
  // Verteilen: Lage linear, Rahmen über Achse/Winkel anteilig
  for (let i = 1; i < N && !opt.ohneSchluss; i++) {
    const t = i / N;
    b.px[i] += dP.x * t; b.py[i] += dP.y * t; b.pz[i] += dP.z * t;
    if (winkel.w > 1e-9) {
      for (const [x, y, z] of [['tx', 'ty', 'tz'], ['lx', 'ly', 'lz'], ['ux', 'uy', 'uz']]) {
        const v = drehe(_a, setze(_a, b[x][i], b[y][i], b[z][i]), winkel.achse, winkel.w * t);
        b[x][i] = v.x; b[y][i] = v.y; b[z][i] = v.z;
      }
    }
  }

  // Fahrfläche, Breite, Flags
  for (let i = 0; i < N; i++) {
    const si = i * ds;
    const k = segIndex(seg0, si);
    const a = abschnitte[k];
    const bank = bankBei(si);
    b.bank[i] = bank;
    const c = Math.cos(bank * RAD), sn = Math.sin(bank * RAD);
    // Fahrflächen-Oben = cos·oben + sin·links; Fahrflächen-Links = cos·links − sin·oben
    b.sux[i] = c * b.ux[i] + sn * b.lx[i]; b.suy[i] = c * b.uy[i] + sn * b.ly[i]; b.suz[i] = c * b.uz[i] + sn * b.lz[i];
    b.slx[i] = c * b.lx[i] - sn * b.ux[i]; b.sly[i] = c * b.ly[i] - sn * b.uy[i]; b.slz[i] = c * b.lz[i] - sn * b.uz[i];
    b.hw[i] = breiteBei(si);
    b.seg[i] = k;
    let f = 0;
    if (a.magnet) f |= F_MAGNET;
    if (a.luecke) f |= F_LUECKE;
    if (a.roehre) f |= F_ROEHRE;
    if (a.landezone) f |= F_LANDEZONE;
    if (a.absprung) f |= F_SPRUNG;
    if (a.offen === 'l' || a.offen === true) f |= F_OFFEN_L;
    if (a.offen === 'r' || a.offen === true) f |= F_OFFEN_R;
    if (a.schwere != null && a.schwere !== 1) { f |= F_SCHWACH; b.schwere[i] = a.schwere; }
    // Gabelungs-Teiler: Mittel-Wand, Querversatz über Stützwerte (weich), Spitze vorn und hinten
    const t = a.teiler;
    if (t) {
      const ds0 = si - seg0[k], x = ds0 / a.len;
      const arr = Array.isArray(t.u) ? t.u : [t.u || 0];
      let tu = arr[0];
      if (arr.length > 1) {
        const y = x * (arr.length - 1), j = Math.min(arr.length - 2, Math.floor(y));
        tu = arr[j] + (arr[j + 1] - arr[j]) * smootherstep(y - j);
      }
      const an = t.an ?? 40, tb = (t.b ?? 1.2) * Math.min(1, ds0 / an, (a.len - ds0) / an);
      if (tb > 0.05) { f |= F_TEILER; b.tu[i] = tu; b.tb[i] = tb; b.tschnell[i] = t.schnell || 0; }
    }
    b.flags[i] = f;
  }
  // Pads und Ringe in Bahn-Koordinaten
  b.pads = []; b.ringe = [];
  abschnitte.forEach((a, k) => {
    for (const p of a.pads || []) {
      const s0 = seg0[k] + p.at;
      b.pads.push({ s0, s1: s0 + (p.l || 10), u: p.u || 0, b: p.b || 3.5 });
    }
    for (const r of a.ringe || []) b.ringe.push({ s: seg0[k] + r.at, h: r.h || 8, r: r.r || 9 });
  });
  for (const p of b.pads) {
    for (let i = Math.floor(p.s0 / ds); i <= Math.ceil(p.s1 / ds); i++) b.flags[((i % N) + N) % N] |= F_PAD;
  }
  b.pads.sort((x, y) => x.s0 - y.s0);
  // Boxengasse (P1b): Lade-Spur auf der Fahrfläche { at, len, u, b } – höchstens eine je Strecke
  b.box = null;
  abschnitte.forEach((a, k) => { if (a.box) b.box = { s0: seg0[k] + a.box.at, s1: seg0[k] + a.box.at + a.box.len, u: a.box.u, b: a.box.b }; });
  if (b.box) for (let i = Math.floor(b.box.s0 / ds); i <= Math.ceil(b.box.s1 / ds); i++) b.flags[((i % N) + N) % N] |= F_BOX;
  b.abfrage = (p, hint, out) => abfrage(b, p, hint, out);
  b.suche = (p) => sucheGlobal(b, p);
  b.punkt = (s, u, h, out) => punktBei(b, s, u, h, out);
  return b;
}

const _a = v3();
function segIndex(seg0, s) {
  let lo = 0, hi = seg0.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (seg0[m] <= s) lo = m; else hi = m - 1; }
  return lo;
}

function neueBahnFelder(N) {
  const f = () => new Float64Array(N);
  return {
    px: f(), py: f(), pz: f(), tx: f(), ty: f(), tz: f(), lx: f(), ly: f(), lz: f(), ux: f(), uy: f(), uz: f(),
    sux: f(), suy: f(), suz: f(), slx: f(), sly: f(), slz: f(), hw: f(), bank: f(),
    flags: new Uint16Array(N), seg: new Uint16Array(N),
    schwere: new Float32Array(N).fill(1), tu: new Float32Array(N), tb: new Float32Array(N), tschnell: new Int8Array(N),
  };
}

// Drehung, die Rahmen (T,L,U) auf (T0,L0,U0) bringt, als Achse/Winkel (Welt)
function rahmenWinkel(T, L, U, T0, L0, U0) {
  // R = M0 · Mᵀ, M = [T L U] als Spalten
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const A = [T0, L0, U0], B = [T, L, U], k = ['x', 'y', 'z'];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    let v = 0;
    for (let j = 0; j < 3; j++) v += A[j][k[r]] * B[j][k[c]];
    R[r][c] = v;
  }
  const cw = clamp((R[0][0] + R[1][1] + R[2][2] - 1) / 2, -1, 1);
  const w = Math.acos(cw);
  if (w < 1e-9) return { w: 0, achse: v3(1, 0, 0) };
  const achse = norm(v3(), v3(R[2][1] - R[1][2], R[0][2] - R[2][0], R[1][0] - R[0][1]));
  return { w, achse };
}

// --- Abfrage („Schwebe-Raycast entlang der Bahn-Normale“) ---
// Sucht von `hint` (Stützstellen-Index, Kommazahl erlaubt) aus die Querebene durch p: f(i) = (p − P_i)·T_i wechselt das
// Vorzeichen zwischen i und i+1. Lokal, daher eindeutig auch dort, wo sich die Bahn nahe kommt (Looping-Ein-/Ausgang,
// Überkopf unter einer Brücke). W = größter Suchweg in Stützstellen.
const W = 80;
export function neueAbfrage() {
  return {
    ok: false, i: 0, s: 0, u: 0, h: 0, hw: BREITE_STD, flags: 0, bank: 0, tu: 0, tb: 0, schwere: 1,
    P: v3(), T: v3(), Us: v3(), Ls: v3(), U: v3(),
  };
}
function fwert(b, i, p) {
  return (p.x - b.px[i]) * b.tx[i] + (p.y - b.py[i]) * b.ty[i] + (p.z - b.pz[i]) * b.tz[i];
}
export function abfrage(b, p, hint, out) {
  const N = b.N;
  let i = ((Math.floor(hint) % N) + N) % N;
  let fi = fwert(b, i, p), n = 0;
  if (fi < 0) {
    while (fi < 0 && n < W) { i = (i - 1 + N) % N; fi = fwert(b, i, p); n++; }
  } else {
    let j = (i + 1) % N, fj = fwert(b, j, p);
    while (fj >= 0 && n < W) { i = j; fi = fj; j = (j + 1) % N; fj = fwert(b, j, p); n++; }
  }
  if (n >= W) { out.ok = false; return out; }
  const j = (i + 1) % N;
  const fj = fwert(b, j, p);
  const t = fi - fj > 1e-12 ? clamp(fi / (fi - fj), 0, 1) : 0;
  interp(b, i, j, t, out);
  out.i = i + t; out.s = (i + t) * b.ds;
  const dx = p.x - out.P.x, dy = p.y - out.P.y, dz = p.z - out.P.z;
  out.u = dx * out.Ls.x + dy * out.Ls.y + dz * out.Ls.z;
  out.h = dx * out.Us.x + dy * out.Us.y + dz * out.Us.z;
  out.ok = Math.abs(out.u) < 600 && Math.abs(out.h) < 600;
  return out;
}
function interp(b, i, j, t, out) {
  const m = (a) => a[i] + (a[j] - a[i]) * t;
  setze(out.P, m(b.px), m(b.py), m(b.pz));
  norm(out.T, setze(out.T, m(b.tx), m(b.ty), m(b.tz)));
  norm(out.Us, setze(out.Us, m(b.sux), m(b.suy), m(b.suz)));
  norm(out.U, setze(out.U, m(b.ux), m(b.uy), m(b.uz)));
  // Ls = Us × T (rechtshändig: vor × links = oben ⇒ links = oben × vor)
  kreuz(out.Ls, out.Us, out.T); norm(out.Ls, out.Ls);
  out.hw = m(b.hw);
  out.bank = b.bank[i] + (b.bank[j] - b.bank[i]) * t;
  out.flags = t < 0.5 ? b.flags[i] : b.flags[j];
  // Teiler (P2): Lage/Halbbreite an der näheren Stützstelle (0 = keiner)
  const k = t < 0.5 ? i : j;
  out.tu = b.tu[k]; out.tb = b.tb[k]; out.schwere = b.schwere[k];
}
// Globale Suche (Start, Respawn ohne Vorwissen): nächste Stützstelle, dann lokal verfeinern
export function sucheGlobal(b, p) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < b.N; i++) {
    const d = (p.x - b.px[i]) ** 2 + (p.y - b.py[i]) ** 2 + (p.z - b.pz[i]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
// Weltpunkt zu Bahn-Koordinaten (s, u, h)
export function punktBei(b, s, u, h, out = v3()) {
  const N = b.N;
  const x = (((s / b.ds) % N) + N) % N;
  const i = Math.floor(x), j = (i + 1) % N, t = x - i;
  const q = _q; interp(b, i, j, t, q);
  out.x = q.P.x + q.Ls.x * u + q.Us.x * h;
  out.y = q.P.y + q.Ls.y * u + q.Us.y * h;
  out.z = q.P.z + q.Ls.z * u + q.Us.z * h;
  return out;
}
const _q = neueAbfrage();
// Rahmen bei s (für Startaufstellung, Kamera, Mesh-Bau)
export function rahmenBei(b, s, out = neueAbfrage()) {
  const N = b.N;
  const x = (((s / b.ds) % N) + N) % N;
  const i = Math.floor(x), j = (i + 1) % N;
  interp(b, i, j, x - i, out);
  out.i = x; out.s = x * b.ds; out.u = 0; out.h = 0; out.ok = true;
  return out;
}

// Krümmungen je Stützstelle in der Fahrfläche: quer (Kurve, + = links) und längs (Kuppe < 0, Senke > 0), 1/m.
// Für KI-Tempoplan und Tests (Stetigkeit).
export function kruemmungen(b) {
  const N = b.N, quer = new Float64Array(N), laengs = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, c = (i + 1) % N;
    const dx = (b.tx[c] - b.tx[a]) / (2 * b.ds), dy = (b.ty[c] - b.ty[a]) / (2 * b.ds), dz = (b.tz[c] - b.tz[a]) / (2 * b.ds);
    quer[i] = dx * b.slx[i] + dy * b.sly[i] + dz * b.slz[i];
    laengs[i] = dx * b.sux[i] + dy * b.suy[i] + dz * b.suz[i];
  }
  return { quer, laengs };
}

// In der Boxengasse (s, u)?
export function inBox(b, s, u) {
  const x = b.box;
  return !!x && s >= x.s0 && s <= x.s1 && Math.abs(u - x.u) <= x.b;
}

// Ist (s, u) auf einem Boost-Pad? Liefert Pad-Index oder −1. Pads sind nach s0 sortiert.
export function padBei(b, s, u) {
  for (let k = 0; k < b.pads.length; k++) {
    const p = b.pads[k];
    if (s >= p.s0 && s <= p.s1 && Math.abs(u - p.u) <= p.b) return k;
    if (p.s0 > s) break;
  }
  return -1;
}

// Spur-Grenzen bei (Stützstelle i, Querversatz u): Bahnkanten, an einer Gabelung nur die Seite des Teilers, auf der u liegt
// (seite > 0 = links vom Teiler, < 0 = rechts; 0 = aus u). Rückgabe [lo, hi] mit Abstand `rand` zu Kante/Teiler.
export function spurGrenzen(b, i, u, rand = 0, seite = 0, out = [0, 0]) {
  const hw = b.hw[i];
  out[0] = -hw + rand; out[1] = hw - rand;
  if (b.flags[i] & F_TEILER) {
    const sg = seite || (u >= b.tu[i] ? 1 : -1);
    if (sg > 0) out[0] = Math.max(out[0], b.tu[i] + b.tb[i] + rand);
    else out[1] = Math.min(out[1], b.tu[i] - b.tb[i] - rand);
    if (out[0] > out[1]) out[0] = out[1] = (out[0] + out[1]) / 2;
  }
  return out;
}

// Boost-Pad-Kette: n Pads ab at0 im Abstand `abstand` (m), Querversatz u, Halbbreite b, Länge l
export function kette(n, at0, abstand, u = 0, b = 4, l = 12) {
  return Array.from({ length: n }, (_, k) => ({ at: at0 + k * abstand, u, b, l }));
}
