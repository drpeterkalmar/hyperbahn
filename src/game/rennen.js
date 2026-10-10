// Rennen: Startaufstellung, Countdown, Rundenzähler, Rangliste, Zieleinlauf, Gleiter-Gleiter-Stöße (rein, Node-testbar).
// Die Physik läuft für alle Teilnehmer im selben festen Schritt; KI-Teilnehmer holen ihre Eingaben vom Pilot, der Spieler
// liefert sie von außen (Eingabe + Fahrhilfe). Fortschritt = gefahrene Bogenlänge (Rückwärtsfahren zählt negativ),
// daher kein Abkürzen über den Start/Ziel-Strich.
import { Gleiter } from '../physics/gleiter.js';
import { dot } from '../core/vec.js';

export const START = { reihe: 22, quer: 5.5, vorStrich: 12, countdown: 3 };

export class Rennen {
  // teilnehmer: [{ name, pilot (oder null = Spieler), farbe }]
  constructor(bahn, teilnehmer, opt = {}) {
    this.bahn = bahn;
    this.runden = opt.runden || 3;
    this.zeit = 0;
    this.phase = opt.ohneCountdown ? 'rennen' : 'countdown';
    this.countdown = opt.ohneCountdown ? 0 : START.countdown;
    this.zielReihenfolge = [];
    this.alle = teilnehmer.map((t, k) => {
      const reihe = Math.floor(k / 2), seite = k % 2 ? -1 : 1;
      const abstand = START.vorStrich + reihe * START.reihe;
      const s = bahn.L - abstand;
      const g = new Gleiter(bahn, { id: k, s, u: seite * START.quer, v0: 0 });
      return {
        k, name: t.name || `Fahrer ${k + 1}`, farbe: t.farbe, pilot: t.pilot || null, spieler: !t.pilot,
        g, fortschritt: -abstand, sAlt: g.s, runde: 0, rundenStart: 0, rundenZeiten: [], beste: Infinity,
        ziel: null, platz: k + 1,
      };
    });
    this.gleiter = this.alle.map((t) => t.g);
  }

  get spieler() { return this.alle.find((t) => t.spieler) || null; }

