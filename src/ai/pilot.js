// KI-Fahrer (Port-Idee aus Stuntbahn ai/autopilot.js + profile.js, neu für Schwebe-Physik): fährt mit derselben
// Gleiter-Physik und denselben Eingaben wie der Spieler (gas, lenk, Luftbremsen, nase, rolle).
//
//  1. Ideallinie: Querversatz u*(s) per Relaxation (Punkte zur Mitte ihrer Nachbarn ziehen → außen–Scheitel innen–außen),
//     begrenzt auf die Fahrbahn; vor Sprüngen auf die Boost-Pad-Kette gezwungen („KI nutzt Pads und Sprünge“).
//  2. Tempoplan: Grenztempo aus der Krümmung der Linie (Querbeschleunigung ≤ querMax), rückwärts mit Bremsvermögen
//     verrechnet; Sprung-Anläufe immer Vollgas.
//  3. Lenken: Pure Pursuit auf einen Vorschaupunkt der Linie; Luftbremse innen, wenn die Lenkung nicht reicht.
//  4. Stärke-Profile mit menschlichen Fehlern (Linienrauschen, Tempofaktor, Wackler), deterministisch per Seed.
//  5. Fahrgefühl (Datenblatt): Drift mit Pump-Rhythmus in langen Kurven (Mini-Turbo), Start-Tipp im Countdown,
//     Gummiband-Modus (`gummi` von ai/gummiband.js: Tempo raus bzw. „schnell“ = volles Profil, kein Störfeld-Abzug).
import { GLEITER, VORLAGE } from '../config.js';
import { clamp, rng } from '../core/util.js';
import { v3, setze, dot } from '../core/vec.js';
import { F_LUECKE, F_SPRUNG, F_MAGNET, F_ROEHRE, F_TEILER, F_LANDEZONE, F_OFFEN_L, F_OFFEN_R, rahmenBei, neueAbfrage, spurGrenzen } from '../track/bahn.js';
import { lenkFaktor } from '../physics/fahrgefuehl.js';

export const PROFILE = {
  // boost = Anteil der Gelegenheiten (Gerade, genug Energie), bei denen der manuelle Energie-Boost gezogen wird; box = unter
  // diesem Energie-Stand fährt die KI durch die Boxengasse (P1b)
  // risiko (P2) = Anteil der KIs, die an Gabelungen den schnellen, riskanteren Weg nehmen
  leicht: { name: 'Leicht', tempo: 0.86, linie: 2.2, wackler: 0.05, rolle: 0.15, vorschau: 1.15, drift: 0, start: 0.15, boost: 0.3, box: 0.35, risiko: 0.2 },
  mittel: { name: 'Mittel', tempo: 0.93, linie: 1.2, wackler: 0.025, rolle: 0.45, vorschau: 1.0, drift: 0.5, start: 0.4, boost: 0.6, box: 0.5, risiko: 0.5 },
  profi: { name: 'Profi', tempo: 0.985, linie: 0.5, wackler: 0.008, rolle: 0.85, vorschau: 0.95, drift: 1, start: 0.7, boost: 0.9, box: 0.6, risiko: 0.85 },
};

const RAND_STD = 3.2;   // m Abstand der Linie zur Bahnkante
// Ausweichen seitlich (p1c): Gleiter innerhalb ±laengs m längs und quer näher als quer m → weg m zur Seite (?ausweich=0 aus)
// Ausweichen nach vorn (p1c): nächster Gleiter voraus, Zeit bis zum Kontakt < ttc s → schneller zur freien Seite (vornWeg m)
export const AUSWEICH = { seite: 1, laengs: 7, quer: 4.5, weg: 5, vorn: 1, ttc: 3, vornWeg: 6 };
if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('ausweich') === '0') { AUSWEICH.seite = 0; AUSWEICH.vorn = 0; }
export let DRIFT_RADIUS = 1000;   // m: Kurven enger als das (≥ 160 m lang) fährt die KI im Drift

