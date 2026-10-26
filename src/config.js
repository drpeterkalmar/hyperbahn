// Gefühlswerte und Schalter an EINER Stelle – jeder Wert mit URL-Override (Peters Regel: A/B per Link vergleichen).
// Spektakel-Regel: Startwerte eher kräftig; Heavy-Job/Peter stimmen am Bild nach.
//
// URL-Regler (alle optional):
//   ?speed=1.2     Höchsttempo-Faktor auf die Grundgeschwindigkeit (P3: 1 = 105 m/s echt ≈ 720 km/h Anzeige; bis 0.1.17 95 m/s)
//   ?tempo=alt     Grundtempo und Lenkung wie bis 0.1.17 (95 m/s, Querbeschleunigung 44 m/s², Seitenhaftung 5,5)
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

// P3 (Peter 26.10.: „von Natur aus etwas schneller und schärfere Kurven, ich verwende die Airbrakes nie“): Grundtempo
// 95 → 105 m/s (+10,5 %, Schub und Beschleunigungs-Bänder wachsen mit, gleiche Zeit bis Höchsttempo), Lenkung direkter
// (Querbeschleunigung 44 → 60 m/s², Seitenhaftung 5,5 → 7, Gier-Aufbau 3,5 → 4,5 rad/s²) – enge Kurven ohne Luftbremse.
// TEMPO.alt = Werte bis 0.1.17 (?tempo=alt)
export const TEMPO = { basis: 105, querMax: 60, grip: 7, gierBeschl: 4.5, alt: { basis: 95, querMax: 44, grip: 5.5, gierBeschl: 3.5 } };

export const GLEITER = {
  vmax: 105,         // m/s Höchsttempo bei Vollgas ohne Boost (= TEMPO.basis × ?speed=)
  basis: 105,        // m/s Grundtempo ohne ?speed= (Schub und Bänder sind darauf skaliert)
  schub: 26 * 105 / 95, // m/s² Luftwiderstand bei Höchsttempo (quadratisch; bis 0.1.17 26 bei 95 m/s)
  hoehe: 1.2,        // m Schwebehöhe (Ruhelage der Federn)
  reichweite: 4.5,   // m Reichweite der Schwebe-Raycasts (darüber = in der Luft)
  omega: 18,         // rad/s Eigenfrequenz der Schwebe-Federn (+ progressiver Anteil: hält ~15 g im Looping)
  zeta: 0.75,        // Dämpfungsgrad
  minHoehe: 0.3,     // m darunter: harter Aufsetzer (Funken, Tempoverlust)
  gierMax: 1.9,      // rad/s größte Gierrate (Lenken) bei niedrigem Tempo
  querMax: 60,       // m/s² größte Querbeschleunigung aus Lenken (≈ 6 g; bis 0.1.17 44)
  grip: 7,           // 1/s Seitenhaftung (wie schnell Querrutschen abgebaut wird; bis 0.1.17 5,5)
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
  ring: 0.45,        // Boost-Ring in der Luft (P3: 0,35 → 0,45)
  rolle: 0.4,        // Barrel-Roll im Sprung = Turbo
};

// Windschatten (P3, Peter 26.10.: „mehr Boost und Windschatten-Ansaugen“): hinter einem Gleiter (Kegel ±`quer` m quer,
// `min`…`max` m dahinter) baut sich der Sog in `aufbau` s auf (Abbau `abbau` s): Höchsttempo +`staerke` × Sog, nah voll, am
// Kegelende ×`fern`. Nach ≥ `lade` s Sog gibt seitliches Ausscheren einen Schleuder-Boost (+`schleuder` für `schleuderDauer` s).
// ?sog=0 aus, ?sog=0.15 Stärke
export const SOG = { staerke: 0.12, quer: 4, min: 5, max: 40, aufbau: 1.0, abbau: 0.5, fern: 0.5, lade: 1.5, gnade: 0.3,
  schleuder: 0.25, schleuderDauer: 0.9 };

