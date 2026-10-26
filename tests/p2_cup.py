# P2 Cup: Ablauf im Browser (ein Browser, stumm) – Cup-Karte wählen, Rennen starten, Zieleinlauf erzwingen (Rennen nicht
# 5 × 5 min fahren), Punktetabelle + „NÄCHSTES RENNEN“, alle 5 Strecken nacheinander, Endstand. 0 Fehler.
# Aufruf: python3 tests/p2_cup.py
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
ENDE = """(() => { const r = __hb.rennen; r.alle.forEach((t, k) => { t.ziel = { zeit: 250 + k * 3 + Math.random() }; t.platz = k + 1; });
  r.phase = 'ziel'; return r.alle.length; })()"""
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base)
    s.open('?nosw')
    time.sleep(3)
    s.pg.click('.sk[data-id="cup"]'); time.sleep(2.5)
    print('Cup gewählt', json.dumps(s.ev("({ unter: document.querySelector('.unter').textContent, start: document.querySelector('.start').textContent, strecke: __hb.strecke })")))
    s.shot('p2_cup_menue')
    s.pg.click('.start'); time.sleep(4)
    for k in range(5):
        st = s.ev("({ strecke: __hb.strecke, phase: __hb.rennen && __hb.rennen.phase, cup: __hb.cup && __hb.cup.k })")
        print('Rennen', k + 1, json.dumps(st))
        s.ev(ENDE); time.sleep(3)
        s.shot(f'p2_cup_ziel_{k + 1}')
        txt = s.ev("document.querySelector('.menue').innerText")
        print('  ', ' | '.join(l for l in txt.split('\n') if l.strip())[:300])
        nx = s.ev("!!document.querySelector('.naechstes')")
        if not nx: break
        s.pg.click('.naechstes'); time.sleep(4)
    print('Fehler', s.errors[:10])
    s.close()
