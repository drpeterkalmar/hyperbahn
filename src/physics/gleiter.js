// Schwebe-Physik des Gleiters (rein, deterministisch, ohne three.js) – Spieler und KI fahren mit derselben Physik.
//
// Starrkörper mit 4 Schwebe-Punkten: Jeder Punkt fragt die Bahn entlang ihrer LOKALEN Normale ab (nicht Welt-Unten) und
// drückt mit einer Feder-Dämpfer-Kraft auf Schwebehöhe (~1,2 m). Dadurch richtet sich der Gleiter an der Bahn aus –
// Steilkurve, Looping, Röhre, Wandfahrt, kopfüber. In Magnet-Abschnitten ersetzt eine feste Kraft −Normale·magG die
// Schwerkraft (Übergangsrampe 0,3 s), damit hält er tempounabhängig auch langsam kopfüber. Außerhalb gilt normale
// Schwerkraft (in der Luft × LUFT.faktor: flach und weit) – Abflug ist möglich.
// Fester Schritt (ZEIT.schritt = 1/240 s): bei 800 km/h < 1 m je Schritt, kein Durchrutschen.
//
// Eingabe je Schritt: { gas 0…1, lenk −1…1 (+ links), bremseL 0…1, bremseR 0…1 (Luftbremsen), nase −1…1 (+ hoch, nur in
// der Luft), rolle −1|0|1 (Barrel-Roll im Sprung = Turbo) }.
// Ereignisse (für Effekte/Ton/HUD/Action-Momente) landen in `ereignisse` und werden vom Spiel abgeholt.
import { G, GLEITER, MAGNET, BOOST, LUFT, WAND } from '../config.js';
import { v3, von, setze, dot, kreuz, norm, addSk, dreheRahmen, orthoRahmen, endlich } from '../core/vec.js';
import { neueAbfrage, padBei, F_MAGNET, F_LUECKE, F_LANDEZONE } from '../track/bahn.js';
import { clamp } from '../core/util.js';
import { GEFUEHL, klasse, bandBeschl, lenkFaktor, kurvenFaktor, Drift, miniTurbo, neustartErfuellt } from './fahrgefuehl.js';

// Schwebe-Punkte im Körper-Rahmen (vor, links, oben)
const PUNKTE = [[1.6, 1.0, -0.2], [1.6, -1.0, -0.2], [-1.6, 1.0, -0.2], [-1.6, -1.0, -0.2]];
const TRAEGHEIT = { vor: 0.6, links: 1.6, oben: 1.8 };   // je Masse (Rolle, Nicken, Gieren)
const ABSTURZ_ZEIT = 1.6;   // s bis zum Respawn

export class Gleiter {
  constructor(bahn, opt = {}) {
    this.bahn = bahn;
    this.id = opt.id || 0;
    // Gewichtsklasse (Tempo-Bänder, Stoßgewicht, Störfeld-Abzug) und ob eine KI fährt (Treffer kosten die KI mehr)
    this.klasse = opt.klasse || 'mittel';
    this.kl = klasse(this.klasse);
    this.ki = !!opt.ki;
    this.drift = new Drift();
    this.p = v3(); this.v = v3(); this.w = v3();
    this.vor = v3(0, 0, -1); this.links = v3(-1, 0, 0); this.oben = v3(0, 1, 0);
    this.q = neueAbfrage(); this.qp = [neueAbfrage(), neueAbfrage(), neueAbfrage(), neueAbfrage()];
    this.hint = 0;
    this.ereignisse = [];
    this.statistik = { abfluege: 0, sprungLandungen: 0, sprungAbstuerze: 0, wandTreffer: 0, pads: 0, ringe: 0, rollen: 0, sprunge: [],
      miniturbos: 0, driftStufen: [0, 0, 0, 0], startboost: 0, abgefangen: 0, dreher: 0, neustarts: 0, landebonus: 0 };
    this.setzeAuf(opt.s || 0, opt.u || 0, opt.v0 || 0);
  }

