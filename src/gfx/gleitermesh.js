// Gleiter-Modelle: 4 fiktive Bauformen aus Sketchfab (CC-BY, Credits in LICENSES.md, gebacken mit
// assets_src/blender/gleiter_backen.py → assets/gleiter/*.glb), Teamfarbe per Farbton-Maske (Lack-Farbton des Modells wird
// durch die Teamfarbe ersetzt, Akzente bleiben), dazu eigene Leucht-Teile: Unterboden-Glühen, Düsen + Flamme (länger bei
// Boost), zwei schlanke Lichtspuren von den Flügelspitzen. Fehlt das GLB (Node-Test, Ladefehler), baut sich der alte Keil
// aus Grundkörpern als Rückfall.
// Modell-Raum: +z = vor (Nase), +y = oben, +x = links → Weltmatrix aus (links, oben, vor) des Physik-Gleiters.
// Handy-Budget: untexturierte Modelle → Vertexfarben, 1 Mesh (+1 Leucht-Mesh); texturierte ≤ 3 Materialien.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const BAUFORMEN = {
  pfeil: { name: 'Pfeil', laenge: 4.8, breite: 3.9, hoehe: 0.95, nase: 1.9, fluegel: 1.1, flosse: 0.9, duesen: [[0, 0.42]],
    datei: 'pfeil.glb', lack: { metalPurpleClone: 0.75 }, leucht: ['blueSteelClone'] },
  klinge: { name: 'Klinge', laenge: 5.0, breite: 2.6, hoehe: 1.3, nase: 2.4, fluegel: 1.4, flosse: 0.5, duesen: [[0, 0.55]],
    datei: 'klinge.glb', lack: { wire_3: 0.16, wire_4: 0.4 }, leucht: ['wire_5', 'wire_1'] },
  hammer: { name: 'Hammer', laenge: 4.5, breite: 4.0, hoehe: 1.55, nase: 1.3, fluegel: 0.8, flosse: 1.1, duesen: [[0.55, 0.72], [-0.55, 0.72]],
    datei: 'hammer.glb', farbton: 0.075 },
  stachel: { name: 'Stachel', laenge: 5.0, breite: 3.0, hoehe: 1.0, nase: 2.2, fluegel: 1.6, flosse: 0.7, duesen: [[0, 0.5]],
    datei: 'stachel.glb', farbton: 0.72 },
};
export const BAUFORM_LISTE = Object.keys(BAUFORMEN);
const SPUR_N = 40;
const vorlagen = {};   // bauform → { szene } nach ladeGleiterModelle()

// GLBs einmal laden (vor dem ersten Rennen). Ohne Browser/bei Fehlern bleibt der Rückfall-Keil.
export async function ladeGleiterModelle(basis = 'assets/gleiter/') {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  await Promise.all(BAUFORM_LISTE.map(async (b) => {
    try { vorlagen[b] = (await loader.loadAsync(basis + BAUFORMEN[b].datei)).scene; } catch (e) { console.warn('Gleiter-Modell', b, e); }
  }));
  return Object.keys(vorlagen).length;
}

