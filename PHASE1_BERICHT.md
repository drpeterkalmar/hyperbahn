# Hyperbahn – Bericht Phase 1

Stand 20.10.2026 · live: https://drpeterkalmar.github.io/hyperbahn/ · Bilder: `docs/bilder/`

Phase 1 ist fertig: Schwebe-Physik mit Magnethaftung, eine Strecke („Neon-Megastadt“, ~2:40 je Runde) mit Looping,
Korkenzieher-Röhre, Wandfahrt, langer Überkopf-Passage, Möbius-Twist, Tunnel, Steilkurven und zwei Riesensprüngen,
Neon-Noir-Look, 7 KI-Gegner, HUD mit 3D-Minikarte, Musik und Klänge, Zeitlupe/Bullet-Time. Grundlage war der Vorbau von
rog17 (Branch `vorbau/hyperbahn-p1-grundspiel`, nur Node-geprüft, nie gerendert); dieser Job hat ihn übernommen, zum ersten
Mal im Browser abgenommen, am Bild abgestimmt und den Rest gebaut. Der Vorbau-Branch ist gelöscht, die Übergabe-Notiz
`VORBAU_hyperbahn-p1-grundspiel.md` bleibt als Nachschlagewerk im Repo.

## Was dieser Job gebaut bzw. geändert hat

| Thema | Ergebnis |
|---|---|
| Browser-Abnahme Vorbau | lief auf Anhieb ohne Konsolenfehler; gefunden und behoben: Magnet-Hinweis blinkte dauernd (CSS-Animation überschrieb `opacity: 0`), Menü-Titel im Querformat abgeschnitten, Pause-Taste 34 px, Fenster der Hochhäuser zu klotzig („Minecraft“), Lichtspur als breite helle Fläche über dem halben Bild, Boost-Pad-Ketten überstrahlten weiß, Bewegungsunschärfe verschmierte Sprünge, Spieler stand auf der Pole |
| Gleiter | 4 Modelle von Sketchfab (CC BY 4.0, Lizenz aus der API), in Blender headless ausgerichtet/skaliert, Texturen 512 px WebP (`assets_src/blender/gleiter_backen.py`). Teamfarbe per Farbton-Maske (Lack-Farbton → Teamfarbe, Akzente bleiben) + Neon-Rand (Fresnel) in Teamfarbe, Unterboden-Glühen, Düsenflamme mit Verlauf weiß → Teamfarbe (länger bei Boost), zwei schlanke Lichtspuren. Rückfall auf den alten Keil, falls ein GLB nicht lädt. Bild: `docs/bilder/gleiter_galerie.jpg` |
| 3D-Minikarte | ganze Strecke als Neon-Band mit echten Höhen (×2,4) und Höhen-Loten, Band liegt entlang der echten Quer-Richtung (Looping/Röhre/Wand sichtbar), Sprung-Lücken offen, Magnet-Abschnitte pulsieren violett-cyan, Pads gelb, Start/Ziel weiß, Gegner als Punkte in Teamfarbe, Führender mit weißem Ring, eigener Gleiter als gelber Pfeil. Mitdrehend (Standard) oder Norden oben, 3D/2D/Aus, Tippen = groß/klein, `?karte=`, `?kartenord=1`. Geometrie einmal gebaut, Render-Target 20 Hz, im Endbild-Durchgang des Kino-Looks eingeblendet |
| Neon-Flares | anamorphe Linsen-Streifen (waagrechte Bloom-Streifen, bläulich) als neue Kino-Look-Stufe, `?streak=` |
| Action-Momente | Effekte kamen bisher nicht im Bild an (Regie lieferte Sättigung/Vignette/Aberration/Radial-Blur, der Kino-Look kannte sie nicht) → eingebaut; Bullet-Time-Halbkreis nah am Gleiter (7,5 m) statt in Panorama-Distanz, ohne Bewegungsunschärfe (Zeit steht, nur die Kamera fährt) |
| Musik | CC0-Synthwave „Cyber Runner“ (ansimuz, OpenGameArt), −16 LUFS, nur im Rennen, Zeitlupe senkt die Tonhöhe, im Menü still |
| Pause | WEITER oder NEU STARTEN (vorher startete Pause → Menü immer neu) |
| Credits | Menü → „Credits“ (Pflicht bei CC BY), `LICENSES.md` |
| Startplatz | Spieler startet auf Platz 6 von 8 (`?startplatz=`), Überholen ab der ersten Kurve |
| Messwerkzeuge | GPU-Zeit je Bild (`?gpu=1`, EXT_disjoint_timer_query_webgl2), Zähler über alle Durchgänge eines Bildes, `tools/action_mess.mjs`, `tests/test_eingabe_zeitlupe.py`, `tests/probe.py`, `__hb.galerie()`, Bildfolgen Bullet-Time/Speed-Ramp/Zoom-Punch in `tests/p1_shots.py` |
| GLSL | `smoothstep(a, b, x)` mit a > b ist laut Spezifikation undefiniert (auf Metal ging es, auf Android-GPUs nicht sicher) → überall umgedreht geschrieben |

