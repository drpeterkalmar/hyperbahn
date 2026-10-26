// Kulisse „Orbital-Ring“ (P2): Raumstation über der Erde – schwarzer Himmel mit Sternen, die Erde groß unter der Station
// (im Himmels-Shader, unendlich weit), harte weiße Sonne, Stationsring mit Solarflügeln und Modulen, gläserne Trommel um
// die Schrauben-Wandfahrt, blaue Tore an den Grenzen der schwachen Schwerkraft, schwebender Sternenstaub. Prozedural,
// Instancing; die Bahn hat im All keine Stützen.
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { Regen } from './regen.js';
import { bahnRaster, streuen, instanzen, leuchtpunkte, abschnitt, entsorgen } from './kulisse_kern.js';
import { F_SCHWACH } from '../track/bahn.js';

const SONNE = [0.55, 0.42, -0.72];

export const THEMA = {
  himmel: { oben: [0.0, 0.0, 0.004], horizont: [0.002, 0.004, 0.012], glut: [0, 0, 0], boden: [0.0, 0.0, 0.004], wolken: 0,
    sterne: 1, sonne: { dir: SONNE, farbe: [4, 3.8, 3.4], staerke: 0.5 }, erde: { dir: [0.15, -1, 0.35], groesse: 0.72 } },
  nebel: { farbe: 0x02030a, dichte: 0.00004 },
  licht: { hemi: [0x6a8ac8, 0x1a2a4a, 0.55], richtung: { farbe: 0xffffff, staerke: 1.6, dir: SONNE } },
  grade: 'orbit',
  dunst: { farbe: 0x1a3a6a, aerial: { density: 0.00002, falloff: 0.001, base: 0, max: 0.1 } },
  sonneKino: SONNE,
  umgebung: { grund: 0x03050c, farben: [0xffffff, 0x4a8cff, 0xb18cff, 0x00e5ff, 0xffd400, 0x2a6aff], hell: 2.6, oben: 0x2a4a8a },
  look: {
    fahrbahn: { farbe: 0x0c0e14, rau: 0.3, metall: 0.7, linie: [0.7, 0.55, 1.0], linieStaerke: 1.5 },
    kante: { links: [0.7, 0.45, 1.0], rechts: [0.2, 0.8, 1.0] },
    deck: { farbe: 0x2a2e38, rau: 0.4, metall: 0.8 },
    wand: { farbe: 0x1a2040, deckkraft: 0.4, glimmen: 0x10184a },
    stuetze: { an: false },
    nass: 0.3,
  },
};

