// Regen-Streifen um die Kamera (ein Draw-Call): dünne Quads als InstancedMesh, im Shader entlang der Relativgeschwindigkeit
// (Fallen + Fahrtwind) gestreckt – bei 150 m/s kommen die Tropfen fast waagrecht von vorn. Wrap-Around in einer Box um die
// Kamera, daher keine Neuverteilung auf der CPU je Bild. Startwerte – TODO Heavy-Job: Dichte/Länge/Helligkeit am Bild.
import * as THREE from 'three';

export const REGEN = { box: [70, 46, 70], fall: 22, laenge: 0.035, breite: 0.025, hell: 0.55, farbe: [0.6, 0.75, 1.0] };

export class Regen {
  constructor(scene, { anzahl = 6000 } = {}) {
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, -0.5, 0);   // Ursprung am Kopf des Streifens
    const off = new Float32Array(anzahl * 3), zuf = new Float32Array(anzahl);
    let s = 1234567;
    const r = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < anzahl; i++) { off[i * 3] = r(); off[i * 3 + 1] = r(); off[i * 3 + 2] = r(); zuf[i] = r(); }
    quad.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
    quad.setAttribute('aZuf', new THREE.InstancedBufferAttribute(zuf, 1));
    this.u = {
      uKamera: { value: new THREE.Vector3() }, uVel: { value: new THREE.Vector3(0, -REGEN.fall, 0) }, uWeg: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(...REGEN.box) }, uStaerke: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u,
      vertexShader: `
        attribute vec3 aOff; attribute float aZuf;
        uniform vec3 uKamera, uVel, uBox, uWeg;
        varying float vA, vV;
        void main() {
          // Lage im Kasten um die Kamera (wrap-around), Fallen mit leicht unterschiedlichem Tempo je Tropfen
          vec3 p = aOff * uBox + uWeg * (0.8 + 0.4 * aZuf);
          p = mod(p - uKamera + uBox * 0.5, uBox) - uBox * 0.5 + uKamera;
          // Streifen: Länge = Geschwindigkeit × Belichtung, quer zur Blickrichtung ausgerichtet
          vec3 d = uVel * ${REGEN.laenge.toFixed(3)};
          vec3 zurKam = normalize(cameraPosition - p);
          vec3 quer = normalize(cross(normalize(d), zurKam)) * ${REGEN.breite.toFixed(3)} * (1.0 + 2.0 * aZuf);
          vec3 w = p - d * position.y + quer * position.x;
          vA = 1.0 - smoothstep(0.35, 0.5, length((p - uKamera) / uBox));
          vV = position.y;
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: `
        uniform float uStaerke; varying float vA, vV;
        void main() {
          float a = vA * uStaerke * ${REGEN.hell.toFixed(2)} * (0.4 + 0.6 * (1.0 + vV));
          gl_FragColor = vec4(vec3(${REGEN.farbe.join(', ')}) * a, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(quad, mat, anzahl);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  // kameraVel = Geschwindigkeit des Gleiters (Fahrtwind = −v), staerke 0…1
  update(dt, kameraPos, kameraVel, staerke = 1) {
    // Tropfen fallen in der Welt (Fall-Weg auf der CPU summiert); die Streifen zeigen die Relativgeschwindigkeit zur Kamera
    this.u.uVel.value.set(-kameraVel.x, -REGEN.fall - kameraVel.y, -kameraVel.z);
    const w = this.u.uWeg.value;
    w.y = (w.y - REGEN.fall * dt) % (REGEN.box[1] * 50);
    this.u.uKamera.value.set(kameraPos.x, kameraPos.y, kameraPos.z);
    this.u.uStaerke.value = staerke;
  }

  setzeAn(an) { this.mesh.visible = !!an; }
}
