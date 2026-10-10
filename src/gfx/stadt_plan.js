// Stadt-Plan „Neon-Megastadt“ (rein, ohne three.js; läuft im Browser und in Node-Tests).
//
// Liefert nur Daten – Türme, Neon-Schilder und Sonderbauten –, gezeichnet wird in stadt.js.
//   stadtPlan(bahn, { seed, dichte }) → { tuerme, schilder, bruecke, fassade, fluss }
//
// Regeln:
//  • Wolkenkratzer stehen in einem Block-Raster (Turm + Straße), dicht entlang der Strecke, nach außen lichter.
//  • Fahrkorridor: Grundriss-Abstand (Rechteck des Turms) zu jeder Bahn-Stützstelle ≥ hw + 18 m – außer der Turm ist
//    mindestens 15 m niedriger als die Bahn dort (dann steht er darunter, die Bahn fährt über die Dächer). Beim Bau wird
//    strenger gerechnet: Unterkante der gekippten Fahrfläche (hw·|Links.y|), kopfüber 4 m für den hängenden Gleiter, unter
//    Sprung-Lücken gar kein Turm (langsame Gleiter fallen tiefer als die Mittellinie).
//  • Türme sind achsparallel: b = Ausdehnung in x, t = Ausdehnung in z, Fuß auf y = 0, Höhe h.
//  • Sonderbauten: hohe Türme an beiden Seiten der Häuserschlucht (Schlucht-Gefühl) und der Neon-Schlucht, ein großer
//    Fassaden-Turm direkt hinter der Wandfahrt (Fahrfläche zeigt vom Turm weg, Spalt ~3 m), eine Brücken-Platte über der
//    Überkopf-Passage (gegen die Fahrflächen-Normale = über der kopfüber hängenden Fahrbahn), Fluss + Hafenbecken unter
//    der Neon-Schlucht.
//  • Neon-Schilder mit eigenen Fantasie-Schriftzügen an Turmfassaden, zur Strecke hin, möglichst auf Bahnhöhe.
// Alle Werte sind Startwerte – TODO Heavy-Job: am Bild abstimmen.
import { rng, clamp, lerp } from '../core/util.js';
import { F_LUECKE } from '../track/bahn.js';

export const STADT = {
  raster: 46,            // m Block (Turm + Straße)
  strasse: [9, 16],      // m Straßenbreite (Zufall)
  nah: 260,              // m bis hierhin volle Dichte
  rand: 780,             // m danach nur noch Fern-Dichte
  pNah: 0.92, pRand: 0.42, pFern: 0.16,
  ueberRand: 700,        // m Stadtfläche über die Strecken-Grenzen hinaus
  korridor: 18,          // m Mindestabstand Turm ↔ Fahrbahnkante (Regel: hw + 18)
  unterBahn: 15,         // m so viel niedriger als die Bahn darf ein Turm im Korridor stehen
  sicherheit: 2,         // m Zuschlag beim Bau (Test prüft ohne)
  hMin: 60, hMax: 420,
  fernHMax: 260,         // m Türme weit draußen (Silhouette)
  stufeAnteil: 0.18,     // Anteil Türme mit schlankerem Aufsatz (Rücksprung)
  schlucht: { abstand: 4, hoehe: [280, 420], breite: [34, 56], luecke: 8, vor: 60, nach: 90 },
  fassade: { spalt: 3, tiefe: 52, ueber: 120, minBank: 0.18 },
  bruecke: { stueck: 8, dicke: 5, ueberHw: 26, pfeilerAbstand: 15, pfeilerB: 7, minKopf: 0.95 },
  fluss: { breite: 150, halbLaenge: 3600, maeander: 140, hafen: { b: 280, t: 170, versatz: -190 } },
  schild: { pTurm: 0.34, pSchlucht: 0.95, hoehe: [5, 13], hoeheGross: [10, 22], maxAbstand: 300 },
};

// Eigene Fantasie-Schriftzüge (keine echten Marken)
export const SCHILD_TEXTE = ['KYROTEK', 'NEONOVA', 'VOLTARA', 'SHIBO-9', 'HYPERBAHN', 'ZENKAI', 'LUMEN//', 'OKTAVA',
  'MIRAGO', 'TAKU-DEN', 'QUASARA', 'ORBITEK', 'KAIJU-7', 'RYU//NET'];
