// HUD + Menü im Neon-Stil (DOM). Handy zuerst, Hoch- und Querformat vollwertig (Anordnung per CSS, css/style.css).
// Anzeige: Tempo (gefühlte km/h), Platz, Runde, Rundenzeit, Schild-Balken, Boost-Balken, Magnet-Hinweis, „SPEED OK“ vor
// Sprüngen, Countdown, Meldungen, Zieleinlauf. Einstellungen (Fahrhilfe, Gegner, KI-Stärke, ⚡ Blitze reduzieren,
// 🎬 Action-Momente, Horizont halten, Ton) werden in localStorage gemerkt; URL-Regler haben Vorrang.
import { fmtTime } from '../core/util.js';
import { ANZEIGE } from '../config.js';
import { VERSION } from '../version.js';
import { Vorschau } from './vorschau.js';

const SPEICHER = 'hyperbahn-einstellungen';
// P1b: `runden` nicht mehr gemerkt (kommt aus der Strecken-Fassung, Rennen ≤ 5 min); alte gespeicherte 3 Runden zählen nicht
// P2: `strecke` = Strecken-Id aus dem Register (alte Werte kurz/lang gelten als Megastadt kurz/lang)
export const STANDARD = { hilfe: 'leicht', klasse: 'mittel', gegner: 7, ki: 'mittel', blitzeReduziert: false, action: 1, horizont: false, ton: true, strecke: 'megastadt', karte: '3d', karteNord: false };

export function ladeEinstellungen() {
  try { const e = { ...STANDARD, ...JSON.parse(localStorage.getItem(SPEICHER) || '{}') }; delete e.runden; return e; } catch { return { ...STANDARD }; }
}
export function speichereEinstellungen(e) { try { localStorage.setItem(SPEICHER, JSON.stringify(e)); } catch { /* privat */ } }

const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };

