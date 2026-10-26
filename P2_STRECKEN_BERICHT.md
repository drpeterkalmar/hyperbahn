# Hyperbahn – Bericht P2: Abwechslungsreiche Strecken

Stand 26.10.2026 · live: https://drpeterkalmar.github.io/hyperbahn/ (Version **0.1.14**) · Wunsch Peter 20.10.:
„abwechslungsreichere strecken, kürzere rennen (max 5min)“.

Vier neue Strecken, jede mit eigenem Umfeld **und** eigenem Fahr-Charakter, dazu Streckenwahl im Menü, „Zufällig“ und ein
Cup über alle fünf. Jede Strecke kam als eigener Release (Commit, Push, Live-Prüfung im Browser, Zwischenmeldung):

| Version | Inhalt |
|---|---|
| 0.1.10 | Streckenwahl-Menü (Karten mit 3D-Vorschau, Zufällig, 🔗 Teilen-Link, Wechsel ohne Neuladen) + **Wüsten-Raumhafen** |
| 0.1.11 | **Riff-Röhre** (Gabelung mit KI-Wegen) |
| 0.1.12 | **Gewitter-Pass** (Grat-Abkürzung, Kamm ohne Bande, Blitze mit Blitz-Bremse) |
| 0.1.13 | **Orbital-Ring** (Trommel-Wandfahrt, schwache Schwerkraft, Schwerelos-Sprung) + **Cup** |
| 0.1.14 | Abschluss: Bericht, Messprotokolle, Bilder, Orbit ohne Sonnen-Schleier |

Die Megastadt ist unverändert spielbar (Kurz/Lang, alle Bestzeiten bleiben gültig – gleicher Bestzeit-Schlüssel; KI-Plan
der Megastadt bitgleich, alle bisherigen Tests unverändert grün).

## Die Strecken

| Strecke | Charakter | Länge | Signatur-Passagen | Riesensprung |
|---|---|---|---|---|
| Neon-Megastadt (Bezug) | Allrounder | 13,3 km | Looping, Korkenzieher-Röhre, Wandfahrt, Überkopf, Twist | Häuserschlucht + Neon-Schlucht (400/410 m) |
| **Wüsten-Raumhafen** | Vollgas | 9,5 km | lange Startbahn mit Boost-Ketten, weite schnelle Bögen (Radius ≥ 318 m), Kuppen-Hüpfer vor dem Silo, Hangar-Tunnel, Dünenwellen | Raketensilo: 500 m Lücke, 5–8 s Flug, bis ≈ 900 m weit |
| **Riff-Röhre** | Technik | 9,1 km | Korkenzieher, Doppel-Korkenzieher, Röhren-Schlange, 520 m Magnet-Überkopf-Röhre, **Gabelung** | Riffgraben (400 m) |
| **Gewitter-Pass** | Sprünge | 8,8 km | zwei Serpentinen-Haarnadeln (170°, 40–50° Steilkurve), **Grat-Abkürzung**, Kamm ohne Bande, Schikane, viele Höhenmeter | Scharte (220 m) + Talsprung (400 m) |
| **Orbital-Ring** | Show | 9,7 km | Möbius-Band (eine ganze, langsame Drehung), Wandfahrt in der Trommel (Schrauben-Windung an der Innenwand, 90°), Ring-Looping, Mondkuppe (schwache Schwerkraft) | Schwerelos-Sprung: 520 m Lücke, 30 % Schwerkraft, 6 Boost-Ringe, 7–8 s Flug |

**Gabelungen/Abkürzungen** (Pflicht: auf mind. 2 Strecken): Riff-Röhre (Gabelung auf dem Riffplateau: innen schmal, ohne
Bande, mit Pads – wer über die Kante fährt, stürzt ins Riff; außen breit und sicher; gemessen ≈ 2 s je Runde schneller für
die Profi-KI) und Gewitter-Pass (Grat-Abkürzung in der zweiten Haarnadel: innen schmal ohne Bande, ≈ 1–1,3 s schneller).
Die KI wählt je nach Stärke den schnellen (Profi meist) oder sicheren Weg (Leicht meist); die Fahrhilfe zieht immer zum Weg,
auf dem der Spieler gerade ist. Mitten-Wand mit oranger Lauflicht-Kante und spitzer Nase.

