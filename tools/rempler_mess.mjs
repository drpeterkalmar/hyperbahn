// Rempler-Messung (p1c, Peter 22.10.: „Zusammenstöße mit anderen Gleitern sind sehr hart“): Bot-Rennen ohne Browser, 8 Gleiter
// (Spieler = Autopilot „mittel“ in der gewählten Klasse, 7 KI mit gemischten Klassen wie im Spiel), viele Durchgänge.
// Je Rempler (Kontakt-Episode zweier Gleiter, Impulse ohne Pause > 0,3 s, je beteiligtem Gleiter): Tempo-Änderung durch den Stoß (längs), Quer-Stoß (in der Fahrfläche),
// senkrechter Anteil, Querversatz 0,5 s danach, Absturz bzw. Wandtreffer ≤ 3 s / 1 s danach. Dazu: Kontakte mit dem
// Spieler je Rennen (Spieler-Bot weicht selbst nicht aus), davon „KI fährt auf den Spieler auf“ (KI ist der Schnellere und kommt von hinten/seitlich).
// Aufruf: node tools/rempler_mess.mjs [rennen=12] [runden=2] [url-regler, z. B. "?stoss=alt&ausweich=0" = Stand 0.1.1]
import { leseRegler, ZEIT } from '../src/config.js';
import { leseGefuehl, GEFUEHL, KLASSEN_LISTE } from '../src/physics/fahrgefuehl.js';
import { strecke1 } from '../src/track/strecke1.js';
import { bauePlan, Pilot, PROFILE, AUSWEICH } from '../src/ai/pilot.js';
import { Rennen, TEAMS } from '../src/game/rennen.js';

export function remplerMess(rennen = 12, runden = 2, regler = '') {
  leseRegler(regler); leseGefuehl(regler);
  // ?ausweich=0: KI-Ausweichen wie bis 0.1.1 (nur voraus, ohne Seite-an-Seite)
  if (new URLSearchParams(regler).get('ausweich') === '0') { AUSWEICH.seite = 0; AUSWEICH.vorn = 0; }
  const bahn = strecke1(), plan = bauePlan(bahn), dt = ZEIT.schritt;
  const proben = [];   // Rempler = Kontakt-Episode eines Gleiters mit einem anderen (Impulse ohne Pause > 0,3 s), Δv aufsummiert
  const offen = new Map();   // "id:mit" → Episode
  let spielerRempler = 0, kiAufSpieler = 0, abfluegeGesamt = 0, abfluegeNachRempler = 0, sekunden = 0;
  const spielerKlassen = ['leicht', 'mittel', 'schwer'];
  for (let r = 0; r < rennen; r++) {
    const profile = ['mittel', 'profi', 'profi', 'mittel', 'mittel', 'mittel', 'leicht', 'leicht'];
    const teil = TEAMS.map((t, k) => ({ ...t, klasse: k === 0 ? spielerKlassen[r % 3] : KLASSEN_LISTE[(k + r) % 3], spieler: k === 0,
      pilot: new Pilot(bahn, plan, PROFILE[profile[k]], 500 * r + 37 * k + 3) }));
    // Spieler startet hinten (wie im Spiel Platz 6 von 8) → Überholen und Pulk
    const sp = teil.splice(0, 1)[0]; teil.splice(5, 0, sp);
    const rn = new Rennen(bahn, teil, { runden, ohneCountdown: true });
    const spieler = rn.alle.find((t) => t.spieler).g;
    // Spieler-Bot weicht nicht aus (wie ein Mensch, der stur seine Linie fährt) → misst, ob die KI ihm ausweicht
    const sp0 = rn.alle.find((t) => t.spieler).pilot, st0 = sp0.steuer.bind(sp0);
    sp0.steuer = (g, d) => st0(g, d, []);
    const letzterRempler = new Map(), aufZuletzt = new Map();   // Gleiter → Zeit des letzten Rempler-Beginns
    offen.clear();
    let n = 0;
    const schliesse = (key, ep) => { offen.delete(key); };
    while (rn.phase !== 'ziel' && n++ < 240 * 200 * runden) {
      rn.schritt(dt, null);
      for (const g of rn.gleiter) {
        for (const e of g.ereignisse) {
          if (e.art === 'absturz') {
            abfluegeGesamt++;
            if (g.zeit - (letzterRempler.get(g) ?? -99) <= 3) abfluegeNachRempler++;
          }
          if (e.art !== 'stoss' || !e.dv) continue;
          const [x, y, z] = e.dv, key = g.id + ':' + e.mit;
          let ep = offen.get(key);
          if (!ep) {
            ep = { klasse: g.klasse, spieler: g === spieler, rel: 0, t0: g.zeit, tLetzt: g.zeit, g, u0: g.u, wand: g.statistik.wandTreffer, ab: g.statistik.abfluege, dl: 0, dq: 0, du: 0 };
            offen.set(key, ep); proben.push(ep); letzterRempler.set(g, g.zeit);
            if (g === spieler) {
              spielerRempler++;
              const o = rn.gleiter[e.mit];
              let ds = spieler.s - o.s; if (ds < -bahn.L / 2) ds += bahn.L; if (ds > bahn.L / 2) ds -= bahn.L;
              // gleiche KI erst nach 2 s ohne Kontakt wieder zählen (sonst zählt ein Schleif-Kontakt mehrfach); Startgedränge (< 5 s) nicht
              if (rn.zeit > 5 && o.tempo > spieler.tempo + 5 && ds > 1 && g.zeit - (aufZuletzt.get(e.mit) ?? -99) > 2) {
                kiAufSpieler++;
                if (process.env.REMPLER_LOG) console.log('auf', r, rn.zeit.toFixed(1), spieler.s.toFixed(0), bahn.abschnitte[bahn.seg[Math.floor(spieler.hint) % bahn.N]]?.name, 'du', (o.u - spieler.u).toFixed(1), 'ds', ds.toFixed(1), 'dv', (o.tempo - spieler.tempo).toFixed(1));
              }
            }
          }
          if (g === spieler) aufZuletzt.set(e.mit, g.zeit);
          ep.tLetzt = g.zeit; ep.rel = Math.max(ep.rel, e.rel);
          ep.dl += x * g.vor.x + y * g.vor.y + z * g.vor.z;
          ep.dq += x * g.links.x + y * g.links.y + z * g.links.z;
          ep.du += x * g.oben.x + y * g.oben.y + z * g.oben.z;
        }
        g.ereignisse.length = 0;
      }
      for (const [key, ep] of offen) {
        const g = ep.g, t = g.zeit - ep.t0;
        if (ep.quer == null && t >= 0.5) ep.quer = g.zustand === 'fahrt' ? Math.abs(g.u - ep.u0) : null;
        if (ep.wandNach == null && t >= 1) ep.wandNach = g.statistik.wandTreffer > ep.wand;
        if (g.zeit - ep.tLetzt > 0.3 && t >= 3) { ep.absturz = g.statistik.abfluege > ep.ab; schliesse(key, ep); }
      }
    }
    for (const ep of offen.values()) ep.absturz = ep.g.statistik.abfluege > ep.ab;
    sekunden += rn.zeit;
  }
  for (const p of proben) { p.dvLaengs = p.dl; p.dvQuer = Math.abs(p.dq); p.dvOben = Math.abs(p.du); }
  return { proben, spielerRempler, kiAufSpieler, abfluegeGesamt, abfluegeNachRempler, sekunden, rennen, runden };
}

