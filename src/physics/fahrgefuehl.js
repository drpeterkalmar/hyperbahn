// Fahrgefühl nach dem Clean-Room-Datenblatt (Peter 10.10.: „Spielgefühl eines klassischen 90er-Fun-Racers“,
// Fahrgefühl-Datenblatt aus Peters Plan-Ordner, Nachtrag 10.10., Abschnitt 3). Nur Mechanik und Größenordnungen, eigene Zahlen und Namen.
// Rein (ohne three.js), Node-testbar. Die Gleiter-Physik (gleiter.js) und das Rennen (rennen.js) nutzen es.
//
//  • Gewichtsklassen leicht/mittel/schwer mit Beschleunigung in 10 Tempo-Bändern (je 10 % Höchsttempo):
//    leicht zieht früh, schwer ist in der Mitte zäh und oben stark, die letzten 10 % dauern spürbar (+1,5 s).
//  • Lenk-Faktor nach Tempo (im Stand ≈ 0, „Sweet-Spot“ bei 90–100 % Höchsttempo ×1,33).
//  • Kurven-Abzug: Lenken kostet Höchsttempo (1 %/°), im Drift nur 0,4 %/°.
//  • Drift mit Mini-Turbo: Luftbremse auf der Kurveninnenseite halten = Rutschen; „Pumpen“ (kurz lösen, neu ziehen) hebt die
//    Funkenstufe (cyan → magenta → weiß-gold); Loslassen ab Stufe 2 = Schub-Puls mit Ausklingen. Zu lange gehalten = Stufe weg.
//  • Start-Boost im Zeitfenster um „Grün“, Überdrehen = Triebwerks-Stotterer.
//  • Treffer-Dreher mit Rettungsfenster (beide Luftbremsen = Abfangen), Neustart-Rhythmus (5 schnelle Gas-Tipper).
// Alle Werte: Startwerte mit URL-Regler (leseGefuehl), als „unsicher“ markierte Datenblatt-Werte mit TODO.
import { clamp, smoothstep } from '../core/util.js';

// Beschleunigung je Band in m/s² (bei Höchsttempo 95 m/s; ausgelegt auf 0→90 % in 2,5 / 3,0 / 2,8 s, letzte 10 % ≈ 1,5 s)
export const KLASSEN = {
  leicht: { name: 'Leicht', baender: [42.2, 45.5, 50.3, 55.2, 53.6, 43.8, 32.5, 21.9, 16.2, 6.3], top: 1.015, stoss: 0.8, rand: 0.26, neustart: 2.5 },
  mittel: { name: 'Mittel', baender: [49.2, 47.7, 44.9, 39.1, 33.3, 27.5, 23.2, 19.5, 15.2, 7.0], top: 1.0, stoss: 1.1, rand: 0.30, neustart: 2.0 },
  schwer: { name: 'Schwer', baender: [53.3, 52.2, 49.2, 36.9, 22.5, 19.0, 23.6, 29.7, 27.7, 6.3], top: 1.0, stoss: 2.2, rand: 0.34, neustart: 1.5 },
};
export const KLASSEN_LISTE = Object.keys(KLASSEN);

