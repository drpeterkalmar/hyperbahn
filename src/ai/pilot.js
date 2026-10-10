// KI-Fahrer (Port-Idee aus Stuntbahn ai/autopilot.js + profile.js, neu für Schwebe-Physik): fährt mit derselben
// Gleiter-Physik und denselben Eingaben wie der Spieler (gas, lenk, Luftbremsen, nase, rolle).
//
//  1. Ideallinie: Querversatz u*(s) per Relaxation (Punkte zur Mitte ihrer Nachbarn ziehen → außen–Scheitel innen–außen),
//     begrenzt auf die Fahrbahn; vor Sprüngen auf die Boost-Pad-Kette gezwungen („KI nutzt Pads und Sprünge“).
//  2. Tempoplan: Grenztempo aus der Krümmung der Linie (Querbeschleunigung ≤ querMax), rückwärts mit Bremsvermögen
//     verrechnet; Sprung-Anläufe immer Vollgas.
//  3. Lenken: Pure Pursuit auf einen Vorschaupunkt der Linie; Luftbremse innen, wenn die Lenkung nicht reicht.
//  4. Stärke-Profile mit menschlichen Fehlern (Linienrauschen, Tempofaktor, Wackler), deterministisch per Seed.
import { GLEITER } from '../config.js';
import { clamp, rng } from '../core/util.js';
import { v3, setze, dot } from '../core/vec.js';
import { F_LUECKE, F_SPRUNG, rahmenBei, neueAbfrage } from '../track/bahn.js';

export const PROFILE = {
  leicht: { name: 'Leicht', tempo: 0.86, linie: 2.2, wackler: 0.05, rolle: 0.15, vorschau: 1.15 },
  mittel: { name: 'Mittel', tempo: 0.93, linie: 1.2, wackler: 0.025, rolle: 0.45, vorschau: 1.0 },
  profi: { name: 'Profi', tempo: 0.985, linie: 0.5, wackler: 0.008, rolle: 0.85, vorschau: 0.95 },
};

const RAND = 3.2;   // m Abstand der Linie zur Bahnkante

// Ideallinie + Tempoplan für eine Bahn (einmal je Strecke, ~50 ms)
export function bauePlan(bahn, opt = {}) {
  const N = bahn.N, ds = bahn.ds;
  const u = new Float64Array(N), lo = new Float64Array(N), hi = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const lim = Math.max(0, bahn.hw[i] - RAND);
    lo[i] = -lim; hi[i] = lim;
    if (bahn.flags[i] & F_LUECKE) { lo[i] = 0; hi[i] = 0; }
  }
  // Pads: Linie durch die Pads (vor Sprüngen Pflicht, sonst wenn breit genug); Absprung-Rampe mittig
  for (const p of bahn.pads) {
    for (let s = p.s0 - 30; s <= p.s1 + 10; s += ds) {
      const i = ((Math.round(s / ds) % N) + N) % N;
      lo[i] = Math.max(lo[i], p.u - p.b + 1); hi[i] = Math.min(hi[i], p.u + p.b - 1);
      if (lo[i] > hi[i]) lo[i] = hi[i] = p.u;
    }
  }
  for (let i = 0; i < N; i++) if (bahn.flags[i] & F_SPRUNG) { lo[i] = Math.max(lo[i], -2); hi[i] = Math.min(hi[i], 2); }
  // Relaxation, grob → fein
  const Q = new Float64Array(N * 3);
  const setQ = (i) => {
    Q[i * 3] = bahn.px[i] + bahn.slx[i] * u[i]; Q[i * 3 + 1] = bahn.py[i] + bahn.sly[i] * u[i]; Q[i * 3 + 2] = bahn.pz[i] + bahn.slz[i] * u[i];
  };
  for (let i = 0; i < N; i++) setQ(i);
  for (const [k, it] of [[40, 60], [20, 80], [10, 120], [5, 120]]) {
    for (let n = 0; n < it; n++) {
      for (let i = 0; i < N; i++) {
        const a = (i - k + N) % N, c = (i + k) % N;
        const mx = (Q[a * 3] + Q[c * 3]) / 2 - bahn.px[i], my = (Q[a * 3 + 1] + Q[c * 3 + 1]) / 2 - bahn.py[i], mz = (Q[a * 3 + 2] + Q[c * 3 + 2]) / 2 - bahn.pz[i];
        const z = mx * bahn.slx[i] + my * bahn.sly[i] + mz * bahn.slz[i];
        u[i] = clamp(u[i] + (z - u[i]) * 0.8, lo[i], hi[i]);
        setQ(i);
      }
    }
  }
  // Krümmung der Linie in der Fahrfläche (quer) → Grenztempo
  const vLim = new Float64Array(N), kQuer = new Float64Array(N);
  const quer = opt.quer || GLEITER.querMax * 0.8;
  const vmaxPlan = opt.vmaxPlan || GLEITER.vmax * 2.2;
  for (let i = 0; i < N; i++) {
    const a = (i - 3 + N) % N, c = (i + 3) % N;
    const h = 3 * ds;
    const dx = (Q[c * 3] - 2 * Q[i * 3] + Q[a * 3]) / (h * h), dy = (Q[c * 3 + 1] - 2 * Q[i * 3 + 1] + Q[a * 3 + 1]) / (h * h), dz = (Q[c * 3 + 2] - 2 * Q[i * 3 + 2] + Q[a * 3 + 2]) / (h * h);
    const kq = Math.abs(dx * bahn.slx[i] + dy * bahn.sly[i] + dz * bahn.slz[i]);
    kQuer[i] = kq;
    vLim[i] = kq > 1e-6 ? Math.min(vmaxPlan, Math.sqrt(quer / kq)) : vmaxPlan;
  }
  // rückwärts: v_i ≤ sqrt(v_{i+1}² + 2·verz·ds) (zweimal um die Runde, damit der Übergang am Ziel stimmt)
  const verz = opt.verz || 16;
  const vZiel = Float64Array.from(vLim);
  for (let n = 0; n < 2 * N; n++) {
    const i = (2 * N - 1 - n) % N, j = (i + 1) % N;
    vZiel[i] = Math.min(vZiel[i], Math.sqrt(vZiel[j] * vZiel[j] + 2 * verz * ds));
  }
  // Sprung-Anläufe: 700 m vor jedem Absprung + Lücke: Vollgas (Ziel = Plan-Maximum)
  const voll = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (bahn.flags[i] & (F_SPRUNG | F_LUECKE)) for (let k = 0; k < 350; k++) voll[(i - k + N) % N] = 1;
  }
  for (let i = 0; i < N; i++) if (voll[i]) vZiel[i] = vmaxPlan;
  return { u, vZiel, vLim, kQuer, voll };
}