## Prüfungen

**Node (`npm run test:node`): 74/74 grün** (71 aus dem Vorbau + 3 Minikarte). Darin: Schwebe-Physik deterministisch und ohne
NaN, Looping hält bei 25 m/s und bei 800 km/h echt (kein Durchrutschen, Unterschritte 1/240 s), kopfüber mit Magnet bei
4 und 10 m/s haftend, ohne Magnet Abflug, Röhre/Wand/Überkopf/Twist bei 40 m/s, Pads stapeln + Deckel, Sprünge mit/ohne
Pad-Kette, Barrel-Roll, Wand, Luftbremsen, Fahrhilfe nimmt die Kontrolle nicht weg, Zeit-Logik (Zeitlupe nur offline,
online nur Schein), KI-Gate.

**KI-Gate (8 Gleiter × 10 Runden, `node tools/ki_rennen.mjs 10`, 5 s Rechenzeit): 0 Abflüge, alle Sprünge gelandet**
(20–21 Landungen je Gleiter bei 2 Riesensprüngen je Runde), alle Magnet-Abschnitte ohne Abflug.

| Profil | beste Runde | Runden-Spanne | Wandtreffer (10 Runden) |
|---|---|---|---|
| Profi | 161,5 s | 162–167 s | 1–2 |
| Mittel | 163,3–163,6 s | 163–169 s | 4–11 |
| Leicht | 167,5–168,1 s | 167–173 s | 45–56 |

**Riesensprünge** (Node, Physik seit dem Vorbau unverändert, `test_gleiter.mjs`):

| Sprung | Absprung mit Pad-Kette | Airtime | Weite | ohne Pads | Airtime | Weite | Mindesttempo an der Kante |
|---|---|---|---|---|---|---|---|
| Häuserschlucht (400 m Lücke) | 139,9 m/s | 5,30 s | 543 m | 91,6 m/s | 4,65 s | 398 m | 73,1 m/s (77 % vmax) |
| Neon-Schlucht/Hafen (410 m Lücke) | 145,2 m/s | 5,61 s | 579 m | 92,3 m/s | 4,91 s | 422 m | 69,4 m/s (73 % vmax) |

**Fahrgefühl nach dem Clean-Room-Datenblatt** (`node tools/gefuehl_mess.mjs --rennen 7`, heute neu gemessen, gleiche Werte
wie im Vorbau):

