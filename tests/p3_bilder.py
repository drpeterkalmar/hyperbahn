# P3 Etappe 1 im Browser (ein Browser nach dem anderen, stumm): hoch + quer – HUD ohne Energie-Balken und ohne Luftbremsen-
# Knöpfe, ROLLE-Taste unten mittig; Bildfolge Windschatten (hinter einem Gegner auf der Wüsten-Ostgerade, Autopilot schert
# nach dem Laden aus → Schleuder-Boost) und Boost-Kette (Silo-Anlauf, 4 Pads); 0 Fehler.
# Collagen: tests/shots/p3/collage_<szene>_<hoch|quer>.jpg
# Aufruf: python3 tests/p3_bilder.py [--nur quer]
import sys, os, time, json, subprocess
sys.path.insert(0, 'tests')
from util import *

HOCH = dict(PIXEL7_LAND, viewport={"width": 412, "height": 915})
OUT = os.path.join(ROOT, 'tests', 'shots', 'p3')
NUR = sys.argv[sys.argv.index('--nur') + 1].split(',') if '--nur' in sys.argv else None
ZUSTAND = """(() => { const g = __hb.spieler, r = __hb.rennen; if (!g) return null; const k = document.querySelector('[data-k=sog]');
  return { phase: r.phase, t: +r.zeit.toFixed(1), tempo: Math.round(g.tempo * 3.6 * 1.9), sog: +g.sog.toFixed(2), lade: +(g.sogZeit / 1.5).toFixed(2), vor: g.sogVor,
    boost: +g.boost.toFixed(2), u: +g.u.toFixed(1), s: Math.round(g.s), hinweis: k.classList.contains('an') ? k.textContent : '', schleuder: g.statistik.schleuder,
    pads: g.statistik.pads, abfl: g.statistik.abfluege }; })()"""


def collage(name, bilder, breite=420):
    if bilder:
        subprocess.run([sys.executable, 'tests/collage.py', os.path.join(OUT, f'collage_{name}.jpg'), '3', str(breite)] + bilder[:9])


def folge(s, name, n, pause, text):
    bilder = []
    for k in range(n):
        z = s.ev(ZUSTAND)
        print('   ', json.dumps(z))
        bilder.append(s.shot(f'{name}_{k:02d}', 'p3') + '=' + text(z))
        time.sleep(pause)
    return bilder


with Server() as srv, sync_playwright() as pw:
    ergebnis = {}
    for name, geraet in (('quer', PIXEL7_LAND), ('hoch', HOCH)):
        if NUR and name not in NUR: continue
        s = Session(pw, srv.base, device=geraet)
        try:
            s.open('?nosw&strecke=wueste&autopilot=1')
            time.sleep(1.5)
            s.ev("__hb.starte()")
            s.pg.wait_for_function("__hb.rennen && __hb.rennen.phase === 'rennen' && __hb.rennen.zeit > 3", timeout=60000)
            hud = s.ev("""(() => ({ energie: getComputedStyle(document.querySelector('[data-k=schildBalken]')).display, bremsen: document.querySelectorAll('.tk.bremse-l, .tk.bremse-r').length,
              rolle: (() => { const r = document.querySelector('[data-k=rolle]').getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), w: Math.round(r.width), mitte: Math.round(innerWidth / 2) }; })(),
              version: __hb.version }))()""")
            print(name, 'HUD', json.dumps(hud))
            s.shot(f'start_{name}', 'p3')
            # Windschatten: Gegner 24 m vor dem Spieler auf derselben Spur (Ostgerade), beide schnell
            s.ev("""(() => { const b = __hb.bahn, k = b.abschnitte.findIndex(a => a.name === 'Ostgerade'), s0 = b.segStart[k] + 40, r = __hb.rennen;
              const ki = r.alle.find(t => !t.spieler); ki.g.setzeAuf(s0 + 16, 0, 97); ki.sAlt = ki.g.s;
              const du = r.alle.find(t => t.spieler); du.g.setzeAuf(s0, 0, 102); du.sAlt = du.g.s; __hb.rig.init = false; })()""")
            time.sleep(0.6)
            bild = folge(s, f'sog_{name}', 9, 0.05, lambda z: f"{z['tempo']} km/h · Sog {z['sog']:.2f} · Laden {min(1, z['lade']) * 100:.0f} % · Schleuder {z['schleuder']}")
            collage(f'windschatten_{name}', bild)
            # Boost-Kette: Silo-Anlauf (4 Pads im Abstand 65 m)
            s.ev("""(() => { const b = __hb.bahn, k = b.abschnitte.findIndex(a => a.name === 'Silo Anlauf'); __hb.setze(b.segStart[k] + 60, 100); })()""")
            time.sleep(0.3)
            bild = folge(s, f'kette_{name}', 9, 0.35, lambda z: f"{z['tempo']} km/h · Boost +{z['boost'] * 100:.0f} % · Pads {z['pads']}")
            collage(f'boostkette_{name}', bild)
            ergebnis[name] = dict(hud=hud, fehler=s.errors[:10], kleine=s.small_buttons(), zustand=s.ev(ZUSTAND))
        finally:
            s.close()
    print(json.dumps(ergebnis, indent=1, ensure_ascii=False))
