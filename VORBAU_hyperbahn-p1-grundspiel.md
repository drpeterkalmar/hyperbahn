# Vorbau (Leicht-Spur) für `hyperbahn-p1-grundspiel` – Übergabe an den Heavy-Job

Stand 10.10.2026, rog17 (Windows, ohne Browser/GPU). Branch `vorbau/hyperbahn-p1-grundspiel` (Basis `mac/main` a79a1e3),
alles committet und nach `mac` gepusht, `main` unberührt. **Kein einziger Browser-Lauf** – alles hier ist mit Node-Tests
(`node --test`) und reiner Mathematik geprüft; das Bild, die Shader, das HUD und die Bildrate hat noch niemand gesehen.

**Schnellstart für den Heavy-Job**
1. Vorher-Messung auf `main` (dort liegt nur README – die Messung ist praktisch „leer“; Brief verlangt sie trotzdem).
2. `git merge vorbau/hyperbahn-p1-grundspiel` (bzw. auf dem Branch weiterarbeiten), `npm run test:node` → **71/71 grün** (~20 s parallel;
   einzeln je Datei < 15 s, `test_gefuehl.mjs` ~15 s, `test_ki_gate.mjs` ~13 s).
3. Rauchtest im Browser: `python3 tests/smoke.py`, dann Abnahme-Bilder `python3 tests/p1_shots.py` (hoch + quer),
   Mess-Gate `python3 tests/perf_gate.py --szenen tests/perf_szenen.json --stand nachher`.
4. Vor dem Live-Gang: `python3 tools/update_sw.py` (ohne Argument → Inhalts-Hash statt Platzhalter „vorbau“).

Nützliche URL-Haken (alle in `src/main.js`): `?autostart=1` (Menü überspringen), `?at=<Abschnittsname|Meter>` (Feld fliegend
dort aufstellen, z. B. `?at=Gro%C3%9Fer%20Looping`), `?autopilot=1` (Spieler fährt per KI), `?look=0|1|2`, `?nosw`.
Konsole: `__hb.setze('Fassade', 60)`, `__hb.moment('sprungScheitel')` (Action-Moment erzwingen), `__hb.spieler`, `__hb.rennen`,
`__hb.fps`, `__hb.kino.describe()`; `window.__app = { ready, frames }` wie in der Stuntbahn (für `tests/util.py`).

---

