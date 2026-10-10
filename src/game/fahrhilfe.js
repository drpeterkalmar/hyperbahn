// Fahrhilfe-Stufen Leicht/Mittel/Profi nach Peters Regel (rein, Node-testbar):
//  • Hilfen nehmen nie die Kontrolle weg: Sie ziehen nur, solange der Spieler nichts Deutliches tut. Eine deutliche Eingabe
//    blendet sie schnell aus (≤ 0,3 s), Loslassen führt sanft zurück (~1,2 s).
//  • Auch Leicht fährt nicht „auf Schienen“: Der Lenkzug ist begrenzt und additiv – man kann jederzeit an die Wand lenken.
//  • Leicht = Auto-Gas + Lenkzug zur Ideallinie; Mittel = nur schwacher Lenkzug; Profi = keine Hilfe.
//    (In der Luft richtet die Physik die Nase ohne Eingabe ohnehin sanft nach der Flugbahn aus.)
import { clamp } from '../core/util.js';
import { Pilot, PROFILE } from '../ai/pilot.js';

export const HILFE = {
  leicht: { name: 'Leicht', autoGas: true, zug: 0.6 },
  mittel: { name: 'Mittel', autoGas: false, zug: 0.3 },
  profi: { name: 'Profi', autoGas: false, zug: 0 },
};
export const DEUTLICH = 0.35;     // |Lenkung| ab der eine Eingabe als deutlich gilt
export const AUS_ZEIT = 0.25;     // s bis der Zug ganz weg ist (≤ 0,3 s)
export const ZURUECK_ZEIT = 1.2;  // s bis er nach dem Loslassen wieder voll zieht

export class Fahrhilfe {
  constructor(bahn, plan, stufe = 'leicht') {
    this.stufe = stufe;
    this.cfg = HILFE[stufe] || HILFE.leicht;
    // gleicher Pilot wie die KI, aber ohne menschliche Fehler – liefert nur die „Wunsch-Lenkung“
    this.pilot = new Pilot(bahn, plan, { ...PROFILE.profi, linie: 0, wackler: 0, rolle: 0 }, 1);
    this.gewicht = 1;
    this.ein = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
  }

  setzeStufe(stufe) { this.stufe = stufe; this.cfg = HILFE[stufe] || HILFE.leicht; }

  // roh = Spieler-Eingabe (Tastatur/Touch/Gamepad); Rückgabe = Eingabe für die Physik
  anwenden(g, roh, dt, andere = []) {
    const c = this.cfg, e = this.ein;
    e.bremseL = roh.bremseL || 0; e.bremseR = roh.bremseR || 0; e.rolle = roh.rolle || 0;
    e.nase = roh.nase || 0;
    // Auto-Gas: nur Leicht; „Gas weg“ (roh.gas < 0 = Bremstaste) bleibt möglich
    e.gas = c.autoGas ? (roh.gas < 0 ? 0 : 1) : clamp(roh.gas || 0, 0, 1);
    // Gewicht des Lenkzugs: deutliche Eingabe → schnell aus, sonst sanft zurück
    const deutlich = Math.abs(roh.lenk || 0) > DEUTLICH || (roh.bremseL || 0) > 0.5 || (roh.bremseR || 0) > 0.5;
    this.gewicht = deutlich ? Math.max(0, this.gewicht - dt / AUS_ZEIT) : Math.min(1, this.gewicht + dt / ZURUECK_ZEIT);
    let lenk = clamp(roh.lenk || 0, -1, 1);
    if (c.zug > 0 && g.zustand === 'fahrt') {
      const wunsch = this.pilot.steuer(g, dt, andere).lenk;
      lenk = clamp(lenk + this.gewicht * c.zug * wunsch, -1, 1);
    }
    e.lenk = lenk;
    return e;
  }
}
