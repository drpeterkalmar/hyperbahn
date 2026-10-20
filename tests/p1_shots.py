# Abnahme-Bilder Phase 1 (VORBAU geschrieben, NICHT ausgeführt – das macht der Heavy-Job): je Szene hoch + quer.
# Szenen: Start, Pulk/Zweikampf, Looping kopfüber, Korkenzieher-Röhre, Überkopf unter der Brücke, Wandfahrt, Möbius-Twist,
# Boost-Kette (Flash), Sprung-Panorama (Häuserschlucht + Neon-Schlucht), Bullet-Time-Bildfolge (≥ 12 Bilder) + Collagen.
# Aufruf: python3 tests/p1_shots.py [--nur looping,sprung1] [--look 1]
# Ausgabe: tests/shots/p1/<szene>_<hoch|quer>.png, Collagen tests/shots/p1/collage_*.jpg (tests/collage.py)
import sys, os, time, json, argparse, subprocess, urllib.parse
sys.path.insert(0, 'tests')
from util import *

HOCH = dict(PIXEL7_LAND, viewport={"width": 412, "height": 915})
GERAETE = {'quer': PIXEL7_LAND, 'hoch': HOCH}
# name: (Abschnitt für ?at=, JS-Bedingung, bis zu der gewartet wird, Extra-Query)
SZENEN = {
    'start': (None, "__hb.rennen && __hb.rennen.countdown < 1.5", ''),
    'pulk': ('Start-Ziel', "__hb.spieler.s > 200", ''),
    'looping': ('Großer Looping', "__hb.spieler.oben.y < -0.8", ''),
    'roehre': ('Korkenzieher-Röhre', "__hb.spieler.q.bank % 360 > 150 && __hb.spieler.q.bank % 360 < 210", ''),
    'ueberkopf': ('Unter der Brücke', "__hb.spieler.oben.y < -0.9", ''),
    'wandfahrt': ('Fassade', "Math.abs(__hb.spieler.oben.y) < 0.15", ''),
    'twist': ('Möbius-Twist', "__hb.spieler.oben.y < -0.5", ''),
    'boost': ('Häuserschlucht Anlauf', "__hb.spieler.boost > 0.6", ''),
    'sprung1': ('Häuserschlucht Anlauf', "!__hb.spieler.boden && __hb.spieler.luftZeit > 1.6", ''),
    'sprung2': ('Hafen Anlauf', "!__hb.spieler.boden && __hb.spieler.luftZeit > 1.6", ''),
    'blitze_reduziert': ('Häuserschlucht Anlauf', "__hb.spieler.boost > 0.6", '&blitze=0'),
}

def url(at, look, extra):
    q = f'?nosw&look={look}&autostart=1&autopilot=1&action=0' + extra
    if at: q += '&at=' + urllib.parse.quote(at)
    return q

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--nur', default=''); ap.add_argument('--look', default='1')
    a = ap.parse_args()
    nur = [x for x in a.nur.split(',') if x]
    out = os.path.join(ROOT, 'tests', 'shots', 'p1'); os.makedirs(out, exist_ok=True)
    bilder = []
    with Server() as srv, sync_playwright() as pw:
        for name, (at, bed, extra) in SZENEN.items():
            if nur and name not in nur: continue
            for gname, geraet in GERAETE.items():
                s = Session(pw, srv.base, device=geraet)
                try:
                    s.open(url(at, a.look, extra))
                    s.pg.wait_for_function(f"__hb.rennen && __hb.spieler && ({bed})", timeout=60000)
                    s.frames(2)
                    p = s.shot(f'{name}_{gname}', 'p1'); bilder.append(p)
                    print(name, gname, 'ok', s.ev("({ fps: __hb.fps, tempo: __hb.spieler && __hb.spieler.tempo })"), s.errors[:3])
                except Exception as e:
                    print(name, gname, 'FEHLER', str(e)[:200], s.errors[:3])
                finally:
                    s.close()
        # Bullet-Time-Bildfolge am Sprung-Scheitel (≥ 12 Bilder, quer) – Action-Moment per __hb.moment() erzwingen
        if not nur or 'bullet' in nur:
            s = Session(pw, srv.base, device=PIXEL7_LAND)
            try:
                s.open(url('Häuserschlucht Anlauf', a.look, '&action=2'))
                s.pg.wait_for_function("__hb.spieler && !__hb.spieler.boden && __hb.spieler.luftZeit > 1.2", timeout=60000)
                s.ev("__hb.moment('sprungScheitel')")
                folge = []
                for k in range(14):
                    folge.append(s.shot(f'bullet_{k:02d}', 'p1')); time.sleep(0.11)
                subprocess.run([sys.executable, 'tests/collage.py', os.path.join(out, 'collage_bullet.jpg'), '7', '320'] + folge)
            finally:
                s.close()
    if bilder:
        subprocess.run([sys.executable, 'tests/collage.py', os.path.join(out, 'collage_szenen.jpg'), '4', '360'] + bilder)

if __name__ == '__main__':
    main()
