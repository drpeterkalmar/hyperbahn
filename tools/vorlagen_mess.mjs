// Messgrößen aus dem Vorlagen-Datenblatt (Abschnitt 5) als Tabelle „Ziel / gemessen“ – Node, ohne Browser.
// Aufruf: node tools/vorlagen_mess.mjs [url-regler] [--nur 1,2,3]     z. B. "?schwebe=0&bremse=0" für den Vorher-Stand
// Jede Messung baut ihre eigene kleine Teststrecke (gerade, breit) bzw. nutzt Strecke 1.
import { leseRegler, GLEITER, ZEIT, G, BOOST } from '../src/config.js';
import { leseGefuehl } from '../src/physics/fahrgefuehl.js';
import { baueBahn } from '../src/track/bahn.js';
import { strecke1, SPRUNG_MINDEST } from '../src/track/strecke1.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { kiRennen } from './ki_rennen.mjs';
import { bauePlan, Pilot, PROFILE } from '../src/ai/pilot.js';
import { Rennen, TEAMS } from '../src/game/rennen.js';
import { gVignetteDeckkraft } from '../src/game/gvignette.js';

const dt = ZEIT.schritt;
const RAD = 180 / Math.PI;
const AUS = { gas: 0, lenk: 0, bremseL: 0, bremseR: 0, nase: 0, rolle: 0 };
const ebene = (breite = 13, len = 4000) => baueBahn([{ typ: 'gerade', len, breite }], { ohneSchluss: true });
const PUNKT_TIEFE = 0.2;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const fahre = (g, sek, ein) => { const n = Math.round(sek / dt); for (let i = 0; i < n; i++) g.schritt(dt, typeof ein === 'function' ? ein(g, i * dt) : ein); };

// 1) Schwebe-Ruhelage und Federweg nach Landung aus 10 m
export function m1() {
  const b = ebene();
  const g = new Gleiter(b, { s: 100, v0: 0 });
  fahre(g, 3, AUS);
  let hSum = 0, n = 0; fahre(g, 1, (gg) => { hSum += gg.h; n++; return AUS; });
  const ruhe = hSum / n - PUNKT_TIEFE;   // Höhe der Schwebe-Punkte (0,2 m unter der Gleiter-Mitte)
  // aus 10 m Höhe fallen lassen (Luft-Schwerkraft wie im Spiel), mit 40 m/s vorwärts
  const g2 = new Gleiter(b, { s: 100, v0: 40 });
  g2.p.y += 10;
  let hMin = 99, tLand = -1, tRuhig = -1, durch = 0, t = 0;
  for (let i = 0; i < 6 / dt; i++) {
    g2.schritt(dt, { ...AUS, gas: 0.4 });
    t += dt;
    for (const e of g2.ereignisse) if (e.art === 'aufsetzer') durch++;
    g2.ereignisse.length = 0;
    if (tLand < 0 && g2.h - PUNKT_TIEFE < GLEITER.hoehe + 0.3) tLand = t;
    const hp = g2.h - PUNKT_TIEFE;
    if (tLand >= 0) { hMin = Math.min(hMin, hp); if (Math.abs(hp - ruhe) > 0.05) tRuhig = -1; else if (tRuhig < 0) tRuhig = t; }
  }
  return { ruhe, einfedern: ruhe - hMin, hMin, ruhig: tRuhig - tLand, durchschlag: durch };
}

