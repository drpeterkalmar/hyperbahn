# Kurz-Probe: Seite laden, JS-Ausdrücke auswerten, optional Screenshot. Aufruf: python3 tests/probe.py '<query>' '<js>' [warte_s] [bild]
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
q, js = sys.argv[1], sys.argv[2]
warte = float(sys.argv[3]) if len(sys.argv) > 3 else 2
bild = sys.argv[4] if len(sys.argv) > 4 else ''
geraet = PIXEL7_LAND if 'hoch' not in bild else dict(PIXEL7_LAND, viewport={"width": 412, "height": 915})
with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, device=geraet)
    fehl = []
    s.pg.on('response', lambda r: fehl.append(r.url) if r.status >= 400 else None)
    s.open(q)
    time.sleep(warte)
    print(json.dumps(s.ev(js), ensure_ascii=False, default=str)[:3000])
    if bild: print(s.shot(bild, 'probe'))
    print('404', fehl, 'Fehler', s.errors[:5])
    s.close()
