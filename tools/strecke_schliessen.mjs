// Stimmt die Schließ-Parameter von Strecke 1 ab (Nelder-Mead): zwei Geraden-Längen (a, b), Gierwinkel der letzten
// Kurve (c) und Steigung des Aufstiegs (d), damit Ende = Anfang (Lage + Rahmen). Ausgabe: SCHLUSS-Zeile für strecke1.js.
// Aufruf: node tools/strecke_schliessen.mjs
import { baueBahn } from '../src/track/bahn.js';
import { strecke1Abschnitte, SCHLUSS } from '../src/track/strecke1.js';

function fehler(x) {
  const [a, b, c, d] = x;
  if (a < 60 || b < 150 || d < 0 || d > 16) return 1e12;
  const bahn = baueBahn(strecke1Abschnitte({ a, b, c, d }));
  return bahn.schluss.m ** 2 + (bahn.schluss.grad * 20) ** 2;
}

function nelderMead(f, x0, schritt, iter = 400) {
  const n = x0.length;
  let pts = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += schritt[i]; pts.push(p); }
  let val = pts.map(f);
  for (let k = 0; k < iter; k++) {
    const ord = val.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
    pts = ord.map((i) => pts[i]); val = ord.map((i) => val[i]);
    const c = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += pts[i][j] / n;
    const refl = c.map((cj, j) => cj + (cj - pts[n][j]));
    const fr = f(refl);
    if (fr < val[0]) {
      const exp = c.map((cj, j) => cj + 2 * (cj - pts[n][j]));
      const fe = f(exp);
      if (fe < fr) { pts[n] = exp; val[n] = fe; } else { pts[n] = refl; val[n] = fr; }
    } else if (fr < val[n - 1]) { pts[n] = refl; val[n] = fr; } else {
      const con = c.map((cj, j) => cj + 0.5 * (pts[n][j] - cj));
      const fc = f(con);
      if (fc < val[n]) { pts[n] = con; val[n] = fc; } else {
        for (let i = 1; i <= n; i++) { pts[i] = pts[i].map((v, j) => pts[0][j] + 0.5 * (v - pts[0][j])); val[i] = f(pts[i]); }
      }
    }
    if (val[0] < 1e-6) break;
  }
  const i0 = val.indexOf(Math.min(...val));
  return { x: pts[i0], f: val[i0] };
}

const x0 = [SCHLUSS.a, SCHLUSS.b, SCHLUSS.c, SCHLUSS.d];
const vor = baueBahn(strecke1Abschnitte(SCHLUSS));
console.log('vorher', vor.schluss, 'L', vor.L.toFixed(0));
let best = { x: x0, f: fehler(x0) };
for (let r = 0; r < 4; r++) {
  const e = nelderMead(fehler, best.x, [120, 120, 4, 1.5]);
  if (e.f < best.f) best = e;
}
const [a, b, c, d] = best.x;
const nach = baueBahn(strecke1Abschnitte({ a, b, c, d }));
console.log('nachher', nach.schluss, 'L', nach.L.toFixed(0));
console.log(`export const SCHLUSS = { a: ${a.toFixed(2)}, b: ${b.toFixed(2)}, c: ${c.toFixed(3)}, d: ${d.toFixed(3)} };`);