| # Messgröße | MK64-Referenz (Datenblatt) | Hyperbahn-Ziel | gemessen |
|---|---|---|---|
| 1 Zeit 0→50/90/100 % (leicht) | 1,2–1,7 / 3,2–4,1 / 3,8–5,4 s | 0,9–1,2 / 2,5–3,0 / 4,0–4,5 s | 1,00 / 2,58 / 4,14 s |
| 1 … (mittel) | dto. | dto. | 1,14 / 3,04 / 4,45 s |
| 1 … (schwer) | dto. | dto. | 1,23 / 2,82 / 4,24 s |
| 2 Kurvenform (schwer überholt mittel bei) | schwer mittig zäh | Kreuzung 60–80 % | 82 % (knapp drüber) |
| 3 Mini-Turbo-Gewinn je Kurve | ≈ 0,15 s (unsicher) | St. 2: 0,25–0,4 s · St. 3: 0,4–0,6 s | 0,40 s · 0,52 s |
| 4 Drift-Quote Profi (Stufe ≥ 2) | Stufe 2 nach ≥ 0,43 s Pumpen | ≥ 80 % der Kurven | 100 % (4/4) |
| 5 Abkürzen übers Störfeld | Abzug fällt mit Boost weg | ≥ 0,3 s langsamer | 2,37 s langsamer |
| 6 Start-Boost-Quote | Fenster 0,13 s | 30–50 % bei Testern | **offen** – braucht echte Spieler am Handy; KI 15/40/70 % je Profil |
| 7 Zeitverlust je Treffer (Mensch) | ≈ 0,8–1,0 s; gerettet ≈ 0 | 0,8–1,2 s; ≤ 0,2 s; Neustart −0,3 s | 0,80 s; 0,03 s; −0,22 s |
| 8 KI-/Mensch-Verlust | KI ≫ Mensch | 1,5–2× | 1,75× |
| 9 Feld mit Gummiband | Führender ≤ 3–8 s vor dem Menschen | P1-Abstand ≤ 4 s; P1–P8 6–15 s; ≥ 2 Wechsel | 2,2 s; 7,5 s; 9 Wechsel |
| 10 Gummiband aus | – | ≥ 2× stärker gestreut | 2,78× |
| 11 Item-Verteilung (10 000 je Platz) | Tabelle | ±1 PP | max. 1,02 PP |
| 12 Stoß-Verhältnis leicht/schwer | ≈ 10,7× | ≈ 7,6× | 7,6× |
| 13 Sichtfeld-Kick bei Boost | +8° in ≈ 0,27 s | +12° in ≤ 0,3 s | +12° in 0,29 s, zurück 0,45 s |
| 14 Kamera-Nachlauf beim Boost-Start | 40 %/15 % je Tick | 3–6 % der Folgedistanz | 3,9 % (0,37 m) |

**Action-Momente – Häufigkeit** (`node tools/action_mess.mjs 5`, 5 Rennen à 3 Runden ≈ 8,5 min, Spieler mittel auf Platz 6):

| Stufe | Momente je Rennen | je Minute | kleinster Abstand | Arten |
|---|---|---|---|---|
| Selten (Standard) | 3,6 (3–4) | 0,42 | 25,9 s | 15× Sprung-Scheitel (Bullet-Time), 2× Überholen, 1× Beinahe |
| Oft | 13,8 (12–18) | 1,62 | 8,4 s (Abkühlzeit ≥ 8 s hält) | 43× Magnet-Höchsttempo, 15× Sprung-Scheitel, 8× Beinahe, 3× Überholen |

Bei „Oft“ kamen vorher 57 von 83 Momenten aus den Magnet-Abschnitten → Gewicht 0,65 → 0,58.

**Browser** (ein Browser, `--mute-audio`, WebGL über die GPU/Metal):
- `tests/smoke.py`: Boot 0,6–2,6 s (lokal), Rennen läuft, 0 Fehler. Alle Touch-Tasten ≥ 48 px (Menü scrollt im Querformat).
- `tests/p1_shots.py`: Start, Pulk, Looping, Korkenzieher-Röhre, Überkopf, Wandfahrt, Twist, Boost, Sprung 1 + 2,
  Blitze reduziert – je hoch + quer, 0 Fehler; Bildfolgen mit je 14 Bildern für Bullet-Time, Speed-Ramp, Zoom-Punch.
- `tests/test_eingabe_zeitlupe.py`: **OK** – während der Bullet-Time (Zeitfaktor 0,04) kommt die Lenk-Eingabe an; sie wirkt
  wie gewollt in Sim-Zeit (gleiche Antwort je Physik-Schritt wie ohne Zeitlupe, also fair), danach Zeitfaktor wieder 1.
- **Live-Prüfung** gegen https://drpeterkalmar.github.io/hyperbahn/ (Build `6ca41467d0` = lokal), hoch + quer: Boot,
  Rennen, alle 8 Gleiter-Modelle geladen, Minikarte an, Service-Worker aktiv, 0 Fehler.
- Pause → WEITER: Rennzeit steht während der Pause, läuft danach weiter; Musik stoppt im Menü und kommt mit WEITER zurück.

**Bild-Selbstprüfung** (ich habe die Screenshots selbst angesehen – ein eigenes `vision_analyze`-Werkzeug gab es in diesem
Lauf nicht; Wertung ehrlich, 10 = wie ein aktuelles Konsolen-Neon-Racing):

