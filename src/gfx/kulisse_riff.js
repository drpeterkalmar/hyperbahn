// Kulisse „Riff-Röhre“ (P2): unter Wasser – Wasseroberfläche mit wandernden Lichtflecken von unten, türkiser Nebel,
// Lichtstrahlen von oben, Meeresboden mit Riff (Korallen in vielen Farben, leicht leuchtend), wogender Seetang,
// Fischschwärme (eine Instanz-Wolke, Bewegung im Vertex-Shader), aufsteigende Luftblasen und ein Graben unter dem
// Riesensprung. Alles prozedural, Instancing (ein Draw-Call je Art).
import * as THREE from 'three';
import { rng } from '../core/util.js';
import { Regen } from './regen.js';
import { bahnRaster, gelaende, streuen, instanzen, luecken, entsorgen, bodenHoehe } from './kulisse_kern.js';

export const THEMA = {
  himmel: { oben: [0.04, 0.3, 0.38], horizont: [0.0, 0.035, 0.06], glut: [0.0, 0.1, 0.13], boden: [0.0, 0.02, 0.03], wolken: 0, wasser: 0.7 },
  nebel: { farbe: 0x02222b, dichte: 0.0013 },
  licht: { hemi: [0x5fd0e8, 0x031015, 0.6], richtung: { farbe: 0xbff6ff, staerke: 0.75, dir: [0.15, 1, 0.1] } },
  grade: 'riff',
  dunst: { farbe: 0x0e5a66, aerial: { density: 0.0004, falloff: 0.002, base: 0, max: 0.4 } },
  umgebung: { grund: 0x02161c, farben: [0x2be0ff, 0x00ffb0, 0xff6ad5, 0x7fffd4, 0xffa060, 0x4a8cff], hell: 2.2, oben: 0x4fd8e8 },
  look: {
    fahrbahn: { farbe: 0x061418, rau: 0.25, metall: 0.5, linie: [0.1, 1.0, 0.85], linieStaerke: 1.5 },
    kante: { links: [0.1, 1.0, 0.8], rechts: [1.0, 0.35, 0.7] },
    deck: { farbe: 0x0c2026, rau: 0.5, metall: 0.5 },
    wand: { farbe: 0x0a3040, deckkraft: 0.35, glimmen: 0x0a3a44 },
    stuetze: { farbe: 0x1a2a2e, glimmen: 0x062a2a },
    roehre: { glas: 0x2a8aa0, deckkraft: 0.2, ring: 0x40ffe0 },
    nass: 0.8,
  },
};

const KORALLE = [[1.0, 0.35, 0.55], [1.0, 0.55, 0.2], [0.65, 0.35, 1.0], [1.0, 0.85, 0.3], [0.2, 0.9, 0.8], [1.0, 0.3, 0.3]];