// 2) Kurvenradius bei Top mit/ohne eine Luftbremse (Kreisfahrt auf breiter Ebene, Vollgas, voller Einschlag)
function kreis(bremse) {
  const b = ebene(300, 6000);
  const g = new Gleiter(b, { s: 200, v0: GLEITER.vmax });
  fahre(g, 1.5, { ...AUS, gas: 1 });
  let psi0 = null, t = 0, vSum = 0, n = 0, slipMax = 0;
  const kurs = (gg) => Math.atan2(gg.v.x, -gg.v.z);
  let alt = kurs(g), dreh = 0;
  for (let i = 0; i < 2.5 / dt; i++) {
    g.schritt(dt, { ...AUS, gas: 1, lenk: 1, bremseL: bremse ? 1 : 0 });
    t += dt;
    const k = kurs(g); let d = k - alt; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; alt = k;
    const slip = Math.abs(Math.atan2(dot(g.v, g.links), Math.max(1, dot(g.v, g.vor)))) * RAD;
    slipMax = Math.max(slipMax, slip);
    if (t > 1) { dreh += d; vSum += g.tempo; n++; }
  }
  void psi0;
  const zeit = n * dt, v = vSum / n, rate = Math.abs(dreh) / zeit;
  // Rückkehr des Schiebewinkels nach dem Lösen (< 2°)
  let zurueck = -1, tz = 0;
  for (let i = 0; i < 3 / dt; i++) {
    g.schritt(dt, { ...AUS, gas: 1 });
    tz += dt;
    const slip = Math.abs(Math.atan2(dot(g.v, g.links), Math.max(1, dot(g.v, g.vor)))) * RAD;
    if (slip < 2 && zurueck < 0) zurueck = tz;
  }
  return { radius: v / rate, v, slipMax, zurueck, drift: g.statistik.driftStufen.reduce((a, c) => a + c, 0) };
}
export function m2() { const ohne = kreis(false), mit = kreis(true); return { ohne, mit, verhaeltnis: mit.radius / ohne.radius }; }

// 3) Tempo-Verlust Dauer-Luftbremse 3 s (geradeaus, Vollgas, eine bzw. beide)
export function m3() {
  const lauf = (bl, br) => {
    const b = ebene(400, 6000);
    const g = new Gleiter(b, { s: 200, v0: GLEITER.vmax });
    fahre(g, 1, { ...AUS, gas: 1 });
    const v0 = GLEITER.vmax;
    fahre(g, 3, { ...AUS, gas: 1, bremseL: bl, bremseR: br });
    return g.tempo / v0;
  };
  return { eine: lauf(1, 0), beide: lauf(1, 1) };
}

// 4) Gleitwinkel beim Bremsen-Drift: aus m2 (Schiebewinkel max., Rückkehr nach dem Lösen)
export function m4() { const k = kreis(true); return { slipMax: k.slipMax, zurueck: k.zurueck }; }

// 8) Wandtreffer 30° bei Top: Tempo- und Energie-Verlust
export function m8() {
  const b = ebene(13, 3000);
  const g = new Gleiter(b, { s: 200, u: 0, v0: GLEITER.vmax });
  // Gleiter um 30° nach links drehen (Nase und Tempo), dann geradeaus in die Wand
  const w = 30 / RAD, c = Math.cos(w), s = Math.sin(w);
  const vor = { ...g.vor }, links = { ...g.links };
  const neu = (a, bb, ca, sa) => ({ x: a.x * ca + bb.x * sa, y: a.y * ca + bb.y * sa, z: a.z * ca + bb.z * sa });
  const nv = neu(vor, links, c, s), nl = neu(links, vor, c, -s);
  Object.assign(g.vor, nv); Object.assign(g.links, nl);
  const v = g.tempo || GLEITER.vmax;
  g.v.x = nv.x * v; g.v.y = nv.y * v; g.v.z = nv.z * v;
  const e0 = g.energie ?? g.schild, v0 = g.tempo;
  let treffer = 0, tTreffer = -1, t = 0, vNach = v0, eNach = e0;
  for (let i = 0; i < 1.5 / dt; i++) {
    // nach dem Einschlag lenkt der Fahrer von der Wand weg (wie ein Mensch), sonst schleift er weiter
    g.schritt(dt, { ...AUS, gas: 1, lenk: tTreffer >= 0 ? -0.6 : 0 });
    t += dt;
    for (const e of g.ereignisse) if (e.art === 'wand') { treffer++; if (tTreffer < 0) tTreffer = t; }
    g.ereignisse.length = 0;
    if (tTreffer >= 0 && t - tTreffer <= 0.25) { vNach = g.tempo; eNach = g.energie ?? g.schild; }
  }
  return { tempo: vNach / v0 - 1, energie: eNach - e0, treffer };
}

