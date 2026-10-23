// Verfolger-Kamera (reine Mathe ohne three.js, Node-testbar; `wendeAn` setzt eine three-Kamera per Duck-Typing).
//  • folgt der Bahn-Normale (Horizont dreht im Looping/Röhre/Wandfahrt mit), aber gedämpft (KAMERA.rollTraeg)
//  • „Horizont halten“ (gegen Übelkeit am Handy): Oben bleibt so lange wie möglich Welt-Oben, dreht nur bei steiler/
//    kopfüber Fahrbahn mit, und das deutlich träger
//  • Tempo/Boost weiten das Sichtfeld, Riesensprung: Kamera zieht für das Panorama zurück, Landung: kurzer Ruck
//  • Action-Momente: Zoom-Punch (fx.fov/zoom), Bullet-Time-Halbkreis (fx.orbit), Shake (fx.shake)
// Versatz und Oben-Vektor werden im Gleiter-Rahmen geglättet (nicht die Weltlage) → kein Hinterherhinken bei 800 km/h.
// Fahrgefühl (Datenblatt): Sichtfeld-Grundwert 62° (?fov=), Boost +12° (?fovboost=), Sprung von der Pad-Kette +18°,
// Treffer +10°, Änderung höchstens 40°/s hinauf und 24°/s zurück („atmendes“ Sichtfeld). Nachlauf wie ein lockerer
// Verfolger: geglättetes Tempo (waagrecht τ ≈ 0,04 s, senkrecht τ ≈ 0,1 s) → die Kamera fällt nur beim Beschleunigen
// kurz zurück (Boost-Start: wenige Prozent der Folgedistanz) und schwingt in ~0,3 s wieder ein.
// p1c (Peter 22.10.: „Kamera clippt im Looping durch den Boden“, Fix wie Stuntbahn 0.12.2):
//  • Looping-Höhe: ist die Bahn-Normale am Gleiter steiler als ~32° geneigt (Looping, Korkenzieher, Wand, Überkopf, Twist),
//    steigt die Kamera weich um KAM.loopH (entlang Kamera-Oben = Bahn-Normale), voll ab senkrecht, danach sanft zurück.
//    ?camloop=0 = alt, ?camloop=0…4 m.
//  • Boden: weicher Mindestabstand KAM.boden zur Fahrfläche (Bahn-Raycast an der Kamera-Lage, gilt auch für den
//    Bullet-Time-Halbkreis). Im Looping zog der Nachlauf (Tempo-Glättung) die Kamera um mehrere Meter zur Außenseite =
//    unter die Fahrbahn. ?camboden=0 = aus.
import { KAMERA, GLEITER } from '../config.js';
import { v3, setze, dot, norm, kreuz, addSk, drehe } from '../core/vec.js';
import { clamp } from '../core/util.js';
import { GEFUEHL } from '../physics/fahrgefuehl.js';
import { neueAbfrage, F_LUECKE } from '../track/bahn.js';

export const KAM = {
  abstand: 9.5, hoehe: 2.6, blickVor: 9, fovTempo: 0,   // Sichtfeld hängt nicht am Tempo (nur Boost/Sprung/Treffer)
  panoramaAbstand: 16, panoramaHoehe: 6, panoramaZeit: 0.8, glatt: 0.09, ruck: 0.35,
  orbitRadius: 7.5, orbitHoehe: 1.8,   // Bullet-Time-Halbkreis
  tauWaag: 0.039, tauSenk: 0.103, nachlauf: 0.55,   // s: Tempo-Glättung (0,35 bzw. 0,15 je 1/60 s) und Versatz-Faktor
  loopH: 1.2,                  // m Zusatzhöhe bei steiler/kopfüber Fahrbahn (?camloop=)
  nachlaufUnten: 0.6,          // m: größter Nachlauf-Versatz zur Fahrbahn hin (weich; ?camloop=0 → unbegrenzt wie bisher)
  boden: 1.0, bodenWeich: 1.0, // m Mindestabstand zur Fahrfläche, Breite des weichen Übergangs (?camboden=0 aus)
};

