// Kulisse „Wüsten-Raumhafen“ (P2): Dämmerung über einer Dünenwüste, tiefe Sonne mit Linsenblendung, Tafelberge am
// Horizont, Raumhafen mit Startturm, Rakete im Silo neben dem Riesensprung, Hangars, Radarschüsseln, Pistenlichter,
// Sandsturm-Teilchen. Alles prozedural aus Grundkörpern (Instancing, ein Draw-Call je Art).
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { Regen } from './regen.js';
import { bahnRaster, gelaende, streuen, instanzen, leuchtpunkte, abschnitt, anBahn, entsorgen } from './kulisse_kern.js';

const SONNE = [-0.75, 0.1, 0.32];   // Richtung zur Sonne (tief im Westen; Startbahn und Sprung fahren auf sie zu)

export const THEMA = {
  himmel: {
    oben: [0.03, 0.04, 0.13], horizont: [0.95, 0.36, 0.13], glut: [1.1, 0.42, 0.12], boden: [0.32, 0.14, 0.07],
    wolken: 0.5, wolkenFarbe: [0.9, 0.35, 0.25], wolkenTempo: 0.004,
    sonne: { dir: SONNE, farbe: [3.2, 1.7, 0.7], staerke: 1 },
  },
  nebel: { farbe: 0x6a3420, dichte: 0.00024 },
  licht: { hemi: [0xffb88a, 0x3a1a0c, 0.75], richtung: { farbe: 0xffa060, staerke: 1.5, dir: SONNE } },
  grade: 'wueste',
  dunst: { farbe: 0xd08050, aerial: { density: 0.00016, falloff: 0.004, base: 0, max: 0.45 } },
  sonneKino: SONNE,
  umgebung: { grund: 0x2a140c, farben: [0xff9a3c, 0xffd28a, 0x2be0ff, 0xff5a2a, 0xffe0b0, 0x8a5cff], hell: 2.4, oben: 0x6a5a8a },
  look: {
    fahrbahn: { farbe: 0x16120f, rau: 0.38, metall: 0.35, linie: [1.0, 0.6, 0.2], linieStaerke: 1.4 },
    kante: { links: [1.0, 0.55, 0.12], rechts: [0.15, 0.85, 1.0] },
    deck: { farbe: 0x2a2018, rau: 0.7, metall: 0.3 },
    wand: { farbe: 0x2a1a10, deckkraft: 0.4, glimmen: 0x2a1004 },
    stuetze: { farbe: 0x3a2c22, glimmen: 0x1a0a02 },
    roehre: { glas: 0x3a2412, deckkraft: 0.18, ring: 0xffa040 },
    nass: 0.15,
  },
};

