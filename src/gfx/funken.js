// Funken/Glut-Teilchen (Wandkontakt, Aufsetzer, Landung): ein Punkte-Pool, additiv, ein Draw-Call.
// Startwerte – TODO Heavy-Job: Größe/Farbe/Menge am Bild abstimmen.
import * as THREE from 'three';

export class Funken {
  constructor(scene, n = 600) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.leben = new Float32Array(n); this.farbe = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.farbe, 3));
    this.geo = g;
    this.punkte = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    this.punkte.frustumCulled = false;
    scene.add(this.punkte);
  }
  // p = Ort, v = Grundgeschwindigkeit (z. B. Gleiter), streu = Streuung m/s, col = [r,g,b] (HDR > 1 für Bloom)
  spruehe(p, v, anzahl = 30, streu = 14, col = [3, 1.6, 0.4]) {
    for (let k = 0; k < anzahl; k++) {
      const i = this.i; this.i = (this.i + 1) % this.n;
      this.pos.set([p.x, p.y, p.z], i * 3);
      this.vel.set([v.x * 0.85 + (Math.random() - 0.5) * streu, v.y * 0.85 + (Math.random() - 0.2) * streu, v.z * 0.85 + (Math.random() - 0.5) * streu], i * 3);
      this.leben[i] = 0.25 + Math.random() * 0.45;
      this.farbe.set(col, i * 3);
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.leben[i] <= 0) continue;
      this.leben[i] -= dt;
      const a = Math.max(0, this.leben[i]) / 0.7;
      this.vel[i * 3 + 1] -= 9.81 * dt;
      for (let c = 0; c < 3; c++) { this.pos[i * 3 + c] += this.vel[i * 3 + c] * dt; this.farbe[i * 3 + c] *= a > 0 ? Math.pow(0.9, dt * 60) : 0; }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}
