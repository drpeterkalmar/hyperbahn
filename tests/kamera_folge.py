# p1c (Peter 22.10.: „Kamera clippt im Looping durch den Boden“): Bildfolgen durch Looping, Korkenzieher-Röhre, Wandfahrt,
# Überkopf und Möbius-Twist (Autopilot, fliegender Start), je Bild Kamera-Höhe über der Fahrbahn aus dem Spiel
# (Bahn-Raycast an der Kamera-Lage). Ausgabe: tests/shots/p1c/<szene>_NN.png + Collage je Szene, Zählung „unter der Fahrbahn“.
# Zusätzlich Reset-Knopf: Taste R und HUD-Knopf versetzen den Gleiter, Doppelklick wird abgelehnt.
# Aufruf: py tests/kamera_folge.py [--nur looping,roehre] [--regler "&camloop=0&camboden=0"] [--bilder 12] [--ohne-reset]
import sys, os, time, json, argparse, subprocess, urllib.parse
sys.path.insert(0, 'tests')
from util import *

SZENEN = {
    'looping': ('Großer Looping', '__hb.spieler.oben.y < 0.6'),
    'roehre': ('Korkenzieher-Röhre', '__hb.spieler.oben.y < 0.6'),
    'wandfahrt': ('Fassade', '__hb.spieler.oben.y < 0.6'),
    'ueberkopf': ('Unter der Brücke', '__hb.spieler.oben.y < 0.6'),
    'twist': ('Möbius-Twist', '__hb.spieler.oben.y < 0.6'),
}
HOEHE = """() => { const r = __hb.rig, g = __hb.spieler, q = __hb.bahn.abfrage(r.pos, g.hint, {P:{},T:{},Us:{},Ls:{},U:{}});
  const ueber = q.ok && !(q.flags & 2) && Math.abs(q.u) <= q.hw + 2;
  return { h: ueber ? q.h : null, loopK: r.loopK, hub: r.bodenHub, obenY: g.oben.y, s: g.s }; }"""

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--nur', default=''); ap.add_argument('--regler', default='')
    ap.add_argument('--bilder', type=int, default=12); ap.add_argument('--ohne-reset', action='store_true')
    a = ap.parse_args()
    nur = [x for x in a.nur.split(',') if x]
    out = os.path.join(ROOT, 'tests', 'shots', 'p1c'); os.makedirs(out, exist_ok=True)
    gesamt, unter, fehler = 0, 0, []
    with Server() as srv, sync_playwright() as pw:
        for name, (at, bed) in SZENEN.items():
            if nur and name not in nur: continue
            s = Session(pw, srv.base, device=PIXEL7_LAND)
            try:
                s.open('?nosw&look=1&autostart=1&autopilot=1&action=0&gegner=0&at=' + urllib.parse.quote(at) + a.regler)
                s.pg.wait_for_function(f"__hb.rennen && __hb.spieler && __hb.rig && ({bed})", timeout=90000)
                folge, minH = [], 99
                for k in range(a.bilder):
                    w = s.ev(HOEHE)
                    p = s.shot(f'{name}_{k:02d}', 'p1c')
                    gesamt += 1
                    if w['h'] is not None:
                        minH = min(minH, w['h'])
                        if w['h'] < 0.3: unter += 1
                    folge.append(p + f"={w['h'] if w['h'] is None else round(w['h'], 1)} m · loop {round(w['loopK'], 2)}")
                    s.frames(6)
                print(name, 'min. Kamera-Höhe', round(minH, 2), 'm', s.errors[:3], flush=True)
                fehler += s.errors
                subprocess.run([sys.executable, 'tests/collage.py', os.path.join(out, f'collage_{name}.jpg'), '4', '420'] + folge)
            finally:
                s.close()
        if not a.ohne_reset:
            s = Session(pw, srv.base, device=PIXEL7_LAND)
            try:
                s.open('?nosw&look=1&autostart=1&gegner=0&hilfe=leicht&at=' + urllib.parse.quote('Anlauf Looping'))
                s.pg.wait_for_function("__hb.rennen && __hb.rennen.phase === 'rennen' && __hb.spieler.zeit > 1.5", timeout=60000)
                btn = s.pg.locator('.reset').bounding_box()
                vor = s.ev("({ s: __hb.spieler.s, n: __hb.spieler.statistik.resets || 0 })")
                s.ev("__hb.spieler.p.x += __hb.spieler.links.x * 7, __hb.spieler.p.z += __hb.spieler.links.z * 7")
                s.pg.keyboard.press('KeyR'); s.frames(3)
                r1 = s.ev("({ s: __hb.spieler.s, u: __hb.spieler.u, n: __hb.spieler.statistik.resets || 0, gesperrt: document.querySelector('.reset').classList.contains('gesperrt') })")
                s.shot('reset_nach_taste', 'p1c')
                s.tap('.reset'); s.frames(3)
                r2 = s.ev("({ n: __hb.spieler.statistik.resets || 0 })")
                time.sleep(1.3); s.frames(3)
                s.tap('.reset'); s.frames(3)
                r3 = s.ev("({ n: __hb.spieler.statistik.resets || 0 })")
                ok = r1['n'] == vor['n'] + 1 and abs(r1['u']) < 1 and r1['gesperrt'] and r2['n'] == r1['n'] and r3['n'] == r1['n'] + 1
                print('Reset', 'OK' if ok else 'FEHLER', 'Knopf', btn, 'vor', vor, 'Taste', r1, 'Doppel', r2, 'nach 1,3 s', r3, s.errors[:3], flush=True)
                if not ok: fehler.append('Reset-Prüfung')
                fehler += s.errors
            finally:
                s.close()
    print(f'Bilder {gesamt}, davon Kamera hinter/unter der Fahrbahn: {unter}; Fehler {fehler[:5]}')
    sys.exit(1 if unter or fehler else 0)

if __name__ == '__main__':
    main()
