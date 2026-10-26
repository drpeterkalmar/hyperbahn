// Strecken-Geometrie als reine Arrays (ohne three.js, Node-testbar). bahnmesh.js macht daraus BufferGeometries.
// Teile: Fahrbahn (oben), Deck (Unterseite + Seiten), Begrenzung (Wände), Kantenlicht (Lauflicht-Bänder oben auf den
// Wänden), Magnet-Streifen (nur Magnet-Abschnitte), Röhren-Hülle, Boost-Pads, Landezonen-Lichter, Stützen.
// Lücken (Sprünge) bekommen keine Fahrbahn – die Bänder werden dort unterbrochen.
// Alle Zahlen sind Startwerte (TODO Heavy-Job: am Bild abstimmen).
import { F_LUECKE, F_ROEHRE, F_MAGNET, F_LANDEZONE } from '../track/bahn.js';
import { GEFUEHL } from '../physics/fahrgefuehl.js';

export const GEO = {
  spalten: 6,          // Querteilung der Fahrbahn
  schritt: 2,          // jede n-te Stützstelle (2 → alle 4 m)
  deck: 1.4,           // m Dicke der Fahrbahn
  wandH: 1.8,          // m sichtbare Begrenzung (Physik-Wand 3,2 m = Energiefeld darüber)
  kanteB: 0.35,        // m Breite des Kantenlichts
  magnetB: 0.9,        // m Breite der Magnet-Streifen
  magnetRand: 1.6,     // m Abstand der Magnet-Streifen vom Rand
  roehreRand: 3,       // m Röhrenradius über die Halbbreite hinaus
  roehreSeg: 20,       // Ecken des Röhrenquerschnitts
  stuetzeAbst: 64,     // m Abstand der Stützen
  lichtAbst: 12,       // m Abstand der Landezonen-Lichter
};

// Hilfs-Puffer, der wächst
function puffer() { return { pos: [], nor: [], uv: [], idx: [], extra: [] }; }
function vert(b, x, y, z, nx, ny, nz, u, v, e = 0) {
  b.pos.push(x, y, z); b.nor.push(nx, ny, nz); b.uv.push(u, v); b.extra.push(e);
  return b.pos.length / 3 - 1;
}
function quad(b, a, c, d, e) { b.idx.push(a, c, d, a, d, e); }

// Zusammenhängende Bereiche [i0, i1) mit Bedingung (über das Rundenende hinweg)
export function bereiche(bahn, test) {
  const N = bahn.N, out = [];
  let start = -1;
  for (let i = 0; i < N; i++) {
    const ok = test(i);
    if (ok && start < 0) start = i;
    if (!ok && start >= 0) { out.push([start, i]); start = -1; }
  }
  if (start >= 0) {
    if (out.length && out[0][0] === 0) out[0][0] = start - N; else out.push([start, N]);
  }
  return out;
}

const idxW = (bahn, i) => ((i % bahn.N) + bahn.N) % bahn.N;

// Band entlang der Bahn: querProfil(i) liefert [ [u, h], … ] (Punkte im Fahrflächen-Rahmen), Normale je Punkt aus
// Nachbarn im Profil (für Wände: quer). geschlossen: Band schließt das Profil (Röhre).
function band(b, bahn, i0, i1, profilFn, { schritt = GEO.schritt, geschlossen = false, vSkala = 1 / 20, eFn = null, normalFn = null } = {}) {
  let vorher = null;
  const idxs = [];
  for (let i = i0; i <= i1; i += schritt) {
    const k = idxW(bahn, Math.min(i, i1));
    const prof = profilFn(k);
    const reihe = [];
    const P = [bahn.px[k], bahn.py[k], bahn.pz[k]], U = [bahn.sux[k], bahn.suy[k], bahn.suz[k]], L = [bahn.slx[k], bahn.sly[k], bahn.slz[k]];
    const s = Math.min(i, i1) * bahn.ds;
    for (let j = 0; j < prof.length; j++) {
      const [u, h] = prof[j];
      const x = P[0] + L[0] * u + U[0] * h, y = P[1] + L[1] * u + U[1] * h, z = P[2] + L[2] * u + U[2] * h;
      let n;
      if (normalFn) n = normalFn(j, prof);
      else n = [0, 1];
      const nx = L[0] * n[0] + U[0] * n[1], ny = L[1] * n[0] + U[1] * n[1], nz = L[2] * n[0] + U[2] * n[1];
      reihe.push(vert(b, x, y, z, nx, ny, nz, j / Math.max(1, prof.length - 1), s * vSkala, eFn ? eFn(k, j, s) : s));
    }
    if (vorher) {
      const n = geschlossen ? reihe.length : reihe.length - 1;
      for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % reihe.length;
        quad(b, vorher[j], reihe[j], reihe[j2], vorher[j2]);
      }
    }
    vorher = reihe;
    idxs.push(k);
    if (i >= i1) break;
    if (i + schritt > i1 && i < i1) i = i1 - schritt;
  }
  return idxs;
}

