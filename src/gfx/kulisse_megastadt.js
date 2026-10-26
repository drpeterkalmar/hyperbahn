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

// stadtPlan (P3 Etappe 2): Promise auf den Stadt-Plan aus dem Plan-Worker – dann steht die Bahn sofort und die Stadt kommt
// dazu, sobald der Plan da ist (bei CPU ×4 ≈ 0,6 s Rechenzeit weniger im Hauptfaden); ohne: wie bisher sofort
export function baueKulisse(bahn, { scene, blitze, stadtPlan = null } = {}) {
  const gruppe = new THREE.Group(); gruppe.name = 'kulisse-megastadt';
  const regen = new Regen(scene, {});
  let stadt = null, weg = false;
  const bau = (plan) => { if (weg) return; stadt = baueStadt(bahn, { seed: 11, blitze, plan }); gruppe.add(stadt.gruppe); k.stadt = stadt; };
  const k = {
    gruppe, stadt: null,
    bereit: stadtPlan ? stadtPlan.then((p) => bau(p), () => bau(null)) : Promise.resolve(),
    update(dt, t, kamPos, kamVel) { if (stadt) stadt.update(t); regen.update(dt, kamPos, kamVel, 1); },
    dispose() { weg = true; if (stadt) stadt.dispose(); regen.dispose(); },
  };
  if (!stadtPlan) bau(null);
  return k;
}
