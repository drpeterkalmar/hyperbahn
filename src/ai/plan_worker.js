// P3 Etappe 2 (Peter: „starten langsam“): KI-Ideallinie + Tempoplan (bauePlaene, 350–800 ms bei CPU ×4) in einem Worker –
// der Hauptfaden baut derweil Bahn-Mesh und Kulisse, das Menü zeigt die Strecke früher. Der Worker baut die Strecke selbst
// (deterministisch, dieselben URL-Regler wie die Seite) und schickt die Pläne zurück (Typed Arrays übertragen, nicht kopiert).
// Auf Wunsch (stadt) vorher den Stadt-Plan der Megastadt (gfx/stadt_plan.js, ≈ 0,6 s bei CPU ×4).
import { leseRegler } from '../config.js';
import { ladeStrecke } from '../track/strecken.js';
import { bauePlaene } from './pilot.js';
import { stadtPlan } from '../gfx/stadt_plan.js';

// (im Node-Modultest gibt es kein `self` – dann nur laden)
if (typeof self !== 'undefined') self.onmessage = async (ev) => {
  const { nr, id, suche, stadt } = ev.data;
  try {
    leseRegler(suche);
    const bahn = await ladeStrecke(id);
    // Megastadt: zuerst den Stadt-Plan (für das Bild), dann die KI-Pläne
    if (stadt) self.postMessage({ nr, stadtPlan: stadtPlan(bahn, stadt), L: bahn.L, N: bahn.N });
    const p = bauePlaene(bahn);
    const puffer = [];
    for (const pl of new Set([p.sicher, p.schnell])) for (const k of ['u', 'vZiel', 'vLim', 'kQuer', 'kSign', 'voll', 'kurveId']) puffer.push(pl[k].buffer);
    self.postMessage({ nr, plaene: p, L: bahn.L, N: bahn.N }, puffer);
  } catch (e) {
    self.postMessage({ nr, fehler: String(e && e.stack || e) });
  }
};
