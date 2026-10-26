// Strecke „Gewitter-Pass“ (P2) – die Sprung-Strecke: Gebirgspass bei Nacht im Gewitter (Blitze respektieren „Blitze
// reduzieren“). Charakter: viele Höhenmeter, Serpentinen-Steilkurven (Haarnadeln mit 50° Querneigung), Grat-Abkürzung
// (in der zweiten Haarnadel innen schmal und ohne Bande), Kamm ohne Bande, Talsprung, enge Schikane, Riesensprung über das
// Tal mit Landezone im Gegenhang.
// Grundriss gegen den Uhrzeigersinn, Start nach Norden. Schließ-Parameter: node tools/strecke_schliessen.mjs gebirge
import { baueBahn, kette } from './bahn.js';

// a = Zielanlauf, b = Talstraße (Ostseite), c = Gier der Zielkurve, d = Gefälle der Abfahrt (Höhe)
export const SCHLUSS = { a: 361.44, b: 350.32, c: 90.000, d: 3.305 };
export const SCHLUSS_SCHRITT = [100, 100, 4, 1.5];
export const schlussOk = (s) => s.a >= 80 && s.b >= 150 && s.d >= -12 && s.d <= 14;
export const START = { p: { x: 0, y: 60, z: 0 }, vor: { x: 0, y: 0, z: -1 }, links: { x: -1, y: 0, z: 0 } };

export function abschnitte(sch = SCHLUSS) {
  return [
    { typ: 'gerade', name: 'Start-Ziel', len: 380, breite: 14, pads: kette(2, 200, 50, 0, 5), box: { at: 30, len: 280, u: -8.2, b: 2.8 } },
    { typ: 'kurve', name: 'Passkurve', len: 380, gier: 60, bank: [24, 24, 0], breite: 14 },
    { typ: 'huegel', name: 'Anstieg', len: 360, nick: 9, rampe: 160, breite: 14, pads: kette(3, 100, 60, 0, 6) },
    { typ: 'huegel', name: 'Anstieg Kuppe', len: 240, nick: -9, rampe: 120, breite: 14 },
    // Serpentine 1: Haarnadel rechts mit 50° Querneigung
    { typ: 'kurve', name: 'Serpentine 1', len: 480, gier: -170, bank: [-50, -50, 0], breite: 15 },
    { typ: 'huegel', name: 'Kehre', len: 220, nick: 7, rampe: 120, breite: 14 },
    { typ: 'huegel', name: 'Kehre Kuppe', len: 200, nick: -7, rampe: 100, breite: 14 },
    // Serpentine 2 mit Grat-Abkürzung: Teiler bei u = 5 – innen (links) schmal, ohne Bande, zwei Pads am Eingang; außen breit
    { typ: 'kurve', name: 'Serpentine 2', len: 700, gier: 170, bank: [40, 40, 0], breite: 19, offen: 'l',
      teiler: { u: 5, b: 1.2, an: 50, schnell: 1 }, pads: kette(2, 120, 100, 12.5, 4) },
    { typ: 'gerade', name: 'Grat-Auffahrt', len: 180, breite: 14 },
    // Kamm: ohne Bande auf beiden Seiten
    { typ: 'gerade', name: 'Kamm', len: 320, breite: 13, offen: true },
    // Talsprung: kleiner Sprung über eine Scharte
    { typ: 'rampe', name: 'Absprung Scharte', len: 120, nick: 2, rampe: 50, absprung: true, breite: 15 },
    { typ: 'sprung', name: 'Scharte', len: 110, nick: -10, luecke: true, rampe: 55, breite: 16, ringe: [{ at: 70, h: 6, r: 10 }] },
    { typ: 'sprung-b', name: 'Scharte Mitte', len: 110, nick: 7, luecke: true, rampe: 55, breite: 16, ringe: [{ at: 40, h: 9, r: 10 }] },
    { typ: 'landung', name: 'Landung Scharte', len: 380, nick: 1, rampe: 150, landezone: true, breite: 17 },
    // Felskurve: weite Linkskurve um den Gipfel (zweite Seite des Passes)
    { typ: 'kurve', name: 'Felskurve', len: 540, gier: 132, bank: [40, 40, 0], breite: 15 },
    { typ: 'kurve', name: 'Schikane rechts', len: 220, gier: -32, bank: [-18, -18, 0], breite: 13 },
    { typ: 'kurve', name: 'Schikane links', len: 220, gier: 32, bank: [18, 18, 0], breite: 13 },
    { typ: 'huegel', name: 'Abfahrt', len: 260, nick: -sch.d, rampe: 120, breite: 14 },
    { typ: 'huegel', name: 'Abfahrt Auslauf', len: 260, nick: sch.d, rampe: 120, breite: 14 },
    // Riesensprung über das Tal
    { typ: 'gerade', name: 'Tal Anlauf', len: 340, breite: 14, pads: kette(4, 60, 70, 0, 8, 14) },
    { typ: 'rampe', name: 'Absprung Tal', len: 140, nick: 2, rampe: 60, absprung: true, breite: 16 },
    { typ: 'sprung', name: 'Talsprung', len: 200, nick: -14, luecke: true, rampe: 100, breite: 18,
      ringe: [{ at: 110, h: 6, r: 11 }, { at: 190, h: 11, r: 11 }] },
    { typ: 'sprung-b', name: 'Talsprung Mitte', len: 200, nick: 11, luecke: true, rampe: 100, breite: 18,
      ringe: [{ at: 60, h: 14, r: 11 }] },
    { typ: 'landung', name: 'Landezone Gegenhang', len: 520, nick: 1, rampe: 200, landezone: true, breite: 19 },
    { typ: 'kurve', name: 'Gewitterkurve', len: 440, gier: 78, bank: [34, 34, 0], breite: 15 },
    { typ: 'gerade', name: 'Talstraße', len: sch.b, breite: 14, pads: kette(3, 120, 60, 0, 5) },
    { typ: 'kurve', name: 'Zielkurve', len: 600, gier: sch.c, bank: [30, 30, 0], breite: 14 },
    { typ: 'gerade', name: 'Zielanlauf', len: sch.a, breite: 14 },
  ];
}

export const SPRUNG_MINDEST = { 'Scharte': 55, 'Talsprung': 70 };

export function baue() {
  const b = baueBahn(abschnitte(SCHLUSS), { start: START });
  b.name = 'Gewitter-Pass'; b.fassung = 'gebirge'; b.id = 'gebirge';
  b.sprungMindest = SPRUNG_MINDEST;
  b.padsWeich = true; b.planRand = 5;
  return b;
}