  // Auf die Bahn setzen (Start, Respawn): s, Querversatz u, Tempo v0 in Fahrtrichtung
  setzeAuf(s, u = 0, v0 = 0) {
    const b = this.bahn;
    this.hint = s / b.ds;
    b.punkt(s, u, GLEITER.hoehe + 0.2, this.p);
    const q = b.abfrage(this.p, this.hint, this.q);
    von(this.vor, q.T); von(this.oben, q.Us); kreuz(this.links, this.oben, this.vor);
    orthoRahmen(this.vor, this.links, this.oben);
    setze(this.v, q.T.x * v0, q.T.y * v0, q.T.z * v0);
    setze(this.w, 0, 0, 0);
    this.hint = q.i;
    this.s = q.s; this.u = q.u; this.h = q.h;
    this.boden = true; this.kontakte = 4;
    this.magnet = (q.flags & F_MAGNET) ? 1 : 0;
    this.boost = 0; this.boostZeit = 0; this.letztesPad = -1;
    this.schild = this.schild == null ? 1 : this.schild;
    this.luftZeit = 0; this.absprung = null;
    this.rolle = null;
    this.zustand = 'fahrt'; this.absturzZeit = 0;
    this.sicherS = q.s; this.sicherZeit = 0;
    this.wandKontakt = 0;
    this.zeit = this.zeit || 0;
    this.tempo = v0;
    this.ringeLetzt = q.s;
    this.drift.reset(); this.mt = 0; this.mtStufe = 0; this.mtT = 0;
    this.treff = null; this.drehWinkel = 0; this.stotter = 0; this.neustartBonus = 0; this.neustartFenster = 0;
    this.tipps = []; this.gasAlt = false; this.imRand = false; this.randImmun = this.randImmun || false;
    this.boostAbbau = 0;
  }

  get kmh() { return this.tempo * 3.6; }

