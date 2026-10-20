// HUD + Menü im Neon-Stil (DOM). Handy zuerst, Hoch- und Querformat vollwertig (Anordnung per CSS, css/style.css).
// Anzeige: Tempo (gefühlte km/h), Platz, Runde, Rundenzeit, Schild-Balken, Boost-Balken, Magnet-Hinweis, „SPEED OK“ vor
// Sprüngen, Countdown, Meldungen, Zieleinlauf. Einstellungen (Fahrhilfe, Gegner, KI-Stärke, ⚡ Blitze reduzieren,
// 🎬 Action-Momente, Horizont halten, Ton) werden in localStorage gemerkt; URL-Regler haben Vorrang.
import { fmtTime } from '../core/util.js';
import { ANZEIGE } from '../config.js';

const SPEICHER = 'hyperbahn-einstellungen';
export const STANDARD = { hilfe: 'leicht', klasse: 'mittel', gegner: 7, ki: 'mittel', blitzeReduziert: false, action: 1, horizont: false, ton: true, runden: 3, karte: '3d', karteNord: false };

export function ladeEinstellungen() {
  try { return { ...STANDARD, ...JSON.parse(localStorage.getItem(SPEICHER) || '{}') }; } catch { return { ...STANDARD }; }
}
export function speichereEinstellungen(e) { try { localStorage.setItem(SPEICHER, JSON.stringify(e)); } catch { /* privat */ } }

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };

export class Hud {
  constructor(root, { onStart, onEinstellung, onWeiter } = {}) {
    this.root = root; this.onStart = onStart; this.onEinstellung = onEinstellung; this.onWeiter = onWeiter;
    this.einst = ladeEinstellungen();
    root.innerHTML = '';
    // Spiel-HUD
    this.hud = el('div', 'hud');
    this.hud.innerHTML = `
      <div class="hud-oben">
        <div class="platz"><span class="gross" data-k="platz">–</span><span class="klein" data-k="von">/8</span></div>
        <div class="runde">RUNDE <span data-k="runde">1/3</span><div class="zeit" data-k="zeit">0:00,00</div><div class="zeit beste" data-k="beste"></div></div>
      </div>
      <div class="hud-tempo">
        <div class="tempo"><span class="gross" data-k="tempo">0</span><span class="einheit">km/h</span></div>
        <div class="balken schild"><i data-k="schild"></i><b>SCHILD</b></div>
        <div class="balken boost"><i data-k="boost"></i><b>BOOST</b></div>
      </div>
      <div class="hinweis magnet" data-k="magnet">⟁ MAGNET</div>
      <div class="hinweis speed" data-k="speed">SPEED OK</div>
      <div class="countdown" data-k="countdown"></div>
      <div class="meldung" data-k="meldung"></div>
      <div class="blitz" data-k="blitz"></div>
      <div class="touch">
        <button class="tk bremse-l" data-k="bremseL">◀︎ BREMSE</button>
        <button class="tk rolle" data-k="rolle">⟲ ROLLE</button>
        <button class="tk bremse-r" data-k="bremseR">BREMSE ▶︎</button>
      </div>
      <button class="pause" data-k="pause" aria-label="Pause">❚❚</button>
      <div class="karte" data-k="karte" title="Minikarte: tippen = groß/klein"></div>`;
    root.appendChild(this.hud);
    this.k = {};
    this.hud.querySelectorAll('[data-k]').forEach((e) => { this.k[e.dataset.k] = e; });
    // Menü
    this.menue = el('div', 'menue');
    root.appendChild(this.menue);
    this.baueMenue();
    this.meldungBis = 0;
  }

