// Strecken-Meshes (three.js) aus bahn_geo.js: nasse dunkle Fahrbahn, Deck, Glas-Begrenzung, Lauflicht-/Strobo-Kanten,
// pulsierende Magnet-Streifen (violett/cyan), gläserne Röhren mit Lichtringen, Boost-Pads mit laufenden Chevrons,
// Boost-Ringe, Anflug-Lichter der Landezonen, Stützen.
// Eigene Shader enden mit tonemapping/colorspace (KINOLOOK.md), damit sie im Kino-Look-Render-Target gleich aussehen.
// Alle Farben/Stärken sind Startwerte – TODO Heavy-Job: am Bild abstimmen (Bloom-Schwelle 0,88–0,9 im Kino-Look).
import * as THREE from 'three';
import { baueBahnGeometrie, baueBahnInstanzen } from './bahn_geo.js';

export const LOOK = {
  fahrbahn: { farbe: 0x07090d, rau: 0.2, metall: 0.4, linie: [0.0, 0.9, 1.0], linieStaerke: 1.6 },
  kante: { links: [0.0, 0.95, 1.0], rechts: [1.0, 0.15, 0.8], staerke: 3.2, lauf: 38, abstand: 24, strobo: 1.5 },
  magnet: { a: [0.62, 0.2, 1.0], b: [0.0, 0.9, 1.0], staerke: 3.0, puls: 7 },
  pad: { farbe: [0.2, 1.0, 1.0], staerke: 2.0, lauf: 2.6, grund: 0.07 },
  box: { farbe: [0.25, 1.0, 0.35], staerke: 1.6, lauf: 0.8 },   // Boxengasse: grüne Lade-Spur mit wandernden „+“   // P1-Abnahme: Grund 0,25 → Pad-Ketten überstrahlten weiß
  ring: { farbe: 0xff2bd6, staerke: 3.5 },
  licht: { farbe: [1.0, 0.55, 0.1], staerke: 5.0, lauf: 9 },
  roehre: { glas: 0x0b1a2e, deckkraft: 0.22, ring: 0x00e5ff },
};

const ENDE = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

function geo(b) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('weg', new THREE.Float32BufferAttribute(b.extra, 1));
  g.setIndex(b.idx);
  g.computeBoundingSphere();
  return g;
}

// gemeinsame Uniforms (Zeit, Strobo-Dämpfung „Blitze reduzieren“, Boost-Puls)
export const BAHN_U = { uZeit: { value: 0 }, uStrobo: { value: 1 }, uStroboFreq: { value: LOOK.kante.strobo }, uBoost: { value: 0 } };

function leuchtMaterial(fs, extraU = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...BAHN_U, ...extraU },
    vertexShader: `
      attribute float weg; varying float vWeg; varying vec2 vUv;
      void main() { vWeg = weg; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uZeit, uStrobo, uStroboFreq, uBoost; varying float vWeg; varying vec2 vUv;
      ${fs}`,
    side: THREE.DoubleSide, transparent: false, depthWrite: true,
  });
}