**Kulissen** (alles prozedural aus Grundkörpern + Shadern, Instancing, keine Fremd-Assets, Lizenz: eigene Arbeit):
- Wüste: Dämmerung mit tiefer Sonne (Linsenblendung), Dünen-Gelände, Tafelberge, Rakete im Silo neben der Flugbahn, Startturm,
  Hangar, Radarschüsseln, Pistenlichter, Sandsturm-Teilchen; Farbkorrektur „wueste“.
- Riff: Wasseroberfläche von unten mit wandernden Lichtflecken, türkiser Nebel, Lichtstrahlen, Korallen (Kugeln/Röhren/Fächer,
  leicht leuchtend), wogender Seetang, 12 Fischschwärme (840 Fische, Bewegung im Vertex-Shader, ein Draw-Call), Luftblasen,
  Graben unter dem Sprung.
- Gebirge: zerklüftetes Gelände mit Schneegipfeln und Nadelwald, Täler unter den Sprüngen und am Kamm, Pass-Stangen mit
  Warnlichtern, Funkmasten, Regen mit Wind, Blitze (Himmel + Licht + Blitzstrahl).
- Orbit: Sterne, die Erde unendlich weit im Himmels-Shader (Kontinente, Wolken, Tag/Nacht, Stadtlichter, Atmosphären-Saum),
  Stationsring mit Speichen und Solarflügeln, gläserne Trommel mit Leuchtringen, blaue Tore an den Schwerkraft-Grenzen,
  Sternenstaub; keine Stützen unter der Bahn.

## Messtabelle je Strecke (alles gemessen)

KI-Gate: 8 Gleiter × 10 Runden (`node tools/strecke_pruefen.mjs <id> 10`, Protokolle `docs/mess/p2_pruefung_*.txt`);
Rennen: `node tools/rundenzeit_mess.mjs 6 alle` (`docs/mess/p2_rundenzeit.txt`), inkl. Countdown, Median je KI-Profil;
Sprünge: `node tools/luft_mess.mjs <id>` (`docs/mess/p2_luft_*.txt`); Leistung: Mess-Gate (siehe unten).

| Strecke | Runde KI Mittel (Ziel 1:15–1:40) | Runden | Rennen Mittel / Leicht / Letzter (≤ 5:00) | Abflüge (8 × 10 R.) | Sprünge gelandet | Wand je Gleiter-min (Megastadt 0,36) | p95 ms hoch / quer | GPU p50 ms quer |
|---|---|---|---|---|---|---|---|---|
| Megastadt (Bezug) | 2:15,5 | 2 | 4:38 / 4:47 / 4:48 | 0 | alle (20 je Gleiter) | 0,36 | 6,2–6,9 / 6,4–7,0 | 3,26–3,44 |
| Wüsten-Raumhafen | **1:27,7** | 3 | **4:29** / 4:36 / 4:37 | **0** | alle (≥ 12 je Gleiter*) | **0,09** | 6,6–7,0 / 6,6–7,1 | 3,02–3,21 |
| Riff-Röhre | **1:30,5** | 3 | **4:35** / 4:47 / 4:48 | **0** | alle (≥ 10) | **0,07** | 6,8–7,7 / 6,8–7,3 | 3,17–3,27 |
| Gewitter-Pass | **1:31,6** | 3 | **4:41** / 4:56 / 4:56 | **0** | alle (≥ 20, 2 Sprünge) | **0,16** | 6,5–6,8 / 6,6–8,2 | 3,02–3,23 |
| Orbital-Ring | **1:33,1** | 3 | **4:45** / 4:55 / 4:57 | **0** | alle (≥ 20, Sprung + Mondkuppe) | **0,15** | 6,9–7,0 / 7,2–7,5 | 3,09–3,36 |

\* mehr Landungen als Runden: Kuppen-Hüpfer zählen mit (> 1,5 s Flug).

