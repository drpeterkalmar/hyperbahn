// Stimmt die Schließ-Parameter einer Strecke ab (Nelder-Mead): bei Strecke 1 zwei Geraden-Längen (a, b), Gierwinkel der
// letzten Kurve (c) und Steigung des Aufstiegs (d), damit Ende = Anfang (Lage + Rahmen); die P2-Strecken bringen ihre
// Parameter selbst mit (SCHLUSS, SCHLUSS_SCHRITT, schlussOk, abschnitte(sch)). Ausgabe: SCHLUSS-Zeile für die Strecken-Datei.
// Aufruf: node tools/strecke_schliessen.mjs [kurz|lang|wueste|riff|gebirge|orbit]   (Standard lang)
import { baueBahn } from '../src/track/bahn.js';
import { strecke1Abschnitte, SCHLUSS as S1, SCHLUSS_KURZ } from '../src/track/strecke1.js';
import { MODULE } from '../src/track/alle.js';

const arg = process.argv[2] || 'lang';
const fassung = arg === 'kurz' ? 'kurz' : 'lang';
const mod = MODULE[arg] && arg !== 'megastadt' && arg !== 'megastadt-lang' ? MODULE[arg] : null;
const START = mod ? mod.SCHLUSS : fassung === 'kurz' ? SCHLUSS_KURZ : S1;
const KEYS = Object.keys(START);
const alsSch = (x) => Object.fromEntries(KEYS.map((k, i) => [k, x[i]]));
const abschnitteVon = (sch) => (mod ? mod.abschnitte(sch) : strecke1Abschnitte(sch, fassung));
const startOpt = mod ? (mod.START ? { start: mod.START } : {}) : {};

function fehler(x) {
  const sch = alsSch(x);
  if (mod ? !mod.schlussOk(sch) : (sch.a < 60 || sch.b < 150 || sch.d < 0 || sch.d > 16)) return 1e12;
  const bahn = baueBahn(abschnitteVon(sch), { ...startOpt, ohneSchluss: true });
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

const x0 = KEYS.map((k) => START[k]);
const vor = baueBahn(abschnitteVon(START), startOpt);
console.log('vorher', vor.schluss, 'L', vor.L.toFixed(0));
let best = { x: x0, f: fehler(x0) };
const schritt = mod ? mod.SCHLUSS_SCHRITT : [120, 120, 4, 1.5];
for (let r = 0; r < 6; r++) {
  const e = nelderMead(fehler, best.x, schritt.map((v) => v / (1 + r)));
  if (e.f < best.f) best = e;
}
const sch = alsSch(best.x);
const nach = baueBahn(abschnitteVon(sch), startOpt);
console.log('nachher', nach.schluss, 'L', nach.L.toFixed(0));
const name = mod ? 'SCHLUSS' : fassung === 'kurz' ? 'SCHLUSS_KURZ' : 'SCHLUSS';
console.log(`export const ${name} = { ${KEYS.map((k) => `${k}: ${sch[k].toFixed(k === 'c' || k === 'd' ? 3 : 2)}`).join(', ')} };`);