const _d = v3(), _l = v3(), _f = v3();

export class Pilot {
  constructor(bahn, plan, profil = PROFILE.mittel, seed = 1) {
    this.bahn = bahn; this.plan = plan; this.profil = profil;
    this.r = rng(seed);
    this.rausch = 0; this.rauschZiel = 0; this.rauschT = 0;
    this.wackel = 0; this.wackelT = 0;
    this.ausweich = 0;
    this.q = neueAbfrage();
    this.ein = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
    this.rolleGeplant = false;
  }

  linieBei(s) {
    const b = this.bahn, N = b.N;
    const x = (((s / b.ds) % N) + N) % N, i = Math.floor(x), j = (i + 1) % N, t = x - i;
    return this.plan.u[i] + (this.plan.u[j] - this.plan.u[i]) * t;
  }
  zielBei(s) {
    const b = this.bahn, N = b.N;
    const i = ((Math.round(s / b.ds) % N) + N) % N;
    return this.plan.vZiel[i];
  }

  // Eingaben für einen Physik-Schritt; `andere` = Liste anderer Gleiter (Ausweichen)
  steuer(g, dt, andere = []) {
    const e = this.ein, b = this.bahn, pr = this.profil;
    e.rolle = 0; e.nase = 0;
    if (g.zustand !== 'fahrt') { e.gas = 0; e.lenk = 0; return e; }
    const v = Math.max(g.tempo, 5);
    // menschliche Fehler: langsames Linienrauschen + seltene Wackler
    this.rauschT -= dt;
    if (this.rauschT <= 0) { this.rauschZiel = (this.r() * 2 - 1) * pr.linie; this.rauschT = 1.5 + this.r() * 2.5; }
    this.rausch += (this.rauschZiel - this.rausch) * Math.min(1, dt * 0.8);
    this.wackelT -= dt;
    if (this.wackelT <= 0 && this.r() < pr.wackler * dt * 4) { this.wackel = (this.r() * 2 - 1) * 0.5; this.wackelT = 0.35; }
    if (this.wackelT <= 0) this.wackel = 0;
    // Ausweichen: Gleiter knapp voraus auf ähnlicher Linie → seitlich versetzen
    let ziel = 0;
    for (const o of andere) {
      if (o === g || o.zustand !== 'fahrt') continue;
      let ds = o.s - g.s; if (ds < -b.L / 2) ds += b.L; if (ds > b.L / 2) ds -= b.L;
      if (ds > 0 && ds < 45 && Math.abs(o.u - g.u) < 4.5 && o.tempo < g.tempo + 3) {
        const hw = b.hw[Math.floor(g.hint) % b.N];
        ziel = o.u > 0 || o.u > hw - 6 ? -5 : 5;
        if (Math.abs(o.u) < 1) ziel = g.u >= o.u ? 5 : -5;
      }
    }
    this.ausweich += (ziel - this.ausweich) * Math.min(1, dt * 2);
    // Vorschaupunkt auf der Linie
    const la = clamp((14 + 0.42 * v) * pr.vorschau, 16, 85);
    const sv = g.s + la;
    const i = ((Math.floor(sv / b.ds) % b.N) + b.N) % b.N;
    const imSprung = (b.flags[i] & (F_LUECKE | F_SPRUNG)) || (b.flags[Math.floor(g.hint) % b.N] & (F_LUECKE | F_SPRUNG));
    const uz = clamp(this.linieBei(sv) + (imSprung ? 0 : this.rausch + this.ausweich), -(b.hw[i] - 2.4), b.hw[i] - 2.4);
    const r = rahmenBei(b, sv, this.q);
    setze(_f, r.P.x + r.Ls.x * uz + r.Us.x * 1.4, r.P.y + r.Ls.y * uz + r.Us.y * 1.4, r.P.z + r.Ls.z * uz + r.Us.z * 1.4);
    setze(_d, _f.x - g.p.x, _f.y - g.p.y, _f.z - g.p.z);
    const qg = g.q;   // Fahrflächen-Rahmen am Gleiter
    // Richtung in der Fahrfläche: Bezug Fahrtrichtung (Geschwindigkeit), damit Rutschen mitgelenkt wird
    const hv = dot(g.v, qg.Us);
    setze(_l, g.v.x - qg.Us.x * hv, g.v.y - qg.Us.y * hv, g.v.z - qg.Us.z * hv);
    const lv = Math.hypot(_l.x, _l.y, _l.z) || 1;
    const fx = _l.x / lv, fy = _l.y / lv, fz = _l.z / lv;
    // links in der Fahrfläche = Us × f
    const lx = qg.Us.y * fz - qg.Us.z * fy, ly = qg.Us.z * fx - qg.Us.x * fz, lz = qg.Us.x * fy - qg.Us.y * fx;
    const ex = _d.x * fx + _d.y * fy + _d.z * fz, ey = _d.x * lx + _d.y * ly + _d.z * lz;
    const alpha = Math.atan2(ey, Math.max(ex, 1));
    const gierSoll = 2 * v * Math.sin(alpha) / Math.max(la, 1);
    const kappe = Math.min(GLEITER.gierMax, GLEITER.querMax / v);
    // Nase gegenüber Fahrtrichtung (Rutschwinkel) dämpfen
    const rutsch = Math.atan2(dot(g.v, g.links), Math.max(dot(g.v, g.vor), 1));
    let lenk = gierSoll / kappe + rutsch * 0.6 + this.wackel;
    e.lenk = clamp(lenk, -1, 1);
    // Tempo
    const vz = this.zielBei(g.s + v * 0.6) * pr.tempo;
    const voll = this.plan.voll[((Math.round(g.s / b.ds) % b.N) + b.N) % b.N];
    e.gas = voll ? 1 : clamp((vz - v) / 6 + 0.6, 0, 1);
    const zuSchnell = !voll && v > vz + 3;
    const sat = Math.abs(lenk) > 1.05;
    e.bremseL = (zuSchnell || sat) && lenk > 0 ? clamp((v - vz) / 10 + (sat ? 0.6 : 0), 0, 1) : 0;
    e.bremseR = (zuSchnell || sat) && lenk < 0 ? clamp((v - vz) / 10 + (sat ? 0.6 : 0), 0, 1) : 0;
    if (zuSchnell && Math.abs(lenk) < 0.2) { e.bremseL = e.bremseR = clamp((v - vz) / 12, 0, 1); }
    // Luft: Barrel-Roll, wenn noch genug Flugzeit bleibt (Stärke-abhängig, einmal je Sprung)
    if (!g.boden && g.luftZeit > 0.3 && g.luftZeit < 1.2) {
      if (!this.rolleGeplant) {
        this.rolleGeplant = true;
        let rest = 0, k = Math.floor(g.hint);
        while (rest < 600 && (b.flags[k % b.N] & F_LUECKE)) { k++; rest += b.ds; }
        this.rolleJa = rest / v > 1.6 && this.r() < pr.rolle;
      }
      if (this.rolleJa) { e.rolle = 1; this.rolleJa = false; }
    }
    if (g.boden) this.rolleGeplant = false;
    return e;
  }
}
