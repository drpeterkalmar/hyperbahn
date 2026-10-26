# Version heben (nur beim Zusammenführen unter der Push-Sperre, damit zwei Jobs nie dieselbe Version vergeben):
# Patch-Stelle +1 in package.json und src/version.js, erste Überschrift „## NEU“ im CHANGELOG bekommt die Nummer und das
# Datum, Service-Worker neu (Inhalts-Hash = Cache-Busting), Commit.
# Aufruf: python3 tools/version_heben.py "<Kurztitel für den Commit>"
import json, os, re, subprocess, sys, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, 'package.json')
pk = json.load(open(p, encoding='utf-8'))
a, b, c = (int(x) for x in pk['version'].split('.'))
ver = f'{a}.{b}.{c + 1}'
pk['version'] = ver
open(p, 'w', encoding='utf-8', newline='\n').write(json.dumps(pk, indent=2, ensure_ascii=False) + '\n')
open(os.path.join(ROOT, 'src', 'version.js'), 'w', encoding='utf-8', newline='\n').write(
    "// Spiel-Version (tools/version_heben.py setzt sie beim Zusammenführen; Live-Check: src/version.js?x=…)\n"
    f"export const VERSION = '{ver}';\n")
cl = os.path.join(ROOT, 'CHANGELOG.md')
t = open(cl, encoding='utf-8').read()
heute = datetime.date.today().strftime('%d.%m.%Y')
if '## NEU' in t:
    t = t.replace('## NEU', f'## {ver} – {heute}', 1)
    open(cl, 'w', encoding='utf-8', newline='\n').write(t)
subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'update_sw.py')], check=True)
titel = sys.argv[1] if len(sys.argv) > 1 else 'Version'
subprocess.run(['git', 'add', '-A'], cwd=ROOT, check=True)
subprocess.run(['git', 'commit', '-q', '-m', f'{ver}: {titel}\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'], cwd=ROOT, check=True)
print(ver)
