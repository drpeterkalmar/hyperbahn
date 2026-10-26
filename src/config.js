// Gefühlswerte und Schalter an EINER Stelle – jeder Wert mit URL-Override (Peters Regel: A/B per Link vergleichen).
// Spektakel-Regel: Startwerte eher kräftig; Heavy-Job/Peter stimmen am Bild nach.
//
// URL-Regler (alle optional):
//   ?speed=1.2     Höchsttempo-Faktor (1 = Standard, 95 m/s echt ≈ 650 km/h Anzeige)
//   ?mag=1.8       Magnetkraft in g (Magnet-Abschnitte, tempounabhängig)
//   ?boost=0.5     Schub je Boost-Pad (Anteil Höchsttempo, stapelbar bis BOOST.deckel)
//   ?air=0.55      Schwerkraft in der Luft (Faktor auf g; Alias ?sprung=)
//   ?slowmo=0      Zeitlupe-Akzent beim Absprung aus (offline)
//   ?action=0|1|2  Action-Momente Aus/Selten/Oft (Standard 1 = Selten)
//   ?blitze=0      „⚡ Blitze reduzieren“ an (≤ 3 Blitze/s, gedämpfte Strobos); Standard = volle Show
//   ?horizont=1    Kamera „Horizont halten“ (gegen Übelkeit am Handy)
//   ?hilfe=leicht|mittel|profi   Fahrhilfe-Stufe
//   ?gegner=7      Anzahl KI-Gegner (0–7), ?ki=leicht|mittel|profi Stärke
//   ?runden=2      Runden je Rennen (Standard: aus der Strecken-Fassung, Rennen ≤ 5 min)
//   ?strecke=lang  lange Fassung der Megastadt (bis 0.1.3; Standard = Kurzfassung)
//   ?nase=alt      Nase in der Luft wie bis 0.1.3 (↑ senkt immer die Nase, keine Hülle/Landehilfe)
//   ?online=1      nur zum Testen: Zeit-Logik wie online (Schein-Zeitlupe, timeScale bleibt 1)
//   ?look=0|1|2, ?kl=-bloom  Kino-Look-Stufe / Einzelstufen (aus kinolook.js)

export const G = 9.81;

// Anzeige-Tempo: echte m/s × Faktor = „gefühlte“ km/h im HUD (Bahn und Physik bleiben in echten Metern)
export const ANZEIGE = { faktor: 1.9 };

export const GLEITER = {
  vmax: 95,          // m/s Höchsttempo bei Vollgas ohne Boost
  schub: 26,         // m/s² Beschleunigung aus dem Stand (fällt quadratisch zum Höchsttempo ab)
  hoehe: 1.2,        // m Schwebehöhe (Ruhelage der Federn)
  reichweite: 4.5,   // m Reichweite der Schwebe-Raycasts (darüber = in der Luft)
  omega: 18,         // rad/s Eigenfrequenz der Schwebe-Federn (+ progressiver Anteil: hält ~15 g im Looping)
  zeta: 0.75,        // Dämpfungsgrad
  minHoehe: 0.3,     // m darunter: harter Aufsetzer (Funken, Tempoverlust)
  gierMax: 1.9,      // rad/s größte Gierrate (Lenken) bei niedrigem Tempo
  querMax: 44,       // m/s² größte Querbeschleunigung aus Lenken (≈ 4,5 g)
  grip: 5.5,         // 1/s Seitenhaftung (wie schnell Querrutschen abgebaut wird)
  luftbremseGier: 0.75, // + Anteil Gierrate mit voller Luftbremse auf der Kurveninnenseite
  luftbremseZug: 9,  // m/s² Bremswirkung je voll gezogener Luftbremse
  luftSchub: 0.6,    // Anteil Schub in der Luft
  luftNase: 1.1,     // rad/s Nicken in der Luft (Nase heben/senken)
  luftAuftrieb: 0.05, // m/s² Auftrieb je (m/s · rad) Anstellwinkel: Nase hoch = flacher und weiter
  luftGier: 0.35,    // Anteil Gierrate in der Luft (leichtes Lenken)
  rolleDauer: 0.55,  // s für eine Barrel-Roll (360°) im Sprung
  breite: 2.6,       // m Gleiter-Breite (Wandabstand)
  laenge: 4.2,       // m
};