// KI-Streuung (P3): jede KI bekommt aus ihrem Seed eine eigene „Handschrift“ – Höchsttempo ±`top`, Kurventempo ±`kurve`,
// Linien-/Fehler-Faktoren, Form-Welle (±`form` Höchsttempo, Periode 25–55 s), Lust auf Windschatten und Risiko-Pads.
// ?streuung=0 = alle gleich wie bis 0.1.17, ?streuung=1.5 stärker
export const KI = { streu: 1, top: 0.035, kurve: 0.035, form: 0.025 };

// Strecken (P3, Peter 26.10.: „schärfere Kurven“ + „mehr Boost“): 2–3 Kurven je Strecke enger (gleiche Ein-/Ausfahrt-Linien,
// kleinerer Radius im Scheitel, ?kurven=alt = bisherige Bögen) und zusätzliche Risiko-Pads auf ruhigen Stücken, im Wechsel
// links/rechts/Mitte abseits der Ideallinie (?pads=0 = nur die bisherigen Pads)
export const STRECKE = { scharf: 1, pads: 1 };

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
  slowmo: 0,         // Zeitlupe-Akzent beim Absprung (0 = aus, ?slowmo=1). 26.10.2026 Peter: in der Luft störend → aus (war 1)
  slowmoDauer: 0.3,  // s
  slowmoTempo: 0.35, // Zeitfaktor im Akzent
};