  schritt(dt, ein) {
    this.zeit += dt;
    if (this.zustand === 'absturz') {
      this.absturzZeit += dt;
      if (this.absturzZeit >= ABSTURZ_ZEIT) this.respawn();
      return;
    }
    const b = this.bahn, q = b.abfrage(this.p, this.hint, this.q);
    if (!q.ok) return this.abgestuerzt('verloren');
    this.hint = q.i;
    const sAlt = this.s;
    this.s = q.s; this.u = q.u; this.h = q.h;
    const aufBahn = !(q.flags & F_LUECKE) && Math.abs(q.u) <= q.hw + 0.5;

    // --- Kräfte (Beschleunigung, Masse 1) und Drehmomente ---
    const a = _a; setze(a, 0, 0, 0);
    const tau = _tau; setze(tau, 0, 0, 0);
    const k = GLEITER.omega * GLEITER.omega / 4, c = 2 * GLEITER.zeta * GLEITER.omega / 4;
    let kontakte = 0, minH = Infinity;
    for (let n = 0; n < 4; n++) {
      const o = PUNKTE[n];
      const r = _r;
      setze(r, this.vor.x * o[0] + this.links.x * o[1] + this.oben.x * o[2],
        this.vor.y * o[0] + this.links.y * o[1] + this.oben.y * o[2],
        this.vor.z * o[0] + this.links.z * o[1] + this.oben.z * o[2]);
      setze(_pi, this.p.x + r.x, this.p.y + r.y, this.p.z + r.z);
      const qi = b.abfrage(_pi, q.i, this.qp[n]);
      if (!qi.ok) continue;
      const aufI = !(qi.flags & F_LUECKE) && Math.abs(qi.u) <= qi.hw + 0.5;
      if (!aufI || qi.h > GLEITER.reichweite || qi.h < -1.5) continue;
      kontakte++;
      minH = Math.min(minH, qi.h);
      // Geschwindigkeit des Punktes entlang der Normale
      kreuz(_vp, this.w, r);
      const vn = dot(this.v, qi.Us) + dot(_vp, qi.Us);
      const x = GLEITER.hoehe - qi.h;
      // progressive Feder (+ x³-Anteil): hält auch 10–15 g im Looping ohne Aufsetzen
      let f = k * x * (1 + 2 * Math.max(0, x / GLEITER.hoehe) ** 2) - c * vn;
      if (f < 0) f = 0;
      addSk(a, a, qi.Us, f);
      setze(_f, qi.Us.x * f, qi.Us.y * f, qi.Us.z * f);
      kreuz(_t, r, _f);
      addSk(tau, tau, _t, 1);
      // harter Aufsetzer: Lage korrigieren, Eindringgeschwindigkeit nehmen
      if (qi.h < GLEITER.minHoehe) {
        addSk(this.p, this.p, qi.Us, (GLEITER.minHoehe - qi.h) * 0.25);
        if (vn < 0) addSk(this.v, this.v, qi.Us, -vn * 0.25);
        this.reibung(dt, 2.5);
        if (vn < -6) this.ereignis('aufsetzer', clamp(-vn / 25, 0, 1));
      }
    }
    this.kontakte = kontakte;
    const amBoden = kontakte >= 2;
    const gripAnteil = Math.min(1, kontakte / 3);

    // Magnet: Ziel 1 in Magnet-Abschnitten nahe der Fahrfläche, Rampe MAGNET.rampe
    const magZiel = (q.flags & F_MAGNET) && aufBahn && q.h < MAGNET.reichweite && q.h > -2 ? 1 : 0;
    const magAlt = this.magnet;
    this.magnet = clamp(this.magnet + clamp(magZiel - this.magnet, -dt / MAGNET.rampe, dt / MAGNET.rampe), 0, 1);
    if (magAlt === 0 && this.magnet > 0 && magZiel) this.ereignis('magnet', 1);
    // Schwerkraft: Welt (in der Luft × LUFT.faktor) gemischt mit Magnet (−Normale · magG)
    const gw = G * (amBoden || kontakte > 0 ? 1 : LUFT.faktor) * (1 - this.magnet);
    a.y -= gw;
    addSk(a, a, q.Us, -MAGNET.g * G * this.magnet);

    // --- Treffer (Schlingern → Dreher), Neustart-Rhythmus, Drift ---
    const tempo = Math.sqrt(dot(this.v, this.v));
    this.tempo = tempo;
    const vmaxK = GLEITER.vmax * this.kl.top;
    let gas = clamp(ein.gas || 0, 0, 1);
    let lenk = clamp(ein.lenk || 0, -1, 1);
    let bl = clamp(ein.bremseL || 0, 0, 1), br = clamp(ein.bremseR || 0, 0, 1);
    this.neustartTakt(dt, gas);
    let steuerlos = false;
    if (this.treff) {
      const tr = this.treff; tr.t += dt;
      if (tr.phase === 'schlingern') {
        // Rettung: beide Luftbremsen ziehen („Abfangen“); Lenken, Luft oder Ablauf → Dreher
        if (bl >= 0.5 && br >= 0.5) { this.treff = null; addSk(this.v, this.v, this.v, -0.03); this.statistik.abgefangen++; this.ereignis('abgefangen', 1); }
        else if (Math.abs(lenk) > 0.5 || !amBoden || tr.t >= GEFUEHL.schlingern) { tr.phase = 'dreher'; tr.t = 0; this.statistik.dreher++; this.ereignis('dreher', tr.st); }
        else lenk = Math.sin(tr.t / GEFUEHL.schlingern * 5 * Math.PI) * 0.55 * tr.st;
      }
      if (this.treff && this.treff.phase === 'dreher') {
        steuerlos = true;
        const verlust = (this.ki ? GEFUEHL.verlustKi : GEFUEHL.verlustMensch) * GEFUEHL.treffer * tr.st;
        addSk(this.v, this.v, this.v, -(1 - Math.pow(1 - Math.min(0.95, verlust), dt / GEFUEHL.dreher)));
        this.drehWinkel += 4 * Math.PI * dt / GEFUEHL.dreher;
        if (tr.t >= GEFUEHL.dreher) { this.treff = null; this.drehWinkel = 0; this.neustartFenster = 0.6; this.ereignis('dreherEnde', 1); }
      }
    }
    if (steuerlos) { gas = 0; lenk = 0; bl = 0; br = 0; }
    const dr = this.drift.schritt(dt, { boden: amBoden, x: tempo / vmaxK, lenk, bremseL: bl, bremseR: br, magnet: this.magnet > 0.5 });
    if (dr.hupf) addSk(this.v, this.v, q.Us, Math.sqrt(2 * G * GEFUEHL.hupfHoehe));
    if (dr.neueStufe) { this.statistik.driftStufen[dr.neueStufe]++; this.ereignis('driftStufe', dr.neueStufe / 3, { stufe: dr.neueStufe }); }
    if (dr.zuLang) this.ereignis('driftWarnung', 1);
    if (dr.turbo) { this.mtStufe = dr.turbo; this.mtT = 0; this.statistik.miniturbos++; this.ereignis('miniturbo', dr.turbo / 3, { stufe: dr.turbo }); }
    if (this.mtStufe) { this.mtT += dt; this.mt = miniTurbo(this.mtStufe, this.mtT); if (this.mt < 0.002) { this.mt = 0; this.mtStufe = 0; } }

    // --- Antrieb: Beschleunigung aus Tempo-Bändern der Klasse bis zum Ziel-Höchsttempo vz; Luftwiderstand quadratisch ---
    // vz = Klassen-Höchsttempo × (1 + Boost + Mini-Turbo) × Kurven-Abzug × Störfeld-Abzug. Boost = „Sollwert sofort voll“
    // (Gas wirkt voll) und schaltet den Kurven-Abzug ab, den Störfeld-Abzug nur zur Hälfte.
    const vmax = GLEITER.vmax;
    let vz = vmaxK * (1 + this.boost + this.mt);
    if (this.boost <= 0) vz *= kurvenFaktor(lenk, dr.aktiv);
    this.imRand = aufBahn && amBoden && Math.abs(q.u) > q.hw - GEFUEHL.randBreite;
    if (this.imRand && !this.randImmun) vz *= 1 - GEFUEHL.rand * (this.kl.rand / 0.30) * (this.boost > 0 ? 0.5 : 1);
    if (this.boost > 0 && !steuerlos) gas = 1;
    if (this.stotter > 0) { this.stotter -= dt; gas *= 0.05; }
    if (this.neustartBonus > 0) this.neustartBonus -= dt;
    setze(_d, this.vor.x, this.vor.y, this.vor.z);
    if (amBoden) { addSk(_d, _d, q.Us, -dot(_d, q.Us)); norm(_d, _d); }
    const zugBei = (v) => GLEITER.schub * (v / vmax) ** 2;
    const band = bandBeschl(this.kl, tempo / vz) * (this.neustartBonus > 0 ? this.kl.neustart : 1);
    const schub = gas * (band + zugBei(Math.min(tempo, vz))) * (amBoden || kontakte ? 1 : GLEITER.luftSchub);
    addSk(a, a, _d, schub);
    if (tempo > 1e-6) {
      const zug = zugBei(tempo) + (amBoden ? GLEITER.luftbremseZug * (bl + br) * 0.5 : 0);
      addSk(a, a, this.v, -zug / tempo);
    }

    // Seitenhaftung (am Boden): Querrutschen in der Fahrfläche abbauen (im Drift deutlich weniger → Rutschen)
    if (kontakte > 0) {
      setze(_l, this.links.x, this.links.y, this.links.z);
      addSk(_l, _l, q.Us, -dot(_l, q.Us)); norm(_l, _l);
      const vq = dot(this.v, _l);
      const grip = GLEITER.grip * (dr.aktiv ? GEFUEHL.driftGrip : 1) * (steuerlos ? 0.3 : 1);
      addSk(a, a, _l, -vq * grip * gripAnteil * (1 + 0.4 * (bl + br)));
    }

    // --- Drehung ---
    const kappe = Math.min(GLEITER.gierMax, GLEITER.querMax / Math.max(tempo, 1)) * lenkFaktor(tempo / vmaxK);
    const innen = lenk > 0 ? bl : lenk < 0 ? br : 0;
    let gierZiel = (lenk + 0.35 * (bl - br)) * kappe * (1 + GLEITER.luftbremseGier * innen);
    if (!amBoden) gierZiel *= GLEITER.luftGier;
    // Drehmomente der Federn in Körper-Winkelbeschleunigung umrechnen
    const tv = dot(tau, this.vor) / TRAEGHEIT.vor, tl = dot(tau, this.links) / TRAEGHEIT.links, to = dot(tau, this.oben) / TRAEGHEIT.oben;
    addSk(this.w, this.w, this.vor, tv * dt);
    addSk(this.w, this.w, this.links, tl * dt);
    addSk(this.w, this.w, this.oben, to * dt);
    // Gieren: Winkelgeschwindigkeit um die eigene Hochachse zum Ziel führen
    const wo = dot(this.w, this.oben);
    addSk(this.w, this.w, this.oben, (gierZiel - wo) * Math.min(1, 14 * dt));
    if (amBoden) {
      // Nicken/Rollen: Federn richten aus; Restdämpfung + sanftes Ausrichten an der Fahrflächen-Normale
      const wv = dot(this.w, this.vor), wl = dot(this.w, this.links);
      addSk(this.w, this.w, this.vor, -wv * Math.min(1, 3 * dt));
      addSk(this.w, this.w, this.links, -wl * Math.min(1, 3 * dt));
      kreuz(_t, this.oben, q.Us);
      addSk(this.w, this.w, _t, 6 * dt);
      if (this.rolle) this.rolleAbbrechen();
    } else {
      this.luftDrehung(dt, ein, q, aufBahn);
    }

    // --- Integration (semi-implizit) ---
    addSk(this.v, this.v, a, dt);
    addSk(this.p, this.p, this.v, dt);
    dreheRahmen(this.vor, this.links, this.oben, this.w.x * dt, this.w.y * dt, this.w.z * dt);
    if (!endlich(this.p) || !endlich(this.v)) return this.abgestuerzt('zahl');

    // --- Wand, Pads, Ringe, Boost-Abbau ---
    this.wand(dt, q);
    if ((amBoden || q.h < 3) && aufBahn) {
      const kp = padBei(b, q.s, q.u);
      if (kp >= 0 && kp !== this.letztesPad) {
        this.padBoost();
        this.statistik.pads++;
        this.ereignis('pad', this.boost / BOOST.deckel);
      }
      this.letztesPad = kp;
    }
    this.ringe(sAlt, q);
    // Boost: volle Dauer, dann Abklingen in BOOST.abklingen
    if (this.boostZeit > 0) { this.boostZeit -= dt; if (this.boostZeit <= 0) this.boostAbbau = this.boost / BOOST.abklingen; }
    else if (this.boost > 0) this.boost = Math.max(0, this.boost - dt * Math.max(this.boostAbbau, 0.5));

    // --- Boden/Luft-Buchhaltung, Sprünge, Absturz ---
    if (amBoden) {
      if (this.luftZeit > 0.4) this.gelandet(q);
      this.luftZeit = 0; this.absprung = null;
      if (aufBahn) { this.sicherZeit += dt; if (this.sicherZeit > 0.5) this.sicherS = q.s; }
    } else {
      if (this.luftZeit === 0) this.absprung = { s: q.s, x: this.p.x, y: this.p.y, z: this.p.z, v: tempo, t: this.zeit };
      if (this.luftZeit < 0.05 && this.absprung && this.luftZeit + dt >= 0.05 && (b.flags[Math.floor(q.i)] & 0x20 || q.flags & F_LUECKE)) {
        this.ereignis('absprung', clamp(tempo / (vmax * 1.6), 0, 1));
      }
      this.luftZeit += dt;
      this.sicherZeit = 0;
      // Abflug-Erkennung: unter der Fahrbahn, zu tief in der Schlucht, zu weit weg oder zu lange in der Luft
      const unter = aufBahn && q.h < -4;
      const schlucht = (q.flags & F_LUECKE) && q.h < -14;
      const weg = Math.abs(q.u) > q.hw + 45 || q.h > ((q.flags & (F_LUECKE | F_LANDEZONE)) ? 160 : 70);
      if (unter || schlucht || weg || this.luftZeit > 12) return this.abgestuerzt(unter ? 'unter' : schlucht ? 'schlucht' : weg ? 'weg' : 'luft');
    }
    this.boden = amBoden;
  }