| Sprung | Lücke | Mindesttempo an der Kante (Tabelle) | Flug mit Pad-Kette (↑ gehalten) | Flug ohne Pads, 95 m/s (↑ gehalten) |
|---|---|---|---|---|
| Raketensilo (Wüste) | 500 m | 63,4 m/s (63) | 8,3 s · 898 m | 6,2 s · 537 m |
| Riffgraben | 400 m | 71,0 m/s (71) | 6,0 s · 718 m | 4,8 s · 431 m |
| Scharte (Gebirge) | 220 m | 54,9 m/s (55) | – (keine Kette) · 3,1 s · 293 m bei 95 m/s | – |
| Talsprung (Gebirge) | 400 m | 70,3 m/s (70) | 6,0 s · 720 m | 4,8 s · 431 m |
| Schwerelos (Orbit) | 520 m | 39,0 m/s (39) | 7,2 s · 847 m | 7,5 s · 676 m |

**„Spieler hält ↑“ (Etappe-0-Profil) auf allen Sprüngen, mit und ohne Pads: 0 Abstürze, 0 Bauchlandungen** (alle 4 Strecken),
dazu je 2 Runden mit KI-Lenker und ↑ dauerhaft: 0 Abflüge, 0 schiefe Landungen. Die Hülle/Landehilfe aus P1b wurde nicht
angefasst.

**Geometrie** (`tests/node/test_strecken.mjs`): Schließfehler ≤ 0,006 m / 0,0000° nach dem Schließen mit
`tools/strecke_schliessen.mjs <id>`, kleinster Radius ≥ 99 m, Querneigung ≤ 2,93° je 2 m (wie Megastadt), keine
Selbstdurchdringung (Orbit: Looping/Trommel ≥ 25 m Rest-Abstand), **jede steile/überkopf Stelle ist Magnet** (0 Verstöße).
Pflicht-Teile je Strecke geprüft: ≥ 2 Pad-Ketten mit ≥ 3 Pads, Riesensprung mit Kette davor, ≥ 2 Ringe in der Luft, breite
Landezone mit Anflug-Lichtern.

## Streckenwahl, Zufällig, Cup, Teilen

- Menü: waagrecht scrollende Karten (hoch + quer), je Karte eine **drehende 3D-Vorschau** (2D-Canvas, die echte Mittellinie
  mit Höhen, Magnet violett, Röhre cyan, Landezone grün, Pads gelb – kein eigener WebGL-Kontext), Name, Charakter, Text,
  Rundenzahl, Bestzeit (★). Tippen wählt und lädt die Strecke ohne Neuladen der Seite; die Megastadt zeigt zusätzlich
  „Kurz · 2 Runden / Lang · 1 Runde“. 🔗 teilt `…/hyperbahn/?strecke=<id>` (Teilen-Dialog bzw. Zwischenablage).
- **🎲 Zufällig**: nie zweimal hintereinander dieselbe (gemerkte letzte Strecke; Test über alle Strecken).
- **🏆 Cup**: Megastadt → Wüste → Riff → Gebirge → Orbit, Punkte 9-7-5-3-2-1-0-0 je Platz (Plan), nach jedem Rennen Tabelle
  mit „+Punkte“ und „NÄCHSTES RENNEN · <Strecke>“, am Ende Cup-Endstand und Sieger, „NEUER CUP“/„MENÜ“. „NEU STARTEN“ im
  Pausenmenü startet nur das aktuelle Cup-Rennen neu. Im Browser durchgespielt (`tests/p2_cup.py`, Zieleinlauf erzwungen):
  5 Rennen, Tabelle korrekt, 0 Fehler.
- URL: `?strecke=megastadt|wueste|riff|gebirge|orbit|lang|kurz|zufall`, `?cup=1`; die Adresszeile zeigt immer die gewählte
  Strecke (Teilen per Kopieren geht auch). Rundenzahl je Strecke aus der gemessenen Rundenzeit (`rundenFuer`, Etappe 0).

## Leistung (Mess-Gate „Mittelklasse-Android“, `?gpu=1`)

`python3 tests/perf_gate.py --szenen tests/perf_szenen_p2.json --stand p2_hoch|p2_quer` – CPU ×4 gedrosselt, DPR 2,6,
412×915 / 915×412, Standard-Stufe, je Szene 10 s; Mac mini über Metal, **kein echtes Handy**. Rohdaten
`tests/perf/2026-10-26_p2_*.json`. Je Strecke Start (Pulk), Signatur-Passage, Riesensprung-Anlauf.

