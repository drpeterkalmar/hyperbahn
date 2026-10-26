// Neon-Megastadt (three.js) aus stadt_plan.js: Wolkenkratzer mit prozeduralen Fenstern, Neon-Schilder (Canvas-Atlas),
// Neon-Kanten, Warnlichter auf den Dächern, nasser Boden, Fluss als Spiegelband, Brücke/Fassade/Hafen als Boxen.
//
//   const stadt = baueStadt(bahn, { seed, qualitaet, blitze });   scene.add(stadt.gruppe);   je Bild stadt.update(t)
//
// Draw-Calls (fest, unabhängig von der Turmzahl): Türme 1, Bauten (Brücke/Pfeiler/Kai) 1, Neon-Kanten 1,
// Warnlichter 1, Schilder 1, Boden 1, Fluss 1, Hafenwasser 1.
// Fenster: MeshStandardMaterial + onBeforeCompile – Raster aus Weltkoordinaten (Seitenflächen), Zufall je Zelle an/aus,
// kühles Weiß/Cyan/Magenta, emissiv, weich in der Ferne (fwidth → Mittelwert, kein Flimmern). Weil die Standard-Bausteine
// bleiben, laufen tonemapping/colorspace wie bei allen Materialien (KINOLOOK.md „Was nicht automatisch passt“).
// Leuchtteile (Kanten/Schilder/Warnlichter) sind MeshBasicMaterial mit HDR-Instanzfarben (> 1 → Bloom) und schreiben
// Tiefe (bekommen Dunst). Flackern/Strobo laufen über blitze.strobo() („⚡ Blitze reduzieren“).
// Alle Werte unten sind Startwerte – TODO Heavy-Job: am Bild abstimmen.
import * as THREE from 'three';
import { stadtPlan, schildAspekt, SCHILD_TEXTE, NEON_FARBEN, TURM_ARTEN } from './stadt_plan.js';
import { rng } from '../core/util.js';

export const LOOK_STADT = {
  // TODO Heavy-Job: am Bild abstimmen
  turm: { rau: 0.42, metall: 0.55, glasRau: 0.1, glasDunkel: 0.35 },
  fenster: {
    raster: [1.7, 3.6],                  // m Fensterraster (waagrecht, Geschosshöhe) – P1-Abnahme: 3,4 m wirkte klotzig
    anteil: [0.26, 0.16, 0.34, 0.36],      // Anteil leuchtender Fenster je Art (glas, beton, band, schlucht)
    weiss: [0.82, 0.9, 1.0], cyan: [0.2, 0.85, 1.0], magenta: [1.0, 0.25, 0.8],
    pWeiss: 0.64, pCyan: 0.86,           // Anteile Farben (Rest Magenta)
    staerke: 1.5,                        // emissiv (linear)
    wechsel: 0.05, wechselZeit: 21,      // Anteil Fenster, die langsam an/aus gehen; s je Wechsel
    ferneAb: [0.3, 0.9],                 // Fensterzellen pro Pixel: ab hier Mittelwert statt Raster
  },
  boden: { farbe: 0x05060a, rau: [0.15, 0.3], metall: 0.3, rand: 3000 },
  fluss: { farbe: 0x020308, rau: 0.05, metall: 0.9 },
  bau: { farbe: 0x101218, rau: 0.6, metall: 0.45 },
  schild: { staerke: 3.2, puls: 1.3, flackerAnteil: 0.16, stroboAnteil: 0.07, zeilenPx: 96, breitePx: 1024 },
  flacker: { freq: 9, staerke: 1 },      // „kaputte Röhre“ (über blitze.strobo gedrosselt)
  strobo: { freq: 6, staerke: 0.9 },
  kante: { staerke: 3.0, dicke: 0.45, anteilDach: 0.3, anteilEcke: 0.1, nahAb: 350 },
  warn: { farbe: [1.0, 0.06, 0.03], staerke: 7, freq: 0.75, hMin: 200, groesse: 1.6 },
};

