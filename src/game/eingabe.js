// Eingabe: Tastatur, Touch (Handy zuerst, hoch + quer), Gamepad → roh = { gas, lenk, bremseL, bremseR, nase, rolle }.
// Tastatur: ←/→ bzw. A/D lenken, ↑/W Gas, ↓/S Gas weg (auf Leicht: Auto-Gas aus), Q/E Luftbremse links/rechts,
// Leertaste Barrel-Roll (in der Luft) bzw. Energie-Boost (am Boden, ab Runde 2), ↑/↓ in der Luft = Nase senken/heben, R/Rücktaste = Reset auf die Strecke.
// P1b (Peter 20.10.): ein über den Absprung gehaltenes ↑ bleibt reines Gas und senkt die Nase nie – erst ein NEUER Druck
// in der Luft nickt (Stick vorn genauso). ?nase=alt = bisher (↑ senkt in der Luft immer die Nase).
// Touch: linke/rechte Bildschirmhälfte lenken (Daumen-Position = Stärke), zwei Luftbremsen-Tasten, Roll-Taste.
// Gamepad: linker Stick lenken/Nase, RT Gas, LB/RB Luftbremsen, A Barrel-Roll, Y bzw. Zurück/View = Reset.
import { clamp } from '../core/util.js';
import { NASE } from '../config.js';

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
    this.roh = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0, boost: 0, strafe: 0, autoGas: false };
    this.resetWunsch = false; this.gpReset = false;
    this.hochSperre = false; this.stickSperre = false;   // ↑ bzw. Stick vorn seit dem Boden gehalten → nickt nicht
    if (ziel) {
      ziel.addEventListener('keydown', (e) => {
        if ((e.code === 'KeyR' || e.code === 'Backspace') && !e.repeat) { this.resetWunsch = true; e.preventDefault(); }
        this.tasten.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
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

  // Reset-Wunsch (Taste R/Rücktaste, Gamepad Y oder Zurück/View, HUD-Knopf über wuenscheReset): einmal je Druck
  resetGewuenscht() {
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    const an = !!(gp && ((gp.buttons[3] && gp.buttons[3].pressed) || (gp.buttons[8] && gp.buttons[8].pressed)));
    if (an && !this.gpReset) this.resetWunsch = true;
    this.gpReset = an;
    const w = this.resetWunsch; this.resetWunsch = false;
    return w;
  }
  wuenscheReset() { this.resetWunsch = true; }

  // Gas für den Start-Boost (Countdown): ↑/W, Gamepad RT oder ein Finger auf dem Bildschirm
  startGas() {
    const t = this.tasten;
    if (t.has('ArrowUp') || t.has('KeyW') || this.touch.aktiv) return true;
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    return !!(gp && gp.buttons[7] && gp.buttons[7].value > 0.5);
  }

  // Drehzahl für das Start-Band (P1b): Wert des analogen Gas-Abzugs (Gamepad RT), sonst null (Tastatur/Touch → abgestufter Tipp)
  startDrehzahl() {
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    return gp && gp.buttons[7] ? gp.buttons[7].value : null;
  }

  lesen(dt, inLuft = false) {
    const t = this.tasten, r = this.roh;
    const links = t.has('ArrowLeft') || t.has('KeyA'), rechts = t.has('ArrowRight') || t.has('KeyD');
    const hoch = t.has('ArrowUp') || t.has('KeyW'), runter = t.has('ArrowDown') || t.has('KeyS');
    let sollLenk = (links ? 1 : 0) - (rechts ? 1 : 0);
    if (this.touch.aktiv) sollLenk = this.touch.lenk;
    let gas = hoch ? 1 : runter ? -1 : 0;   // −1 = „Gas weg“ (für Auto-Gas)
    // Touch hat keine Gas-Taste: wer per Touch fährt, hat auf allen Stufen Auto-Gas (Stufen unterscheiden dann der Lenkzug)
    let autoGas = false;
    if (this.touch.benutzt && gas === 0) { gas = 1; autoGas = true; }
    let bl = t.has('KeyQ') || this.touch.bremseL ? 1 : 0, br = t.has('KeyE') || this.touch.bremseR ? 1 : 0;
    let rolle = t.has('Space') || this.touch.rolle ? 1 : 0;
    let boost = 0;
    // Seitwärts-Schub (P1b): Y/X (QWERTZ; Tasten-Codes KeyZ/KeyX = QWERTY Z/X), Gamepad rechter Stick seitlich
    let strafe = (t.has('KeyZ') ? 1 : 0) - (t.has('KeyX') ? 1 : 0);
    // Sperre: am Boden gehaltenes ↑ sperrt das Nase-Senken, bis ↑ in der Luft losgelassen wird
    const alt = NASE.modus === 'alt';
    if (!inLuft) this.hochSperre = hoch; else if (!hoch) this.hochSperre = false;
    const senken = hoch && (alt || !this.hochSperre);
    let nase = inLuft ? (runter ? 1 : 0) - (senken ? 1 : 0) : 0;   // wie im Flugzeug: zurückziehen = Nase hoch
    // Gamepad
    const gp = typeof navigator !== 'undefined' && navigator.getGamepads ? [...navigator.getGamepads()].find((p) => p && p.connected) : null;
    if (gp) {
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) > 0.12) sollLenk = -ax;
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
      if (rt > 0.05) { gas = rt; autoGas = false; }
      if (gp.buttons[4] && gp.buttons[4].pressed) bl = 1;
      if (gp.buttons[5] && gp.buttons[5].pressed) br = 1;
      if (gp.buttons[0] && gp.buttons[0].pressed) rolle = 1;
      if (gp.buttons[2] && gp.buttons[2].pressed) boost = 1;   // X = Energie-Boost (A am Boden ebenso)
      const sx = gp.axes[2] || 0;
      if (Math.abs(sx) > 0.2) strafe = -sx;
      // Stick vorn (ay < 0 = Nase senken) über den Absprung gehalten: erst nach Rückkehr zur Mitte wirksam
      if (!inLuft) this.stickSperre = ay < -0.15; else if (ay > -0.15) this.stickSperre = false;
      if (inLuft && Math.abs(ay) > 0.15 && (alt || ay > 0 || !this.stickSperre)) nase = ay;
    }
    this.lenk = gp && Math.abs(gp.axes[0] || 0) > 0.12 ? sollLenk : rampe(this.lenk, sollLenk, dt);
    r.autoGas = autoGas;   // P3: Gas kommt vom Touch-Automaten (die Fahrhilfe darf es vor Kurven zurücknehmen)
    r.gas = gas; r.lenk = this.lenk; r.bremseL = bl; r.bremseR = br; r.rolle = rolle; r.nase = nase; r.boost = boost; r.strafe = strafe;
    return r;
  }
}