export const MAGNET = {
  g: 1.8,            // Magnetkraft in g (?mag=) – zieht entlang −Bahn-Normale, unabhängig vom Tempo
  rampe: 0.3,        // s Übergang Schwerkraft ↔ Magnet
  reichweite: 9,     // m darüber wirkt der Magnet nicht mehr (Abflug über die Kante bleibt möglich)
};

export const BOOST = {
  gewinn: 0.5,       // +50 % Höchsttempo und Schub je Pad (?boost=)
  dauer: 1.3,        // s je Pad (Datenblatt Fahrgefühl: 1,3 s, dann Abklingen)
  abklingen: 0.3,    // s Abklingen nach der vollen Dauer
  deckel: 0.8,       // höchstens +80 % gestapelt (Kette = immer schneller, gedeckelt)
  ring: 0.35,        // Boost-Ring in der Luft
  rolle: 0.4,        // Barrel-Roll im Sprung = Turbo
};

export const LUFT = {
  faktor: 0.55,      // Schwerkraft-Faktor in der Luft (?air= / ?sprung=): Gleiter fliegt flach und weit
};

// Nase in der Luft (P1b, Peter 20.10.: „kein Abschmieren in der Luft, wenn ich Pfeil hinauf halte“). ?nase=alt = bis 0.1.3:
// ↑ senkt in der Luft immer die Nase, keine Hülle, keine Landehilfe.
//  • ↑ über den Absprung gehalten = reines Gas, verstellt die Nase nie; Nase senken erst nach NEUEM Druck in der Luft (bzw. ↓
//    = heben). Gamepad-Stick genauso (vorn gehalten über den Absprung zählt erst nach Loslassen).
//  • Hülle: Nase höchstens `unten`° unter / `oben`° über der Flugbahn (weich, Rückstell-Rate `rate` je rad); über einer
//    Sprung-Lücke kein Senken mehr, sobald die Wurfparabel die Landezone nicht mit `reserve` m Höhe erreicht; ab `decke` m
//    über der Bahn kein Heben mehr
//  • Landehilfe: ab `landeZeit` s vor dem Aufsetzen Nase zur Fahrfläche (+`landeZiel`°), ab `landeVoll` s ganz
export const NASE = { modus: 'neu', unten: 12, oben: 25, rate: 4, reserve: 4, decke: [30, 50], landeZeit: 0.9, landeVoll: 0.35, landeRate: 5, landeZiel: 2 };

export const WAND = {
  verlust: 0.12,     // Tempoverlust-Anteil bei frontalem Einschlag (skaliert mit Aufprallwinkel)
  schild: 0.06,      // Schild-Abzug bei frontalem Einschlag bei Höchsttempo (Schild 0…1)
  abprall: 0.35,     // Rückprall der Quergeschwindigkeit
  hoehe: 3.2,        // m Höhe der Bahn-Begrenzung (darüber fliegt man hinweg)
};

export const ZEIT = {
  schritt: 1 / 240,  // s fester Physik-Schritt (Sim-Uhr, netztauglich, kein Durchrutschen bei 800 km/h)
  maxSchritte: 24,   // je Bild höchstens (Spirale des Todes vermeiden)
  slowmo: 1,         // Zeitlupe-Akzent beim Absprung (0 = aus, ?slowmo=)
  slowmoDauer: 0.3,  // s
  slowmoTempo: 0.35, // Zeitfaktor im Akzent
};

export const ACTION = {
  stufe: 1,          // 0 Aus, 1 Selten, 2 Oft (?action=)
  abkuehl: [Infinity, 14, 8],  // s Mindestabstand je Stufe (≥ 8 s)
  schwelle: [Infinity, 0.62, 0.42], // Spektakel-Wertung, ab der ein Moment ausgelöst werden darf
  liveMax: 1.2,      // s Live-Moment (Speed-Ramp/Zoom-Punch) gesamt
  bulletMax: 1.5,    // s Bullet-Time
  bulletTempo: 0.04, // ≤ 0,05× Zeit fast eingefroren
};