  // Luft: Nase heben/senken, leichtes Lenken (oben), Barrel-Roll, sanftes Aufrichten zur Bahn
  luftDrehung(dt, ein, q, aufBahn) {
    const wl = dot(this.w, this.links), wv = dot(this.w, this.vor);
    const nase = clamp(ein.nase || 0, -1, 1);
    // Nase hoch = negative Drehung um links
    let nickZiel = -nase * GLEITER.luftNase;
    if (Math.abs(nase) < 0.05) {
      // Wetterfahne: Nase folgt langsam der Flugbahn (sieht natürlich aus, landet sauber)
      const t = this.tempo || 1;
      const steig = clamp(dot(this.v, this.oben) / t, -1, 1);
      nickZiel = steig * 1.2;   // Flugbahn zeigt „über“ die Nase → Nase heben (negativ um links)
      nickZiel = -nickZiel;
    }
    addSk(this.w, this.w, this.links, (nickZiel - wl) * Math.min(1, 8 * dt));
    // Auftrieb: Nase über der Flugbahn → flacher und weiter
    const t = this.tempo || 1;
    const anstell = clamp(-dot(this.v, this.oben) / t, -0.4, 0.4);   // Bahn unter der Nase = positiver Anstellwinkel
    if (anstell > 0) addSk(this.v, this.v, this.oben, GLEITER.luftAuftrieb * t * anstell * dt);
    // Barrel-Roll
    // nur auf neuen Tastendruck (Flanke), sonst rollte gehaltene Taste endlos
    const neu = ein.rolle && !this.rolleTaste;
    this.rolleTaste = !!ein.rolle;
    if (!this.rolle && neu && this.luftZeit > 0.15) this.rolle = { richt: Math.sign(ein.rolle), winkel: 0 };
    if (this.rolle) {
      const rate = 2 * Math.PI / GLEITER.rolleDauer;
      addSk(this.w, this.w, this.vor, (this.rolle.richt * rate - wv));
      this.rolle.winkel += rate * dt;
      if (this.rolle.winkel >= 2 * Math.PI) {
        this.rolle = null;
        addSk(this.w, this.w, this.vor, -dot(this.w, this.vor));
        this.boost = Math.min(BOOST.deckel, this.boost + BOOST.rolle);
        this.boostZeit = Math.max(this.boostZeit, BOOST.dauer);
        this.statistik.rollen++;
        this.ereignis('rolle', 1);
      }
    } else {
      // Rollen zur Bahn-Normale ausrichten (Landung aufrecht)
      const ziel = q.Us;
      const fehl = dot(kreuz(_t, this.oben, ziel), this.vor);
      addSk(this.w, this.w, this.vor, (fehl * 2.5 - wv) * Math.min(1, 4 * dt));
    }
    void aufBahn;
  }

