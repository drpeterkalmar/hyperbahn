// Bausteine für die Kulissen der P2-Strecken (prozedural, ohne Fremd-Assets): Gelände-Gitter, das unter der Bahn bleibt,
// Streuen von Instanzen abseits der Bahn, instanzierte Grundformen in einem Draw-Call je Art, Leuchtpunkte.
// Alle Formen sind three.js-Grundkörper (Box/Zylinder/Kegel/Kugel) als InstancedMesh – ein Draw-Call je Art, Farben je
// Instanz; Leuchtteile mit HDR-Farben (> 1 → Bloom im Kino-Look).
import * as THREE from 'three';
import { F_LUECKE } from '../track/bahn.js';

// Raster der Bahn-Mittellinie (alle ~8 m) für schnelle Abstands-Abfragen in der Ebene
export function bahnRaster(bahn, zelle = 120) {
  const m = new Map(), k = (x, z) => `${Math.floor(x / zelle)},${Math.floor(z / zelle)}`;
  const schritt = Math.max(1, Math.round(8 / bahn.ds));
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < bahn.N; i += schritt) {
    const x = bahn.px[i], y = bahn.py[i], z = bahn.pz[i];
    const key = k(x, z);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(x, y, z, bahn.hw[i], i);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  // naechste(x, z, r) → { d (Abstand zur Mittellinie in der Ebene), y (tiefste Bahnhöhe im Umkreis r), hw, i } oder null
  const naechste = (x, z, r = zelle) => {
    const cx = Math.floor(x / zelle), cz = Math.floor(z / zelle), n = Math.ceil(r / zelle);
    let best = Infinity, by = Infinity, bhw = 0, bi = -1;
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
      const l = m.get(`${cx + a},${cz + b}`); if (!l) continue;
      for (let j = 0; j < l.length; j += 5) {
        const d = Math.hypot(l[j] - x, l[j + 2] - z);
        if (d < best) { best = d; bhw = l[j + 3]; bi = l[j + 4]; }
        if (d < r) by = Math.min(by, l[j + 1]);
      }
    }
    return bi < 0 ? null : { d: best, y: by, hw: bhw, i: bi };
  };
  return { naechste, box: { x0, x1, z0, z1, y0, y1 } };
}

// Gelände-Gitter: hoehe(x, z) → m; unter der Bahn (und rund um sie) gedeckelt, damit die Bahn nie im Boden steckt.
// farbe(x, z, h, steil) → [r, g, b] (linear). Rückgabe Mesh (MeshStandardMaterial mit Vertexfarben).
export function gelaende(bahn, raster, { rand = 2500, n = 140, hoehe, farbe, frei = 10, flanke = 0.55, mat = {} }) {
  const B = raster.box, gx0 = B.x0 - rand, gz0 = B.z0 - rand, W = B.x1 - B.x0 + 2 * rand, D = B.z1 - B.z0 + 2 * rand;
  const geo = new THREE.PlaneGeometry(W, D, n, n).rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.getX(v) + gx0 + W / 2, z = pos.getZ(v) + gz0 + D / 2;
    let h = hoehe(x, z);
    const q = raster.naechste(x, z, 260);
    if (q) {
      // Deckel: unter der Bahn mindestens `frei` m Luft, daneben steigt das erlaubte Gelände mit `flanke` (m je m) an
      const max = q.y - frei + Math.max(0, q.d - q.hw - 12) * flanke;
      if (h > max) h = max;
    }
    pos.setXYZ(v, x, h, z);
  }
  geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  for (let v = 0; v < pos.count; v++) {
    const c = farbe(pos.getX(v), pos.getZ(v), pos.getY(v), 1 - nor.getY(v));
    col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0, ...mat }));
  m.name = 'gelaende';
  return m;
}

// Plätze abseits der Bahn streuen: Abstand zur Mittellinie zwischen dMin und dMax (ab Bahnkante), deterministisch
export function streuen(bahn, raster, r, anzahl, { dMin = 80, dMax = 2000, versuche = 20 } = {}) {
  const B = raster.box, out = [];
  for (let n = 0; n < anzahl; n++) {
    for (let v = 0; v < versuche; v++) {
      const x = r.range(B.x0 - dMax, B.x1 + dMax), z = r.range(B.z0 - dMax, B.z1 + dMax);
      const q = raster.naechste(x, z, Math.max(dMin + 40, 300));
      const d = q ? q.d - q.hw : Infinity;
      if (d < dMin) continue;
      if (dMax < Infinity && q === null && dMax < 300) continue;
      out.push({ x, z, d, y: q ? q.y : 0 });
      break;
    }
  }
  return out;
}

// Instanzierte Grundform: geo (BufferGeometry), mat, liste [{ x, y, z, sx, sy, sz, ry, rx, rz, farbe }]
export function instanzen(geo, mat, liste, name = 'deko') {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, liste.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  liste.forEach((o, i) => {
    q.setFromEuler(e.set(o.rx || 0, o.ry || 0, o.rz || 0));
    im.setMatrixAt(i, m.compose(p.set(o.x, o.y, o.z), q, s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)));
    if (o.farbe != null) im.setColorAt(i, Array.isArray(o.farbe) ? c.setRGB(...o.farbe) : c.set(o.farbe));
  });
  im.count = liste.length;
  im.computeBoundingSphere();
  im.name = name;
  return im;
}

// Leuchtpunkte (kleine Boxen, HDR-Farbe, blinken über eine Phase im Shader): liste [{ x, y, z, g (Größe), farbe [r,g,b] }]
export function leuchtpunkte(liste, { blink = 0.8, anteil = 1 } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const ph = new Float32Array(liste.map((o, i) => (i * 0.618) % 1));
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(ph, 1));
  const u = { uZeit: { value: 0 }, uRuhig: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: `attribute float phase; varying float vP; varying vec3 vC;
      void main() { vP = phase; vC = instanceColor; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uZeit, uRuhig; varying float vP; varying vec3 vC;
      void main() {
        // ein Anteil der Punkte blinkt (Warnlichter), „Blitze reduzieren“ (uRuhig) = ruhig
        float an = 1.0 - step(${(1 - anteil).toFixed(2)}, vP) * 0.75 * step(0.5, fract(uZeit * ${blink.toFixed(2)} + vP * 7.0));
        gl_FragColor = vec4(vC * mix(an, 0.85, uRuhig), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const im = instanzen(geo, mat, liste.map((o) => ({ ...o, sx: o.g, sy: o.g, sz: o.g, farbe: o.farbe || [3, 3, 3] })), 'leuchtpunkte');
  im.u = u;
  return im;
}

// Bahn-Punkt in Weltkoordinaten (für Kulissen-Objekte an Abschnitten): s, Querversatz u, Höhe h
export function anBahn(bahn, s, u = 0, h = 0) {
  return bahn.punkt(s, u, h, { x: 0, y: 0, z: 0 });
}

// Anfang (m) und Länge eines Abschnitts per Name
export function abschnitt(bahn, name) {
  const k = bahn.abschnitte.findIndex((a) => a.name === name);
  return k < 0 ? null : { s0: bahn.segStart[k], len: bahn.abschnitte[k].len, k };
}

// Lücken (Sprünge) als [s0, s1]
export function luecken(bahn) {
  const out = []; let st = -1;
  for (let i = 0; i <= bahn.N; i++) {
    const l = i < bahn.N && (bahn.flags[i] & F_LUECKE);
    if (l && st < 0) st = i;
    if (!l && st >= 0) { out.push([st * bahn.ds, i * bahn.ds]); st = -1; }
  }
  return out;
}

export function entsorgen(gruppe) {
  gruppe.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
}
