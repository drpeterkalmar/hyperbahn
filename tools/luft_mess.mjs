// Luft-Messung (Etappe 0a, Peter 20.10.: „kein Abschmieren in der Luft, wenn ich Pfeil hinauf halte“): Spieler-Profile
// über beide Riesensprünge (mit und ohne Pad-Kette) – Tasten laufen durch die echte Eingabe (game/eingabe.js), damit die
// Eingabe-Logik mitgemessen wird; Lenkung = einfacher Spurhalter, Gas immer voll (Auto-Gas bzw. ↑ gehalten).
// Profile:
//   neutral       keine Taste in der Luft
//   hoch          ↑ dauerhaft gehalten (über den Absprung und den ganzen Flug)
//   kurz T        ↑ gehalten, in der Luft kurz los (0,25 s) und NEU gedrückt für T s (Nase senken = kürzer)
//   weit T        ↓ in der Luft für T s (Nase heben = weiter); T aus einem Raster, bestes sauberes Ergebnis zählt
// Je Sprung: Absturz, Bauchlandung (Nase > 20° gegen die Fahrfläche, schief > 45°, Patzer), harte Landung, Airtime, Weite.
// Aufruf: node tools/luft_mess.mjs [url-regler] [strecke]   z. B. node tools/luft_mess.mjs "?nase=alt"  ·  node tools/luft_mess.mjs wueste
// P2: andere Strecken – Sprünge aus den Abschnitten (typ 'sprung', Anlauf = Abschnitt vor der Absprung-Rampe), je mit und
// ohne Pads (seitlich an der Kette vorbei)
import { leseRegler, GLEITER, ZEIT } from '../src/config.js';
import { baueStrecke } from '../src/track/alle.js';
import { Gleiter } from '../src/physics/gleiter.js';
import { Eingabe } from '../src/game/eingabe.js';
import { bauePlan, Pilot, PROFILE as PROFILE_KI } from '../src/ai/pilot.js';
import { F_PAD } from '../src/track/bahn.js';

const dt = ZEIT.schritt;

function spur(g, uZiel) {
  const q = g.q;
  const vt = g.v.x * q.T.x + g.v.y * q.T.y + g.v.z * q.T.z, vl = g.v.x * q.Ls.x + g.v.y * q.Ls.y + g.v.z * q.Ls.z;
  const e = Math.atan2(vl, Math.max(vt, 1));
  return Math.max(-1, Math.min(1, 0.05 * (uZiel - g.u) - 2.2 * e));
}

// tasten(luftZeit, inLuft) → { hoch, runter }
export const PROFILE = {
  neutral: () => () => ({ hoch: false, runter: false }),
  hoch: () => () => ({ hoch: true, runter: false }),
  kurz: (T) => (lz, luft) => ({ hoch: !luft || lz < 0.25 || (lz >= 0.35 && lz < 0.35 + T), runter: false }),
  weit: (T) => (lz, luft) => ({ hoch: false, runter: luft && lz >= 0.2 && lz < 0.2 + T }),
};