// 9) Sprung verfehlt: Zeitverlust gegenüber einem knapp geschafften Sprung (gleicher Anlauf, Ziel = Ende der Landezone + 200 m)
export function m9() {
  const bahn = strecke1();
  const k = bahn.abschnitte.findIndex((a) => a.name === 'Häuserschlucht');
  const kL = bahn.abschnitte.findIndex((a) => a.name === 'Landezone 1');
  const sKante = bahn.segStart[k], sZiel = bahn.segStart[kL] + bahn.abschnitte[kL].len + 200;
  const vmin = SPRUNG_MINDEST['Häuserschlucht'];
  const lauf = (v0) => {
    const g = new Gleiter(bahn, { s: sKante - 3, v0 });
    let t = 0, gefahren = 0, sAlt = g.s, minS = Infinity;
    for (let i = 0; i < 40 / dt; i++) {
      g.schritt(dt, { ...AUS, gas: 1 });
      t += dt;
      let d = g.s - sAlt; if (d < -bahn.L / 2) d += bahn.L; sAlt = g.s;
      if (Math.abs(d) < 600) gefahren += d;
      if (g.zustand === 'fahrt' && g.boden) minS = Math.min(minS, g.s);
      if (g.zustand === 'fahrt' && g.s > sZiel - 1 && g.s < sZiel + 50) break;
    }
    return { t, abfluege: g.statistik.abfluege, vorDemSprung: minS < sKante - 5 };
  };
  const gut = lauf(vmin + 2), schlecht = lauf(vmin - 12);
  return { verlust: schlecht.t - gut.t, gut, schlecht };
}

// L) Lenkwechsel (Vorlage: Gier-Beschleunigung begrenzt, Gegenlenken doppelt so schnell): bei 60 m/s volle Linkskurve, dann
// voll rechts – Zeit bis die Gierrate die Richtung gewechselt hat und bis 90 % der neuen Rate; dazu Anlenken aus geradeaus
export function mL() {
  const b = ebene(400, 6000);
  const g = new Gleiter(b, { s: 200, v0: 60 });
  const halte = (gg) => ({ ...AUS, gas: gg.tempo < 60 ? 1 : 0 });
  fahre(g, 0.5, halte);
  const gier = (gg) => dot(gg.w, gg.oben);
  let t = 0, t90an = -1;
  for (let i = 0; i < 1.5 / dt; i++) { g.schritt(dt, { ...halte(g), lenk: 1 }); t += dt; if (t90an < 0 && gier(g) > 0.9 * 0.73) t90an = t; }
  const voll = gier(g);
  let tNull = -1, t90 = -1; t = 0;
  for (let i = 0; i < 1.5 / dt; i++) { g.schritt(dt, { ...halte(g), lenk: -1 }); t += dt; if (tNull < 0 && gier(g) < 0) tNull = t; if (t90 < 0 && gier(g) < -0.9 * voll) t90 = t; }
  return { voll, anlenken: t90an, wechselNull: tNull, wechsel90: t90 };
}

// 5) Energie: Boosts aus vollem Balken (Gerade, Taste je 2 s), Boxengasse leer → voll; dazu KI-Rennen (2 Runden):
// Energie-Boosts, Boxen-Durchfahrten, Notlauf-Zeit je Gleiter
export function m5() {
  const b = ebene(30, 20000);
  const g = new Gleiter(b, { s: 100, v0: GLEITER.vmax });
  g.boostFrei = true;
  let boosts = 0, minE = 1;
  for (let i = 0; i < 40 / dt; i++) {
    const tick = i % Math.round(2 / dt) === 0;
    g.schritt(dt, { ...AUS, gas: 1, boost: tick ? 1 : 0 });
    for (const e of g.ereignisse) if (e.art === 'energieBoost') boosts++;
    g.ereignisse.length = 0;
    minE = Math.min(minE, g.schild);
  }
  // Boxengasse auf Strecke 1: leer hineinfahren (Mitte der Lade-Spur), Zeit bis voll
  const bahn = strecke1(), x = bahn.box;
  const g2 = new Gleiter(bahn, { s: x.s0 - 5, u: x.u, v0: 25 });
  g2.schild = 0;
  let t = 0, voll = -1;
  for (let i = 0; i < 12 / dt && voll < 0; i++) {
    g2.schritt(dt, { ...AUS, gas: g2.tempo < 25 ? 1 : 0, lenk: Math.max(-1, Math.min(1, 0.3 * (x.u - g2.u))) });
    if (g2.imBox) t += dt;
    if (g2.schild >= 0.999) voll = t;
  }
  return { boosts, minE, boxVoll: voll };
}
export function m5ki() {
  const { r } = kiRennen(2, REGLER_JETZT);
  leseRegler(REGLER_JETZT);
  const zeilen = r.alle.map((t) => ({ name: t.name, boosts: t.g.statistik.energieBoosts, box: +t.g.statistik.boxZeit.toFixed(1), notlauf: +t.g.statistik.notlaufZeit.toFixed(1), energie: +t.g.schild.toFixed(2) }));
  return { zeilen, boosts: zeilen.reduce((a, z) => a + z.boosts, 0) / zeilen.length, boxen: zeilen.filter((z) => z.box > 0).length, notlauf: zeilen.reduce((a, z) => a + z.notlauf, 0) };
}

