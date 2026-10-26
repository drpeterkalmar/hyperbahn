# Browser-Prüfung der P1b-Vorlagen-Etappen (ein Browser nach dem anderen, stumm): Rauchtest hoch + quer und Bildfolgen der
# neuen Mechaniken als Collagen (tests/shots/p1b/collage_<szene>.jpg).
# Aufruf: python3 tests/vorlagen_bilder.py [--nur smoke,bergung,wand,landung,...]
import sys, os, time, json, subprocess, argparse
sys.path.insert(0, 'tests')
from util import *

HOCH = dict(PIXEL7_LAND, viewport={"width": 412, "height": 915})
OUT = os.path.join(ROOT, 'tests', 'shots', 'p1b')
ZUSTAND = """(() => { const g = __hb.spieler, r = __hb.rennen; if (!g) return null;
  return { phase: r.phase, zustand: g.zustand, boden: g.boden, luft: +g.luftZeit.toFixed(2), tempo: +g.tempo.toFixed(1), h: +g.h.toFixed(2),
    energie: +(g.energie ?? g.schild).toFixed(3), taste: document.querySelector('[data-k=rolle]').textContent, boost: +g.boost.toFixed(2), s: Math.round(g.s), runde: __hb.rennen.alle.find((t) => t.g === g).runde }; })()"""


def collage(name, bilder, breite=420):
    if bilder:
        subprocess.run([sys.executable, 'tests/collage.py', os.path.join(OUT, f'collage_{name}.jpg'), '4', str(breite)] + bilder[:12])


def folge(s, name, n, pause, text=lambda z: ''):
    bilder = []
    for k in range(n):
        z = s.ev(ZUSTAND)
        bilder.append(s.shot(f'{name}_{k:02d}', 'p1b') + '=' + text(z))
        time.sleep(pause)
    return bilder


def smoke(pw, srv, q=''):
    erg = {}
    for name, geraet in (('quer', PIXEL7_LAND), ('hoch', HOCH)):
        s = Session(pw, srv.base, device=geraet)
        try:
            s.open('?nosw' + q)
            time.sleep(1.0)
            s.shot(f'menue_{name}', 'p1b')
            s.ev("__hb.starte()")
            s.pg.wait_for_function("__hb.rennen && __hb.rennen.phase === 'rennen' && __hb.rennen.zeit > 4", timeout=60000)
            s.shot(f'rennen_{name}', 'p1b')
            erg[name] = dict(zustand=s.ev(ZUSTAND), version=s.ev("__hb.version"), fehler=s.errors[:10], kleine=len(s.small_buttons()))
            print('smoke', name, json.dumps(erg[name], ensure_ascii=False))
        finally:
            s.close()
    return erg


def szene(pw, srv, name, q, vorbereiten, warten, n=12, pause=0.18, text=None, geraet=PIXEL7_LAND):
    s = Session(pw, srv.base, device=geraet)
    try:
        s.open('?nosw&autostart=1&gegner=0&action=0' + q)
        s.pg.wait_for_function("__hb.rennen && __hb.spieler && __hb.rennen.phase === 'rennen'", timeout=60000)
        if vorbereiten: s.ev(vorbereiten)
        if warten: s.pg.wait_for_function(warten, timeout=60000)
        bilder = folge(s, name, n, pause, text or (lambda z: f"{z['zustand']} · {z['tempo']} m/s · h {z['h']} · E {round(z['energie'] * 100)} %"))
        collage(name, bilder)
        print(name, 'ok', json.dumps(s.ev(ZUSTAND)), 'Fehler', s.errors[:5])
        return dict(fehler=s.errors[:5], ende=s.ev(ZUSTAND))
    finally:
        s.close()


SZENEN = {
    # Bergungs-Drohne: zu langsam über die Häuserschlucht → Abflug → Drohne holt den Gleiter, Absetzen hinter der Lücke
    'bergung': ('&at=Absprung%201', "(() => { const b = __hb.bahn; __hb.setze(b.segStart[b.abschnitte.findIndex((a) => a.name === 'Häuserschlucht')] - 4, 30); })()",
                "__hb.spieler.zustand === 'absturz'", 12, 0.12),
    # Wandtreffer: Gleiter schräg in die Wand (Taste ← gehalten), Abgleiten + Funken + Schräglage
    'wand': ('&at=Start-Ziel', "(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft' })), 1600); })()", None, 12, 0.15),
    # Landung nach dem Riesensprung: Federweg der Schwebe-Feder
    'landung': ('&at=H%C3%A4userschlucht%20Anlauf', None, "!__hb.spieler.boden && __hb.spieler.luftZeit > 4.6", 12, 0.12),
    # Boxengasse: mit 15 % Energie auf die Lade-Spur (Fahrhilfe Profi, damit kein Lenkzug zur Ideallinie), Balken füllt sich
    'box': ('&hilfe=profi&at=Start-Ziel', "(() => { const g = __hb.spieler, x = __hb.bahn.box; g.setzeAuf(x.s0 - 30, x.u, 40); g.schild = 0.15; })()", None, 12, 0.2),
    # Energie-Warnung: 18 % → Gleiter glüht rot (Puls), Balken rot; danach Energie-Boost (Taste) mit Freigabe
    'warnung': ('&at=Start-Ziel', "(() => { const g = __hb.spieler; g.schild = 0.18; g.boostFrei = true; setTimeout(() => { dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' })), 200); }, 1200); })()", None, 12, 0.2),
}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--nur', default=''); ap.add_argument('--q', default='')
    a = ap.parse_args()
    nur = [x for x in a.nur.split(',') if x]
    os.makedirs(OUT, exist_ok=True)
    erg = {}
    with Server() as srv, sync_playwright() as pw:
        if not nur or 'smoke' in nur: erg['smoke'] = smoke(pw, srv, a.q)
        for name, (q, vor, warte, n, pause) in SZENEN.items():
            if nur and name not in nur: continue
            try: erg[name] = szene(pw, srv, name, q + a.q, vor, warte, n, pause)
            except Exception as e: erg[name] = dict(fehler=[str(e)[:300]]); print(name, 'FEHLER', str(e)[:300])
    json.dump(erg, open(os.path.join(OUT, 'ergebnis.json'), 'w'), ensure_ascii=False, indent=1)
    print('Fehler gesamt', sum(len(v.get('fehler', [])) if isinstance(v, dict) and 'fehler' in v else sum(len(x.get('fehler', [])) for x in v.values()) for v in erg.values()))