  // ein fester Physik-Schritt; einSpieler = Eingabe des Spielers (nach Fahrhilfe)
  schritt(dt, einSpieler) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) { this.phase = 'rennen'; this.countdown = 0; }
      return;
    }
    this.zeit += dt;
    for (const t of this.alle) {
      let ein;
      if (t.ziel && t.spieler && !einSpieler) ein = AUS;
      else if (t.pilot) ein = t.pilot.steuer(t.g, dt, this.gleiter);
      else ein = einSpieler || AUS;
      t.g.schritt(dt, ein);
    }
    this.stoesse();
    this.fortschritt();
  }

  fortschritt() {
    const L = this.bahn.L;
    for (const t of this.alle) {
      const g = t.g;
      let d = g.s - t.sAlt;
      if (d < -L / 2) d += L; else if (d > L / 2) d -= L;
      t.sAlt = g.s;
      // Respawn springt nach einem Sprung-Absturz hinter die Lücke: zählt (der Gleiter wäre dort gelandet)
      const resp = (g.respawns || 0) !== (t.respawnsAlt || 0);
      t.respawnsAlt = g.respawns || 0;
      if (Math.abs(d) > 80 && !resp) continue;
      t.fortschritt += d;
      const r = Math.floor(t.fortschritt / L);
      if (r > t.runde && r >= 1) {
        const rz = this.zeit - t.rundenStart;
        t.rundenZeiten.push(rz); t.beste = Math.min(t.beste, rz);
        t.rundenStart = this.zeit; t.runde = r;
        g.ereignis('runde', 1, { runde: r, zeit: rz });
        if (r >= this.runden && !t.ziel) {
          t.ziel = { zeit: this.zeit, platz: this.zielReihenfolge.length + 1 };
          this.zielReihenfolge.push(t);
          g.ereignis('ziel', 1, { platz: t.ziel.platz });
        }
      }
    }
    // Rangliste: Ziel nach Reihenfolge, sonst nach Fortschritt
    const sortiert = this.alle.slice().sort((a, b) => {
      if (a.ziel && b.ziel) return a.ziel.platz - b.ziel.platz;
      if (a.ziel) return -1; if (b.ziel) return 1;
      return b.fortschritt - a.fortschritt;
    });
    sortiert.forEach((t, i) => { t.platz = i + 1; });
    this.rangliste = sortiert;
    if (this.alle.every((t) => t.ziel) || (this.spieler && this.spieler.ziel && this.phase === 'rennen' && this.alleKiNachZiel())) this.phase = 'ziel';
  }

  alleKiNachZiel() { return this.alle.every((t) => t.ziel || t.spieler); }

  // Gleiter-Gleiter: weiche Kugeln (Radius ~1,6 m quer / 2,2 m längs), Impulsaustausch entlang der Verbindungslinie
  stoesse() {
    const a = this.gleiter, L = this.bahn.L;
    for (let i = 0; i < a.length; i++) {
      const gi = a[i]; if (gi.zustand !== 'fahrt') continue;
      for (let j = i + 1; j < a.length; j++) {
        const gj = a[j]; if (gj.zustand !== 'fahrt') continue;
        let ds = gj.s - gi.s; if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L;
        if (Math.abs(ds) > 6) continue;
        const dx = gj.p.x - gi.p.x, dy = gj.p.y - gi.p.y, dz = gj.p.z - gi.p.z;
        // elliptischer Abstand im Rahmen von gi
        const lv = dx * gi.vor.x + dy * gi.vor.y + dz * gi.vor.z;
        const ll = dx * gi.links.x + dy * gi.links.y + dz * gi.links.z;
        const lo = dx * gi.oben.x + dy * gi.oben.y + dz * gi.oben.z;
        const e = (lv / 4.2) ** 2 + (ll / 2.6) ** 2 + (lo / 1.6) ** 2;
        if (e >= 1) continue;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-3;
        const nx = dx / d, ny = dy / d, nz = dz / d;
        const tief = (1 - Math.sqrt(e)) * 1.2;
        gi.p.x -= nx * tief / 2; gi.p.y -= ny * tief / 2; gi.p.z -= nz * tief / 2;
        gj.p.x += nx * tief / 2; gj.p.y += ny * tief / 2; gj.p.z += nz * tief / 2;
        const rel = (gj.v.x - gi.v.x) * nx + (gj.v.y - gi.v.y) * ny + (gj.v.z - gi.v.z) * nz;
        if (rel < 0) {
          const imp = -rel * 0.75;   // halbelastisch
          gi.v.x -= nx * imp; gi.v.y -= ny * imp; gi.v.z -= nz * imp;
          gj.v.x += nx * imp; gj.v.y += ny * imp; gj.v.z += nz * imp;
          const st = Math.min(1, -rel / 15);
          gi.ereignis('stoss', st, { mit: gj.id }); gj.ereignis('stoss', st, { mit: gi.id });
        }
      }
    }
    void dot;
  }

  // Beinahe-Kollision/knappes Überholen erkennen (für Action-Momente): Paare mit kleinem Abstand und hoher Relativfahrt
  knappeDuelle(gSpieler, dist = 4) {
    const L = this.bahn.L, out = [];
    for (const o of this.gleiter) {
      if (o === gSpieler || o.zustand !== 'fahrt') continue;
      let ds = o.s - gSpieler.s; if (ds < -L / 2) ds += L; else if (ds > L / 2) ds -= L;
      if (Math.abs(ds) < 8 && Math.abs(o.u - gSpieler.u) < dist) out.push({ o, ds, du: o.u - gSpieler.u, rel: gSpieler.tempo - o.tempo });
    }
    return out;
  }
}

const AUS = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };

// Zeitfahr-/Testhelfer: Rennen mit n KI-Fahrern (Profil je Fahrer) – für das KI-Gate und den Autopiloten
export const TEAMS = [
  { name: 'Vanta', farbe: 0x00e5ff }, { name: 'Kyrie', farbe: 0xff2bd6 }, { name: 'Oszill', farbe: 0xffd400 },
  { name: 'Nadir', farbe: 0x7cff4f }, { name: 'Halcyon', farbe: 0xff6a00 }, { name: 'Ion', farbe: 0x9b5cff },
  { name: 'Ferro', farbe: 0xff3b3b }, { name: 'Quell', farbe: 0xf2f2f2 },
];