// Neon-Farben (sRGB-Hex): Cyan, Magenta, Violett, Pink, Bernstein, Giftgrün, Rot, Blau
export const NEON_FARBEN = [0x00f0ff, 0xff2bd6, 0x9d4dff, 0xff3c7d, 0xffb000, 0x7dff3a, 0xff2a2a, 0x2a7dff];
// Turm-Körper: fast schwarz, kühl bis violett
export const TURM_FARBEN = [0x0b0e16, 0x10131d, 0x0e1420, 0x141824, 0x18141f, 0x0c1117, 0x121019];
export const TURM_ARTEN = ['glas', 'beton', 'band', 'schlucht'];

// Seitenverhältnis b/h eines Schilds (Schrift ~0,62 h je Zeichen + Rand) – stadt.js zeichnet die Schrift genau so breit
export function schildAspekt(text) { return 0.62 * text.length + 0.9; }

export function stadtPlan(bahn, { seed = 11, dichte = 1 } = {}) {
  const r = rng(seed);
  const ix = bahnIndex(bahn);
  const tuerme = [], schilder = [], sperr = [];
  const kontext = { bahn, ix, r, tuerme, schilder, sperr, fluss: null };

  // Sonderbauten zuerst (sperren Flächen für das Raster)
  const fassade = baueFassade(kontext);
  const bruecke = baueBruecke(kontext);
  const fluss = baueFluss(kontext);
  kontext.fluss = fluss;
  schluchtTuerme(kontext, 'Häuserschlucht', 'Häuserschlucht Mitte');
  schluchtTuerme(kontext, 'Neon-Schlucht', 'Neon-Schlucht Mitte');

  rasterTuerme(kontext, dichte);
  for (const t of tuerme) turmSchilder(kontext, t);
  if (fassade) fassadenSchilder(kontext, fassade);
  return { tuerme, schilder, bruecke, fassade, fluss };
}

// --- Räumlicher Index der Bahn-Stützstellen (CSR-Gitter) ---
function bahnIndex(bahn, zelle = 64) {
  const N = bahn.N;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, hwMax = 0;
  for (let i = 0; i < N; i++) {
    x0 = Math.min(x0, bahn.px[i]); x1 = Math.max(x1, bahn.px[i]);
    z0 = Math.min(z0, bahn.pz[i]); z1 = Math.max(z1, bahn.pz[i]);
    hwMax = Math.max(hwMax, bahn.hw[i]);
  }
  const gx = Math.floor((x1 - x0) / zelle) + 1, gz = Math.floor((z1 - z0) / zelle) + 1;
  const start = new Int32Array(gx * gz + 1), liste = new Int32Array(N), k = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    k[i] = Math.floor((bahn.px[i] - x0) / zelle) + Math.floor((bahn.pz[i] - z0) / zelle) * gx;
    start[k[i] + 1]++;
  }
  for (let c = 0; c < gx * gz; c++) start[c + 1] += start[c];
  const fuell = start.slice(0, gx * gz);
  for (let i = 0; i < N; i++) liste[fuell[k[i]]++] = i;
  // Unterkante je Stützstelle: so hoch darf (minus unterBahn) ein Turm darunter reichen
  const unten = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    if (bahn.flags[i] & F_LUECKE) { unten[i] = -Infinity; continue; }
    unten[i] = bahn.py[i] - bahn.hw[i] * Math.abs(bahn.sly[i]) - (bahn.suy[i] < 0 ? 4 : 0);
  }
  return { x0, x1, z0, z1, zelle, gx, gz, start, liste, unten, hwMax };
}

// alle Stützstellen in Zellen, die das Rechteck [x±a] × [z±c] berühren
function jeStuetze(ix, x, z, a, c, fn) {
  const zl = ix.zelle;
  const i0 = Math.max(0, Math.floor((x - a - ix.x0) / zl)), i1 = Math.min(ix.gx - 1, Math.floor((x + a - ix.x0) / zl));
  const k0 = Math.max(0, Math.floor((z - c - ix.z0) / zl)), k1 = Math.min(ix.gz - 1, Math.floor((z + c - ix.z0) / zl));
  for (let kz = k0; kz <= k1; kz++) {
    for (let kx = i0; kx <= i1; kx++) {
      const zc = kx + kz * ix.gx;
      for (let j = ix.start[zc]; j < ix.start[zc + 1]; j++) fn(ix.liste[j]);
    }
  }
}

