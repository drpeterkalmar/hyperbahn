// Kulisse „Gewitter-Pass“ (P2): Hochgebirge bei Nacht im Gewitter – zerklüftete Berge mit Schneegipfeln, Nadelwald an
// den unteren Hängen, Täler unter den Sprüngen, Pass-Markierungen mit Warnlichtern am Kamm, Regen mit Wind und Blitze.
// Blitze respektieren „⚡ Blitze reduzieren“ (Blitz-Bremse aus core/zeit.js): dann nur ein gedämpfter Puls je Blitz,
// höchstens 3 je Sekunde und keine Flacker-Folge.
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { Regen } from './regen.js';
import { bahnRaster, gelaende, streuen, instanzen, leuchtpunkte, luecken, abschnitt, anBahn, entsorgen, bodenHoehe } from './kulisse_kern.js';

export const THEMA = {
  himmel: { oben: [0.01, 0.015, 0.03], horizont: [0.05, 0.06, 0.1], glut: [0.02, 0.03, 0.06], boden: [0.02, 0.025, 0.04],
    wolken: 1.0, wolkenFarbe: [0.12, 0.14, 0.2], wolkenTempo: 0.03 },
  nebel: { farbe: 0x0b0f1a, dichte: 0.0008 },
  licht: { hemi: [0x6a7aa8, 0x0a0c12, 0.55], richtung: { farbe: 0x9fb4ff, staerke: 0.3, dir: [0.3, 1, -0.2] } },
  grade: 'gewitter',
  dunst: { farbe: 0x2a3448, aerial: { density: 0.0003, falloff: 0.004, base: 0, max: 0.4 } },
  umgebung: { grund: 0x05070c, farben: [0x9fb4ff, 0x00e5ff, 0xffffff, 0xff3b3b, 0x6a7aff, 0xffd400], hell: 2.2 },
  look: {
    fahrbahn: { farbe: 0x0b0d12, rau: 0.18, metall: 0.35, linie: [0.85, 0.9, 1.0], linieStaerke: 1.3 },
    kante: { links: [0.7, 0.8, 1.0], rechts: [1.0, 0.2, 0.15] },
    deck: { farbe: 0x1a1c22, rau: 0.8, metall: 0.2 },
    wand: { farbe: 0x141a28, deckkraft: 0.45, glimmen: 0x0a1428 },
    stuetze: { farbe: 0x2a2c32, glimmen: 0x0a0a14 },
    nass: 1,
  },
};

// Gewitter-Takt (rein): alle 3–8 s ein Blitz, voll = 1–3 Flacker-Pulse in 0,35 s; reduziert = ein gedämpfter Puls
// (über die Blitz-Bremse). hell(t) → 0…1 Helligkeit, ort = Index des Blitzes (für die Lage des Strahls)
export class GewitterTakt {
  constructor(seed = 7) { this.r = rng(seed); this.naechster = 2 + this.r() * 3; this.pulse = []; this.nr = 0; }
  hell(t, blitze = null) {
    if (t >= this.naechster) {
      this.nr++;
      const n = blitze && blitze.reduziert ? 1 : 1 + Math.floor(this.r() * 3);
      this.pulse = [];
      for (let k = 0; k < n; k++) this.pulse.push({ t: t + k * 0.11 + this.r() * 0.04, k: 0.6 + 0.4 * this.r(), gemeldet: false });
      this.naechster = t + 3 + this.r() * 5;
    }
    let h = 0;
    for (const p of this.pulse) {
      if (t < p.t) continue;
      if (!p.gemeldet) { p.gemeldet = true; p.wirk = blitze ? blitze.blitz(t, p.k) : p.k; }
      h = Math.max(h, p.wirk * Math.exp(-(t - p.t) / 0.07));
    }
    return h;
  }
}

