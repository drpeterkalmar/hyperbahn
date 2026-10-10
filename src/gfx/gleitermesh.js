// Gleiter-Modelle (sauber selbst modelliert aus Grundkörpern – keine fremden Designs): 4 fiktive Bauformen, Teamfarbe als
// Lack + Emissive-Streifen, Antriebsglühen (Düsen + Flamme, länger bei Boost), Lichtspur (Band aus den letzten Positionen).
// Modell-Raum: +z = vor (Nase), +y = oben, +x = links → Weltmatrix aus (links, oben, vor) des Physik-Gleiters.
// Sketchfab-Modelle (CC0/CC-BY per Token) kann der Heavy-Job später als glTF einsetzen: Schnittstelle bleibt
// { gruppe, setzeLage(g, alpha), update(dt, zustand) }.
import * as THREE from 'three';

export const BAUFORMEN = {
  pfeil: { name: 'Pfeil', laenge: 4.6, breite: 2.3, hoehe: 0.75, nase: 1.9, fluegel: 1.1, flosse: 0.9, duesen: 2 },
  klinge: { name: 'Klinge', laenge: 5.0, breite: 1.9, hoehe: 0.6, nase: 2.4, fluegel: 1.4, flosse: 0.5, duesen: 1 },
  hammer: { name: 'Hammer', laenge: 4.2, breite: 2.7, hoehe: 0.9, nase: 1.3, fluegel: 0.8, flosse: 1.1, duesen: 2 },
  stachel: { name: 'Stachel', laenge: 4.8, breite: 2.1, hoehe: 0.7, nase: 2.2, fluegel: 1.6, flosse: 0.7, duesen: 3 },
};
export const BAUFORM_LISTE = Object.keys(BAUFORMEN);
const SPUR_N = 48;