const U = {
  uZeit: { value: 0 }, uPuls: { value: LOOK_STADT.schild.puls },
  uFlackerFreq: { value: LOOK_STADT.flacker.freq }, uFlackerStaerke: { value: 1 },
  uStroboFreq: { value: LOOK_STADT.strobo.freq }, uStroboStaerke: { value: LOOK_STADT.strobo.staerke },
  uBlinkFreq: { value: LOOK_STADT.warn.freq },
};
const v3s = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(', ')})`;

// plan (P3): fertiger stadtPlan (z. B. aus dem Plan-Worker), sonst hier berechnet
export function baueStadt(bahn, { seed = 11, qualitaet = 1, blitze = null, plan: fertig = null } = {}) {
  const plan = fertig || stadtPlan(bahn, { seed, dichte: qualitaet >= 1 ? 1 : 0.6 });
  const r = rng((seed * 7919 + 13) >>> 0);
  const gruppe = new THREE.Group();
  gruppe.name = 'stadt';
  const teile = [];   // für dispose()
  const neu = (o) => { teile.push(o); return o; };

  // --- Türme (+ Fassaden-Turm) ---
  const tuerme = plan.tuerme.slice();
  const F = plan.fassade;
  const anzahl = tuerme.length + (F ? 1 : 0);
  const box = neu(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const turmGeo = neu(box.clone());
  const aHb = new Float32Array(anzahl * 3);
  const turmMat = neu(turmMaterial());
  const turmMesh = new THREE.InstancedMesh(turmGeo, turmMat, anzahl);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  tuerme.forEach((t, i) => {
    turmMesh.setMatrixAt(i, m.compose(p.set(t.x, 0, t.z), q.identity(), s.set(t.b, t.h, t.t)));
    turmMesh.setColorAt(i, c.setHex(t.farbe));
    aHb[i * 3] = TURM_ARTEN.indexOf(t.art); aHb[i * 3 + 1] = r(); aHb[i * 3 + 2] = t.h;
  });
  if (F) {
    const i = tuerme.length;
    turmMesh.setMatrixAt(i, m.compose(p.set(F.x, 0, F.z), q.setFromAxisAngle(Y, F.rot), s.set(F.b, F.h, F.t)));
    turmMesh.setColorAt(i, c.setHex(F.farbe));
    aHb[i * 3] = 0; aHb[i * 3 + 1] = r(); aHb[i * 3 + 2] = F.h;
  }
  turmGeo.setAttribute('aHb', new THREE.InstancedBufferAttribute(aHb, 3));
  turmMesh.computeBoundingSphere();
  turmMesh.name = 'tuerme';
  gruppe.add(turmMesh);

  // --- Leuchtteile sammeln: Kanten (Balken), Warnlichter, Schilder ---
  const kanten = [];   // { a:[x,y,z], b:[x,y,z], d, farbe, art }
  const kante = (a, b, farbe, art = 0, d = LOOK_STADT.kante.dicke) => kanten.push({ a, b, d, farbe, art });
  const K = LOOK_STADT.kante;
  // Dachkanten/Ecken an Türmen nahe der Strecke
  for (const t of tuerme) {
    const nah = t.art === 'schlucht' || (t.bahnAbstand != null && t.bahnAbstand < K.nahAb);
    if (!nah) continue;
    const farbe = r.pick(NEON_FARBEN), art = r.chance(0.12) ? 1 : 0;
    const x0 = t.x - t.b / 2, x1 = t.x + t.b / 2, z0 = t.z - t.t / 2, z1 = t.z + t.t / 2, y = t.h - 0.3;
    if (r.chance(t.art === 'schlucht' ? 0.8 : K.anteilDach)) {
      kante([x0, y, z0], [x1, y, z0], farbe, art); kante([x1, y, z0], [x1, y, z1], farbe, art);
      kante([x1, y, z1], [x0, y, z1], farbe, art); kante([x0, y, z1], [x0, y, z0], farbe, art);
    }
    if (r.chance(t.art === 'schlucht' ? 0.5 : K.anteilEcke)) {
      const ex = r.chance(0.5) ? x0 : x1, ez = r.chance(0.5) ? z0 : z1;
      kante([ex, 0, ez], [ex, t.h, ez], r.pick(NEON_FARBEN), r.chance(0.2) ? 2 : 0);
    }
  }
  // Fassaden-Turm: Vorderkanten + Leitlinien über/unter der Wandfahrt
  if (F) {
    const off = F.t / 2 + 0.3, fx = F.x + F.nx * off, fz = F.z + F.nz * off, hb = F.b / 2;
    const A = (y) => [fx - F.ex * hb, y, fz - F.ez * hb], B = (y) => [fx + F.ex * hb, y, fz + F.ez * hb];
    kante(A(0), A(F.h), 0x00f0ff, 0, 0.8); kante(B(0), B(F.h), 0x00f0ff, 0, 0.8);
    kante(A(F.h - 0.4), B(F.h - 0.4), 0xff2bd6, 0, 0.8);
    kante(A(F.yWand[1] + 3), B(F.yWand[1] + 3), 0xff2bd6, 0, 0.6);
    kante(A(F.yWand[0] - 3), B(F.yWand[0] - 3), 0x00f0ff, 0, 0.6);
  }

  // --- Bauten: Brücke, Pfeiler, Hafen-Kai ---
  const bauten = [];   // Matrizen
  const B = plan.bruecke;
  if (B) {
    const d = new THREE.Vector3(), up = new THREE.Vector3(), si = new THREE.Vector3(), mid = new THREE.Vector3();
    for (const st of B.stuecke) {
      d.set(st.bx - st.ax, st.by - st.ay, st.bz - st.az);
      const len = d.length() + 0.6; d.normalize();
      si.crossVectors(d, Y).normalize(); up.crossVectors(si, d);
      mid.set((st.ax + st.bx) / 2, (st.ay + st.by) / 2, (st.az + st.bz) / 2).addScaledVector(up, st.dicke / 2);
      const mm = new THREE.Matrix4().makeBasis(d, up, si).scale(s.set(len, st.dicke, st.breite)).setPosition(mid);
      bauten.push(mm.multiply(new THREE.Matrix4().makeTranslation(0, -0.5, 0)));   // Box-Fuß liegt bei 0 → Mitte
      // Neon: Deck-Kanten oben und unten
      for (const seite of [-1, 1]) {
        for (const hy of [0, st.dicke]) {
          const o = si.clone().multiplyScalar(seite * st.breite / 2);
          kante([st.ax + o.x + up.x * hy, st.ay + o.y + up.y * hy, st.az + o.z + up.z * hy],
            [st.bx + o.x + up.x * hy, st.by + o.y + up.y * hy, st.bz + o.z + up.z * hy], hy === 0 ? 0xff2bd6 : 0x00f0ff, 0, 0.5);
        }
      }
    }
    for (const pf of B.pfeiler) {
      bauten.push(new THREE.Matrix4().compose(p.set(pf.x, 0, pf.z), q.identity(), s.set(pf.b, pf.h, pf.b)));
      for (const [ox, oz] of [[-1, -1], [1, 1]]) {   // zwei Eck-Leuchtstreifen
        const ex = pf.x + ox * (pf.b / 2 + 0.1), ez = pf.z + oz * (pf.b / 2 + 0.1);
        kante([ex, 0, ez], [ex, pf.h, ez], 0x9d4dff, 0, 0.4);
      }
    }
  }
  const FL = plan.fluss;
  if (FL) {
    const h = FL.hafen, ex = Math.cos(h.rot), ez = -Math.sin(h.rot), nx = -ez, nz = ex;
    const ecke = (u, v) => [h.x + ex * u + nx * v, 3, h.z + ez * u + nz * v];
    const kai = (u0, v0, u1, v1) => {
      const a = ecke(u0, v0), b = ecke(u1, v1);
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      bauten.push(new THREE.Matrix4().compose(p.set((a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2),
        q.setFromAxisAngle(Y, Math.atan2(-(b[2] - a[2]), b[0] - a[0])), s.set(len + 4, 3, 4)));
      kante(a, b, 0xffb000, 1, 0.5);
    };
    const hb = h.b / 2, ht = h.t / 2;
    kai(-hb, -ht, hb, -ht); kai(hb, -ht, hb, ht); kai(hb, ht, -hb, ht); kai(-hb, ht, -hb, -ht);
  }
  if (bauten.length) {
    const bauMat = neu(new THREE.MeshStandardMaterial({ color: LOOK_STADT.bau.farbe, roughness: LOOK_STADT.bau.rau, metalness: LOOK_STADT.bau.metall }));
    const bm = new THREE.InstancedMesh(neu(box.clone()), bauMat, bauten.length);
    bauten.forEach((mm, i) => bm.setMatrixAt(i, mm));
    bm.computeBoundingSphere();
    bm.name = 'bauten';
    gruppe.add(bm);
  }

  // --- Neon-Kanten (1 Draw-Call) ---
  if (kanten.length) {
    const geo = neu(new THREE.BoxGeometry(1, 1, 1));
    const im = new THREE.InstancedMesh(geo, neu(leuchtMaterial()), kanten.length);
    const aL = new Float32Array(kanten.length * 2), a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3();
    kanten.forEach((k, i) => {
      a.fromArray(k.a); b.fromArray(k.b); dir.subVectors(b, a);
      const len = dir.length(); dir.normalize();
      q.setFromUnitVectors(Y, dir);
      im.setMatrixAt(i, m.compose(p.addVectors(a, b).multiplyScalar(0.5), q, s.set(k.d, len + k.d, k.d)));
      im.setColorAt(i, c.setHex(k.farbe).multiplyScalar(K.staerke));
      aL[i * 2] = k.art; aL[i * 2 + 1] = r();
    });
    geo.setAttribute('aLicht', new THREE.InstancedBufferAttribute(aL, 2));
    im.computeBoundingSphere();
    im.name = 'neonKanten';
    gruppe.add(im);
  }

  // --- Warnlichter auf hohen Dächern (langsames Blinken) ---
  const W = LOOK_STADT.warn;
  const warn = [];
  for (const t of tuerme) {
    if (t.h < W.hMin) continue;
    for (const [sx, sz] of [[-1, -1], [1, 1]]) warn.push([t.x + sx * (t.b / 2 - 1), t.h + W.groesse / 2, t.z + sz * (t.t / 2 - 1)]);
  }
  if (warn.length) {
    const geo = neu(new THREE.BoxGeometry(W.groesse, W.groesse, W.groesse));
    const im = new THREE.InstancedMesh(geo, neu(leuchtMaterial()), warn.length);
    const aL = new Float32Array(warn.length * 2);
    warn.forEach((w, i) => {
      im.setMatrixAt(i, m.makeTranslation(w[0], w[1], w[2]));
      im.setColorAt(i, c.setRGB(W.farbe[0] * W.staerke, W.farbe[1] * W.staerke, W.farbe[2] * W.staerke));
      aL[i * 2] = 3; aL[i * 2 + 1] = r();
    });
    geo.setAttribute('aLicht', new THREE.InstancedBufferAttribute(aL, 2));
    im.computeBoundingSphere();
    im.name = 'warnlichter';
    gruppe.add(im);
  }

  // --- Neon-Schilder: Canvas-Atlas (eine Zeile je Schriftzug), 1 Draw-Call ---
  if (plan.schilder.length && typeof document !== 'undefined') {
    const atlas = schildAtlas(SCHILD_TEXTE);
    neu(atlas.tex);
    const geo = neu(new THREE.PlaneGeometry(1, 1));
    const mat = neu(leuchtMaterial({ map: atlas.tex, zeilen: SCHILD_TEXTE.length }));
    const im = new THREE.InstancedMesh(geo, mat, plan.schilder.length);
    const aL = new Float32Array(plan.schilder.length * 2), aZ = new Float32Array(plan.schilder.length * 2);
    const S = LOOK_STADT.schild;
    plan.schilder.forEach((sc, i) => {
      q.setFromAxisAngle(Y, Math.atan2(sc.nx, sc.nz));
      im.setMatrixAt(i, m.compose(p.set(sc.x, sc.y, sc.z), q, s.set(sc.b, sc.h, 1)));
      im.setColorAt(i, c.setHex(sc.farbe).multiplyScalar(S.staerke));
      const z = Math.max(0, SCHILD_TEXTE.indexOf(sc.text));
      aZ[i * 2] = z; aZ[i * 2 + 1] = atlas.anteil[z];
      const w = r();
      aL[i * 2] = w < S.stroboAnteil ? 2 : w < S.stroboAnteil + S.flackerAnteil ? 1 : 0;
      aL[i * 2 + 1] = r();
    });
    geo.setAttribute('aLicht', new THREE.InstancedBufferAttribute(aL, 2));
    geo.setAttribute('aZeile', new THREE.InstancedBufferAttribute(aZ, 2));
    im.computeBoundingSphere();
    im.name = 'schilder';
    gruppe.add(im);
  }

  // --- Boden: dunkel, nass (Pfützen glatter) ---
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
  for (const t of tuerme) { bx0 = Math.min(bx0, t.x); bx1 = Math.max(bx1, t.x); bz0 = Math.min(bz0, t.z); bz1 = Math.max(bz1, t.z); }
  if (!isFinite(bx0)) { bx0 = bz0 = -1000; bx1 = bz1 = 1000; }
  const BO = LOOK_STADT.boden;
  const bodenGeo = neu(new THREE.PlaneGeometry(bx1 - bx0 + 2 * BO.rand, bz1 - bz0 + 2 * BO.rand).rotateX(-Math.PI / 2));
  const boden = new THREE.Mesh(bodenGeo, neu(bodenMaterial()));
  boden.position.set((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2);
  boden.name = 'boden';
  gruppe.add(boden);

  // --- Fluss + Hafenwasser: dunkles Spiegelband ---
  if (FL) {
    const wasserMat = neu(new THREE.MeshStandardMaterial({ color: LOOK_STADT.fluss.farbe, roughness: LOOK_STADT.fluss.rau, metalness: LOOK_STADT.fluss.metall }));
    const fluss = new THREE.Mesh(neu(bandGeometrie(FL.punkte, FL.breite, FL.y)), wasserMat);
    fluss.name = 'fluss';
    gruppe.add(fluss);
    const h = FL.hafen;
    const hafen = new THREE.Mesh(neu(new THREE.PlaneGeometry(h.b, h.t).rotateX(-Math.PI / 2)), wasserMat);
    hafen.position.set(h.x, FL.y - 0.05, h.z); hafen.rotation.y = h.rot;
    hafen.name = 'hafen';
    gruppe.add(hafen);
  }

  function update(t) {
    U.uZeit.value = t;
    const st = blitze ? blitze.strobo(LOOK_STADT.strobo.freq, LOOK_STADT.strobo.staerke) : { freq: LOOK_STADT.strobo.freq, staerke: LOOK_STADT.strobo.staerke };
    U.uStroboFreq.value = st.freq; U.uStroboStaerke.value = st.staerke;
    const fl = blitze ? blitze.strobo(LOOK_STADT.flacker.freq, LOOK_STADT.flacker.staerke) : { freq: LOOK_STADT.flacker.freq, staerke: LOOK_STADT.flacker.staerke };
    U.uFlackerFreq.value = fl.freq; U.uFlackerStaerke.value = fl.staerke;
  }
  function dispose() { for (const o of teile) o.dispose?.(); }
  return { gruppe, update, dispose, plan };
}

// --- Material: Türme mit prozeduralen Fenstern ---
function turmMaterial() {
  const L = LOOK_STADT.turm, Fe = LOOK_STADT.fenster;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: L.rau, metalness: L.metall });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uZeit = U.uZeit;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 aHb; varying vec3 vHbWelt; varying vec3 vHbN; varying vec3 vHb;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 hbW = vec4(transformed, 1.0); vec3 hbNo = objectNormal;
      #ifdef USE_INSTANCING
        hbW = instanceMatrix * hbW; hbNo = mat3(instanceMatrix) * hbNo;
      #endif
      vHbWelt = (modelMatrix * hbW).xyz; vHbN = normalize(mat3(modelMatrix) * hbNo); vHb = aHb;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uZeit; varying vec3 vHbWelt; varying vec3 vHbN; varying vec3 vHb;
      float hbHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      // Fenster-Raster auf den Seitenflächen (Weltkoordinaten: läuft über Instanz-Grenzen gleichmäßig)
      vec3 hbN = normalize(vHbN);
      float hbSeite = 1.0 - smoothstep(0.3, 0.6, abs(hbN.y));
      vec2 hbT = normalize(vec2(-hbN.z, hbN.x) + vec2(1e-5));
      int hbArt = int(vHb.x + 0.5);
      vec2 hbRast = vec2(${Fe.raster[0].toFixed(2)}, ${Fe.raster[1].toFixed(2)});
      vec2 hbRahmen = vec2(0.12, 0.2); float hbAnteil = ${Fe.anteil[0].toFixed(3)};
      if (hbArt == 1) { hbRast.x *= 1.5; hbRahmen = vec2(0.28, 0.3); hbAnteil = ${Fe.anteil[1].toFixed(3)}; }
      else if (hbArt == 2) { hbRast.x *= 4.0; hbRahmen = vec2(0.0, 0.34); hbAnteil = ${Fe.anteil[2].toFixed(3)}; }
      else if (hbArt == 3) { hbRahmen = vec2(0.08, 0.14); hbAnteil = ${Fe.anteil[3].toFixed(3)}; }
      vec2 hbQ = vec2(dot(vHbWelt.xz, hbT), vHbWelt.y) / hbRast;
      vec2 hbZelle = floor(hbQ), hbF = fract(hbQ), hbFw = fwidth(hbQ) + 1e-4;
      vec2 hbM = smoothstep(hbRahmen - hbFw, hbRahmen + hbFw, hbF) * smoothstep(hbRahmen - hbFw, hbRahmen + hbFw, 1.0 - hbF);
      float hbFenster = hbM.x * hbM.y * hbSeite
        * step(4.0, vHbWelt.y) * step(vHbWelt.y, vHb.z - 3.0);   // kein Fenster im Erdgeschoss / an der Dachkante
      vec2 hbK = hbZelle + vec2(vHb.y * 113.0) + hbN.xz * 17.0;
      float hbZ = hbHash(hbK);
      // ganze Geschosse/Fensterreihen dunkel bzw. hell (Büros, Wohnungen) statt reinem Pixel-Rauschen
      float hbEtage = hbHash(vec2(hbZelle.y, vHb.y * 71.0) + hbN.xz * 5.0);
      float hbBlock = hbHash(vec2(floor(hbZelle.x / 6.0), floor(hbZelle.y / 3.0)) + vHb.y * 29.0 + hbN.xz * 3.0);
      float hbAn = step(hbZ, hbAnteil * (0.25 + 1.5 * hbBlock) * (hbEtage < 0.18 ? 0.0 : 1.0));
      // einige Fenster wechseln langsam (Leben in der Stadt, kein Blitz)
      float hbSlot = floor(uZeit / ${Fe.wechselZeit.toFixed(1)} + hbZ * 7.0);
      if (hbHash(hbK + 3.1) < ${Fe.wechsel.toFixed(3)}) hbAn = step(0.5, hbHash(hbK + hbSlot));
      float hbC = hbHash(hbK + 7.7);
      vec3 hbFarbe = hbC < ${Fe.pWeiss.toFixed(3)} ? ${v3s(Fe.weiss)} : hbC < ${Fe.pCyan.toFixed(3)} ? ${v3s(Fe.cyan)} : ${v3s(Fe.magenta)};
      hbFarbe *= mix(0.25, 1.0, pow(hbHash(hbK + 5.3), 1.5));
      // Ferne: Raster unter Pixelgröße → Mittelwert (kein Moiré)
      float hbFern = smoothstep(${Fe.ferneAb[0].toFixed(2)}, ${Fe.ferneAb[1].toFixed(2)}, max(hbFw.x, hbFw.y));
      vec3 hbMittel = ${v3s(Fe.weiss)} * hbAnteil * 0.45 * hbSeite;
      vec3 hbLicht = mix(hbFarbe * hbAn * hbFenster, hbMittel, hbFern);
      // Glas: glatter und dunkler (Spiegelungen der Neon-Lichter)
      float hbGlas = mix(hbFenster, 0.5 * hbSeite, hbFern) * (hbArt == 1 ? 0.6 : 1.0);
      roughnessFactor = mix(roughnessFactor, ${L.glasRau.toFixed(3)}, hbGlas);
      diffuseColor.rgb *= mix(1.0, ${L.glasDunkel.toFixed(3)}, hbGlas);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += hbLicht * ${Fe.staerke.toFixed(3)};`);
  };
  mat.customProgramCacheKey = () => 'hb-turm-fenster-1';
  return mat;
}

