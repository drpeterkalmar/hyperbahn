# Lage des Reset-Knopfs ↺ (26.10.2026): quer + hoch, Überlappung mit anderen HUD-Elementen, Bilder tests/shots/reset_lage_*
import sys, time, json
sys.path.insert(0, 'tests')
from util import *
PORTRAIT = dict(PIXEL7_LAND, viewport={"width": 412, "height": 915})
with Server() as srv, sync_playwright() as pw:
    for name, ctx in (('quer', PIXEL7_LAND), ('hoch', PORTRAIT)):
        s = Session(pw, srv.base, device=ctx)
        s.open('?nosw')
        time.sleep(2); s.ev("__hb.starte()"); time.sleep(5)
        print(name, json.dumps(s.ev("""(() => { const r=document.querySelector('.reset').getBoundingClientRect(); const out={reset:[r.left|0,r.top|0,r.width|0,r.height|0], W:innerWidth,H:innerHeight, overlap:[]};
          for (const e of document.querySelectorAll('.hud *')) { if (e===document.querySelector('.reset')||e.closest('.reset')) continue; const q=e.getBoundingClientRect(); const st=getComputedStyle(e);
            if (!q.width||st.display==='none'||st.visibility==='hidden'||+st.opacity===0) continue;
            if (q.left<r.right&&q.right>r.left&&q.top<r.bottom&&q.bottom>r.top) out.overlap.push((e.className||e.tagName)+':'+(e.textContent||'').trim().slice(0,20)); }
          return out; })()""")))
        s.shot(f'reset_lage_{name}')
        print('Fehler', s.errors[:5])
        s.close()
