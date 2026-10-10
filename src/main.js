// Hyperbahn – Einstieg im Browser. Verdrahtet die reinen Module (Strecke, Physik, KI, Rennen, Zeit-Logik, Fahrhilfe) mit
// three.js-Grafik (Bahn, Gleiter, Stadt, Regen, Himmel, Kino-Look), HUD, Eingabe und Ton.
// Ablauf je Bild: Präsentations-Uhr (Echtzeit) → Sim-Uhr liefert n feste Physik-Schritte (Zeitlupe nur offline) →
// Ereignisse der Gleiter → Effekte (Blitze über die Blitz-Bremse) → Kamera → Kino-Look → HUD.
// VORBAU (ohne Browser geschrieben): Abnahme, Feinabstimmung am Bild und Mess-Gate macht der Heavy-Job.
// Mess-/Abnahme-Regler: ?autostart=1 (Menü überspringen), ?at=<Abschnittsname oder s in m> (Feld dort aufstellen, fliegender
// Start), ?autopilot=1 (Spieler fährt per KI – Screenshots/Mess-Gate), ?nosw (ohne Service-Worker), ?look=, ?kl=.
import * as THREE from 'three';
import { leseRegler, SPIEL, ZEIT, BLITZE, KAMERA, ACTION, GLEITER } from './config.js';
import { strecke1, SPRUNG_MINDEST } from './track/strecke1.js';
import { F_MAGNET } from './track/bahn.js';
import { bauePlan, Pilot, PROFILE } from './ai/pilot.js';
import { Rennen, TEAMS } from './game/rennen.js';
import { Fahrhilfe } from './game/fahrhilfe.js';
import { Eingabe } from './game/eingabe.js';
import { MomentWaechter } from './game/momente.js';
import { Uhr, ActionRegie, BlitzBremse, bus } from './core/zeit.js';
import { baueBahnMesh } from './gfx/bahnmesh.js';
import { baueGleiter, BAUFORM_LISTE } from './gfx/gleitermesh.js';
import { KameraRig, wendeAn } from './gfx/kamera.js';
import { KinoLook } from './gfx/kinolook.js';
import { baueHimmel, neonUmgebung } from './gfx/himmel.js';
import { Funken } from './gfx/funken.js';
import { Hud } from './ui/hud.js';
import { leseGefuehl, GEFUEHL, KLASSEN_LISTE } from './physics/fahrgefuehl.js';

const q = leseRegler(location.search);
leseGefuehl(location.search);
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // filmisch (Kino-Look übernimmt es ins Render-Target)
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0614, 0.00075);    // TODO Heavy-Job: Dunst-Dichte am Bild
const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 9000);
scene.add(new THREE.HemisphereLight(0x3a2a6a, 0x05030a, 0.5));
const mond = new THREE.DirectionalLight(0x8fb4ff, 0.35);
mond.position.set(-0.4, 1, 0.3);
scene.add(mond);
scene.environment = neonUmgebung(renderer);
const himmel = baueHimmel();
scene.add(himmel);

const lookStufe = q.has('look') ? +q.get('look') : 1;
const kino = new KinoLook(renderer, { level: lookStufe, grade: 'neonnoir', stages: q.get('kl') || '' });

// --- Strecke, Plan, Grafik der Bahn ---
const bahn = strecke1();
const plan = bauePlan(bahn);
const bahnMesh = baueBahnMesh(bahn);
scene.add(bahnMesh.gruppe);
const blitze = new BlitzBremse({ reduziert: BLITZE.reduziert });
const funken = new Funken(scene);

// Stadt, Regen, Ton: getrennte Module – fehlt eines oder scheitert es, läuft das Spiel trotzdem
let stadt = null, regen = null, ton = null;
import('./gfx/stadt.js').then((m) => { stadt = m.baueStadt(bahn, { seed: 11, blitze }); scene.add(stadt.gruppe); }).catch((e) => console.warn('Stadt', e));
import('./gfx/regen.js').then((m) => { regen = new m.Regen(scene, {}); }).catch((e) => console.warn('Regen', e));
import('./audio/ton.js').then((m) => { ton = new m.Ton(); }).catch((e) => console.warn('Ton', e));