// Ideallinie + Tempoplan für eine Bahn (einmal je Strecke, ~50 ms)
export function bauePlan(bahn, opt = {}) {
  const N = bahn.N, ds = bahn.ds;
  // P2-Strecken dürfen einen eigenen Kantenabstand der Linie mitbringen (bahn.planRand), Megastadt wie bisher
  const RAND = bahn.planRand || RAND_STD;
  const u = new Float64Array(N), lo = new Float64Array(N), hi = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const lim = Math.max(0, bahn.hw[i] - RAND);
    lo[i] = -lim; hi[i] = lim;
    if (bahn.flags[i] & F_LUECKE) { lo[i] = 0; hi[i] = 0; }
    // P2: offene Kante (ohne Bande) – mehr Abstand zur Kante
    if (bahn.flags[i] & F_OFFEN_L) hi[i] = Math.min(hi[i], bahn.hw[i] - RAND - 1.5);
    if (bahn.flags[i] & F_OFFEN_R) lo[i] = Math.max(lo[i], -bahn.hw[i] + RAND + 1.5);
  }
  // P2-Strecken (bahn.padsWeich): Landezone vorn mittig (±4 m bis 400 m hinter der Lücke) – sonst lenkt die KI im langen Flug
  // schon zur nächsten Kurve und landet an der Bande; danach weitet sich der Korridor über 200 m
  if (bahn.padsWeich) {
    for (let i = 0, nach = 1e9; i < 2 * N; i++) {
      const k = i % N;
      if (bahn.flags[k] & F_LUECKE) nach = 0; else nach += ds;
      if (nach < 600 && (bahn.flags[k] & F_LANDEZONE)) { const w = 4 + Math.max(0, nach - 400) * 0.06; lo[k] = Math.max(lo[k], -w); hi[k] = Math.min(hi[k], w); }
    }
  }
  // Relaxation, grob → fein
  const Q = new Float64Array(N * 3);
  const setQ = (i) => {
    Q[i * 3] = bahn.px[i] + bahn.slx[i] * u[i]; Q[i * 3 + 1] = bahn.py[i] + bahn.sly[i] * u[i]; Q[i * 3 + 2] = bahn.pz[i] + bahn.slz[i] * u[i];
  };
  const relax = () => {
    u.fill(0);
    for (let i = 0; i < N; i++) setQ(i);
    // P2-Strecken: zwei feine Durchgänge mehr – sonst bleibt ein Sägezahn mit 5 Stützstellen Periode (±0,1 m), der dem
    // Tempoplan scheinbare Kurven (Radius ≈ 200 m) vorgaukelt; die Megastadt bleibt wie bisher
    for (const [k, it] of bahn.padsWeich ? [[40, 60], [20, 80], [10, 120], [5, 120], [2, 80], [1, 80]] : [[40, 60], [20, 80], [10, 120], [5, 120]]) {
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
  };
  // Pads: Linie durch die Pads – vor Sprüngen (Kette ≤ 700 m vor einer Absprung-Rampe) Pflicht, sonst nur, wenn die freie
  // Linie ohnehin nah (≤ Pad-Halbbreite + 4 m) vorbeiführt (P2-Strecken mit bahn.padsWeich: sonst erzwänge ein Pad dicht
  // hinter einer Kurve einen Knick; die Megastadt bleibt wie bisher – alle Pads Pflicht)
  const vorSprung = (s) => { for (let d = 0; d <= 700; d += ds) if (bahn.flags[((Math.round((s + d) / ds) % N) + N) % N] & F_SPRUNG) return true; return false; };
  const lose = bahn.padsWeich ? bahn.pads.filter((p) => !vorSprung(p.s1)) : [];
  if (lose.length) relax();
  const uFrei = Float64Array.from(u);
  for (const p of bahn.pads) {
    // Pads an einer Gabelung zählen nur auf der Seite des eigenen Wegs
    const ip = ((Math.round((p.s0 + p.s1) / 2 / ds) % N) + N) % N;
    if (bahn.flags[ip] & F_TEILER && Math.sign(p.u - bahn.tu[ip]) !== (bahn.tschnell[ip] || 1) * ((opt.weg || 'sicher') === 'schnell' ? 1 : -1)) continue;
    if (lose.includes(p)) {
      const im = ((Math.round((p.s0 + p.s1) / 2 / ds) % N) + N) % N;
      if (Math.abs(uFrei[im] - p.u) > p.b + 4) { if (opt.log) opt.log(p, uFrei[im]); continue; }
    }
    for (let s = p.s0 - 30; s <= p.s1 + 10; s += ds) {
      const i = ((Math.round(s / ds) % N) + N) % N;
      lo[i] = Math.max(lo[i], p.u - p.b + 1); hi[i] = Math.min(hi[i], p.u + p.b - 1);
      if (lo[i] > hi[i]) lo[i] = hi[i] = p.u;
    }
  }
  // P2 Gabelungen: Linie auf eine Seite des Teilers – Weg „schnell“ = Seite tschnell (riskanter), „sicher“ = die andere;
  // Vorrang vor den Pads (Pads auf der anderen Seite zählen nicht); 150 m vor der Teiler-Spitze weich auf die Seite (der
  // Korridor wird zur Spitze hin linear enger, sonst entstünde ein Knick)
  const weg = opt.weg || 'sicher';
  const seiteBei = (i) => (bahn.tschnell[i] || 1) * (weg === 'schnell' ? 1 : -1);
  for (let i = 0; i < N; i++) {
    if (!(bahn.flags[i] & F_TEILER)) continue;
    const g = spurGrenzen(bahn, i, 0, RAND, seiteBei(i));
    const pl = Math.max(lo[i], g[0]), ph = Math.min(hi[i], g[1]);
    if (pl <= ph) { lo[i] = pl; hi[i] = ph; } else { lo[i] = g[0]; hi[i] = g[1]; }
    const vor = (i - 1 + N) % N;
    if (!(bahn.flags[vor] & F_TEILER)) {
      const sg = seiteBei(i), grenze = bahn.tu[i] + sg * (RAND + 1.5);
      for (let k = 1; k <= 75; k++) {
        const j = (i - k + N) % N, w = grenze - sg * (k / 75) * 2 * bahn.hw[j];
        if (sg > 0) lo[j] = Math.min(hi[j], Math.max(lo[j], w)); else hi[j] = Math.max(lo[j], Math.min(hi[j], w));
      }
    }
  }
  relax();
  // Krümmung der Linie in der Fahrfläche (quer) → Grenztempo
  const vLim = new Float64Array(N), kQuer = new Float64Array(N), kSign = new Float64Array(N);
  const quer = opt.quer || GLEITER.querMax * 0.8;
  const vmaxPlan = opt.vmaxPlan || GLEITER.vmax * 2.2;
  for (let i = 0; i < N; i++) {
    const a = (i - 3 + N) % N, c = (i + 3) % N;
    const h = 3 * ds;
    const dx = (Q[c * 3] - 2 * Q[i * 3] + Q[a * 3]) / (h * h), dy = (Q[c * 3 + 1] - 2 * Q[i * 3 + 1] + Q[a * 3 + 1]) / (h * h), dz = (Q[c * 3 + 2] - 2 * Q[i * 3 + 2] + Q[a * 3 + 2]) / (h * h);
    const ks = dx * bahn.slx[i] + dy * bahn.sly[i] + dz * bahn.slz[i];
    const kq = Math.abs(ks);
    kQuer[i] = kq; kSign[i] = ks;
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
  // Drift-Kurven: zusammenhängend Radius < DRIFT_RADIUS (geglättet), ≥ 160 m lang, gleiche Richtung, nicht im Sprung
  const kurven = [], kurveId = new Int16Array(N).fill(-1);
  const glatt = new Float64Array(N);
  for (let i = 0; i < N; i++) { let sum = 0; for (let k = -10; k <= 10; k++) sum += kSign[(i + k + N) % N]; glatt[i] = sum / 21; }
  let i0 = -1;
  for (let i = 0; i <= N; i++) {
    const ok = i < N && Math.abs(glatt[i]) > 1 / DRIFT_RADIUS && !voll[i] && !(bahn.flags[i] & F_LUECKE) && (i0 < 0 || Math.sign(glatt[i]) === Math.sign(glatt[i0]));
    if (ok && i0 < 0) i0 = i;
    if (!ok && i0 >= 0) {
      if ((i - i0) * ds >= 160) { const id = kurven.length; kurven.push({ s0: i0 * ds, s1: i * ds, seite: Math.sign(glatt[i0]) }); for (let k = i0; k < i; k++) kurveId[k] = id; }
      i0 = ok ? i : -1;
    }
  }
  return { u, vZiel, vLim, kQuer, kSign, voll, kurven, kurveId, weg };
}

// P2: Pläne für beide Wege einer Gabelung ({ sicher, schnell }; ohne Gabelung derselbe Plan zweimal)
export function bauePlaene(bahn, opt = {}) {
  const sicher = bauePlan(bahn, { ...opt, weg: 'sicher' });
  let gabel = false;
  for (let i = 0; i < bahn.N && !gabel; i++) if (bahn.flags[i] & F_TEILER) gabel = true;
  return { sicher, schnell: gabel ? bauePlan(bahn, { ...opt, weg: 'schnell' }) : sicher, gabel };
}
// Welchen Weg nimmt eine KI? Profi meist den schnellen, Leicht meist den sicheren (deterministisch per Seed)
export function wegFuer(profil, seed) {
  const p = profil.risiko ?? 0.5, r = rng(seed * 7 + 3)();
  return r < p ? 'schnell' : 'sicher';
}

const _d = v3(), _l = v3(), _f = v3(), _g = [0, 0];

export class Pilot {
  constructor(bahn, plan, profil = PROFILE.mittel, seed = 1) {
    this.bahn = bahn; this.plan = plan; this.profil = profil;
    this.r = rng(seed);
    this.rausch = 0; this.rauschZiel = 0; this.rauschT = 0;
    this.wackel = 0; this.wackelT = 0;
    this.ausweich = 0;
    this.q = neueAbfrage();
    this.ein = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0, boost: 0 };
    this.boostT = 0; this.zurBox = false; this.boxU = 0;
    this.rolleGeplant = false;
    this.gummi = null;
    this.driftT = 0; this.driftKurve = -1;
    // Start-Tipp relativ zu Grün (s): Treffer im Fenster mit Wahrscheinlichkeit profil.start, sonst zu früh/zu spät
    const rs = this.r();
    // abgestufter Start (P1b): Treffer streuen um den Idealpunkt vor Grün, sonst wie bisher um Grün
    const mitte = VORLAGE.start.grad ? VORLAGE.start.ideal + 0.01 : -0.01;
    this.startTipp = rs < (profil.start || 0) ? mitte - 0.05 + this.r() * 0.1 : (this.r() < 0.5 ? -0.9 - this.r() * 0.4 : 0.2 + this.r() * 0.3);
  }

  // Gas im Countdown/kurz nach Grün (rel = Zeit relativ zu Grün)
  startGas(rel) { return rel >= this.startTipp ? 1 : 0; }

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
    e.rolle = 0; e.nase = 0; e.boost = 0;
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
    let ziel = 0, rate = 2;
    if (AUSWEICH.vorn) {
      // p1c: nächster Gleiter voraus zählt; früher bei hoher Annäherung (Zeit bis zum Kontakt < ttc s) und schneller zur
      // Seite (rate 4/s); Seite = die, auf der die eigene Linie + Versatz weiter vom anderen weg liegt (in der Fahrbahn)
      let naechst = Infinity;
      for (const o of andere) {
        if (o === g || o.zustand !== 'fahrt') continue;
        let ds = o.s - g.s; if (ds < -b.L / 2) ds += b.L; if (ds > b.L / 2) ds -= b.L;
        const dv = g.tempo - o.tempo, ttc = dv > 0.5 ? ds / dv : Infinity;
        if (ds > 0 && ds < naechst && Math.abs(o.u - g.u) < 5 && ((ds < 45 && dv > -3) || ttc < AUSWEICH.ttc)) {
          naechst = ds;
          const lin = this.linieBei(o.s), lim = b.hw[((Math.floor(o.s / b.ds) % b.N) + b.N) % b.N] - 2.4;
          const plus = clamp(lin + AUSWEICH.vornWeg, -lim, lim), minus = clamp(lin - AUSWEICH.vornWeg, -lim, lim);
          ziel = (Math.abs(plus - o.u) >= Math.abs(minus - o.u) ? plus : minus) - lin;
          if (ttc < AUSWEICH.ttc) rate = 4;
        }
      }
    } else for (const o of andere) {
      if (o === g || o.zustand !== 'fahrt') continue;
      let ds = o.s - g.s; if (ds < -b.L / 2) ds += b.L; if (ds > b.L / 2) ds -= b.L;
      if (ds > 0 && ds < 45 && Math.abs(o.u - g.u) < 4.5 && o.tempo < g.tempo + 3) {
        const hw = b.hw[Math.floor(g.hint) % b.N];
        ziel = o.u > 0 || o.u > hw - 6 ? -5 : 5;
        if (Math.abs(o.u) < 1) ziel = g.u >= o.u ? 5 : -5;
      }
    }
    // p1c: Gleiter direkt daneben (Seite an Seite, weiche Stöße trennen kaum noch) → Platz machen statt Schleifen
    if (AUSWEICH.seite) for (const o of andere) {
      if (o === g || o.zustand !== 'fahrt') continue;
      let ds = o.s - g.s; if (ds < -b.L / 2) ds += b.L; if (ds > b.L / 2) ds -= b.L;
      if (Math.abs(ds) < AUSWEICH.laengs && Math.abs(o.u - g.u) < AUSWEICH.quer) ziel = (g.u >= o.u ? 1 : -1) * AUSWEICH.weg;
    }
    this.ausweich += (ziel - this.ausweich) * Math.min(1, dt * rate);
    // Vorschaupunkt auf der Linie
    const la = clamp((14 + 0.42 * v) * pr.vorschau, 16, 85);
    const sv = g.s + la;
    const i = ((Math.floor(sv / b.ds) % b.N) + b.N) % b.N;
    const imSprung = (b.flags[i] & (F_LUECKE | F_SPRUNG)) || (b.flags[Math.floor(g.hint) % b.N] & (F_LUECKE | F_SPRUNG));
    let uz = clamp(this.linieBei(sv) + (imSprung ? 0 : this.rausch + this.ausweich), -(b.hw[i] - 2.4), b.hw[i] - 2.4);
    // Boxengasse (P1b): mit wenig Energie ab 250 m davor auf die Lade-Spur, bis zu ihrem Ende
    const bx = b.box, VE = VORLAGE.energie;
    if (bx && VE.an && VE.box > 0) {
      let d = bx.s0 - g.s; if (d < -b.L / 2) d += b.L; if (d > b.L / 2) d -= b.L;
      if (d > 0 && d < 250 && g.schild < (pr.box ?? 0.5)) this.zurBox = true;
      if (this.zurBox && (d < -(bx.s1 - bx.s0) || g.schild > 0.97)) this.zurBox = false;
      // weich hinüber (wie beim Ausweichen), sonst lenkt die KI ruckartig, bremst und gerät ins Rutschen
      const ziel = this.zurBox ? bx.u - this.linieBei(sv) : 0;
      this.boxU += (ziel - this.boxU) * Math.min(1, dt * 1.2);
      uz = clamp(uz + this.boxU, -(b.hw[i] - 2.4), b.hw[i] - 2.4);
    }
    // P2 Gabelung: Ziel auf derselben Seite des Teilers bleiben (am Teiler die eigene Seite, davor die der Linie)
    const ig = ((Math.floor(g.s / b.ds) % b.N) + b.N) % b.N;
    if (b.flags[i] & F_TEILER) {
      const sg = (b.flags[ig] & F_TEILER) ? (g.u >= b.tu[ig] ? 1 : -1) : (this.linieBei(sv) >= b.tu[i] ? 1 : -1);
      const gr = spurGrenzen(b, i, 0, 2.4, sg, _g);
      uz = clamp(uz, gr[0], gr[1]);
    }
    // offene Kante: Ziel nicht näher als 4 m an die Kante
    if (b.flags[i] & F_OFFEN_L) uz = Math.min(uz, b.hw[i] - 4);
    if (b.flags[i] & F_OFFEN_R) uz = Math.max(uz, -b.hw[i] + 4);
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
    const kappe = Math.min(GLEITER.gierMax, GLEITER.querMax / v) * Math.max(0.2, lenkFaktor(v / GLEITER.vmax));
    // Nase gegenüber Fahrtrichtung (Rutschwinkel) dämpfen
    const rutsch = Math.atan2(dot(g.v, g.links), Math.max(dot(g.v, g.vor), 1));
    let lenk = gierSoll / kappe + rutsch * 0.6 + this.wackel;
    this._gierSoll = gierSoll; this._kappe = kappe; this._rutsch = rutsch;
    e.lenk = clamp(lenk, -1, 1);
    // Tempo (Gummiband: „schnell“ = volles Profil + kein Störfeld-Abzug, sonst ggf. Tempo-Deckel; nie in Sprung-Anläufen)
    const gm = this.gummi;
    g.randImmun = !!(gm && gm.schnell);
    let vz = this.zielBei(g.s + v * 0.6) * (gm && gm.schnell ? Math.max(pr.tempo, 1) : pr.tempo);
    const voll = this.plan.voll[((Math.round(g.s / b.ds) % b.N) + b.N) % b.N];
    if (gm && gm.tempo < 1 && !voll) vz = Math.min(vz, GLEITER.vmax * gm.tempo * (1 + g.boost));
    e.gas = voll ? 1 : clamp((vz - v) / 6 + 0.6, 0, 1);
    const zuSchnell = !voll && v > vz + 3;
    const sat = Math.abs(lenk) > 1.05;
    e.bremseL = (zuSchnell || sat) && lenk > 0 ? clamp((v - vz) / 10 + (sat ? 0.6 : 0), 0, 1) : 0;
    e.bremseR = (zuSchnell || sat) && lenk < 0 ? clamp((v - vz) / 10 + (sat ? 0.6 : 0), 0, 1) : 0;
    if (zuSchnell && Math.abs(lenk) < 0.2) { e.bremseL = e.bremseR = clamp((v - vz) / 12, 0, 1); }
    this.driften(g, dt, e, v, imSprung);
    // Energie-Boost (P1b): auf Geraden (Plan hat dort Höchsttempo, 300 m voraus keine enge Kurve), genug Energie übrig,
    // nicht in der Boxengasse, höchstens alle 2 s eine Entscheidung
    this.boostT -= dt;
    if (VE.an && g.boostFrei && g.boden && this.boostT <= 0 && !this.zurBox && g.boost < 0.05 && g.schild > (pr.box ?? 0.5) + VE.kosten && v > GLEITER.vmax * 0.75) {
      this.boostT = 2;
      // keine Magnet-/Röhren-/Sprung-Passage in den nächsten 700 m (über ~120 m/s hebt der Gleiter dort ab)
      let gerade = true;
      for (let k = 0; k <= 700 && gerade; k += 20) {
        const j = ((Math.round((g.s + k) / b.ds) % b.N) + b.N) % b.N;
        gerade = !(b.flags[j] & (F_MAGNET | F_ROEHRE | F_SPRUNG | F_LUECKE)) && (k > 300 || this.zielBei(g.s + k) >= GLEITER.vmax * 1.2);
      }
      if (gerade && this.r() < (pr.boost ?? 0)) e.boost = 1;
    }
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

  // Drift in langen Kurven: Luftbremse innen halten, im Rhythmus pumpen (0,33 s halten, dann 0,07 s los / 0,17 s halten),
  // ~0,35 s vor Kurvenende loslassen → Mini-Turbo. Profil.drift = Anteil der Kurven, in denen gedriftet wird.
  driften(g, dt, e, v, imSprung) {
    const b = this.bahn, pr = this.profil;
    const i = ((Math.round(g.s / b.ds) % b.N) + b.N) % b.N;
    const id = this.plan.kurveId ? this.plan.kurveId[i] : -1;
    if (id !== this.driftKurve) {
      this.driftKurve = id; this.driftT = 0;
      this.driftJa = id >= 0 && this.r() < (pr.drift || 0);
    }
    if (id < 0 || !this.driftJa || !g.boden || imSprung || g.treff) { this.driftT = 0; return; }
    const K = this.plan.kurven[id];
    let rest = K.s1 - g.s; if (rest < -b.L / 2) rest += b.L;
    if (rest < v * 0.35) return;                                    // loslassen → Mini-Turbo
    if (!g.drift.aktiv && Math.sign(e.lenk) !== K.seite) return;    // erst einlenken
    if (!g.drift.aktiv && Math.abs(e.lenk) < 0.32) e.lenk = K.seite * 0.32;
    this.driftT += dt;
    const t = this.driftT;
    const halten = t < 0.33 || ((t - 0.33) % 0.24) >= 0.07;
    const bremse = halten ? 1 : 0;
    if (K.seite > 0) { e.bremseL = bremse; e.bremseR = 0; } else { e.bremseR = bremse; e.bremseL = 0; }
    // Lenkung neu rechnen: die innere Luftbremse dreht selbst mit (Physik: (lenk + 0,35·Bremse) · Kappe · (1 + 0,75·Bremse))
    if (g.drift.aktiv) {
      const f = 1 + GLEITER.luftbremseGier * bremse;
      const l = this._gierSoll / (this._kappe * f) - 0.35 * bremse * K.seite + this._rutsch * 0.6;
      e.lenk = clamp(l, K.seite > 0 ? -0.35 : -1, K.seite > 0 ? 1 : 0.35);
    }
    void F_MAGNET;
  }
}
