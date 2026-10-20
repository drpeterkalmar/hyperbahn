// 3D-Minikarte (Nachtrag Peter 10.10.): die ganze Strecke als Neon-Band mit echten Höhen, schräg von oben, live im Rennen.
// Loopings/Korkenzieher/Wandfahrt sind sichtbar, weil das Band entlang der echten Quer-Richtung der Bahn (inkl. Querneigung)
// liegt; Sprung-Lücken bleiben offen, Magnet-Abschnitte pulsieren violett-cyan, Boost-Pads als gelbe Lichtpunkte,
// Start/Ziel weiß. Eigener Gleiter = Pfeil, Gegner = Punkte in Teamfarbe (Führender mit weißem Ring).
// Modus '3d' (schräg, Standard mitdrehend, Option Norden oben) | '2d' (Draufsicht) | 'aus'.
// Leistung: Geometrie einmal bauen; eigene kleine Szene in ein Render-Target (Standard 20 Hz), jedes Bild nur ein Quad
// per Scissor in die Bildschirm-Ecke (nach dem Kino-Look, ohne dessen Post-Effekte; „Glühen“ = breites additives Band).
import * as THREE from 'three';
import { F_MAGNET, F_LUECKE, F_ROEHRE, F_LANDEZONE } from '../track/bahn.js';

export const KARTE = { hz: 20, breite: 6, hoehe: 2.4, schritt: 3, neigung: 50, fov: 28, fuellung: 0.92 };

// rein: Band-Geometrie (Positionen, Farben, Magnet-Gewicht) aus der Bahn – Node-testbar
export function karteGeometrie(bahn, opt = {}) {
  const k = opt.schritt || KARTE.schritt, wb = opt.breite || KARTE.breite, hz = opt.hoehe || KARTE.hoehe;
  const pos = [], col = [], mag = [], idx = [], glowIdx = [];
  const n = Math.floor(bahn.N / k);
  const farbe = (f) => (f & F_MAGNET) ? [0.75, 0.35, 1.0] : (f & F_ROEHRE) ? [0.2, 1.0, 1.0] : (f & F_LANDEZONE) ? [0.4, 1.0, 0.55] : [0.25, 0.6, 1.0];
  for (let j = 0; j <= n; j++) {
    const i = (j * k) % bahn.N, f = bahn.flags[i];
    const w = bahn.hw[i] * wb;
    for (const s of [1, -1]) {
      pos.push(bahn.px[i] + bahn.lx[i] * w * s, (bahn.py[i] + bahn.ly[i] * w * s) * hz, bahn.pz[i] + bahn.lz[i] * w * s);
      col.push(...farbe(f)); mag.push(f & F_MAGNET ? 1 : 0);
    }
    if (j < n) {
      const i2 = ((j + 1) * k) % bahn.N;
      if ((f & F_LUECKE) || (bahn.flags[i2] & F_LUECKE)) continue;   // Sprung-Lücke bleibt offen
      const a = j * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  // Start/Ziel: kurzes weißes Stück an s = 0
  for (let j = 0; j < Math.max(1, Math.round(30 / (k * bahn.ds))); j++) for (const v of [j * 2, j * 2 + 1]) col.splice(v * 3, 3, 2.2, 2.2, 2.2);
  // Boost-Pads als Punkte (Mitte des Pads, leicht über dem Band)
  const pads = [];
  for (const p of bahn.pads) {
    const i = Math.round(((p.s0 + p.s1) / 2) / bahn.ds) % bahn.N;
    const u = (p.u0 + p.u1) / 2 || 0;
    pads.push(bahn.px[i] + bahn.lx[i] * u + bahn.ux[i] * 6, (bahn.py[i] + bahn.ly[i] * u + bahn.uy[i] * 6) * hz, bahn.pz[i] + bahn.lz[i] * u + bahn.uz[i] * 6);
  }
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < pos.length; v += 3) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], pos[v + c]); hi[c] = Math.max(hi[c], pos[v + c]); }
  return { pos: new Float32Array(pos), col: new Float32Array(col), mag: new Float32Array(mag), idx, pads: new Float32Array(pads), lo, hi, n: n + 1 };
}