// Farbton-Maske: Pixel mit dem Lack-Farbton (± Breite) und genug Sättigung bekommen den Teamfarbton, Helligkeit bleibt
// (farbton < 0 = keine Maske). Dazu ein Neon-Rand (Fresnel) in Teamfarbe – Gleiter lesen sich so auch vor dunkler Stadt.
export const GLEITER_LOOK = { rand: 0.65, randExp: 2.6, env: 2.0 };
function teamMaske(mat, team, farbton) {
  const hsl = {}; team.getHSL(hsl);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTeamH = { value: hsl.h }; sh.uniforms.uLackH = { value: farbton };
    sh.uniforms.uTeam = { value: team.clone() }; sh.uniforms.uRand = { value: GLEITER_LOOK.rand };
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform float uTeamH, uLackH, uRand; uniform vec3 uTeam;
      vec3 hb_rgb2hsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y);
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-6)), d / (q.x + 1e-6), q.x); }
      vec3 hb_hsv2rgb(vec3 c) { vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
      void main() {`).replace('#include <color_fragment>', `#include <color_fragment>
      if (uLackH >= 0.0) { vec3 hsv = hb_rgb2hsv(diffuseColor.rgb); float dh = abs(fract(hsv.x - uLackH + 0.5) - 0.5);
        float w = (1.0 - smoothstep(0.05, 0.11, dh)) * smoothstep(0.2, 0.4, hsv.y);   // smoothstep(a > b) ist in GLSL undefiniert
        diffuseColor.rgb = mix(diffuseColor.rgb, hb_hsv2rgb(vec3(uTeamH, max(hsv.y, 0.75), hsv.z)), w); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float hbRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), ${GLEITER_LOOK.randExp.toFixed(2)});
        totalEmissiveRadiance += uTeam * hbRim * uRand; }`);
  };
  mat.customProgramCacheKey = () => 'hbTeam';
}

// GLB-Vorlage → Meshes für ein Team. Untexturierte Materialien werden zu Vertexfarben zusammengefasst.
function ausVorlage(f, vorlage, team) {
  const teile = [];
  vorlage.updateMatrixWorld(true);
  vorlage.traverse((o) => { if (o.isMesh) teile.push(o); });
  const fest = [], leucht = [], aus = [];
  for (const o of teile) {
    const mat = o.material;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (mat.map) {
      const m = mat.clone(); teamMaske(m, team, f.farbton ?? -1);
      m.envMapIntensity = GLEITER_LOOK.env;
      aus.push(new THREE.Mesh(g, m));
      continue;
    }
    // untexturiert: Farbe je Material in Vertexfarben backen; Lack-Materialien → Teamfarbe, Leucht-Materialien → eigenes Mesh
    let c = mat.color.clone();
    if (f.lack && mat.name in f.lack) c = team.clone().multiplyScalar(f.lack[mat.name]);
    const ziel = f.leucht && f.leucht.includes(mat.name) ? leucht : fest;
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ziel.push(g.index ? g.toNonIndexed() : g);
  }
  if (fest.length) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.7, envMapIntensity: GLEITER_LOOK.env });
    teamMaske(m, team, -1);
    aus.push(new THREE.Mesh(mergeGeometries(fest), m));
  }
  if (leucht.length) aus.push(new THREE.Mesh(mergeGeometries(leucht), new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(4) })));
  return aus;
}

// Keil-Rumpf als eigene Geometrie (Rückfall): spitze Nase, breites Heck, flacher Boden
function rumpf(f) {
  const L = f.laenge, B = f.breite / 2, H = f.hoehe, n = f.nase;
  const v = [0, 0.05, L / 2, B * 0.55, 0, L / 2 - n, -B * 0.55, 0, L / 2 - n, 0, H * 0.8, L / 2 - n,
    B, 0, -L / 2, -B, 0, -L / 2, B * 0.55, H, -L / 2 + 0.2, -B * 0.55, H, -L / 2 + 0.2];
  const i = [0, 1, 3, 0, 3, 2, 0, 2, 1, 1, 4, 6, 1, 6, 3, 3, 6, 7, 3, 7, 2, 2, 7, 5, 1, 2, 5, 1, 5, 4, 4, 5, 7, 4, 7, 6];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(i);
  g.computeVertexNormals();
  return g.toNonIndexed();
}
function rueckfall(f, team, koerper) {
  const lack = new THREE.MeshStandardMaterial({ color: team.clone().multiplyScalar(0.55), roughness: 0.25, metalness: 0.75 });
  const leucht = new THREE.MeshBasicMaterial({ color: team.clone().multiplyScalar(3.2) });
  koerper.add(new THREE.Mesh(rumpf(f), lack));
  for (const sg of [1, -1]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, f.laenge * 0.75), leucht);
    st.position.set(sg * f.breite * 0.3, 0.18, -0.2); koerper.add(st);
  }
  zusammenfassen(koerper);
}

// Flamme: Kegel nach hinten, Verlauf weiß-heiß → Teamfarbe → durchsichtig (Länge per scale.z)
function flammenMaterial(team) {
  return new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: team.clone().multiplyScalar(3) }, uKraft: { value: 1 } },
    vertexShader: 'varying float vT; void main() { vT = clamp(-position.z, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uFarbe; uniform float uKraft; varying float vT;
      void main() { float a = pow(1.0 - vT, 1.6) * uKraft; vec3 c = mix(vec3(3.0, 3.0, 3.2), uFarbe, smoothstep(0.0, 0.35, vT));
        gl_FragColor = vec4(c * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

// weiche Leuchtscheibe (Unterboden-Glühen, Düsen-Halo): Radial-Verlauf im Shader
function scheibenMaterial(farbe, staerke) {
  return new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: farbe.clone().multiplyScalar(staerke) }, uKraft: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uFarbe; uniform float uKraft; varying vec2 vUv;
      void main() { float r = length(vUv); float a = pow(max(0.0, 1.0 - r), 2.2) * uKraft; gl_FragColor = vec4(uFarbe * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

export function baueGleiter(farbe = 0x00e5ff, bauform = 'pfeil', opt = {}) {
  const f = BAUFORMEN[bauform] || BAUFORMEN.pfeil;
  const team = new THREE.Color(farbe);
  const gruppe = new THREE.Group();
  const koerper = new THREE.Group();   // neigt/rollt sichtbar etwas mehr als die Physik (Gefühl)
  gruppe.add(koerper);
  const vorlage = vorlagen[bauform];
  if (vorlage) for (const m of ausVorlage(f, vorlage, team)) koerper.add(m);
  else rueckfall(f, team, koerper);

  // Unterboden-Glühen (Teamfarbe, liegt knapp unter dem Rumpf – wirkt wie Schwebe-Feld und färbt die nasse Bahn)
  const unter = new THREE.Mesh(new THREE.PlaneGeometry(f.breite * 1.5, f.laenge * 1.3), scheibenMaterial(team, 1.6));
  unter.rotation.x = -Math.PI / 2; unter.position.y = -0.35;
  koerper.add(unter);

  // Düsen-Halo + Flammen (alle Düsen in EINEM Mesh, das in z skaliert wird)
  const flammenGeo = [], haloGeo = [];
  for (const [x, y] of f.duesen) {
    const fg = new THREE.ConeGeometry(0.26, 1, 12, 1, true);
    fg.translate(0, -0.5, 0); fg.rotateX(Math.PI / 2); fg.translate(x, y, 0);
    flammenGeo.push(fg);
    const hg = new THREE.PlaneGeometry(1.5, 1.5); hg.translate(x, y, 0);
    haloGeo.push(hg);
  }
  const flammen = new THREE.Mesh(mergeGeometries(flammenGeo), flammenMaterial(team));
  flammen.position.z = -f.laenge / 2 + 0.1;
  koerper.add(flammen);
  const halo = new THREE.Mesh(mergeGeometries(haloGeo), scheibenMaterial(team.clone().lerp(new THREE.Color(1, 1, 1), 0.4), 2.2));
  halo.position.z = -f.laenge / 2 - 0.05;
  koerper.add(halo);

  // Lichtspuren: zwei schmale Bänder an den Flügelspitzen, Alpha nach Alter und Tempo
  const spurPos = new Float32Array(SPUR_N * 4 * 3), spurAlpha = new Float32Array(SPUR_N * 4);
  const spurIdx = [];
  for (const o of [0, SPUR_N * 2]) for (let k = 0; k < SPUR_N - 1; k++) { const a = o + k * 2; spurIdx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(spurPos, 3));
  sg.setAttribute('alpha', new THREE.BufferAttribute(spurAlpha, 1));
  sg.setIndex(spurIdx);
  const spurMat = new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: team.clone().multiplyScalar(2.4) } },
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
    gruppe, spur, bauform: f.name, modell: !!vorlage,
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
      const len = 0.8 + 1.6 * schub + 5.5 * g.boost;
      flammen.scale.set(1 + 0.25 * g.boost, 1 + 0.25 * g.boost, len * (0.9 + 0.2 * Math.random()));
      flammen.material.uniforms.uKraft.value = 0.55 + 0.45 * schub + 0.5 * Math.min(1, g.boost);
      halo.material.uniforms.uKraft.value = 0.5 + 0.4 * schub + 0.6 * Math.min(1, g.boost);
      unter.material.uniforms.uKraft.value = g.boden ? 0.9 : 0.45;
      const lenk = ein ? ein.lenk : 0;
      koerper.rotation.z += ((-lenk * 0.22) - koerper.rotation.z) * Math.min(1, dt * 6);
      // Treffer-Dreher: Modell dreht sich um die Hochachse (die Physik behält die Fahrtrichtung)
      koerper.rotation.y = g.drehWinkel || 0;
      if (!spurGefuellt) { for (let k = 0; k < SPUR_N; k++) schreibeSpur(k, g); spurGefuellt = true; }
      spurPos.copyWithin(6, 0, (SPUR_N - 1) * 6);
      spurPos.copyWithin(SPUR_N * 6 + 6, SPUR_N * 6, SPUR_N * 6 + (SPUR_N - 1) * 6);
      schreibeSpur(0, g);
      const t = 0.15 + 0.85 * Math.min(1, g.tempo / 120);
      for (let k = 0; k < SPUR_N; k++) {
        const a = Math.pow(1 - k / SPUR_N, 1.8) * t * (k < 2 ? k / 2 : 1);
        spurAlpha[k * 2] = spurAlpha[k * 2 + 1] = spurAlpha[SPUR_N * 2 + k * 2] = spurAlpha[SPUR_N * 2 + k * 2 + 1] = a;
      }
      sg.attributes.position.needsUpdate = true; sg.attributes.alpha.needsUpdate = true;
    },
  };

  // Punkt k beider Spuren: Flügelspitze links/rechts, je ein schmales flaches Band (0,36 m) in der Bahnebene
  function schreibeSpur(k, g) {
    const hx = g.p.x - g.vor.x * (f.laenge * 0.35) - g.oben.x * 0.4, hy = g.p.y - g.vor.y * (f.laenge * 0.35) - g.oben.y * 0.4, hz = g.p.z - g.vor.z * (f.laenge * 0.35) - g.oben.z * 0.4;
    const b = f.breite * 0.44, w = 0.18;
    for (const [sgn, o] of [[1, 0], [-1, SPUR_N * 6]]) {
      const cx = hx + g.links.x * b * sgn, cy = hy + g.links.y * b * sgn, cz = hz + g.links.z * b * sgn;
      spurPos.set([cx + g.links.x * w, cy + g.links.y * w, cz + g.links.z * w, cx - g.links.x * w, cy - g.links.y * w, cz - g.links.z * w], o + k * 6);
    }
  }
}

// Alle Kind-Meshes einer Gruppe je Material zu einem Mesh zusammenfassen (Lage eingerechnet, nur Position + Normale)
export function zusammenfassen(gruppe) {
  gruppe.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(gruppe.matrixWorld).invert();
  const jeMat = new Map();
  for (const m of gruppe.children.slice()) {
    if (!m.isMesh) continue;
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (!jeMat.has(m.material)) jeMat.set(m.material, []);
    jeMat.get(m.material).push(g);
    gruppe.remove(m);
  }
  for (const [mat, liste] of jeMat) gruppe.add(new THREE.Mesh(mergeGeometries(liste), mat));
  return gruppe;
}
