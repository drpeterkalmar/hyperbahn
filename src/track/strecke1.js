// Strecke 1 „Neon-Megastadt“ (handgebaut als Daten). Hochbahn zwischen Wolkenkratzern, nachts, Regen.
// Pflicht-Passagen (Peter 08.10.): großer Looping, Korkenzieher-Röhre, lange Überkopf-Passage, Wandfahrt an einer
// Hochhausfassade, Möbius-Twist (180° und zurück), zwei Riesensprünge (Häuserschlucht + Neon-Schlucht mit Hafen), Steilkurven,
// Tunnel, Boost-Pad-Ketten (vor jedem Sprung), Boost-Ringe in der Luft. Alle Überkopf-/Wand-Passagen tragen `magnet: true`.
//
// Grundriss: Rechteck gegen den Uhrzeigersinn (vier Linkskurven à ~90°), Start nach Norden (−z).
//   Nordseite: Start-Ziel, S-Kurve, Looping, Korkenzieher-Röhre, Sprung 1 (Häuserschlucht)
//   Westseite: Wandfahrt an der Fassade, Überkopf unter der Brücke
//   Südseite:  Möbius-Twist, Tunnel, Aufstieg auf die Hochstraße, Sprung 2 (Neon-Schlucht/Hafen)
//   Ostseite:  Schikane, Große Steilkurve, Zielanlauf
// Die Schließ-Parameter (SCHLUSS) stimmt tools/strecke_schliessen.mjs ab (Test: test_bahn.mjs prüft den Restfehler).
import { baueBahn } from './bahn.js';

// a = Länge Hochstraße (Nord-Süd-Schluss), b = Länge Ostgerade (Ost-West-Schluss), c = Gierwinkel der letzten Kurve,
// d = Steigung Aufstieg/Kuppe (Höhen-Schluss)
export const SCHLUSS = { a: 223.24, b: 1058.88, c: 90.000, d: 13.932 };

const kette = (n, at0, abstand, u = 0, b = 4, l = 12) =>
  Array.from({ length: n }, (_, k) => ({ at: at0 + k * abstand, u, b, l }));

