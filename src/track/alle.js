// Alle Strecken statisch (nur Node-Werkzeuge/Tests – das Spiel lädt sie über strecken.js lazy)
import * as megastadt from './strecke1.js';
import * as wueste from './strecke_wueste.js';
import * as riff from './strecke_riff.js';
import { finde } from './strecken.js';

export const MODULE = { megastadt, 'megastadt-lang': megastadt, wueste, riff };

// Strecke synchron bauen (id oder Alias, z. B. kurz/lang); unbekannt → Megastadt
export function baueStrecke(id = 'megastadt') {
  const e = finde(id) || finde('megastadt');
  const m = MODULE[e.id];
  if (!m) throw new Error(`Strecke ${e.id} fehlt in alle.js`);
  const b = m.baue(e.fassung);
  b.id = e.id; b.info = e; b.name = e.name;
  return b;
}