// ein Sprung: Start vor dem Anlauf (Pads mittig bzw. seitlich daran vorbei), bis zur Landung + 1 s
export function sprungMessen(bahn, { anlauf, sprung, u, tasten }) {
  const k = bahn.abschnitte.findIndex((a) => a.name === anlauf);
  const ks = bahn.abschnitte.findIndex((a) => a.name === sprung);
  const sEnde = bahn.segStart[ks] + 1400;
  const g = new Gleiter(bahn, { s: bahn.segStart[k] - 30, u, v0: GLEITER.vmax });
  const ein = new Eingabe(null);
  let n = 0, warLuft = false, landung = null, nach = 0, vAb = 0, luftMax = 0, nickMin = 0, nickMax = 0;
  while (n++ < 40 / dt && g.zustand === 'fahrt' && g.s < sEnde) {
    const t = tasten(g.luftZeit, !g.boden);
    ein.tasten.clear();
    if (t.hoch) ein.tasten.add('ArrowUp');
    if (t.runter) ein.tasten.add('ArrowDown');
    const roh = ein.lesen(dt, !g.boden);
    if (g.boden) vAb = g.tempo;
    // Nase gegen die Flugbahn (Grad, + = über der Flugbahn)
    if (!g.boden && g.luftZeit > 0.1) {
      const vl = Math.hypot(g.v.x, g.v.y, g.v.z) || 1;
      const nick = Math.asin(Math.max(-1, Math.min(1, -(g.v.x * g.oben.x + g.v.y * g.oben.y + g.v.z * g.oben.z) / vl))) * 180 / Math.PI;
      nickMin = Math.min(nickMin, nick); nickMax = Math.max(nickMax, nick);
    }
    const lz = g.luftZeit;
    g.schritt(dt, { gas: 1, lenk: spur(g, u), bremseL: 0, bremseR: 0, nase: roh.nase, rolle: 0 });
    if (!g.boden) { warLuft = true; luftMax = Math.max(luftMax, g.luftZeit); }
    if (warLuft && g.boden && !landung && lz > 1.5) {
      const q = g.q;
      const pitch = Math.asin(Math.max(-1, Math.min(1, g.vor.x * q.Us.x + g.vor.y * q.Us.y + g.vor.z * q.Us.z))) * 180 / Math.PI;
      const aufrecht = g.oben.x * q.Us.x + g.oben.y * q.Us.y + g.oben.z * q.Us.z;
      landung = { luft: lz, pitch, aufrecht, v: g.tempo, aufsetzer: 0, patzer: 0 };
    }
    if (landung) {
      for (const e of g.ereignisse) { if (e.art === 'aufsetzer') landung.aufsetzer = Math.max(landung.aufsetzer, e.staerke); if (e.art === 'patzer') landung.patzer++; }
      nach += dt;
      if (nach > 1) break;
    }
    g.ereignisse.length = 0;
  }
  const sp = g.statistik.sprunge[0];
  const absturz = g.statistik.sprungAbstuerze > 0 || g.zustand !== 'fahrt' || !sp;
  // Bauchlandung = Nase > 20° gegen die Fahrfläche, schief > 45° oder Patzer; hart = Aufsetzer ≥ 0,3 (≈ 7,5 m/s senkrecht)
  const bauch = !!landung && (Math.abs(landung.pitch) > 20 || landung.aufrecht < 0.7 || landung.patzer > 0);
  const hart = !!landung && landung.aufsetzer >= 0.3;
  return { absturz, bauch, hart, luft: sp ? sp.luft : luftMax, weite: sp ? sp.weite : 0, vAb: g.absprung ? g.absprung.v : sp ? sp.v : vAb, grund: g.absturzGrund, landung, nickMin, nickMax };
}

export const SPRUENGE = [
  { name: 'Häuserschlucht mit Pads', anlauf: 'Häuserschlucht Anlauf', sprung: 'Häuserschlucht', u: 0 },
  { name: 'Häuserschlucht ohne Pads', anlauf: 'Häuserschlucht Anlauf', sprung: 'Häuserschlucht', u: 11 },
  { name: 'Neon-Schlucht mit Pads', anlauf: 'Hafen Anlauf', sprung: 'Neon-Schlucht', u: 0 },
  { name: 'Neon-Schlucht ohne Pads', anlauf: 'Hafen Anlauf', sprung: 'Neon-Schlucht', u: 11 },
];
export const RASTER = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5, 2.0, 3.0, 5.0];

