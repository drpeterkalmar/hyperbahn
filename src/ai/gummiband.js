// Gummiband (Datenblatt Fahrgefühl, Abschnitt 3): hält das Feld zusammen, ohne die Physik zu verlassen.
//  • KI-Führender: liegt er mehr als die Grenze (2,5 s in Runde 1 → 5 s in der Endrunde, linear über das Rennen) vor dem
//    besten Menschen, nimmt er Tempo raus.
//  • Zwei Rivalen (die stärksten KI-Fahrer): hinter dem Menschen → „schnell“ (volles Leistungsprofil, kein Störfeld-Abzug);
//    im Fenster 0–2,5 s vor ihm → normal; weiter vorn → Gas weg.
//  • Feld dahinter: KI-Fahrer, die mehr als 3 s (Stärke 0,5) hinter dem Menschen liegen, fahren „schnell“.
//  • Nur gegen Menschen (Rennen ohne Spieler: aus). Online-Rennen ohne KI: aus (P2P-fair). Abstände in Sekunden
//    (Fortschritt / Bezugstempo). Stärke 0 … 1 (?gummiband=0|1|2 → 0 / 0,5 / 1).
// Rein, Node-testbar. Setzt `pilot.gummi = { tempo, schnell }` bzw. null.
import { GLEITER } from '../config.js';
import { GEFUEHL } from '../physics/fahrgefuehl.js';
import { clamp, lerp } from '../core/util.js';

export const GUMMI = { grenze0: 2.5, grenze1: 5, rivalFenster: 2.5, bremsFuehrer: 0.24, bremsRival: 0.2, ref: 0.95, nachzuegler: 3 };

export function waehleRivalen(rennen) {
  const kis = rennen.alle.filter((t) => t.pilot && !t.spieler);
  return kis.slice().sort((a, b) => (b.pilot.profil.tempo - a.pilot.profil.tempo) || (a.k - b.k)).slice(0, 2).map((t) => t.k);
}

// P3: ohne neue Listen je Aufruf (läuft 240× je Sekunde; vorher filter/reduce = ständige Speicherbereinigung)
export function gummiband(rennen, staerke = GEFUEHL.gummiband) {
  const alle = rennen.alle;
  let best = null, nKi = 0;
  for (const t of alle) {
    if (t.pilot && !t.spieler) { t.pilot.gummi = null; nKi++; }
    if (t.spieler && (!best || t.fortschritt > best.fortschritt)) best = t;
  }
  if (staerke <= 0 || !best || !nKi || rennen.phase !== 'rennen') return null;
  const vref = GLEITER.vmax * GUMMI.ref;
  const anteil = clamp(best.fortschritt / (rennen.bahn.L * rennen.runden), 0, 1);
  const grenze = lerp(GUMMI.grenze0, GUMMI.grenze1, anteil);
  // KI-Führender (nur wer noch nicht im Ziel ist)
  let f = null;
  for (const t of alle) if (t.pilot && !t.spieler && !t.ziel && (!f || t.fortschritt > f.fortschritt)) f = t;
  if (f) {
    const vorsprung = (f.fortschritt - best.fortschritt) / vref;
    if (vorsprung > grenze) f.pilot.gummi = { tempo: 1 - GUMMI.bremsFuehrer * staerke * clamp(0.5 + (vorsprung - grenze) / 2, 0, 1), schnell: false };
  }
  // Feld dahinter: wer mehr als die Nachzügler-Grenze hinter dem Menschen liegt, fährt „schnell“ (eigenes Profil +4 %)
  const nach = GUMMI.nachzuegler / Math.max(0.25, staerke * 2);
  for (const t of alle) {
    if (!t.pilot || t.spieler || t.ziel || t.pilot.gummi) continue;
    if ((best.fortschritt - t.fortschritt) / vref > nach) t.pilot.gummi = SCHNELL;
  }
  // Rivalen
  if (!rennen.rivalen) rennen.rivalen = waehleRivalen(rennen);
  for (const k of rennen.rivalen) {
    const t = alle[k];
    if (!t || t.ziel) continue;
    const d = (t.fortschritt - best.fortschritt) / vref;
    if (d < 0) t.pilot.gummi = SCHNELL;
    else if (d > GUMMI.rivalFenster) t.pilot.gummi = { tempo: Math.min(t.pilot.gummi ? t.pilot.gummi.tempo : 1, 1 - GUMMI.bremsRival * staerke), schnell: false };
  }
  rennen.gummiInfo = rennen.gummiInfo || { grenze: 0, best: 0 };
  rennen.gummiInfo.grenze = grenze; rennen.gummiInfo.best = best.k;
  return rennen.gummiInfo;
}
const SCHNELL = Object.freeze({ tempo: 1, schnell: true });
