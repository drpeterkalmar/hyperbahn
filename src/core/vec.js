// Kleine 3D-Vektor-Mathe ohne Abhängigkeiten (Physik, Strecke, KI laufen so auch in Node-Tests ohne three.js).
// Konvention wie three.js: Welt-Oben = +y. Vektoren sind schlichte Objekte {x, y, z}; Funktionen mit Ziel-Argument
// `o` schreiben in o und geben o zurück (keine Speicher-Müll-Erzeugung im Physik-Schritt).

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const kopie = (a) => ({ x: a.x, y: a.y, z: a.z });
export function setze(o, x, y, z) { o.x = x; o.y = y; o.z = z; return o; }
export function von(o, a) { o.x = a.x; o.y = a.y; o.z = a.z; return o; }
export function add(o, a, b) { o.x = a.x + b.x; o.y = a.y + b.y; o.z = a.z + b.z; return o; }
export function sub(o, a, b) { o.x = a.x - b.x; o.y = a.y - b.y; o.z = a.z - b.z; return o; }
export function skal(o, a, k) { o.x = a.x * k; o.y = a.y * k; o.z = a.z * k; return o; }
// o = a + b·k
export function addSk(o, a, b, k) { o.x = a.x + b.x * k; o.y = a.y + b.y * k; o.z = a.z + b.z * k; return o; }
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export function kreuz(o, a, b) {
  const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
  o.x = x; o.y = y; o.z = z; return o;
}
export const laenge = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const abst = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
export function norm(o, a) {
  const l = laenge(a) || 1;
  o.x = a.x / l; o.y = a.y / l; o.z = a.z / l; return o;
}
// o = a·(1−t) + b·t
export function mix(o, a, b, t) { o.x = a.x + (b.x - a.x) * t; o.y = a.y + (b.y - a.y) * t; o.z = a.z + (b.z - a.z) * t; return o; }
export const endlich = (a) => Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);

// Drehung von v um die (normierte) Achse k um den Winkel w (Rodrigues), Ergebnis in o
const _k = v3();
export function drehe(o, v, k, w) {
  const c = Math.cos(w), s = Math.sin(w), kd = dot(k, v) * (1 - c);
  kreuz(_k, k, v);
  const x = v.x * c + _k.x * s + k.x * kd;
  const y = v.y * c + _k.y * s + k.y * kd;
  const z = v.z * c + _k.z * s + k.z * kd;
  o.x = x; o.y = y; o.z = z; return o;
}

// Dreht ein Rahmen-Tripel (vor, links, oben) um den Weltvektor ω·dt (Betrag = Winkel) und macht es wieder
// orthonormal (Gram-Schmidt, vor bleibt führend). Grundlage für Strecken-Rahmen und Gleiter-Lage.
const _ax = v3();
export function dreheRahmen(vor, links, oben, wx, wy, wz) {
  const w = Math.sqrt(wx * wx + wy * wy + wz * wz);
  if (w > 1e-12) {
    setze(_ax, wx / w, wy / w, wz / w);
    drehe(vor, vor, _ax, w); drehe(links, links, _ax, w); drehe(oben, oben, _ax, w);
  }
  orthoRahmen(vor, links, oben);
}
export function orthoRahmen(vor, links, oben) {
  norm(vor, vor);
  // oben = vor × links … erst links von vor befreien, dann oben = vor × links
  addSk(links, links, vor, -dot(links, vor)); norm(links, links);
  kreuz(oben, vor, links);
}