  rolleAbbrechen() {
    // Landung mitten in der Rolle: Patzer (Tempo weg), kein Turbo
    this.rolle = null;
    addSk(this.v, this.v, this.v, -0.3);
    this.ereignis('patzer', 1);
  }

  gelandet(q) {
    const sp = this.absprung;
    this.statistik.sprungLandungen += sp && this.luftZeit > 1.5 ? 1 : 0;
    const weite = sp ? Math.hypot(this.p.x - sp.x, this.p.z - sp.z, this.p.y - sp.y) : 0;
    if (sp && this.luftZeit > 1.5) this.statistik.sprunge.push({ s: sp.s, luft: this.luftZeit, weite, v: sp.v, landeS: q.s });
    // Landung in der markierten Landezone nach einem Riesensprung = Tempo-Bonus (statt Lande-Malus)
    if (sp && this.luftZeit > 1.5 && (q.flags & F_LANDEZONE) && GEFUEHL.landebonus > 0) {
      addSk(this.v, this.v, this.v, GEFUEHL.landebonus); this.statistik.landebonus++;
    }
    this.ereignis('landung', clamp(this.luftZeit / 5, 0, 1), { luft: this.luftZeit, weite, landezone: !!(q.flags & F_LANDEZONE) });
  }

  wand(dt, q) {
    const rand = q.hw - GLEITER.breite / 2;
    if (q.flags & F_LUECKE || q.h > WAND.hoehe || q.h < -2 || Math.abs(q.u) <= rand) { this.wandKontakt = 0; return; }
    const sgn = Math.sign(q.u);
    setze(_n, -q.Ls.x * sgn, -q.Ls.y * sgn, -q.Ls.z * sgn);   // nach innen
    addSk(this.p, this.p, _n, Math.abs(q.u) - rand);
    const vn = dot(this.v, _n);
    if (vn < 0) {
      const vi = -vn;
      addSk(this.v, this.v, _n, vi * (1 + WAND.abprall));
      const anteil = clamp(vi / 25, 0, 1);
      addSk(this.v, this.v, this.v, -WAND.verlust * anteil);
      this.schild = Math.max(0, this.schild - WAND.schild * clamp(vi / 20, 0.15, 1.5));
      if (this.wandKontakt === 0 || vi > 4) { this.statistik.wandTreffer++; this.ereignis('wand', anteil, { seite: sgn }); }
      if (vi > 3) this.drift.abbrechen();
      // Nase von der Wand weg drehen
      addSk(this.w, this.w, this.oben, -sgn * 0.8 * anteil);
    }
    this.reibung(dt, 0.6);
    this.wandKontakt += dt;
  }