// Keil-Rumpf als eigene Geometrie: spitze Nase, breites Heck, flacher Boden
function rumpf(f) {
  const L = f.laenge, B = f.breite / 2, H = f.hoehe, n = f.nase;
  const v = [
    // Nase
    0, 0.05, L / 2,
    // Schulter (Ende der Nase)
    B * 0.55, 0, L / 2 - n, -B * 0.55, 0, L / 2 - n, 0, H * 0.8, L / 2 - n,
    // Heck
    B, 0, -L / 2, -B, 0, -L / 2, B * 0.55, H, -L / 2 + 0.2, -B * 0.55, H, -L / 2 + 0.2,
  ];
  const i = [
    0, 1, 3, 0, 3, 2, 0, 2, 1,            // Nase oben/unten
    1, 4, 6, 1, 6, 3, 3, 6, 7, 3, 7, 2, 2, 7, 5, // Flanken + Rücken
    1, 2, 5, 1, 5, 4,                     // Boden
    4, 5, 7, 4, 7, 6,                     // Heck
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(i);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

export function baueGleiter(farbe = 0x00e5ff, bauform = 'pfeil', opt = {}) {
  const f = BAUFORMEN[bauform] || BAUFORMEN.pfeil;
  const team = new THREE.Color(farbe);
  const gruppe = new THREE.Group();
  const koerper = new THREE.Group();   // neigt/rollt sichtbar etwas mehr als die Physik (Gefühl), Heavy-Job stimmt ab
  gruppe.add(koerper);

  const lack = new THREE.MeshStandardMaterial({ color: team.clone().multiplyScalar(0.55), roughness: 0.25, metalness: 0.75 });
  const dunkel = new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.35, metalness: 0.8 });
  const glas = new THREE.MeshStandardMaterial({ color: 0x050a12, roughness: 0.05, metalness: 0.9, emissive: 0x0a2236, emissiveIntensity: 0.5 });
  const leucht = new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(3.2) });

  const r = new THREE.Mesh(rumpf(f), lack);
  koerper.add(r);
  // Seitenkufen (Schwebe-Pods) mit Leuchtstreifen
  for (const sg of [1, -1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, f.laenge * 0.8), dunkel);
    pod.position.set(sg * (f.breite / 2 + 0.05), 0.12, -0.2);
    koerper.add(pod);
    const streifen = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, f.laenge * 0.75), leucht);
    streifen.position.set(sg * (f.breite / 2 + 0.29), 0.18, -0.2);
    koerper.add(streifen);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(f.fluegel, 0.06, 0.9), lack);
    fl.position.set(sg * (f.breite / 2 + f.fluegel / 2), 0.05, -f.laenge / 2 + 0.6);
    fl.rotation.z = sg * 0.08;
    koerper.add(fl);
  }
  // Mittelstreifen + Flosse
  const ms = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, f.laenge * 0.6), leucht);
  ms.position.set(0, f.hoehe * 0.86, -0.3);
  koerper.add(ms);
  const flosse = new THREE.Mesh(new THREE.BoxGeometry(0.07, f.flosse, 0.9), lack);
  flosse.position.set(0, f.hoehe + f.flosse / 2 - 0.1, -f.laenge / 2 + 0.5);
  koerper.add(flosse);
  // Kanzel
  const kanzel = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), glas);
  kanzel.scale.set(0.8, 0.55, 1.6);
  kanzel.position.set(0, f.hoehe * 0.75, f.laenge / 2 - f.nase - 0.1);
  koerper.add(kanzel);

  // Düsen + Flammen (additiv, Länge nach Schub/Boost)
  const duesen = [], flammen = [];
  const flammeMat = new THREE.MeshBasicMaterial({ color: team.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(4), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let k = 0; k < f.duesen; k++) {
    const x = (k - (f.duesen - 1) / 2) * 0.75;
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.4, 14), new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(5) }));
    d.rotation.x = Math.PI / 2;
    d.position.set(x, f.hoehe * 0.45, -f.laenge / 2 - 0.1);
    koerper.add(d); duesen.push(d);
    const fg = new THREE.ConeGeometry(0.24, 1, 12, 1, true);
    fg.translate(0, -0.5, 0);
    const fl = new THREE.Mesh(fg, flammeMat);
    fl.rotation.x = Math.PI / 2;
    fl.position.set(x, f.hoehe * 0.45, -f.laenge / 2 - 0.25);
    koerper.add(fl); flammen.push(fl);
  }

  // Lichtspur: Band aus den letzten SPUR_N Positionen (zwei Kanten je Punkt), Alpha nach Alter
  const spurPos = new Float32Array(SPUR_N * 2 * 3), spurAlpha = new Float32Array(SPUR_N * 2);
  const spurIdx = [];
  for (let k = 0; k < SPUR_N - 1; k++) { const a = k * 2; spurIdx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(spurPos, 3));
  sg.setAttribute('alpha', new THREE.BufferAttribute(spurAlpha, 1));
  sg.setIndex(spurIdx);
  const spurMat = new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: team.clone().multiplyScalar(2.2) } },
    vertexShader: 'attribute float alpha; varying float vA; void main() { vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uFarbe; varying float vA; void main() { gl_FragColor = vec4(uFarbe * vA, vA);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const spur = new THREE.Mesh(sg, spurMat);
  spur.frustumCulled = false;
  let spurGefuellt = false;

  const m = new THREE.Matrix4(), xa = new THREE.Vector3(), ya = new THREE.Vector3(), za = new THREE.Vector3();
  return {
    gruppe, spur, bauform: f.name,
    // Lage aus dem Physik-Gleiter übernehmen (alpha: Interpolation, hier noch ohne Vorzustand → 1)
    setzeLage(g) {
      xa.set(g.links.x, g.links.y, g.links.z); ya.set(g.oben.x, g.oben.y, g.oben.z); za.set(g.vor.x, g.vor.y, g.vor.z);
      m.makeBasis(xa, ya, za);
      m.setPosition(g.p.x - g.oben.x * 0.6, g.p.y - g.oben.y * 0.6, g.p.z - g.oben.z * 0.6);
      gruppe.matrixAutoUpdate = false;
      gruppe.matrix.copy(m);
      gruppe.matrixWorldNeedsUpdate = true;
    },
    // je Bild: Flammenlänge, Schräglage-Akzent beim Lenken, Lichtspur
    update(dt, g, ein = null) {
      const schub = ein ? ein.gas : 1;
      const len = 0.6 + 1.8 * schub + 4.5 * g.boost;
      for (const fl of flammen) { fl.scale.set(1, len * (0.9 + 0.2 * Math.random()), 1); }
      const lenk = ein ? ein.lenk : 0;
      koerper.rotation.z += ((-lenk * 0.22) - koerper.rotation.z) * Math.min(1, dt * 6);
      // Spur weiterschieben
      if (!spurGefuellt) { for (let k = 0; k < SPUR_N; k++) schreibeSpur(k, g); spurGefuellt = true; }
      spurPos.copyWithin(6, 0, (SPUR_N - 1) * 6);
      schreibeSpur(0, g);
      for (let k = 0; k < SPUR_N; k++) { const a = Math.pow(1 - k / SPUR_N, 1.6) * (0.25 + 0.75 * Math.min(1, g.tempo / 120)); spurAlpha[k * 2] = a; spurAlpha[k * 2 + 1] = a; }
      sg.attributes.position.needsUpdate = true; sg.attributes.alpha.needsUpdate = true;
      sg.computeBoundingSphere();
    },
  };

  function schreibeSpur(k, g) {
    const hx = g.p.x - g.vor.x * (f.laenge / 2) - g.oben.x * 0.3, hy = g.p.y - g.vor.y * (f.laenge / 2) - g.oben.y * 0.3, hz = g.p.z - g.vor.z * (f.laenge / 2) - g.oben.z * 0.3;
    const b = f.breite * 0.45;
    spurPos.set([hx + g.links.x * b, hy + g.links.y * b, hz + g.links.z * b, hx - g.links.x * b, hy - g.links.y * b, hz - g.links.z * b], k * 6);
  }
}
