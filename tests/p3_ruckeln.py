# P3 Etappe 2 (Peter 26.10.: „ruckeln zeitweise und starten langsam“) – Hänger statt Mittelwerte, Profil „Mittelklasse-
# Android“ wie im Mess-Gate: CPU ×4 gedrosselt (CDP), Hochformat 412×915, DPR 2,6, Touch/Mobil-UA, WebGL über Metal.
# Genau EIN Browser zur Zeit (per `open` gestartet wie tests/perf_gate.py – sonst drosselt macOS die Zeitgeber der Queue).
#
#   start  --url <basis>      Kaltstart mit leerem Cache UND mit Service-Worker-Cache (zweiter Aufruf), Netz „Fast 4G“
#                             (170 ms, 9 Mbit/s runter, 1,5 Mbit/s hoch) + CPU ×4: Zeit bis Menü sichtbar und bis das Rennen
#                             fährt (Countdown läuft), Lade-Wasserfall (größte Dateien, was vor dem Menü lädt, Doppelte).
#                             Service-Worker nur über https (live) bzw. lokal mit ?sw=1.
#   rennen [--sek 150] [--strecke megastadt] [--wurzel <ordner>] [--q "&regler"]
#                             Rennen mit Autopilot + 7 Gegnern ab dem Countdown: Bildzeit Median/p95/p99, Bilder > 50 / > 100 ms,
#                             längster Hänger, je Hänger Zeitstempel + Ursache (neues Shader-Programm, neue Textur/Geometrie,
#                             Auflösungs-Regler, Speicherbereinigung, Long Task) und Ort auf der Strecke.
# Ergebnis: JSON nach tests/perf/<datum>_p3_<modus>_<stand>.json + Kurzfassung auf stdout.
# Aufruf: python3 tests/p3_ruckeln.py start --url https://drpeterkalmar.github.io/hyperbahn/ --stand vorher
#         python3 tests/p3_ruckeln.py rennen --stand vorher
import os, sys, json, time, argparse, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from perf_gate import OffenerBrowser, Server, GPU_ARGS, profil, REPO
from playwright.sync_api import sync_playwright

FAST4G = dict(offline=False, latency=170, downloadThroughput=9e6 / 8, uploadThroughput=1.5e6 / 8)

LOG = """() => { window.__p3 = { f: [], lt: [] };
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) __p3.lt.push([+e.startTime.toFixed(1), +e.duration.toFixed(1)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  let last = performance.now();
  const k = (now) => { const hb = window.__hb, r = hb && hb.rennen, ri = hb && hb.renderer && hb.renderer.info;
    const g = hb && hb.spieler, b = hb && hb.bahn;
    let ab = ''; if (g && b) { let j = 0; while (j + 1 < b.segStart.length && b.segStart[j + 1] <= g.s) j++; ab = b.abschnitte[j].name; }
    __p3.f.push([+now.toFixed(1), +(now - last).toFixed(2), ri ? ri.programs.length : 0, ri ? ri.memory.textures : 0, ri ? ri.memory.geometries : 0,
      hb && hb.kino ? +(hb.kino.renderScale || 0).toFixed(3) : 0, performance.memory ? performance.memory.usedJSHeapSize : 0,
      r ? r.phase : 'menu', r ? +r.zeit.toFixed(2) : 0, ab]);
    last = now; requestAnimationFrame(k); };
  requestAnimationFrame(k); }"""


def cdp_drossel(ctx, pg, cpu=4, netz=None):
    c = ctx.new_cdp_session(pg)
    c.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
    if netz:
        c.send('Network.enable')
        c.send('Network.emulateNetworkConditions', netz)
    return c