export function baueBahnGeometrie(bahn) {
  const teile = { fahrbahn: puffer(), deck: puffer(), wand: puffer(), kante: puffer(), magnet: puffer(), roehre: puffer(), pads: puffer(), stoerfeld: puffer(), box: puffer() };
  const C = GEO.spalten;
  const fahrbar = bereiche(bahn, (i) => !(bahn.flags[i] & F_LUECKE));
  for (const [i0, i1] of fahrbar) {
    // Fahrbahn: Querprofil von rechts (−hw) nach links (+hw). Flächennormale = vor × Profilrichtung, also hier oben.
    band(teile.fahrbahn, bahn, i0, i1, (k) => {
      const hw = bahn.hw[k], p = [];
      for (let c = 0; c <= C; c++) p.push([-hw + 2 * hw * c / C, 0]);
      return p;
    });
    // Deck: Unterseite + Seiten (geschlossenes Profil, Normalen nach außen)
    band(teile.deck, bahn, i0, i1, (k) => {
      const hw = bahn.hw[k], d = GEO.deck;
      return [[hw, -0.02], [hw, -d], [-hw, -d], [-hw, -0.02]];
    }, { normalFn: (j) => [[1, 0], [0, -1], [0, -1], [-1, 0]][j] });
    // Begrenzung links und rechts (Innenseite zur Fahrbahn)
    for (const sg of [1, -1]) {
      band(teile.wand, bahn, i0, i1, (k) => {
        const hw = bahn.hw[k];
        return sg > 0 ? [[hw, 0], [hw, GEO.wandH]] : [[-hw, GEO.wandH], [-hw, 0]];
      }, { normalFn: () => [-sg, 0] });
      band(teile.kante, bahn, i0, i1, (k) => {
        const hw = bahn.hw[k];
        return sg > 0 ? [[hw - GEO.kanteB, GEO.wandH], [hw + 0.05, GEO.wandH]] : [[-hw - 0.05, GEO.wandH], [-hw + GEO.kanteB, GEO.wandH]];
      }, { schritt: 1 });
    }
  }
  // Störfeld am Bahnrand (Fahrgefühl: dort −30 % Schub, Abkürzen lohnt nicht): Warnstreifen innen an der Begrenzung
  for (const [i0, i1] of fahrbar) {
    for (const sg of [1, -1]) {
      band(teile.stoerfeld, bahn, i0, i1, (k) => {
        const hw = bahn.hw[k], a = hw - GEFUEHL.randBreite;
        return sg > 0 ? [[a, 0.03], [hw - 0.05, 0.03]] : [[-hw + 0.05, 0.03], [-a, 0.03]];
      });
    }
  }
  // Magnet-Streifen
  for (const [i0, i1] of bereiche(bahn, (i) => (bahn.flags[i] & F_MAGNET) && !(bahn.flags[i] & F_LUECKE))) {
    for (const sg of [1, -1]) {
      band(teile.magnet, bahn, i0, i1, (k) => {
        const u = sg * (bahn.hw[k] - GEO.magnetRand);
        return [[u - GEO.magnetB / 2, 0.04], [u + GEO.magnetB / 2, 0.04]];
      }, { schritt: 1 });
    }
  }
  // Röhren-Hülle: Kreis um die Fahrbahn (Fahrbahn = Sehne am Boden), Normalen nach innen
  for (const [i0, i1] of bereiche(bahn, (i) => bahn.flags[i] & F_ROEHRE)) {
    band(teile.roehre, bahn, i0, i1, (k) => {
      // Mittelpunkt m über der Fahrbahn, Radius R; Fahrbahn = Sehne am Boden (u = ±hw, h = 0)
      const hw = bahn.hw[k], R = hw + GEO.roehreRand, m = Math.sqrt(R * R - hw * hw);
      // Bogen vom linken Rand (u = +hw) über oben zum rechten Rand (u = −hw): Profilrichtung oben = −links, also zeigt die
      // Flächennormale (vor × Richtung) nach innen – die Innenseite ist sichtbar
      const w0 = Math.atan2(-m, -hw) + 2 * Math.PI, w1 = Math.atan2(-m, hw) + 2 * Math.PI;
      const p = [];
      for (let j = 0; j <= GEO.roehreSeg; j++) {
        const w = w0 - (w0 - w1 + 2 * Math.PI) * j / GEO.roehreSeg;
        p.push([R * Math.cos(w), m + R * Math.sin(w)]);
      }
      return p.reverse();
    }, { normalFn: () => [0, 0] });   // Normalen setzt roehreNormalen()
  }
  // Röhren-Normalen nachträglich nach innen (zum Mittelpunkt) – einfacher als im Band
  roehreNormalen(teile.roehre, bahn);
  // Boost-Pads: Viereck auf der Fahrfläche, v läuft entlang (Chevron-Shader)
  for (const p of bahn.pads) {
    const b = teile.pads, i0 = Math.floor(p.s0 / bahn.ds), i1 = Math.ceil(p.s1 / bahn.ds);
    band(b, bahn, i0, i1, () => [[p.u - p.b, 0.05], [p.u + p.b, 0.05]], { schritt: 1, vSkala: 1 / (p.s1 - p.s0) });
  }
  // Boxengasse (P1b): Lade-Spur, v läuft entlang
  if (bahn.box) {
    const x = bahn.box, i0 = Math.floor(x.s0 / bahn.ds), i1 = Math.ceil(x.s1 / bahn.ds);
    band(teile.box, bahn, i0, i1, () => [[x.u - x.b, 0.04], [x.u + x.b, 0.04]], { schritt: 1, vSkala: 1 / (x.s1 - x.s0) });
  }
  return teile;
}

