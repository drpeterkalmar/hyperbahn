// Bestzeiten (P1b): je Strecken-Fassung, Rundenzahl und Streckenlänge getrennt gemerkt – ein Rennen über die Kurzfassung
// wird nie mit einem über die lange Fassung oder einer anderen Rundenzahl verglichen (alte 3-Runden-Zeiten zählen nicht).
// Rein (Speicher wird übergeben: localStorage im Browser, ein Objekt mit getItem/setItem in Node-Tests).
export const BESTZEIT_SPEICHER = 'hyperbahn-bestzeiten-v2';

export function bestzeitSchluessel(bahn, runden) {
  return `${bahn.fassung || 'lang'}|${runden}R|${Math.round(bahn.L)}m`;
}

function lade(speicher) {
  try { return JSON.parse((speicher && speicher.getItem(BESTZEIT_SPEICHER)) || '{}') || {}; } catch { return {}; }
}

export function leseBestzeit(speicher, schluessel) {
  return lade(speicher)[schluessel] || null;
}

// Ergebnis eintragen: rennen = Gesamtzeit (s), runde = beste Runde (s); Rückgabe { alt, neu: { rennen, runde }, neuRennen, neuRunde }
export function trageBestzeitEin(speicher, schluessel, rennen, runde) {
  const alle = lade(speicher), alt = alle[schluessel] || null;
  const neuRennen = Number.isFinite(rennen) && (!alt || !(alt.rennen <= rennen));
  const neuRunde = Number.isFinite(runde) && (!alt || !(alt.runde <= runde));
  const neu = { rennen: neuRennen ? rennen : alt ? alt.rennen : null, runde: neuRunde ? runde : alt ? alt.runde : null };
  if (neuRennen || neuRunde) {
    alle[schluessel] = neu;
    try { speicher && speicher.setItem(BESTZEIT_SPEICHER, JSON.stringify(alle)); } catch { /* privat */ }
  }
  return { alt, neu, neuRennen, neuRunde };
}
