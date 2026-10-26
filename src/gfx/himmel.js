// Himmel je Strecke (Kuppel-Shader, ein Draw-Call) und eine kleine Umgebung als Environment-Map (PMREM) für Spiegelungen
// auf Fahrbahn und Lack. Megastadt (Standard): fast schwarz oben, Stadtglühen magenta/violett am Horizont, Wolken von unten
// angestrahlt. P2: alle Farben sind Uniforms – setzeThema(t) wechselt den Himmel ohne Neubau; dazu Sonne (Scheibe + Hof),
// Sterne, Wasseroberfläche von unten (Riff: Lichtflecken), Blitz-Aufhellung der Wolken (Gewitter).
import * as THREE from 'three';

// Megastadt (bis 0.1.9 fest im Shader)
export const HIMMEL = { oben: [0.005, 0.006, 0.014], horizont: [0.16, 0.035, 0.2], glut: [0.5, 0.08, 0.42], wolken: 0.55, wolkenFarbe: [0.22, 0.05, 0.25] };

const v3 = (a) => new THREE.Vector3(...a);

export function baueHimmel(thema = HIMMEL) {
  const u = {
    uZeit: { value: 0 }, uOben: { value: v3(HIMMEL.oben) }, uHorizont: { value: v3(HIMMEL.horizont) }, uGlut: { value: v3(HIMMEL.glut) },
    uWolken: { value: HIMMEL.wolken }, uWolkenFarbe: { value: v3(HIMMEL.wolkenFarbe) }, uWolkenTempo: { value: 0.01 },
    uSonneDir: { value: new THREE.Vector3(0, 1, 0) }, uSonneFarbe: { value: new THREE.Vector3() }, uSonne: { value: 0 },
    uSterne: { value: 0 }, uWasser: { value: 0 }, uBlitz: { value: 0 }, uBoden: { value: v3(HIMMEL.horizont) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: 'varying vec3 vR; void main() { vR = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform float uZeit, uWolken, uWolkenTempo, uSonne, uSterne, uWasser, uBlitz;
      uniform vec3 uOben, uHorizont, uGlut, uWolkenFarbe, uSonneDir, uSonneFarbe, uBoden;
      varying vec3 vR;
      float h1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      float rau(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        vec3 d = normalize(vR);
        float y = clamp(d.y, -1.0, 1.0);
        vec3 c = mix(uHorizont, uOben, smoothstep(0.0, 0.45, y));
        c = mix(c, uBoden, smoothstep(0.0, -0.25, y));
        c += uGlut * pow(1.0 - abs(y), 12.0) * 0.6;
        // Wolkendecke (Megastadt: von der Stadt angestrahlt; Gewitter: Blitze hellen sie auf)
        vec2 w = d.xz / max(0.08, d.y + 0.15) * 1.6 + vec2(uZeit * uWolkenTempo, 0.0);
        float wo = smoothstep(0.45, 0.85, rau(w) * 0.6 + rau(w * 2.7) * 0.4) * smoothstep(-0.05, 0.3, y);
        c += uWolkenFarbe * wo * uWolken * (1.0 - y) * (1.0 + uBlitz * 6.0);
        c += vec3(0.55, 0.6, 0.9) * uBlitz * 0.35 * smoothstep(-0.1, 0.4, y);
        // Sonne: Scheibe + weicher Hof (HDR → Bloom)
        float cs = max(dot(d, uSonneDir), 0.0);
        c += uSonneFarbe * uSonne * (pow(cs, 900.0) * 6.0 + pow(cs, 24.0) * 0.35 + pow(cs, 4.0) * 0.08);
        // Sterne (Weltall): feines Raster, Zufall je Zelle, leicht funkelnd
        if (uSterne > 0.0) {
          vec2 sp = vec2(atan(d.z, d.x) * 180.0, asin(y) * 180.0);
          vec2 zi = floor(sp); float z = h1(zi);
          float st = step(0.985, z) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5)) * (0.6 + 0.4 * sin(uZeit * 2.0 + z * 60.0));
          c += vec3(0.9, 0.95, 1.0) * st * uSterne * (1.5 + 3.0 * step(0.997, z));
        }
        // Wasseroberfläche von unten (Riff): helle, wandernde Lichtflecken nach oben hin
        if (uWasser > 0.0) {
          vec2 q = d.xz / max(0.12, d.y) * 3.0;
          float k = rau(q + vec2(uZeit * 0.15, uZeit * 0.1)) * rau(q * 1.7 - vec2(uZeit * 0.12, 0.0));
          c += vec3(0.5, 0.95, 1.0) * smoothstep(0.25, 0.6, k) * smoothstep(0.1, 0.8, y) * uWasser;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  m.u = u;
  m.update = (t, kameraPos) => { u.uZeit.value = t; m.position.copy(kameraPos); };
  // thema = { oben, horizont, glut, wolken, wolkenFarbe, wolkenTempo, boden, sonne: { dir, farbe, staerke }, sterne, wasser }
  m.setzeThema = (t = HIMMEL) => {
    u.uOben.value.fromArray(t.oben || HIMMEL.oben); u.uHorizont.value.fromArray(t.horizont || HIMMEL.horizont);
    u.uGlut.value.fromArray(t.glut || [0, 0, 0]); u.uWolken.value = t.wolken ?? 0;
    u.uWolkenFarbe.value.fromArray(t.wolkenFarbe || HIMMEL.wolkenFarbe); u.uWolkenTempo.value = t.wolkenTempo ?? 0.01;
    u.uBoden.value.fromArray(t.boden || t.horizont || HIMMEL.horizont);
    const s = t.sonne;
    u.uSonne.value = s ? s.staerke ?? 1 : 0;
    if (s) { u.uSonneDir.value.fromArray(s.dir).normalize(); u.uSonneFarbe.value.fromArray(s.farbe); }
    u.uSterne.value = t.sterne || 0; u.uWasser.value = t.wasser || 0;
  };
  m.setzeThema(thema);
  return m;
}

// Kleine Neon-Szene → PMREM-Environment (einmal je Strecke): dunkle Kuppel + leuchtende Tafeln ringsum
// (P2: Farben/Grund je Thema – Wüste warm, Riff türkis, Orbit weiß-blau)
export function neonUmgebung(renderer, { grund = 0x07040d, farben = [0x00e5ff, 0xff2bd6, 0x9b5cff, 0xffd400, 0x00ffa0, 0xff3b3b], hell = 3, oben = null } = {}) {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: grund, side: THREE.BackSide })));
  for (let k = 0; k < 18; k++) {
    const a = k / 18 * Math.PI * 2, h = 2 + (k % 3) * 4;
    const tafel = new THREE.Mesh(new THREE.PlaneGeometry(6 + (k % 4) * 3, 2 + (k % 2) * 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(farben[k % farben.length]).multiplyScalar(hell), side: THREE.DoubleSide }));
    tafel.position.set(Math.cos(a) * 40, h, Math.sin(a) * 40);
    tafel.lookAt(0, h, 0);
    sc.add(tafel);
  }
  if (oben) {   // helle Kuppel oben (Tageslicht/Wasseroberfläche)
    const d = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(oben), side: THREE.DoubleSide }));
    d.position.set(0, 40, 0); d.rotation.x = Math.PI / 2; sc.add(d);
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(sc, 0.02);
  pm.dispose();
  sc.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
