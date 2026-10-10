// Item-Verteilung nach Platz (Phase 2 – in P1 nur Tabelle + Ziehung, keine Waffen).
// Mechanik nach dem Clean-Room-Datenblatt (Abschnitt 4): Die Ziehung hängt NUR vom Platz ab (Catch-up: hinten die starken
// Items), deterministisch über den Renn-Seed → online sehen alle dasselbe. Eigene, neutrale Item-Arten.
// Tabellen: Prozent je Platz 1…8, jede Spalte = 100. ?items=hb (Hyperbahn, Standard) | ?items=ref (Referenz-Mechanik,
// gruppiert in neutrale Arten – nur zum Vergleich/Abgleich).
import { rng } from '../core/util.js';

export const ITEM_ARTEN = {
  boostZelle: 'Boost-Zelle', dreifachZelle: 'Dreifach-Zelle', ueberladung: 'Überladung', mine: 'Mine',
  schildLadung: 'Schild-Ladung', pulsSchuss: 'Puls-Schuss', lenkrakete: 'Lenkrakete', spitzenjaeger: 'Spitzenjäger',
  empWelle: 'EMP-Welle', phasenTurbo: 'Phasen-Turbo',
};

// Hyperbahn-Tabelle (Datenblatt 4b)
export const ITEMS_HB = {
  boostZelle: [10, 10, 5, 5, 5, 0, 0, 0],
  dreifachZelle: [0, 15, 20, 20, 20, 20, 20, 20],
  ueberladung: [0, 5, 10, 10, 10, 10, 10, 10],
  mine: [35, 5, 0, 0, 0, 0, 0, 0],
  schildLadung: [15, 10, 5, 0, 0, 0, 0, 0],
  pulsSchuss: [35, 15, 10, 5, 0, 0, 0, 0],
  lenkrakete: [5, 30, 35, 35, 35, 30, 15, 10],
  spitzenjaeger: [0, 0, 0, 5, 5, 5, 10, 10],
  empWelle: [0, 5, 5, 5, 10, 15, 15, 20],
  phasenTurbo: [0, 5, 10, 15, 15, 20, 30, 30],
};

// Referenz-Mechanik (Datenblatt 4a), auf dieselben neutralen Arten abgebildet:
// Boost 1×/3× → Boost-/Dreifach-Zelle, beliebig viele Stöße → Überladung, Bodenfalle → Mine, Attrappe/Tarnung → Schild-Ladung,
// Gerade-Geschoss → Puls-Schuss, Lenk-Geschoss → Lenkrakete, Spitzenjäger, Feld-Puls → EMP-Welle, Unverwundbar → Phasen-Turbo
export const ITEMS_REF = {
  boostZelle: [10, 5, 5, 5, 5, 0, 0, 0],
  dreifachZelle: [0, 20, 20, 20, 20, 20, 20, 20],
  ueberladung: [0, 5, 10, 10, 10, 10, 10, 10],
  mine: [35, 5, 0, 0, 0, 0, 0, 0],
  schildLadung: [15, 10, 0, 0, 0, 0, 0, 0],
  pulsSchuss: [35, 15, 10, 0, 0, 0, 0, 0],
  lenkrakete: [5, 30, 40, 35, 35, 25, 10, 5],
  spitzenjaeger: [0, 0, 0, 5, 5, 10, 10, 15],
  empWelle: [0, 5, 5, 10, 10, 15, 20, 20],
  phasenTurbo: [0, 5, 10, 15, 15, 20, 30, 30],
};

export function tabelle(name = 'hb') { return name === 'hb' ? ITEMS_HB : ITEMS_REF; }

// Spaltensummen (müssen je Platz 100 ergeben)
export function spaltenSummen(tab) {
  const s = new Array(8).fill(0);
  for (const zeile of Object.values(tab)) zeile.forEach((p, i) => { s[i] += p; });
  return s;
}

// Ein Item für Platz (1…8; bei weniger Fahrern wird der Platz auf 1…8 gestreckt) ziehen; zufall() liefert [0, 1)
export function ziehe(platz, zufall, tab = ITEMS_HB, fahrer = 8) {
  const spalte = Math.max(0, Math.min(7, fahrer > 1 ? Math.round((platz - 1) * 7 / (fahrer - 1)) : 0));
  let x = zufall() * 100;
  for (const [art, zeile] of Object.entries(tab)) {
    x -= zeile[spalte];
    if (x < 0) return art;
  }
  return Object.keys(tab).find((a) => tab[a][spalte] > 0);
}

// Item-Box-Ziehungen eines Rennens: deterministisch aus Renn-Seed + Fahrer + laufender Nummer
export function itemZufall(rennSeed, fahrer, nummer) { return rng((rennSeed * 2654435761 + fahrer * 40503 + nummer * 977) >>> 0); }