// --- Spielzustand ---
const eingabe = new Eingabe(window);
const rig = new KameraRig();
let rennen = null, hilfe = null, waechter = null, regie = null, uhr = null, meshes = [], spielerT = null;
let laeuft = false, praes = 0, vibLetzt = -9, autopilot = null, scheinBis = 0;
// ?at=Großer Looping | ?at=1600 → Bogenlänge oder null
function startStelle() {
  if (!q.has('at')) return null;
  const v = q.get('at');
  if (/^-?\d+(\.\d+)?$/.test(v)) return ((+v % bahn.L) + bahn.L) % bahn.L;
  const k = bahn.abschnitte.findIndex((a) => a.name.toLowerCase() === v.toLowerCase());
  return k >= 0 ? Math.max(0, bahn.segStart[k] - 120) : null;
}

const hud = new Hud(document.getElementById('ui'), {
  onStart: (e) => starte(e),
  onEinstellung: (key, v) => {
    if (key === 'blitzeReduziert') blitze.reduziert = v;
    if (key === 'horizont') KAMERA.horizontHalten = v;
    if (key === 'action' && regie) regie.stufe = v;
    if (key === 'ton' && ton) ton.stumm(!v);
  },
});
// Einstellungen aus dem Menü übernehmen, URL-Regler haben Vorrang
{
  const e = hud.einst;
  if (!q.has('blitze')) blitze.reduziert = e.blitzeReduziert; else blitze.reduziert = BLITZE.reduziert;
  if (!q.has('horizont')) KAMERA.horizontHalten = e.horizont;
  if (!q.has('action')) ACTION.stufe = e.action;
}
eingabe.bindeTouch(canvas, { bremseL: hud.k.bremseL, bremseR: hud.k.bremseR, rolle: hud.k.rolle });
hud.k.pause.addEventListener('click', () => { laeuft = false; hud.zeigeMenue(true); });
hud.zeigeMenue(true);

function starte(e) {
  for (const m of meshes) { scene.remove(m.gruppe); scene.remove(m.spur); }
  const anzahl = q.has('gegner') ? SPIEL.gegner : e.gegner;
  const ki = q.has('ki') ? SPIEL.ki : e.ki;
  const stufe = q.has('hilfe') ? SPIEL.hilfe : e.hilfe;
  const teil = [{ ...TEAMS[0], name: 'DU', klasse: q.get('klasse') || e.klasse || 'mittel' }];
  for (let k = 1; k <= anzahl; k++) teil.push({ ...TEAMS[k], klasse: KLASSEN_LISTE[k % 3], pilot: new Pilot(bahn, plan, PROFILE[ki], 100 + k * 13) });
  const at = startStelle();
  rennen = new Rennen(bahn, teil, { runden: q.has('runden') ? SPIEL.runden : e.runden, ohneCountdown: at !== null });
  spielerT = rennen.spieler;
  if (at !== null) {
    // fliegender Start an einer Stelle (Abnahme/Screenshots): Feld versetzt dahinter, mit 85 % Höchsttempo
    rennen.alle.forEach((t, k) => { t.g.setzeAuf(at - k * 14, (k % 2 ? -1 : 1) * 4, GLEITER.vmax * 0.85); t.sAlt = t.g.s; });
  }
  autopilot = q.get('autopilot') === '1' ? new Pilot(bahn, plan, PROFILE.profi, 1) : null;
  hilfe = new Fahrhilfe(bahn, plan, stufe);
  waechter = new MomentWaechter(bahn, plan);
  uhr = new Uhr({ online: SPIEL.online });
  if (regie) regie.ab && regie.ab();
  regie = new ActionRegie({ stufe: q.has('action') ? ACTION.stufe : e.action, online: SPIEL.online, blitze });
  regie.ab = regie.verbinde(bus);
  meshes = rennen.alle.map((t, k) => {
    const m = baueGleiter(t.farbe, BAUFORM_LISTE[k % BAUFORM_LISTE.length]);
    scene.add(m.gruppe); scene.add(m.spur);
    return m;
  });
  kino.setCarBox(new THREE.Box3(new THREE.Vector3(-1.6, -0.6, -2.8), new THREE.Vector3(1.6, 1.4, 2.8)));
  rig.init = false;
  if (ton && e.ton) ton.start().catch(() => {});
  if (ton) ton.stumm(!e.ton);
  hud.zeigeMenue(false);
  laeuft = true;
}