// Vorlagen-Mechaniken (P1b, Datenblatt ~/.hermes/plans/vorlagen/hyperbahn.md, Abschnitt 3) – alle Werte in EINER Gruppe,
// jede Mechanik mit eigenem URL-Regler; 0 bzw. „alt“ = Verhalten bis 0.1.4.
export const VORLAGE = {
  // 1/h-Schwebe-Feder (?schwebe=0 alt): Kraft je Punkt ∝ (soll/h − 1) – weich oben, sehr hart nah am Boden; Ruhelage ergibt
  // sich aus Gewicht und soll (1,3 m → ≈ 1,2 m); unter `min` m wird nicht weiter gerechnet (harter Aufsetzer)
  schwebe: { an: 1, soll: 1.3, min: 0.25, zeta: 0.9 },
  // Luftbremse (?bremse=0 alt, ?rutsch=s): Wirkung baut sich in `aufbau` s auf; Widerstand so, dass Dauer-Halten (ohne Drift)
  // das Tempo auf ≈ 80 % (eine) bzw. 45 % (beide) senkt; ohne Drift gleitet der Gleiter mit Bremse (Ausricht-Zeit `rutsch` s
  // statt der Seitenhaftung), Drift behält seine eigenen Werte (fahrgefuehl.js)
  // Drift-Seitenhaftung 0,45 → 0,5: Schiebewinkel im Bremsen-Drift max. ≈ 25° (Ziel 15–25°, vorher 33°), Mini-Turbo-Gewinn bleibt
  bremse: { an: 1, aufbau: 0.2, zug: 18, zugBeide: 40, rutsch: 1.2, driftGrip: 0.5 },
  // Gegenlenken (?lenk=alt): Gier-Beschleunigung höchstens `beschl` rad/s², gegen die Drehung ×`gegen`, Gierrate ≤ `max` rad/s
  gier: { an: 1, beschl: 3.5, gegen: 2, max: 1.75 },
  // Wandtreffer (?wand=0 alt): Energie ∝ Quertempo (Anteil je m/s, mind. `min`), Tempo −`v0`…−`v1` je Aufprallwinkel
  // (`w0`…`w1`°), Nachstöße desselben Einschlags (innerhalb `sperre` s) kosten nichts; die Nase gleitet ab (parallel zur Wand
  // + `weg`°). Datenblatt-Startwert 0,6 %/(m/s)
  // widerspricht seiner eigenen Ziel-Messgröße (30° bei Top = 4–8 %) → Messung entscheidet: 0,13 %/(m/s)
  wand: { an: 1, energie: 0.0013, min: 0.01, v0: 0.10, v1: 0.30, w0: 5, w1: 60, sperre: 0.4, weg: 3 },
  // Bergung nach Abflug (?bergung=s, 0 = alt 1,6 s / 45 %): Drohne holt den Gleiter in `zeit` s, nach einem Sprung hinter der
  // Lücke abgesetzt mit `tempo` × Höchsttempo
  bergung: { zeit: 1.5, tempo: 0.4 },
  // Landungs-Nicken (?nicken=0 aus): Landung mit Nase > `grad`° gegen die Fahrfläche kostet `verlust` Tempo + Funken
  nicken: { an: 1, grad: 20, verlust: 0.15 },
  // Energie = Schild = Boost (?energie=0 aus, ?boostkosten=12, ?box=35, ?rollkosten=10): ein Balken 0…1; manueller Boost
  // (Leertaste/ROLLE-Taste am Boden, Gamepad A/X) ab Runde `abRunde` (1-Runden-Rennen: ab der Hälfte) kostet `kosten`, gibt
  // +`gewinn` Höchsttempo für `dauer` s, nie unter `rest`; Boxengasse lädt `box` je s; leer = Notlauf (Höchsttempo ×`notlauf`);
  // unter `warnung` rot + Warnton; Barrel-Roll kostet `rolle`, nur ab `rolleMin` Rest, 1× je Sprung, Turbo +`rolleGewinn` für
  // `rolleDauer` s erst nach der Landung
  energie: { an: 1, kosten: 0.12, gewinn: 0.35, dauer: 1.6, rest: 0.01, abRunde: 2, box: 0.35, notlauf: 0.7, warnung: 0.25,
    rolle: 0.10, rolleMin: 0.15, rolleGewinn: 0.30, rolleDauer: 1.2 },
};