  ringe(sAlt, q) {
    const b = this.bahn;
    if (!b.ringe.length) return;
    let s0 = sAlt, s1 = q.s;
    if (s1 < s0 - b.L / 2) s1 += b.L;   // Rundenwechsel
    if (s1 <= s0 || s1 - s0 > 20) return;
    for (const r of b.ringe) {
      const rs = r.s < s0 ? r.s + b.L : r.s;
      if (rs > s0 && rs <= s1 && Math.hypot(q.u, q.h - r.h) < r.r) {
        this.boost = Math.min(BOOST.deckel, this.boost + BOOST.ring);
        this.boostZeit = Math.max(this.boostZeit, BOOST.dauer);
        this.statistik.ringe++;
        this.ereignis('ring', 1);
      }
    }
  }

  // Boost-Pad / Start-Boost / Item (Phase 2): stapelt bis BOOST.deckel, volle Dauer neu
  padBoost(gewinn = BOOST.gewinn) {
    this.boost = Math.min(BOOST.deckel, this.boost + gewinn);
    this.boostZeit = BOOST.dauer;
  }

  // Treffer (Phase 2: Waffen; P1: Schnittstelle + Test). staerke 0…1
  treffer(staerke = 1) {
    if (this.treff || this.zustand !== 'fahrt') return;
    this.treff = { phase: 'schlingern', t: 0, st: clamp(staerke, 0, 1) };
    this.drift.abbrechen();
    this.ereignis('treffer', staerke);
  }

