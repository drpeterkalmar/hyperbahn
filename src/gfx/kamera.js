// Verfolger-Kamera (reine Mathe ohne three.js, Node-testbar; `wendeAn` setzt eine three-Kamera per Duck-Typing).
//  • folgt der Bahn-Normale (Horizont dreht im Looping/Röhre/Wandfahrt mit), aber gedämpft (KAMERA.rollTraeg)
//  • „Horizont halten“ (gegen Übelkeit am Handy): Oben bleibt so lange wie möglich Welt-Oben, dreht nur bei steiler/
//    kopfüber Fahrbahn mit, und das deutlich träger
//  • Tempo/Boost weiten das Sichtfeld, Riesensprung: Kamera zieht für das Panorama zurück, Landung: kurzer Ruck
//  • Action-Momente: Zoom-Punch (fx.fov/zoom), Bullet-Time-Halbkreis (fx.orbit), Shake (fx.shake)
// Versatz und Oben-Vektor werden im Gleiter-Rahmen geglättet (nicht die Weltlage) → kein Hinterherhinken bei 800 km/h.
import { KAMERA, GLEITER } from '../config.js';
import { v3, setze, dot, norm, kreuz, addSk, drehe } from '../core/vec.js';
import { clamp } from '../core/util.js';

export const KAM = {
  abstand: 9.5, hoehe: 2.6, blickVor: 9, fov: 70, fovTempo: 14, fovBoost: 10,
  panoramaAbstand: 16, panoramaHoehe: 6, panoramaZeit: 0.8, glatt: 0.09, ruck: 0.35,
};

const WELT_OBEN = v3(0, 1, 0);

export class KameraRig {
  constructor() {
    this.pos = v3(); this.ziel = v3(); this.oben = v3(0, 1, 0);
    this.fov = KAM.fov;
    this.dist = KAM.abstand; this.hoch = KAM.hoehe;
    this.richt = v3(0, 0, -1);
    this.ruck = 0; this.t = 0;
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
    // Lage: hinter dem Gleiter entlang der geglätteten Richtung, über ihm entlang des geglätteten Oben
    setze(this.pos, g.p.x, g.p.y, g.p.z);
    addSk(this.pos, this.pos, this.richt, -this.dist);
    addSk(this.pos, this.pos, this.oben, this.hoch);
    setze(this.ziel, g.p.x, g.p.y, g.p.z);
    addSk(this.ziel, this.ziel, this.richt, KAM.blickVor);
    addSk(this.ziel, this.ziel, this.oben, 1.0);
    // Bullet-Time: Halbkreis um den Gleiter (um das Kamera-Oben)
    if (fx && fx.orbitAn) {
      setze(_c, this.pos.x - g.p.x, this.pos.y - g.p.y, this.pos.z - g.p.z);
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
    // Sichtfeld: Tempo + Boost weiten, Zoom-Punch/Zeitlupe verengen
    const tempoAnteil = clamp(v / (GLEITER.vmax * 1.7), 0, 1);
    this.fov = KAM.fov + KAM.fovTempo * tempoAnteil + KAM.fovBoost * clamp(g.boost, 0, 1) + (fx ? fx.fov : 0);
    if (fx && fx.zoom > 1) this.fov /= fx.zoom;
    this.init = true;
    return this;
  }

  stoss(staerke = 1) { this.ruck = Math.max(this.ruck, clamp(staerke, 0, 1)); }
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