export const BLITZE = { reduziert: false, maxProSek: 3, strobeDaempfung: 0.35 };
// unschaerfe: Tempo (m/s) → Kino-Look-Bewegungsunschärfe (P1-Abnahme: 0,4 verschmierte Sprünge/Boost zu stark) – ?blur=
export const KAMERA = { horizontHalten: false, rollFolge: 0.85, rollTraeg: 0.18, unschaerfe: 0.3 };
// runden: 0 = aus der Strecken-Fassung (rundenDerFassung), ?runden= überschreibt; strecke: 'kurz' | 'lang' (?strecke=)
export const SPIEL = { hilfe: 'leicht', gegner: 7, ki: 'mittel', runden: 0, strecke: 'kurz', online: false };

// URL-Overrides anwenden (Browser: location.search; Node-Tests können eigene Strings übergeben)
export function leseRegler(search) {
  const q = new URLSearchParams(search || '');
  const zahl = (k, d) => {
    if (!q.has(k)) return d;
    const v = parseFloat(q.get(k));
    return Number.isFinite(v) ? v : d;
  };
  GLEITER.vmax = 95 * zahl('speed', 1);
  MAGNET.g = zahl('mag', MAGNET.g);
  BOOST.gewinn = zahl('boost', BOOST.gewinn);
  LUFT.faktor = zahl('air', zahl('sprung', LUFT.faktor));
  NASE.modus = q.get('nase') === 'alt' ? 'alt' : 'neu';
  // Vorlagen-Regler (P1b)
  const V = VORLAGE;
  V.schwebe.an = q.get('schwebe') === '0' ? 0 : 1;
  V.bremse.an = q.get('bremse') === '0' ? 0 : 1;
  V.bremse.rutsch = zahl('rutsch', 1.2);
  V.gier.an = q.get('lenk') === 'alt' ? 0 : 1;
  V.wand.an = q.get('wand') === '0' ? 0 : 1;
  V.bergung.zeit = zahl('bergung', 1.5);
  V.nicken.an = q.get('nicken') === '0' ? 0 : 1;
  V.energie.an = q.get('energie') === '0' ? 0 : 1;
  V.energie.kosten = zahl('boostkosten', 12) / 100;
  V.energie.box = zahl('box', 35) / 100;
  V.energie.rolle = zahl('rollkosten', 10) / 100;
  ZEIT.slowmo = zahl('slowmo', ZEIT.slowmo);
  ACTION.stufe = Math.max(0, Math.min(2, Math.round(zahl('action', ACTION.stufe))));
  BLITZE.reduziert = q.get('blitze') === '0' || q.get('blitze') === 'reduziert';
  KAMERA.horizontHalten = q.get('horizont') === '1';
  KAMERA.unschaerfe = zahl('blur', KAMERA.unschaerfe);
  ANZEIGE.faktor = zahl('tacho', ANZEIGE.faktor);
  if (['leicht', 'mittel', 'profi'].includes(q.get('hilfe'))) SPIEL.hilfe = q.get('hilfe');
  if (['leicht', 'mittel', 'profi'].includes(q.get('ki'))) SPIEL.ki = q.get('ki');
  SPIEL.gegner = Math.max(0, Math.min(7, Math.round(zahl('gegner', SPIEL.gegner))));
  SPIEL.runden = q.has('runden') ? Math.max(1, Math.min(99, Math.round(zahl('runden', 2)))) : 0;
  SPIEL.strecke = q.get('strecke') === 'lang' ? 'lang' : 'kurz';
  SPIEL.online = q.get('online') === '1';
  return q;
}