export function baueKulisse(bahn, { scene } = {}) {
  const r = rng(77);
  const gruppe = new THREE.Group(); gruppe.name = 'kulisse-orbit';
  const raster = bahnRaster(bahn), B = raster.box;
  const mx = (B.x0 + B.x1) / 2, mz = (B.z0 + B.z1) / 2, rad = Math.hypot(B.x1 - B.x0, B.z1 - B.z0) / 2;
  const metall = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.85 });
  // Stationsring: großer Torus um die ganze Strecke, darunter (Träger der Station)
  const ringY = B.y0 - 160;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(rad + 500, 38, 12, 128), new THREE.MeshStandardMaterial({ color: 0x8a90a0, roughness: 0.4, metalness: 0.8 }));
  ring.rotation.x = Math.PI / 2; ring.position.set(mx, ringY, mz); ring.name = 'stationsring';
  gruppe.add(ring);
  // Speichen vom Ring zur Nabe + Nabe
  const speichen = [];
  for (let k = 0; k < 8; k++) {
    const w = k / 8 * Math.PI * 2, L = rad + 500;
    speichen.push({ x: mx + Math.cos(w) * L / 2, y: ringY, z: mz + Math.sin(w) * L / 2, sx: L, sy: 10, sz: 10, ry: -w, farbe: 0x6a7080 });
  }
  const nabe = new THREE.Mesh(new THREE.CylinderGeometry(160, 160, 120, 32), new THREE.MeshStandardMaterial({ color: 0x9aa0b0, roughness: 0.3, metalness: 0.8, emissive: 0x0a1030 }));
  nabe.position.set(mx, ringY, mz); gruppe.add(nabe);
  // Solarflügel: flache, blaue Paneele mit Leuchtraster (instanziert), paarweise am Ring
  const paneele = [];
  for (let k = 0; k < 24; k++) {
    const w = k / 24 * Math.PI * 2 + 0.13, L = rad + 500;
    for (const off of [-1, 1]) paneele.push({ x: mx + Math.cos(w) * (L + off * 150), y: ringY + 30, z: mz + Math.sin(w) * (L + off * 150), sx: 220, sy: 2, sz: 90, ry: -w, farbe: [0.12, 0.2, 0.5] });
  }
  const panMat = new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.6, emissive: 0x0a1a4a });
  panMat.onBeforeCompile = (sh) => {   // Zellenraster (Weltkoordinaten), schwach leuchtend
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      vec2 g = abs(fract(vWP.xz / 9.0) - 0.5);
      totalEmissiveRadiance += vec3(0.25, 0.45, 1.0) * (1.0 - smoothstep(0.0, 0.04, min(g.x, g.y))) * 0.6;`);
  };
  gruppe.add(instanzen(new THREE.BoxGeometry(1, 1, 1), panMat, paneele, 'solarfluegel'));
  // Module (Habitat-Zylinder und Kästen) abseits der Bahn mit Positionslichtern
  const module = [], leucht = [];
  for (const p of streuen(bahn, raster, r, 70, { dMin: 120, dMax: 1400 })) {
    const y = p.y + r.range(-160, 60), l = r.range(30, 90);
    module.push({ x: p.x, y, z: p.z, sx: r.range(14, 28), sy: l, sz: r.range(14, 28), ry: r.range(0, 6.3), rz: r() < 0.5 ? Math.PI / 2 : 0, farbe: r.pick([0xb0b4c0, 0x8a8f9c, 0xd0d0d8]) });
    leucht.push({ x: p.x, y: y + l / 2 + 2, z: p.z, g: 1.6, farbe: r() < 0.5 ? [4, 0.3, 0.2] : [0.3, 4, 0.6] });
  }
  gruppe.add(instanzen(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), metall, module, 'module'));
  gruppe.add(instanzen(new THREE.BoxGeometry(1, 1, 1), metall, speichen, 'speichen'));
  // Trommel: gläserner Zylinder um die Schrauben-Wandfahrt (Achse = Mittelpunkt der Windung), mit Leuchtringen
  const tr = abschnitt(bahn, 'Trommel');
  if (tr) {
    let cx = 0, cz = 0, n = 0, y0 = Infinity, y1 = -Infinity;
    for (let s = tr.s0 + 200; s < tr.s0 + tr.len - 200; s += 10) { const i = Math.round(s / bahn.ds) % bahn.N; cx += bahn.px[i]; cz += bahn.pz[i]; n++; y0 = Math.min(y0, bahn.py[i]); y1 = Math.max(y1, bahn.py[i]); }
    cx /= n; cz /= n;
    let R = 0; for (let s = tr.s0 + 300; s < tr.s0 + tr.len - 300; s += 20) { const i = Math.round(s / bahn.ds) % bahn.N; R = Math.max(R, Math.hypot(bahn.px[i] - cx, bahn.pz[i] - cz)); }
    const H = y1 - y0 + 90;
    const glas = new THREE.Mesh(new THREE.CylinderGeometry(R + 4, R + 4, H, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a2a5a, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, emissive: 0x0a1440 }));
    glas.position.set(cx, (y0 + y1) / 2, cz); glas.name = 'trommel';
    gruppe.add(glas);
    for (let k = 0; k <= 6; k++) {
      const rg = new THREE.Mesh(new THREE.TorusGeometry(R + 5, 0.9, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(k % 2 ? 0.5 : 2.4, 1.4, 4) }));
      rg.rotation.x = Math.PI / 2; rg.position.set(cx, y0 - 45 + k * H / 6, cz);
      gruppe.add(rg);
    }
  }
  // Schwerkraft-Tore: blaue Ringe an jeder Grenze einer Zone mit schwacher Schwerkraft (im Bahn-Rahmen)
  const tore = [];
  for (let i = 0; i < bahn.N; i++) {
    const j = (i + 1) % bahn.N, a = bahn.flags[i] & F_SCHWACH, b = bahn.flags[j] & F_SCHWACH;
    if (!a === !b) continue;
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(bahn.slx[j], bahn.sly[j], bahn.slz[j]), new THREE.Vector3(bahn.sux[j], bahn.suy[j], bahn.suz[j]), new THREE.Vector3(bahn.tx[j], bahn.ty[j], bahn.tz[j]));
    const R = bahn.hw[j] + 5;
    m.scale(new THREE.Vector3(R, R, R)).setPosition(bahn.px[j] + bahn.sux[j] * 2, bahn.py[j] + bahn.suy[j] * 2, bahn.pz[j] + bahn.suz[j] * 2);
    tore.push(m);
  }
  if (tore.length) {
    const im = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.035, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.4, 4.5) }), tore.length);
    tore.forEach((m, k) => im.setMatrixAt(k, m)); im.name = 'schwerkraft-tore';
    gruppe.add(im);
  }
  const lp = leuchtpunkte(leucht, { blink: 1.0, anteil: 0.6 });
  gruppe.add(lp);
  // Sternenstaub: feine helle Teilchen, die fast stillstehen (Tempo-Gefühl im leeren Raum)
  const staub = new Regen(scene, { anzahl: 1800, fall: 0, wind: [0.4, 0.1, 0.2], laenge: 0.012, breite: 0.04, hell: 0.35, farbe: [0.8, 0.85, 1.0], box: [90, 60, 90] });
  return {
    gruppe,
    update(dt, t, kamPos, kamVel, opt = {}) {
      lp.u.uZeit.value = t; lp.u.uRuhig.value = opt.ruhig ? 1 : 0;
      ring.rotation.z = t * 0.004; nabe.rotation.y = t * 0.004;
      staub.update(dt, kamPos, kamVel, 1);
    },
    dispose() { entsorgen(gruppe); staub.dispose(); },
  };
}
