// Häufigkeit der Action-Momente je Rennen (ohne Browser): 8 KI-Gleiter fahren 3 Runden, einer gilt als „Spieler“ (Startplatz 6,
// Profil mittel); MomentWaechter meldet, ActionRegie entscheidet (Stufe Selten bzw. Oft). Präsentationszeit ≈ Rennzeit
// (die Zeitlupe selbst ist hier nicht simuliert – sie verlängert ein Rennen um < 2 s).
// Aufruf: node tools/action_mess.mjs [rennen=5]
import { leseRegler, ZEIT } from '../src/config.js';
import { strecke1 } from '../src/track/strecke1.js';
import { bauePlan, Pilot, PROFILE } from '../src/ai/pilot.js';
import { Rennen, TEAMS } from '../src/game/rennen.js';
import { MomentWaechter } from '../src/game/momente.js';
import { ActionRegie } from '../src/core/zeit.js';

export function actionMess(anzahl = 5, runden = 3) {
  leseRegler('');
  const bahn = strecke1(), plan = bauePlan(bahn);
  const erg = { 1: [], 2: [] }, arten = { 1: {}, 2: {} }, abstaende = { 1: [], 2: [] };
  for (let n = 0; n < anzahl; n++) {
    const profile = ['profi', 'mittel', 'mittel', 'leicht', 'profi', 'mittel', 'leicht', 'mittel'];
    const teil = TEAMS.map((t, k) => ({ ...t, pilot: new Pilot(bahn, plan, PROFILE[profile[k]], 300 + n * 31 + k * 17) }));
    const r = new Rennen(bahn, teil, { runden });
    const ich = r.alle[5].g;
    const regien = { 1: new ActionRegie({ stufe: 1, seed: 11 + n }), 2: new ActionRegie({ stufe: 2, seed: 11 + n }) };
    const zeiten = { 1: [], 2: [] };
    const w = new MomentWaechter(bahn, plan, (art, st, pos, kon) => {
      for (const s of [1, 2]) if (regien[s].melde(art, st, pos, kon, r.zeit)) { zeiten[s].push(r.zeit); arten[s][art] = (arten[s][art] || 0) + 1; }
    });
    let k = 0;
    while (r.phase !== 'ziel' && k < 240 * 260 * runden) {
      r.schritt(ZEIT.schritt, null);
      for (const s of [1, 2]) regien[s].aktualisiere(r.zeit);
      w.pruefe(ich, r, r.zeit);
      for (const g of r.gleiter) g.ereignisse.length = 0;
      k++;
    }
    for (const s of [1, 2]) {
      erg[s].push({ momente: zeiten[s].length, minuten: r.zeit / 60 });
      for (let i = 1; i < zeiten[s].length; i++) abstaende[s].push(zeiten[s][i] - zeiten[s][i - 1]);
    }
  }
  const zus = {};
  for (const s of [1, 2]) {
    const m = erg[s].map((e) => e.momente), min = erg[s].reduce((a, e) => a + e.minuten, 0);
    zus[s === 1 ? 'selten' : 'oft'] = {
      jeRennen: +(m.reduce((a, b) => a + b, 0) / m.length).toFixed(1), spanne: [Math.min(...m), Math.max(...m)],
      jeMinute: +(m.reduce((a, b) => a + b, 0) / min).toFixed(2), kleinsterAbstand: abstaende[s].length ? +Math.min(...abstaende[s]).toFixed(1) : null,
      arten: arten[s],
    };
  }
  return zus;
}

if (process.argv[1] && process.argv[1].endsWith('action_mess.mjs')) {
  const t0 = Date.now();
  console.log(JSON.stringify(actionMess(+(process.argv[2] || 5)), null, 1));
  console.log(`Rechenzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