export function baueKulisse(bahn, { scene, blitze = null, himmel = null, hemi = null } = {}) {
  const r = rng(1312);
  const gruppe = new THREE.Group(); gruppe.name = 'kulisse-gebirge';
  const raster = bahnRaster(bahn);
  // Täler: unter den Sprüngen und am Kamm (dort fällt das Gelände beidseits ab)
  const tal = [];
  for (const [s0, s1] of luecken(bahn)) for (let s = s0 - 150; s <= s1 + 100; s += 20) { const p = anBahn(bahn, s); tal.push(p.x, p.z, 120, 110); }
  const ka = abschnitt(bahn, 'Kamm');
  if (ka) for (let s = ka.s0 - 40; s <= ka.s0 + ka.len + 40; s += 20) { const p = anBahn(bahn, s); tal.push(p.x, p.z, 200, 90); }
  const berg = (x, z) => {
    // zerklüftet: Grate (1 − |Rauschen|) in zwei Größen + große Massive
    const n1 = 1 - Math.abs(Math.sin(x * 0.0021 + Math.sin(z * 0.0017) * 1.7) * Math.cos(z * 0.0019 - x * 0.0007));
    const n2 = 1 - Math.abs(Math.sin(x * 0.0063 + z * 0.0041) * Math.cos(z * 0.0057));
    let h = n1 * n1 * 260 + n2 * 70 + Math.sin(x * 0.0005 + 1) * Math.cos(z * 0.0004) * 120 + 40;
    for (let j = 0; j < tal.length; j += 4) {
      const d = Math.hypot(x - tal[j], z - tal[j + 1]);
      if (d < tal[j + 2]) h -= (1 - d / tal[j + 2]) ** 2 * tal[j + 3];
    }
    return h;
  };
  const amBoden = bodenHoehe(raster, berg, { frei: 7, flanke: 0.9 });
  gruppe.add(gelaende(bahn, raster, {
    rand: 2600, n: 170, hoehe: berg, frei: 7, flanke: 0.9,
    farbe: (x, z, h, steil) => {
      const schnee = Math.min(1, Math.max(0, (h - 200) / 60)) * (1 - Math.min(1, steil * 2.2));
      const wald = Math.min(1, Math.max(0, (140 - h) / 80)) * (1 - Math.min(1, steil * 1.5));
      const fels = [0.16, 0.17, 0.2];
      const c = fels.map((v, i) => v + (0.02 * i) * steil);
      return c.map((v, i) => v * (1 - schnee) * (1 - wald) + [0.75, 0.78, 0.85][i] * schnee + [0.04, 0.09, 0.06][i] * wald * (1 - schnee));
    },
    mat: { roughness: 0.95, flatShading: true },
  }));
  // Nadelwald: Kegel an den unteren Hängen
  const baeume = [];
  for (const p of streuen(bahn, raster, r, 1400, { dMin: 18, dMax: 1600 })) {
    const y0 = amBoden(p.x, p.z);
    if (y0 > 150 || y0 > p.y - 12) continue;
    const h = r.range(14, 30);
    baeume.push({ x: p.x, y: y0 + h / 2 - 1, z: p.z, sx: h * 0.22, sy: h, sz: h * 0.22, farbe: [0.03 + r() * 0.02, 0.08 + r() * 0.04, 0.05] });
  }
  gruppe.add(instanzen(new THREE.ConeGeometry(1, 1, 6), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), baeume, 'nadelwald'));
  // Felsbrocken
  const brocken = streuen(bahn, raster, r, 160, { dMin: 20, dMax: 900 }).map((p) => {
    const g = r.range(4, 14);
    return { x: p.x, y: amBoden(p.x, p.z) + g * 0.3, z: p.z, sx: g, sy: g * 0.7, sz: g * 1.2, ry: r.range(0, 6.3), farbe: [0.2, 0.21, 0.24] };
  });
  gruppe.add(instanzen(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), brocken, 'felsbrocken'));
  // Pass-Markierungen: rot-weiße Stangen mit Warnlicht neben Kamm und Serpentinen
  const leucht = [], stangen = [];
  for (const name of ['Kamm', 'Serpentine 1', 'Serpentine 2', 'Grat-Auffahrt']) {
    const a = abschnitt(bahn, name); if (!a) continue;
    for (let s = a.s0; s < a.s0 + a.len; s += 40) for (const sg of [1, -1]) {
      const hw = bahn.hw[Math.round(s / bahn.ds) % bahn.N];
      const p = anBahn(bahn, s, sg * (hw + 3), -1.5), top = anBahn(bahn, s, sg * (hw + 3), 6);
      stangen.push({ x: (p.x + top.x) / 2, y: (p.y + top.y) / 2, z: (p.z + top.z) / 2, sx: 0.22, sy: 7.5, sz: 0.22, farbe: sg > 0 ? 0xd8d8d8 : 0xaa2222 });
      leucht.push({ x: top.x, y: top.y + 0.3, z: top.z, g: 0.45, farbe: [4, 0.3, 0.15] });
    }
  }
  gruppe.add(instanzen(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6 }), stangen, 'passstangen'));
  // Funkmasten auf Gipfeln (rote Warnlichter, weit sichtbar)
  for (const p of streuen(bahn, raster, r, 40, { dMin: 300, dMax: 2200 })) {
    const y0 = amBoden(p.x, p.z);
    if (y0 < 180) continue;
    stangen.push({ x: p.x, y: y0 + 30, z: p.z, sx: 1.2, sy: 60, sz: 1.2, farbe: 0x333333 });
    leucht.push({ x: p.x, y: y0 + 61, z: p.z, g: 3, farbe: [5, 0.3, 0.1] });
  }
  const lp = leuchtpunkte(leucht, { blink: 0.6, anteil: 0.5 });
  gruppe.add(lp);
  // Blitz-Strahl: verzweigte Zickzack-Linie (HDR-weiß), Lage je Blitz neu, sichtbar nur während des Pulses
  const strahlGeo = new THREE.BufferGeometry(), pts = [];
  let x = 0, y = 0;
  for (let k = 0; k < 14; k++) {
    const nx = x + r.range(-40, 40), ny = y - r.range(35, 60);
    pts.push(x, y, 0, nx, ny, 0);
    if (k % 4 === 2) { const bx = nx + r.range(-80, 80), by = ny - r.range(40, 90); pts.push(nx, ny, 0, bx, by, 0); }
    x = nx; y = ny;
  }
  strahlGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const strahlMat = new THREE.LineBasicMaterial({ color: new THREE.Color(6, 6.5, 8), transparent: true, opacity: 0, fog: false });
  const strahl = new THREE.LineSegments(strahlGeo, strahlMat);
  strahl.frustumCulled = false; strahl.name = 'blitzstrahl';
  gruppe.add(strahl);
  const B = raster.box, takt = new GewitterTakt(99), hemiBasis = hemi ? hemi.intensity : 0;
  let ortNr = -1;
  // Regen mit Wind
  const regen = new Regen(scene, { anzahl: 6500, fall: 26, wind: [6, 0, -3], hell: 0.5, farbe: [0.65, 0.72, 0.9] });
  return {
    gruppe, takt,
    update(dt, t, kamPos, kamVel) {
      lp.u.uZeit.value = t; lp.u.uRuhig.value = blitze && blitze.reduziert ? 1 : 0;
      regen.update(dt, kamPos, kamVel, 1);
      const h = takt.hell(t, blitze);
      if (takt.nr !== ortNr) {   // neuer Blitz: irgendwo am Horizont rund um die Strecke
        ortNr = takt.nr;
        const w = r() * Math.PI * 2, d = r.range(1400, 2600);
        strahl.position.set((B.x0 + B.x1) / 2 + Math.cos(w) * d, 900, (B.z0 + B.z1) / 2 + Math.sin(w) * d);
        strahl.rotation.y = r() * Math.PI; strahl.scale.setScalar(r.range(1.1, 1.6));
      }
      strahlMat.opacity = Math.min(1, h * 1.5);
      strahl.visible = h > 0.02;
      if (himmel) himmel.u.uBlitz.value = h;
      if (hemi) hemi.intensity = hemiBasis + h * 2.2;
    },
    dispose() {
      entsorgen(gruppe); regen.dispose();
      if (himmel) himmel.u.uBlitz.value = 0;
      if (hemi) hemi.intensity = hemiBasis;
    },
  };
}
