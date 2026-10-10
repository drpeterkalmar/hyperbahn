// Nachthimmel (Kuppel-Shader: fast schwarz oben, Stadtglühen magenta/violett am Horizont, Wolken von unten angestrahlt)
// und eine kleine Neon-Umgebung als Environment-Map (PMREM) für Spiegelungen auf nasser Fahrbahn und Lack.
// Startwerte – TODO Heavy-Job: am Bild abstimmen.
import * as THREE from 'three';

export const HIMMEL = { oben: [0.005, 0.006, 0.014], horizont: [0.16, 0.035, 0.2], glut: [0.5, 0.08, 0.42], wolken: 0.55 };

export function baueHimmel() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uZeit: { value: 0 } },
    vertexShader: 'varying vec3 vR; void main() { vR = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform float uZeit; varying vec3 vR;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float rau(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 d = normalize(vR);
        float y = clamp(d.y, -1.0, 1.0);
        vec3 c = mix(vec3(${HIMMEL.horizont.join(', ')}), vec3(${HIMMEL.oben.join(', ')}), smoothstep(0.0, 0.45, y));
        c += vec3(${HIMMEL.glut.join(', ')}) * pow(1.0 - abs(y), 12.0) * 0.6;
        // Wolkendecke, von der Stadt angestrahlt
        vec2 w = d.xz / max(0.08, d.y + 0.15) * 1.6 + vec2(uZeit * 0.01, 0.0);
        float wo = smoothstep(0.45, 0.85, rau(w) * 0.6 + rau(w * 2.7) * 0.4) * smoothstep(-0.05, 0.3, y);
        c += vec3(0.22, 0.05, 0.25) * wo * ${HIMMEL.wolken.toFixed(2)} * (1.0 - y);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  m.update = (t, kameraPos) => { mat.uniforms.uZeit.value = t; m.position.copy(kameraPos); };
  return m;
}

// Kleine Neon-Szene → PMREM-Environment (einmal beim Start): dunkle Kuppel + leuchtende Schilder ringsum
export function neonUmgebung(renderer) {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: 0x07040d, side: THREE.BackSide })));
  const farben = [0x00e5ff, 0xff2bd6, 0x9b5cff, 0xffd400, 0x00ffa0, 0xff3b3b];
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2, h = 2 + (k % 3) * 4;
    const tafel = new THREE.Mesh(new THREE.PlaneGeometry(6 + (k % 4) * 3, 2 + (k % 2) * 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(farben[k % farben.length]).multiplyScalar(3), side: THREE.DoubleSide }));
    tafel.position.set(Math.cos(a) * 40, h, Math.sin(a) * 40);
    tafel.lookAt(0, h, 0);
    sc.add(tafel);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sc, 0.02);
  pm.dispose();
  return rt.texture;
}
