# Browser-Prüfung P1b Etappe 0 (ein Browser nach dem anderen, stumm):
#  1. Rauchtest hoch + quer: Menü (Strecke Kurz · 2 Runden, Version), Rennen startet, HUD „1/2“, 0 Fehler, Tasten ≥ 48 px
#  2. Bildfolge Riesensprung (Häuserschlucht) mit DAUERHAFT gehaltenem ↑ (echte Tastatur-Eingabe, Fahrhilfe Leicht lenkt
#     mit): Nase gegen die Flugbahn, Landung, Absturz ja/nein – neu und zum Vergleich ?nase=alt
# Aufruf: python3 tests/etappe0.py [--nur smoke|sprung]
# Ausgabe: tests/shots/e0/*.png, Collagen tests/shots/e0/collage_sprung_{neu,alt}.jpg
import sys, os, time, json, subprocess, argparse
sys.path.insert(0, 'tests')
from util import *

HOCH = dict(PIXEL7_LAND, viewport={"width": 412, "height": 915})
OUT = os.path.join(ROOT, 'tests', 'shots', 'e0')
ZUSTAND = """(() => { const g = __hb.spieler, r = __hb.rennen; if (!g) return null;
  const vl = Math.hypot(g.v.x, g.v.y, g.v.z) || 1;
  const nick = Math.asin(Math.max(-1, Math.min(1, -(g.v.x * g.oben.x + g.v.y * g.oben.y + g.v.z * g.oben.z) / vl))) * 57.3;
  return { phase: r.phase, runden: r.runden, boden: g.boden, luft: +g.luftZeit.toFixed(2), nick: +nick.toFixed(1), tempo: +g.tempo.toFixed(1),
    abfluege: g.statistik.abfluege, landungen: g.statistik.sprungLandungen, zustand: g.zustand, s: Math.round(g.s) }; })()"""


def smoke(pw, srv):
    erg = {}
    for name, geraet in (('quer', PIXEL7_LAND), ('hoch', HOCH)):
        s = Session(pw, srv.base, device=geraet)
        try:
            s.open('?nosw')
            time.sleep(1.5)
            menue = s.ev("({ unter: document.querySelector('.unter').textContent, version: document.querySelector('.version').textContent, strecke: [...document.querySelectorAll('[data-wahl=strecke] button')].map((b) => b.textContent + (b.classList.contains('an') ? ' ✓' : '')) })")
            s.shot(f'menue_{name}', 'e0')
            klein = s.small_buttons()
            s.ev("__hb.starte()")
            s.pg.wait_for_function("__hb.rennen && __hb.rennen.phase === 'rennen' && __hb.rennen.zeit > 4", timeout=60000)
            hud = s.ev("document.querySelector('[data-k=runde]').textContent")
            s.shot(f'rennen_{name}', 'e0')
            erg[name] = dict(menue=menue, hud_runde=hud, zustand=s.ev(ZUSTAND), boot=round(s.boot_s, 1), kleine_tasten=klein, fehler=s.errors[:10])
            print(name, json.dumps(erg[name], ensure_ascii=False))
        finally:
            s.close()
    return erg


def sprung(pw, srv, modus):
    # ↑ ab dem Start gedrückt halten (echtes keydown), fliegender Start vor der Häuserschlucht, ohne Gegner, ohne Action-Momente
    q = '?nosw&autostart=1&gegner=0&action=0&hilfe=leicht&at=' + 'H%C3%A4userschlucht%20Anlauf' + ('&nase=alt' if modus == 'alt' else '')
    s = Session(pw, srv.base, device=PIXEL7_LAND)
    bilder, verlauf = [], []
    try:
        s.open(q)
        s.pg.wait_for_function("__hb.rennen && __hb.spieler", timeout=60000)
        s.pg.keyboard.down('ArrowUp')
        s.pg.wait_for_function("!__hb.spieler.boden && __hb.spieler.luftZeit > 0.3", timeout=60000)
        t0 = time.time()
        while time.time() - t0 < 14:
            z = s.ev(ZUSTAND)
            verlauf.append(z)
            if len(bilder) < 12:
                bilder.append(s.shot(f'sprung_{modus}_{len(bilder):02d}', 'e0') + f"=Luft {z['luft']} s · Nase {z['nick']}° · {z['zustand']}")
            if z['zustand'] != 'fahrt' or (z['boden'] and len(verlauf) > 3):
                # nach der Landung / dem Absturz noch zwei Bilder
                for k in range(2):
                    time.sleep(0.4); z = s.ev(ZUSTAND); verlauf.append(z)
                    bilder.append(s.shot(f'sprung_{modus}_{len(bilder):02d}', 'e0') + f"=danach · {z['zustand']} · {z['tempo']} m/s")
                break
        s.pg.keyboard.up('ArrowUp')
        ende = s.ev(ZUSTAND)
        nmin = min((v['nick'] for v in verlauf if not v['boden']), default=0)
        print(modus, 'Nase min', nmin, '° · Ende', json.dumps(ende), 'Fehler', s.errors[:5])
        subprocess.run([sys.executable, 'tests/collage.py', os.path.join(OUT, f'collage_sprung_{modus}.jpg'), '4', '420'] + bilder[:12])
        return dict(nase_min=nmin, ende=ende, fehler=s.errors[:5], bilder=len(bilder))
    finally:
        s.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--nur', default='')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    erg = {}
    with Server() as srv, sync_playwright() as pw:
        if a.nur in ('', 'smoke'): erg['smoke'] = smoke(pw, srv)
        if a.nur in ('', 'sprung'):
            erg['sprung_neu'] = sprung(pw, srv, 'neu')
            erg['sprung_alt'] = sprung(pw, srv, 'alt')
    json.dump(erg, open(os.path.join(OUT, 'ergebnis.json'), 'w'), ensure_ascii=False, indent=1)