  // Neustart-Rhythmus: Gas-Tipper (steigende Flanken) während des Drehers bzw. kurz danach / nach dem Respawn zählen
  neustartTakt(dt, gas) {
    const an = gas > 0.5;
    const offen = (this.treff && this.treff.phase === 'dreher') || this.neustartFenster > 0;
    if (this.neustartFenster > 0) this.neustartFenster -= dt;
    if (an && !this.gasAlt && offen) {
      this.tipps.push(this.zeit);
      if (this.tipps.length > 8) this.tipps.shift();
      if (neustartErfuellt(this.tipps)) {
        this.neustartBonus = GEFUEHL.neustartDauer; this.tipps.length = 0; this.statistik.neustarts++;
        this.ereignis('neustart', 1);
      }
    }
    if (!offen) this.tipps.length = 0;
    this.gasAlt = an;
  }

  reibung(dt, k) { addSk(this.v, this.v, this.v, -Math.min(0.5, k * dt)); }

  ereignis(art, staerke, extra) {
    if (this.ereignisse.length < 64) this.ereignisse.push({ art, staerke, t: this.zeit, s: this.s, ...(extra || {}) });
  }

  abgestuerzt(grund) {
    if (this.zustand === 'absturz') return;
    this.zustand = 'absturz';
    this.absturzZeit = 0;
    this.absturzGrund = grund;
    this.statistik.abfluege++;
    if (this.absprung) this.statistik.sprungAbstuerze++;
    this.ereignis('absturz', 1, { grund });
  }

  // Respawn: nach einem Sprung-Absturz hinter der Lücke (Landezone), sonst an der letzten sicheren Stelle
  respawn() {
    const b = this.bahn;
    let s = this.sicherS;
    if (this.absprung) {
      // Ende der Lücke suchen
      let i = Math.floor(this.absprung.s / b.ds), n = 0;
      while (n < 1000 && !(b.flags[i % b.N] & F_LUECKE)) { i++; n++; }
      while (n < 2000 && (b.flags[i % b.N] & F_LUECKE)) { i++; n++; }
      s = ((i % b.N) * b.ds) + 30;
    }
    this.setzeAuf(s, 0, GLEITER.vmax * 0.45);
    this.respawns = (this.respawns || 0) + 1;
    this.neustartFenster = 1.5;   // Neustart-Rhythmus auch nach einem Abflug
    this.ereignis('respawn', 1);
  }
}

const _a = v3(), _tau = v3(), _r = v3(), _pi = v3(), _vp = v3(), _f = v3(), _t = v3(), _d = v3(), _l = v3(), _n = v3();
