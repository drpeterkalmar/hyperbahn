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
import { G, GLEITER, MAGNET, BOOST, LUFT, WAND, NASE, VORLAGE } from '../config.js';
import { v3, von, setze, dot, kreuz, norm, addSk, dreheRahmen, orthoRahmen, endlich } from '../core/vec.js';
import { neueAbfrage, padBei, F_MAGNET, F_LUECKE, F_LANDEZONE } from '../track/bahn.js';
import { clamp, smoothstep } from '../core/util.js';

const RAD = Math.PI / 180;
import { GEFUEHL, klasse, bandBeschl, lenkFaktor, kurvenFaktor, Drift, miniTurbo, neustartErfuellt } from './fahrgefuehl.js';

// Schwebe-Punkte im Körper-Rahmen (vor, links, oben)
const PUNKTE = [[1.6, 1.0, -0.2], [1.6, -1.0, -0.2], [-1.6, 1.0, -0.2], [-1.6, -1.0, -0.2]];
const TRAEGHEIT = { vor: 0.6, links: 1.6, oben: 1.8 };   // je Masse (Rolle, Nicken, Gieren)
const ABSTURZ_ZEIT = 1.6;   // s bis zum Respawn (bis 0.1.4; jetzt VORLAGE.bergung.zeit, ?bergung=0 = alt)
const bergungZeit = () => (VORLAGE.bergung.zeit > 0 ? VORLAGE.bergung.zeit : ABSTURZ_ZEIT);
export const RESET_SPERRE = 1.0;   // s Doppelklick-Schutz des Reset-Knopfs

export class Gleiter {
  constructor(bahn, opt = {}) {
    this.bahn = bahn;
    this.id = opt.id || 0;
    // Gewichtsklasse (Tempo-Bänder, Stoßgewicht, Störfeld-Abzug) und ob eine KI fährt (Treffer kosten die KI mehr)
    this.klasse = opt.klasse || 'mittel';
    this.kl = klasse(this.klasse);
    this.ki = !!opt.ki;
    this.drift = new Drift();
    // weicher Stoß (game/rennen.js) und Reset: Felder von Anfang an anlegen – nachträglich angehängte Felder ändern die
    // Objektform mitten im Rennen und bremsen die JS-Engine (p1c-Messung: +50 % Rechenzeit in Gleiter.schritt)
    this.stossRest = v3(); this.stossN = 0; this.resetZeit = -Infinity; this.respawns = 0;
    this.p = v3(); this.v = v3(); this.w = v3();
    this.vor = v3(0, 0, -1); this.links = v3(-1, 0, 0); this.oben = v3(0, 1, 0);
    this.q = neueAbfrage(); this.qp = [neueAbfrage(), neueAbfrage(), neueAbfrage(), neueAbfrage()];
    this.hint = 0;
    this.ereignisse = [];
    this.statistik = { abfluege: 0, sprungLandungen: 0, sprungAbstuerze: 0, wandTreffer: 0, pads: 0, ringe: 0, rollen: 0, sprunge: [],
      miniturbos: 0, driftStufen: [0, 0, 0, 0], startboost: 0, abgefangen: 0, dreher: 0, neustarts: 0, landebonus: 0, resets: 0, hartLandungen: 0 };
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
    this.blW = 0; this.brW = 0;   // Luftbremsen-Wirkung (baut sich in VORLAGE.bremse.aufbau s auf)
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
    this.wandKontakt = 0; this.wandZeit = -Infinity;
    this.zeit = this.zeit || 0;
    this.tempo = v0;
    this.ringeLetzt = q.s;
    this.drift.reset(); this.mt = 0; this.mtStufe = 0; this.mtT = 0;
    this.treff = null; this.drehWinkel = 0; this.stotter = 0; this.neustartBonus = 0; this.neustartFenster = 0;
    this.tipps = []; this.gasAlt = false; this.imRand = false; this.randImmun = this.randImmun || false;
    this.boostAbbau = 0;
    this.landeW = 0;
  }

  get kmh() { return this.tempo * 3.6; }