const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const p95 = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };
const f = (x, n = 1) => (Number.isFinite(x) ? x.toFixed(n).replace('.', ',') : '–');

export function zeilen(m, name) {
  const out = [];
  const gruppen = [['alle', () => true], ['Leicht', (p) => p.klasse === 'leicht'], ['Mittel', (p) => p.klasse === 'mittel'], ['Schwer', (p) => p.klasse === 'schwer'],
    ['großer Tempounterschied (> 15 m/s)', (p) => p.rel > 15]];
  for (const [g, filt] of gruppen) {
    const ps = m.proben.filter(filt);
    const kmh = (x) => x * 3.6;
    out.push(`| ${name} | ${g} | ${ps.length} | ${f(kmh(med(ps.map((p) => -p.dvLaengs))))} / ${f(kmh(p95(ps.map((p) => -p.dvLaengs))))} | ${f(kmh(med(ps.map((p) => p.dvQuer))))} / ${f(kmh(p95(ps.map((p) => p.dvQuer))))} | ${f(p95(ps.map((p) => p.dvOben)), 2)} | ${f(med(ps.filter((p) => p.quer != null).map((p) => p.quer)), 2)} / ${f(p95(ps.filter((p) => p.quer != null).map((p) => p.quer)), 2)} | ${ps.filter((p) => p.wandNach).length} | ${ps.filter((p) => p.absturz).length} |`);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('rempler_mess.mjs')) {
  const t0 = Date.now();
  const rennen = +(process.argv[2] || 12), runden = +(process.argv[3] || 2), regler = process.argv[4] || '';
  const m = remplerMess(rennen, runden, regler);
  const name = (GEFUEHL.stossModus === 'alt' ? 'alt' : 'weich') + (AUSWEICH.vorn ? '' : ', KI-Ausweichen alt');
  console.log(`${name}: ${rennen} Rennen × ${runden} Runden, ${(m.sekunden / 60).toFixed(1)} min Rennzeit, Rechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`Rempler ${m.proben.length} (je beteiligtem Gleiter), Spieler-Rempler ${m.spielerRempler} (${f(m.spielerRempler / rennen)} je Rennen), davon KI fährt auf den Spieler auf ${m.kiAufSpieler} (${f(m.kiAufSpieler / rennen)} je Rennen); Abflüge gesamt ${m.abfluegeGesamt}, davon ≤ 3 s nach einem Rempler ${m.abfluegeNachRempler}`);
  console.log('| Stand | Gleiter | Rempler | Tempoverlust km/h (Median / p95) | Quer-Stoß km/h (Median / p95) | senkrecht m/s (p95) | Querversatz nach 0,5 s m (Median / p95) | Wand ≤ 1 s | Absturz ≤ 3 s |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const z of zeilen(m, name)) console.log(z);
}