const BAND_VS = `attribute vec3 farbe; attribute float mag; uniform float uZeit, uPuls; varying vec3 vC;
  void main() {
    vec3 c = farbe;
    // Magnet: violett ↔ cyan, Welle läuft entlang der Strecke (Puls gedämpft, wenn „Blitze reduzieren“)
    float w = 0.5 + 0.5 * sin(uZeit * 4.0 - position.x * 0.01 - position.z * 0.01);
    c = mix(c, mix(vec3(0.75, 0.3, 1.0), vec3(0.2, 0.95, 1.0), w) * (1.0 + 0.6 * uPuls * w), mag);
    vC = c; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// runde Leuchtpunkte (PointsMaterial wäre quadratisch): Größe in Render-Pixeln, Rand weich
function punktMaterial(farbe, ring = false) {
  return new THREE.ShaderMaterial({
    uniforms: { uGroesse: { value: 6 }, uFarbe: { value: farbe || new THREE.Color(1, 1, 1) }, uVc: { value: farbe ? 0 : 1 } },
    vertexShader: `attribute vec3 color; uniform float uGroesse, uVc; uniform vec3 uFarbe; varying vec3 vC;
      void main() { vC = mix(uFarbe, color, uVc); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uGroesse; }`,
    fragmentShader: `varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0;
      float a = ${ring ? 'smoothstep(0.62, 0.75, r) * (1.0 - smoothstep(0.88, 1.0, r))' : '1.0 - smoothstep(0.75, 1.0, r)'};
      if (a < 0.02) discard; gl_FragColor = vec4(vC * a, a); }`,
    transparent: true, depthTest: false, depthWrite: false,
  });
}
const BAND_FS = `uniform float uAlpha; varying vec3 vC; void main() { gl_FragColor = vec4(vC * uAlpha, uAlpha); }`;

export class Minikarte {
  constructor(renderer, bahn, opt = {}) {
    this.r = renderer; this.bahn = bahn;
    this.modus = opt.modus || '3d'; this.nord = !!opt.nord; this.gross = false;
    this.hz = opt.hz || KARTE.hz; this.letzt = -1; this.azimut = null; this.reduziert = false;
    const g = karteGeometrie(bahn);
    this.lo = g.lo; this.hi = g.hi;
    this.mitte = new THREE.Vector3((g.lo[0] + g.hi[0]) / 2, (g.lo[1] + g.hi[1]) / 2, (g.lo[2] + g.hi[2]) / 2);
    this.radius = Math.hypot(g.hi[0] - g.lo[0], g.hi[2] - g.lo[2]) / 2;
    this.szene = new THREE.Scene();
    this.U = { uZeit: { value: 0 }, uPuls: { value: 1 } };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    geo.setAttribute('farbe', new THREE.BufferAttribute(g.col, 3));
    geo.setAttribute('mag', new THREE.BufferAttribute(g.mag, 1));
    geo.setIndex(g.idx);
    const mat = (alpha, add) => new THREE.ShaderMaterial({ uniforms: { ...this.U, uAlpha: { value: alpha } }, vertexShader: BAND_VS, fragmentShader: BAND_FS,
      side: THREE.DoubleSide, transparent: true, depthWrite: !add, depthTest: true, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending });
    // Glühen: dasselbe Band leicht vergrößert, additiv und schwach (billiger Bloom-Ersatz, ohne Kino-Look)
    const gw = karteGeometrie(bahn, { breite: KARTE.breite * 2.6 });
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(gw.pos, 3));
    glowGeo.setAttribute('farbe', new THREE.BufferAttribute(gw.col, 3));
    glowGeo.setAttribute('mag', new THREE.BufferAttribute(gw.mag, 1));
    glowGeo.setIndex(gw.idx);
    const glow = new THREE.Mesh(glowGeo, mat(0.2, true));
    glow.renderOrder = 2;
    const kern = new THREE.Mesh(geo, mat(1, false)); kern.renderOrder = 1;
    this.szene.add(kern, glow);
    this.geos = [geo, glowGeo];
    // Höhen-Lote alle ~60 m bis zum Boden (Tiefen-Hinweis, zeigt die echten Höhen der Hochbahn)
    const lote = [], y0 = g.lo[1] - 40;
    for (let i = 0; i < bahn.N; i += Math.round(60 / bahn.ds)) {
      if (bahn.flags[i] & F_LUECKE) continue;
      lote.push(bahn.px[i], bahn.py[i] * KARTE.hoehe, bahn.pz[i], bahn.px[i], y0, bahn.pz[i]);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lote, 3));
    this.szene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2a4a8a, transparent: true, opacity: 0.55 })));
    this.geos.push(lg);
    // Pads
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(g.pads, 3));
    this.padPunkte = new THREE.Points(pg, punktMaterial(new THREE.Color(1, 0.85, 0.15)));
    this.szene.add(this.padPunkte);
    // Gegner-Punkte (bis 16) + Führungs-Ring
    this.nMax = 16;
    this.gp = new Float32Array(this.nMax * 3); this.gc = new Float32Array(this.nMax * 3);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(this.gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(this.gc, 3));
    this.punkte = new THREE.Points(gg, punktMaterial(null));
    this.punkte.renderOrder = 5; this.punkte.frustumCulled = false;
    this.ring = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
      punktMaterial(new THREE.Color(1, 1, 1), true));
    this.ring.renderOrder = 4; this.ring.frustumCulled = false;
    this.szene.add(this.ring, this.punkte);
    // eigener Gleiter: Pfeil (flaches Dreieck, Größe relativ zur Karte)
    const a = this.radius * 0.11;
    const pf = new THREE.BufferGeometry();
    pf.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, a * 1.2, a * 0.6, 0, -a * 0.7, 0, 0, -a * 0.35, 0, 0, a * 1.2, 0, 0, -a * 0.35, -a * 0.6, 0, -a * 0.7], 3));
    this.pfeil = new THREE.Mesh(pf, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.3), side: THREE.DoubleSide, depthTest: false }));
    this.pfeil.renderOrder = 6; this.pfeil.matrixAutoUpdate = false;
    this.szene.add(this.pfeil);
    this.kam = new THREE.PerspectiveCamera(KARTE.fov, 1, 10, this.radius * 20);
    // Render-Target + Quad für die Ecke
    this.rt = new THREE.WebGLRenderTarget(16, 16, { depthBuffer: true });
    this.quadSzene = new THREE.Scene();
    this.quadKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: { tMap: { value: this.rt.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tMap; varying vec2 vUv; void main() { gl_FragColor = texture2D(tMap, vUv); }',
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    }));
    this.szene.background = null;
    this.quadSzene.add(this.quad);
    this.m = new THREE.Matrix4(); this.v = new THREE.Vector3();
  }

  // Bildschirm-Rechteck (CSS-px, Ursprung oben links) – vom HUD-Element gemessen
  setzeRechteck(r) { this.rect = r; }

  // je Bild: t (Präsentationszeit), alle Teilnehmer (rennen.alle), Spieler-Index
  render(t, alle, spielerK) {
    if (this.modus === 'aus' || !this.rect || !this.rect.w) return;
    const r = this.r, dpr = r.getPixelRatio(), W = Math.round(this.rect.w * dpr), H = Math.round(this.rect.h * dpr);
    if (this.rt.width !== W || this.rt.height !== H) { this.rt.setSize(W, H); this.letzt = -1; }
    if (t - this.letzt >= 1 / this.hz || t < this.letzt) { this.letzt = t; this.zeichneRT(t, alle, spielerK, W / H); }
    // Quad in die Ecke (WebGL-Viewport: Ursprung unten links)
    const cw = r.domElement.clientWidth, ch = r.domElement.clientHeight;
    const x = this.rect.x, y = ch - this.rect.y - this.rect.h;
    const ac = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(null);
    r.setViewport(x, y, this.rect.w, this.rect.h); r.setScissor(x, y, this.rect.w, this.rect.h); r.setScissorTest(true);
    r.render(this.quadSzene, this.quadKam);
    r.setScissorTest(false); r.setViewport(0, 0, cw, ch);
    r.autoClear = ac;
  }

  zeichneRT(t, alle, spielerK, aspekt) {
    const b = this.bahn, ich = alle[spielerK];
    this.U.uZeit.value = t; this.U.uPuls.value = this.reduziert ? 0.25 : 1;
    // Punktgrößen in Render-Pixeln (Render-Target hat die Geräte-Pixeldichte)
    const dpr = this.r.getPixelRatio();
    this.punkte.material.uniforms.uGroesse.value = 7 * dpr; this.ring.material.uniforms.uGroesse.value = 13 * dpr; this.padPunkte.material.uniforms.uGroesse.value = 3.5 * dpr;
    // Teilnehmer
    let fuehrer = null;
    let n = 0;
    for (const tn of alle) {
      if (tn.platz === 1) fuehrer = tn;
      if (tn === ich || n >= this.nMax) continue;
      const c = new THREE.Color(tn.farbe);
      this.gp.set([tn.g.p.x, tn.g.p.y * KARTE.hoehe, tn.g.p.z], n * 3); this.gc.set([c.r, c.g, c.b], n * 3); n++;
    }
    this.punkte.geometry.setDrawRange(0, n);
    this.punkte.geometry.attributes.position.needsUpdate = true; this.punkte.geometry.attributes.color.needsUpdate = true;
    const rp = this.ring.geometry.attributes.position;
    this.ring.visible = !!fuehrer && fuehrer !== ich;
    if (this.ring.visible) { rp.setXYZ(0, fuehrer.g.p.x, fuehrer.g.p.y * KARTE.hoehe, fuehrer.g.p.z); rp.needsUpdate = true; }
    // Pfeil: Lage aus der Fahrtrichtung, flach in der Bahnebene (kopfüber bleibt er auf der Bahnseite sichtbar)
    const g = ich.g;
    const vx = g.vor.x, vz = g.vor.z, vy = g.vor.y * KARTE.hoehe;
    const z = new THREE.Vector3(vx, vy, vz).normalize(), y = new THREE.Vector3(g.oben.x, g.oben.y, g.oben.z);
    const x = new THREE.Vector3().crossVectors(y, z).normalize(); y.crossVectors(z, x);
    this.m.makeBasis(x, y, z).setPosition(g.p.x + g.oben.x * 12, g.p.y * KARTE.hoehe + g.oben.y * 12, g.p.z + g.oben.z * 12);
    this.pfeil.matrix.copy(this.m); this.pfeil.matrixWorldNeedsUpdate = true;
    // Kamera: mitdrehend = Fahrtrichtung (Bahn-Tangente geglättet über ±150 m) zeigt nach oben; Norden = fest
    let az = 0;
    if (!this.nord) {
      let tx = 0, tz = 0; const i0 = Math.floor(g.s / b.ds);
      for (let d = -75; d <= 75; d += 15) { const i = ((i0 + d) % b.N + b.N) % b.N; tx += b.tx[i]; tz += b.tz[i]; }
      const ziel = Math.atan2(tx, tz);
      if (this.azimut === null) this.azimut = ziel;
      let dA = ziel - this.azimut; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      this.azimut += Math.sign(dA) * Math.min(Math.abs(dA), 1.6 / this.hz);   // ≤ 1,6 rad/s, kein Herumspringen
      az = this.azimut;
    } else az = Math.PI;   // Norden (−z) oben
    const el = (this.modus === '2d' ? 89.5 : KARTE.neigung) * Math.PI / 180;
    const fovV = KARTE.fov * Math.PI / 180, fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspekt);
    const D = this.radius * KARTE.fuellung / Math.tan(Math.min(fovV, fovH) / 2);
    this.kam.aspect = aspekt; this.kam.updateProjectionMatrix();
    this.kam.position.set(this.mitte.x - Math.sin(az) * Math.cos(el) * D, this.mitte.y + Math.sin(el) * D, this.mitte.z - Math.cos(az) * Math.cos(el) * D);
    this.kam.up.set(0, 1, 0);
    if (this.modus === '2d') this.kam.up.set(Math.sin(az), 0, Math.cos(az));
    this.kam.lookAt(this.mitte);
    const r = this.r, alt = r.getRenderTarget(), ac = r.autoClear, cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    const tm = r.toneMapping; r.toneMapping = THREE.NoToneMapping;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x03040a, 0.88); r.autoClear = true;
    r.render(this.szene, this.kam);
    r.setRenderTarget(alt); r.setClearColor(cc, ca); r.autoClear = ac; r.toneMapping = tm;
  }

  dispose() { this.rt.dispose(); for (const g of this.geos) g.dispose(); }
}
