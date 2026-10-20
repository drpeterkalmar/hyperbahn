# Sketchfab-Suche nach freien Gleiter-Modellen (Lizenz aus der API, nicht aus dem Suchtext).
# Aufruf: python3 tools/sketchfab_suche.py "hover racer" "anti gravity" …   (Token aus dem Schlüsselbund)
# Ausgabe: uid, Lizenz, Dreiecke, Name, Urheber, Likes – nur CC0 und CC-BY (ohne NC/ND/SA).
import json, subprocess, sys, time, urllib.parse, urllib.request

TOKEN = subprocess.run(['security', 'find-generic-password', '-s', 'hermes-sketchfab-token', '-a', 'hermes', '-w'],
                       capture_output=True, text=True).stdout.strip()

def hole(url):
    # Sketchfab über VPN wackelig: 5 Versuche mit Pause
    for k in range(5):
        try:
            req = urllib.request.Request(url, headers={'Authorization': 'Token ' + TOKEN})
            return json.load(urllib.request.urlopen(req, timeout=40))
        except Exception as e:
            err = e; time.sleep(1.5 * (k + 1))
    raise err

def suche(q, max_faces=60000):
    url = ('https://api.sketchfab.com/v3/search?type=models&downloadable=true&count=24&licenses=by&licenses=cc0'
           f'&max_face_count={max_faces}&q=' + urllib.parse.quote(q))
    return hole(url).get('results', [])

if __name__ == '__main__':
    gesehen = {}
    for q in sys.argv[1:]:
        for m in suche(q):
            gesehen[m['uid']] = m
    for m in sorted(gesehen.values(), key=lambda m: -m.get('likeCount', 0)):
        lic = (m.get('license') or {}).get('label') or (m.get('license') or {}).get('slug') or '?'
        print(m['uid'], '|', lic, '|', m.get('faceCount'), '|', m['name'][:50], '|', m['user']['username'], '|', m.get('likeCount'))
