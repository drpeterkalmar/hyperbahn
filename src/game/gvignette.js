// G-Vignette (P1b, Vorlage: G-Last als Rand-Abdunklung, bremst nicht): Deckkraft aus der G-Last des Gleiters.
// Rein, Node-testbar (tools/vorlagen_mess.mjs, Messgröße 13). Aus mit „Blitze reduzieren“ und ?gvignette=0.
import { VORLAGE } from '../config.js';

export function gVignetteDeckkraft(gLast, reduziert = false) {
  const V = VORLAGE.gvignette;
  if (!V.an || reduziert || !(gLast > V.ab)) return 0;
  return V.max * Math.min(1, (gLast - V.ab) / (V.voll - V.ab));
}