// --- Effekte aus Gleiter-Ereignissen (nur Spieler bekommt Blitze/Kamera; alle bekommen Funken) ---
let blitzK = 0, blitzFarbe = [1, 1, 1], weiss = 0;
function blitz(k, farbe) {
  const w = blitze.blitz(praes, k);
  if (w > blitzK) { blitzK = w; blitzFarbe = farbe; }
}
function vibriere(ms) {
  // Peters Haptik-Regel: nur große Ereignisse, ≥ 25–35 ms, Mindestabstand
  if (praes - vibLetzt < 1.5 || !navigator.vibrate) return;
  vibLetzt = praes; navigator.vibrate(ms);
}
function ereignisse() {
  for (const t of rennen.alle) {
    const g = t.g, ich = t === spielerT;
    for (const e of g.ereignisse) {
      if (e.art === 'wand' || e.art === 'aufsetzer') funken.spruehe(g.p, g.v, ich ? 40 : 15, 16);
      if (!ich) continue;
      switch (e.art) {
        case 'pad': blitz(0.35 + 0.3 * e.staerke, [0.3, 1, 1]); rig.stoss(0.15); break;
        case 'ring': blitz(0.6, [1, 0.3, 0.9]); hud.meldung('BOOST-RING', praes, 0.8); break;
        case 'wand': blitz(0.4 * e.staerke, [1, 0.25, 0.1]); rig.stoss(0.5 * e.staerke); break;
        case 'landung': if (e.luft > 1.5) { blitz(0.5, [1, 0.9, 0.7]); rig.stoss(0.7); funken.spruehe(g.p, g.v, 60, 20); hud.meldung(`${e.luft.toFixed(1)} s · ${Math.round(e.weite)} m`, praes, 1.4); } break;
        case 'absprung':
          // offline: echter Zeitlupe-Akzent (0,3 s); online: Schein-Akzent (nur Kamera/Ton, Zeit bleibt echt)
          if (!uhr.akzent() && SPIEL.online && ZEIT.slowmo) scheinBis = praes + ZEIT.slowmoDauer;
          break;
        case 'magnet': blitz(0.45, [0.6, 0.25, 1]); vibriere(30); break;
        case 'rolle': hud.meldung('TURBO!', praes, 1); blitz(0.55, [1, 0.85, 0.2]); break;
        case 'patzer': hud.meldung('PATZER', praes, 1); break;
        case 'absturz': hud.meldung('ABFLUG', praes, 1.5); vibriere(60); break;
        case 'runde': hud.meldung(`RUNDE ${Math.min(e.runde + 1, rennen.runden)}`, praes, 1.2); break;
        case 'ziel': hud.meldung(`ZIEL · PLATZ ${e.platz}`, praes, 2.5); vibriere(60); break;
        case 'stoss': rig.stoss(0.3 * e.staerke); break;
        case 'driftStufe': hud.meldung(['', 'DRIFT', 'DRIFT ✦✦', 'DRIFT ✦✦✦'][e.stufe], praes, 0.6); break;
        case 'driftWarnung': hud.meldung('ZU LANG!', praes, 0.6); break;
        case 'miniturbo': blitz(0.35 + 0.15 * e.stufe, DRIFT_FARBEN[e.stufe]); hud.meldung(e.stufe >= 3 ? 'ULTRA-TURBO' : 'MINI-TURBO', praes, 0.9); rig.stoss(0.2); break;
        case 'startboost': blitz(0.6, [0.3, 1, 1]); hud.meldung('START-BOOST!', praes, 1.2); break;
        case 'stotterer': hud.meldung('ÜBERDREHT', praes, 1.2); break;
        case 'treffer': blitz(0.5, [1, 0.2, 0.2]); rig.stoss(0.8); vibriere(40); break;
        case 'abgefangen': hud.meldung('ABGEFANGEN', praes, 1); break;
        case 'neustart': hud.meldung('NEUSTART!', praes, 1); blitz(0.4, [0.3, 1, 0.5]); break;
      }
      if (ton) ton.ereignis(e.art, e.staerke);
    }
  }
  for (const t of rennen.alle) t.g.ereignisse.length = 0;
}

