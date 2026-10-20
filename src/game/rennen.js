// Rennen: Startaufstellung, Countdown, Rundenzähler, Rangliste, Zieleinlauf, Gleiter-Gleiter-Stöße (rein, Node-testbar).
// Die Physik läuft für alle Teilnehmer im selben festen Schritt; KI-Teilnehmer holen ihre Eingaben vom Pilot, der Spieler
// liefert sie von außen (Eingabe + Fahrhilfe). Fortschritt = gefahrene Bogenlänge (Rückwärtsfahren zählt negativ),
// daher kein Abkürzen über den Start/Ziel-Strich.
// Fahrgefühl (Datenblatt): Start-Boost im Fenster um Grün (Überdrehen = Stotterer), Stöße nach Stoßgewicht der Klasse,
// Gummiband gegen den besten Menschen (ai/gummiband.js).
import { Gleiter } from '../physics/gleiter.js';
import { GEFUEHL, startWertung } from '../physics/fahrgefuehl.js';
import { gummiband } from '../ai/gummiband.js';

export const START = { reihe: 22, quer: 5.5, vorStrich: 12, countdown: 3 };

export class Rennen {
  // teilnehmer: [{ name, pilot (oder null = Spieler), farbe, klasse, spieler (true = Mensch, auch wenn ein Autopilot fährt) }]
  constructor(bahn, teilnehmer, opt = {}) {
    this.bahn = bahn;
    this.runden = opt.runden || 3;
    this.zeit = 0;
    this.phase = opt.ohneCountdown ? 'rennen' : 'countdown';
    this.countdown = opt.ohneCountdown ? 0 : START.countdown;
    this.zielReihenfolge = [];
    this.gummiStaerke = opt.gummiband ?? GEFUEHL.gummiband;
    this.alle = teilnehmer.map((t, k) => {
      const reihe = Math.floor(k / 2), seite = k % 2 ? -1 : 1;
      const abstand = START.vorStrich + reihe * START.reihe;
      const s = bahn.L - abstand;
      const spieler = t.spieler ?? !t.pilot;
      const g = new Gleiter(bahn, { id: k, s, u: seite * START.quer, v0: 0, klasse: t.klasse, ki: !spieler });
      return {
        k, name: t.name || `Fahrer ${k + 1}`, farbe: t.farbe, pilot: t.pilot || null, spieler, klasse: g.klasse,
        g, fortschritt: -abstand, sAlt: g.s, runde: 0, rundenStart: 0, rundenZeiten: [], beste: Infinity,
        ziel: null, platz: k + 1, start: { dauer: 0, tipp: null, alt: false, gewertet: false },
      };
    });
    this.gleiter = this.alle.map((t) => t.g);
    // fliegender Start (Abnahme, ?at=): kein Start-Boost-Fenster, nichts zu werten
    if (opt.ohneCountdown) for (const t of this.alle) t.start.gewertet = true;
  }

  get spieler() { return this.alle.find((t) => t.spieler) || null; }

  // ein fester Physik-Schritt; einSpieler = Eingabe des Spielers (nach Fahrhilfe)
  // startSpieler (optional): Gas des Spielers nur für die Start-Wertung (z. B. ohne Auto-Gas der Fahrhilfe)
  schritt(dt, einSpieler, startSpieler = null) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      this.startGas(dt, -Math.max(0, this.countdown), startSpieler || einSpieler);
      if (this.countdown <= 0) {
        this.phase = 'rennen'; this.countdown = 0;
        // Überdrehen: zu langes Dauergas vor Grün → Triebwerks-Stotterer
        for (const t of this.alle) if (startWertung(null, t.start.dauer) === 'stotterer') { t.g.stotter = GEFUEHL.stotterer; t.start.gewertet = true; t.g.ereignis('stotterer', 1); }
      }
      return;
    }
    this.zeit += dt;
    if (this.zeit <= GEFUEHL.startfenster / 2 + 1e-9) this.startGas(dt, this.zeit, startSpieler || einSpieler);
    else this.startBoost();
    if (this.gummiStaerke > 0) gummiband(this, this.gummiStaerke);
    for (const t of this.alle) {
      let ein;
      if (t.ziel && t.spieler && !einSpieler && !t.pilot) ein = AUS;
      else if (t.pilot && !(t.spieler && einSpieler)) ein = t.pilot.steuer(t.g, dt, this.gleiter);
      else ein = einSpieler || AUS;
      t.g.schritt(dt, ein);
    }
    this.stoesse();
    this.fortschritt();
  }

  // Start-Boost: Gas-Flanken um Grün mitschreiben (Spieler = Eingabe, KI/Autopilot = Start-Tipp des Piloten)
  startGas(dt, rel, einSpieler) {
    for (const t of this.alle) {
      const an = t.pilot && !(t.spieler && einSpieler) ? t.pilot.startGas(rel) > 0.5 : !!(einSpieler && einSpieler.gas > 0.5);
      const st = t.start;
      if (an && !st.alt) st.tipp = rel;
      st.dauer = an && rel <= 0 ? st.dauer + dt : (rel <= 0 ? 0 : st.dauer);
      st.alt = an;
    }
  }
  startBoost() {
    for (const t of this.alle) {
      const st = t.start;
      if (st.gewertet) continue;
      st.gewertet = true;
      if (startWertung(st.tipp, 0) === 'boost') { t.g.padBoost(); t.g.statistik.startboost++; t.g.ereignis('startboost', 1); }
    }
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
          // Impuls je Gleiter = stoss × Relativtempo × (Gewicht des anderen / eigenes), gedeckelt → Leichte fliegen weiter
          const wi = gi.kl.stoss, wj = gj.kl.stoss, D = GEFUEHL.stossDeckel;
          const ki = GEFUEHL.stoss * -rel * Math.min(D, wj / wi), kj = GEFUEHL.stoss * -rel * Math.min(D, wi / wj);
          gi.v.x -= nx * ki; gi.v.y -= ny * ki; gi.v.z -= nz * ki;
          gj.v.x += nx * kj; gj.v.y += ny * kj; gj.v.z += nz * kj;
          gi.schild = Math.max(0, gi.schild - 0.02 * Math.min(D, wj / wi) * Math.min(1, -rel / 20));
          gj.schild = Math.max(0, gj.schild - 0.02 * Math.min(D, wi / wj) * Math.min(1, -rel / 20));
          const st = Math.min(1, -rel / 15);
          gi.ereignis('stoss', st, { mit: gj.id }); gj.ereignis('stoss', st, { mit: gi.id });
          gi.drift.abbrechen(); gj.drift.abbrechen();
        }
      }
    }
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
