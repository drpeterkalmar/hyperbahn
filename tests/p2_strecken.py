# P2 Strecken: Rauchtest + Bildfolgen je Strecke (ein Browser, stumm). Menü mit Strecken-Karten (hoch + quer), je Strecke
# Start, Signatur-Passage, Riesensprung, Zieleinlauf; 0 Fehler. Bilder nach tests/shots/p2_*.png
# Aufruf: python3 tests/p2_strecken.py [--nur wueste,riff] [--hoch] [--menue]
import sys, time, json, os
sys.path.insert(0, 'tests')
from util import *

ARG = sys.argv[1:]
NUR = ARG[ARG.index('--nur') + 1].split(',') if '--nur' in ARG else None
# je Strecke: Abschnitte für die Bildfolge (fliegender Start kurz davor per __hb.setze)
FOLGE = {
  'megastadt': [('start', None), ('signatur', 'Großer Looping'), ('sprung', 'Häuserschlucht'), ('ziel', 'Zielanlauf')],
  'wueste': [('start', None), ('signatur', 'Startbahn'), ('sprung', 'Raketensilo'), ('hangar', 'Hangar'), ('duenen', 'Düne 1'), ('ziel', 'Zielkurve')],
  'riff': [('start', None), ('signatur', 'Korkenzieher'), ('gabel', 'Gabelung'), ('sprung', 'Riffgraben'), ('ziel', 'Zielanlauf')],
  'gebirge': [('start', None), ('signatur', 'Serpentine 1'), ('grat', 'Grat'), ('sprung', 'Talsprung'), ('ziel', 'Zielanlauf')],
  'orbit': [('start', None), ('signatur', 'Trommel'), ('moebius', 'Möbius-Band'), ('sprung', 'Schwerelos'), ('ziel', 'Zielanlauf')],
}
os.makedirs('tests/shots', exist_ok=True)

def zustand(s):
    return s.ev("(() => { const g = __hb.spieler, r = __hb.rennen; return r ? { strecke: __hb.strecke, phase: r.phase, t: +r.zeit.toFixed(1), v: +g.tempo.toFixed(0), s: +g.s.toFixed(0), abfl: g.statistik.abfluege, fps: +(__hb.fps||0).toFixed(0) } : { strecke: __hb.strecke }; })()")

with Server() as srv, sync_playwright() as pw:
    for geraet, name in ([(dict(viewport={"width": 412, "height": 915}, device_scale_factor=2.625, is_mobile=True, has_touch=True, user_agent=PIXEL7_LAND['user_agent']), 'hoch')] if '--hoch' in ARG else []) + [(PIXEL7_LAND, 'quer')]:
        s = Session(pw, srv.base, device=geraet)
        s.open('?nosw')
        time.sleep(3)
        s.shot(f'p2_menue_{name}')
        print(name, 'Menü', json.dumps(s.ev("({ karten: document.querySelectorAll('.sk').length, an: (document.querySelector('.sk.an')||{}).dataset?.id, unter: document.querySelector('.unter').textContent, kleine: 0 })")))
        print('kleine Tasten', s.small_buttons())
        if '--menue' in ARG: s.close(); continue
        strecken = s.ev("[...document.querySelectorAll('.sk')].map(k => k.dataset.id).filter(x => x !== 'zufall' && x !== 'cup')")
        for sid in strecken:
            if NUR and sid not in NUR: continue
            s.ev(f"__hb.ladeStrecke('{sid}')"); time.sleep(2.5)
            s.ev("__hb.starte()"); time.sleep(5.5)
            for art, ab in FOLGE.get(sid, [('start', None)]):
                if ab:
                    ok = s.ev(f"(() => {{ const k = __hb.bahn.abschnitte.findIndex(a => a.name === {json.dumps(ab)}); if (k < 0) return false; __hb.setze(__hb.bahn.segStart[k] - (k && __hb.bahn.abschnitte[k].typ === 'sprung' ? 700 : 150), __hb.bahn.abschnitte[k].typ === 'sprung' ? 140 : 110); return true; }})()")
                    if not ok: print('  kein Abschnitt', ab); continue
                    if art == 'sprung':
                        # warten, bis der Gleiter ≥ 2 s in der Luft ist (Panorama-Kamera), höchstens 25 s
                        t0 = time.time()
                        while time.time() - t0 < 25 and not s.ev("__hb.spieler && !__hb.spieler.boden && __hb.spieler.luftZeit > 2"): time.sleep(0.15)
                    else: time.sleep(1.6)
                s.shot(f'p2_{sid}_{art}_{name}')
                print(' ', sid, art, json.dumps(zustand(s)))
        print('Fehler', s.errors[:20])
        s.close()