export function strecke1Abschnitte(sch = SCHLUSS) {
  return [
    // --- Nordseite ---
    { typ: 'gerade', name: 'Start-Ziel', len: 560, pads: kette(2, 420, 50, 0, 5) },
    { typ: 'kurve', name: 'Hochbahn-S rechts', len: 320, gier: -32, bank: [-14, -14, 0] },
    { typ: 'kurve', name: 'Hochbahn-S links', len: 320, gier: 32, bank: [14, 14, 0] },
    { typ: 'gerade', name: 'Anlauf Looping', len: 400, pads: kette(3, 160, 55, 0, 6) },
    // Großer Looping: 360° Nicken + 34° Rahmen-Rolle → Ausgang ~50 m seitlich versetzt (keine Selbstdurchdringung)
    { typ: 'looping', name: 'Großer Looping', len: 760, nick: Math.sqrt(360 ** 2 - 34 ** 2), roll: 34, rampe: 140, magnet: true, breite: 12 },
    { typ: 'gerade', name: 'Looping-Auslauf', len: 400 },
    // Korkenzieher-Röhre: Fahrfläche dreht sich einmal ganz um die Fahrtrichtung
    { typ: 'korkenzieher', name: 'Korkenzieher-Röhre', len: 520, bank: [360], roehre: true, magnet: true, breite: 11 },
    { typ: 'gerade', name: 'Häuserschlucht Anlauf', len: 420, pads: kette(4, 80, 70, 0, 8, 14) },
    { typ: 'rampe', name: 'Absprung 1', len: 140, nick: 2, rampe: 60, absprung: true, breite: 16 },
    // Sprung 1 über die Häuserschlucht: keine Fahrbahn, die Mittellinie folgt grob der Flugbahn
    // Sprung 1 über die Häuserschlucht: keine Fahrbahn; die Mittellinie fällt erst steil und flacht dann ab, damit die
    // Landezone fast eben liegt (langsame Gleiter landen vorn, schnelle weiter hinten – alle mit 4–6 s Flugzeit)
    { typ: 'sprung', name: 'Häuserschlucht', len: 200, nick: -14, luecke: true, rampe: 100, breite: 18,
      ringe: [{ at: 120, h: 6, r: 11 }] },
    { typ: 'sprung-b', name: 'Häuserschlucht Mitte', len: 200, nick: 11, luecke: true, rampe: 100, breite: 18,
      ringe: [{ at: 60, h: 14, r: 11 }] },
    { typ: 'landung', name: 'Landezone 1', len: 520, nick: 3, rampe: 200, landezone: true, breite: 19 },
    // --- Ecke 1 ---
    { typ: 'kurve', name: 'Steilkurve Turm', len: 640, gier: 90, bank: [50, 50, 0], breite: 15 },
    // --- Westseite ---
    // Wandfahrt: Bahn kippt 90° an einer Hochhausfassade entlang
    { typ: 'wandfahrt', name: 'Fassade', len: 640, bank: [90, 90, 90, 0], magnet: true, breite: 12 },
    { typ: 'gerade', name: 'Brückenanlauf', len: 200 },
    // Lange Überkopf-Passage unter der Brücke: 180° Querneigung halten, leichte Kurve kopfüber
    { typ: 'ueberkopf', name: 'Unter der Brücke', len: 1100, gier: 25, bank: [180, 180, 180, 0], magnet: true, breite: 12 },
    { typ: 'gerade', name: 'Brücke Auslauf', len: 300 },
    // --- Ecke 2 ---
    { typ: 'kurve', name: 'Neon-Bogen', len: 560, gier: 65, bank: [26, 26, 0] },
    // --- Südseite ---
    // Möbius-Twist: 180° und wieder zurück
    { typ: 'twist', name: 'Möbius-Twist', len: 460, bank: [180, 0], magnet: true, breite: 12 },
    { typ: 'tunnel', name: 'Tunnel', len: 420, roehre: true, breite: 12 },
    { typ: 'huegel', name: 'Aufstieg', len: 700, nick: sch.d, rampe: 260 },
    { typ: 'gerade', name: 'Hochstraße', len: sch.a },
    { typ: 'huegel', name: 'Kuppe', len: 700, nick: -sch.d, rampe: 260 },
    { typ: 'gerade', name: 'Hafen Anlauf', len: 380, pads: kette(4, 40, 75, 0, 8, 14) },
    { typ: 'rampe', name: 'Absprung 2', len: 140, nick: 2, rampe: 60, absprung: true, breite: 16 },
    // Sprung 2 über die Neon-Schlucht mit Fluss und Hafen
    { typ: 'sprung', name: 'Neon-Schlucht', len: 205, nick: -15, luecke: true, rampe: 100, breite: 18,
      ringe: [{ at: 110, h: 6, r: 11 }] },
    { typ: 'sprung-b', name: 'Neon-Schlucht Mitte', len: 205, nick: 12, luecke: true, rampe: 100, breite: 18,
      ringe: [{ at: 40, h: 14, r: 11 }, { at: 150, h: 20, r: 11 }] },
    { typ: 'landung', name: 'Landezone 2', len: 560, nick: 3, rampe: 220, landezone: true, breite: 19 },
    // --- Ecke 3 ---
    { typ: 'kurve', name: 'Hafenkurve', len: 700, gier: 90, bank: [28, 28, 0] },
    // --- Ostseite ---
    { typ: 'kurve', name: 'Schikane rechts', len: 300, gier: -30, bank: [-16, -16, 0] },
    { typ: 'kurve', name: 'Schikane links', len: 300, gier: 30, bank: [16, 16, 0] },
    { typ: 'gerade', name: 'Ostgerade', len: sch.b, pads: kette(3, 120, 60, -5, 4) },
    // --- Ecke 4 ---
    { typ: 'kurve', name: 'Große Steilkurve', len: 900, gier: sch.c, bank: [45, 45, 0], breite: 15 },
    { typ: 'gerade', name: 'Zielanlauf', len: 300 },
  ];
}

// Mindesttempo an der Sprungkante (m/s, Vollgas, Ringe zählen mit) – gemessen von tests/node/test_gleiter.mjs, der Test
// prüft, dass die Tabelle zur Physik passt (±4 m/s). Für die HUD-Anzeige „Speed OK“ vor dem Sprung.
export const SPRUNG_MINDEST = { 'Häuserschlucht': 77, 'Neon-Schlucht': 72 };

export function strecke1(sch = SCHLUSS) {
  const b = baueBahn(strecke1Abschnitte(sch), { start: { p: { x: 0, y: 160, z: 0 }, vor: { x: 0, y: 0, z: -1 }, links: { x: -1, y: 0, z: 0 } } });
  b.name = 'Neon-Megastadt';
  return b;
}