// 6) Flugzeit-Boost je Riesensprung (mit Pad-Kette, Spurhalter): Stufe, sauber, Zeit bis Landezonen-Ende + 300 m mit und
// ohne Flugzeit-Boost (Zeitgewinn)
function spurLenk(g, u = 0) {
  const q = g.q, vt = dot(g.v, q.T), vl = dot(g.v, q.Ls);
  return Math.max(-1, Math.min(1, 0.05 * (u - g.u) - 2.2 * Math.atan2(vl, Math.max(vt, 1))));
}
function sprungZeit(bahn, anlauf, landung, u) {
  const k = bahn.abschnitte.findIndex((a) => a.name === anlauf), kl = bahn.abschnitte.findIndex((a) => a.name === landung);
  const ziel = bahn.segStart[kl] + bahn.abschnitte[kl].len + 300;
  const g = new Gleiter(bahn, { s: bahn.segStart[k] - 30, u, v0: GLEITER.vmax });
  let t = 0, stufe = -1, luft = 0, sauber = null;
  for (let i = 0; i < 30 / dt && g.s < ziel; i++) {
    g.schritt(dt, { ...AUS, gas: 1, lenk: spurLenk(g, u) });
    t += dt;
    for (const e of g.ereignisse) if (e.art === 'flugBoost') { stufe = e.stufe; luft = e.luft; sauber = e.sauber; }
    g.ereignisse.length = 0;
  }
  return { t, stufe, luft, sauber, abfluege: g.statistik.abfluege };
}
export function m6() {
  const out = [];
  for (const [name, anlauf, landung] of [['Häuserschlucht', 'Häuserschlucht Anlauf', 'Landezone 1'], ['Neon-Schlucht', 'Hafen Anlauf', 'Landezone 2']]) {
    for (const u of [0, 11]) {
      const regler = REGLER_JETZT;
      leseRegler(regler); const bahn = strecke1();
      const mit = sprungZeit(bahn, anlauf, landung, u);
      leseRegler(regler + '&flugboost=0');
      const ohne = sprungZeit(bahn, anlauf, landung, u);
      leseRegler(regler);
      out.push({ name: `${name} ${u ? 'ohne' : 'mit'} Pads`, stufe: mit.stufe, luft: mit.luft, sauber: mit.sauber, gewinn: ohne.t - mit.t });
    }
  }
  return out;
}

// 7) Pad-Kette: höchste Boost-Stufe nach 1/2/3/4 Pads (Gerade mit Pad-Reihe), Reserve höchstens
export function m7() {
  const b = baueBahn([{ typ: 'gerade', len: 3000, pads: [0, 1, 2, 3, 4, 5].map((k) => ({ at: 300 + k * 70, u: 0, b: 6, l: 12 })) }], { ohneSchluss: true });
  const g = new Gleiter(b, { s: 100, v0: GLEITER.vmax });
  const stufen = [], reserve = [];
  let pads = 0, resMax = 0;
  for (let i = 0; i < 8 / dt; i++) {
    g.schritt(dt, { ...AUS, gas: 1, lenk: spurLenk(g) });
    resMax = Math.max(resMax, g.boostZeit);
    if (g.statistik.pads > pads) { pads = g.statistik.pads; stufen.push(g.boost); reserve.push(g.boostZeit); }
  }
  return { stufen, reserve, resMax };
}