// höchste erlaubte Turmhöhe für den Grundriss [x±hb] × [z±ht] (Infinity = frei)
function grenzHoehe(k, x, z, hb, ht, zuschlag = STADT.sicherheit) {
  const { bahn, ix } = k;
  const R = ix.hwMax + STADT.korridor + zuschlag;
  let g = Infinity;
  jeStuetze(ix, x, z, hb + R, ht + R, (i) => {
    const dx = Math.max(Math.abs(bahn.px[i] - x) - hb, 0), dz = Math.max(Math.abs(bahn.pz[i] - z) - ht, 0);
    const lim = bahn.hw[i] + STADT.korridor + zuschlag;
    if (dx * dx + dz * dz < lim * lim) g = Math.min(g, ix.unten[i] - STADT.unterBahn);
  });
  return g;
}

// nächste Stützstelle im Grundriss (bis rmax), { i, d } oder null
function naechste(k, x, z, rmax) {
  const { bahn, ix } = k;
  let best = -1, bd = rmax * rmax;
  jeStuetze(ix, x, z, rmax, rmax, (i) => {
    const d = (bahn.px[i] - x) ** 2 + (bahn.pz[i] - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best < 0 ? null : { i: best, d: Math.sqrt(bd) };
}

// Sperrflächen: gedrehte Rechtecke (Mitte, Längsachse e, halbe Länge/Tiefe) mit Unterkante yUnten
// (0 = von Boden auf belegt). Rückgabe: höchste erlaubte Turmhöhe für ein achsparalleles Rechteck.
function sperrGrenze(k, x, z, hb, ht, rand = 6) {
  let g = Infinity;
  for (const s of k.sperr) {
    if (obbUeberlapp(x, z, 1, 0, hb + rand, ht + rand, s.x, s.z, s.ex, s.ez, s.hb, s.ht)) g = Math.min(g, s.yUnten - 8);
  }
  const f = k.fluss;
  if (f) {
    const halbDiag = Math.hypot(hb, ht);
    if (polylinienAbstand(f.punkte, x, z) < f.breite / 2 + 12 + halbDiag) g = -Infinity;
    const h = f.hafen;
    if (obbUeberlapp(x, z, 1, 0, hb + 15, ht + 15, h.x, h.z, Math.cos(h.rot), -Math.sin(h.rot), h.b / 2, h.t / 2)) g = -Infinity;
  }
  return g;
}

// Trennachsen-Test zweier gedrehter Rechtecke (Mitte, Achse e = (ex, ez), halbe Ausdehnungen a entlang e, c quer)
function obbUeberlapp(x1, z1, ex1, ez1, a1, c1, x2, z2, ex2, ez2, a2, c2) {
  const dx = x2 - x1, dz = z2 - z1;
  const achsen = [[ex1, ez1], [-ez1, ex1], [ex2, ez2], [-ez2, ex2]];
  for (const [ax, az] of achsen) {
    const r1 = a1 * Math.abs(ex1 * ax + ez1 * az) + c1 * Math.abs(-ez1 * ax + ex1 * az);
    const r2 = a2 * Math.abs(ex2 * ax + ez2 * az) + c2 * Math.abs(-ez2 * ax + ex2 * az);
    if (Math.abs(dx * ax + dz * az) > r1 + r2) return false;
  }
  return true;
}

function polylinienAbstand(punkte, x, z) {
  let best = Infinity;
  for (let j = 0; j + 1 < punkte.length; j++) {
    const a = punkte[j], b = punkte[j + 1];
    const vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? clamp(((x - a.x) * vx + (z - a.z) * vz) / l2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(x - a.x - vx * t, z - a.z - vz * t));
  }
  return best;
}

// Stützstellen-Bereich eines Abschnitts (per Name) oder null
function abschnittBereich(bahn, name) {
  const k = bahn.abschnitte.findIndex((a) => a.name === name);
  if (k < 0) return null;
  const i0 = Math.ceil(bahn.segStart[k] / bahn.ds);
  const i1 = Math.min(bahn.N - 1, Math.floor((bahn.segStart[k] + bahn.abschnitte[k].len) / bahn.ds));
  return [i0, i1];
}

// längster zusammenhängender Lauf in [i0, i1], für den bed(i) gilt
function laengsterLauf(i0, i1, bed) {
  let best = null, a = -1;
  for (let i = i0; i <= i1 + 1; i++) {
    const ok = i <= i1 && bed(i);
    if (ok && a < 0) a = i;
    if (!ok && a >= 0) {
      if (!best || i - 1 - a > best[1] - best[0]) best = [a, i - 1];
      a = -1;
    }
  }
  return best;
}

function turm(k, x, z, b, t, h, art, extra = {}) {
  const T = { x, z, b, t, h, farbe: k.r.pick(TURM_FARBEN), art, ...extra };
  k.tuerme.push(T);
  return T;
}

// --- Fassaden-Turm an der Wandfahrt ---
// Lauf: Fahrfläche fast senkrecht (|su.y| klein) und ihre Kante reicht nicht mehr als (Spalt − 0,8 m) hinter die
// Mittellinie. Der Turm steht auf der Gegenseite der Fahrflächen-Normale, Vorderfläche ~3 m hinter der Fahrfläche.
function baueFassade(k) {
  const { bahn } = k, S = STADT.fassade;
  const ber = abschnittBereich(bahn, 'Fassade');
  if (!ber) return null;
  const lauf = laengsterLauf(ber[0], ber[1], (i) => {
    const nH = Math.hypot(bahn.sux[i], bahn.suz[i]);
    if (Math.abs(bahn.suy[i]) > S.minBank || nH < 0.5) return false;
    const reich = bahn.hw[i] * Math.abs(bahn.slx[i] * bahn.sux[i] + bahn.slz[i] * bahn.suz[i]) / nH;
    return reich < S.spalt - 0.8;
  });
  if (!lauf || lauf[1] - lauf[0] < 20) return null;
  const [a, e] = lauf;
  // mittlere Normale (horizontal) und Fahrtrichtung
  let nx = 0, nz = 0, yMin = Infinity, yMax = -Infinity;
  for (let i = a; i <= e; i++) {
    nx += bahn.sux[i]; nz += bahn.suz[i];
    yMin = Math.min(yMin, bahn.py[i] - bahn.hw[i]); yMax = Math.max(yMax, bahn.py[i] + bahn.hw[i]);
  }
  const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
  let ex = bahn.px[e] - bahn.px[a], ez = bahn.pz[e] - bahn.pz[a];
  const el = Math.hypot(ex, ez); ex /= el; ez /= el;
  // Vorderfläche hinter ALLEN Lauf-Stützstellen um den Spalt
  let fMin = Infinity;
  for (let i = a; i <= e; i++) fMin = Math.min(fMin, bahn.px[i] * nx + bahn.pz[i] * nz);
  const front = fMin - S.spalt;
  const mx = (bahn.px[a] + bahn.px[e]) / 2, mz = (bahn.pz[a] + bahn.pz[e]) / 2;
  const mf = mx * nx + mz * nz;
  const cx = mx + nx * (front - mf - S.tiefe / 2), cz = mz + nz * (front - mf - S.tiefe / 2);
  const F = {
    x: cx, z: cz, b: el, t: S.tiefe, h: Math.round(yMax + S.ueber),
    rot: Math.atan2(-ez, ex),          // Drehung um Welt-y (three.js): lokale x-Achse (Länge b) → Fahrtrichtung
    ex, ez, nx, nz,                    // Längsachse, Vorderflächen-Normale (zur Bahn hin)
    spalt: S.spalt, yWand: [yMin, yMax], lauf: [a, e],
    farbe: 0x10131c, art: 'glas',
  };
  k.sperr.push({ x: cx, z: cz, ex, ez, hb: el / 2, ht: S.tiefe / 2, yUnten: 0 });
  return F;
}

function fassadenSchilder(k, F) {
  const { r } = k;
  const vorn = (y, text, hs) => {
    const b = hs * schildAspekt(text);
    if (b > F.b * 0.9) return;
    const off = F.t / 2 + 0.6;
    k.schilder.push({ x: F.x + F.nx * off, y, z: F.z + F.nz * off, nx: F.nx, nz: F.nz, b, h: hs, text, farbe: r.pick(NEON_FARBEN) });
  };
  // groß über der Wandfahrt, ein zweites darunter
  vorn(F.yWand[1] + 8 + 11, 'HYPERBAHN', 22);
  if (F.yWand[0] - 12 - 8 > 20) vorn(F.yWand[0] - 12 - 8, r.pick(SCHILD_TEXTE), 16);
}

// --- Brücken-Platte über der Überkopf-Passage ---
function baueBruecke(k) {
  const { bahn } = k, S = STADT.bruecke;
  const ber = abschnittBereich(bahn, 'Unter der Brücke');
  if (!ber) return null;
  const lauf = laengsterLauf(ber[0], ber[1], (i) => bahn.suy[i] < -S.minKopf);
  if (!lauf || lauf[1] - lauf[0] < S.stueck) return null;
  const stuecke = [], pfeiler = [];
  let nr = 0;
  for (let a = lauf[0]; a < lauf[1]; a += S.stueck, nr++) {
    const e = Math.min(lauf[1], a + S.stueck);
    // Unterkante folgt der Mittellinie (geneigt), knapp über der höchsten Kante der kopfüber liegenden Fahrfläche
    let off = -Infinity, hw = 0;
    for (let i = a; i <= e; i++) {
      const y0 = lerp(bahn.py[a], bahn.py[e], (i - a) / Math.max(1, e - a));
      off = Math.max(off, bahn.py[i] + bahn.hw[i] * Math.abs(bahn.sly[i]) - y0 + 0.6);
      hw = Math.max(hw, bahn.hw[i]);
    }
    const ax = bahn.px[a], az = bahn.pz[a], bx = bahn.px[e], bz = bahn.pz[e];
    const ay = bahn.py[a] + off, by = bahn.py[e] + off, yu = Math.min(ay, by);
    const breite = 2 * (hw + S.ueberHw);
    stuecke.push({ ax, ay, az, bx, by, bz, breite, dicke: S.dicke });
    let ex = bx - ax, ez = bz - az; const el = Math.hypot(ex, ez); ex /= el; ez /= el;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    k.sperr.push({ x: mx, z: mz, ex, ez, hb: el / 2 + 1, ht: breite / 2, yUnten: yu });
    // Pfeiler beidseits außerhalb des Korridors
    if (nr % S.pfeilerAbstand === 0) {
      for (const seite of [-1, 1]) {
        const q = hw + STADT.korridor + 4 + S.pfeilerB / 2;
        const px = mx - ez * q * seite, pz = mz + ex * q * seite;
        pfeiler.push({ x: px, z: pz, h: yu, b: S.pfeilerB });
        k.sperr.push({ x: px, z: pz, ex: 1, ez: 0, hb: S.pfeilerB / 2, ht: S.pfeilerB / 2, yUnten: 0 });
      }
    }
  }
  return { stuecke, pfeiler, lauf };
}

// --- Fluss + Hafenbecken unter der Neon-Schlucht ---
function baueFluss(k) {
  const { bahn, r } = k, S = STADT.fluss;
  const a = abschnittBereich(bahn, 'Neon-Schlucht'), b = abschnittBereich(bahn, 'Neon-Schlucht Mitte');
  if (!a || !b) return null;
  const m = Math.round((a[0] + b[1]) / 2);
  const mx = bahn.px[m], mz = bahn.pz[m];
  let tx = bahn.tx[m], tz = bahn.tz[m]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
  const qx = -tz, qz = tx;   // quer zur Strecke
  const ph = r.range(0, Math.PI * 2);
  const punkte = [];
  for (let s = -S.halbLaenge; s <= S.halbLaenge + 1e-6; s += 100) {
    // nahe der Kreuzung gerade (Fluss genau unter dem Sprung), draußen mäandernd
    const w = clamp((Math.abs(s) - 250) / 600, 0, 1);
    const off = S.maeander * w * Math.sin(s / 520 + ph);
    punkte.push({ x: mx + qx * s + tx * off, z: mz + qz * s + tz * off });
  }
  const H = S.hafen;
  const seite = r.chance(0.5) ? 1 : -1;
  // Hafenbecken seitlich am Fluss, Längsseite parallel zum Fluss, neben der Strecke
  const hx = mx + qx * H.versatz * seite + tx * (S.breite / 2 + H.t / 2 - 10);
  const hz = mz + qz * H.versatz * seite + tz * (S.breite / 2 + H.t / 2 - 10);
  const hafen = { x: hx, z: hz, b: H.b, t: H.t, rot: Math.atan2(-qz, qx) };
  return { breite: S.breite, y: 0.4, punkte, hafen, kreuzung: { x: mx, z: mz } };
}

// --- hohe Türme an beiden Seiten einer Sprung-Schlucht ---
function schluchtTuerme(k, name1, name2) {
  const { bahn, r } = k, S = STADT.schlucht;
  const a = abschnittBereich(bahn, name1), b = abschnittBereich(bahn, name2);
  if (!a || !b) return;
  const s0 = a[0] * bahn.ds - S.vor, s1 = b[1] * bahn.ds + S.nach;
  for (const seite of [-1, 1]) {
    let s = s0 + r.range(0, 10);
    while (s < s1) {
      const i = ((Math.round(s / bahn.ds) % bahn.N) + bahn.N) % bahn.N;
      let tx = bahn.tx[i], tz = bahn.tz[i]; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
      const lx = -tz * seite, lz = tx * seite;   // horizontal quer (seite = ±1)
      const laengs = r.range(S.breite[0], S.breite[1]), quer = r.range(30, 52);
      const zLaengs = Math.abs(tz) > Math.abs(tx);
      const b = zLaengs ? quer : laengs, t = zLaengs ? laengs : quer;
      const q = bahn.hw[i] + STADT.korridor + S.abstand + r.range(0, 6) + quer / 2;
      const x = bahn.px[i] + lx * q + tx * laengs / 2, z = bahn.pz[i] + lz * q + tz * laengs / 2;
      s += laengs + S.luecke + r.range(0, 6);
      let h = r.range(S.hoehe[0], S.hoehe[1]);
      h = Math.max(h, bahn.py[i] + r.range(110, 180));
      h = Math.min(h, STADT.hMax, grenzHoehe(k, x, z, b / 2, t / 2), sperrGrenze(k, x, z, b / 2, t / 2));
      if (h < STADT.hMin) continue;
      turm(k, x, z, b, t, h, 'schlucht');
      k.sperr.push({ x, z, ex: 1, ez: 0, hb: b / 2, ht: t / 2, yUnten: 0 });
    }
  }
}

// --- Raster-Türme ---
function rasterTuerme(k, dichte) {
  const { bahn, ix, r } = k, S = STADT, R = S.raster;
  const x0 = ix.x0 - S.ueberRand, x1 = ix.x1 + S.ueberRand, z0 = ix.z0 - S.ueberRand, z1 = ix.z1 + S.ueberRand;
  const nx = Math.ceil((x1 - x0) / R), nz = Math.ceil((z1 - z0) / R);
  for (let kz = 0; kz < nz; kz++) {
    for (let kx = 0; kx < nx; kx++) {
      const cx = x0 + (kx + 0.5) * R, cz = z0 + (kz + 0.5) * R;
      const n = naechste(k, cx, cz, S.rand);
      const d = n ? n.d : Infinity;
      let p = d < S.nah ? S.pNah : d < S.rand ? lerp(S.pNah, S.pRand, (d - S.nah) / (S.rand - S.nah)) : S.pFern;
      p = clamp(p * dichte, 0, 1);
      // feste Zufallszahlen je Zelle (gleich viele Ziehungen → stabile Folge)
      const z0r = r(), zb = r(), zt = r(), zx = r(), zz = r(), zh = r(), zs = r(), za = r();
      if (z0r >= p) continue;
      const frei = R - lerp(S.strasse[0], S.strasse[1], zs);
      const b = frei * lerp(0.55, 1, zb), t = frei * lerp(0.55, 1, zt);
      const x = cx + (zx * 2 - 1) * (frei - b) / 2, z = cz + (zz * 2 - 1) * (frei - t) / 2;
      const nahF = clamp(1 - d / S.rand, 0, 1);
      let h = S.hMin + (S.hMax - S.hMin) * Math.pow(zh, lerp(3.4, 1.5, nahF));
      if (d >= S.rand) h = Math.min(h, S.fernHMax);
      const g = Math.min(grenzHoehe(k, x, z, b / 2, t / 2), sperrGrenze(k, x, z, b / 2, t / 2));
      if (g < S.hMin) continue;   // passt nicht (Fahrkorridor/Sonderbau)
      h = Math.min(h, g);
      const art = za < 0.45 ? 'glas' : za < 0.8 ? 'beton' : 'band';
      const T = turm(k, x, z, b, t, h, art);
      T.bahnAbstand = d;
      // Rücksprung: schlanker, höherer Aufsatz
      if (h > 140 && r.chance(S.stufeAnteil)) {
        const b2 = b * r.range(0.5, 0.75), t2 = t * r.range(0.5, 0.75);
        const g2 = Math.min(grenzHoehe(k, x, z, b2 / 2, t2 / 2), sperrGrenze(k, x, z, b2 / 2, t2 / 2), S.hMax);
        const h2 = Math.min(h + r.range(30, 110), g2);
        if (h2 > h + 15) turm(k, x, z, b2, t2, h2, art, { aufsatz: true, bahnAbstand: d });
      }
    }
  }
}

// --- Neon-Schilder an Turmfassaden, zur Strecke hin ---
function turmSchilder(k, T) {
  const { bahn, r } = k, S = STADT.schild;
  if (T.aufsatz || T.h < 70) return;
  const schlucht = T.art === 'schlucht';
  if (!schlucht && (T.bahnAbstand == null || T.bahnAbstand > S.maxAbstand)) return;
  if (!r.chance(schlucht ? S.pSchlucht : S.pTurm)) return;
  const n = naechste(k, T.x, T.z, S.maxAbstand + 60);
  if (!n) return;
  const dx = bahn.px[n.i] - T.x, dz = bahn.pz[n.i] - T.z;
  // Fassade, deren Normale am besten zur Strecke zeigt
  const xSeite = Math.abs(dx) > Math.abs(dz);
  const nx = xSeite ? Math.sign(dx) : 0, nz = xSeite ? 0 : Math.sign(dz);
  const breite = xSeite ? T.t : T.b;
  const anzahl = schlucht ? 1 + (r.chance(0.6) ? 1 : 0) : 1;
  const benutzt = [];
  for (let j = 0; j < anzahl; j++) {
    const text = r.pick(SCHILD_TEXTE), asp = schildAspekt(text);
    const hb = schlucht ? STADT.schild.hoeheGross : STADT.schild.hoehe;
    let hs = r.range(hb[0], hb[1]);
    if (hs * asp > breite * 0.85) hs = breite * 0.85 / asp;
    if (hs < 3) continue;
    const b = hs * asp;
    // Höhe: nahe der Bahnhöhe (dort sieht man sie), sonst irgendwo an der Fassade
    let y = bahn.py[n.i] + r.range(-30, 30) + j * (hs + 14);
    y = clamp(y, hs / 2 + 8, T.h - hs / 2 - 3);
    if (T.h - hs / 2 - 3 < hs / 2 + 8) continue;
    if (benutzt.some((yy) => Math.abs(yy - y) < hs + 2)) continue;
    benutzt.push(y);
    const seitlich = (r() * 2 - 1) * Math.max(0, breite - b) / 2;
    const off = (xSeite ? T.b : T.t) / 2 + 0.5;
    const sx = T.x + nx * off + (xSeite ? 0 : seitlich), sz = T.z + nz * off + (xSeite ? seitlich : 0);
    const farbe = r.pick(NEON_FARBEN);
    // Turm steht (fast) unter der Bahn: Schild sähe man nicht von der Strecke aus
    if ((bahn.px[n.i] - sx) * nx + (bahn.pz[n.i] - sz) * nz < 5) continue;
    k.schilder.push({ x: sx, y, z: sz, nx, nz, b, h: hs, text, farbe });
  }
}