// --- Material: Leuchtteile (Kanten, Warnlichter, Schilder) mit Puls/Flackern/Strobo/Blinken je Instanz ---
// aLicht = (Art, Phase): 0 ruhig atmend, 1 kaputte Röhre (Aussetzer), 2 Strobo, 3 Warnlicht-Blinken
function leuchtMaterial({ map = null, zeilen = 1 } = {}) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, map });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uZeit: U.uZeit, uPuls: U.uPuls, uFlackerFreq: U.uFlackerFreq, uFlackerStaerke: U.uFlackerStaerke,
      uStroboFreq: U.uStroboFreq, uStroboStaerke: U.uStroboStaerke, uBlinkFreq: U.uBlinkFreq });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec2 aLicht; ${map ? 'attribute vec2 aZeile;' : ''} varying float vLichtK;
      uniform float uZeit, uPuls, uFlackerFreq, uFlackerStaerke, uStroboFreq, uStroboStaerke, uBlinkFreq;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
      ${map ? `#ifdef USE_MAP
        // Atlas: Zeile aZeile.x (oben = 0, CanvasTexture mit flipY), Breite aZeile.y der Zeile um die Mitte
        vMapUv = vec2(0.5 + (uv.x - 0.5) * aZeile.y, 1.0 - (aZeile.x + 1.0 - uv.y) / ${zeilen.toFixed(1)});
      #endif` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      float lArt = aLicht.x, lPh = aLicht.y, lK = 1.0;
      if (lArt < 0.5) lK = 0.86 + 0.14 * sin(uZeit * uPuls + lPh * 6.2832);
      else if (lArt < 1.5) {
        float lSlot = floor(uZeit * uFlackerFreq + lPh * 97.0);
        float lZ = fract(sin(lSlot * 12.9898 + lPh * 78.233) * 43758.5453);
        lK = lZ < 0.22 ? 1.0 - 0.85 * uFlackerStaerke : 1.0;
      } else if (lArt < 2.5) lK = mix(1.0, step(0.5, fract(uZeit * uStroboFreq + lPh)), uStroboStaerke);
      else { float lB = fract(uZeit * uBlinkFreq + lPh); lK = 0.08 + 0.92 * smoothstep(0.0, 0.06, lB) * (1.0 - smoothstep(0.12, 0.4, lB)); }
      vLichtK = lK;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLichtK;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vLichtK;');
  };
  mat.customProgramCacheKey = () => (map ? 'hb-leucht-schild-1' : 'hb-leucht-1');
  return mat;
}

