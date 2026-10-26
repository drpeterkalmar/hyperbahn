// Zeit-Logik von Anfang an online-fest (Peter 08./09.10.): ZWEI Uhren.
//  • Sim-Uhr: fester Physik-Schritt (ZEIT.schritt), netzsynchron. `zeitFaktor` ≠ 1 NUR offline (Solo/gegen KI: die ganze
//    Welt inkl. KI wird langsamer – fair). Online bleibt er immer 1 (gemeinsame Uhr).
//  • Präsentations-Uhr: Echtzeit für Kamera, Bild-Effekte, Ton. Online ersetzt eine Schein-Zeitlupe (FOV-Zoom, Unschärfe,
//    Farb-Flash, Ton tiefer, Kamera-Schwenk) die echte Zeitlupe – automatisch, ohne Option.
//
// Action-Momente (Peter 09.10.): Ereignis-Bus `actionMoment(art, stärke, pos)`. Die Regie entscheidet mit Abkühlzeit
// (≥ 8 s), Spektakel-Wertung + Zufall und Stufe Aus/Selten/Oft, ob ein Moment läuft, und nie, wenn der Spieler sofort
// reagieren muss (`kontext.gefahr`). Eingaben bleiben immer aktiv; die Physik läuft in der Zeitlupe nur langsamer.
//   Speed-Ramp: Abspieltempo 1× → 0,1× → 1,5× → 1× (≤ 1,2 s)   Zoom-Punch: schneller Ran-Zoom (≤ 0,6 s)
//   Bullet-Time: Zeit fast eingefroren (≤ 0,05×), Kamera fährt in ≈ 1 s im Halbkreis um den Moment, dann ruckartig zurück
//   (≤ 1,5 s). Phase 2: Explosion/Treffer melden sich über denselben Bus (Arten 'explosion', 'treffer').
import { ZEIT, ACTION, BLITZE } from '../config.js';
import { clamp, smoothstep, rng } from './util.js';

