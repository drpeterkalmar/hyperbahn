// Strecken-Register (P2, Peter 20.10.: „abwechslungsreichere Strecken, kürzere Rennen (max 5 min)“).
// Nur Beschreibungen + Lade-Funktionen – die Strecken-Daten (track/strecke_*.js) und Kulissen (gfx/kulisse_*.js) werden erst
// geladen, wenn sie gebraucht werden (dynamischer import). Node-Werkzeuge nehmen track/alle.js (statisch, synchron).
//
// rundenzeit = gemessene Median-Rundenzeit der KI „Mittel“ (tools/rundenzeit_mess.mjs <id>; test_strecken.mjs prüft ±6 s)
// → Rundenzahl über rundenFuer() (Rennen ≤ 5:00 inkl. Countdown).
// URL: ?strecke=<id> (auch die alten Werte kurz/lang der Megastadt), ?strecke=zufall, ?cup=1.
import { rundenFuer } from './runden.js';

export const STRECKEN = [
  { id: 'megastadt', name: 'Neon-Megastadt', charakter: 'Allrounder', farbe: '#ff2bd6', fassung: 'kurz', rundenzeit: 135.4,
    text: 'Nacht und Regen zwischen Wolkenkratzern: Looping, Korkenzieher-Röhre, Wandfahrt, zwei Riesensprünge.',
    daten: () => import('./strecke1.js'), kulisse: () => import('../gfx/kulisse_megastadt.js') },
  { id: 'wueste', name: 'Wüsten-Raumhafen', charakter: 'Vollgas', farbe: '#ff9a3c', rundenzeit: 87.7,
    text: 'Dämmerung, Sandsturm: lange Geraden mit Boost-Ketten, weite schnelle Bögen, Riesensprung über das Raketensilo.',
    daten: () => import('./strecke_wueste.js'), kulisse: () => import('../gfx/kulisse_wueste.js') },
  { id: 'riff', name: 'Riff-Röhre', charakter: 'Technik', farbe: '#2be0ff', rundenzeit: 89.5,
    text: 'Glasröhren durch ein Korallenriff: Korkenzieher, Magnet-Überkopf, Gabelung mit engem Schnell-Weg.',
    daten: () => import('./strecke_riff.js'), kulisse: () => import('../gfx/kulisse_riff.js') },
  // lange Fassung der Megastadt (bis 0.1.3): nur über ?strecke=lang bzw. die Wahl auf der Megastadt-Karte, nicht im Cup
  { id: 'megastadt-lang', name: 'Neon-Megastadt (lang)', charakter: 'Allrounder', farbe: '#ff2bd6', fassung: 'lang', rundenzeit: 158.3, versteckt: true,
    text: 'Die lange Fassung der Megastadt.', daten: () => import('./strecke1.js'), kulisse: () => import('../gfx/kulisse_megastadt.js') },
];
// Cup: alle sichtbaren Strecken nacheinander (erst freigeschaltet, wenn alle fünf gebaut sind)
export const CUP = ['megastadt', 'wueste', 'riff', 'gebirge', 'orbit'];
export const cupBereit = () => CUP.every((id) => STRECKEN.some((e) => e.id === id));
// Cup-Punkte je Platz (Plan antigrav-racer: 9-7-5-3-2-1-0-0)
export const CUP_PUNKTE = [9, 7, 5, 3, 2, 1, 0, 0];
const ALIAS = { kurz: 'megastadt', lang: 'megastadt-lang', stadt: 'megastadt', wuestenraumhafen: 'wueste', unterwasser: 'riff', pass: 'gebirge', ring: 'orbit' };
export const STANDARD_STRECKE = 'megastadt';

export function finde(id) {
  const k = ALIAS[id] || id;
  return STRECKEN.find((e) => e.id === k) || null;
}
export const sichtbar = () => STRECKEN.filter((e) => !e.versteckt);
export const rundenDer = (id) => rundenFuer((finde(id) || STRECKEN[0]).rundenzeit);

// „Zufällig“: nie zweimal hintereinander dieselbe (zufall = Zahl 0…1, für Tests übergeben)
export function zufallsStrecke(letzte, zufall = Math.random()) {
  const liste = sichtbar().map((e) => e.id).filter((id) => id !== (finde(letzte) || {}).id);
  return liste[Math.min(liste.length - 1, Math.floor(zufall * liste.length))];
}

// Strecke laden und bauen (Browser: lazy). Rückgabe bahn mit id, name, info (Register-Eintrag)
export async function ladeStrecke(id) {
  const e = finde(id) || finde(STANDARD_STRECKE);
  const m = await e.daten();
  const b = m.baue(e.fassung);
  b.id = e.id; b.info = e; b.name = e.name;
  return b;
}
