// Ton (reine WebAudio-Synthese, keine Assets): Boost-Fauchen mit Tonhöhen-Anstieg, Wand-Kratzen, Magnet-Summen,
// kurze Töne für Landung/Ring/Rolle/Mini-Turbo/Start-Boost. Peters Handy-Regeln: zurückhaltend, Klangkörper im Mittelton
// (300–700 Hz), kein Dauerfeuer, im Menü still, Lautlos-Schalter respektieren (audioSession 'ambient').
// Zeitlupe: tonFaktor < 1 senkt die Tonhöhe. Musik: CC0-Synthwave-Loop „Cyber Runner“ (ansimuz, OpenGameArt, LICENSES.md),
// nur im Rennen (im Menü still), auf −16 LUFS gebracht (assets/musik/cyber_runner.m4a).
// Startwerte – TODO Heavy-Job: am Handy-Lautsprecher abhören (Pegel, Tonhöhen).
// 26.10.2026 (Peter): Antriebs-/Motorsound ersatzlos gestrichen (war antrieb 0.16), Musik lauter (war 0.35).
// URL-Regler ?musik=0..1.2 (Musik-Pegel, 0 = aus).
const _q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('musik') : null;
const _musik = _q !== null && _q !== '' && Number.isFinite(+_q) ? Math.max(0, Math.min(1.2, +_q)) : 0.8;
export const MISCHUNG = { gesamt: 0.55, boost: 0.14, wand: 0.18, magnet: 0.05, ereignis: 0.22, musik: _musik };

export class Ton {
  constructor() {
    this.ctx = null; this.an = false; this.stummAn = false;
    this.letzt = {};   // Mindestabstand je Ereignis-Art (kein Dauerfeuer)
  }