export class Hud {
  // strecke = { id, name, runden } (Menü-Zeile); strecken = [{ id, name, charakter, text, farbe, runden }] (Karten);
  // onStrecke(id) bei Wahl einer Karte (auch 'zufall', 'cup', 'megastadt-lang'), onTeilen(id), onNaechstes() im Cup
  constructor(root, { onStart, onEinstellung, onWeiter, onStrecke, onTeilen, onNaechstes, strecke, strecken = [], cup = false } = {}) {
    this.cupMoeglich = cup;
    this.root = root; this.onStart = onStart; this.onEinstellung = onEinstellung; this.onWeiter = onWeiter;
    this.onStrecke = onStrecke; this.onTeilen = onTeilen; this.onNaechstes = onNaechstes;
    this.strecke = strecke || { id: 'megastadt', name: 'Neon-Megastadt', runden: 2 };
    this.strecken = strecken; this.vorschauDaten = {}; this.bestTexte = {}; this.vorschauen = []; this.cupAn = false;
    this.einst = ladeEinstellungen();
    root.innerHTML = '';
    // Spiel-HUD
    this.hud = el('div', 'hud');
    this.hud.innerHTML = `
      <div class="gvig" data-k="gvig"></div>
      <div class="hud-oben">
        <div class="platz"><span class="gross" data-k="platz">–</span><span class="klein" data-k="von">/8</span></div>
        <div class="runde">RUNDE <span data-k="runde">1/3</span><div class="zeit" data-k="zeit">0:00,00</div><div class="zeit beste" data-k="beste"></div></div>
      </div>
      <div class="hud-tempo">
        <div class="tempo"><span class="gross" data-k="tempo">0</span><span class="einheit">km/h</span></div>
        <div class="balken schild" data-k="schildBalken"><i data-k="schild"></i><b>ENERGIE</b></div>
        <div class="balken boost"><i data-k="boost"></i><b>BOOST</b></div>
      </div>
      <div class="hinweis magnet" data-k="magnet">⟁ MAGNET</div>
      <div class="hinweis speed" data-k="speed">SPEED OK</div>
      <div class="countdown" data-k="countdown"></div>
      <div class="drehzahl" data-k="drehzahl"><div class="dz-balken"><i data-k="dzI"></i><s data-k="dzBand"></s></div><span data-k="dzT"></span></div>
      <div class="flug" data-k="flug"><div class="flug-balken"><i data-k="flugI"></i><s style="left:26.7%"></s><s style="left:53.3%"></s><s style="left:calc(100% - 2px)"></s></div><span data-k="flugT"></span></div>
      <div class="meldung" data-k="meldung"></div>
      <div class="blitz" data-k="blitz"></div>
      <div class="touch">
        <button class="tk bremse-l" data-k="bremseL">◀︎ BREMSE</button>
        <button class="tk rolle" data-k="rolle">⟲ ROLLE</button>
        <button class="tk bremse-r" data-k="bremseR">BREMSE ▶︎</button>
      </div>
      <button class="pause" data-k="pause" aria-label="Pause">❚❚</button>
      <button class="reset" data-k="reset" aria-label="Zurück auf die Strecke (R)" title="Zurück auf die Strecke (R)">↺</button>
      <div class="abblende" data-k="abblende"></div>
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
      ${this.strecken.length ? `<div class="strecken">${this.strecken.map((t) => `
        <div class="sk" role="button" tabindex="0" data-id="${t.id}" style="--farbe:${t.farbe}">
          <canvas width="240" height="120"></canvas>
          <b>${t.name}</b><i>${t.charakter}</i><small>${t.text}</small>
          <span class="sk-zeile"><span>${t.runden} ${t.runden === 1 ? 'Runde' : 'Runden'}</span><span class="sk-best" data-best="${t.id}">${this.bestTexte[t.id] || ''}</span></span>
          <button class="sk-teilen" data-teilen="${t.id}" aria-label="Link teilen" title="Link zu dieser Strecke teilen">🔗</button>
        </div>`).join('')}
        <div class="sk sk-extra" role="button" tabindex="0" data-id="zufall" style="--farbe:#ffd400"><b>🎲 Zufällig</b><i>Überraschung</i><small>Eine zufällige Strecke – nie zweimal hintereinander dieselbe.</small></div>
        ${this.cupMoeglich ? `<div class="sk sk-extra" role="button" tabindex="0" data-id="cup" style="--farbe:#00ffa0"><b>🏆 Cup</b><i>alle 5 Strecken</i><small>Fünf Rennen nacheinander, Punkte 9-7-5-3-2-1 je Platz. Wer am Ende vorn liegt, gewinnt den Cup.</small></div>` : ''}
      </div>` : ''}
      <div class="unter" data-k2="unter">${this.unterText()}</div>
      <div class="fassung" data-k2="fassung"></div>
      <div class="menue-meldung" data-k2="mm"></div>
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
      <div class="version">v${VERSION}</div>
      <div class="steuerung">← → lenken · ↑ Gas (kurz vor „Grün“ tippen = Start-Boost) · Q/E Luftbremsen · in der Kurve Luftbremse innen halten = Drift, kurz lösen und neu ziehen = Turbo-Stufe · Leertaste: am Boden Boost (ab Runde 2), im Sprung Barrel-Roll (Turbo bei der Landung) · Y/X seitwärts · in der Luft ↓ = Nase hoch, ↑ neu drücken = Nase runter (über den Absprung gehaltenes Gas verstellt die Nase nie)</div>`;
    this.menue.querySelector('.start').addEventListener('click', () => this.onStart && this.onStart(this.einst));
    this.menue.querySelector('.weiter').addEventListener('click', () => this.onWeiter && this.onWeiter());
    // Strecken-Karten (P2): Tippen = wählen, 🔗 = Teilen-Link
    this.menue.querySelectorAll('.sk').forEach((k) => {
      const waehle = (ev) => {
        const t = ev.target.closest('[data-teilen]');
        if (t) { ev.stopPropagation(); this.onTeilen && this.onTeilen(t.dataset.teilen); return; }
        this.onStrecke && this.onStrecke(k.dataset.id);
      };
      k.addEventListener('click', waehle);
      k.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); waehle(ev); } });
    });
    this.vorschauen = [...this.menue.querySelectorAll('.sk canvas')].map((c) => {
      const id = c.parentElement.dataset.id, t = this.strecken.find((x) => x.id === id);
      return new Vorschau(c, this.vorschauDaten[id] || null, t ? t.farbe : '#4af');
    });
    this.markiere();
    this.vorschauLauf();
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

  unterText() {
    const st = this.strecke;
    if (this.cupAn) return `CUP · 5 STRECKEN · BEGINNT MIT ${String(st.cupStart || st.name).toUpperCase()}`;
    return `${st.name} · ${st.runden} ${st.runden === 1 ? 'Runde' : 'Runden'}`;
  }

  // P2: geladene Strecke (id, name, runden, fassungen: [[id, Text], …] für die Megastadt) bzw. Cup-Modus markieren
  setzeStrecke(st, cupAn = this.cupAn) {
    this.strecke = { ...this.strecke, ...st }; this.cupAn = cupAn;
    this.einst.strecke = st.id; speichereEinstellungen(this.einst);
    const u = this.menue.querySelector('[data-k2="unter"]'); if (u) u.textContent = this.unterText();
    const f = this.menue.querySelector('[data-k2="fassung"]');
    if (f) {
      const liste = !cupAn && st.fassungen ? st.fassungen : [];
      f.innerHTML = liste.length ? `<div class="wahl">${liste.map(([id, txt]) => `<button data-fassung="${id}" class="${id === st.id ? 'an' : ''}">${txt}</button>`).join('')}</div>` : '';
      f.querySelectorAll('[data-fassung]').forEach((b) => b.addEventListener('click', () => this.onStrecke && this.onStrecke(b.dataset.fassung)));
    }
    const st2 = this.menue.querySelector('.start');
    if (st2 && st2.textContent !== 'NOCHMAL' && !this.menue.classList.contains('pause')) st2.textContent = cupAn ? 'CUP STARTEN' : 'RENNEN STARTEN';
    this.markiere();
  }

  markiere() {
    const id = this.cupAn ? 'cup' : (this.strecke.id || '').replace(/-lang$/, '');
    this.menue.querySelectorAll('.sk').forEach((k) => k.classList.toggle('an', k.dataset.id === id));
  }

  // Vorschau-Daten (vorschau.js) und Bestzeit-Text je Strecke (kommen nach und nach, Strecken werden lazy gebaut)
  setzeVorschau(id, daten, best = '') {
    this.vorschauDaten[id] = daten; this.bestTexte[id] = best;
    for (const v of this.vorschauen) if (v.c.parentElement.dataset.id === id) v.d = daten;
    const b = this.menue.querySelector(`[data-best="${id}"]`); if (b) b.textContent = best;
  }

  // Vorschauen drehen, solange das Menü sichtbar ist (≈ 20 Bilder/s)
  vorschauLauf() {
    if (this._vl) return;
    let letzt = 0;
    const lauf = (ts) => {
      if (this.menue.style.display === 'none' || !this.vorschauen.length) { this._vl = 0; return; }
      this._vl = requestAnimationFrame(lauf);
      if (ts - letzt < 50) return;
      letzt = ts;
      for (const v of this.vorschauen) if (v.d && v.c.isConnected) v.zeichne(ts / 1000);
    };
    this._vl = requestAnimationFrame(lauf);
  }

  menueMeldung(text, dauer = 2) {
    const m = this.menue.querySelector('[data-k2="mm"]'); if (!m) return;
    m.textContent = text; m.classList.add('an');
    clearTimeout(this._mmT); this._mmT = setTimeout(() => m.classList.remove('an'), dauer * 1000);
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
    const st = this.menue.querySelector('.start'); if (st && st.textContent !== 'NOCHMAL' && !st.dataset.cup) st.textContent = an && pause ? 'NEU STARTEN' : this.cupAn ? 'CUP STARTEN' : 'RENNEN STARTEN';
    if (an) this.vorschauLauf();
  }

  // z = { tempo (m/s), platz, von, runde, runden, zeit, beste, schild (= Energie), warn, boost, magnet, speedOk, countdown,
  //       taste: { boden, moeglich } }
  update(z, t) {
    const k = this.k;
    k.tempo.textContent = Math.round(z.tempo * 3.6 * ANZEIGE.faktor);
    k.platz.textContent = z.platz; k.von.textContent = '/' + z.von;
    k.runde.textContent = `${Math.min(z.runde + 1, z.runden)}/${z.runden}`;
    k.zeit.textContent = fmtTime(z.zeit);
    k.beste.textContent = isFinite(z.beste) ? 'BESTE ' + fmtTime(z.beste) : '';
    k.schild.style.transform = `scaleX(${Math.max(0, Math.min(1, z.schild))})`;
    k.schildBalken.classList.toggle('warn', !!z.warn);
    // ROLLE-Taste (P1b): am Boden Energie-Boost, in der Luft Barrel-Roll; grau, wenn gerade nicht möglich
    if (z.taste) {
      const txt = z.taste.boden ? '⚡ BOOST' : '⟲ ROLLE';
      if (k.rolle.textContent !== txt) k.rolle.textContent = txt;
      k.rolle.classList.toggle('boost', z.taste.boden);
      k.rolle.classList.toggle('gesperrt', !z.taste.moeglich);
    }
    k.boost.style.transform = `scaleX(${Math.max(0, Math.min(1, z.boost))})`;
    this.hud.classList.toggle('boostet', z.boost > 0.05);
    k.magnet.classList.toggle('an', !!z.magnet);
    k.speed.classList.toggle('an', z.speedOk !== null && z.speedOk !== undefined);
    k.speed.classList.toggle('schlecht', z.speedOk === false);
    k.speed.textContent = z.speedOk === false ? 'MEHR TEMPO!' : 'SPEED OK';
    k.countdown.textContent = z.countdown > 0 ? String(Math.ceil(z.countdown)) : '';
    if (t > this.meldungBis) k.meldung.classList.remove('an');
  }

  // G-Vignette (P1b): Deckkraft 0…0,35
  gVignette(d) {
    if (d === this.gvAlt) return;
    this.gvAlt = d; this.k.gvig.style.opacity = d.toFixed(3);
  }

  // Drehzahl-Band im Countdown (P1b, nur mit analogem Gas-Abzug): wert 0…1 oder null = aus
  drehzahl(wert, S) {
    const k = this.k;
    k.drehzahl.classList.toggle('an', wert != null);
    if (wert == null) return;
    k.dzI.style.transform = `scaleX(${Math.max(0, Math.min(1, wert))})`;
    k.dzBand.style.left = `${S.lo * 100}%`; k.dzBand.style.width = `${(S.hi - S.lo) * 100}%`;
    const im = wert >= S.lo && wert <= S.hi;
    k.drehzahl.classList.toggle('gut', im); k.drehzahl.classList.toggle('zuviel', wert > S.hi);
    k.dzT.textContent = `DREHZAHL ${Math.round(wert * 100)} %${im ? ' ✓' : ''}`;
  }

  // Flugmesser (P1b): in der Luft Flugzeit + erreichte Stufe; nach der Landung (ergebnis) VORLAGE.flug.messer s stehen
  flugMesser(inLuft, luftZeit, t, ergebnis = null, dauer = 1.5) {
    const k = this.k;
    if (ergebnis) {
      this.flugBis = t + dauer;
      k.flug.classList.toggle('stufe', ergebnis.stufe > 0); k.flug.classList.toggle('schief', !ergebnis.sauber);
      k.flugT.textContent = ergebnis.sauber ? (ergebnis.stufe ? `FLUG-BOOST STUFE ${ergebnis.stufe}` : 'FLUG') : 'SCHIEF GELANDET – KEIN FLUG-BOOST';
      k.flugI.style.transform = `scaleX(${Math.min(1, ergebnis.luft / 3)})`;
      k.flug.classList.add('an');
      return;
    }
    if (inLuft && luftZeit > 0.5) {
      const st = luftZeit >= 3 ? 3 : luftZeit >= 1.6 ? 2 : luftZeit >= 0.8 ? 1 : 0;
      k.flug.classList.remove('schief'); k.flug.classList.toggle('stufe', st > 0);
      k.flugI.style.transform = `scaleX(${Math.min(1, luftZeit / 3)})`;
      k.flugT.textContent = `FLUG ${luftZeit.toFixed(1).replace('.', ',')} s${st ? ' · STUFE ' + st : ''}`;
      k.flug.classList.add('an');
      this.flugBis = 0;
    } else if (!(t < this.flugBis)) k.flug.classList.remove('an');
  }

  // Reset: kurze Überblendung (dunkel → klar in 0,4 s); gesperrt = Knopf kurz grau
  abblenden() {
    const a = this.k.abblende;
    a.style.transition = 'none'; a.style.opacity = '0.85';
    void a.offsetWidth;
    a.style.transition = 'opacity 0.4s ease-out'; a.style.opacity = '0';
  }
  resetGesperrt(an) { this.k.reset.classList.toggle('gesperrt', !!an); }

  meldung(text, t, dauer = 1.6) { this.k.meldung.textContent = text; this.k.meldung.classList.add('an'); this.meldungBis = t + dauer; }

  // Weißblitz/Farbflash als DOM-Ebene (zusätzlich zum Kino-Look): k 0…1 (schon durch die Blitz-Bremse)
  blitz(k, farbe = '#fff') { const b = this.k.blitz; b.style.background = farbe; b.style.opacity = String(Math.min(1, k)); }

  // best = { rennen, runde, neuRennen, neuRunde, titel } (Bestzeiten je Strecke/Fassung/Rundenzahl, game/bestzeiten.js) oder null
  // cup (P2) = { k, n, tabelle: [{ name, punkte, plus, ich }], naechste (Name) | null } oder null
  ziel(rangliste, spielerK, best = null, cup = null) {
    const zeilen = rangliste.map((t) => `<tr class="${t.k === spielerK ? 'ich' : ''}"><td>${t.platz}.</td><td>${t.name}</td><td>${t.ziel ? fmtTime(t.ziel.zeit) : '—'}</td><td>${isFinite(t.beste) ? fmtTime(t.beste) : ''}</td></tr>`).join('');
    const bz = best ? `<div class="bestzeit">${best.titel}: Rennen ${best.rennen != null ? fmtTime(best.rennen) : '—'}${best.neuRennen ? ' <b>NEU!</b>' : ''} · Runde ${best.runde != null ? fmtTime(best.runde) : '—'}${best.neuRunde ? ' <b>NEU!</b>' : ''}</div>` : '';
    let cz = '';
    if (cup) {
      const fertig = !cup.naechste;
      cz = `<h2 class="cup-titel">${fertig ? '🏆 CUP-ENDSTAND' : `CUP · RENNEN ${cup.k + 1}/${cup.n}`}</h2>
        <table class="rang cup"><tr><th></th><th>Fahrer</th><th>Punkte</th><th></th></tr>${cup.tabelle.map((z, i) => `<tr class="${z.ich ? 'ich' : ''}"><td>${i + 1}.</td><td>${z.name}</td><td>${z.punkte}</td><td>${z.plus ? '+' + z.plus : ''}</td></tr>`).join('')}</table>
        ${fertig ? `<div class="bestzeit">${cup.tabelle[0].ich ? '<b>DU GEWINNST DEN CUP!</b>' : `Cup-Sieger: ${cup.tabelle[0].name}`}</div>` : ''}`;
    }
    const knoepfe = cup && cup.naechste ? `<button class="start naechstes">NÄCHSTES RENNEN · ${cup.naechste}</button>` : `<button class="start">NOCHMAL</button>`;
    this.menue.innerHTML = `<h1 class="titel">ZIEL</h1><table class="rang"><tr><th></th><th>Fahrer</th><th>Zeit</th><th>Beste Runde</th></tr>${zeilen}</table>${bz}${cz}${knoepfe}<button class="credits-knopf zurueck">MENÜ</button>`;
    const nx = this.menue.querySelector('.naechstes');
    if (nx) nx.addEventListener('click', () => { this.baueMenue(); this.onNaechstes && this.onNaechstes(); });
    else this.menue.querySelector('.start').addEventListener('click', () => { this.baueMenue(); this.onStart && this.onStart(this.einst); });
    this.menue.querySelector('.zurueck').addEventListener('click', () => { this.baueMenue(); this.setzeStrecke(this.strecke, false); this.onStrecke && this.onStrecke(this.strecke.id, { nurMenue: true }); this.zeigeMenue(true); });
    this.zeigeMenue(true);
  }
}
