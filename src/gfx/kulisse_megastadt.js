// Kulisse „Neon-Megastadt“ (Strecke 1): Wolkenkratzer-Stadt (stadt.js) + Regen – wie bis 0.1.9, nur hinter der
// gemeinsamen Kulissen-Schnittstelle (P2): THEMA (Himmel, Nebel, Licht, Farbkorrektur, Bahn-Look) + baueKulisse(bahn, opt)
// → { gruppe, update(dt, t, kameraPos, kameraVel), dispose() }.
import * as THREE from 'three';
import { HIMMEL } from './himmel.js';
import { baueStadt } from './stadt.js';
import { Regen } from './regen.js';

export const THEMA = {
  himmel: HIMMEL,
  nebel: { farbe: 0x0a0614, dichte: 0.00075 },
  licht: { hemi: [0x3a2a6a, 0x05030a, 0.5], richtung: { farbe: 0x8fb4ff, staerke: 0.35, dir: [-0.4, 1, 0.3] } },
  grade: 'neonnoir',
  umgebung: {},
  look: {},
};

export function baueKulisse(bahn, { scene, blitze } = {}) {
  const gruppe = new THREE.Group(); gruppe.name = 'kulisse-megastadt';
  const stadt = baueStadt(bahn, { seed: 11, blitze });
  gruppe.add(stadt.gruppe);
  const regen = new Regen(scene, {});
  return {
    gruppe, stadt,
    update(dt, t, kamPos, kamVel) { stadt.update(t); regen.update(dt, kamPos, kamVel, 1); },
    dispose() { stadt.dispose(); regen.dispose(); },
  };
}