  async start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); this.an = true; return; }
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch { /* älterer Browser */ }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.stummAn ? 0 : MISCHUNG.gesamt;
    this.master.connect(c.destination);
    // Rauschen (Boost-Fauchen, Wand-Kratzen)
    const len = c.sampleRate * 1.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    let s = 7; for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    const rauschen = (typ, f, q) => {
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const fl = c.createBiquadFilter(); fl.type = typ; fl.frequency.value = f; fl.Q.value = q;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(fl); fl.connect(g); g.connect(this.master); src.start();
      return { fl, g };
    };
    this.boostR = rauschen('bandpass', 600, 1.2);
    this.wandR = rauschen('highpass', 1800, 0.7);
    // Magnet-Summen: 110/220 Hz mit Tremolo
    this.mag1 = c.createOscillator(); this.mag1.frequency.value = 110;
    this.mag2 = c.createOscillator(); this.mag2.frequency.value = 220.5;
    this.magG = c.createGain(); this.magG.gain.value = 0;
    this.trem = c.createOscillator(); this.trem.frequency.value = 7;
    const tremG = c.createGain(); tremG.gain.value = 0.3;
    this.trem.connect(tremG); tremG.connect(this.magG.gain);
    this.mag1.connect(this.magG); this.mag2.connect(this.magG); this.magG.connect(this.master);
    for (const o of [this.mag1, this.mag2, this.trem]) o.start();
    this.an = true;
  }

  stumm(an) {
    this.stummAn = !!an;
    if (this.master) this.master.gain.setTargetAtTime(this.stummAn ? 0 : MISCHUNG.gesamt, this.ctx.currentTime, 0.05);
  }

  // je Bild: tempo (m/s), vmax, boost (0…), magnet (0…1), wand (bool), luft (bool), tonFaktor (Zeitlupe)
  update({ tempo = 0, vmax = 95, boost = 0, magnet = 0, wand = false, luft = false, tonFaktor = 1 } = {}) {
    if (!this.ctx || !this.an) return;
    const t = this.ctx.currentTime;
    this.boostR.g.gain.setTargetAtTime(MISCHUNG.boost * Math.min(1, boost * 1.4), t, 0.08);
    this.boostR.fl.frequency.setTargetAtTime((450 + 500 * Math.min(1, boost)) * tonFaktor, t, 0.1);
    this.wandR.g.gain.setTargetAtTime(wand ? MISCHUNG.wand : 0, t, 0.03);
    this.magG.gain.setTargetAtTime(MISCHUNG.magnet * magnet, t, 0.15);
    if (this.musikSrc) this.musikSrc.playbackRate.setTargetAtTime(Math.max(0.5, tonFaktor), t, 0.05);   // Zeitlupe: Musik tiefer
  }

  // Menü/Pause: alles leise (keine Dauer-Schleifen im Menü)
  ruhe() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of [this.boostR.g.gain, this.wandR.g.gain, this.magG.gain]) g.setTargetAtTime(0, t, 0.1);
    this.musikStopp();
  }

  // kurze Töne; Mindestabstand je Art 0,12 s
  ereignis(art, staerke = 1) {
    if (!this.ctx || !this.an) return;
    const t = this.ctx.currentTime;
    if (this.letzt[art] && t - this.letzt[art] < 0.12) return;
    this.letzt[art] = t;
    const ton = (f0, f1, dauer, typ = 'triangle', pegel = 1) => {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dauer);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(MISCHUNG.ereignis * pegel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dauer + 0.02);
    };
    switch (art) {
      case 'pad': ton(380, 620 + 200 * staerke, 0.18, 'sawtooth', 0.5); break;
      case 'ring': ton(520, 880, 0.22, 'triangle', 0.7); break;
      case 'landung': if (staerke > 0.25) ton(220, 110, 0.25, 'square', 0.6 * staerke); break;
      case 'rolle': ton(440, 990, 0.3, 'triangle', 0.8); break;
      case 'miniturbo': ton(330, 660 + 120 * staerke, 0.25, 'sawtooth', 0.6); break;
      case 'driftStufe': ton(500 + 150 * staerke * 3, 520 + 150 * staerke * 3, 0.06, 'square', 0.3); break;
      case 'driftWarnung': ton(300, 280, 0.12, 'square', 0.4); break;
      case 'startboost': ton(392, 784, 0.35, 'sawtooth', 0.8); break;
      case 'stotterer': ton(140, 90, 0.4, 'square', 0.5); break;
      case 'magnet': ton(300, 450, 0.2, 'sine', 0.5); break;
      case 'absturz': ton(300, 60, 0.6, 'sawtooth', 0.7); break;
      // P1b: Energie
      case 'energieBoost': case 'rolleTurbo': ton(392, 784, 0.3, 'sawtooth', 0.7); break;
      case 'energieWarnung': ton(880, 560, 0.35, 'square', 0.35); break;
      case 'box': ton(330, 990, 0.5, 'sine', 0.5); break;
      case 'notlauf': ton(220, 110, 0.5, 'square', 0.5); break;
      case 'boostNein': case 'rolleNein': ton(200, 180, 0.08, 'square', 0.25); break;
      case 'stoss': if (staerke > 0.3) ton(180, 120, 0.12, 'square', 0.5 * staerke); break;
      default: break;
    }
  }

  // Musik laden (einmal) und als Schleife einblenden; Stopp in ruhe() (Menü/Pause)
  async musik(url) {
    if (!this.ctx) return;
    if (!this.musikBuf) {
      if (!this.musikLaden) this.musikLaden = fetch(url).then((r) => r.arrayBuffer()).then((b) => new Promise((ok, err) => this.ctx.decodeAudioData(b, ok, err)));
      try { this.musikBuf = await this.musikLaden; } catch (e) { console.warn('Musik', e); return; }
    }
    if (this.musikSrc || !this.an) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.musikBuf; src.loop = true;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(MISCHUNG.musik, t + 1.5);
    src.connect(g); g.connect(this.master); src.start();
    this.musikSrc = src; this.musikG = g;
  }
  musikStopp() {
    if (!this.musikSrc) return;
    const t = this.ctx.currentTime, src = this.musikSrc;
    this.musikG.gain.setTargetAtTime(0, t, 0.15); src.stop(t + 0.8);
    this.musikSrc = null; this.musikG = null;
  }
}