  schritt(dt, ein) {
    this.zeit += dt;
    if (this.zustand === 'absturz') {
      this.absturzZeit += dt;
      if (this.absturzZeit >= bergungZeit()) this.respawn();
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
    // 1/h-Feder (Vorlage): je Punkt kS·(soll/h − 1); kS so, dass die Ruhelage unter 1 g bei GLEITER.hoehe liegt
    const VS = VORLAGE.schwebe, hartUnter = VS.an ? VS.min : GLEITER.minHoehe;
    const kS = (G / 4) / (VS.soll / GLEITER.hoehe - 1);
    const cS = 2 * VS.zeta * Math.sqrt(4 * kS * VS.soll / (GLEITER.hoehe * GLEITER.hoehe)) / 4;
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
      // Dämpfung der 1/h-Feder erst im Federweg (über `soll` kein Luftkissen), weich eingeblendet bis zur Ruhelage
      let f = VS.an ? kS * (VS.soll / Math.max(qi.h, VS.min) - 1) - cS * vn * clamp((VS.soll - qi.h) / (VS.soll - GLEITER.hoehe), 0, 1)
        : k * x * (1 + 2 * Math.max(0, x / GLEITER.hoehe) ** 2) - c * vn;
      if (f < 0) f = 0;
      addSk(a, a, qi.Us, f);
      setze(_f, qi.Us.x * f, qi.Us.y * f, qi.Us.z * f);
      kreuz(_t, r, _f);
      addSk(tau, tau, _t, 1);
      // harter Aufsetzer: Lage korrigieren, Eindringgeschwindigkeit nehmen
      if (qi.h < hartUnter) {
        addSk(this.p, this.p, qi.Us, (hartUnter - qi.h) * 0.25);
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
    // Luftbremsen-Wirkung (Vorlage): baut sich in VB.aufbau s auf und ab; im Drift wirkt sie sofort (Pump-Rhythmus des
    // Mini-Turbos, Drift-Werte aus fahrgefuehl.js bleiben)
    const VB = VORLAGE.bremse;
    if (VB.an && !dr.aktiv) {
      const r = dt / VB.aufbau;
      this.blW += clamp(bl - this.blW, -r, r); this.brW += clamp(br - this.brW, -r, r);
    } else { this.blW = bl; this.brW = br; }
    // Hüpfer beim Drift-Einstieg – mit 1/h-Feder nur aus der Ruhelage (sonst stapeln sich Hüpfer bei schnellem Neu-Ziehen,
    // weil oberhalb `soll` keine Feder mehr bremst)
    if (dr.hupf && (!VS.an || (minH < VS.soll + 0.1 && dot(this.v, q.Us) < 0.5))) addSk(this.v, this.v, q.Us, Math.sqrt(2 * G * GEFUEHL.hupfHoehe));
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
    // Landehilfe richtet nur die Lage aus: Schub dann entlang der Flugbahn statt der Nase (Sprungweite bleibt wie ohne)
    else if (this.landeW > 0 && tempo > 1) { addSk(_d, _d, _d, -this.landeW); addSk(_d, _d, this.v, this.landeW / tempo); norm(_d, _d); }
    const zugBei = (v) => GLEITER.schub * (v / vmax) ** 2;
    const band = bandBeschl(this.kl, tempo / vz) * (this.neustartBonus > 0 ? this.kl.neustart : 1);
    const schub = gas * (band + zugBei(Math.min(tempo, vz))) * (amBoden || kontakte ? 1 : GLEITER.luftSchub);
    addSk(a, a, _d, schub);
    if (tempo > 1e-6) {
      // Luftbremsen-Widerstand: im Drift wie bisher (Drift = Rutschen, nicht Bremsen); sonst Vorlage: eine ≈ 80 %, beide ≈ 45 %
      const eine = Math.max(this.blW, this.brW), beide = Math.min(this.blW, this.brW);
      const bremsZug = !amBoden ? 0 : (dr.aktiv || !VB.an) ? GLEITER.luftbremseZug * (this.blW + this.brW) * 0.5 * (dr.aktiv ? GEFUEHL.driftZug : 1)
        : VB.zug * (eine - beide) + VB.zugBeide * beide;
      const zug = zugBei(tempo) + bremsZug;
      addSk(a, a, this.v, -zug / tempo);
    }

    // Seitenhaftung (am Boden): Querrutschen in der Fahrfläche abbauen (im Drift deutlich weniger → Rutschen)
    if (kontakte > 0) {
      setze(_l, this.links.x, this.links.y, this.links.z);
      addSk(_l, _l, q.Us, -dot(_l, q.Us)); norm(_l, _l);
      const vq = dot(this.v, _l);
      const grip = GLEITER.grip * (dr.aktiv ? (VB.an ? VB.driftGrip : GEFUEHL.driftGrip) : 1) * (steuerlos ? 0.3 : 1);
      // Gleiten (Vorlage): ohne Drift richtet sich die Bahn mit gezogener Luftbremse langsamer aus (Zeitkonstante VB.rutsch s)
      const bw = Math.max(this.blW, this.brW);
      const gripB = VB.an && !dr.aktiv ? grip + (1 / VB.rutsch - grip) * bw : grip * (1 + 0.4 * (this.blW + this.brW));
      addSk(a, a, _l, -vq * gripB * gripAnteil);
    }

    // --- Drehung ---
    const kappe = Math.min(GLEITER.gierMax, GLEITER.querMax / Math.max(tempo, 1)) * lenkFaktor(tempo / vmaxK);
    const innen = lenk > 0 ? bl : lenk < 0 ? br : 0;
    const innenW = lenk > 0 ? this.blW : lenk < 0 ? this.brW : 0;
    let gierZiel = (lenk + 0.35 * (this.blW - this.brW)) * kappe * (1 + GLEITER.luftbremseGier * innenW);
    void innen;
    if (!amBoden) gierZiel *= GLEITER.luftGier;
    // Drehmomente der Federn in Körper-Winkelbeschleunigung umrechnen
    const tv = dot(tau, this.vor) / TRAEGHEIT.vor, tl = dot(tau, this.links) / TRAEGHEIT.links, to = dot(tau, this.oben) / TRAEGHEIT.oben;
    addSk(this.w, this.w, this.vor, tv * dt);
    addSk(this.w, this.w, this.links, tl * dt);
    addSk(this.w, this.w, this.oben, to * dt);
    // Gieren: Winkelgeschwindigkeit um die eigene Hochachse zum Ziel führen
    const wo = dot(this.w, this.oben);
    let dGier = (gierZiel - wo) * Math.min(1, 14 * dt);
    const VG = VORLAGE.gier;
    if (VG.an) {
      // Gier-Beschleunigung begrenzt; Gegenlenken (Ziel gegen die laufende Drehung) baut doppelt so schnell um
      gierZiel = clamp(gierZiel, -VG.max, VG.max);
      dGier = (gierZiel - wo) * Math.min(1, 14 * dt);
      const gegen = wo * gierZiel < 0 || (Math.abs(gierZiel) < Math.abs(wo) && Math.abs(lenk) > 0.05);
      const m = VG.beschl * (gegen ? VG.gegen : 1) * dt;
      dGier = clamp(dGier, -m, m);
    }
    addSk(this.w, this.w, this.oben, dGier);
    if (amBoden) {
      // Nicken/Rollen: Federn richten aus; Restdämpfung + sanftes Ausrichten an der Fahrflächen-Normale
      const wv = dot(this.w, this.vor), wl = dot(this.w, this.links);
      addSk(this.w, this.w, this.vor, -wv * Math.min(1, 3 * dt));
      addSk(this.w, this.w, this.links, -wl * Math.min(1, 3 * dt));
      kreuz(_t, this.oben, q.Us);
      addSk(this.w, this.w, _t, 6 * dt);
      if (this.rolle) this.rolleAbbrechen();
      this.landeW = 0;
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
    } else if (NASE.modus !== 'alt') {
      // Hülle (P1b): Nase höchstens NASE.unten° unter / NASE.oben° über der Flugbahn – weich, nie Sturzflug
      const nick = Math.asin(clamp(-dot(this.v, this.oben) / (this.tempo || 1), -1, 1));   // + = Nase über der Flugbahn
      // über einer Sprung-Lücke kein Nase-Senken, sobald die Wurfparabel den Anfang der Landezone nicht mehr mit `reserve` m
      // erreicht (nie in die Schlucht drücken); hoch oben kein Steigen mehr (Decke: sonst segelt er über die Landezone hinaus)
      const unten = (q.flags & F_LUECKE) && this.reicht(q) < NASE.reserve ? 0 : NASE.unten;
      const oben = NASE.oben * (1 - smoothstep(NASE.decke[0], NASE.decke[1], q.h));
      const hoch = clamp(-nickZiel, NASE.rate * (-unten * RAD - nick), NASE.rate * (oben * RAD - nick));
      nickZiel = -hoch;
    }
    // Landehilfe (P1b): kurz vor dem Aufsetzen Nase zur Fahrfläche (Zeit bis zum Kontakt aus Höhe und Sinkrate)
    this.landeW = 0;
    if (NASE.modus !== 'alt' && q.h > -1) {
      const sink = -dot(this.v, q.Us);
      const tk = sink > 0.5 ? Math.max(0, q.h - GLEITER.hoehe) / sink : Infinity;
      if (tk < NASE.landeZeit) {
        const w = 1 - smoothstep(NASE.landeVoll, NASE.landeZeit, tk);
        const neig = Math.asin(clamp(dot(this.vor, q.Us), -1, 1));   // + = Nase von der Fläche weg
        const ziel = -NASE.landeRate * (NASE.landeZiel * RAD - neig);
        nickZiel += (ziel - nickZiel) * w;
        this.landeW = w;
      }
    }
    addSk(this.w, this.w, this.links, (nickZiel - wl) * Math.min(1, 8 * dt));
    // Auftrieb: Nase über der Flugbahn → flacher und weiter
    const t = this.tempo || 1;
    const anstell = clamp(-dot(this.v, this.oben) / t, -0.4, 0.4);   // Bahn unter der Nase = positiver Anstellwinkel
    if (anstell > 0) addSk(this.v, this.v, this.oben, GLEITER.luftAuftrieb * t * anstell * dt * (1 - this.landeW));
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

  // Wurfparabel bis zum Ende der Sprung-Lücke unter dem Gleiter: Höhenreserve (m) über der Landezone (Schwerkraft wie in
  // der Luft, ohne Schub und Auftrieb). Negativ = fällt in die Schlucht.
  reicht(q) {
    const b = this.bahn, ende = lueckenEnde(b)[Math.floor(q.i) % b.N];
    if (ende < 0) return Infinity;
    const E = b.punkt(ende * b.ds, q.u, GLEITER.hoehe, _e);
    const dx = E.x - this.p.x, dz = E.z - this.p.z, d = Math.hypot(dx, dz);
    const vh = (this.v.x * dx + this.v.z * dz) / Math.max(d, 1e-6);
    if (vh < 1) return -Infinity;
    const t = d / vh;
    return this.p.y + this.v.y * t - 0.5 * G * LUFT.faktor * t * t - E.y;
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
    // Landungs-Nicken (Vorlage): Nase mehr als VORLAGE.nicken.grad° gegen die Fahrfläche = harte Landung (Tempo, Funken)
    const VN = VORLAGE.nicken;
    if (VN.an && Math.abs(Math.asin(clamp(dot(this.vor, q.Us), -1, 1))) > VN.grad * RAD) {
      addSk(this.v, this.v, this.v, -VN.verlust); this.statistik.hartLandungen++;
      this.ereignis('aufsetzer', 1); this.ereignis('hartLandung', 1);
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
      // neuer Einschlag: erster Kontakt bzw. kräftig (> 4 m/s); mit Vorlage-Wand höchstens einer je VW.sperre s (Nachstöße
      // desselben Einschlags – Nase zeigt noch zur Wand – kosten nicht noch einmal)
      const VW = VORLAGE.wand, neu = (this.wandKontakt === 0 || vi > 4) && (!VW.an || this.zeit - this.wandZeit > VW.sperre);
      if (neu) this.wandZeit = this.zeit;
      const v0 = this.tempo || Math.sqrt(dot(this.v, this.v));
      addSk(this.v, this.v, _n, vi * (1 + WAND.abprall));
      const anteil = clamp(vi / 25, 0, 1);
      if (VW.an) {
        // Vorlage: nur echte Einschläge kosten – Tempo −10…−30 % je Aufprallwinkel (gesamt, inkl. Abprall), Energie ∝ Quertempo
        if (neu) {
          const winkel = Math.asin(clamp(vi / Math.max(v0, 1), 0, 1)) / RAD;
          const verlust = winkel < VW.w0 ? VW.v0 * winkel / VW.w0 : VW.v0 + (VW.v1 - VW.v0) * clamp((winkel - VW.w0) / (VW.w1 - VW.w0), 0, 1);
          const vn2 = Math.sqrt(dot(this.v, this.v)) || 1;
          addSk(this.v, this.v, this.v, v0 * (1 - verlust) / vn2 - 1);
          this.schild = Math.max(0, this.schild - Math.max(VW.min, VW.energie * vi));
          // Abgleiten: Nase parallel zur Wand drehen (leicht weg), sonst zöge die Seitenhaftung ihn gleich wieder hinein
          const zurWand = -dot(this.vor, _n);
          if (zurWand > 0) {
            kreuz(_t, this.vor, _n); norm(_t, _t);
            const w = Math.asin(clamp(zurWand, 0, 1)) + VW.weg * RAD;
            dreheRahmen(this.vor, this.links, this.oben, _t.x * w, _t.y * w, _t.z * w);
          }
        }
      } else {
        addSk(this.v, this.v, this.v, -WAND.verlust * anteil);
        this.schild = Math.max(0, this.schild - WAND.schild * clamp(vi / 20, 0.15, 1.5));
      }
      if (neu) { this.statistik.wandTreffer++; this.ereignis('wand', anteil, { seite: sgn }); }
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

  // 1-Klick-Reset (p1c, Peter 22.10.): sofort mittig an die letzte sichere Stelle (sicherS: zuletzt ≥ 0,5 s am Boden auf
  // der Bahn – nie vor der aktuellen Stelle), ausgerichtet, mit angemessenem Schwung (Tempo bleibt, aber 45–70 %
  // Höchsttempo; vMin z. B. Sprung-Mindesttempo, falls ein Absprung kurz bevorsteht). Kein Abkürzen:
  //  • im Flug über einer Sprung-Lücke kein Reset (sonst Teleport über die Schlucht), erst wenn der Gleiter unter die
  //    Lücken-Bahn gefallen ist – dann zählt er als Absturz (normaler Respawn hinter der Lücke nach ABSTURZ_ZEIT)
  //  • schon abgestürzt: Respawn sofort (gleiches Ziel wie ohnehin)
  //  • respawns zählt hoch → das Rennen bucht den Rücksprung als negativen Fortschritt (Rundenzählung bleibt ehrlich)
  //  • Doppelklick-Schutz: höchstens ein Reset je RESET_SPERRE s
  // Rückgabe: 'reset' | 'respawn' | 'absturz' | 'sprung' (abgelehnt) | 'sperre' (abgelehnt)
  zuruecksetzen(vMin = 0) {
    if (this.zeit - (this.resetZeit ?? -Infinity) < RESET_SPERRE) return 'sperre';
    if (this.zustand === 'absturz') { this.resetZeit = this.zeit; this.respawn(); return 'respawn'; }
    const ueberLuecke = this.absprung && !this.boden && (this.q.flags & F_LUECKE);
    if (ueberLuecke && this.h > -2) return 'sprung';
    this.resetZeit = this.zeit;
    if (ueberLuecke) { this.abgestuerzt('reset'); return 'absturz'; }
    const vmax = GLEITER.vmax * this.kl.top;
    const v = Math.max(clamp(this.tempo, 0.45 * vmax, 0.7 * vmax), Math.min(vMin, vmax));
    const schild = this.schild;
    this.setzeAuf(this.sicherS, 0, v);
    this.schild = schild;
    this.respawns = (this.respawns || 0) + 1;
    this.statistik.resets = (this.statistik.resets || 0) + 1;
    this.neustartFenster = 1.5;
    this.ereignis('reset', 1);
    return 'reset';
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
    this.setzeAuf(s, 0, GLEITER.vmax * (VORLAGE.bergung.zeit > 0 ? VORLAGE.bergung.tempo : 0.45));
    this.respawns = (this.respawns || 0) + 1;
    this.neustartFenster = 1.5;   // Neustart-Rhythmus auch nach einem Abflug
    this.ereignis('respawn', 1);
  }
}

// je Stützstelle in einer Sprung-Lücke: erste Stützstelle dahinter (sonst −1), einmal je Bahn
function lueckenEnde(b) {
  if (b._lueckenEnde) return b._lueckenEnde;
  const N = b.N, e = new Int32Array(N).fill(-1);
  for (let n = 2 * N - 1, nach = -1; n >= 0; n--) {
    const i = n % N;
    if (b.flags[i] & F_LUECKE) e[i] = nach; else nach = i;
  }
  b._lueckenEnde = e;
  return e;
}

const _e = v3(), _a = v3(), _tau = v3(), _r = v3(), _pi = v3(), _vp = v3(), _f = v3(), _t = v3(), _d = v3(), _l = v3(), _n = v3();