// --- Ereignis-Bus (klein, ohne Abhängigkeiten) ---
export class Bus {
  constructor() { this.h = new Map(); }
  on(name, fn) { if (!this.h.has(name)) this.h.set(name, []); this.h.get(name).push(fn); return () => this.off(name, fn); }
  off(name, fn) { const l = this.h.get(name); if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  emit(name, daten) { for (const fn of (this.h.get(name) || []).slice()) fn(daten); }
}
export const bus = new Bus();
// Schnittstelle für alle Auslöser (P1: Sprung-Scheitel, knappes Überholen, Boost-Ring-Kette, Ziel auf Platz 1, Looping mit
// Höchsttempo; P2: Explosion/Treffer)
export function actionMoment(art, staerke, pos, kontext = {}) { bus.emit('actionMoment', { art, staerke, pos, kontext }); }

// --- Sim-Uhr ---
export class Uhr {
  constructor({ online = false, schritt = ZEIT.schritt, maxSchritte = ZEIT.maxSchritte } = {}) {
    this.online = online;
    this.schritt = schritt; this.maxSchritte = maxSchritte;
    this.simZeit = 0; this.praesZeit = 0; this.schritte = 0;
    this.acc = 0;
    this.faktorExtern = 1;   // von der Regie/Akzent (nur offline wirksam)
    this.akzentRest = 0; this.akzentTempo = 1;
  }
  // tatsächlicher Zeitfaktor der Sim (online immer 1)
  get zeitFaktor() {
    if (this.online) return 1;
    let f = this.faktorExtern;
    if (this.akzentRest > 0) f = Math.min(f, this.akzentTempo);
    return f;
  }
  // Zeitlupe-Akzent (Absprung, 0,3 s): offline echt, online nur Schein (Rückgabe false → Präsentation macht den Schein)
  akzent(dauer = ZEIT.slowmoDauer, tempo = ZEIT.slowmoTempo) {
    if (!ZEIT.slowmo) return false;
    if (this.online) return false;
    this.akzentRest = dauer; this.akzentTempo = tempo;
    return true;
  }
  // je Bild: Echtzeit rein, Anzahl Sim-Schritte raus (Rest bleibt im Akku → bildratenunabhängig, deterministisch)
  tick(realDt) {
    realDt = clamp(realDt, 0, 0.25);
    this.praesZeit += realDt;
    if (this.akzentRest > 0) this.akzentRest -= realDt;
    this.acc += realDt * this.zeitFaktor;
    let n = Math.floor(this.acc / this.schritt + 1e-9);
    if (n > this.maxSchritte) { n = this.maxSchritte; this.acc = 0; } else this.acc -= n * this.schritt;
    this.schritte += n;
    this.simZeit += n * this.schritt;
    return n;
  }
  // Anteil für Interpolation zwischen letztem und nächstem Sim-Zustand (Rendern)
  get alpha() { return clamp(this.acc / this.schritt, 0, 1); }
}

// --- Blitz-Bremse („⚡ Blitze reduzieren“, WCAG ≤ 3 Blitze/s) ---
export class BlitzBremse {
  constructor(opt = {}) { this.reduziert = opt.reduziert ?? BLITZE.reduziert; this.max = opt.max ?? BLITZE.maxProSek; this.liste = []; }
  // darf jetzt ein Blitz (Stärke k) gezeigt werden? Rückgabe: wirksame Stärke (0 = unterdrückt)
  blitz(t, k = 1) {
    if (!this.reduziert) return k;
    while (this.liste.length && this.liste[0] <= t - 1) this.liste.shift();
    if (this.liste.length >= this.max) return 0;
    this.liste.push(t);
    return k * 0.55;   // gedämpft
  }
  // Strobo-/Lauflicht-Frequenz und -Stärke für Shader
  strobo(freq, staerke = 1) {
    if (!this.reduziert) return { freq, staerke };
    return { freq: Math.min(freq, this.max * 0.9), staerke: staerke * BLITZE.strobeDaempfung };
  }
}

// --- Action-Regie ---
// Spektakel-Gewicht je Art (Heavy-Job/Peter stimmen ab)
export const ARTEN = {
  sprungScheitel: { gewicht: 1.0, plan: 'bullet' },
  ueberholen: { gewicht: 0.75, plan: 'ramp' },
  beinahe: { gewicht: 0.8, plan: 'punch' },
  ringKette: { gewicht: 0.7, plan: 'ramp' },
  zielSieg: { gewicht: 1.0, plan: 'bullet' },
  magnetTempo: { gewicht: 0.58, plan: 'ramp' },   // P1-Messung: 0,65 → bei „Oft“ 57 von 83 Momenten Magnet
  explosion: { gewicht: 1.0, plan: 'bullet' },   // Phase 2
  treffer: { gewicht: 0.85, plan: 'punch' },     // Phase 2
};

// Zeitverläufe (Präsentations-Zeit t in s seit Start) → Abspieltempo (nur offline wirksam) und Effekt-Hüllkurven
export function rampTempo(t, dauer = ACTION.liveMax) {
  // 1× → 0,1× → 1,5× → 1×: Stützstellen in Anteilen der Dauer
  const k = [[0, 1], [0.12, 0.1], [0.62, 0.1], [0.82, 1.5], [1, 1]];
  const x = clamp(t / dauer, 0, 1);
  for (let i = 1; i < k.length; i++) {
    if (x <= k[i][0]) {
      const a = k[i - 1], b = k[i];
      return a[1] + (b[1] - a[1]) * smoothstep(0, 1, (x - a[0]) / (b[0] - a[0]));
    }
  }
  return 1;
}

export class ActionRegie {
  constructor({ stufe = ACTION.stufe, online = false, seed = 7, blitze = new BlitzBremse(), nurZiel = ACTION.nurZiel } = {}) {
    this.stufe = stufe; this.nurZiel = !!nurZiel; this.online = online; this.r = rng(seed); this.blitze = blitze;
    this.letzt = -Infinity;
    this.aktiv = null;
    this.statistik = { gemeldet: 0, ausgeloest: 0, jeArt: {} };
    this.fx = neueFx();
  }
  // Bus anschließen (Spiel ruft das einmal auf)
  verbinde(b = bus) { return b.on('actionMoment', (e) => this.melde(e.art, e.staerke, e.pos, e.kontext, e.t)); }