export const ACTION = {
  stufe: 1,          // 0 Aus, 1 Selten, 2 Oft (?action=)
  // 26.10.2026 Peter: „Actionslomo in der Luft eher störend, nur im Ziel“ → nur die Zieldurchfahrt (jeder Platz) löst einen
  // Moment aus; ?momente=alle = alle Arten wie bis 0.1.16 (Sprung-Scheitel, Überholen, Beinahe, Ringe, Magnet, Treffer)
  nurZiel: 1,
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
  gier: { an: 1, beschl: 4.5, gegen: 2, max: 1.75 },   // beschl bis 0.1.17 3,5 (P3: direkter einlenken)
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
  // P3 (Peter 26.10.: „Das mit der Energie ist doof“): standardmäßig AUS (?energie=1 = wie bis 0.1.17) – kein Balken, kein
  // manueller Boost, keine Boxengasse, kein Notlauf; Boost wird verdient (Pads, Windschatten, Flug-Boost, Mini-Turbo, Start).
  // Die Barrel-Roll bleibt 1× je Sprung mit Turbo bei der Landung, kostet aber nichts.
  energie: { an: 0, kosten: 0.12, gewinn: 0.35, dauer: 1.6, rest: 0.01, abRunde: 2, box: 0.35, notlauf: 0.7, warnung: 0.25,
    rolle: 0.10, rolleMin: 0.15, rolleGewinn: 0.30, rolleDauer: 1.2 },
  // Boost-Reserve + Ketten-Deckel (?reserve=4 s, 0 = bisher): Pads addieren Zeit (höchstens `max` s); jedes weitere Pad
  // in derselben Reserve hebt die Stufe um `kette` (Pad +50 % → +60 % → +70 % → Deckel +80 %); solange Reserve läuft,
  // zieht der Antrieb ×`beschl`
  // P3: Kette spürbarer – je Pad +15 % statt +10 % (+50 → +65 → Deckel +80 %)
  reserve: { an: 1, max: 4, kette: 0.15, beschl: 2 },
  // Flugzeit-Boost (?flugboost=0 aus): saubere Landung (Nase ≤ `sauber`° zur Fahrfläche) nach Flugzeit ≥ Schwelle gibt
  // Reserve und Stufe: [Flugzeit s, Reserve s, +Höchsttempo]; HUD-Flugmesser bleibt `messer` s nach der Landung stehen.
  // Stufe 3: Datenblatt-Startwert 2,0 s Reserve gab 0,65–0,80 s Zeitgewinn je Riesensprung (Ziel 0,4–0,7) → 1,5 s
  flug: { an: 1, sauber: 12, messer: 1.5, stufen: [[0.8, 1.0, 0.15], [1.6, 1.5, 0.20], [3.0, 1.5, 0.25]] },
  // Start (?startgrad=0, ?startband=0 = bisher): abgestufter Start-Boost – Tipp am Idealpunkt `ideal` s vor Grün = 100 %,
  // linear bis `rand` am Fensterrand (±`fenster` s), außerhalb nichts; Drehzahl-Band (analoger Gas-Abzug am Gamepad): bei Grün
  // zwischen `lo` und `hi` = voller Start-Boost (1 Pad), darüber Stotterer `stotterer` s
  start: { grad: 1, ideal: -0.25, fenster: 0.2, rand: 0.3, band: 1, lo: 0.85, hi: 0.90, stotterer: 0.8 },
  // KI-Revanche (?revanche=0 aus): eine KI „Mittel“/„Profi“, die gerade vom Menschen überholt wurde (Abstand < `naehe` m),
  // fährt `dauer` s mit +`deckel` Höchsttempo und Beschleunigung ×`beschl` – nur offline. Datenblatt-Startwert ×1,5 gab
  // 55 % Zurück-Überholquote (Ziel 25–40 %) → Messung entscheidet: nur +8 % Höchsttempo (28 %)
  revanche: { an: 1, dauer: 3, deckel: 0.08, beschl: 1.0, naehe: 40 },
  // Seitwärts-Schub (?strafe=0 aus): Gamepad rechter Stick seitlich, Tastatur Y/X (QWERTZ; QWERTY Z/X) – Quertempo bis `max`
  // m/s, aufgebaut mit `beschl` m/s², kostet kein Tempo (Touch: die Luftbremsen übernehmen)
  strafe: { an: 1, beschl: 6, max: 8 },
  // G-Vignette (?gvignette=0 aus): Neon-Noir-Vignette (magenta → schwarz) ab `ab` g, voll bei `voll` g, höchstens `max`
  // Deckkraft; rein optisch, aus mit „Blitze reduzieren“
  gvignette: { an: 1, ab: 3, voll: 7, max: 0.35 },
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
  const T = q.get('tempo') === 'alt' ? TEMPO.alt : TEMPO;
  GLEITER.basis = T.basis; GLEITER.vmax = T.basis * zahl('speed', 1);
  GLEITER.schub = 26 * T.basis / 95; GLEITER.querMax = T.querMax; GLEITER.grip = T.grip; VORLAGE.gier.beschl = T.gierBeschl;
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
  V.energie.an = q.get('energie') === '1' ? 1 : 0;
  V.energie.kosten = zahl('boostkosten', 12) / 100;
  V.energie.box = zahl('box', 35) / 100;
  V.energie.rolle = zahl('rollkosten', 10) / 100;
  V.reserve.max = zahl('reserve', 4); V.reserve.an = V.reserve.max > 0 ? 1 : 0;
  V.flug.an = q.get('flugboost') === '0' ? 0 : 1;
  V.start.grad = q.get('startgrad') === '0' ? 0 : 1;
  V.start.band = q.get('startband') === '0' ? 0 : 1;
  V.revanche.an = q.get('revanche') === '0' ? 0 : 1;
  V.strafe.an = q.get('strafe') === '0' ? 0 : 1;
  V.gvignette.an = q.get('gvignette') === '0' ? 0 : 1;
  SOG.staerke = zahl('sog', 0.12);
  STRECKE.scharf = q.get('kurven') === 'alt' ? 0 : 1;
  STRECKE.pads = q.get('pads') === '0' ? 0 : 1;
  KI.streu = zahl('streuung', 1);
  ZEIT.slowmo = zahl('slowmo', ZEIT.slowmo);
  ACTION.stufe = Math.max(0, Math.min(2, Math.round(zahl('action', ACTION.stufe))));
  if (q.get('momente') === 'alle') ACTION.nurZiel = 0;
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