// URL-Regler der Kamera (Browser: location.search, Node: eigener String)
export function leseKamera(search) {
  const q = new URLSearchParams(search || '');
  const z = (k) => { const v = parseFloat(q.get(k)); return q.has(k) && Number.isFinite(v) ? v : null; };
  if (z('camloop') !== null) { KAM.loopH = clamp(z('camloop'), 0, 4); if (KAM.loopH === 0) KAM.nachlaufUnten = 0; }
  if (z('camboden') !== null) KAM.boden = clamp(z('camboden'), 0, 3);
  return q;
}

const WELT_OBEN = v3(0, 1, 0);

export class KameraRig {
  constructor() {
    this.pos = v3(); this.ziel = v3(); this.oben = v3(0, 1, 0);
    this.fov = GEFUEHL.fov; this.fovBasis = GEFUEHL.fov;
    this.vGlatt = v3(); this.versatz = v3(); this.sprungBoost = false; this.trefferT = 0;
    this.dist = KAM.abstand; this.hoch = KAM.hoehe;
    this.richt = v3(0, 0, -1);
    this.ruck = 0; this.t = 0; this.loopK = 0;
    this.q = neueAbfrage(); this.bodenHub = 0;
    this.init = false;
  }

  // g = Physik-Gleiter, fx = Effekte der Action-Regie (oder null), dt = Präsentationszeit
  update(dt, g, fx = null, opt = {}) {
    const halten = opt.horizontHalten ?? KAMERA.horizontHalten;
    this.t += dt;
    // Blickrichtung: Mischung aus Nase und Flugrichtung (in der Luft mehr Flugrichtung)
    const v = g.tempo || 0;
    setze(_a, g.vor.x, g.vor.y, g.vor.z);
    if (v > 5) addSk(_a, _a, g.v, (g.boden ? 0.35 : 0.8) / v);
    norm(_a, _a);
    // Oben-Ziel
    let obenZiel = g.oben, traeg = KAMERA.rollTraeg;
    if (halten) {
      const k = dot(g.oben, WELT_OBEN);
      // solange die Fahrbahn halbwegs aufrecht ist, Welt-Oben halten; sonst (Wand, kopfüber) langsam mitdrehen
      if (k > 0.35) obenZiel = mischeOben(_b, WELT_OBEN, g.oben, 0.15);
      traeg = 0.7;
    } else {
      obenZiel = mischeOben(_b, WELT_OBEN, g.oben, KAMERA.rollFolge);
    }
    const a = this.init ? 1 - Math.exp(-dt / traeg) : 1;
    const ar = this.init ? 1 - Math.exp(-dt / KAM.glatt) : 1;
    mischeOben(this.oben, this.oben, obenZiel, a);
    mischeOben(this.richt, this.richt, _a, ar);
    // Abstand/Höhe: Panorama bei langen Sprüngen
    const pan = !g.boden && g.luftZeit > KAM.panoramaZeit ? 1 : 0;
    const zielD = KAM.abstand + pan * (KAM.panoramaAbstand - KAM.abstand) + Math.min(3, v / 60);
    const zielH = KAM.hoehe + pan * (KAM.panoramaHoehe - KAM.hoehe);
    const ad = this.init ? 1 - Math.exp(-dt / 0.6) : 1;
    this.dist += (zielD - this.dist) * ad; this.hoch += (zielH - this.hoch) * ad;
    // Looping-Anteil aus der Bahn-Normale am Gleiter (in der Luft: Kamera-Oben): 0 bis ~32° Neigung, 1 ab senkrecht/kopfüber;
    // schnell hoch (4/s), langsam zurück (1,5/s)
    const nb = g.boden && g.q && g.q.ok ? g.q.Us : this.oben;
    const lw = g.zustand === 'absturz' ? 0 : clamp((0.85 - nb.y) / 0.85, 0, 1);
    this.loopK = this.init ? this.loopK + (lw - this.loopK) * (1 - Math.exp(-dt * (lw > this.loopK ? 4 : 1.5))) : lw;
    // Lage: hinter dem Gleiter entlang der geglätteten Richtung, über ihm entlang des geglätteten Oben
    setze(this.pos, g.p.x, g.p.y, g.p.z);
    addSk(this.pos, this.pos, this.richt, -this.dist);
    addSk(this.pos, this.pos, this.oben, this.hoch + this.loopK * KAM.loopH);
    setze(this.ziel, g.p.x, g.p.y, g.p.z);
    addSk(this.ziel, this.ziel, this.richt, KAM.blickVor);
    addSk(this.ziel, this.ziel, this.oben, 1.0);
    // Nachlauf: geglättetes Tempo, getrennt waagrecht/senkrecht (bezogen auf das Kamera-Oben); Versatz = −(v − vGlatt)·T
    if (!this.init) setze(this.vGlatt, g.v.x, g.v.y, g.v.z);
    const dvx = g.v.x - this.vGlatt.x, dvy = g.v.y - this.vGlatt.y, dvz = g.v.z - this.vGlatt.z;
    const dSenk = dvx * this.oben.x + dvy * this.oben.y + dvz * this.oben.z;
    const aW = 1 - Math.exp(-dt / KAM.tauWaag), aS = 1 - Math.exp(-dt / KAM.tauSenk);
    this.vGlatt.x += (dvx - this.oben.x * dSenk) * aW + this.oben.x * dSenk * aS;
    this.vGlatt.y += (dvy - this.oben.y * dSenk) * aW + this.oben.y * dSenk * aS;
    this.vGlatt.z += (dvz - this.oben.z * dSenk) * aW + this.oben.z * dSenk * aS;
    setze(this.versatz, -(g.v.x - this.vGlatt.x) * KAM.nachlauf, -(g.v.y - this.vGlatt.y) * KAM.nachlauf, -(g.v.z - this.vGlatt.z) * KAM.nachlauf);
    // p1c: Nachlauf zur Fahrbahn hin (−Kamera-Oben) weich auf KAM.nachlaufUnten begrenzt – im Looping (Fliehkraft-Richtung)
    // waren es bis zu ~5 m, die Kamera tauchte unter die Fahrbahn
    const vs = dot(this.versatz, this.oben), L = KAM.nachlaufUnten;
    if (vs < 0 && L > 0) addSk(this.versatz, this.versatz, this.oben, -L * (1 - Math.exp(vs / L)) - vs);
    addSk(this.pos, this.pos, this.versatz, 1);
    // Bullet-Time: Halbkreis um den Gleiter (um das Kamera-Oben)
    if (fx && fx.orbitAn) {
      // nah heran (Matrix-Halbkreis): fester Radius statt der Verfolger-/Panorama-Distanz
      setze(_c, 0, 0, 0); addSk(_c, _c, this.richt, -KAM.orbitRadius); addSk(_c, _c, this.oben, KAM.orbitHoehe);
      drehe(_c, _c, this.oben, fx.orbit);
      setze(this.pos, g.p.x + _c.x, g.p.y + _c.y, g.p.z + _c.z);
      setze(this.ziel, g.p.x, g.p.y, g.p.z);
    }
    // Ruck (Landung, Wand, Rückkehr aus der Zeitlupe) + Shake
    this.ruck = Math.max(0, this.ruck - dt / KAM.ruck);
    const sh = (this.ruck + (fx ? fx.shake : 0)) * 0.35;
    if (sh > 0) {
      kreuz(_c, this.richt, this.oben);
      addSk(this.pos, this.pos, _c, Math.sin(this.t * 71) * sh);
      addSk(this.pos, this.pos, this.oben, Math.sin(this.t * 53 + 1) * sh * 0.6);
    }
    this.bodenAbstand(g);
    // Sichtfeld: Grundwert + Boost/Sprung/Treffer, mit begrenzter Änderungsrate; Zoom-Punch/Zeitlupe kommen ungebremst dazu
    if (g.boden) this.sprungBoost = false; else if (g.luftZeit < 0.1 && g.boost > 0.3) this.sprungBoost = true;
    if (g.treff) this.trefferT = 0.6; else this.trefferT = Math.max(0, this.trefferT - dt);
    const tempoAnteil = clamp(v / (GLEITER.vmax * 1.7), 0, 1);
    const ziel = GEFUEHL.fov + KAM.fovTempo * tempoAnteil + (g.boost > 0.05 || g.mt > 0.05 ? GEFUEHL.fovBoost : 0)
      + (this.sprungBoost && !g.boden ? GEFUEHL.fovSprung : 0) + (this.trefferT > 0 ? GEFUEHL.fovTreffer : 0);
    const d = ziel - this.fovBasis;
    this.fovBasis += this.init ? clamp(d, -GEFUEHL.fovZurueck * dt, GEFUEHL.fovRate * dt) : d;
    this.fov = this.fovBasis + (fx ? fx.fov : 0);
    if (fx && fx.zoom > 1) this.fov /= fx.zoom;
    this.init = true;
    return this;
  }