export function baueBahnMesh(bahn, opt = {}) {
  const teile = opt.teile || baueBahnGeometrie(bahn);
  const ins = baueBahnInstanzen(bahn);
  const gruppe = new THREE.Group();
  gruppe.name = 'bahn';

  // Fahrbahn: nass (niedrige Rauheit, Pfützen über Rauschen), leuchtende Spurlinien
  const fb = LOOK.fahrbahn;
  const fahrMat = new THREE.MeshStandardMaterial({ color: fb.farbe, roughness: fb.rau, metalness: fb.metall });
  fahrMat.onBeforeCompile = (sh) => {
    sh.uniforms.uZeit = BAHN_U.uZeit;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vBahnUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvBahnUv = uv;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vBahnUv; uniform float uZeit;
      float bHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float bRausch(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(bHash(i), bHash(i + vec2(1, 0)), f.x), mix(bHash(i + vec2(0, 1)), bHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      // Pfützen: glatter (Spiegelungen der Neon-Lichter)
      float pf = smoothstep(0.55, 0.75, bRausch(vBahnUv * vec2(6.0, 9.0)));
      roughnessFactor = mix(roughnessFactor, 0.04, pf);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // Spurlinien (Ränder + zwei Trennlinien), leicht pulsierend
      float q = vBahnUv.x;
      float lin = (1.0 - smoothstep(0.0, 0.012, abs(q - 0.02))) + (1.0 - smoothstep(0.0, 0.012, abs(q - 0.98)))
        + 0.5 * (1.0 - smoothstep(0.0, 0.006, abs(q - 0.3333))) * step(0.5, fract(vBahnUv.y * 4.0))
        + 0.5 * (1.0 - smoothstep(0.0, 0.006, abs(q - 0.6667))) * step(0.5, fract(vBahnUv.y * 4.0));
      totalEmissiveRadiance += vec3(${fb.linie.join(', ')}) * lin * ${fb.linieStaerke.toFixed(2)};`);
  };
  gruppe.add(new THREE.Mesh(geo(teile.fahrbahn), fahrMat));

  // Deck + Wände
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x0d0f15, roughness: 0.55, metalness: 0.6 });
  gruppe.add(new THREE.Mesh(geo(teile.deck), deckMat));
  const wandMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55, emissive: 0x06223a, emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  gruppe.add(new THREE.Mesh(geo(teile.wand), wandMat));

  // Kanten: Lauflicht + Strobo (Strobo-Stärke/Frequenz über die Blitz-Bremse gedämpft)
  const k = LOOK.kante;
  const kanteMat = leuchtMaterial(`
    void main() {
      float lauf = smoothstep(0.75, 1.0, fract((vWeg - uZeit * ${k.lauf.toFixed(1)}) / ${k.abstand.toFixed(1)}));
      float strobe = step(0.5, fract(uZeit * uStroboFreq)) * uStrobo;
      // Farbe wechselt je Abstand cyan und magenta
      vec3 c = mix(vec3(${k.rechts.join(', ')}), vec3(${k.links.join(', ')}), step(0.5, fract(vWeg / ${(2 * k.abstand).toFixed(1)})));
      gl_FragColor = vec4(c * (0.55 + 1.6 * lauf + 0.5 * strobe + uBoost) * ${k.staerke.toFixed(2)}, 1.0);
      ${ENDE}
    }`);
  gruppe.add(new THREE.Mesh(geo(teile.kante), kanteMat));

  // Magnet-Streifen: violett ↔ cyan pulsierend, Wellen laufen in Fahrtrichtung
  const m = LOOK.magnet;
  const magMat = leuchtMaterial(`
    void main() {
      float w = 0.5 + 0.5 * sin(vWeg * 0.25 - uZeit * ${m.puls.toFixed(1)});
      vec3 c = mix(vec3(${m.a.join(', ')}), vec3(${m.b.join(', ')}), w);
      float kern = smoothstep(0.0, 0.35, vUv.x) * (1.0 - smoothstep(0.65, 1.0, vUv.x));
      gl_FragColor = vec4(c * (0.6 + 1.4 * w) * kern * ${m.staerke.toFixed(2)}, 1.0);
      ${ENDE}
    }`);
  gruppe.add(new THREE.Mesh(geo(teile.magnet), magMat));

  // Störfeld am Rand: schräge, leicht flackernde Warnstreifen (additiv, dezent)
  const stoerMat = leuchtMaterial(`
    void main() {
      float st = step(0.5, fract(vWeg * 0.25 + vUv.x * 1.5));
      float flacker = 0.75 + 0.25 * sin(uZeit * 9.0 + vWeg * 0.05) * uStrobo;
      vec3 c = vec3(1.0, 0.28, 0.06) * (0.12 + 0.55 * st) * flacker * smoothstep(0.0, 0.25, vUv.x);
      gl_FragColor = vec4(c, 1.0);
      ${ENDE}
    }`);
  stoerMat.transparent = true; stoerMat.blending = THREE.AdditiveBlending; stoerMat.depthWrite = false;
  stoerMat.polygonOffset = true; stoerMat.polygonOffsetFactor = -1;
  gruppe.add(new THREE.Mesh(geo(teile.stoerfeld), stoerMat));

  // Röhren: dunkles Glas (Stadt scheint durch) + Lichtringe
  const r = LOOK.roehre;
  const roehreMat = new THREE.MeshStandardMaterial({ color: r.glas, roughness: 0.08, metalness: 0.3, transparent: true, opacity: r.deckkraft, side: THREE.DoubleSide, depthWrite: false });
  gruppe.add(new THREE.Mesh(geo(teile.roehre), roehreMat));
  if (ins.roehrenLichter.length) {
    const tor = new THREE.TorusGeometry(1, 0.012, 4, 40);
    const rm = new THREE.MeshBasicMaterial({ color: r.ring });
    rm.color.multiplyScalar(2.5);
    const im = new THREE.InstancedMesh(tor, rm, ins.roehrenLichter.length);
    ins.roehrenLichter.forEach((f, i) => {
      const R = f.hw + 3, mm = Math.sqrt(R * R - f.hw * f.hw);
      const c = new THREE.Vector3(f.x + f.U[0] * mm, f.y + f.U[1] * mm, f.z + f.U[2] * mm);
      im.setMatrixAt(i, rahmenMatrix(f, c, R));
    });
    gruppe.add(im);
  }

  // Boost-Pads: Chevrons laufen in Fahrtrichtung (vUv.y entlang, vUv.x quer)
  const p = LOOK.pad;
  const padMat = leuchtMaterial(`
    void main() {
      float chev = fract(vUv.y * 4.0 - uZeit * ${p.lauf.toFixed(2)} - abs(vUv.x - 0.5) * 1.4);
      float pfeil = smoothstep(0.0, 0.08, chev) * (1.0 - smoothstep(0.38, 0.5, chev));
      float rand = (1.0 - smoothstep(0.0, 0.06, min(vUv.x, 1.0 - vUv.x)));
      vec3 c = vec3(${p.farbe.join(', ')});
      gl_FragColor = vec4(c * (${p.grund.toFixed(2)} + pfeil * 1.1 + rand * 0.7) * ${p.staerke.toFixed(2)}, 1.0);
      ${ENDE}
    }`);
  padMat.polygonOffset = true; padMat.polygonOffsetFactor = -2;
  gruppe.add(new THREE.Mesh(geo(teile.pads), padMat));

  // Boxengasse (P1b): grüne Lade-Spur, Randlinien + wandernde Plus-Zeichen („hier wird geladen“)
  if (teile.box.pos.length) {
    const x = LOOK.box;
    const boxMat = leuchtMaterial(`
      void main() {
        vec2 z = vec2(vUv.x, fract(vUv.y * 24.0 - uZeit * ${x.lauf.toFixed(2)}));
        float plus = max(step(abs(z.x - 0.5), 0.06) * step(abs(z.y - 0.5), 0.3), step(abs(z.y - 0.5), 0.06) * step(abs(z.x - 0.5), 0.3));
        float rand = 1.0 - smoothstep(0.0, 0.08, min(vUv.x, 1.0 - vUv.x));
        gl_FragColor = vec4(vec3(${x.farbe.join(', ')}) * (0.06 + plus * 0.9 + rand * 0.9) * ${x.staerke.toFixed(2)}, 1.0);
        ${ENDE}
      }`);
    boxMat.polygonOffset = true; boxMat.polygonOffsetFactor = -2;
    gruppe.add(new THREE.Mesh(geo(teile.box), boxMat));
  }

  // Boost-Ringe in der Luft
  if (ins.ringe.length) {
    const rg = new THREE.TorusGeometry(1, 0.06, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: LOOK.ring.farbe });
    ringMat.color.multiplyScalar(LOOK.ring.staerke);
    const im = new THREE.InstancedMesh(rg, ringMat, ins.ringe.length);
    ins.ringe.forEach((f, i) => im.setMatrixAt(i, rahmenMatrix(f, new THREE.Vector3(f.x, f.y, f.z), f.r)));
    gruppe.add(im);
  }

  // Anflug-Lichter der Landezonen: Lauflicht in Landerichtung
  if (ins.lichter.length) {
    const box = new THREE.BoxGeometry(0.7, 0.35, 1.6);
    const folge = new Float32Array(ins.lichter.map((f) => f.folge));
    box.setAttribute('folge', new THREE.InstancedBufferAttribute(folge, 1));
    const l = LOOK.licht;
    const lichtMat = new THREE.ShaderMaterial({
      uniforms: { ...BAHN_U },
      vertexShader: `
        attribute float folge; varying float vF;
        void main() { vF = folge; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform float uZeit, uStrobo; varying float vF;
        void main() {
          float an = smoothstep(0.7, 1.0, fract(vF / 10.0 - uZeit * ${(l.lauf / 10).toFixed(2)}));
          gl_FragColor = vec4(vec3(${l.farbe.join(', ')}) * (0.35 + an * (0.4 + 0.6 * uStrobo)) * ${l.staerke.toFixed(2)}, 1.0);
          ${ENDE}
        }`,
    });
    const im = new THREE.InstancedMesh(box, lichtMat, ins.lichter.length);
    ins.lichter.forEach((f, i) => im.setMatrixAt(i, rahmenMatrix(f, new THREE.Vector3(f.x, f.y, f.z), 1)));
    gruppe.add(im);
  }

  // Stützen
  if (ins.stuetzen.length) {
    const sg = new THREE.BoxGeometry(3.2, 1, 3.2);
    const sm = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.8, metalness: 0.2, emissive: 0x220833, emissiveIntensity: 0.4 });
    const im = new THREE.InstancedMesh(sg, sm, ins.stuetzen.length);
    const mt = new THREE.Matrix4();
    ins.stuetzen.forEach((s, i) => { mt.makeScale(1, s.h, 1); mt.setPosition(s.x, s.y, s.z); im.setMatrixAt(i, mt); });
    gruppe.add(im);
  }

  // Start/Ziel: leuchtender Strich quer über die Fahrbahn
  const sz = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3), side: THREE.DoubleSide }));
  const f0 = { T: [bahn.tx[0], bahn.ty[0], bahn.tz[0]], U: [bahn.sux[0], bahn.suy[0], bahn.suz[0]], L: [bahn.slx[0], bahn.sly[0], bahn.slz[0]] };
  const m0 = rahmenMatrix(f0, new THREE.Vector3(bahn.px[0] + f0.U[0] * 0.06, bahn.py[0] + f0.U[1] * 0.06, bahn.pz[0] + f0.U[2] * 0.06), 1);
  m0.multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(bahn.hw[0] * 2, 1.2, 1));
  sz.matrixAutoUpdate = false; sz.matrix.copy(m0);
  gruppe.add(sz);

  return {
    gruppe, teile, ins,
    // je Bild: Zeit, Blitz-Bremse (Strobo-Dämpfung), Boost-Puls (Kanten leuchten bei Boost heller)
    update(t, { blitze = null, boost = 0 } = {}) {
      BAHN_U.uZeit.value = t;
      const st = blitze ? blitze.strobo(LOOK.kante.strobo, 1) : { freq: LOOK.kante.strobo, staerke: 1 };
      BAHN_U.uStrobo.value = st.staerke; BAHN_U.uStroboFreq.value = st.freq;
      BAHN_U.uBoost.value = boost;
    },
  };
}

// Matrix aus Bahn-Rahmen: lokale x = links, y = oben, z = vor (Torus liegt in xy, Achse z = Fahrtrichtung)
function rahmenMatrix(f, pos, skala) {
  const m = new THREE.Matrix4();
  m.makeBasis(new THREE.Vector3(...f.L), new THREE.Vector3(...f.U), new THREE.Vector3(...f.T));
  m.scale(new THREE.Vector3(skala, skala, skala));
  m.setPosition(pos);
  return m;
}