| Bild | Wertung | Kommentar |
|---|---|---|
| Rennen geradeaus/Pulk (`pulk_quer`) | 8/10 | nasse Fahrbahn mit Neon-Spiegelungen, Lauflicht-Kanten, Regen, Gleiter mit Neon-Rand klar lesbar; Fenster der Stadt noch etwas gleichförmig |
| Looping/Überkopf/Twist/Wand | 7–8/10 | Horizont dreht mit, Stadt hängt „über“ einem; bei Looping im Hochformat ist die untere Bildhälfte leer (Kamera innen im Looping) |
| Boost-Kette | 7/10 | nach zwei Runden Dämpfung lesbar, Gleiter sichtbar; die Chevrons verschwimmen bei 800 km/h zu Blöcken |
| Riesensprung | 8/10 | Ringe, Neon-Schilder, starke Speed-Lines; Panorama-Kamera eher eng |
| Bullet-Time-Folge (`docs/bilder/bullet_time_folge.jpg`) | 8/10 | Weißblitz → Halbkreis um den Gleiter über der Häuserschlucht → zurück; als Bullet-Time klar erkennbar |
| Speed-Ramp / Zoom-Punch | 6/10 | in Standbildern kaum sichtbar (Zoom-Punch dauert 0,35 s, headless kommen nur ~4 Bilder/s); im Spiel spürbar über FOV-Zoom und Ton |
| Gleiter-Galerie | 8/10 | vier unterschiedliche Silhouetten, Teamfarben deutlich |
| Minikarte | 8/10 | Strecke, Lücken, Magnet-Puls, Pfeil und Punkte lesbar, dezent |

Gesamteindruck: wirkt wie ein modernes Neon-Racing-Spiel, nicht wie ein Flash-Game – mit den Grenzen eines Browser-Spiels
(keine echten Spiegelungen, keine Schatten, Stadt aus instanzierten Quadern mit Fenster-Shader).

## Mess-Gate „Mittelklasse-Android“

Profil: CPU ×4 gedrosselt, DPR 2,6, 412×915 hoch / 915×412 quer, Mobil-UA, je Szene 10 s, Bildrate ungedeckelt.
Gemessen auf dem Mac mini (M-GPU über ANGLE/Metal) – **kein echtes Handy**. Die GPU-Zeit ist die eigentliche Aussage.
Rohdaten: `tests/perf/2026-10-20_p1_hoch.json`, `…_p1_quer.json`.

| Szene | Gerät | p50 ms | p95 ms | GPU p50 / p95 ms | Draw-Calls (max) | Dreiecke |
|---|---|---|---|---|---|---|
| Menü | hoch | 3,5 | 4,7 | 5,1 / 5,6 | 33 | 472 k |
| Start (Standard) | hoch | 5,1 | 6,0 | 3,4 / 3,6 | 82 (89) | 515 k |
| Start (Kino) | hoch | 6,3 | 9,2 | 18,1 / 22,2 | 84 (91) | 515 k |
| Pulk | hoch | 5,1 | 6,1 | 3,4 / 3,7 | 76 (85) | 503 k |
| Looping | hoch | 5,0 | 5,9 | 3,5 / 3,8 | 76 (85) | 506 k |
| Röhre | hoch | 5,1 | 6,2 | 3,4 / 4,2 | 75 (85) | 505 k |
| Sprung (Standard) | hoch | 5,0 | 6,2 | 3,3 / 3,6 | 68 (82) | 477 k |
| Sprung (Einfach) | hoch | 4,2 | 5,2 | 2,3 / 2,7 | 59 (73) | 477 k |
| Menü | quer | 4,0 | 5,8 | 6,3 / 6,8 | 34 | 472 k |
| Start (Standard) | quer | 5,3 | 6,3 | 3,8 / 4,3 | 82 (89) | 516 k |
| Start (Kino) | quer | 6,7 | 11,0 | 19,4 / 24,5 | 85 (91) | 516 k |
| Pulk | quer | 5,2 | 6,2 | 3,8 / 4,3 | 77 (85) | 506 k |
| Looping | quer | 5,2 | 6,2 | 3,9 / 4,7 | 78 (86) | 507 k |
| Röhre | quer | 5,0 | 6,2 | 3,8 / 6,4 | 76 (85) | 506 k |
| Sprung (Standard) | quer | 5,0 | 6,1 | 3,5 / 3,8 | 69 (83) | 473 k |
| Sprung (Einfach) | quer | 4,3 | 5,3 | 2,2 / 2,6 | 60 (74) | 473 k |

