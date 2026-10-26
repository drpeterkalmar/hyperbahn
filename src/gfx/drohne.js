// Bergungs-Drohne (P1b, Vorlage „Abflug-Rettung“): nach einem Abflug schwebt eine kleine Neon-Drohne mit Zugstrahl über den
// Gleiter, hebt ihn an und bringt ihn zur Absetz-Stelle (Physik: Gleiter.respawn nach VORLAGE.bergung.zeit s).
// Ein Mesh je Gleiter, nur sichtbar während der Bergung; Rotoren/Strahl additiv (Bloom), kein Licht-Objekt (Handy-Budget).
import * as THREE from 'three';

const KOERPER = new THREE.MeshStandardMaterial({ color: 0x15121f, metalness: 0.8, roughness: 0.35, emissive: 0x2a0a3a, emissiveIntensity: 0.6 });

export function baueDrohne() {
  const gruppe = new THREE.Group();
  const rumpf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.6), KOERPER);
  gruppe.add(rumpf);
  const rotorMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 2.6), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const rotorGeo = new THREE.RingGeometry(0.35, 0.62, 20);
  const rotoren = [];
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const r = new THREE.Mesh(rotorGeo, rotorMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x * 1.05, 0.22, z * 1.05);
    gruppe.add(r); rotoren.push(r);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.1), KOERPER);
    arm.position.set(x * 0.55, 0.1, z * 0.55); arm.rotation.y = Math.atan2(x, z);
    gruppe.add(arm);
  }
  // Zugstrahl: offener Kegel nach unten (magenta), additiv
  const strahlMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.4, 2.0), transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const strahl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 2.6, 1, 20, 1, true), strahlMat);
  gruppe.add(strahl);
  gruppe.visible = false;
  return { gruppe, rotoren, strahl, strahlMat };
}

export class Bergung {
  constructor(scene) { this.scene = scene; this.drohnen = new Map(); }

  // je Bild: g = Physik-Gleiter, mesh = Gleiter-Mesh (wird während der Bergung angehoben), dauer = Bergungszeit (s)
  update(dt, g, mesh, dauer) {
    let d = this.drohnen.get(g);
    const an = g.zustand === 'absturz';
    if (!an) { if (d) d.gruppe.visible = false; return; }
    if (!d) { d = baueDrohne(); this.drohnen.set(g, d); this.scene.add(d.gruppe); }
    const t = Math.min(1, g.absturzZeit / Math.max(0.1, dauer));
    // Anflug (0–35 %): von 14 m auf 3,5 m über dem Gleiter; dann Heben (bis 100 %): Gleiter + Drohne steigen 6 m
    const anflug = Math.min(1, t / 0.35), heben = Math.max(0, (t - 0.35) / 0.65);
    const hoch = 14 - 10.5 * (1 - (1 - anflug) ** 2) + 6 * heben * heben;
    d.gruppe.visible = true;
    d.gruppe.position.set(g.p.x, g.p.y + hoch, g.p.z);
    d.gruppe.rotation.y += dt * 0.8;
    for (const r of d.rotoren) r.rotation.z += dt * 40;
    const lang = Math.max(0.5, hoch - 6 * heben * heben);
    d.strahl.scale.set(1, lang, 1); d.strahl.position.y = -lang / 2;
    d.strahlMat.opacity = 0.08 + 0.22 * anflug;
    if (mesh && heben > 0) {
      // Gleiter-Mesh mit anheben (die Physik steht während der Bergung still)
      mesh.gruppe.matrix.elements[13] += 6 * heben * heben;
      mesh.gruppe.matrixWorldNeedsUpdate = true;
    }
  }
}