| | Megastadt | Wüste | Riff | Gebirge | Orbit |
|---|---|---|---|---|---|
| GPU p50 ms (hoch / quer) | 3,08–3,18 / 3,26–3,44 | 3,04–3,17 / 3,02–3,21 | 3,23–3,31 / 3,17–3,27 | 2,90–3,10 / 3,02–3,23 | 2,90–3,41 / 3,09–3,36 |
| GPU p95 ms quer | 3,90–3,97 | 3,64–3,87 | 3,85–4,28 | 3,71–3,94 | 3,84–4,06 |
| Bild p95 ms quer (1 Lauf) | 6,4–7,0 | 6,6–7,1 | 6,8–7,3 | 6,6–8,2 | 7,2–7,5 |
| Bild p95 ms quer (3 Läufe, Wiederholung) | Start 6,8 · Sprung 7,4 | – | Start 7,1 | Sprung 7,2 | Start 7,1 |
| Draw-Calls | 57–75 | 65–83 | 68–79 | 57–71 | 46–84 |
| Dreiecke | 0,41–0,42 Mio. | 0,17–0,20 Mio. | 0,43–0,44 Mio. | 0,18–0,20 Mio. | 0,12–0,16 Mio. |

Bewertung: GPU-Zeit (die eigentliche Aussage fürs Handy) je Strecke gleich oder niedriger als in der Megastadt. Die Bild-p95
der Einzelläufe streuten bis +0,8 ms (Riff-Sprung hoch 7,7, Gebirge-Sprung quer 8,2); in der Wiederholung mit 3 Läufen lagen
sie bei 7,1–7,2 ms gegen 6,8–7,4 ms Megastadt – also im Messrauschen (P1b: ±1 ms). **Ladegröße:** die neuen Strecken werden
erst bei Wahl geladen – je Strecke Daten + Kulisse **5,2–5,9 KB gzip** (Megastadt-Kulisse 22 KB), gemeinsam einmalig 8,9 KB
(Register, Kulissen-Bausteine, Vorschau, Teilchen). Erstes Laden bis „bereit“: 1,23 MB gzip (Gleiter-Modelle, three.js,
Spiel), 0 externe Anfragen.

## Browser-Prüfung und Bild-Selbstprüfung

- `tests/p2_strecken.py --hoch` (ein Browser, `--mute-audio`, WebGL über Metal): Menü hoch + quer, alle 5 Strecken je 4–6
  Bilder (Start, Signatur-Passage(n), Riesensprung im Flug mit Panorama-Kamera, Zielkurve) – **0 Fehler**, 0 Abflüge.
  `tests/smoke.py`: 0 Fehler. `tests/p2_cup.py`: 0 Fehler. Live nach jedem Release geprüft (Version, Strecke per URL,
  Rennen läuft, Service-Worker aktiv, 0 Fehler).
- Ein `vision_analyze` gibt es auf diesem Rechner nicht – ich habe jede Bildfolge selbst angesehen und nachgebessert:

| Strecke | eigenes Thema erkennbar? | Wertung | nachgebessert |
|---|---|---|---|
| Wüste (`docs/bilder/p2_wueste_folge.jpg`) | ja: orange Dämmerung, Sonne, Tafelberge, Hangar-Tunnel in Bernstein | 8/10 | Rakete vor die Flugbahn gesetzt (war im Flug nicht im Bild) |
| Riff (`p2_riff_folge.jpg`) | ja: türkis, Lichtstrahlen, Glasröhren, Korallen | 7/10 | zu hell und milchig → dunkler, dichter Nebel; Blasen waren zu große Streifen; Korallen schwebten (Höhe ohne Gelände-Deckel) → echte Bodenhöhe |
| Gebirge (`p2_gebirge_folge.jpg`) | ja: Nacht, Bergkämme, Regen, Steilkurven | 7/10 | Pass-Stangen/Lichter waren zu klobig |
| Orbit (`p2_orbit_folge.jpg`) | ja: Sterne, Erde unter dem Schwerelos-Sprung, Trommel-Wendel | 9/10 (Sprung), 7/10 (Start) | Sonnen-Schleier über dem halben Bild → kein Sonnenhof im All, keine Linsenblendung |
| Menü (`p2_menue.jpg`, `p2_menue_hoch.jpg`) | Karten klar, Vorschauen unterscheidbar | 8/10 | Teilen-Knopf verdeckte die Vorschau → unten rechts |

