// Auslöser für Action-Momente (P1) aus dem Renngeschehen – rein, Node-testbar. Meldet über den Bus
// `actionMoment(art, stärke, pos, kontext)`; ob ein Moment wirklich läuft, entscheidet die Regie (core/zeit.js).
//   sprungScheitel: Spieler im Riesensprung am Scheitel (Steiggeschwindigkeit wechselt das Vorzeichen, ≥ 1,5 s Luft)
//   ueberholen:     Spieler geht knapp (< 3,5 m quer) an einem Gegner vorbei
//   beinahe:        Beinahe-Kollision (< 2,8 m quer, Gegner längs gleichauf, hohe Relativfahrt)
//   ringKette:      ≥ 2 Boost-Ringe innerhalb von 3 s
//   zielSieg:       Zieldurchfahrt (26.10.2026: jeder Platz – Platz 1 Stärke 1, sonst 0,9; bis 0.1.16 nur Platz 1)
//   magnetTempo:    Looping-/Magnet-Abschnitt mit ≥ 95 % Höchsttempo × Boost
// `gefahr` (Spieler muss gleich reagieren): Tempoplan voraus deutlich unter dem aktuellen Tempo (Kurve) oder Wand nah.
import { actionMoment } from '../core/zeit.js';
import { GLEITER } from '../config.js';
import { F_MAGNET, F_LUECKE } from '../track/bahn.js';

export class MomentWaechter {
  constructor(bahn, plan, melde = actionMoment) {
    this.bahn = bahn; this.plan = plan; this.melde = melde;
    this.vyAlt = 0; this.scheitelGemeldet = false;
    this.ringe = []; this.vorbei = new Map(); this.magnetGemeldet = false;
  }

  // Gefahr voraus: in den nächsten ~1,5 s verlangt der Tempoplan < 85 % des aktuellen Tempos, oder Wand < 2 m
  gefahr(g) {
    const b = this.bahn;
    if (Math.abs(g.u) > b.hw[Math.floor(g.hint) % b.N] - 3) return true;
    if (!this.plan) return false;
    const weit = g.tempo * 1.5;
    for (let d = 0; d < weit; d += 10) {
      const i = ((Math.round((g.s + d) / b.ds) % b.N) + b.N) % b.N;
      if (this.plan.vLim[i] < g.tempo * 0.85) return true;
    }
    return false;
  }

  // je Sim-Schritt (oder je Bild) für den Spieler-Gleiter; rennen optional (Überholen/Beinahe/Ziel)
  pruefe(g, rennen = null, t = g.zeit) {
    const b = this.bahn;
    // Ereignisse des Spielers (Ringe, Ziel)
    for (const e of g.ereignisse) {
      if (e.art === 'ring') {
        this.ringe = this.ringe.filter((x) => x > t - 3); this.ringe.push(t);
        if (this.ringe.length >= 2) this.melde('ringKette', Math.min(1, 0.6 + 0.2 * this.ringe.length), kopie(g.p), { gefahr: false });
      }
      if (e.art === 'ziel') this.melde('zielSieg', e.platz === 1 ? 1 : 0.9, kopie(g.p), { gefahr: false });
    }
    // Sprung-Scheitel (Steiggeschwindigkeit Welt-y wechselt von + nach −), nur in der Lücke
    const vy = g.v.y;
    if (!g.boden && (g.q.flags & F_LUECKE) && g.luftZeit > 0.6 && !this.scheitelGemeldet && this.vyAlt > 0 && vy <= 0) {
      this.scheitelGemeldet = true;
      this.melde('sprungScheitel', Math.min(1, 0.55 + g.tempo / (GLEITER.vmax * 3)), kopie(g.p), { gefahr: false });
    }
    if (g.boden) this.scheitelGemeldet = false;
    this.vyAlt = vy;
    // Magnet-Abschnitt mit Höchsttempo
    const mag = g.q.flags & F_MAGNET;
    if (mag && !this.magnetGemeldet && g.tempo > GLEITER.vmax * 0.95 * (1 + g.boost)) {
      this.magnetGemeldet = true;
      this.melde('magnetTempo', 0.8, kopie(g.p), { gefahr: this.gefahr(g) });
    }
    if (!mag) this.magnetGemeldet = false;
    // Überholen / Beinahe
    if (rennen) {
      const L = b.L;
      for (const o of rennen.gleiter) {
        if (o === g || o.zustand !== 'fahrt') continue;
        let ds = o.s - g.s; if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L;
        const du = Math.abs(o.u - g.u);
        const alt = this.vorbei.get(o.id);
        this.vorbei.set(o.id, ds);
        if (alt != null && alt > 0 && ds <= 0 && du < 3.5 && Math.abs(ds) < 10) {
          this.melde('ueberholen', Math.min(1, 0.5 + (g.tempo - o.tempo) / 30 + (3.5 - du) / 7), kopie(g.p), { gefahr: this.gefahr(g) });
        } else if (Math.abs(ds) < 3 && du < 2.8 && Math.abs(g.tempo - o.tempo) > 12) {
          this.melde('beinahe', Math.min(1, Math.abs(g.tempo - o.tempo) / 30), kopie(g.p), { gefahr: this.gefahr(g) });
        }
      }
    }
  }
}

const kopie = (p) => ({ x: p.x, y: p.y, z: p.z });
