// P3 Feld-Messung (Peter 26.10.: „sonst wird's langweilig, weil immer alle genau gleich schnell dahingleiten“): Rennen wie im
// Spiel – 7 KI-Gegner mit dem Menü-Profil (Standard „Mittel“), Klassen leicht/mittel/schwer im Wechsel, Spieler „DU“ auf
// Startplatz 6 (als Mensch gewertet, gefahren von einem Piloten „Mittel“ ohne Streuung) –, Rundenzahl je Strecke.
// Gemessen (ab 8 s nach Grün, alle 0,25 s): Positionswechsel je Runde (Überholungen: Paar tauscht die Reihenfolge, danach ≥ 10 m Vorsprung), Tempo-Streuung im
// Feld (Standardabweichung, km/h wie im HUD), Tempo-Unterschied zum Nachbarn (Paare < 60 m), Abstand 1.–8. (s), Anteil Zeit
// im Boost, Anteil Zeit im Windschatten, Abflüge, Wandtreffer, Rundenzeiten und Rennlänge.
// Aufruf: node tools/feld_mess.mjs [strecke|alle] [laeufe=3] [?regler] [--json datei]
import { leseRegler, ZEIT, GLEITER, ANZEIGE } from '../src/config.js';
import { leseGefuehl, KLASSEN_LISTE } from '../src/physics/fahrgefuehl.js';
import { baueStrecke } from '../src/track/alle.js';
import { rundenDer } from '../src/track/strecken.js';
import { RENNDAUER } from '../src/track/runden.js';
import { bauePlaene, wegFuer, Pilot, PROFILE } from '../src/ai/pilot.js';
import { Rennen, TEAMS } from '../src/game/rennen.js';
import { writeFileSync } from 'node:fs';

export const STRECKEN = ['megastadt', 'wueste', 'riff', 'gebirge', 'orbit'];
const KMH = 3.6 * ANZEIGE.faktor, HYST = 10;   // m Hysterese einer Überholung

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const mittel = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

// ein Rennen wie im Spiel; lauf = 0, 1, 2 … verschiebt die Seeds (andere Fehler/Linien der KI)
export function feldRennen(id, lauf = 0, regler = '', ki = 'mittel') {
  const q = leseRegler(regler); leseGefuehl(regler);
  void q;
  const bahn = baueStrecke(id);
  const plaene = bauePlaene(bahn);
  const runden = rundenDer(id);
  const teil = [];
  for (let k = 1; k <= 7; k++) {
    const seed = 100 + k * 13 + lauf * 1000;
    teil.push({ ...TEAMS[k], klasse: KLASSEN_LISTE[k % 3], pilot: new Pilot(bahn, plaene[wegFuer(PROFILE[ki], seed)], PROFILE[ki], seed) });
  }
  const ich = new Pilot(bahn, plaene.sicher, { ...PROFILE.mittel, streu: 0 }, 7 + lauf * 1000);
  teil.splice(5, 0, { ...TEAMS[0], name: 'DU', klasse: 'mittel', pilot: ich, spieler: true });
  const r = new Rennen(bahn, teil, { runden });
  const dt = ZEIT.schritt, takt = Math.round(0.25 / dt), vref = GLEITER.vmax * 0.95;
  const m = { wechsel: 0, wechselDu: 0, sd: [], nachbar: [], spanne: [], boost: 0, sog: 0, proben: 0, schleuder: 0, pads: 0 };
  let alt = null, n = 0;
  while (r.phase !== 'ziel' && n < 240 * 400) {
    r.schritt(dt, null);
    n++;
    for (const g of r.gleiter) {
      for (const e of g.ereignisse) { if (e.art === 'schleuder') m.schleuder++; if (e.art === 'pad') m.pads++; }
      g.ereignisse.length = 0;
    }
    if (r.phase !== 'rennen' || r.zeit < 8 || n % takt) continue;
    const offen = r.alle.filter((t) => !t.ziel && t.g.zustand === 'fahrt');
    // Positionswechsel (Überholungen): Paar dreht seine Reihenfolge um und liegt danach ≥ HYST m vor dem anderen (Hysterese:
    // Seite an Seite hin und her zählt nicht)
    if (!alt) alt = new Map();
    for (let i = 0; i < r.alle.length; i++) for (let j = i + 1; j < r.alle.length; j++) {
      const a = r.alle[i], b = r.alle[j];
      if (a.ziel || b.ziel) continue;
      const d = a.fortschritt - b.fortschritt, key = i * 8 + j;
      if (Math.abs(d) < HYST) continue;
      const vorz = Math.sign(d), war = alt.get(key);
      if (war && war !== vorz) { m.wechsel++; if (a.spieler || b.spieler) m.wechselDu++; }
      alt.set(key, vorz);
    }
    if (offen.length >= 2) {
      const v = offen.map((t) => t.g.tempo * KMH), mv = mittel(v);
      m.sd.push(Math.sqrt(mittel(v.map((x) => (x - mv) ** 2))));
      const f = offen.map((t) => t.fortschritt);
      m.spanne.push((Math.max(...f) - Math.min(...f)) / vref);
      for (let i = 0; i < offen.length; i++) for (let j = i + 1; j < offen.length; j++) {
        if (Math.abs(offen[i].fortschritt - offen[j].fortschritt) < 60) m.nachbar.push(Math.abs(offen[i].g.tempo - offen[j].g.tempo) * KMH);
      }
    }
    for (const t of offen) {
      m.proben++;
      if (t.g.boost > 0.01 || t.g.mt > 0.01) m.boost++;
      if ((t.g.sog || 0) > 0.2) m.sog++;
    }
  }
  const ziele = r.alle.filter((t) => t.ziel).map((t) => t.ziel.zeit);
  const runde = []; for (const t of r.alle) runde.push(...t.rundenZeiten.slice(0, runden));
  const minuten = r.alle.reduce((s, t) => s + (t.ziel ? t.ziel.zeit : r.zeit), 0) / 60;
  return {
    id, lauf, runden, phase: r.phase,
    wechselJeRunde: m.wechsel / runden, wechselDuJeRunde: m.wechselDu / runden,
    sdKmh: mittel(m.sd), nachbarKmh: mittel(m.nachbar), spanneS: mittel(m.spanne),
    zielSpanne: ziele.length ? Math.max(...ziele) - Math.min(...ziele) : NaN,
    boostAnteil: m.boost / Math.max(1, m.proben), sogAnteil: m.sog / Math.max(1, m.proben), schleuder: m.schleuder, pads: m.pads,
    abfluege: r.alle.reduce((s, t) => s + t.g.statistik.abfluege, 0),
    wandJeMin: r.alle.reduce((s, t) => s + t.g.statistik.wandTreffer, 0) / Math.max(minuten, 1e-6),
    rundeMedian: median(runde), sieger: Math.min(...ziele), letzter: Math.max(...ziele),
    rennenLetzter: RENNDAUER.countdown + Math.max(...ziele),
    du: r.alle.find((t) => t.spieler).ziel?.platz,
  };
}