- **Minikarte:** zuerst als eigener Durchgang auf den Bildschirm gezeichnet → +2,5 ms GPU (Kachel-GPU lädt das ganze Bild
  neu). Jetzt im Endbild-Durchgang des Kino-Looks: A/B Pulk quer mit/ohne Karte 3,81 / 3,85 ms → **Mehrkosten nicht
  messbar (< 0,1 ms, Ziel < 0,4 ms erfüllt)**.
- **Ladegröße:** Spielcode + three.js 0,39 MB gzip (39 Dateien, keine externen Anfragen) + Gleiter-Modelle 0,78 MB gzip vor
  dem ersten Rennen + Musik 0,96 MB beim Rennstart. Service-Worker legt alles für offline ab (Version = Inhalts-Hash).
- **Einordnung Handy:** Standard braucht auf der M-GPU 3,4–3,9 ms; eine Mittelklasse-Android-GPU ist grob 4–6× langsamer →
  geschätzt 14–23 ms, also 45–60 fps. Das ist eine Schätzung, keine Messung. Die Kino-Stufe (18–19 ms auf dem Mac) ist für
  Handys zu teuer und bleibt Desktop-Option; die Qualitäts-Automatik (`kino.adapt`) senkt ohne `?look=` die Renderskala.
- Dreiecke ~0,5 Mio. (fast alles Stadt, instanziert) – nach der Lehre „Polygone kosten am Handy wenig, Füllrate viel“ kein
  Engpass, aber der erste Hebel, falls ein echtes Handy ruckelt.

## Grenzen und offene Punkte (ehrlich)

- **Kein echtes Handy gemessen**, Bildrate ≥ 30 fps am Handy ist geschätzt, nicht belegt. Bitte einmal am eigenen Handy
  `…/hyperbahn/?gpu=1` fahren; `__hb.gpu.mittel('szene')` in der Konsole wäre die echte Zahl.
- **Start-Boost-Quote (#6)** braucht Tester am Handy.
- **Kurvenform (#2)** 82 % statt ≤ 80 % – Bandwerte sind eigene Startwerte (Datenblatt unsicher).
- **Zoom-Punch/Speed-Ramp** sind in Standbildern schwach; ob sie sich im Spiel gut anfühlen, sieht man nur live.
- **Neon-Flares** sind Linsen-Streifen im Bloom, keine einzelnen Flare-Sprites an Lichtquellen.
- **Haptik iPhone:** Ereignis-Vibration geht in Safari seit iOS 26.5 nicht mehr (nur Android, wenige große Ereignisse).
- Pfeil der Minikarte und Lichter der Gleiter sind am Handy bei Sonnenlicht vermutlich schwach – nicht prüfbar ohne Gerät.
- Looping im Hochformat: untere Bildhälfte leer (Kamera im Looping). Kandidat für eine eigene Hochformat-Kamera.

## Recht

Nur Mechaniken und Zahlen aus dem Clean-Room-Datenblatt; keine Namen, Assets oder Code aus WipEout, Mario Kart oder dem
Decomp. Gleiter-Modelle bewusst ohne Nachbauten bekannter Fahrzeuge (WipEout-, F-Zero-, Star-Wars-, Hot-Wheels-Modelle
aussortiert). Teams/Schriftzüge sind Fantasienamen. Lizenzen: `LICENSES.md`, im Spiel „Credits“.

## Für Phase 2 vorbereitet

Ereignis-Bus `actionMoment(art, stärke, pos)` mit Arten `explosion`/`treffer`, Treffer-Schnittstelle `g.treffer()`
(Schlingern, Abfangen, Dreher, Neustart-Rhythmus), Item-Tabelle nach Platz mit Ziehung (`src/game/items.js`, `?items=`),
Zeit-Logik mit Sim- und Präsentations-Uhr (Phase 4 Online muss nichts umbauen).