// 10) KI-Revanche: Rennen mit einem Menschen (Autopilot „Mittel“, Startplatz 6) gegen 7 KI; je Überholen des Menschen an einer
// KI „Mittel“: holt sich diese KI den Platz innerhalb von 10 s zurück? Quote mit/ohne Revanche
export function m10(n = 20) {
  const quote = (regler) => {
    leseRegler(regler);
    const bahn = strecke1(), plan = bauePlan(bahn);
    let ueber = 0, zurueck = 0, revs = 0;
    for (let r = 0; r < n; r++) {
      const profile = ['profi', 'mittel', 'mittel', 'leicht', 'mittel', 'mittel', 'profi', 'mittel'];
      const teil = TEAMS.map((t, k) => ({ ...t, spieler: k === 5, pilot: new Pilot(bahn, plan, PROFILE[k === 5 ? 'mittel' : profile[k]], 500 * r + 13 * k + 3) }));
      const rn = new Rennen(bahn, teil, { runden: 2, ohneCountdown: true });
      const sp = rn.alle[5], offen = [];
      const vorAlt = new Map();
      let i = 0;
      while (rn.phase !== 'ziel' && i++ < 240 * 400) {
        rn.schritt(dt, null);
        for (const g of rn.gleiter) g.ereignisse.length = 0;
        if (i % 24) continue;   // Stichprobe 0,1 s
        for (const t of rn.alle) {
          if (t === sp || t.pilot.profil.name !== 'Mittel' || t.ziel || sp.ziel) continue;
          const vor = t.fortschritt > sp.fortschritt;
          if (vorAlt.get(t) && !vor) { ueber++; offen.push({ t, bis: rn.zeit + 10 }); }
          vorAlt.set(t, vor);
        }
        for (let k = offen.length - 1; k >= 0; k--) {
          const o = offen[k];
          if (o.t.fortschritt > sp.fortschritt) { zurueck++; offen.splice(k, 1); } else if (rn.zeit > o.bis) offen.splice(k, 1);
        }
      }
      revs += rn.alle.reduce((a, t) => a + (t.g.statistik.revanchen || 0), 0);
    }
    return { ueber, zurueck, quote: zurueck / Math.max(1, ueber), revs };
  };
  const ohne = quote(REGLER_JETZT + '&revanche=0'), mit = quote(REGLER_JETZT);
  return { mit, ohne };
}

// 11) Start-Boost abgestuft: Ø-Stärke der KI-Starts je Profil (echte Tester-Telemetrie braucht Handys – offen)
export function m11(n = 40) {
  leseRegler(REGLER_JETZT);
  const bahn = strecke1(), plan = bauePlan(bahn), out = {};
  for (const p of ['leicht', 'mittel', 'profi']) {
    let summe = 0, treffer = 0;
    for (let r = 0; r < n; r++) {
      const rn = new Rennen(bahn, [{ name: 'K', pilot: new Pilot(bahn, plan, PROFILE[p], 77 + r * 31) }], { runden: 1 });
      while (rn.zeit < 0.5) rn.schritt(dt, null);
      summe += rn.alle[0].start.staerke; treffer += rn.alle[0].start.staerke > 0 ? 1 : 0;
    }
    out[p] = { staerke: summe / n, quote: treffer / n };
  }
  return out;
}

// 13) G-Vignette: KI „Mittel“ fährt 2 Runden; je Looping-Durchfahrt höchste Deckkraft, Maximum gesamt, „Blitze reduziert“ = 0
export function m13() {
  leseRegler(REGLER_JETZT);
  const bahn = strecke1(), plan = bauePlan(bahn);
  const k = bahn.abschnitte.findIndex((a) => a.name === 'Großer Looping');
  const s0 = bahn.segStart[k], s1 = s0 + bahn.abschnitte[k].len;
  const g = new Gleiter(bahn, { s: 5, v0: 60 }), p = new Pilot(bahn, plan, PROFILE.mittel, 9);
  const durch = []; let jetzt = null, max = 0, maxRed = 0, gMax = 0, weg = 0, sAlt = g.s;
  for (let i = 0; i < 400 / dt && weg < 2 * bahn.L; i++) {
    g.schritt(dt, p.steuer(g, dt, [])); g.ereignisse.length = 0;
    let d = g.s - sAlt; if (d < -bahn.L / 2) d += bahn.L; if (Math.abs(d) < 80) weg += d; sAlt = g.s;
    const dk = gVignetteDeckkraft(g.gLast, false);
    max = Math.max(max, dk); maxRed = Math.max(maxRed, gVignetteDeckkraft(g.gLast, true)); gMax = Math.max(gMax, g.gLast);
    const drin = g.s > s0 && g.s < s1;
    if (drin && !jetzt) jetzt = { max: 0 };
    if (drin) jetzt.max = Math.max(jetzt.max, dk);
    if (!drin && jetzt) { durch.push(jetzt.max); jetzt = null; }
  }
  return { durch, max, maxRed, gMax };
}

