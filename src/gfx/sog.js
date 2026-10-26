// Windschatten-Schlieren (P3): im Sog strömen helle Luftschlieren vom Heck des Vordermanns am eigenen Gleiter vorbei –
// ein Linien-Pool (ein Draw-Call, additiv, HDR-Farben für den Bloom), Deckkraft ∝ Sog. Nur für den Spieler.
// Keine Allokation je Bild (feste Puffer, Zufall nur beim Bau).
import * as THREE from 'three';

export class SogSchlieren {
  constructor(scene, n = 64) {
    this.n = n;
    this.pos = new Float32Array(n * 6); this.farbe = new Float32Array(n * 6);
    // je Schliere: Phase entlang des Korridors, Winkel/Radius um die Achse, Länge, Tempo
    this.phase = new Float32Array(n); this.winkel = new Float32Array(n); this.radius = new Float32Array(n);
    this.laenge = new Float32Array(n); this.tempo = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      this.phase[k] = Math.random(); this.winkel[k] = Math.random() * Math.PI * 2; this.radius[k] = 0.6 + Math.random() * 2.2;
      this.laenge[k] = 0.08 + Math.random() * 0.1; this.tempo[k] = 0.9 + Math.random() * 0.8;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.farbe, 3));
    this.geo = g;
    this.linien = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.linien.frustumCulled = false; this.linien.visible = false;
    scene.add(this.linien);
    this.an = 0;
  }

  // g = eigener Gleiter (sog, sogNah, sogVor), vor = Gleiter des Vordermanns (oder null)
  update(dt, g, vor) {
    const ziel = vor && g.zustand === 'fahrt' ? g.sog * (0.5 + 0.5 * g.sogNah) : 0;
    this.an += (ziel - this.an) * Math.min(1, dt * 6);
    this.linien.visible = this.an > 0.02 && !!vor;
    if (!this.linien.visible) return;
    // Korridor: Heck des Vordermanns → knapp vor die eigene Nase; Achsen-Rahmen aus dem Vordermann
    const ax = vor.p.x - vor.vor.x * 2.4, ay = vor.p.y - vor.vor.y * 2.4 + vor.oben.y * 0.3, az = vor.p.z - vor.vor.z * 2.4;
    const bx = g.p.x + g.vor.x * 1.5 - ax, by = g.p.y + g.vor.y * 1.5 + 0.3 - ay, bz = g.p.z + g.vor.z * 1.5 - az;
    const L = vor.links, O = vor.oben;
    for (let k = 0; k < this.n; k++) {
      let f = this.phase[k] + dt * this.tempo[k] * 1.6;
      if (f >= 1) { f -= 1; this.winkel[k] = Math.random() * Math.PI * 2; }
      this.phase[k] = f;
      const f2 = Math.min(1, f + this.laenge[k]);
      // Schlieren weiten sich zum eigenen Gleiter hin auf (Luft strömt um ihn herum)
      const c = Math.cos(this.winkel[k]), s = Math.sin(this.winkel[k]);
      for (let e = 0; e < 2; e++) {
        const t = e ? f2 : f, r = this.radius[k] * (0.45 + 0.9 * t);
        const ox = (L.x * c + O.x * s * 0.6) * r, oy = (L.y * c + O.y * s * 0.6) * r, oz = (L.z * c + O.z * s * 0.6) * r;
        const i = k * 6 + e * 3;
        this.pos[i] = ax + bx * t + ox; this.pos[i + 1] = ay + by * t + oy; this.pos[i + 2] = az + bz * t + oz;
        // Ein-/Ausblenden entlang des Korridors, kühles Cyan-Weiß (HDR)
        const h = this.an * Math.sin(Math.PI * t) * (e ? 1 : 0.35);
        this.farbe[i] = 2.2 * h; this.farbe[i + 1] = 4.0 * h; this.farbe[i + 2] = 4.8 * h;
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}
