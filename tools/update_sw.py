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