  stoss(staerke = 1) { this.ruck = Math.max(this.ruck, clamp(staerke, 0, 1)); }

  // Weicher Mindestabstand zur Fahrfläche: Höhe h über der Fahrbahn an der Kamera-Lage (Raycast entlang der lokalen
  // Normale, Suche ab dem Gleiter). Unter KAM.boden + KAM.bodenWeich wird h stetig auf
  // boden + weich·exp((h − boden)/weich − 1) angehoben (gleiche Steigung am Übergang, nie unter KAM.boden). Nur über der
  // Fahrbahn (bis 1 m neben der Kante voll, ab 3 m nicht mehr) und nicht über Sprung-Lücken.
  bodenAbstand(g) {
    this.bodenHub = 0;
    const b = g.bahn;
    if (!b || KAM.boden <= 0 || g.zustand === 'absturz') return;
    const r = b.abfrage(this.pos, g.hint, this.q);
    if (!r.ok || (r.flags & F_LUECKE) || r.h < -12) return;
    const wu = clamp((r.hw + 3 - Math.abs(r.u)) / 2, 0, 1), w = KAM.bodenWeich, h0 = KAM.boden;
    if (wu <= 0 || r.h >= h0 + w) return;
    const hub = (h0 + w * Math.exp((r.h - h0) / w - 1) - r.h) * wu;
    addSk(this.pos, this.pos, r.Us, hub);
    this.bodenHub = hub;
  }
}

// normierte Mischung zweier Richtungen; bei Gegenrichtung über eine Querachse (kein Nullvektor)
function mischeOben(o, a, b, t) {
  const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
  const l = Math.hypot(x, y, z);
  if (l < 1e-3) { setze(o, b.x, b.y, b.z); return o; }
  setze(o, x / l, y / l, z / l);
  return o;
}

// three-Kamera setzen (Duck-Typing: position.set, up.set, lookAt, fov, updateProjectionMatrix)
export function wendeAn(cam, rig) {
  cam.position.set(rig.pos.x, rig.pos.y, rig.pos.z);
  cam.up.set(rig.oben.x, rig.oben.y, rig.oben.z);
  cam.lookAt(rig.ziel.x, rig.ziel.y, rig.ziel.z);
  if (Math.abs(cam.fov - rig.fov) > 0.01) { cam.fov = rig.fov; cam.updateProjectionMatrix(); }
}

const _a = v3(), _b = v3(), _c = v3();