## Etappe 0 – Gerüst
**Fertig:** `index.html` (Importmap three lokal, SW nur unter https, `?nosw`), `manifest.webmanifest` (`orientation: any`),
`css/style.css`, `lib/` (three.module/core.min.js + GLTFLoader + BufferGeometryUtils, MIT), `src/gfx/kinolook.js` + `kern/taau*.js`
unverändert aus der Stuntbahn (+ neue Farbkorrektur `neonnoir`), `KINOLOOK.md` (Port-Notiz der Stuntbahn), `sw.js` aus
`tools/sw.template.js` (Cache `hyperbahn-…`, Version **„vorbau“**), `src/build.js`, Icons (`tools/make_icons.py`, reines Python),
`package.json` (`npm run test:node`), `.gitattributes` (LF), `README.md` (Steuerung, Regler), `LICENSES.md`.
**Geprüft:** `test_module.mjs` (alle Module laden in Node mit three über `tests/node/three_haken.mjs`; alle Importnamen von
`main.js` existieren; Manifest/Icons vorhanden).
**Heavy-Job:** Boot ohne Konsolenfehler, Icons ansehen (143 KB bei 512 px – ggf. verkleinern), `update_sw.py` laufen lassen
(auf Windows schrieb es `\`-Pfade/CRLF; im Vorbau von Hand auf `/`/LF gebracht – auf dem Mac kein Thema).

## Etappe 1 – Strecken-Datenmodell + Spline-Generator + Strecke 1
**Fertig:** `src/track/bahn.js` – Abschnitte drehen den Bahn-Rahmen mit Fensterfunktion um eine im Rahmen feste Achse (Looping
schließt exakt, Krümmung/Torsion stetig, keine Knicke), Querneigung als eigenes stetiges Feld (Steilkurve, Wand 90°, Überkopf
180°, Twist, Korkenzieher 360° inkl. Umlauf-Fortschreibung), Restfehler wird über die Runde verteilt. `abfrage(p, hint)` =
Schwebe-Raycast entlang der lokalen Normale (s, u, h, Rahmen). `src/track/strecke1.js` – „Neon-Megastadt“, **15,75 km**,
Grundriss Rechteck gegen den Uhrzeigersinn, Start auf 160 m Höhe:
Start-Ziel · Hochbahn-S · Anlauf + **Großer Looping** (760 m, Magnet, 34° Rahmen-Rolle → Ausgang ~70 m versetzt) ·
**Korkenzieher-Röhre** (520 m, 360°, Magnet) · Pad-Kette + **Sprung 1 Häuserschlucht** (400 m Lücke, Ringe) + Landezone ·
**Steilkurve Turm** (50°) · **Wandfahrt Fassade** (90°, Magnet) · **Überkopf „Unter der Brücke“** (1100 m, ≥ 550 m kopfüber,
Magnet) · Neon-Bogen · **Möbius-Twist** (180° und zurück, Magnet) · **Tunnel** · Aufstieg/Hochstraße/Kuppe · Pad-Kette +
**Sprung 2 Neon-Schlucht** (410 m Lücke, 3 Ringe) + Landezone · Hafenkurve · Schikane · Ostgerade (Pads) · **Große Steilkurve** (45°).
Schließ-Parameter per `tools/strecke_schliessen.mjs` (Nelder-Mead), Grundriss-Tabelle `tools/strecke_plan.mjs`.
**Geprüft:** `test_bahn.mjs` (8): geschlossen (< 1 m/0,1°), orthonormal, Radius ≥ 45 m, Krümmungs-/Querneigungssprung klein,
alle Pflicht-Passagen, steile/kopfüber Fläche nur in Magnet-Abschnitten, keine Selbstdurchdringung, Abfrage findet (s,u,h) zurück.
**Heavy-Job:** Bild der Strecke (Looping, Röhre, Wand, Überkopf, Twist) – stimmen Proportionen/Kamera? Rundenzeit ist ~2:40
(Ziel 2–3 min ✓). Bahnhöhen 25–300 m. Nach Änderungen an Abschnitten **immer** `node tools/strecke_schliessen.mjs` und
`SCHLUSS` übernehmen, sonst schlägt `test_bahn.mjs` an.

## Etappe 2 – Schwebe-Physik inkl. Magnethaftung, Boost, Riesensprünge
**Fertig:** `src/physics/gleiter.js` – Starrkörper, 4 progressive Schwebe-Federn (ω 18 rad/s) entlang der Bahn-Normale,
fester Schritt 1/240 s. Magnet: −Normale × 1,8 g ersetzt die Schwerkraft (Rampe 0,3 s, Reichweite 9 m). Luft: g × 0,55,
Nase heben/senken, Wetterfahne, leichtes Lenken, **Barrel-Roll = Turbo** (Flanke), Landung in Rolle = Patzer. Boost-Pads
stapelbar (+50 % je Pad, 1,3 s + 0,3 s Abklingen, Deckel +80 %), Ringe (+35 %), **Wand = Funken-Ereignis + Tempoverlust +
Schild-Abzug**, Absturz-Erkennung + Respawn (nach Sprung hinter der Lücke). Alle Werte in `src/config.js` mit Regler:
`?speed ?mag ?boost ?air/?sprung ?slowmo`. Anzeige-Tempo = m/s × 3,6 × 1,9 (95 m/s ≈ 650 km/h, Boost bis ~1000 km/h).
**Messwerte (Node):** Looping hält bei 25 m/s (Höhe 1,34–1,37 m) und bei **222 m/s = 800 km/h echt** (0,61–1,37 m, kein
Durchrutschen). Kopfüber hält mit Magnet bei 10 m/s und 4 m/s, ohne Magnet fällt er ab. Pad-Kette (4): Spitze 150 m/s.
| Sprung | Absprung mit Kette | Flug | Weite | ohne Pads | Flug | Weite | Mindesttempo an der Kante |
|---|---|---|---|---|---|---|---|
| Häuserschlucht | 139,9 m/s | 5,30 s | 543 m | 91,6 m/s | 4,65 s | 398 m | 73,1 m/s (77 % vmax) |
| Neon-Schlucht | 145,2 m/s | 5,61 s | 579 m | 92,3 m/s | 4,91 s | 422 m | 69,4 m/s (73 % vmax) |
(Mindesttempo mit Vollgas in der Luft; Boost-Ringe zählen mit. Tabelle `SPRUNG_MINDEST` in strecke1.js speist „SPEED OK“.)
**Geprüft:** `test_gleiter.mjs` (11): deterministisch/ohne NaN, Magnet kopfüber, ohne Magnet Abflug, Magnet-Rampe, Looping
25 m/s + 800 km/h, Röhre/Wand/Überkopf/Twist bei 40 m/s, Pads stapeln + Deckel, Sprünge mit/ohne Kette, Barrel-Roll, Wand, Luftbremsen.
**Heavy-Job:** Gefühl am Bildschirm (Federweg bei Landung, Rollen in der Röhre, Kamera kopfüber), `?mag`/`?air` A/B.
**Risiko:** Lande-Bonus (+10 %, Fahrgefühl-Nachtrag) macht Landezonen etwas schneller; Flugzeiten 4,7–5,6 s liegen im Ziel 4–6 s.

## Etappe 3 – KI-Fahrer (7 Gegner) + Rennen
**Fertig:** `src/ai/pilot.js` (Ideallinie per Relaxation durch die Pad-Ketten, Tempoplan aus Krümmung, Pure Pursuit,
Luftbremsen, Barrel-Roll, Profile Leicht/Mittel/Profi mit Fehlern, Drift mit Pump-Rhythmus, Start-Tipp, Gummiband-Modus),
`src/game/rennen.js` (Startaufstellung, Countdown, Rundenzähler über gefahrene Bogenlänge, Rangliste, Ziel, gewichtete Stöße,
Start-Boost), `src/ai/gummiband.js`. Teams mit Fantasienamen (Vanta, Kyrie, …).
**KI-Gate (`test_ki_gate.mjs`):** 8 Gleiter × 10 Runden, **0 Abflüge, alle Sprünge gelandet** (20–21 Landungen je Gleiter),
Bestzeiten Profi 161,5 s / Mittel 163,3–163,6 s / Leicht 167,5–168,1 s, Rechenzeit ~12 s. Leicht-KI touchiert öfter die Wand (45–56×).
`tools/ki_rennen.mjs [runden]` für eigene Läufe. `test_rennen.mjs` (4): Startaufstellung/Countdown, Runden/Ziel, Rückwärts zählt nicht, Stöße.
**Heavy-Job:** Zweikampf-Bilder (Pulk am Start mit `?at=Start-Ziel`), sieht das Feld „rennt“ aus? Stoß-Optik.

## Etappe 4 – Zeit-Logik, Action-Momente, Fahrhilfe
**Fertig:** `src/core/zeit.js` – zwei Uhren (Sim fest + Präsentation), `zeitFaktor` ≠ 1 nur offline, online Schein-Zeitlupe;
Absprung-Akzent 0,3 s (`?slowmo=0`); Action-Regie (Speed-Ramp 1→0,1→1,5→1 ≤ 1,2 s, Zoom-Punch, Bullet-Time ≤ 0,05× mit
Halbkreis-Orbit ≤ 1,5 s; Abkühlzeit ≥ 8 s, Selten/Oft, nie bei `gefahr`), Bus `actionMoment(art, stärke, pos)` (P2-Arten
`explosion`/`treffer` vorgesehen), `BlitzBremse` (≤ 3 Blitze/s, Strobos gedämpft). `src/game/momente.js` – Auslöser
(Sprung-Scheitel, Überholen, Beinahe, Ring-Kette, Ziel P1, Magnet-Höchsttempo, Gefahr-Erkennung). `src/game/fahrhilfe.js` –
Leicht (Auto-Gas + Lenkzug 0,6), Mittel (0,3), Profi; deutliche Eingabe → aus in 0,25 s, zurück in 1,2 s.
**Geprüft:** `test_zeit.mjs` (9), `test_fahrhilfe_momente.mjs` (6) – u. a. Eingaben wirken in der Zeitlupe identisch je Sim-Schritt.
**Heavy-Job:** Bildfolgen ≥ 12 Frames je Moment + Vision (≥ 8/10), Häufigkeit je Rennen messen (`__hb.regie().statistik`),
Eingabe-Test während Zeitlupe im Browser, Fotosensitivität mit `?blitze=0` ansehen.

## Etappe 5 – Fahrgefühl nach dem Clean-Room-Datenblatt (Nachtrag 10.10. 13:10)
**Fertig:** `src/physics/fahrgefuehl.js` + Einbau in Physik/Rennen/KI/Kamera:
- 3 Gewichtsklassen mit **eigenen** Tempo-Band-Werten (Menü „Gleiter-Klasse“, `?klasse=`), Stoßgewicht 0,8/1,1/2,2, Lenk-Faktor
  (Sweet-Spot ab 90 %), Kurven-Abzug 1 %/° (Drift 0,4 %/°), Boost = Gas voll + Kurven-Abzug aus.
- **Drift + Mini-Turbo:** Luftbremse innen halten = Rutschen (Haftung 0,45, Bremswiderstand ×0,2), Pumpen hebt Stufe (0,30 s,
  dann je 0,15 s), > 1,7 s = Stufe weg, Loslassen ab Stufe 2 = +18 %/+25 % für 0,6 s, Halbwertszeit 1,0 s. Hüpfer 0,6 m,
  **nie in Magnet-Zonen** (Haftung bleibt). Funken cyan → magenta → weiß-gold.
- **Start-Boost** (Fenster ±0,125 s um Grün, Touch: Finger auf den Schirm), Überdrehen > 1,5 s Dauergas → 0,8 s Stotterer.
- **Störfeld** am Rand (2,8 m, −30 % × Klasse, mit Boost halb) + Warnstreifen-Mesh; Landebonus +10 % (statt Lande-Malus).
- **Treffer-Schnittstelle** `g.treffer()` (Schlingern 0,9 s, Abfangen = beide Luftbremsen, sonst Dreher 1,2 s; Mensch −24 %,
  KI −60 %), **Neustart-Rhythmus** (5 Gas-Tipper im 0,03–0,13-s-Takt → 2 s Beschleunigung ×Klasse; auch nach Abflug).
- **Gummiband** gegen den besten Menschen (Führender bremst ab 2,5 → 5 s Vorsprung, 2 Rivalen 0–2,5 s vor ihm, Nachzügler
  > 3 s „schnell“; nie über das Profil hinaus, nur gegen Menschen).
- **Kamera:** Sichtfeld 62°, +12° Boost, +18° Sprung von der Kette, +10° Treffer, 40°/s hoch / 24°/s zurück, Nachlauf.
- **Items (Phase 2):** `src/game/items.js` – Tabelle `hb` (Standard) und `ref`, Ziehung nur nach Platz, deterministisch.
- Regler: `?beschl ?gewicht ?kurve ?lenk ?drift ?mtzeit ?hupf ?startfenster ?rand ?landebonus ?treffer ?neustart ?stoss
  ?gummiband=0|1|2 ?fov ?fovboost ?items=hb|ref` (alles andere als `hb` gilt als Referenz-Tabelle).
**Messtabelle** (`node tools/gefuehl_mess.mjs --rennen 7`, Rechenzeit 58 s; `test_gefuehl.mjs` (12) prüft die Ziele):

| # Messgröße | Referenz (Datenblatt) | Hyperbahn-Ziel | gemessen (Node) |
|---|---|---|---|
| 1 Zeit 0→50/90/100 % (leicht) | 1,2–1,7 / 3,2–4,1 / 3,8–5,4 s (Sollwert) | 0,9–1,2 / 2,5–3,0 / 4,0–4,5 s | 1,00 / 2,58 / 4,14 s |
| 1 … (mittel) | dto. | dto. | 1,14 / 3,04 / 4,45 s |
| 1 … (schwer) | dto. | dto. | 1,23 / 2,82 / 4,24 s |
| 2 Kurvenform (schwer überholt mittel bei) | schwer mittig zäh | Kreuzung 60–80 % | **82 %** (knapp drüber) |
| 3 Mini-Turbo-Gewinn je Kurve | ≈ 0,15 s (unsicher) | St. 2: 0,25–0,4 s · St. 3: 0,4–0,6 s | 0,40 s · 0,52 s |
| 4 Drift-Quote Profi (Stufe ≥ 2) | Stufe 2 nach ≥ 0,43 s Pumpen | ≥ 80 % der Kurven | 4/4 (100 %), Runde 161,6 s |
| 5 Abkürzen übers Störfeld | Abzug fällt mit Boost weg | ≥ 0,3 s langsamer | 2,37 s langsamer |
| 6 Start-Boost-Quote | Fenster 0,13 s | 30–50 % bei Testern am Handy | **offen (Browser/Tester)**; KI 15/40/70 % je Profil |
| 7 Zeitverlust je Treffer (Mensch) | ≈ 0,8–1,0 s; gerettet ≈ 0 | 0,8–1,2 s; ≤ 0,2 s; Neustart −0,3 s | 0,80 s; 0,03 s; Neustart **−0,22 s** |
| 8 KI-/Mensch-Verlust | KI ≫ Mensch | 1,5–2× | 1,75× |
| 9 Feld mit Gummiband (7 Rennen à 2 Runden) | Führender ≤ 3–8 s vor dem Menschen | P1-Abstand ≤ 4 s; P1–P8 6–15 s; ≥ 2 Wechsel | 2,2 s; 7,5 s; 9 Wechsel |
| 10 Gummiband aus | – | ≥ 2× stärker gestreut | 2,78× (20,9 s) |
| 11 Item-Verteilung (10 000 je Platz) | Tabelle | ±1 PP | max. 1,02 PP (Zufallsstreuung, 1σ ≈ 0,5 PP) |
| 12 Stoß-Verhältnis leicht/schwer | ≈ 10,7× | ≈ 7,6× | 7,6× |
| 13 Sichtfeld-Kick bei Boost | +8° in ≈ 0,27 s | +12° in ≤ 0,3 s, zurück 0,5 s | +12° in 0,29 s, zurück 0,45 s (Kamera-Mathe) |
| 14 Kamera-Nachlauf beim Boost-Start | 40 %/15 % je Tick | 3–6 % der Folgedistanz, ≤ 0,4 s | 3,9 % (0,37 m), sofort da; bleibt, solange beschleunigt wird |

**Heavy-Job im Browser:** #6 (Start-Boost-Quote mit Testern/Telemetrie), #13/#14 mit `camera.fov`-Log im echten Bild,
Drift-Funken/Meldungen ansehen, Drift am Handy (Luftbremsen-Tasten pumpen – reicht die Touch-Bedienung?).
**Annahmen/Risiken:** Band-Werte sind eigene Startwerte (Kreuzung 82 % statt ≤ 80 %); Kurven-Abzug nimmt 12° für vollen
Lenkausschlag an; Gummiband-Nachzügler-Regel ist eine Ergänzung (Datenblatt nennt Soll-Abstände je Platz, ohne sichere
Zuordnung) – sie war nötig für #10 ≥ 2×. Treffer gibt es in P1 nur als Schnittstelle (keine Waffen). Recht: keine Namen/Assets
der Referenz im Repo (geprüft per Suche); Datenblatt liegt nur in Peters Plan-Ordner.

## Etappe 6 – Grafik/Look-Gerüst (Startwerte, Abstimmung am Bild = Heavy-Job)
**Fertig (alles nur Code, nie gerendert):**
- `src/gfx/bahn_geo.js` (rein) + `bahnmesh.js`: nasse Fahrbahn (MeshStandard + Pfützen-Rauheit + Spurlinien), Deck,
  Glas-Begrenzung, Lauflicht-/Strobo-Kanten (über `BlitzBremse.strobo`), pulsierende Magnet-Streifen, gläserne Röhren +
  Lichtringe, Boost-Pads mit laufenden Chevrons, Boost-Ringe, Anflug-Lichter der Landezonen, Stützen, Start/Ziel, Störfeld-
  Streifen. ~144 000 Dreiecke. Alle Farben in `LOOK` (bahnmesh.js).
- `src/gfx/stadt_plan.js` (rein) + `stadt.js` (Unteragent): Türme instanziert mit Fenster-Shader, Neon-Schilder (Canvas-Text,
  Fantasie-Schriftzüge KYROTEK, NEONOVA, VOLTARA …), Häuserschlucht, Fassaden-Turm an der Wandfahrt, Brücke über der
  Überkopf-Passage, Fluss + Hafen. Werte in `STADT`/`LOOK_STADT`.
- `src/gfx/gleitermesh.js`: 4 fiktive Bauformen (Pfeil, Klinge, Hammer, Stachel), Teamfarbe, Emissive-Streifen, Düsenflamme
  (Boost länger), Lichtspur, Neigung beim Lenken, Dreher-Drehung.
- `src/gfx/himmel.js` (Nachthimmel-Kuppel + Neon-PMREM-Umgebung), `funken.js`, `regen.js` (ein Draw-Call), Kino-Look
  `grade: 'neonnoir'`, Bloom-/Farbblitze über `kino.render({ flash, white })`.
- `src/gfx/kamera.js`: Bahn-Normale gedämpft, „Horizont halten“, Panorama im Sprung, Bullet-Time-Orbit, Shake, FOV.
- `src/ui/hud.js` + `css/style.css`: Tempo/Platz/Runde/Schild/Boost/Magnet/„SPEED OK“/Countdown/Meldungen, Menü mit allen
  Optionen (localStorage), Touch-Tasten (Bremse L/R, Rolle), hoch + quer per Media-Queries. `src/game/eingabe.js`.
- `src/audio/ton.js`: WebAudio-Synthese (Antrieb, Boost, Wand, Magnet, Ereignis-Töne), `audioSession 'ambient'`, Menü still.
- `src/main.js`: Verdrahtung, Ereignis-Effekte, Vibration nur bei großen Ereignissen (≥ 30 ms, Abstand 1,5 s), einfache
  Qualitäts-Automatik (`kino.adapt(fps)` jede Sekunde).
**Geprüft:** `test_bahn_geo.mjs` (5: Teile, Wicklung nach außen auch kopfüber, keine Fahrbahn über Lücken, Instanzen, three-Meshes
bauen in Node), `test_stadt.mjs` (8), `test_kamera.mjs` (3), `test_module.mjs` (4, inkl. Gleiter-Modelle aller Bauformen).
**Heavy-Job – konkret abnehmen:**
1. Boot + Rennen ohne Fehler (`tests/smoke.py`), Menü hoch/quer, Touch-Tasten ≥ 48 px (`small_buttons`).
2. Shader kompilieren (eigene ShaderMaterials in bahnmesh/himmel/regen/gleitermesh; Fahrbahn-`onBeforeCompile` ersetzt
   `#include <roughnessmap_fragment>`/`<emissivemap_fragment>` – bei three-Version prüfen).
3. Look am Bild: Bloom-Stärke/Schwelle (Kino-Look ist 8 bit → Emissive-Faktoren 2,5–5 als Startwerte), `neonnoir`-Grade,
   Nebel `FogExp2 0.00075`, Regen-Dichte, Spiegelungen auf der nassen Fahrbahn (nur Environment, keine SSR), Stadt-Dichte.
4. Bewegungsunschärfe: `speed: tempo × 0,4` an den Kino-Look (der ist auf 80–190 km/h geeicht) – am Bild nachziehen.
5. Mess-Gate Mittelklasse-Android (`tests/perf_gate.py`, Szenen in `tests/perf_szenen.json`): Draw-Calls (Bahn ~12 Meshes,
   Stadt wenige Instanzen, 8 Gleiter à 6 Meshes + Lichtspur ≈ 56 Calls – Teile je Material zusammengefasst), Dreiecke, p50/p95,
   Ladegröße. Shader-Bausteine, die `onBeforeCompile` ersetzt, sind gegen three r186 geprüft (Namen vorhanden).
6. Screenshots `tests/p1_shots.py` (Start, Pulk, Looping, Röhre, Überkopf, Wandfahrt, Twist, Boost, Sprung 1/2, Blitze
   reduziert, Bullet-Time-Folge) → Vision „modernes Neon-Racing, nicht Flash-Game“.
**Nicht angefangen (bewusst):** Sketchfab-Gleiter (Token liegt im Mac-Schlüsselbund, aus SSH nicht nutzbar), CC0-Synthwave-Loop
(Lizenz muss aus der Quelle belegt werden – `Ton.musik(url)` ist Platzhalter), Lens-Flares als eigene Stufe (Kino-Look hat
`flare` für die Sonne; Neon-Flares fehlen), Grafik-Autopilot aus der Stuntbahn (`kern/autopilot.js`) – erst mit Mess-Gate sinnvoll.

## Was der Heavy-Job sonst noch wissen muss
- **Versionsnummer/Cache-Busting/SW:** nicht angefasst außer Gerüst (`VERSION = 'vorbau'`).
- **Unteragent:** Stadt (`stadt_plan.js`, `stadt.js`, `test_stadt.mjs`) stammt von einem Unteragenten, der vor Regen/Ton/Icons
  abbrach; diese drei habe ich selbst geschrieben. `stadt.js` baut in Node ohne Fehler, ist aber wie alles andere ungesehen.
- **Bekannte Grenzen:** Gleiter-Gleiter-Stöße sind weiche Ellipsoide (keine Explosionen in P1). KI fährt außerhalb der Sicht
  nicht vereinfacht (8 Gleiter kosten ~5 µs je Schritt und Gleiter in Node – am Handy messen). Anzeige-Tempo-Faktor 1,9 ist
  ein Gefühlswert (`ANZEIGE.faktor` in config.js, noch ohne Regler).
- **Bericht:** Messtabellen oben (Sprünge, KI-Gate, Fahrgefühl) können direkt in `PHASE1_BERICHT.md` übernommen werden;
  nach Änderungen an Physik/Strecke neu messen mit `tools/gefuehl_mess.mjs`, `tools/ki_rennen.mjs 10`, `test_gleiter.mjs`.