export const GEFUEHL = {
  beschl: 1.0,        // ?beschl=   Faktor auf alle Bänder
  gewicht: 1,         // ?gewicht=0 → alle Klassen wie „mittel“
  kurve: 0.010,       // ?kurve=    Höchsttempo-Abzug je Grad Lenkeinschlag
  kurveDrift: 0.004,  //            … im Drift
  lenkGrad: 12,       //            voller Lenkausschlag entspricht 12° (Annahme für den Kurven-Abzug)
  lenk: 1.0,          // ?lenk=     Faktor auf den Sweet-Spot-Bonus
  // Drift / Mini-Turbo
  drift: 1.0,         // ?drift=    Faktor auf den Mini-Turbo-Schub (0 = Drift ohne Turbo)
  mtzeit: 0.30,       // ?mtzeit=   s Halten bis Stufe 1
  mtStufe: 0.15,      //            s je weitere Stufe
  mtZuLang: 1.7,      //            s zu lange gehalten → Stufe verfällt
  driftPause: 0.25,   //            s Loslassen länger als das = Drift endet
  driftMinTempo: 0.35,//            Anteil Höchsttempo
  driftGrip: 0.45,    //            Seitenhaftung im Drift (Anteil)
  driftZug: 0.2,      //            Luftbremsen-Widerstand im Drift (Anteil): Drift ist Rutschen, nicht Bremsen
  mtGewinn: [0, 0, 0.18, 0.25], // Tempo-Anteil je Stufe
  mtAktiv: 0.6,       //            s voller Schub
  mtHalb: 1.0,        //            s Halbwertszeit des Ausklingens
  hupf: 1,            // ?hupf=0    Hüpfer beim Drift-Einstieg (nie in Magnet-Zonen)
  hupfHoehe: 0.6,     //            m
  // Start
  startfenster: 0.25, // ?startfenster= s Fenster um „Grün“
  ueberdrehen: 1.5,   //            s Dauergas vor Grün → Stotterer
  stotterer: 0.8,     //            s
  // Störfeld am Bahnrand, Landebonus
  rand: 0.30,         // ?rand=     Abzug Höchsttempo/Schub im Störfeld (Klasse skaliert), mit Boost nur halb
  randBreite: 2.8,    //            m Störfeld-Breite innen an der Begrenzung (Mitte des Gleiters)
  landebonus: 0.10,   // ?landebonus= Tempo-Bonus bei Landung in der markierten Landezone (statt Lande-Malus)
  // Treffer (Phase 2 nutzt das; P1 nur Schnittstelle + Test)
  treffer: 1.0,       // ?treffer=  Faktor auf den Tempoverlust
  schlingern: 0.9,    //            s Rettungsfenster
  dreher: 1.2,        //            s Kontrollverlust
  verlustMensch: 0.24, verlustKi: 0.60,   // Tempoverlust im Dreher (Mensch behält Schwung, KI verliert mehr)
  neustart: 1,        // ?neustart=0 Neustart-Rhythmus aus
  neustartTipps: 5, neustartTakt: [0.03, 0.13], neustartDauer: 2.0,
  // Stoß, Gummiband, Kamera, Items
  // p1c (Peter 22.10.: „Zusammenstöße sehr hart“): 0,85 → 0,42, Deckel 3 → 2, höchstens 6 m/s je Kontakt, weich verteilt
  // (game/rennen.js stoesse); ?stoss=alt = bisheriges Verhalten
  stoss: 0.42,        // ?stoss=    Impuls = stoss × Relativtempo × Gewichtsverhältnis (gedeckelt)
  stossDeckel: 2.0,   //            größtes Gewichtsverhältnis (leicht/schwer: 2,0 statt 2,75 → Verhältnis 5,5× statt 7,6×)
  stossMax: 6,        // ?stossmax= m/s größte Tempoänderung je Gleiter und Kontakt
  stossModus: 'weich',// ?stoss=alt
  gummiband: 0.5,     // ?gummiband= 0 aus, 1 normal (= 0,5), 2 stark (= 1,0) oder direkt 0…1 als Kommazahl
  fov: 62,            // ?fov=      Grund-Sichtfeld (vertikal)
  fovBoost: 12,       // ?fovboost=
  fovSprung: 18, fovTreffer: 10, fovRate: 40, fovZurueck: 24,
  items: 'hb',        // ?items=hb|ref (Phase 2)
};

export function leseGefuehl(search) {
  const q = new URLSearchParams(search || '');
  const z = (k, d) => { if (!q.has(k)) return d; const v = parseFloat(q.get(k)); return Number.isFinite(v) ? v : d; };
  for (const k of ['beschl', 'gewicht', 'kurve', 'lenk', 'drift', 'mtzeit', 'hupf', 'startfenster', 'rand', 'landebonus', 'treffer', 'neustart', 'stoss', 'fov'])
    GEFUEHL[k] = z(k, GEFUEHL[k]);
  GEFUEHL.fovBoost = z('fovboost', GEFUEHL.fovBoost);
  GEFUEHL.stossMax = z('stossmax', GEFUEHL.stossMax);
  if (q.get('stoss') === 'alt') GEFUEHL.stossModus = 'alt';
  if (q.has('gummiband')) {
    const g = q.get('gummiband');
    GEFUEHL.gummiband = g === '0' ? 0 : g === '1' ? 0.5 : g === '2' ? 1 : clamp(z('gummiband', 0.5), 0, 1);
  }
  if (q.has('items')) GEFUEHL.items = q.get('items') === 'hb' ? 'hb' : 'ref';
  return q;
}

export function klasse(name) { return GEFUEHL.gewicht ? (KLASSEN[name] || KLASSEN.mittel) : KLASSEN.mittel; }

// Beschleunigung bei Tempo-Anteil x = v / Höchsttempo (stückweise linear zwischen den Band-Mitten, 0 ab x ≥ 1)
export function bandBeschl(kl, x) {
  if (x >= 1) return 0;
  const b = kl.baender, f = Math.max(0, x) * 10 - 0.5;
  const i = Math.floor(f);
  let a;
  if (i < 0) a = b[0]; else if (i >= 9) a = b[9]; else a = b[i] + (b[i + 1] - b[i]) * (f - i);
  // ganz oben weich auf 0 (kein Ruck an der Höchsttempo-Grenze)
  return a * GEFUEHL.beschl * Math.min(1, (1 - x) * 40);
}

// Lenk-Faktor: im Stand ≈ 0, Sweet-Spot ab 90 % Höchsttempo
export function lenkFaktor(x) {
  const an = smoothstep(0, 0.08, x);
  const sweet = 1 + 0.33 * GEFUEHL.lenk * smoothstep(0.85, 0.9, x);
  return an * sweet;
}

// Kurven-Abzug als Faktor auf das Höchsttempo
export function kurvenFaktor(lenk, drift) {
  return 1 - (drift ? GEFUEHL.kurveDrift : GEFUEHL.kurve) * Math.abs(lenk) * GEFUEHL.lenkGrad;
}