// Sprünge einer Strecke: Megastadt wie bisher (feste Liste), sonst aus den Abschnitten abgeleitet
export function spruengeVon(bahn) {
  if (bahn.id === 'megastadt' || bahn.id === 'megastadt-lang') return SPRUENGE;
  const out = [];
  bahn.abschnitte.forEach((a, k) => {
    if (a.typ !== 'sprung') return;
    const anlauf = bahn.abschnitte[k - 2].name;
    // seitlicher Versatz neben die Pads: größter |u| ohne Pad im Anlauf (Pads liegen meist mittig)
    const s0 = bahn.segStart[k - 2], pads = bahn.pads.filter((p) => p.s0 >= s0 - 1 && p.s0 < bahn.segStart[k]);
    const hw = bahn.hw[Math.round(s0 / bahn.ds) % bahn.N];
    const u = pads.length ? (Math.max(...pads.map((p) => p.u + p.b)) + 2 < hw - 2 ? Math.min(hw - 2.5, Math.max(...pads.map((p) => p.u + p.b)) + 2.5) : Math.max(-hw + 2.5, Math.min(...pads.map((p) => p.u - p.b)) - 2.5)) : 0;
    out.push({ name: `${a.name} mit Pads`, anlauf, sprung: a.name, u: pads.length ? pads[0].u : 0 });
    if (pads.length) out.push({ name: `${a.name} ohne Pads`, anlauf, sprung: a.name, u });
  });
  void F_PAD;
  return out;
}

export function luftMessung(regler = '', strecke = 'megastadt') {
  leseRegler(regler);
  const bahn = baueStrecke(strecke);
  const zeilen = [];
  for (const sp of spruengeVon(bahn)) {
    const neutral = sprungMessen(bahn, { ...sp, tasten: PROFILE.neutral() });
    const hoch = sprungMessen(bahn, { ...sp, tasten: PROFILE.hoch() });
    // Kürzer/Weiter-Spanne: bestes sauberes Ergebnis über das Halte-Raster
    let kurz = null, weit = null;
    for (const T of RASTER) {
      const rk = sprungMessen(bahn, { ...sp, tasten: PROFILE.kurz(T) });
      if (!rk.absturz && !rk.bauch && (!kurz || rk.weite < kurz.weite)) kurz = { ...rk, T };
      const rw = sprungMessen(bahn, { ...sp, tasten: PROFILE.weit(T) });
      if (!rw.absturz && !rw.bauch && (!weit || rw.weite > weit.weite)) weit = { ...rw, T };
    }
    // „aktiv“ ohne Rücksicht: längstes Halten (Nase ganz runter/hoch) – zählt Abstürze/Bauchlandungen
    const kurzLang = sprungMessen(bahn, { ...sp, tasten: PROFILE.kurz(5) });
    const weitLang = sprungMessen(bahn, { ...sp, tasten: PROFILE.weit(5) });
    zeilen.push({ sprung: sp.name, neutral, hoch, kurz, weit, kurzLang, weitLang });
  }
  return zeilen;
}

// ganze Runden mit dem KI-Fahrer als Lenker (Pads, Kurven, Kuppen, Drift-Hüpfer) und ↑ dauerhaft durch die echte Eingabe:
// alle Luft-Phasen > 0,4 s, Abflüge, schiefe Landungen
export function rundenMessung(regler = '', runden = 2, profil = 'mittel', strecke = 'megastadt') {
  leseRegler(regler);
  const bahn = baueStrecke(strecke), plan = bauePlan(bahn);
  const g = new Gleiter(bahn, { s: 5, v0: 0 }), pi = new Pilot(bahn, plan, PROFILE_KI[profil], 7), ein = new Eingabe(null);
  ein.tasten.add('ArrowUp');
  const erg = { luft: 0, abfluege: 0, schief: 0, maxLuft: 0, zeit: 0 };
  let lzAlt = 0, gefahren = 0, s0 = g.s;
  for (let n = 0; n < 240 * 400 * runden && gefahren < bahn.L * runden; n++) {
    const roh = ein.lesen(dt, !g.boden);
    const e = pi.steuer(g, dt, []);
    g.schritt(dt, { ...e, gas: 1, nase: roh.nase, rolle: 0 });
    if (g.boden && lzAlt > 0.4) {
      erg.luft++; erg.maxLuft = Math.max(erg.maxLuft, lzAlt);
      const q = g.q, pitch = Math.asin(Math.max(-1, Math.min(1, g.vor.x * q.Us.x + g.vor.y * q.Us.y + g.vor.z * q.Us.z))) * 180 / Math.PI;
      if (Math.abs(pitch) > 20) erg.schief++;
    }
    lzAlt = g.luftZeit;
    for (const ev of g.ereignisse) if (ev.art === 'absturz') erg.abfluege++;
    g.ereignisse.length = 0;
    if (g.zustand === 'fahrt') { let d = g.s - s0; if (d < -bahn.L / 2) d += bahn.L; if (d > bahn.L / 2) d -= bahn.L; if (Math.abs(d) < 80) gefahren += d; }
    s0 = g.s; erg.zeit = g.zeit;
  }
  return erg;
}

