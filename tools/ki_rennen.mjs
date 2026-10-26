// KI-Rennen ohne Browser: 8 Gleiter (7 KI-Gegner + Autopilot als Spieler) fahren N Runden auf Strecke 1.
// Ausgabe: Zieleinlauf, Rundenzeiten, Abflüge, Sprung-Landungen, Stöße. Grundlage des KI-Gates (test_ki_gate.mjs).
// Aufruf: node tools/ki_rennen.mjs [runden=10] [url-regler] [strecke]   (P2: strecke = megastadt|wueste|riff|gebirge|orbit)
// Gabelungen: jede KI nimmt je nach Profil den schnellen oder sicheren Weg (wegFuer)
import { leseRegler, ZEIT } from '../src/config.js';
import { baueStrecke } from '../src/track/alle.js';
import { bauePlaene, wegFuer, Pilot, PROFILE } from '../src/ai/pilot.js';
import { Rennen, TEAMS } from '../src/game/rennen.js';

export function kiRennen(runden = 10, regler = '', log = () => {}, strecke = '') {
  const q = leseRegler(regler);
  const bahn = baueStrecke(strecke || q.get('strecke') || 'megastadt');
  const plaene = bauePlaene(bahn);
  const profile = ['profi', 'profi', 'mittel', 'mittel', 'mittel', 'leicht', 'leicht', 'profi'];
  const teil = TEAMS.map((t, k) => ({ ...t, pilot: new Pilot(bahn, plaene[wegFuer(PROFILE[profile[k]], 101 + k * 17)], PROFILE[profile[k]], 101 + k * 17) }));
  const r = new Rennen(bahn, teil, { runden });
  const dt = ZEIT.schritt;
  const zaehl = { stoss: 0, wand: 0, absturz: 0, rolle: 0, pad: 0, ring: 0 };
  let n = 0;
  while (r.phase !== 'ziel' && n < 240 * 260 * runden) {
    r.schritt(dt, null);
    n++;
    for (const g of r.gleiter) {
      for (const e of g.ereignisse) {
        if (e.art in zaehl) zaehl[e.art]++;
        if (e.art === 'absturz') log(`ABSTURZ ${r.alle[g.id].name} (${profile[g.id]}) ${e.grund} s=${e.s.toFixed(0)} t=${r.zeit.toFixed(1)}`);
      }
      g.ereignisse.length = 0;
    }
  }
  return { r, bahn, profile, zaehl, schritte: n };
}

if (process.argv[1] && process.argv[1].endsWith('ki_rennen.mjs')) {
  const t0 = Date.now();
  const args = process.argv.slice(3);
  const { r, profile, zaehl, bahn } = kiRennen(+(process.argv[2] || 10), args.find((a) => a.startsWith('?')) || '', console.log, args.find((a) => !a.startsWith('?')) || '');
  console.log(`Strecke ${bahn.name} (${(bahn.L / 1000).toFixed(2)} km)`);
  console.log(`Rechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s, Rennzeit ${r.zeit.toFixed(1)} s, Phase ${r.phase}`);
  for (const t of r.rangliste) {
    const st = t.g.statistik;
    console.log(`${t.platz}. ${t.name.padEnd(8)} ${profile[t.k].padEnd(6)} Ziel ${t.ziel ? t.ziel.zeit.toFixed(1) : '–'} s  beste ${t.beste.toFixed(1)} s  Runden ${t.rundenZeiten.map((x) => x.toFixed(0)).join(' ')}  Abflüge ${st.abfluege}  Landungen ${st.sprungLandungen}  Wand ${st.wandTreffer}  Rollen ${st.rollen}  Weg ${t.pilot.plan.weg}`);
  }
  console.log('Ereignisse', JSON.stringify(zaehl));
}