export function baueKulisse(bahn, { scene } = {}) {
  const r = rng(4711);
  const gruppe = new THREE.Group(); gruppe.name = 'kulisse-wueste';
  const raster = bahnRaster(bahn);
  const B = raster.box;
  // --- Dünen: lange Wellen quer zum Wind + großräumige Hügel; Farbe nach Höhe und Steilheit (Leeseite dunkler) ---
  const huegel = (x, z) => {
    const w = Math.sin(x * 0.0042 + Math.sin(z * 0.0016) * 2.2) * 0.5 + 0.5;
    const g = Math.sin(x * 0.0007 + 1.3) * Math.cos(z * 0.0009 - 0.4);
    return w * w * 22 + g * 26 + Math.sin(z * 0.011 + x * 0.003) * 2.5 - 6;
  };
  gruppe.add(gelaende(bahn, raster, {
    rand: 3200, n: 150, hoehe: huegel, frei: 9, flanke: 0.4,
    farbe: (x, z, h, steil) => {
      const k = Math.min(1, Math.max(0, 0.55 + h * 0.012 - steil * 1.6));
      return [0.42 + 0.3 * k, 0.2 + 0.16 * k, 0.09 + 0.06 * k];
    },
  }));
  // --- Tafelberge am Horizont (Zylinder mit 7 Ecken, rötlicher Fels) ---
  const fels = streuen(bahn, raster, r, 26, { dMin: 900, dMax: 3000 }).map((p) => {
    const rad = r.range(110, 320), h = r.range(70, 210);
    return { x: p.x, y: h / 2 - 8, z: p.z, sx: rad, sy: h, sz: rad * r.range(0.6, 1), ry: r.range(0, 6.3), farbe: [0.36 + r() * 0.1, 0.15 + r() * 0.05, 0.07] };
  });
  gruppe.add(instanzen(new THREE.CylinderGeometry(0.82, 1, 1, 7), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), fels, 'tafelberge'));
  // --- Raumhafen ---
  const leucht = [];   // Leuchtpunkte (Warnlichter, Pistenlichter)
  const bauten = [];   // Boxen (Hangars, Türme, Plattformen)
  const radar = [];    // Radarschüsseln
  const metall = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.6 });
  // Startbahn: Pistenlichter an beiden Fahrbahnkanten, Lauflicht-Rhythmus über die Phase
  const sb = abschnitt(bahn, 'Startbahn');
  if (sb) for (let s = sb.s0 - 300; s < sb.s0 + sb.len + 600; s += 18) for (const sg of [1, -1]) {
    const p = anBahn(bahn, s, sg * (bahn.hw[Math.round(s / bahn.ds) % bahn.N] + 1.4), -0.6);
    leucht.push({ x: p.x, y: p.y, z: p.z, g: 0.7, farbe: sg > 0 ? [3.5, 1.6, 0.4] : [0.6, 2.6, 3.5] });
  }
  // Rakete im Silo neben dem Riesensprung (links der Flugbahn), Startturm daneben, Silo-Ring am Boden
  const ls = abschnitt(bahn, 'Raketensilo Mitte');
  const rakete = new THREE.Group(); rakete.name = 'rakete';
  if (ls) {
    const p = anBahn(bahn, ls.s0 + 160, 75, 0);   // vorn links der Flugbahn: im Flug gut im Bild
    const boden = Math.min(0, huegel(p.x, p.z)) - 4;
    const weiss = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.4, metalness: 0.3, emissive: 0x201510 });
    const rumpf = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 130, 20), weiss); rumpf.position.set(0, 65 + 18, 0);
    const spitze = new THREE.Mesh(new THREE.ConeGeometry(7, 26, 20), weiss); spitze.position.set(0, 130 + 18 + 13, 0);
    const streifen = new THREE.Mesh(new THREE.CylinderGeometry(7.15, 7.15, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 0.9, 0.2) }));
    streifen.position.set(0, 120, 0);
    const streifen2 = streifen.clone(); streifen2.position.y = 60;
    rakete.add(rumpf, spitze, streifen, streifen2);
    for (const sg of [1, -1]) {   // Seiten-Booster
      const bo = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 60, 14), weiss); bo.position.set(sg * 10, 48, 0);
      const ko = new THREE.Mesh(new THREE.ConeGeometry(3, 10, 14), weiss); ko.position.set(sg * 10, 83, 0);
      rakete.add(bo, ko);
    }
    const duese = new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 10, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.5, 0.4), side: THREE.DoubleSide }));
    duese.position.set(0, 14, 0); rakete.add(duese);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(26, 1.4, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.4, 0.3) }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 1, 0); rakete.add(ring);
    rakete.position.set(p.x, boden, p.z);
    gruppe.add(rakete);
    // Startturm (Gitter-Anmutung: Box + Leuchtkanten) neben der Rakete
    bauten.push({ x: p.x + 22, y: boden + 85, z: p.z, sx: 9, sy: 170, sz: 9, farbe: 0x3a3a40 });
    for (let h = 20; h <= 170; h += 30) leucht.push({ x: p.x + 22, y: boden + h, z: p.z + 4.8, g: 1.6, farbe: [4, 0.25, 0.1] });
    // Leuchtschrift-Masten entlang der Lücke (Anflug-Orientierung im langen Flug)
    for (let k = 0; k <= 6; k++) for (const sg of [1, -1]) {
      const q = anBahn(bahn, ls.s0 - 250 + k * 100, sg * 45, 0);
      const y0 = Math.min(0, huegel(q.x, q.z)) - 2;
      bauten.push({ x: q.x, y: y0 + 30, z: q.z, sx: 2, sy: 60, sz: 2, farbe: 0x2a2a2e });
      leucht.push({ x: q.x, y: y0 + 61, z: q.z, g: 2.4, farbe: k % 2 ? [3.5, 1.4, 0.3] : [0.4, 2.4, 3.6] });
    }
  }
  // Hangar um den Hangar-Tunnel: Dach + zwei Wände, innen Lichtbänder
  const hg = abschnitt(bahn, 'Hangar');
  if (hg) {
    const a = anBahn(bahn, hg.s0 - 20), b = anBahn(bahn, hg.s0 + hg.len + 20);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, len = Math.hypot(b.x - a.x, b.z - a.z), ry = Math.atan2(b.x - a.x, b.z - a.z);
    const y0 = Math.min(a.y, b.y) - 6;
    const ex = Math.cos(ry), ez = -Math.sin(ry);
    bauten.push({ x: mx, y: y0 + 34, z: mz, sx: 70, sy: 3, sz: len, ry, farbe: 0x4a4038 });
    for (const sg of [1, -1]) bauten.push({ x: mx + ex * sg * 36, y: y0 + 17, z: mz + ez * sg * 36, sx: 3, sy: 34, sz: len, ry, farbe: 0x3a3028 });
    for (let k = 0; k <= 8; k++) {
      const t = k / 8 - 0.5;
      for (const sg of [1, -1]) leucht.push({ x: mx + Math.sin(ry) * len * t + ex * sg * 30, y: y0 + 31, z: mz + Math.cos(ry) * len * t + ez * sg * 30, g: 1.2, farbe: [3.2, 2.6, 1.6] });
    }
    // Schriftzug-Ersatz: zwei breite Leuchtbalken über dem Tor
    for (const p of [a, b]) bauten.push({ x: p.x, y: y0 + 38, z: p.z, sx: 60, sy: 1.6, sz: 1.6, ry, farbe: [4, 1.2, 0.3], leucht: true });
  }
  // Weitere Raumhafen-Bauten abseits (Hangars, Kontrolltürme, Tanks) mit roten Dachlichtern
  for (const p of streuen(bahn, raster, r, 40, { dMin: 90, dMax: 700 })) {
    const art = r();
    const y0 = Math.min(huegel(p.x, p.z), p.y - 12) - 2;
    if (art < 0.5) {
      const w = r.range(30, 70), h = r.range(12, 28), t = r.range(40, 90);
      bauten.push({ x: p.x, y: y0 + h / 2, z: p.z, sx: w, sy: h, sz: t, ry: r.range(0, 3.14), farbe: r.pick([0x5a4c40, 0x6a5a4a, 0x4a4440]) });
      leucht.push({ x: p.x, y: y0 + h + 1, z: p.z, g: 1.4, farbe: [4, 0.3, 0.12] });
    } else if (art < 0.8) {
      const h = r.range(40, 90);
      bauten.push({ x: p.x, y: y0 + h / 2, z: p.z, sx: 6, sy: h, sz: 6, farbe: 0x3a3a40 });
      bauten.push({ x: p.x, y: y0 + h, z: p.z, sx: 16, sy: 7, sz: 16, farbe: 0x2a2a30 });
      leucht.push({ x: p.x, y: y0 + h + 4, z: p.z + 8.2, g: 1.6, farbe: [0.4, 2.8, 3.8] });
      leucht.push({ x: p.x, y: y0 + h + 8, z: p.z, g: 1.4, farbe: [4, 0.3, 0.12] });
    } else {
      // Radarschüssel: Halbkugel auf Sockel (schräg nach oben)
      radar.push({ x: p.x, y: y0 + 14, z: p.z, s: r.range(8, 14), ry: r.range(0, 6.3) });
      bauten.push({ x: p.x, y: y0 + 6, z: p.z, sx: 3, sy: 12, sz: 3, farbe: 0x444444 });
    }
  }
  gruppe.add(instanzen(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfc8c0, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }),
    radar.map((d) => ({ x: d.x, y: d.y, z: d.z, sx: d.s, sy: d.s * 0.35, sz: d.s, rx: Math.PI * 0.7, ry: d.ry })), 'radar'));
  const fest = bauten.filter((b) => !b.leucht), hell = bauten.filter((b) => b.leucht);
  gruppe.add(instanzen(new THREE.BoxGeometry(1, 1, 1), metall, fest, 'bauten'));
  if (hell.length) gruppe.add(instanzen(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), hell, 'leuchtbalken'));
  const lp = leuchtpunkte(leucht, { blink: 0.7, anteil: 0.35 });
  gruppe.add(lp);
  // --- Sandsturm: feine, warme Körner, Wind von Westen (der Sonne her) ---
  const sand = new Regen(scene, { anzahl: 3500, fall: 1.5, wind: [26, -1, -9], laenge: 0.03, breite: 0.05, hell: 0.32, farbe: [1.0, 0.62, 0.32], box: [90, 40, 90] });
  return {
    gruppe,
    update(dt, t, kamPos, kamVel, opt = {}) {
      lp.u.uZeit.value = t; lp.u.uRuhig.value = opt.ruhig ? 1 : 0;
      sand.update(dt, kamPos, kamVel, 1);
    },
    dispose() { entsorgen(gruppe); sand.dispose(); },
  };
}