def auswerten(frames, lts):
    # frames: [t, dt, programme, texturen, geometrien, skala, heap, phase, rennzeit, abschnitt]
    f = [x for x in frames if x[7] in ('countdown', 'rennen')]
    if len(f) < 10: return {'n': len(f)}
    dts = sorted(x[1] for x in f[1:])
    q = lambda p: dts[min(len(dts) - 1, int(p * len(dts)))]
    haenger = []
    for i in range(1, len(f)):
        x, v = f[i], f[i - 1]
        if x[1] <= 50: continue
        urs = []
        if x[2] > v[2]: urs.append(f'Shader +{x[2] - v[2]}')
        if x[3] > v[3]: urs.append(f'Textur +{x[3] - v[3]}')
        if x[4] > v[4]: urs.append(f'Geometrie +{x[4] - v[4]}')
        if x[5] != v[5] or (i > 1 and v[5] != f[i - 2][5]): urs.append(f'Auflösung {v[5]}→{x[5]}')
        if v[6] and x[6] and v[6] - x[6] > 1e6: urs.append(f'GC −{(v[6] - x[6]) / 1e6:.1f} MB')
        lt = [d for (s, d) in lts if s <= x[0] and s + d >= x[0] - x[1]]
        if lt: urs.append(f'LongTask {max(lt):.0f} ms')
        haenger.append({'t': round(x[8], 2), 'phase': x[7], 'ms': x[1], 'wo': x[9], 'ursache': ', '.join(urs) or 'unbekannt'})
    # Erstauftritte im Rennen (am Mac oft < 50 ms, am Handy der typische Hänger: Shader-Kompilierung/Upload beim ersten
    # Auftauchen) und Sprünge der Renderskala (Auflösungs-Regler: jede Änderung legt die Render-Ziele neu an)
    neu = [{'t': round(f[i][8], 2), 'phase': f[i][7], 'ms': f[i][1], 'wo': f[i][9], 'shader': f[i][2] - f[i - 1][2], 'textur': f[i][3] - f[i - 1][3], 'geometrie': f[i][4] - f[i - 1][4]}
           for i in range(1, len(f)) if f[i][2] > f[i - 1][2] or f[i][3] > f[i - 1][3] or f[i][4] > f[i - 1][4]]
    skala = [{'t': round(f[i][8], 2), 'von': f[i - 1][5], 'nach': f[i][5]} for i in range(1, len(f)) if f[i][5] != f[i - 1][5]]
    gc = sum(1 for i in range(1, len(f)) if f[i - 1][6] and f[i][6] and f[i - 1][6] - f[i][6] > 1e6)
    groesster = max(haenger, key=lambda h: h['ms']) if haenger else None
    dauer = (f[-1][0] - f[0][0]) / 1000
    return {'n': len(f), 'dauer_s': round(dauer, 1), 'fps': round(len(f) / dauer, 1), 'p50': q(0.5), 'p95': q(0.95), 'p99': q(0.99),
            'ueber50': sum(1 for d in dts if d > 50), 'ueber100': sum(1 for d in dts if d > 100), 'max': dts[-1], 'groesster': groesster,
            'haenger': haenger, 'programme': f[-1][2], 'skalen': sorted(set(x[5] for x in f)),
            'erstauftritte': neu, 'skala_wechsel': skala, 'gc': gc, 'heap_mb': round(max(x[6] for x in f) / 1e6, 1)}


def rennen(pw, a):
    with Server(a.wurzel) as srv:
        b = OffenerBrowser(pw, GPU_ARGS + ['--disable-gpu-vsync', '--disable-frame-rate-limit'] if a.ungedeckelt else GPU_ARGS)
        try:
            ctx = b.new_context(**profil('hoch', 2.6))
            pg = ctx.new_page()
            fehler = []
            pg.on('pageerror', lambda e: fehler.append(str(e)))
            pg.goto(srv.base + f'index.html?nosw&strecke={a.strecke}&autopilot=1&gegner=7{a.q}')
            pg.wait_for_function("window.__app && window.__app.ready && window.__app.frames > 3", timeout=300000)
            time.sleep(2)
            cdp_drossel(ctx, pg, a.drossel)
            pg.evaluate(LOG)
            time.sleep(1)
            pg.evaluate("__hb.starte()")
            t0 = time.time()
            while time.time() - t0 < a.sek + 5:
                time.sleep(5)
                z = pg.evaluate("(() => { const r = __hb.rennen; return r ? { phase: r.phase, t: +r.zeit.toFixed(0) } : null; })()")
                if z and z['phase'] == 'rennen' and z['t'] >= a.sek: break
            frames = pg.evaluate("__p3.f"); lts = pg.evaluate("__p3.lt")
            e = auswerten(frames, lts)
            e['fehler'] = fehler[:5]; e['version'] = pg.evaluate("__hb.version")
            return e
        finally:
            b.close()


