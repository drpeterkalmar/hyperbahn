// Strecke „Riff-Röhre“ (P2) – die Technik-Strecke: gläserne Röhren durch ein Korallenriff unter Wasser, Lichtstrahlen von
// oben, Fischschwärme. Charakter: verschlungene Röhren mit Korkenziehern (einfach und doppelt), Röhren-Schlange, lange
// Magnet-Überkopf-Röhre, Gabelung auf dem Riffplateau (innen eng, ohne Bande, mit Pads = schneller und riskanter; außen
// breit und sicher) und ein Riesensprung über den Riffgraben.
// Grundriss gegen den Uhrzeigersinn, Start nach Norden. Schließ-Parameter: node tools/strecke_schliessen.mjs riff
import { baueBahn, kette } from './bahn.js';

// a = Zielanlauf, b = Ostgerade, c = Gier der Zielkurve, d = Steigung der Riffkante (Höhe)
export const SCHLUSS = { a: 375.49, b: 475.03, c: 90.000, d: 8.044 };
export const SCHLUSS_SCHRITT = [100, 100, 4, 1.5];
export const schlussOk = (s) => s.a >= 80 && s.b >= 150 && s.d >= -12 && s.d <= 12;
export const START = { p: { x: 0, y: 70, z: 0 }, vor: { x: 0, y: 0, z: -1 }, links: { x: -1, y: 0, z: 0 } };

export function abschnitte(sch = SCHLUSS) {
  return [
    { typ: 'gerade', name: 'Start-Ziel', len: 400, breite: 13, pads: kette(2, 200, 50, 0, 5), box: { at: 30, len: 280, u: -7.2, b: 2.8 } },
    { typ: 'kurve', name: 'Riffbogen', len: 480, gier: 70, bank: [22, 22, 0], breite: 13 },
    // Korkenzieher-Röhre: eine volle Drehung
    { typ: 'korkenzieher', name: 'Korkenzieher', len: 460, bank: [360], roehre: true, magnet: true, breite: 12 },
    // Röhren-Schlange: rechts-links in der Röhre (Querneigung zur Kurveninnenseite)
    { typ: 'kurve', name: 'Schlange rechts', len: 340, gier: -40, bank: [-28, -28, 0], roehre: true, magnet: true, breite: 12 },
    { typ: 'kurve', name: 'Schlange links', len: 340, gier: 40, bank: [28, 28, 0], roehre: true, magnet: true, breite: 12 },
    // lange Überkopf-Röhre: halbe Drehung, kopfüber, weiter auf die volle Drehung
    { typ: 'twist', name: 'Drehung', len: 260, bank: [180], roehre: true, magnet: true, breite: 12 },
    // (ohne eigene Querneigung: hält die 180° der Drehung – Stützwerte relativ zur Umdrehung würden hier um 360° springen)
    { typ: 'ueberkopf', name: 'Kopfüber-Röhre', len: 520, gier: 20, roehre: true, magnet: true, breite: 12 },
    { typ: 'twist', name: 'Weiterdrehung', len: 260, bank: [0], roehre: true, magnet: true, breite: 12 },
    { typ: 'huegel', name: 'Riffkante', len: 300, nick: sch.d, rampe: 130, breite: 13 },
    { typ: 'huegel', name: 'Riffkante Kuppe', len: 300, nick: -sch.d, rampe: 130, breite: 13 },
    { typ: 'kurve', name: 'Korallenkurve', len: 460, gier: 70, bank: [30, 30, 0], breite: 13 },
    { typ: 'gerade', name: 'Riffplateau', len: 200, breite: 19 },
    // Gabelung auf dem Riffplateau: Teiler bei u = 6 – links (innen) 12 m schmal, ohne Bande, mit Pads; rechts breit
    { typ: 'kurve', name: 'Gabelung', len: 520, gier: 60, bank: [8, 8, 0], breite: 19, offen: 'l',
      teiler: { u: 6, b: 1.2, an: 50, schnell: 1 }, pads: kette(3, 150, 90, 12.5, 4) },
    { typ: 'gerade', name: 'Riffgraben Anlauf', len: 400, breite: 14, pads: kette(4, 80, 70, 0, 8, 14) },
    { typ: 'rampe', name: 'Absprung Riff', len: 140, nick: 2, rampe: 60, absprung: true, breite: 16 },
    // Riesensprung über den Riffgraben (wie die Megastadt-Schluchten: 400 m Lücke, Landezone fast eben)
    { typ: 'sprung', name: 'Riffgraben', len: 200, nick: -14, luecke: true, rampe: 110, breite: 18,
      ringe: [{ at: 110, h: 6, r: 11 }, { at: 185, h: 10, r: 11 }] },
    { typ: 'sprung-b', name: 'Riffgraben Mitte', len: 200, nick: 11, luecke: true, rampe: 110, breite: 18,
      ringe: [{ at: 60, h: 14, r: 11 }] },
    { typ: 'landung', name: 'Landezone Riff', len: 520, nick: 1, rampe: 200, landezone: true, breite: 19 },
    { typ: 'kurve', name: 'Tiefseekurve', len: 460, gier: 50, bank: [26, 26, 0], breite: 14 },
    // Doppel-Korkenzieher: zwei volle Drehungen in der Röhre
    { typ: 'korkenzieher', name: 'Doppel-Korkenzieher', len: 1000, bank: [360, 720], roehre: true, magnet: true, breite: 12 },
    { typ: 'gerade', name: 'Ostgerade', len: sch.b, breite: 13, pads: kette(3, 120, 60, 0, 5) },
    { typ: 'kurve', name: 'Zielkurve', len: 520, gier: sch.c, bank: [24, 24, 0], breite: 13 },
    { typ: 'gerade', name: 'Zielanlauf', len: sch.a, breite: 13 },
  ];
}

export const SPRUNG_MINDEST = { 'Riffgraben': 71 };

export function baue() {
  const b = baueBahn(abschnitte(SCHLUSS), { start: START });
  b.name = 'Riff-Röhre'; b.fassung = 'riff'; b.id = 'riff';
  b.sprungMindest = SPRUNG_MINDEST;
  b.padsWeich = true; b.planRand = 5;
  return b;
}
