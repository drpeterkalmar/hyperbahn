# Rauchtest Hyperbahn (VORBAU, ungetestet – Heavy-Job führt aus): Laden, Menü, Rennen mit Autopilot, Screenshots, 0 Fehler.
# Aufruf: python3 tests/smoke.py   (ein Browser, stumm)
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base)
    t0 = time.time()
    s.open('?nosw')
    print('boot', round(time.time() - t0, 1), 's')
    time.sleep(2); s.shot('smoke_01_menu')
    s.ev("__hb.starte()")
    s.frames(5); time.sleep(1.5); s.shot('smoke_02_countdown')
    for k in range(6):
        time.sleep(2.0)
        s.shot(f'smoke_03_rennen_{k}')
        print(json.dumps(s.ev("(() => { const g = __hb.spieler, r = __hb.rennen; return { phase: r.phase, zeit: r.zeit, tempo: g.tempo, s: g.s, abfluege: g.statistik.abfluege, fps: __hb.fps }; })()")))
    print('kino', s.ev("__hb.kino.describe()"))
    print('kleine Tasten', s.small_buttons())
    print('Fehler', s.errors[:20])
    s.close()