def start(pw, a):
    erg = {}
    b = OffenerBrowser(pw, GPU_ARGS)
    try:
        ctx = b.new_context(**profil('hoch', 2.6))
        for runde in (('leer',) if 'nosw' in a.q else ('leer', 'sw_cache')):
            pg = ctx.new_page()
            c = cdp_drossel(ctx, pg, a.drossel, FAST4G)
            if runde == 'sw_cache': c.send('Network.setCacheDisabled', {'cacheDisabled': True})   # nur der SW-Cache zählt
            reqs = {}
            c.on('Network.requestWillBeSent', lambda e: reqs.setdefault(e['requestId'], {'url': e['request']['url'], 't0': e['timestamp']}))
            c.on('Network.responseReceived', lambda e: reqs.get(e['requestId'], {}).update(sw=e['response'].get('fromServiceWorker', False)))
            c.on('Network.loadingFinished', lambda e: reqs.get(e['requestId'], {}).update(t1=e['timestamp'], bytes=e['encodedDataLength']))
            t0 = time.time()
            pg.goto(a.url + 'index.html' + a.q.replace('&', '?', 1) if a.q else a.url)
            pg.wait_for_function("window.__app && window.__app.ready && window.__app.frames > 3 && document.querySelector('.menue') && getComputedStyle(document.querySelector('.menue')).display !== 'none'", timeout=240000)
            t_menu = time.time() - t0
            pg.evaluate(LOG)
            time.sleep(a.verweilen)   # wie ein Mensch kurz im Menü (Vorwärmen läuft dann im Leerlauf)
            t1 = time.time()
            pg.evaluate("__hb.starte()")
            pg.wait_for_function("__hb.rennen && (__hb.rennen.phase === 'countdown' || __hb.rennen.phase === 'rennen') && window.__app.frames > 0", timeout=240000)
            f0 = pg.evaluate("window.__app.frames")
            pg.wait_for_function(f"window.__app.frames > {f0 + 10}", timeout=240000)
            t_rennen = time.time() - t0 - a.verweilen   # ohne die Verweilzeit im Menü
            time.sleep(4)   # Countdown + erste Rennsekunden: Hänger beim Start
            frames = pg.evaluate("__p3.f"); lts = pg.evaluate("__p3.lt")
            sw = pg.evaluate("!!(navigator.serviceWorker && navigator.serviceWorker.controller)")
            tmin = min((r['t0'] for r in reqs.values() if 't0' in r), default=0)
            liste = sorted([{'url': r['url'].replace(a.url, ''), 'kb': round(r.get('bytes', 0) / 1024, 1), 'ab_ms': round((r['t0'] - tmin) * 1000), 'dauer_ms': round((r.get('t1', r['t0']) - r['t0']) * 1000), 'sw': r.get('sw', False)}
                            for r in reqs.values() if 't0' in r], key=lambda x: x['ab_ms'])
            urls = [x['url'].split('?')[0] for x in liste]
            erg[runde] = {'menu_s': round(t_menu, 2), 'rennen_s': round(t_rennen, 2), 'start_klick_bis_rennen_s': round(t_rennen + a.verweilen - (t1 - t0), 2),
                          'sw_aktiv': sw, 'anfragen': len(liste), 'kb_gesamt': round(sum(x['kb'] for x in liste)),
                          'groesste': sorted(liste, key=lambda x: -x['kb'])[:10], 'doppelt': sorted(set(u for u in urls if urls.count(u) > 1)),
                          'start_haenger': auswerten(frames, lts), 'wasserfall': liste}
            print(runde, flush=True) or print(runde, json.dumps({k: v for k, v in erg[runde].items() if k not in ('wasserfall', 'start_haenger')}, ensure_ascii=False))
            sh = erg[runde]['start_haenger']
            print('   Start-Hänger (Countdown + 4 s):', json.dumps({k: sh.get(k) for k in ('n', 'p50', 'p95', 'ueber50', 'ueber100', 'max', 'groesster')}, ensure_ascii=False))
            if runde == 'leer' and 'nosw' not in a.q:
                # SW installieren lassen (lädt die Precache-Liste), dann zweiter Aufruf aus dem Cache
                pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller", timeout=120000)
                time.sleep(3)
            pg.close()
    finally:
        b.close()
    return erg


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('modus', choices=['start', 'rennen'])
    ap.add_argument('--url', default='https://drpeterkalmar.github.io/hyperbahn/')
    ap.add_argument('--wurzel', default=REPO)
    ap.add_argument('--strecke', default='megastadt')
    ap.add_argument('--sek', type=int, default=150)
    ap.add_argument('--drossel', type=float, default=4)
    ap.add_argument('--q', default='')
    ap.add_argument('--verweilen', type=float, default=3, help='s im Menü vor dem Start-Klick (start)')
    ap.add_argument('--stand', default='mess')
    ap.add_argument('--ungedeckelt', action='store_true', help='ohne 60-Hz-Deckel (nur für Vergleiche der Arbeit je Bild)')
    a = ap.parse_args()
    with sync_playwright() as pw:
        e = start(pw, a) if a.modus == 'start' else rennen(pw, a)
    os.makedirs(os.path.join(REPO, 'tests', 'perf'), exist_ok=True)
    p = os.path.join(REPO, 'tests', 'perf', f"{datetime.date.today()}_p3_{a.modus}_{a.stand}.json")
    json.dump(e, open(p, 'w'), indent=1, ensure_ascii=False)
    if a.modus == 'rennen':
        print(json.dumps({k: e.get(k) for k in ('version', 'n', 'dauer_s', 'fps', 'p50', 'p95', 'p99', 'ueber50', 'ueber100', 'max', 'groesster', 'programme', 'skalen', 'fehler')}, ensure_ascii=False))
        from collections import Counter
        print('Ursachen:', Counter(h['ursache'].split(' ')[0] if h['ursache'] != 'unbekannt' else 'unbekannt' for h in e.get('haenger', [])).most_common())
        for h in sorted(e.get('haenger', []), key=lambda h: -h['ms'])[:15]: print('  ', h)
        print('Erstauftritte (Shader/Textur/Geometrie neu):', len(e.get('erstauftritte', [])), 'Skala-Wechsel:', len(e.get('skala_wechsel', [])), 'GC:', e.get('gc'), 'Heap max MB:', e.get('heap_mb'))
        for h in e.get('erstauftritte', [])[:30]: print('   neu', h)
    print('→', p)