export function feldMessung(ids = STRECKEN, laeufe = 3, regler = '', ki = 'mittel') {
  const zeilen = [];
  for (const id of ids) {
    const l = [];
    for (let k = 0; k < laeufe; k++) l.push(feldRennen(id, k, regler, ki));
    const z = { id, runden: l[0].runden, laeufe };
    for (const key of ['wechselJeRunde', 'wechselDuJeRunde', 'sdKmh', 'nachbarKmh', 'spanneS', 'zielSpanne', 'boostAnteil', 'sogAnteil', 'schleuder', 'pads', 'wandJeMin', 'rundeMedian', 'sieger', 'letzter', 'rennenLetzter'])
      z[key] = mittel(l.map((x) => x[key]));
    z.abfluege = l.reduce((s, x) => s + x.abfluege, 0);
    z.duPlatz = l.map((x) => x.du);
    zeilen.push(z);
  }
  return zeilen;
}

export function tabelle(zeilen) {
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
  const out = ['| Strecke | Runden | Positionswechsel je Runde (mit DU) | Tempo-SD Feld km/h | Δ Nachbar km/h | Abstand 1.–8. Ø s | Ziel 1.–8. s | Boost-Anteil | Windschatten-Anteil | Schleuder je Rennen | Pads je Rennen | Abflüge | Wand je Gleiter-min | Runde Median | Rennen Letzter | DU Platz |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const z of zeilen) {
    out.push(`| ${z.id} | ${z.runden} | ${f(z.wechselJeRunde)} (${f(z.wechselDuJeRunde)}) | ${f(z.sdKmh)} | ${f(z.nachbarKmh)} | ${f(z.spanneS)} | ${f(z.zielSpanne)} | ${f(z.boostAnteil * 100, 0)} % | ${f(z.sogAnteil * 100, 0)} % | ${f(z.schleuder)} | ${f(z.pads, 0)} | ${z.abfluege} | ${f(z.wandJeMin, 2)} | ${f(z.rundeMedian)} | ${Math.floor(z.rennenLetzter / 60)}:${String(Math.round(z.rennenLetzter % 60)).padStart(2, '0')} | ${z.duPlatz.join('/')} |`);
  }
  return out.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('feld_mess.mjs')) {
  const a = process.argv.slice(2);
  const ji = a.indexOf('--json'), json = ji >= 0 ? a.splice(ji, 2)[1] : null;
  const regler = a.find((x) => x.startsWith('?')) || '';
  const rest = a.filter((x) => !x.startsWith('?'));
  const ids = !rest[0] || rest[0] === 'alle' ? STRECKEN : rest[0].split(',');
  const t0 = Date.now();
  const zeilen = feldMessung(ids, +(rest[1] || 3), regler, (regler.match(/ki=(\w+)/) || [])[1] || 'mittel');
  console.log(`Feld-Messung ${regler || '(Standard)'} – ${zeilen[0].laeufe} Läufe je Strecke, KI „Mittel“ + DU (Startplatz 6), ${((Date.now() - t0) / 1000).toFixed(0)} s Rechenzeit`);
  console.log(tabelle(zeilen));
  if (json) writeFileSync(json, JSON.stringify(zeilen, null, 1));
}