Wirkt es abwechslungsreich? Ja – fünf deutlich verschiedene Farbwelten (Neon-Nacht, Orange-Dämmerung, Türkis unter Wasser,
Blau-Grau-Gewitter, Schwarz-Weltall) und fünf verschiedene Fahrweisen (Vollgas-Geraden, Röhren-Technik, Haarnadeln mit
Sprüngen, Show-Elemente mit schwacher Schwerkraft). Hochformat-Übersicht: `docs/bilder/p2_hochformat.jpg`.

## Technik (für die nächsten Phasen)

- **Strecken-Register** `src/track/strecken.js` (Name, Charakter, Farbe, gemessene Rundenzeit, Lade-Funktionen),
  `src/track/alle.js` für Node-Werkzeuge. Strecken-Daten `src/track/strecke_<id>.js` (wie Strecke 1 über `baueBahn`, je mit
  `SCHLUSS`, `SCHLUSS_SCHRITT`, `schlussOk`, `START`, `SPRUNG_MINDEST`), Kulissen `src/gfx/kulisse_<id>.js` mit `THEMA`
  (Himmel, Nebel, Licht, Farbkorrektur, Dunst, Umgebung, Bahn-Look) + `baueKulisse()`. Strecke wechseln = alte Teile
  entsorgen, neu bauen (`wechsleStrecke` in `main.js`).
- **Physik:** nach einem Absprung großzügigere Abflug-Grenze (s. Grenzen), Auftrieb × Schwerkraft-Faktor (nur Orbit).
- **Neue Bahn-Eigenschaften** (`bahn.js`, Physik in `gleiter.js`): `offen: 'l'|'r'|true` (keine Bande – über die Kante = Abflug
  „kante“), `teiler: { u, b, an, schnell }` (Gabelungs-Wand mit Spitze, Physik wie Bande), `schwere` (Faktor auf die
  Schwerkraft am Boden und in der Luft, auch in der Wurfparabel der Nasen-Hülle). Flags jetzt 16 bit.
- **KI** (nur für die neuen Strecken über `bahn.padsWeich`, Megastadt-Plan bitgleich): Pads abseits der Linie nicht erzwingen,
  zwei feinere Glättungs-Durchgänge (ein Sägezahn der Linie gaukelte Kurven vor), Kantenabstand `planRand` 5 m
  (Wandtreffer 0,45 → 0,09/min), Landezone vorn mittig, Gabelungs-Wege (`bauePlaene`, `wegFuer`), in engen Kurven vor
  Sprüngen Kurventempo statt Vollgas.
- `himmel.js` mit Uniforms je Thema (Sonne, Sterne, Wasser, Blitz, Erde), `regen.js` für Sand/Blasen/Staub/Regen,
  `kulisse_kern.js` (Gelände unter der Bahn gedeckelt, Streuen, Instanzen, Leuchtpunkte), Farbkorrekturen `wueste`, `riff`,
  `gewitter`, `orbit` im Kino-Look.
- Werkzeuge: `tools/strecke_pruefen.mjs <id>` (Geometrie, Mindesttempo, KI-Gate, Wand-Rate), `tools/strecke_schliessen.mjs
  <id>`, `tools/ki_rennen.mjs 10 <id>`, `tools/luft_mess.mjs <id>`, `tools/rundenzeit_mess.mjs 6 alle`.

## Prüfungen

- Node: `npm run test:node` – **139/139 grün** (vorher 116; neu `test_strecken.mjs` mit Register/Zufällig, je Strecke
  Geometrie, Pflicht-Teile, Mindesttempo, ↑-Profil, KI-Gate 8 × 10 Runden mit Rundenzeit-, Rennlängen- und Wandraten-Gate,
  und Blitze bei „Blitze reduzieren“: ≤ 1 Puls/s, Helligkeit ≤ 0,5; `test_module` prüft alle Register-Einträge).
- Vor jedem Push lief die Suite nach dem Rebase unter der Push-Sperre (`claude_job.py zusammenfuehren`).

