# Browser-Test: Eingaben wirken während Bullet-Time/Zeitlupe (Physik läuft nur langsamer, die Steuerung bleibt aktiv).
# Ablauf: fliegender Start vor der Häuserschlucht ohne Autopilot, im Sprung Bullet-Time erzwingen, währenddessen ← halten;
# geprüft: Moment aktiv, Zeitfaktor < 0,1, Lenk-Eingabe kommt im Spieler an (wächst in Sim-Zeit Richtung links), nach dem Moment läuft die Zeit wieder normal.
# Aufruf: python3 tests/test_eingabe_zeitlupe.py
import sys, time
sys.path.insert(0, 'tests')
from util import *

with Server() as srv, sync_playwright() as pw:
    s = Session(pw, srv.base, device=DESKTOP)
    s.open('?nosw&autostart=1&action=2&hilfe=leicht&at=H%C3%A4userschlucht%20Anlauf')
    s.pg.keyboard.down('ArrowUp')   # Vollgas bis zum Sprung
    s.pg.wait_for_function("__hb.spieler && !__hb.spieler.boden && __hb.spieler.luftZeit > 0.8", timeout=60000)
    m = s.ev("__hb.moment('sprungScheitel')")
    assert m and m['typ'] == 'bullet', m
    s.pg.keyboard.down('ArrowLeft')
    werte = []
    for k in range(6):
        time.sleep(0.12)
        werte.append(s.ev("(() => { const r = __hb.regie(), t = __hb.rennen.spieler; return { aktiv: !!r.aktiv, faktor: r.fx.zeitFaktor, lenk: t.ein ? t.ein.lenk : null, zeit: __hb.rennen.zeit }; })()"))
    s.pg.keyboard.up('ArrowLeft'); s.pg.keyboard.up('ArrowUp')
    time.sleep(2.0)
    nach = s.ev("({ aktiv: !!__hb.regie().aktiv, faktor: __hb.regie().fx.zeitFaktor })")
    print('während', werte)
    print('danach', nach, 'Fehler', s.errors[:3])
    im = [w for w in werte if w['aktiv']]
    # ← = +lenk; die Tasten-Rampe läuft in Sim-Zeit (fair: gleiche Antwort je Sim-Schritt wie ohne Zeitlupe), daher nur
    # „wächst Richtung links“ prüfen, nicht den vollen Ausschlag
    ok = len(im) >= 3 and all(w['faktor'] < 0.1 for w in im) and (im[-1]['lenk'] - im[0]['lenk']) > 0.1 \
        and not nach['aktiv'] and nach['faktor'] == 1 and not s.errors
    print('OK' if ok else 'FEHLER')
    s.close()
    sys.exit(0 if ok else 1)