  baueMenue() {
    const e = this.einst;
    const wahl = (key, opts) => `<div class="wahl" data-wahl="${key}">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(e[key]) === String(v) ? 'an' : ''}">${t}</button>`).join('')}</div>`;
    this.menue.innerHTML = `
      <h1 class="titel">HYPER<span>BAHN</span></h1>
      <div class="unter">Neon-Megastadt · Runde ${e.runden}</div>
      <button class="weiter">WEITER</button>
      <button class="start">RENNEN STARTEN</button>
      <div class="einst">
        <label>Fahrhilfe</label>${wahl('hilfe', [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['profi', 'Profi']])}
        <label>Gleiter-Klasse</label>${wahl('klasse', [['leicht', 'Leicht (spritzig)'], ['mittel', 'Mittel'], ['schwer', 'Schwer (rammt)']])}
        <label>Gegner</label>${wahl('gegner', [[0, '0'], [3, '3'], [7, '7']])}
        <label>KI-Stärke</label>${wahl('ki', [['leicht', 'Leicht'], ['mittel', 'Mittel'], ['profi', 'Profi']])}
        <label>🎬 Action-Momente</label>${wahl('action', [[0, 'Aus'], [1, 'Selten'], [2, 'Oft']])}
        <label>⚡ Blitze reduzieren</label>${wahl('blitzeReduziert', [[false, 'Aus'], [true, 'An']])}
        <label>Horizont halten</label>${wahl('horizont', [[false, 'Aus'], [true, 'An']])}
        <label>Ton</label>${wahl('ton', [[true, 'An'], [false, 'Aus']])}
        <label>Minikarte</label>${wahl('karte', [['3d', '3D'], ['2d', '2D'], ['aus', 'Aus']])}
        <label>Karte dreht</label>${wahl('karteNord', [[false, 'Mit'], [true, 'Norden oben']])}
      </div>
      <button class="credits-knopf">Credits</button>
      <div class="steuerung">← → lenken · ↑ Gas (beim Countdown auf „Grün“ tippen = Start-Boost) · Q/E Luftbremsen · in der Kurve Luftbremse innen halten = Drift, kurz lösen und neu ziehen = Turbo-Stufe · Leertaste Barrel-Roll im Sprung (= Turbo) · ↑/↓ in der Luft Nase</div>`;
    this.menue.querySelector('.start').addEventListener('click', () => this.onStart && this.onStart(this.einst));
    this.menue.querySelector('.weiter').addEventListener('click', () => this.onWeiter && this.onWeiter());
    this.menue.querySelector('.credits-knopf').addEventListener('click', () => this.zeigeCredits());
    this.menue.querySelectorAll('[data-wahl]').forEach((w) => {
      w.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        const key = w.dataset.wahl;
        let v = b.dataset.v;
        if (v === 'true' || v === 'false') v = v === 'true'; else if (/^\d+$/.test(v)) v = +v;
        this.einst[key] = v;
        speichereEinstellungen(this.einst);
        w.querySelectorAll('button').forEach((x) => x.classList.toggle('an', x === b));
        this.onEinstellung && this.onEinstellung(key, v, this.einst);
      }));
    });
  }

  // Credits (CC-BY verlangt Namensnennung im Spiel; Liste wie LICENSES.md)
  zeigeCredits() {
    const c = el('div', 'credits');
    c.innerHTML = `<h2>Credits</h2>
      <p>Gleiter-Modelle von Sketchfab, Lizenz CC BY 4.0 (bearbeitet: ausgerichtet, verkleinert, umgefärbt):</p>
      <ul><li>„Racing spaceship“ – Nikcore</li><li>„Blue Demon (Space Racer)“ – Mattdude</li>
      <li>„Racing ship“ – pedrolopezgarcia</li><li>„The Arrow“ – totidoki</li></ul>
      <p>Musik: „Cyber Runner“ – ansimuz (OpenGameArt, CC0).</p>
      <p>three.js (MIT). Strecke, Stadt, Physik, KI und Klänge: eigene Arbeit.</p>
      <button class="zu">Schließen</button>`;
    c.querySelector('.zu').addEventListener('click', () => c.remove());
    this.menue.appendChild(c);
  }

  zeigeMenue(an = true, pause = false) {
    document.body.dataset.mode = an ? 'menu' : 'rennen'; this.menue.style.display = an ? '' : 'none';
    this.menue.classList.toggle('pause', an && pause);
    const st = this.menue.querySelector('.start'); if (st && st.textContent !== 'NOCHMAL') st.textContent = an && pause ? 'NEU STARTEN' : 'RENNEN STARTEN';
  }

  // z = { tempo (m/s), platz, von, runde, runden, zeit, beste, schild, boost, magnet, speedOk (null|true|false), countdown }
  update(z, t) {
    const k = this.k;
    k.tempo.textContent = Math.round(z.tempo * 3.6 * ANZEIGE.faktor);
    k.platz.textContent = z.platz; k.von.textContent = '/' + z.von;
    k.runde.textContent = `${Math.min(z.runde + 1, z.runden)}/${z.runden}`;
    k.zeit.textContent = fmtTime(z.zeit);
    k.beste.textContent = isFinite(z.beste) ? 'BESTE ' + fmtTime(z.beste) : '';
    k.schild.style.transform = `scaleX(${Math.max(0, Math.min(1, z.schild))})`;
    k.boost.style.transform = `scaleX(${Math.max(0, Math.min(1, z.boost))})`;
    this.hud.classList.toggle('boostet', z.boost > 0.05);
    k.magnet.classList.toggle('an', !!z.magnet);
    k.speed.classList.toggle('an', z.speedOk !== null && z.speedOk !== undefined);
    k.speed.classList.toggle('schlecht', z.speedOk === false);
    k.speed.textContent = z.speedOk === false ? 'MEHR TEMPO!' : 'SPEED OK';
    k.countdown.textContent = z.countdown > 0 ? String(Math.ceil(z.countdown)) : '';
    if (t > this.meldungBis) k.meldung.classList.remove('an');
  }

  meldung(text, t, dauer = 1.6) { this.k.meldung.textContent = text; this.k.meldung.classList.add('an'); this.meldungBis = t + dauer; }

  // Weißblitz/Farbflash als DOM-Ebene (zusätzlich zum Kino-Look): k 0…1 (schon durch die Blitz-Bremse)
  blitz(k, farbe = '#fff') { const b = this.k.blitz; b.style.background = farbe; b.style.opacity = String(Math.min(1, k)); }

  ziel(rangliste, spielerK) {
    const zeilen = rangliste.map((t) => `<tr class="${t.k === spielerK ? 'ich' : ''}"><td>${t.platz}.</td><td>${t.name}</td><td>${t.ziel ? fmtTime(t.ziel.zeit) : '—'}</td><td>${isFinite(t.beste) ? fmtTime(t.beste) : ''}</td></tr>`).join('');
    this.menue.innerHTML = `<h1 class="titel">ZIEL</h1><table class="rang"><tr><th></th><th>Fahrer</th><th>Zeit</th><th>Beste Runde</th></tr>${zeilen}</table><button class="start">NOCHMAL</button>`;
    this.menue.querySelector('.start').addEventListener('click', () => { this.baueMenue(); this.onStart && this.onStart(this.einst); });
    this.zeigeMenue(true);
  }
}
