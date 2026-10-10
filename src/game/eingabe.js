// Eingabe: Tastatur, Touch (Handy zuerst, hoch + quer), Gamepad → roh = { gas, lenk, bremseL, bremseR, nase, rolle }.
// Tastatur: ←/→ bzw. A/D lenken, ↑/W Gas, ↓/S Gas weg (auf Leicht: Auto-Gas aus), Q/E Luftbremse links/rechts,
// Leertaste Barrel-Roll (in der Luft), ↑/↓ in der Luft = Nase senken/heben.
// Touch: linke/rechte Bildschirmhälfte lenken (Daumen-Position = Stärke), zwei Luftbremsen-Tasten, Roll-Taste.
// Gamepad: linker Stick lenken/Nase, RT Gas, LB/RB Luftbremsen, A Barrel-Roll.
import { clamp } from '../core/util.js';

// Lenkrampe für Tasten/Touch: weich hoch (sonst zuckt der Gleiter bei 600 km/h), schnell zurück
export const RAMPE = { hoch: 4.5, zurueck: 9 };
export function rampe(ist, soll, dt) {
  const r = Math.abs(soll) > Math.abs(ist) && Math.sign(soll) === Math.sign(ist || soll) ? RAMPE.hoch : RAMPE.zurueck;
  const d = soll - ist, m = r * dt;
  return Math.abs(d) <= m ? soll : ist + Math.sign(d) * m;
}

export class Eingabe {
  constructor(ziel = typeof window !== 'undefined' ? window : null) {
    this.tasten = new Set();
    this.touch = { lenk: 0, bremseL: 0, bremseR: 0, rolle: 0, aktiv: false };
    this.lenk = 0;
    this.roh = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
    if (ziel) {
      ziel.addEventListener('keydown', (e) => { this.tasten.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
      ziel.addEventListener('keyup', (e) => this.tasten.delete(e.code));
      ziel.addEventListener('blur', () => this.tasten.clear());
    }
  }

  // Touch-Flächen an DOM-Elemente binden (Lenkfläche = ganzer Spielbereich, Tasten = Buttons im HUD)
  bindeTouch(flaeche, { bremseL, bremseR, rolle } = {}) {
    const zeiger = new Map();
    const neu = () => {
      let l = 0;
      for (const p of zeiger.values()) {
        const w = flaeche.clientWidth || 1;
        // linke Hälfte = links lenken, Stärke nach Abstand zur Mitte (innen schwach, außen voll)
        const x = p.x / w - 0.5;
        l += clamp(-x * 2.6, -1, 1);
      }
      this.touch.lenk = clamp(l, -1, 1);
      this.touch.aktiv = zeiger.size > 0;
    };
    flaeche.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; this.touch.benutzt = true; zeiger.set(e.pointerId, { x: e.clientX }); neu(); });
    flaeche.addEventListener('pointermove', (e) => { if (zeiger.has(e.pointerId)) { zeiger.set(e.pointerId, { x: e.clientX }); neu(); } });
    const weg = (e) => { zeiger.delete(e.pointerId); neu(); };
    flaeche.addEventListener('pointerup', weg); flaeche.addEventListener('pointercancel', weg);
    const knopf = (el, feld) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.touch[feld] = 1; el.classList.add('an'); });
      const los = (e) => { e.stopPropagation(); this.touch[feld] = 0; el.classList.remove('an'); };
      el.addEventListener('pointerup', los); el.addEventListener('pointercancel', los); el.addEventListener('pointerleave', los);
    };
    knopf(bremseL, 'bremseL'); knopf(bremseR, 'bremseR'); knopf(rolle, 'rolle');
  }

  // Gas für den Start-Boost (Countdown): ↑/W, Gamepad RT oder ein Finger auf dem Bildschirm
  startGas() {
    const t = this.tasten;
    if (t.has('ArrowUp') || t.has('KeyW') || this.touch.aktiv) return true;
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    return !!(gp && gp.buttons[7] && gp.buttons[7].value > 0.5);
  }

  lesen(dt, inLuft = false) {
    const t = this.tasten, r = this.roh;
    const links = t.has('ArrowLeft') || t.has('KeyA'), rechts = t.has('ArrowRight') || t.has('KeyD');
    const hoch = t.has('ArrowUp') || t.has('KeyW'), runter = t.has('ArrowDown') || t.has('KeyS');
    let sollLenk = (links ? 1 : 0) - (rechts ? 1 : 0);
    if (this.touch.aktiv) sollLenk = this.touch.lenk;
    let gas = hoch ? 1 : runter ? -1 : 0;   // −1 = „Gas weg“ (für Auto-Gas)
    // Touch hat keine Gas-Taste: wer per Touch fährt, hat auf allen Stufen Auto-Gas (Stufen unterscheiden dann der Lenkzug)
    if (this.touch.benutzt && gas === 0) gas = 1;
    let bl = t.has('KeyQ') || this.touch.bremseL ? 1 : 0, br = t.has('KeyE') || this.touch.bremseR ? 1 : 0;
    let rolle = t.has('Space') || this.touch.rolle ? 1 : 0;
    let nase = inLuft ? (runter ? 1 : 0) - (hoch ? 1 : 0) : 0;   // wie im Flugzeug: zurückziehen = Nase hoch
    // Gamepad
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.12) sollLenk = -ax;
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      if (rt > 0.05) gas = rt;
      if (gp.buttons[4] && gp.buttons[4].pressed) bl = 1;
      if (gp.buttons[5] && gp.buttons[5].pressed) br = 1;
      if (gp.buttons[0] && gp.buttons[0].pressed) rolle = 1;
      if (inLuft && Math.abs(ay) > 0.15) nase = ay;
    }
    this.lenk = gp && Math.abs(gp.axes[0] || 0) > 0.12 ? sollLenk : rampe(this.lenk, sollLenk, dt);
    r.gas = gas; r.lenk = this.lenk; r.bremseL = bl; r.bremseR = br; r.rolle = rolle; r.nase = nase;
    return r;
  }
}