// --- Material: Boden (nass, Pfützen) ---
function bodenMaterial() {
  const BO = LOOK_STADT.boden;
  const mat = new THREE.MeshStandardMaterial({ color: BO.farbe, roughness: BO.rau[1], metalness: BO.metall });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vBoXZ;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBoXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec2 vBoXZ;
      float boHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float boRausch(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(boHash(i), boHash(i + vec2(1, 0)), f.x), mix(boHash(i + vec2(0, 1)), boHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float boP = 0.6 * boRausch(vBoXZ / 23.0) + 0.4 * boRausch(vBoXZ / 6.0);
      roughnessFactor = mix(${BO.rau[1].toFixed(3)}, ${BO.rau[0].toFixed(3)}, smoothstep(0.45, 0.7, boP));`);
  };
  mat.customProgramCacheKey = () => 'hb-boden-1';
  return mat;
}

// Band entlang einer Polylinie (Fluss), Breite w, Höhe y
function bandGeometrie(punkte, w, y) {
  const pos = [], idx = [];
  for (let j = 0; j < punkte.length; j++) {
    const a = punkte[Math.max(0, j - 1)], b = punkte[Math.min(punkte.length - 1, j + 1)];
    let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz * w / 2, nz = dx * w / 2;
    pos.push(punkte[j].x + nx, y, punkte[j].z + nz, punkte[j].x - nx, y, punkte[j].z - nz);
    if (j > 0) { const k = 2 * j; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Normalen nach oben erzwingen (Wicklung je nach Richtung)
  const n = g.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  g.computeBoundingSphere();
  return g;
}

// Schild-Atlas (nur im Browser): eine Zeile je Schriftzug, weiß leuchtend auf fast Schwarz (Farbe kommt aus der Instanz).
// Die Schrift wird genau auf schildAspekt(text) · Zeilenhöhe gezogen – so passt sie zu b/h aus dem Plan.
function schildAtlas(texte) {
  const S = LOOK_STADT.schild, H = S.zeilenPx, Wd = S.breitePx;
  const cv = document.createElement('canvas');
  cv.width = Wd; cv.height = H * texte.length;
  const g = cv.getContext('2d');
  g.fillStyle = '#060609';
  g.fillRect(0, 0, cv.width, cv.height);
  const anteil = [];
  texte.forEach((text, z) => {
    const bw = Math.min(Wd, schildAspekt(text) * H), x0 = (Wd - bw) / 2, y0 = z * H;
    anteil.push(bw / Wd);
    // Rahmen-Röhre
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.shadowColor = '#ffffff'; g.shadowBlur = 8;
    g.strokeRect(x0 + 5, y0 + 6, bw - 10, H - 12);
    g.restore();
    // Schrift
    g.save();
    g.font = `900 ${Math.round(H * 0.6)}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const mw = g.measureText(text).width || 1;
    g.translate(Wd / 2, y0 + H / 2 + 2);
    g.scale((bw - H * 0.55) / mw, 1);
    g.shadowColor = '#ffffff'; g.shadowBlur = 16; g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillText(text, 0, 0);
    g.shadowBlur = 0; g.fillStyle = '#ffffff';
    g.fillText(text, 0, 0);
    g.restore();
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, anteil };
}
