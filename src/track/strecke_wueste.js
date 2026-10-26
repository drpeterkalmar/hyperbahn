// Strecke „Wüsten-Raumhafen“ (P2) – die Vollgas-Strecke: Dämmerung über einem Raumhafen in der Wüste, Sandsturm.
// Charakter: lange Geraden mit Boost-Ketten, weite schnelle Bögen (kaum bremsen), Dünenwellen mit leichtem Abheben,
// Hangar-Tunnel und ein sehr langer, flacher Riesensprung von der Startrampe über das Raketensilo.
// Grundriss gegen den Uhrzeigersinn: Start nach Norden, Dünenbogen nach Nordwest, Startbahn + Radar-Schikane, Aufstieg
// auf die Startrampe, Sprung über das Silo, Hangar-Kurve nach Süden, Hangar-Tunnel, Dünenwellen, Wüstenbogen nach Osten,
// Ostgerade, Zielkurve. Schließ-Parameter: node tools/strecke_schliessen.mjs wueste
import { baueBahn, kette, schaerfe, zusatzPads } from './bahn.js';

// P3 schärfere Kurven (bahn.js schaerfe): Faktor auf den Scheitel-Radius
export const SCHARF = { 'Wüstenbogen': 0.55, 'Wüsten-S links': 0.3, 'Wüsten-S rechts': 0.3 };

// a = Zielanlauf (Nord-Süd), b = Ostgerade (Ost-West), c = Gier der Zielkurve, d = Steigung der Ostrampe (Höhe)
export const SCHLUSS = { a: 145.95, b: 725.69, c: 90.000, d: 4.839 };
export const START = { p: { x: 0, y: 40, z: 0 }, vor: { x: 0, y: 0, z: -1 }, links: { x: -1, y: 0, z: 0 } };
export const SCHLUSS_SCHRITT = [120, 120, 4, 1.5];
export const schlussOk = (s) => s.a >= 80 && s.b >= 200 && s.d >= -14 && s.d <= 14;

export function abschnitte(sch = SCHLUSS) {
  return schaerfe([
    // --- Nordseite ---
    { typ: 'gerade', name: 'Start-Ziel', len: 520, breite: 15, pads: kette(2, 220, 50, 7, 5), box: { at: 40, len: 300, u: -9.2, b: 2.8 } },
    { typ: 'kurve', name: 'Dünenbogen', len: 620, gier: 90, bank: [18, 18, 0], breite: 15 },
    // --- Westseite: Startbahn, Aufstieg auf die Startrampe, Riesensprung über das Raketensilo ---
    { typ: 'gerade', name: 'Startbahn', len: 520, breite: 15, pads: kette(3, 200, 60, 6, 6) },
    { typ: 'huegel', name: 'Rampe Aufstieg', len: 300, nick: 8, rampe: 130, breite: 15 },
    { typ: 'huegel', name: 'Rampe Kuppe', len: 300, nick: -8, rampe: 130, breite: 15 },
    { typ: 'gerade', name: 'Silo Anlauf', len: 420, breite: 15, pads: kette(4, 150, 65, 0, 8, 14) },
    { typ: 'rampe', name: 'Absprung Silo', len: 150, nick: 3, rampe: 70, absprung: true, breite: 16 },
    // Riesensprung (500 m Lücke, 5–8 s Flug, bis ≈ 900 m weit): lang und flach – die Mittellinie folgt grob der Flugbahn, Landezone fast eben
    { typ: 'sprung', name: 'Raketensilo', len: 250, nick: -16, luecke: true, rampe: 125, breite: 19,
      ringe: [{ at: 110, h: 6, r: 11 }, { at: 220, h: 9, r: 11 }] },
    { typ: 'sprung-b', name: 'Raketensilo Mitte', len: 250, nick: 9, luecke: true, rampe: 125, breite: 19,
      ringe: [{ at: 90, h: 14, r: 11 }, { at: 200, h: 18, r: 11 }] },
    // Landezone fällt erst ab und wird flach: langsame Gleiter (95 m/s ohne Pads) landen vorn, schnelle (≈ 170 m/s) weit hinten
    { typ: 'landung', name: 'Landezone Silo', len: 600, nick: 4, rampe: 300, landezone: true, breite: 19 },
    // --- Ecke 2 + Südseite: Hangar-Tunnel, Vorfeld ---
    { typ: 'kurve', name: 'Hangar-Kurve', len: 640, gier: 90, bank: [28, 28, 0], breite: 15 },
    { typ: 'tunnel', name: 'Hangar', len: 300, roehre: true, breite: 13 },
    { typ: 'gerade', name: 'Hangar-Vorfeld', len: 440, breite: 15 },
    // --- Ecke 3 + Ostseite: Dünenwellen, weites S, lange Ostgerade mit Boost-Kette ---
    { typ: 'kurve', name: 'Wüstenbogen', len: 640, gier: 90, bank: [24, 24, 0], breite: 15 },
    // Dünenwellen: drei Kuppen, auf denen der Gleiter kurz leicht wird
    { typ: 'huegel', name: 'Düne 1', len: 210, nick: 5, rampe: 110, breite: 15 },
    { typ: 'huegel', name: 'Düne 2', len: 210, nick: -10, rampe: 110, breite: 15 },
    { typ: 'huegel', name: 'Düne 3', len: 210, nick: 5, rampe: 110, breite: 15 },
    { typ: 'kurve', name: 'Wüsten-S links', len: 320, gier: 18, bank: [10, 10, 0], breite: 15 },
    { typ: 'kurve', name: 'Wüsten-S rechts', len: 320, gier: -18, bank: [-10, -10, 0], breite: 15 },
    // Ostrampe: langer, sanfter Anstieg zurück auf Starthöhe (Höhen-Schluss d) – auf der Geraden, ohne Abheben
    { typ: 'huegel', name: 'Ostrampe', len: 400, nick: sch.d, rampe: 180, breite: 15, pads: kette(3, 190, 60, 0, 6) },
    { typ: 'huegel', name: 'Ostrampe Kuppe', len: 400, nick: -sch.d, rampe: 180, breite: 15 },
    { typ: 'gerade', name: 'Ostgerade', len: sch.b, breite: 15, pads: kette(3, 180, 60, 0, 6) },
    // --- Ecke 4 ---
    { typ: 'kurve', name: 'Zielkurve', len: 620, gier: sch.c, bank: [22, 22, 0], breite: 15 },
    { typ: 'gerade', name: 'Zielanlauf', len: sch.a, breite: 15 },
  ], SCHARF);
}

// Mindesttempo an der Sprungkante (m/s, Vollgas) – „SPEED OK“ im HUD; test_strecken.mjs prüft es gegen die Physik (±4 m/s)
export const SPRUNG_MINDEST = { 'Raketensilo': 63 };

export function baue() {
  const b = baueBahn(abschnitte(SCHLUSS), { start: START });
  b.name = 'Wüsten-Raumhafen'; b.fassung = 'wueste'; b.id = 'wueste';
  b.sprungMindest = SPRUNG_MINDEST;
  b.padsWeich = true;   // KI: Pads abseits der Linie nicht erzwingen, Plan feiner glätten (pilot.js)
  b.planRand = 5;       // KI-Linie 5 m von der Bande (Wandtreffer-Rate wie Megastadt, gemessen 0,09 statt 0,45 je Gleiter-Minute)
  zusatzPads(b, { abstand: 330 });   // P3: Risiko-Pads (≈ 1,5–2× so viele Pads)
  return b;
}