// Drift-Funken je Stufe: cyan → magenta → weiß-gold (HDR für Bloom)
const DRIFT_FARBEN = [[0.6, 2.2, 2.6], [0.6, 2.2, 2.6], [2.6, 0.5, 2.2], [3.2, 2.6, 1.2]];
const startEin = { gas: 0 };
function driftFunken() {
  for (const t of rennen.alle) {
    const g = t.g;
    if (!g.drift.aktiv) continue;
    const s = g.drift.seite, c = DRIFT_FARBEN[g.drift.stufe];
    const p = { x: g.p.x - g.vor.x * 2 - g.links.x * s * 1.2, y: g.p.y - g.vor.y * 2 - g.links.y * s * 1.2 - g.oben.y * 0.6, z: g.p.z - g.vor.z * 2 - g.links.z * s * 1.2 };
    funken.spruehe(p, g.v, t === spielerT ? 3 : 1, 6, c);
  }
}

// „Speed OK“: nächster Absprung in ≤ 900 m voraus → Tempo gegen Mindesttempo × 1,15
const absprungS = bahn.abschnitte.map((a, k) => (a.typ === 'sprung' ? { s: bahn.segStart[k], vmin: SPRUNG_MINDEST[a.name] || 75 } : null)).filter(Boolean);
function speedOk(g) {
  for (const a of absprungS) {
    let d = a.s - g.s; if (d < 0) d += bahn.L;
    if (d < 900) return g.tempo >= a.vmin * 1.15;
  }
  return null;
}

// --- Hauptschleife ---
let tAlt = performance.now() / 1000;
window.__app = { ready: true, frames: 0 };   // wie Stuntbahn: tests/util.py wartet auf ready + frames
function bild() {
  requestAnimationFrame(bild);
  window.__app.frames++;
  const tJetzt = performance.now() / 1000;
  const dt = Math.min(0.1, tJetzt - tAlt); tAlt = tJetzt;
  praes += dt;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  let fx = null;
  if (rennen && laeuft) {
    fx = regie.aktualisiere(praes);
    uhr.faktorExtern = fx.zeitFaktor;          // wirkt nur offline (Uhr ignoriert ihn online)
    const n = uhr.tick(dt);
    const g = spielerT.g;
    for (let i = 0; i < n; i++) {
      const roh = eingabe.lesen(ZEIT.schritt, !g.boden);
      let ein = autopilot ? autopilot.steuer(g, ZEIT.schritt, rennen.gleiter) : hilfe.anwenden(g, roh, ZEIT.schritt, rennen.gleiter);
      // Countdown/Start-Fenster: Start-Boost per Tipp (Taste ↑, Gamepad RT, Touch irgendwo) – kein Auto-Gas, sonst Überdrehen
      if (rennen.phase === 'countdown' || rennen.zeit < GEFUEHL.startfenster) {
        const startGas = autopilot ? autopilot.startGas(rennen.phase === 'countdown' ? -rennen.countdown : rennen.zeit) : (eingabe.startGas() ? 1 : 0);
        startEin.gas = startGas;
        if (rennen.phase === 'countdown') ein = { ...ein, gas: startGas };
      }
      spielerT.ein = ein;
      rennen.schritt(ZEIT.schritt, ein, startEin);
      waechter.pruefe(g, rennen, praes);
      ereignisse();
    }
    driftFunken();
    if (rennen.phase === 'ziel' && laeuft) { laeuft = false; setTimeout(() => hud.ziel(rennen.rangliste, spielerT.k), 1500); }
    rennen.alle.forEach((t, k) => { meshes[k].setzeLage(t.g); meshes[k].update(dt, t.g, t === spielerT ? spielerT.ein : t.pilot && t.pilot.ein); });
    rig.update(dt, g, fx);
    const schein = praes < scheinBis ? 1 : 0;   // Schein-Akzent online: kurzer Ran-Zoom statt Zeitlupe
    rig.fov -= 8 * schein;
    wendeAn(camera, rig);
    hud.update({
      tempo: g.tempo, platz: spielerT.platz, von: rennen.alle.length, runde: spielerT.runde, runden: rennen.runden,
      zeit: rennen.zeit - spielerT.rundenStart, beste: spielerT.beste, schild: g.schild, boost: g.boost / 0.7,
      magnet: !!(g.q.flags & F_MAGNET), speedOk: speedOk(g), countdown: rennen.countdown,
    }, praes);
    if (ton) ton.update({ tempo: g.tempo, vmax: GLEITER.vmax, boost: g.boost, magnet: g.magnet, wand: g.wandKontakt > 0, luft: !g.boden, tonFaktor: fx.ton * (praes < scheinBis ? 0.8 : 1) });
  } else {
    if (ton) ton.ruhe();
    // Menü: langsame Kamerafahrt über die Strecke
    const s = (praes * 40) % bahn.L, i = Math.floor(s / bahn.ds);
    camera.position.set(bahn.px[i] + 60, bahn.py[i] + 40, bahn.pz[i] + 60);
    camera.up.set(0, 1, 0);
    camera.lookAt(bahn.px[i], bahn.py[i], bahn.pz[i]);
  }
  himmel.update(praes, camera.position);
  bahnMesh.update(praes, { blitze, boost: rennen && laeuft ? Math.min(1, spielerT.g.boost) : 0 });
  if (stadt) stadt.update(praes);
  if (regen) regen.update(dt, camera.position, rennen ? spielerT.g.v : { x: 0, y: 0, z: 0 }, 1);
  funken.update(dt);
  // Blitze abklingen lassen (Kino-Look: Bloom-Puls + Farbblitz)
  blitzK = Math.max(0, blitzK - dt * 4);
  weiss = fx ? fx.weiss : 0;
  const g = rennen ? spielerT.g : null;
  kino.render(scene, camera, {
    dt, run: !!(rennen && laeuft),
    speed: g ? g.tempo * 0.4 : 0,              // TODO Heavy-Job: Unschärfe-Skala (Kino-Look ist auf 80–190 km/h geeicht)
    boost: g ? Math.min(1, g.boost) : 0, car: meshes[0] ? meshes[0].gruppe : null,
    flash: { k: blitzK, col: blitzFarbe }, white: weiss,
  });
}
requestAnimationFrame(bild);
if (q.get('autostart') === '1') starte(hud.einst);