if (process.argv[1] && process.argv[1].endsWith('luft_mess.mjs')) {
  const args = process.argv.slice(2);
  const regler = args.find((a) => a.startsWith('?')) || '', strecke = args.find((a) => !a.startsWith('?')) || 'megastadt';
  const z = luftMessung(regler, strecke);
  console.log(`Strecke ${strecke}`);
  const f = (r) => r ? `${r.absturz ? 'ABSTURZ(' + r.grund + ')' : r.bauch ? 'BAUCH' : r.hart ? 'ok (hart)' : 'ok'} ${r.luft.toFixed(2)} s ${r.weite.toFixed(0)} m${r.landung ? ` (Nase ${r.landung.pitch.toFixed(0)}°)` : ''}` : '–';
  console.log(`Luft-Messung ${regler || '(Standard)'}`);
  let abst = 0, bauch = 0, spanne = 0;
  for (const r of z) {
    console.log(`\n${r.sprung}  (Absprung ${r.neutral.vAb.toFixed(0)} m/s)`);
    console.log(`  neutral        ${f(r.neutral)}  Nase/Flugbahn ${r.neutral.nickMin.toFixed(0)}…${r.neutral.nickMax.toFixed(0)}°`);
    console.log(`  ↑ dauerhaft    ${f(r.hoch)}  Nase/Flugbahn ${r.hoch.nickMin.toFixed(0)}…${r.hoch.nickMax.toFixed(0)}°`);
    console.log(`  kürzer (best)  ${f(r.kurz)}${r.kurz ? ` T=${r.kurz.T}` : ''}`);
    console.log(`  weiter (best)  ${f(r.weit)}${r.weit ? ` T=${r.weit.T}` : ''}`);
    console.log(`  ↑ neu 5 s      ${f(r.kurzLang)}`);
    console.log(`  ↓ 5 s          ${f(r.weitLang)}`);
    const sp = r.kurz && r.weit ? r.weit.weite - r.kurz.weite : 0;
    console.log(`  Spanne kürzer↔weiter ${sp.toFixed(0)} m`);
    abst += r.hoch.absturz ? 1 : 0; bauch += r.hoch.bauch ? 1 : 0; spanne += sp;
  }
  console.log(`\nSumme ↑ dauerhaft: ${abst} Abstürze, ${bauch} Bauchlandungen; Spanne gesamt ${spanne.toFixed(0)} m`);
  for (const p of ['mittel', 'profi']) {
    const r = rundenMessung(regler, 2, p, strecke);
    console.log(`2 Runden, KI-Lenker ${p}, ↑ dauerhaft: ${r.luft} Luft-Phasen > 0,4 s (längste ${r.maxLuft.toFixed(1)} s), ${r.abfluege} Abflüge, ${r.schief} schiefe Landungen (> 20°), ${r.zeit.toFixed(0)} s`);
  }
}