## Handy-Testhinweise für Peter

1. **Menü:** Karten nach links/rechts wischen, eine Strecke antippen – die Vorschau dreht sich, unten steht Name und
   Rundenzahl. 🔗 schickt den Link (z. B. an dich selbst) – der Link öffnet genau diese Strecke.
2. **Wüste:** auf der Startbahn alle Pads mitnehmen, vor dem Silo Mitte halten → der Flug dauert 7–8 s; links fliegt man an der
   Rakete vorbei. Ohne Pads (seitlich vorbei) reicht es trotzdem (≈ 540 m).
3. **Riff:** vor der Gabelung links halten = schmaler, schneller Weg mit Pads, aber ohne Bande; rechts = sicher.
4. **Gebirge:** in der zweiten Haarnadel innen = Abkürzung ohne Bande; auf dem Kamm gibt es keine Bande. Mit „⚡ Blitze
   reduzieren“ prüfen, ob die Blitze angenehm gedämpft sind.
5. **Orbit:** in der Trommel einfach Gas geben (Magnet hält), im Schwerelos-Abschnitt durch die Ringe gleiten; G-Vignette im
   Looping/in der Trommel.
6. **Cup:** „🏆 Cup“ → „CUP STARTEN“: fünf Rennen à ≤ 5 min, nach jedem Rennen die Punkte.
7. Bitte einmal `…/hyperbahn/?gpu=1&strecke=riff` fahren – das Riff hat die meisten Dreiecke (Korallen/Seetang).

## Grenzen / offen

- Leistung nur auf dem Mac (gedrosselt) gemessen, nicht auf einem echten Android-Handy.
- Nase 5 s lang hochziehen (↓, Absicht des Spielers): Megastadt, Wüste, Riff und Gebirge landen (teils „hart“, Wüste nach
  13 s und 1,3 km). Dafür ist die Abflug-Grenze nach einem Absprung großzügiger (90 m seitlich, 160 m hoch, 16 s Flug) und in
  schwacher Schwerkraft wirkt auch der Auftrieb schwächer. Im **Orbit** segelt man so weiterhin über die Landezone hinaus und
  wird geborgen („weg“) – das ↑-Profil und neutrales Fliegen sind überall sauber.
- Lange Flüge kosten Tempo (Luftwiderstand der Physik): nach 8 s Flug landet man mit ≈ 80 m/s, der Flug-Boost Stufe 3 holt
  es zurück.
- Gebirge und Orbit liegen für die KI „Leicht“ bei 4:56/4:57 – knapp unter 5:00.
- Die Strecken sind handgebaut; der Strecken-Generator mit Seed und drei Cups aus Phase 3 sind noch offen (Register, Bausteine
  und Prüf-Werkzeuge sind dafür vorbereitet). Online-Cup-Wertung (Phase 4) nicht gebaut.
- Gabelung im Riff ist im Bild eher schmal sichtbar (orange Kante der Mitten-Wand); eine Hinweistafel vor der Gabelung wäre
  eine nächste Verbesserung.

## Dateien

Neu: `src/track/strecken.js`, `alle.js`, `runden.js`, `strecke_wueste.js`, `strecke_riff.js`, `strecke_gebirge.js`,
`strecke_orbit.js`; `src/gfx/kulisse_kern.js`, `kulisse_megastadt.js`, `kulisse_wueste.js`, `kulisse_riff.js`,
`kulisse_gebirge.js`, `kulisse_orbit.js`; `src/ui/vorschau.js`; `tools/strecke_pruefen.mjs`; `tests/node/test_strecken.mjs`,
`tests/p2_strecken.py`, `tests/p2_cup.py`, `tests/perf_szenen_p2.json`. Geändert: `bahn.js`, `gleiter.js`, `pilot.js`,
`fahrhilfe.js`, `bahn_geo.js`, `bahnmesh.js`, `himmel.js`, `regen.js`, `kinolook.js` (Farbkorrekturen), `hud.js`, `main.js`,
`style.css`, Werkzeuge (`ki_rennen`, `luft_mess`, `rundenzeit_mess`, `strecke_schliessen`). Messprotokolle `docs/mess/p2_*`,
Bilder `docs/bilder/p2_*`.