// Seitwärts-Schub: 1 s voll seitlich bei 80 m/s auf breiter Ebene – Querversatz, Tempo-Verlust, Drehung
export function mS() {
  leseRegler(REGLER_JETZT);
  const b = ebene(60, 6000);
  const lauf = (st) => {
    const g = new Gleiter(b, { s: 200, v0: 80 });
    const vor0 = { ...g.vor };
    for (let i = 0; i < 1 / dt; i++) g.schritt(dt, { ...AUS, gas: g.tempo < 80 ? 1 : 0.6, strafe: st });
    return { u: g.u, v: g.tempo, dreh: Math.acos(Math.min(1, dot(g.vor, vor0))) * RAD };
  };
  const mit = lauf(1), ohne = lauf(0);
  return { versatz: mit.u - ohne.u, tempo: mit.v - ohne.v, dreh: mit.dreh };
}

const MESS = {
  1: ['Schwebe-Ruhelage & Federweg nach Landung aus 10 m', '1,15–1,25 m; Einfedern ≤ 0,4 m, ruhig ≤ 0,5 s, kein Durchschlag',
    (r) => `Ruhe ${r.ruhe.toFixed(2)} m · Einfedern ${r.einfedern.toFixed(2)} m (tiefste ${r.hMin.toFixed(2)} m) · ruhig nach ${r.ruhig.toFixed(2)} s · Aufsetzer ${r.durchschlag}`, m1],
  2: ['Kurvenradius bei Top mit/ohne eine Luftbremse', 'mit ≤ 0,6 × ohne',
    (r) => `ohne ${r.ohne.radius.toFixed(0)} m (${r.ohne.v.toFixed(0)} m/s) · mit ${r.mit.radius.toFixed(0)} m (${r.mit.v.toFixed(0)} m/s) · ${r.verhaeltnis.toFixed(2)} ×`, m2],
  3: ['Tempo nach 3 s Dauer-Luftbremse (Top)', 'eine 78–82 %, beide ≈ 45 %',
    (r) => `eine ${(r.eine * 100).toFixed(0)} % · beide ${(r.beide * 100).toFixed(0)} %`, m3],
  4: ['Gleitwinkel beim Bremsen-Drift', 'max. 15–25°, zurück ≤ 1,2 s',
    (r) => `max. ${r.slipMax.toFixed(1)}° · zurück nach ${r.zurueck.toFixed(2)} s`, m4],
  5: ['Boosts aus vollem Balken · Boxengasse leer → voll', '8 Boosts (12 %); Boxengasse 2,5–3,5 s',
    (r) => `${r.boosts} Boosts (Energie nie unter ${(r.minE * 100).toFixed(0)} %) · Boxengasse voll nach ${r.boxVoll.toFixed(2)} s`, m5],
  K: ['KI-Rennen 2 Runden: Energie-Nutzung', 'KI nutzt Boost und Boxengasse, kein Notlauf',
    (r) => `Ø ${r.boosts.toFixed(1)} Boosts je Gleiter · ${r.boxen}/8 durch die Boxengasse · Notlauf gesamt ${r.notlauf.toFixed(1)} s · ${r.zeilen.map((z) => `${z.name} ${z.boosts}/${z.box}s/${Math.round(z.energie * 100)}%`).join(' ')}`, m5ki],
  6: ['Flugzeit-Boost je Riesensprung', 'jeder Riesensprung mit sauberer Landung = Stufe 3; Zeitgewinn 0,4–0,7 s',
    (r) => r.map((x) => `${x.name}: Stufe ${x.stufe} (${x.luft.toFixed(1)} s, ${x.sauber ? 'sauber' : 'schief'}) +${x.gewinn.toFixed(2)} s`).join(' · '), m6],
  7: ['Pad-Kette (Reserve + Ketten-Deckel)', '3er-Kette +70–80 %, nie über +80 %; Reserve ≤ 4 s',
    (r) => `Stufe nach Pad 1…${r.stufen.length}: ${r.stufen.map((x) => '+' + Math.round(x * 100) + ' %').join(' / ')} · Reserve ${r.reserve.map((x) => x.toFixed(1)).join(' / ')} s (max ${r.resMax.toFixed(2)} s)`, m7],
  8: ['Wandtreffer 30° bei Top', '−15…−25 % Tempo, −4…−8 % Energie',
    (r) => `Tempo ${(r.tempo * 100).toFixed(0)} % · Energie ${(r.energie * 100).toFixed(1)} %`, m8],
  L: ['Lenkwechsel bei 60 m/s (Gegenlenken)', 'Gegenlenken ≈ doppelt so schnell wie Anlenken (Vorlage), Gierrate ≤ 100°/s',
    (r) => `volle Gierrate ${(r.voll * RAD).toFixed(0)}°/s · Anlenken bis 90 % ${r.anlenken.toFixed(2)} s · Gegenlenken: Richtungswechsel nach ${r.wechselNull.toFixed(2)} s, 90 % nach ${r.wechsel90.toFixed(2)} s`, mL],
  10: ['KI-Revanche (20 Rennen à 2 Runden, Mensch = Autopilot Mittel)', 'Zurück-Überholquote der KI „Mittel“ 25–40 %',
    (r) => `mit Revanche ${(r.mit.quote * 100).toFixed(0)} % (${r.mit.zurueck}/${r.mit.ueber}, ${r.mit.revs} Revanchen) · ohne ${(r.ohne.quote * 100).toFixed(0)} % (${r.ohne.zurueck}/${r.ohne.ueber})`, m10],
  11: ['Start-Boost abgestuft (KI-Telemetrie je Profil)', 'Ø-Stärke Tester Handy 50–70 % (Tester offen)',
    (r) => Object.entries(r).map(([p, x]) => `${p}: Ø ${(x.staerke * 100).toFixed(0)} % (Treffer ${(x.quote * 100).toFixed(0)} %)`).join(' · '), m11],
  13: ['G-Vignette', 'in jedem Looping, nie > 35 %, aus mit „Blitze reduzieren“',
    (r) => `Looping-Durchfahrten ${r.durch.map((x) => (x * 100).toFixed(0) + ' %').join(' / ')} · max. ${(r.max * 100).toFixed(0)} % (G-Last max. ${r.gMax.toFixed(1)} g) · reduziert ${(r.maxRed * 100).toFixed(0)} %`, m13],
  S: ['Seitwärts-Schub 1 s bei 80 m/s', '6 m/s² quer, kostet kein Tempo',
    (r) => `Versatz ${r.versatz.toFixed(1)} m · Tempo ${r.tempo >= 0 ? '+' : ''}${r.tempo.toFixed(2)} m/s · Nase dreht ${r.dreh.toFixed(1)}°`, mS],
  9: ['Sprung verfehlt (Häuserschlucht)', 'Zeitverlust 2,0–3,0 s, nie vor den Sprung zurück',
    (r) => `Zeitverlust ${r.verlust.toFixed(2)} s · Abflüge ${r.schlecht.abfluege} · vor den Sprung zurück: ${r.schlecht.vorDemSprung ? 'JA' : 'nein'}`, m9],
};

let REGLER_JETZT = '';
export function vorlagenMessung(regler = '', nur = null) {
  REGLER_JETZT = regler || '?';
  leseRegler(regler); leseGefuehl(regler);
  const out = [];
  for (const [nr, [name, ziel, fmt, fn]] of Object.entries(MESS)) {
    if (nur && !nur.includes(nr)) continue;
    const r = fn();
    out.push({ nr, name, ziel, text: fmt(r), r });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('vorlagen_mess.mjs')) {
  const args = process.argv.slice(2);
  const iNur = args.indexOf('--nur');
  const nur = iNur >= 0 ? args[iNur + 1].split(',') : null;
  const regler = args.find((a) => a.startsWith('?')) || '';
  console.log(`Vorlagen-Messgrößen ${regler || '(Standard)'}`);
  for (const z of vorlagenMessung(regler, nur)) console.log(`#${z.nr} ${z.name}\n   Ziel: ${z.ziel}\n   gemessen: ${z.text}`);
  void G; void BOOST;
}