  // Moment melden; t = Präsentations-Zeit. Rückgabe: Plan oder null
  melde(art, staerke, pos, kontext = {}, t = this.t || 0) {
    this.statistik.gemeldet++;
    if (this.stufe <= 0 || this.aktiv) return null;
    if (this.nurZiel && art !== 'zielSieg') return null;           // 26.10.2026: nur im Ziel (?momente=alle)
    if (kontext.gefahr) return null;                               // Spieler muss sofort reagieren
    if (t - this.letzt < ACTION.abkuehl[this.stufe]) return null;  // Abkühlzeit
    const a = ARTEN[art]; if (!a) return null;
    const wertung = clamp(staerke, 0, 1) * a.gewicht + (this.r() - 0.5) * 0.3;
    if (wertung < ACTION.schwelle[this.stufe]) return null;
    const typ = a.plan;
    const dauer = typ === 'bullet' ? ACTION.bulletMax : typ === 'ramp' ? ACTION.liveMax : 0.6;
    this.aktiv = { art, typ, start: t, dauer, pos, staerke, richtung: this.r() < 0.5 ? -1 : 1, schein: this.online };
    this.letzt = t;
    this.statistik.ausgeloest++;
    this.statistik.jeArt[art] = (this.statistik.jeArt[art] || 0) + 1;
    this.blitzStart = this.blitze.blitz(t, 1);
    return this.aktiv;
  }

  // je Bild (Präsentations-Zeit t): Effekte + Zeitfaktor (offline). Online: zeitFaktor bleibt 1, Schein-Effekte stärker.
  aktualisiere(t) {
    this.t = t;
    const fx = this.fx; ruhe(fx);
    const a = this.aktiv;
    if (!a) return fx;
    const x = t - a.start;
    if (x >= a.dauer) { this.aktiv = null; fx.ende = true; return fx; }
    const u = x / a.dauer;
    // kurzer Weißblitz am Anfang (über Blitz-Bremse), Rückkehr mit kurzem Shake
    fx.weiss = this.blitzStart * Math.max(0, 1 - x / 0.12) * 0.6;
    fx.shake = u > 0.85 ? (1 - u) / 0.15 * 0.6 : 0;
    if (a.typ === 'ramp') {
      fx.zeitFaktor = a.schein ? 1 : rampTempo(x, a.dauer);
      const langsam = 1 - rampTempo(x, a.dauer);   // > 0 in der Zeitlupe
      fx.saettigung = 1 + 0.35 * clamp(langsam, 0, 1);
      fx.vignette = 0.35 * clamp(langsam, 0, 1);
      fx.fov = -10 * clamp(langsam, 0, 1);
      fx.ton = a.schein ? 1 - 0.35 * clamp(langsam, 0, 1) : rampTempo(x, a.dauer);
      fx.blur = a.schein ? 0.6 * clamp(langsam, 0, 1) : 0.3 * clamp(langsam, 0, 1);
    } else if (a.typ === 'punch') {
      const z = Math.sin(Math.PI * clamp(x / 0.35, 0, 1));
      fx.zoom = 1 + 0.35 * z;
      fx.radial = 0.8 * z;     // Radial-Blur/Speed-Lines
      fx.fov = -14 * z;
      fx.zeitFaktor = 1;
    } else if (a.typ === 'bullet') {
      // Zeit fast eingefroren (offline), Kamera fährt in ~1 s im Halbkreis, dann ruckartig zurück
      const halb = Math.min(1, x / 1.0);
      fx.zeitFaktor = a.schein ? 1 : (x < a.dauer - 0.12 ? ACTION.bulletTempo : 1);
      fx.orbit = a.richtung * Math.PI * smoothstep(0, 1, halb);
      fx.orbitAn = x < a.dauer - 0.12 ? 1 : 0;
      fx.ca = 0.6;
      fx.saettigung = 1.3; fx.vignette = 0.45;
      fx.ton = a.schein ? 0.7 : 0.35;
      fx.blur = 0;
    }
    return fx;
  }
}

function neueFx() { return { zeitFaktor: 1, weiss: 0, shake: 0, saettigung: 1, vignette: 0, fov: 0, zoom: 1, radial: 0, blur: 0, ca: 0, orbit: 0, orbitAn: 0, ton: 1, ende: false }; }
function ruhe(fx) { Object.assign(fx, neueFx()); }
