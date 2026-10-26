# Schreibt sw.js neu: Precache-Liste aller Spieldateien + Inhalts-Hash als Version (Cache-Busting).
# Nach jeder Änderung an Spieldateien ausführen: python3 tools/update_sw.py  (Hyperbahn: aus der Stuntbahn übernommen)
import hashlib, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = ['index.html', 'manifest.webmanifest', 'css/style.css']
for d in ['src', 'lib', 'icons', 'assets']:
    for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
        for f in sorted(fn):
            rel = os.path.relpath(os.path.join(dp, f), ROOT)
            # sammlung_stil.json: Stil-Modell nur für den Build, nicht fürs Spiel
            # n17: KTX2-Texturen + Basis-Transcoder; WebP mit KTX2-Zwilling nur als Rückfall (nicht vorab cachen)
            twin = f.endswith('.webp') and os.path.exists(os.path.join(dp, f[:-5] + '.ktx2'))
            # n20: Landschafts-Themen (assets/themes/) laden nur bei Bedarf – der Service-Worker legt sie beim ersten Abruf ab
            if rel.startswith(os.path.join('assets', 'themes') + os.sep): continue
            # n30 HDR-Diät: das alte 1k-Land-HDR bleibt nur für ?hdr=1k (A/B) liegen – nicht vorab cachen
            if rel == os.path.join('assets', 'hdr', 'sky_1k.hdr'): continue
            # n30 Impostors: nur die Tannen (Land, Standard-Landschaft) vorab; die Themen-Bäume beim ersten Abruf
            if rel.startswith(os.path.join('assets', 'tex', 'imp') + os.sep) and not (f == 'impostor.json' or f.startswith('tanne')): continue
            if f.endswith(('.js', '.png', '.css', '.webp', '.jpg', '.json', '.glb', '.hdr', '.bin', '.m4a', '.ktx2', '.wasm')) and not f.startswith('.') and not twin and rel != os.path.join('assets', 'sammlung_stil.json'):
                files.append(rel.replace(os.sep, '/'))   # Windows (rog17): Pfade in sw.js immer mit /
files = sorted(set(files))

# P3 Etappe 2 (Peter: „starten langsam“): Vorab-Ladeliste in index.html – alle statisch importierten Module von
# src/main.js (sonst lädt der Browser den Import-Baum Ebene für Ebene, je Ebene eine Netz-Rundreise ≈ 170 ms auf 4G). Zwischen den Markierungen <!-- vorab:anfang --> … <!-- vorab:ende -->.
import re, json
IMPORT = re.compile(r'''^\s*import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]''', re.M)
def modul_baum(start):
    gesehen, offen = [], [start]
    while offen:
        rel = offen.pop(0)
        if rel in gesehen: continue
        gesehen.append(rel)
        quelle = open(os.path.join(ROOT, rel), encoding='utf-8').read()
        for spec in IMPORT.findall(quelle):
            if spec == 'three': ziel = 'lib/three.module.min.js'
            elif spec.startswith('three/addons/'): ziel = 'lib/addons/' + spec[len('three/addons/'):]
            elif spec.startswith('.'): ziel = os.path.normpath(os.path.join(os.path.dirname(rel), spec)).replace(os.sep, '/')
            else: continue
            if os.path.exists(os.path.join(ROOT, ziel)): offen.append(ziel)
    return gesehen
module = modul_baum('src/main.js')
if os.path.exists(os.path.join(ROOT, 'lib/three.module.min.js')) and 'lib/three.core.min.js' not in module:
    if "three.core.min.js" in open(os.path.join(ROOT, 'lib/three.module.min.js'), encoding='utf-8').read(): module.append('lib/three.core.min.js')
# dynamisch, aber beim Start immer gebraucht: Gleiter-Lader und Ton
for extra in ['lib/addons/loaders/GLTFLoader.js', 'lib/addons/utils/SkeletonUtils.js', 'src/audio/ton.js']:
    for m in modul_baum(extra):
        if m not in module: module.append(m)
# je Strecke Daten + Kulisse samt Import-Baum: das Inline-Skript in index.html lädt die gewählte Strecke gleich mit vor
STRECKEN_DYN = re.findall(r"id: '([a-z-]+)'.*?daten: \(\) => import\('\./([^']+)'\), kulisse: \(\) => import\('\.\./gfx/([^']+)'\)",
                          open(os.path.join(ROOT, 'src/track/strecken.js'), encoding='utf-8').read(), re.S)
strecken_vorab = {}
for sid, daten, kul in STRECKEN_DYN:
    liste = []
    for start in ('src/track/' + daten, 'src/gfx/' + kul):
        for m in modul_baum(start):
            if m not in module and m not in liste: liste.append(m)
    strecken_vorab[sid] = liste
glb = sorted(f for f in files if f.startswith('assets/gleiter/') and f.endswith('.glb'))
# Gleiter-Modelle NICHT vorab: gemessen (Fast 4G) verdrängen sie three.core.min.js und das Menü kommt später
zeilen = [f'<link rel="modulepreload" href="{m}">' for m in module]
ih = os.path.join(ROOT, 'index.html')
html = open(ih, encoding='utf-8').read()
if '<!-- vorab:anfang -->' in html:
    a, rest = html.split('<!-- vorab:anfang -->', 1); _, e = rest.split('<!-- vorab:ende -->', 1)
    html = a + '<!-- vorab:anfang -->\n' + '\n'.join(zeilen) + '\n<!-- vorab:ende -->' + e
    if '/*vorab-strecken*/' in html:
        a, rest = html.split('/*vorab-strecken*/', 1); _, e = rest.split('/*ende*/', 1)
        html = a + '/*vorab-strecken*/' + json.dumps(strecken_vorab, separators=(',', ':')) + '/*ende*/' + e
    open(ih, 'w', encoding='utf-8', newline='\n').write(html)
    print('index.html: Vorab-Liste', len(module), 'Module')
# Inhalts-Hash auch über die Themen-Pakete (nicht vorab gecacht, aber eine Änderung muss die Version wechseln)
hashed = list(files)
for dp, dn, fn in os.walk(os.path.join(ROOT, 'assets', 'themes')):
    for f in sorted(fn):
        if not f.startswith('.'): hashed.append(os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, '/'))
hashed = sorted(set(hashed))
h = hashlib.sha256()
for f in hashed:
    if f == 'src/build.js': continue  # enthält selbst die Version
    h.update(f.encode()); h.update(open(os.path.join(ROOT, f), 'rb').read())
ver = h.hexdigest()[:10]
# Hyperbahn-Vorbau: feste Version per Argument (python tools/update_sw.py --version vorbau) – Cache-Busting über den
# Inhalts-Hash macht der Heavy-Job mit dem normalen Aufruf ohne Argument.
import sys
if '--version' in sys.argv: ver = sys.argv[sys.argv.index('--version') + 1]
tpl = open(os.path.join(ROOT, 'tools', 'sw.template.js'), encoding='utf-8').read()
out = tpl.replace('__VERSION__', ver).replace('__ASSETS__', ',\n  '.join("'" + f + "'" for f in files))
open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8', newline='\n').write(out)
open(os.path.join(ROOT, 'src', 'build.js'), 'w', encoding='utf-8', newline='\n').write(f"export const BUILD = '{ver}';\n")
size = sum(os.path.getsize(os.path.join(ROOT, f)) for f in files)
print('sw.js Version', ver, len(files), 'Dateien', round(size / 1e6, 2), 'MB')