export function baueKulisse(bahn, { scene } = {}) {
  const r = rng(2024);
  const gruppe = new THREE.Group(); gruppe.name = 'kulisse-riff';
  const raster = bahnRaster(bahn);
  // Graben unter dem Riesensprung: Punkte der Lücken-Mittellinie
  const graben = [];
  for (const [s0, s1] of luecken(bahn)) for (let s = s0 - 120; s <= s1 + 120; s += 20) { const p = bahn.punkt(s, 0, 0, { x: 0, y: 0, z: 0 }); graben.push(p.x, p.z); }
  const boden = (x, z) => {
    let h = Math.sin(x * 0.006) * Math.cos(z * 0.005) * 9 + Math.sin(x * 0.02 + z * 0.013) * 3 + Math.cos(z * 0.0012 + 0.5) * 14;
    for (let j = 0; j < graben.length; j += 2) {
      const d = Math.hypot(x - graben[j], z - graben[j + 1]);
      if (d < 160) h -= (1 - d / 160) * (1 - d / 160) * 70;
    }
    return h - 10;
  };
  const amBoden = bodenHoehe(raster, boden, { frei: 14, flanke: 0.5 });
  gruppe.add(gelaende(bahn, raster, {
    rand: 2200, n: 150, hoehe: boden, frei: 14, flanke: 0.5,
    farbe: (x, z, h, steil) => {
      const k = Math.min(1, Math.max(0, 0.5 + h * 0.015 - steil));
      return [0.1 + 0.2 * k, 0.13 + 0.19 * k, 0.12 + 0.12 * k];
    },
    mat: { roughness: 1 },
  }));
  // Korallen: Kugeln (Hirnkorallen), Zylinder (Röhren), flache Scheiben (Fächer) in Gruppen am Boden, leicht leuchtend
  const kugeln = [], roehren = [], faecher = [];
  for (const p of streuen(bahn, raster, r, 220, { dMin: 25, dMax: 900 })) {
    const y0 = amBoden(p.x, p.z) - 1;
    const n = 4 + r.int(8);
    for (let k = 0; k < n; k++) {
      const x = p.x + r.range(-30, 30), z = p.z + r.range(-30, 30), c = r.pick(KORALLE).map((v) => v * r.range(0.5, 1));
      const art = r();
      if (art < 0.4) { const g = r.range(4, 13); kugeln.push({ x, y: y0 + g * 0.4, z, sx: g, sy: g * 0.7, sz: g, farbe: c }); }
      else if (art < 0.75) { const h = r.range(8, 30); roehren.push({ x, y: y0 + h / 2, z, sx: r.range(0.8, 2), sy: h, sz: r.range(0.8, 2), rx: r.range(-0.3, 0.3), rz: r.range(-0.3, 0.3), farbe: c }); }
      else { const g = r.range(6, 16); faecher.push({ x, y: y0 + g * 0.5, z, sx: g, sy: g, sz: 0.4, ry: r.range(0, 6.3), farbe: c }); }
    }
  }
  const korallMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, emissive: 0x0a1418 });
  korallMat.onBeforeCompile = (sh) => {   // Biolumineszenz: Instanzfarbe leuchtet schwach mit
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance += vColor * 0.35;\n#endif');
  };
  gruppe.add(instanzen(new THREE.SphereGeometry(1, 12, 8), korallMat, kugeln, 'hirnkorallen'));
  gruppe.add(instanzen(new THREE.CylinderGeometry(0.7, 1, 1, 8), korallMat, roehren, 'roehrenkorallen'));
  gruppe.add(instanzen(new THREE.CircleGeometry(1, 12), new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide, emissive: 0x081016 }), faecher, 'faecherkorallen'));
  // Seetang: hohe, schmale Bänder, wogen im Vertex-Shader (Ausschlag wächst mit der Höhe)
  const tang = [];
  for (const p of streuen(bahn, raster, r, 260, { dMin: 30, dMax: 1100 })) {
    const y0 = amBoden(p.x, p.z) - 1, h = Math.min(r.range(25, 70), p.y - 8 - y0);
    if (h > 8) tang.push({ x: p.x, y: y0, z: p.z, sx: r.range(1.2, 2.6), sy: h, sz: 1, ry: r.range(0, 6.3) });
  }
  const tangU = { uZeit: { value: 0 } };
  const tangMat = new THREE.ShaderMaterial({
    uniforms: tangU, side: THREE.DoubleSide,
    vertexShader: `uniform float uZeit; varying float vH;
      void main() { vec3 p = position; vH = p.y;
        vec4 w = instanceMatrix * vec4(p, 1.0);
        float ph = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07;
        w.x += sin(uZeit * 0.9 + ph + p.y * 2.0) * p.y * p.y * 6.0; w.z += cos(uZeit * 0.7 + ph) * p.y * p.y * 4.0;
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying float vH;
      void main() { vec3 c = mix(vec3(0.02, 0.12, 0.05), vec3(0.15, 0.5, 0.2), vH);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  gruppe.add(instanzen(new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0), tangMat, tang, 'seetang'));
  // Lichtstrahlen von der Oberfläche: schräge, offene Kegel, additiv, oben hell, unten weich auslaufend
  const B = raster.box, strahlU = { uZeit: { value: 0 } };
  const strahlen = [];
  for (let k = 0; k < 34; k++) {
    const x = r.range(B.x0 - 300, B.x1 + 300), z = r.range(B.z0 - 300, B.z1 + 300), h = r.range(260, 420);
    strahlen.push({ x, y: 300 - h / 2, z, sx: r.range(20, 55), sy: h, sz: r.range(20, 55), rx: 0.18, rz: 0.12, ry: 0 });
  }
  const strahlMat = new THREE.ShaderMaterial({
    uniforms: strahlU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uZeit; varying float vY; varying float vP;
      void main() { vY = position.y + 0.5; vP = instanceMatrix[3].x * 0.01 + instanceMatrix[3].z * 0.013;
        gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uZeit; varying float vY; varying float vP;
      void main() { float a = smoothstep(0.0, 0.8, vY) * (0.55 + 0.45 * sin(uZeit * 0.4 + vP * 6.0)) * 0.12;
        gl_FragColor = vec4(vec3(0.45, 0.95, 1.0) * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  gruppe.add(instanzen(new THREE.CylinderGeometry(0.25, 1, 1, 16, 1, true), strahlMat, strahlen, 'lichtstrahlen'));
  // Fischschwärme: 12 Schwärme à 70 Fische, jeder kreist (Zentrum, Radius, Phase, Tempo als Instanz-Daten)
  const nS = 12, jeS = 70, fisch = new THREE.ConeGeometry(0.35, 1.6, 4).rotateX(Math.PI / 2);
  const daten = new Float32Array(nS * jeS * 4), mitte = new Float32Array(nS * jeS * 4), farbe = new Float32Array(nS * jeS * 3);
  const orte = streuen(bahn, raster, r, nS, { dMin: 30, dMax: 500 });
  for (let a = 0; a < nS; a++) {
    const o = orte[a] || { x: 0, z: 0, y: 40 }, R = r.range(30, 70), w = r.range(0.15, 0.35) * (r() < 0.5 ? -1 : 1), y = Math.max(amBoden(o.x, o.z) + 12, o.y - r.range(-10, 30));
    const c = r.pick([[1, 0.8, 0.2], [0.3, 0.9, 1], [1, 0.5, 0.3], [0.8, 0.9, 1]]);
    for (let k = 0; k < jeS; k++) {
      const i = a * jeS + k;
      mitte.set([o.x, y, o.z, R], i * 4);
      daten.set([r.range(0, 6.3), w * r.range(0.9, 1.1), r.range(-6, 6), r.range(-4, 4)], i * 4);
      farbe.set(c.map((v) => v * r.range(0.7, 1.2)), i * 3);
    }
  }
  fisch.setAttribute('aMitte', new THREE.InstancedBufferAttribute(mitte, 4));
  fisch.setAttribute('aDaten', new THREE.InstancedBufferAttribute(daten, 4));
  fisch.setAttribute('aFarbe', new THREE.InstancedBufferAttribute(farbe, 3));
  const fischU = { uZeit: { value: 0 } };
  const fischMat = new THREE.ShaderMaterial({
    uniforms: fischU,
    vertexShader: `uniform float uZeit; attribute vec4 aMitte, aDaten; attribute vec3 aFarbe; varying vec3 vC;
      void main() {
        float w = aDaten.x + uZeit * aDaten.y, R = aMitte.w + aDaten.z;
        vec3 p = aMitte.xyz + vec3(cos(w) * R, aDaten.w + sin(w * 2.0) * 3.0, sin(w) * R);
        vec3 t = normalize(vec3(-sin(w), 0.0, cos(w)) * sign(aDaten.y));   // Schwimmrichtung
        vec3 s = normalize(cross(vec3(0.0, 1.0, 0.0), t));
        vec3 lp = position; lp.x += sin(uZeit * 9.0 + aDaten.x * 10.0) * 0.25 * (lp.z + 0.8);   // Schwanzschlag
        vec3 wp = p + s * lp.x + vec3(0.0, 1.0, 0.0) * lp.y + t * lp.z;
        vC = aFarbe; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `varying vec3 vC; void main() { gl_FragColor = vec4(vC * 0.9, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const fische = new THREE.InstancedMesh(fisch, fischMat, nS * jeS);
  fische.frustumCulled = false; fische.name = 'fischschwaerme';
  gruppe.add(fische);
  // aufsteigende Luftblasen um die Kamera
  const blasen = new Regen(scene, { anzahl: 1400, fall: -3.5, wind: [0.6, 0, 0.3], laenge: 0.022, breite: 0.05, hell: 0.28, farbe: [0.55, 1.0, 1.0], box: [70, 50, 70] });
  return {
    gruppe,
    update(dt, t, kamPos, kamVel) {
      tangU.uZeit.value = t; strahlU.uZeit.value = t; fischU.uZeit.value = t;
      blasen.update(dt, kamPos, kamVel, 1);
    },
    dispose() { entsorgen(gruppe); blasen.dispose(); },
  };
}