// --- Drift-Zustandsautomat ---
// eingabe je Schritt: { boden, x (Tempo-Anteil), lenk, bremseL, bremseR, magnet }
// Rückgabe (wiederverwendet): { aktiv, stufe, seite, hupf (Hüpfer jetzt), turbo (Stufe, deren Mini-Turbo jetzt startet),
//   neueStufe, zuLang (Warnung), ende ('los'|'abbruch'|null) }
export class Drift {
  constructor() { this.reset(); this.aus = { aktiv: false, stufe: 0, seite: 0, hupf: false, turbo: 0, neueStufe: 0, zuLang: false, ende: null }; }
  reset() { this.aktiv = false; this.stufe = 0; this.seite = 0; this.halt = 0; this.pause = 0; this.gedrueckt = false; this.lenkLos = 0; this.luft = 0; this.warnung = false; }
  abbrechen() { if (this.aktiv) { this.reset(); this.aus.ende = 'abbruch'; } }

  schritt(dt, e) {
    const o = this.aus; o.hupf = false; o.turbo = 0; o.neueStufe = 0; o.zuLang = false; o.ende = null;
    const bremse = (s) => (s > 0 ? e.bremseL : e.bremseR) >= 0.5;
    if (!this.aktiv) {
      const seite = e.lenk > 0.3 ? 1 : e.lenk < -0.3 ? -1 : 0;
      if (e.boden && seite && e.x > GEFUEHL.driftMinTempo && bremse(seite)) {
        this.aktiv = true; this.seite = seite; this.stufe = 0; this.halt = 0; this.pause = 0; this.gedrueckt = true; this.lenkLos = 0; this.luft = 0; this.warnung = false;
        o.hupf = !!GEFUEHL.hupf && !e.magnet;
      }
    } else {
      // Abbruch: zu langsam, zu lange in der Luft, Lenkung lange los
      this.luft = e.boden ? 0 : this.luft + dt;
      // Gegenlenken (deutlich gegen die Drift-Seite) beendet den Drift; kleines Nachlenken ist erlaubt
      this.lenkLos = e.lenk * this.seite < -0.4 ? this.lenkLos + dt : 0;
      if (e.x < GEFUEHL.driftMinTempo * 0.85 || this.luft > 0.4) { this.reset(); o.ende = 'abbruch'; }
      else {
        const druck = bremse(this.seite);
        if (druck) {
          if (!this.gedrueckt) { this.gedrueckt = true; this.halt = 0; }
          this.halt += dt; this.pause = 0;
          if (this.halt > GEFUEHL.mtZuLang && !this.warnung) { this.warnung = true; o.zuLang = true; }
        } else {
          if (this.gedrueckt) {
            // Loslassen-Flanke: gehaltene Zeit wertet die Pump-Phase
            this.gedrueckt = false;
            if (this.warnung) this.stufe = 0;
            else if (this.halt >= (this.stufe === 0 ? GEFUEHL.mtzeit : GEFUEHL.mtStufe) && this.stufe < 3) { this.stufe++; o.neueStufe = this.stufe; }
            this.warnung = false;
          }
          this.pause += dt;
        }
        if (this.pause > GEFUEHL.driftPause || this.lenkLos > 0.3) {
          const st = this.stufe;
          this.reset();
          o.ende = 'los';
          if (st >= 2) o.turbo = st;
        }
      }
    }
    o.aktiv = this.aktiv; o.stufe = this.stufe; o.seite = this.seite;
    return o;
  }
}

// Mini-Turbo-Verlauf: Anteil Zusatz-Höchsttempo nach t Sekunden seit Auslösen
export function miniTurbo(stufe, t) {
  const g = (GEFUEHL.mtGewinn[stufe] || 0) * GEFUEHL.drift;
  if (t < GEFUEHL.mtAktiv) return g;
  return g * Math.pow(0.5, (t - GEFUEHL.mtAktiv) / GEFUEHL.mtHalb);
}

// --- Start-Boost: Tipp-Zeitpunkt relativ zu Grün (s, negativ = vorher) → 'boost' | 'stotterer' | null
export function startWertung(tippRelativ, dauergasVorGruen) {
  if (dauergasVorGruen > GEFUEHL.ueberdrehen) return 'stotterer';
  if (tippRelativ != null && Math.abs(tippRelativ) <= GEFUEHL.startfenster / 2) return 'boost';
  return null;
}

// --- Neustart-Rhythmus: Liste der Gas-Tipp-Zeiten → erfüllt? (5 Tipper, je Abstand im Takt-Fenster)
export function neustartErfuellt(tipps) {
  const n = GEFUEHL.neustartTipps, [lo, hi] = GEFUEHL.neustartTakt;
  if (!GEFUEHL.neustart || tipps.length < n) return false;
  for (let k = tipps.length - n + 1; k < tipps.length; k++) {
    const d = tipps[k] - tipps[k - 1];
    if (d < lo || d > hi) return false;
  }
  return true;
}
