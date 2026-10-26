// Strecke „Orbital-Ring“ (P2) – die Show-Strecke: eine Raumstation über der Erde, schwarzer Himmel mit Sternen, die Erde
// riesig im Hintergrund. Charakter: Möbius-Band (die Bahn dreht sich langsam einmal ganz um die Fahrtrichtung),
// Wandfahrt in der Trommel (eine volle Schrauben-Windung an der Innenwand eines Zylinders, 90° Querneigung), Ring-Looping,
// schwache Schwerkraft-Zonen (Mondkuppe: leicht abheben) und ein Schwerelos-Abschnitt mit Boost-Ringen als Riesensprung.
// Grundriss gegen den Uhrzeigersinn, Start nach Norden. Schließ-Parameter: node tools/strecke_schliessen.mjs orbit
import { baueBahn, kette, schaerfe, zusatzPads } from './bahn.js';

// P3 schärfere Kurven (bahn.js schaerfe): Faktor auf den Scheitel-Radius
export const SCHARF = { 'Andockbogen': 0.65, 'Ringkurve': 0.7 };

// Schrauben-Windung (Trommel): Anstieg THETA° je Windung; Gier/Rolle so, dass die Drehachse senkrecht steht (gier² + rolle² = 360²)
const THETA = 3;
const TR = { gier: 360 * Math.cos(THETA * Math.PI / 180), roll: 360 * Math.sin(THETA * Math.PI / 180) };

// a = Zielanlauf, b = Ringstraße, c = Gier der Zielkurve, d = Gefälle der Rampe zurück auf Starthöhe (Höhe)
export const SCHLUSS = { a: 118.30, b: 650.44, c: 90.000, d: 8.694 };
export const SCHLUSS_SCHRITT = [100, 100, 4, 1.5];
export const schlussOk = (s) => s.a >= 80 && s.b >= 150 && s.d >= -14 && s.d <= 14;
export const START = { p: { x: 0, y: 200, z: 0 }, vor: { x: 0, y: 0, z: -1 }, links: { x: -1, y: 0, z: 0 } };

export function abschnitte(sch = SCHLUSS) {
  return schaerfe([
    { typ: 'gerade', name: 'Start-Ziel', len: 360, breite: 14, pads: kette(2, 200, 50, 0, 5), box: { at: 30, len: 280, u: -8.2, b: 2.8 } },
    { typ: 'kurve', name: 'Andockbogen', len: 500, gier: 90, bank: [24, 24, 0], breite: 14 },
    // Möbius-Band: eine ganze, langsame Drehung um die Fahrtrichtung (Magnet)
    { typ: 'twist', name: 'Möbius-Band', len: 700, bank: [180, 360], magnet: true, breite: 13 },
    { typ: 'gerade', name: 'Trommel-Vorfeld', len: 160, breite: 14, pads: kette(2, 30, 60, 0, 6) },
    // Wandfahrt in der Trommel: eine Schrauben-Windung (Anstieg THETA°) an der Innenwand, 90° Querneigung, Magnet
    { typ: 'huegel', name: 'Trommel-Anflug', len: 200, nick: THETA, rampe: 200, breite: 13 },
    { typ: 'wandfahrt', name: 'Trommel', len: 1300, gier: TR.gier, roll: TR.roll, rampe: 260, bank: [90, 90, 90, 0], magnet: true, breite: 13 },
    { typ: 'huegel', name: 'Trommel-Ausflug', len: 200, nick: -THETA, rampe: 200, breite: 13 },
    { typ: 'kurve', name: 'Erdkurve', len: 480, gier: 90, bank: [28, 28, 0], breite: 14 },
    // Schwerelos-Abschnitt: Riesensprung mit Boost-Ringen in schwacher Schwerkraft (lang, flach, weit)
    { typ: 'gerade', name: 'Schwerelos Anlauf', len: 380, breite: 14, pads: kette(4, 40, 70, 0, 8, 14) },
    { typ: 'rampe', name: 'Absprung Orbit', len: 140, nick: 2, rampe: 60, absprung: true, breite: 16 },
    { typ: 'sprung', name: 'Schwerelos', len: 260, nick: -6, luecke: true, rampe: 130, breite: 18, schwere: 0.3,
      ringe: [{ at: 60, h: 4, r: 11 }, { at: 140, h: 6, r: 11 }, { at: 220, h: 7, r: 11 }] },
    { typ: 'sprung-b', name: 'Schwerelos Mitte', len: 260, nick: 3, luecke: true, rampe: 130, breite: 18, schwere: 0.3,
      ringe: [{ at: 40, h: 7, r: 11 }, { at: 130, h: 7, r: 11 }, { at: 220, h: 6, r: 11 }] },
    { typ: 'landung', name: 'Landezone Dock', len: 520, nick: 1, rampe: 200, landezone: true, breite: 19 },
    { typ: 'kurve', name: 'Ringkurve', len: 480, gier: 90, bank: [30, 30, 0], breite: 14 },
    { typ: 'huegel', name: 'Rampe', len: 400, nick: -sch.d, rampe: 160, breite: 14 },
    { typ: 'huegel', name: 'Rampe Auslauf', len: 400, nick: sch.d, rampe: 160, breite: 14 },
    { typ: 'gerade', name: 'Ringstraße', len: sch.b, breite: 14, pads: kette(3, 100, 60, 0, 5) },
    { typ: 'kurve', name: 'Zielkurve', len: 520, gier: sch.c, bank: [24, 24, 0], breite: 14 },
    // Mondkuppe: schwache Schwerkraft – der Gleiter hebt über der Kuppe sanft ab
    { typ: 'huegel', name: 'Mondkuppe', len: 220, nick: 6, rampe: 100, breite: 14, schwere: 0.4 },
    { typ: 'huegel', name: 'Mondkuppe Abfahrt', len: 260, nick: -12, rampe: 140, breite: 14, schwere: 0.4 },
    { typ: 'huegel', name: 'Mondkuppe Auslauf', len: 220, nick: 6, rampe: 100, breite: 14 },
    // Ring-Looping (versetzt wie in der Megastadt, Magnet)
    { typ: 'gerade', name: 'Looping-Anlauf', len: 200, breite: 13, pads: kette(3, 60, 55, 0, 6) },
    { typ: 'looping', name: 'Ring-Looping', len: 760, nick: Math.sqrt(360 ** 2 - 34 ** 2), roll: 34, rampe: 140, magnet: true, breite: 12 },
    { typ: 'gerade', name: 'Zielanlauf', len: sch.a, breite: 14 },
  ], SCHARF);
}

export const SPRUNG_MINDEST = { 'Schwerelos': 39 };

export function baue() {
  const b = baueBahn(abschnitte(SCHLUSS), { start: START });
  b.name = 'Orbital-Ring'; b.fassung = 'orbit'; b.id = 'orbit';
  b.sprungMindest = SPRUNG_MINDEST;
  b.padsWeich = true; b.planRand = 5;
  zusatzPads(b, { abstand: 200, nachbar: 100 });   // P3: Risiko-Pads (≈ 1,5–2× so viele Pads)
  return b;
}