// Qualitäts-Automatik (einfach): Bildrate je Sekunde → Kino-Look passt die Renderskala an. TODO Heavy-Job: Grafik-
// Autopilot aus der Stuntbahn (kern/autopilot.js) übernehmen, sobald das Mess-Gate läuft.
let fpsN = 0, fpsT = 0;
(function fpsMessen() {
  requestAnimationFrame(fpsMessen);
  fpsN++;
  const t = performance.now() / 1000;
  if (!fpsT) fpsT = t;
  if (t - fpsT >= 1) { const fps = fpsN / (t - fpsT); fpsN = 0; fpsT = t; if (laeuft && !q.has('look')) kino.adapt(fps); window.__hb.fps = fps; }
})();

// für Mess-/Abnahme-Skripte des Heavy-Jobs (Screenshots, Collagen, Mess-Gate)
window.__hb = {
  bahn, plan, kino, renderer, blitze, fps: 0,
  get rennen() { return rennen; }, get spieler() { return spielerT && spielerT.g; },
  starte: () => starte(hud.einst), regie: () => regie,
  // Action-Moment sofort auslösen (Bildfolgen für die Collage): art z. B. 'sprungScheitel', 'ueberholen', 'beinahe'
  moment: (art = 'sprungScheitel') => { if (!regie) return null; regie.letzt = -Infinity; const g = spielerT.g; return regie.melde(art, 1, { x: g.p.x, y: g.p.y, z: g.p.z }, {}, praes); },
  // Spieler an eine Stelle setzen (s in m oder Abschnittsname), Tempo v (m/s)
  setze: (wo, v = GLEITER.vmax) => {
    const k = typeof wo === 'string' ? bahn.abschnitte.findIndex((a) => a.name === wo) : -1;
    const s = k >= 0 ? bahn.segStart[k] : +wo;
    spielerT.g.setzeAuf(s, 0, v); spielerT.sAlt = spielerT.g.s; rig.init = false;
  },
};