function roehreNormalen(b, bahn) {
  // Für jeden Punkt: Normale = Richtung zur Röhrenachse (Mittelpunkt des Querschnitts) – aus der Nachbarschaft in der Reihe
  // geschätzt: Mittelwert aller Punkte derselben Reihe = Achse (annähernd, Bogen ohne Boden → leicht nach oben versetzt; reicht)
  const n = GEO.roehreSeg + 1;
  for (let r = 0; r * n < b.pos.length / 3; r++) {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < n; j++) { const v = (r * n + j) * 3; cx += b.pos[v]; cy += b.pos[v + 1]; cz += b.pos[v + 2]; }
    cx /= n; cy /= n; cz /= n;
    for (let j = 0; j < n; j++) {
      const v = (r * n + j) * 3;
      let dx = cx - b.pos[v], dy = cy - b.pos[v + 1], dz = cz - b.pos[v + 2];
      const l = Math.hypot(dx, dy, dz) || 1;
      b.nor[v] = dx / l; b.nor[v + 1] = dy / l; b.nor[v + 2] = dz / l;
    }
  }
  void bahn;
}

// Instanz-Listen (Lage + Ausrichtung als Rahmen) für Ringe, Landezonen-Lichter, Stützen, Röhren-Lichtringe
export function baueBahnInstanzen(bahn) {
  const ringe = bahn.ringe.map((r) => rahmen(bahn, r.s, 0, r.h, { r: r.r }));
  const lichter = [];
  for (const [i0, i1] of bereiche(bahn, (i) => bahn.flags[i] & F_LANDEZONE)) {
    let n = 0;
    for (let i = i0; i < i1; i += Math.round(GEO.lichtAbst / bahn.ds), n++) {
      const k = idxW(bahn, i);
      for (const sg of [1, -1]) lichter.push(rahmen(bahn, k * bahn.ds, sg * (bahn.hw[k] - 0.6), 0.3, { folge: n }));
    }
  }
  const stuetzen = [];
  const schritt = Math.round(GEO.stuetzeAbst / bahn.ds);
  for (let i = 0; i < bahn.N; i += schritt) {
    if (bahn.flags[i] & (F_LUECKE | F_ROEHRE)) continue;
    if (bahn.suy[i] < 0.7) continue;   // nur unter aufrechter Fahrbahn
    const unten = bahn.py[i] - GEO.deck;
    if (unten < 4) continue;
    stuetzen.push({ x: bahn.px[i], y: unten / 2, z: bahn.pz[i], h: unten, s: i * bahn.ds });
  }
  const roehrenLichter = [];
  for (const [i0, i1] of bereiche(bahn, (i) => bahn.flags[i] & F_ROEHRE)) {
    for (let i = i0; i < i1; i += 10) roehrenLichter.push(rahmen(bahn, idxW(bahn, i) * bahn.ds, 0, 0, { hw: bahn.hw[idxW(bahn, i)] }));
  }
  return { ringe, lichter, stuetzen, roehrenLichter };
}

function rahmen(bahn, s, u, h, extra = {}) {
  const N = bahn.N, k = ((Math.round(s / bahn.ds) % N) + N) % N;
  return {
    s, x: bahn.px[k] + bahn.slx[k] * u + bahn.sux[k] * h, y: bahn.py[k] + bahn.sly[k] * u + bahn.suy[k] * h, z: bahn.pz[k] + bahn.slz[k] * u + bahn.suz[k] * h,
    T: [bahn.tx[k], bahn.ty[k], bahn.tz[k]], U: [bahn.sux[k], bahn.suy[k], bahn.suz[k]], L: [bahn.slx[k], bahn.sly[k], bahn.slz[k]], ...extra,
  };
}
