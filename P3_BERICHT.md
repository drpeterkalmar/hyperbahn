# Hyperbahn – Bericht P3: Tempo, Boost, Windschatten (Etappe 1) · Ruckeln und Start (Etappe 2)

Stand 26.10.2026 · Auftrag `hyperbahn-p3-tempo-boost` · Etappe 1 = 0.1.18 (live), Etappe 2 = 0.1.19 · Peter: „Mehr Boost und Windschatten-Ansaugen, sonst wird's
langweilig, weil immer alle genau gleich schnell dahingleiten. Das mit der Energie ist doof.“ – Nachtrag: „Hyperbahn soll von
Natur aus etwas schneller werden und schärfere Kurven haben. Ich verwende die Airbrakes nie.“

## Etappe 1 – schneller, schärfere Kurven, mehr Boost, Windschatten, Energie weg

### Was sich geändert hat (jede Maßnahme mit Regler zum Vergleich)

| Thema | vorher (0.1.17) | jetzt | Regler |
|---|---|---|---|
| Energie | ein Balken = Schild + Boost, Boxengasse, Notlauf, Rolle kostet 10 % | **aus**: kein Balken/Boost-Knopf/Boxengasse/Notlauf; Rolle frei, 1× je Sprung, Turbo bei der Landung | `?energie=1` |
| Grundtempo | 95 m/s (≈ 650 km/h Anzeige) | **105 m/s** (≈ 720 km/h), Beschleunigung mitskaliert (gleiche Zeit bis Höchsttempo) | `?tempo=alt`, `?speed=` |
| Lenkung | Querbeschl. 44 m/s², Haftung 5,5, Gier-Aufbau 3,5 rad/s² | 60 m/s², 7, 4,5 rad/s² – direkter | `?tempo=alt` |
| Magnet | 1,8 g | 2,2 g (+22 % Fliehkraft bei +10 % Tempo) | `?mag=` |
| Kurven | engste Bögen R 229–679 m (außer Haarnadel/Trommel) | 2–3 Stellen je Strecke enger (R 157–204 m), gleiche Ein-/Ausfahrt-Linien – der Rest der Strecke bleibt an seinem Platz | `?kurven=alt` |
| Auto-Gas (Touch, Leicht) | immer Vollgas | nimmt vor engen Kurven selbst Gas weg (Tempoplan wie die KI), nie Luftbremse; Profi bleibt Vollgas | `?autogas=0` |
| Luftbremsen am Handy | zwei Knöpfe unten links/rechts | **weg**; ROLLE-Taste unten mittig (neutrale Zone), Lenkhälften frei; Q/E und LB/RB bleiben | `?airbrake=1` |
| Pads | 16 / 15 / 12 / 14 / 14 | **25 / 27 / 16 / 20 / 26** (Megastadt / Wüste / Riff / Gebirge / Orbit), Zusatz-Pads abseits der Linie | `?pads=0` |
| Pad-Kette | +50/60/70/80 % | +50 → +65 % (Deckel +65 % = ≈ 173 m/s, wie bisher 95 × 1,8 – die Sprünge sind darauf gebaut) | `?reserve=` |
| Boost-Ring | +35 % | +45 % | – |
| Windschatten | – | Sog in ~1 s bis +15 % Höchsttempo, nach 1,5 s Ausscheren = Schleuder-Boost (+25 %, 0,9 s); Schlieren, HUD, Ton | `?sog=0`, `?sog=0.1` |
| KI | alle KIs einer Stärke identisch (Tempo-Faktor 0,93 auf Geraden wirkungslos → alle 95 m/s) | Handschrift je KI: Höchsttempo −5…+2 %, Kurventempo ±6 %, Linie/Fehler, Form-Welle (25–55 s), Windschatten-Lust, Risiko-Pads | `?streuung=0`, `?kitop=` `?kikurve=` `?form=` |
| Gummiband | „schnell“ = Tempo-Faktor 1 für alle Nachzügler | „schnell“ = eigenes Profil +4 % (Handschrift bleibt) | `?gummiband=` |

**Wie die engeren Kurven gebaut sind:** `bahn.js schaerfe()` ersetzt einen Bogen durch Gerade + engeren Bogen + Gerade, wobei
die Geraden genau so lang sind, dass Ein- und Ausfahrt-Tangente gleich bleiben (numerisch über das Krümmungsfenster). Dadurch
blieben die Schließfehler aller Strecken unter 1 cm **ohne** neue Schließ-Parameter – Kulissen, Sprünge und die Stadt stehen
unverändert. Querneigung ×1,1, ihr Auf-/Abbau reicht in die Geraden hinein (sonst kippte die kurze Kurve so schnell, dass ein
Gleiter außerhalb der Mitte abhob). Neue enge Stellen: Megastadt Hafenkurve + Schikane, Wüste Wüstenbogen + Wüsten-S, Riff
Riffbogen + Tiefseekurve, Gebirge Passkurve + Schikane, Orbit Andockbogen + Ringkurve.

**Risiko-Pads** (`bahn.js zusatzPads`): Zweier-Ketten bzw. einzelne Pads auf ruhigen Stücken (keine Magnet-/Röhren-/Sprung-/
Landezone-/Gabelungs-Abschnitte in 40 m davor bis 400 m danach, kein enger Bogen, keine Kuppe, ≥ 2,2 km vor jedem Absprung –
sonst trug die volle Reserve die KI über die Landezone), im Wechsel links außen / rechts außen / Mitte. Die KI-Linie erzwingt
sie nicht; jede KI entscheidet je Pad nach Handschrift (Profi öfter, Leicht seltener, nie mitten im Boost).

### Messung vorher/nachher (alles gemessen, Node, kein Browser)

**Feld** – `node tools/feld_mess.mjs alle 6` (Rennen wie im Spiel: 7 KI „Mittel“ mit Klassen leicht/mittel/schwer, DU auf
Startplatz 6 als Mensch gewertet, Rundenzahl je Strecke, 6 Läufe je Strecke). Positionswechsel = Überholungen (ein Paar tauscht
die Reihenfolge und liegt danach ≥ 10 m vorn), ab 8 s nach Grün. Tempo in km/h wie im HUD. Rohdaten
`docs/mess/p3_feld_vorher.*` (Stand 0.1.17) und `docs/mess/p3_feld_nachher.*`.

| Strecke | Positionswechsel je Runde vorher → nachher | Tempo-SD Feld km/h | Δ Tempo zum Nachbarn km/h | Abstand 1.–8. Ø s | Boost-Anteil | Windschatten-Anteil | Abflüge (6 Rennen) | Wand je Gleiter-min | Rennen Letzter |
|---|---|---|---|---|---|---|---|---|---|
| Megastadt | 11,9 → **28,8** (2,4×) | 58,7 → 65,7 | 35,9 → 37,2 | 4,1 → 4,7 | 25 → 29 % | 0 → 34 % | 0 → 0 | 1,19 → 0,73 | 4:42 → 4:25 |
| Wüste | 12,6 → **32,7** (2,6×) | 62,5 → 79,7 | 38,7 → 56,3 | 4,1 → 4,2 | 32 → 44 % | 0 → 26 % | 0 → 0 | 0,96 → 0,84 | 4:35 → 4:17 |
| Riff | 12,4 → **21,2** (1,7×) | 98,9* → 63,5 | 37,1 → 40,9 | 32,3* → 4,3 | 32 → 36 % | 0 → 33 % | 2 → **0** | 1,04 → 0,70 | 4:41 → 4:24 |
| Gebirge | 20,8 → **22,2** (1,1×) | 66,1 → 81,5 | 48,7 → 45,9 | 4,2 → 5,4 | 37 → 46 % | 0 → 26 % | 0 → 0 | 1,25 → 0,56 | 4:44 → 4:35 |
| Orbit | 8,7 → **21,1** (2,4×) | 65,9 → 73,5 | 35,1 → 42,6 | 4,2 → 4,1 | 31 → 36 % | 0 → 30 % | 0 → 0 | 0,92 → 0,87 | 4:50 → 4:33 |
| **Schnitt** | **13,3 → 25,2 (1,9×)** | 70,4 → 72,8 | 39,1 → 44,6 | | 31 → 38 % | 0 → 30 % | **2 → 0** | 1,07 → 0,74 | alle ≤ 5:00 |

\* vorher Riff mit zwei Abflügen (Bergung) – die verzerren Streuung und Abstand.

Bewertung gegen das Ziel: **Positionswechsel ≥ 2× vorher** erreicht auf Megastadt, Wüste und Orbit, knapp verfehlt im Riff
(1,7×) und **nicht erreicht im Gebirge (1,1×)** – dort gab es schon vorher die meisten Wechsel (Haarnadeln, viele Rempler,
Wandtreffer 1,25/min), und Windschatten/Überholen nutzt die KI nur, wo der Tempoplan Vollgas erlaubt (in Haarnadeln, Röhren und
Magnet-Passagen hob ein Spurwechsel bei 105 m/s den Gleiter ab). Im Schnitt 1,9×. **Tempo-Streuung**: Feld-SD +3 % und
Tempo-Unterschied zum Nachbarn +14 % – „sichtbar größer“ vor allem auf Wüste/Orbit/Gebirge; auf der Megastadt kaum (dort
bestimmt die Strecke das Tempo). Abflüge 2 → 0, Wandtreffer seltener, alle Rennen kürzer (≤ 4:35).

**Kurven ohne Luftbremse** – `node tools/kurven_mess.mjs` (`docs/mess/p3_kurven_vorher.txt` / `_nachher.txt`): kleinster Radius
bei Vollgas mit voll eingeschlagener Lenkung, und je Strecke eine Runde „Spieler ohne Luftbremse“ (Ideallinie, Luftbremse nie).

| | vorher (0.1.17) | nachher |
|---|---|---|
| kleinster Radius bei Höchsttempo (Vollgas, voll eingeschlagen) | 141 m bei 82 m/s (vmax 95) | **129 m bei 91 m/s** (vmax 105) |
| Kurven geschafft, Vollgas immer (Touch bis 0.1.17) | 31/36 | 27/37 (neue enge Kurven verlangen Gas weg) |
| Kurven geschafft, **Handy mit Auto-Gas (Leicht/Mittel)** | 31/36 (Auto-Gas = Vollgas) | **37/37** (Auto-Gas nimmt Gas weg) |
| Kurven geschafft, Gas weg vor Kurven (Tastatur), nie Luftbremse | – | 37/37 |

Damit ist jede Kurve auf Leicht/Mittel ohne Luftbremse fahrbar; die schweren (Serpentine 1, Andockbogen, Trommel, Passkurve,
Riffbogen) verlangen Gas wegnehmen – am Handy macht das die Fahrhilfe.

**KI-Gate** (`npm run test:node`, 8 Gleiter × 10 Runden je Strecke): 0 Abflüge auf allen 5 Strecken, alle Sprünge gelandet,
Wandtreffer 0,13–0,41 je Gleiter-Minute (Gate ≤ 0,36 für die P2-Strecken eingehalten). Zusätzlich je Strecke mit `?sog=0` und
`?streuung=0` geprüft: 0 Abflüge. Neue Rundenzeiten (KI Mittel): Megastadt 2:11 (Lang 2:29), Wüste 1:24, Riff 1:27, Gebirge
1:30, Orbit 1:29 – Rundenzahl unverändert (2/1/3/3/3/3), Rennen ≤ 4:41 auch für den Letzten.

Was dabei gefunden und behoben wurde (Rennen-Spuren der KI ausgewertet):
- Zusatz-Pads kurz vor Sprüngen → volle Reserve über die Landezone hinaus bzw. Abheben an der Kuppe vor dem Silo: keine
  Zusatz-Pads ≤ 2,2 km vor einem Absprung, Ketten-Deckel +65 %.
- Schleuder-Boost bzw. Sog in Korkenzieher/Wandfahrt → abgehoben: Sog wirkt nicht in Magnet-Passagen, Schleuder nur, wenn die
  nächsten 400 m keine Magnet-/Röhren-/Sprung-Passage kommt; KI-Handschrift über Grundtempo nicht in Magnet-Passagen.
- Fassade → Brückenanlauf (Wandfahrt → Überkopf) hob bei 105 m/s ab: Magnet 2,2 g.
- KI wich in Röhren seitlich aus → Abheben im Korkenzieher: dort kein Spurwechsel mehr.
- Eine KI blieb an der Bande hängen und fuhr rückwärts weiter: KI setzt sich nach 2,5 s unter 20 m/s selbst zurück.
- Kurze, steile Querneigung der engen Kurven ließ Gleiter abheben: Querneigung in die Geraden hinein verlängert.

### Browser und Bilder (ein Browser, stumm, WebGL über Metal)

`python3 tests/p3_bilder.py` (Wüste, Autopilot): hoch + quer **0 Fehler**, keine zu kleinen Tasten; HUD ohne Energie-Balken
(`display: none`), 0 Luftbremsen-Knöpfe, ROLLE-Taste genau mittig (quer 150 px, hoch 140 px breit). Bildfolgen:
`docs/bilder/p3_windschatten_quer.jpg` / `_hoch.jpg`, `p3_windschatten_gross.jpg`, `p3_boostkette_quer.jpg` / `_hoch.jpg`.

Selbst angesehen: Im Windschatten strömen helle Schlieren vom Heck des Vordermanns am eigenen Gleiter vorbei, die
Tempo-Streifen am Rand werden dichter, oben „WINDSCHATTEN“ mit Ladebalken – gut erkennbar (7/10; im kleinen Hochformat sind
die Schlieren eher fein). Boost-Kette: 712 → 885 → 1079 → 1191 km/h über vier Pads, Tacho gelb, Boost-Balken voll – spürbar.
Die Meldung „ROLLE ✓ – TURBO BEI DER LANDUNG“ ist im Hochformat breiter als der Bildschirm (abgeschnitten; bestand schon vorher).

### Handy-Test für Peter (Etappe 1)

1. Wüste: auf der Ostgerade hinter einen Gegner setzen → „WINDSCHATTEN“ erscheint, der Balken lädt; wenn „AUSSCHEREN!“ steht,
   zur Seite lenken → Schleuder-Boost. Fühlt sich der Sog stark genug an? (`?sog=0.2` stärker, `?sog=0` aus)
2. Die neuen engen Kurven (Wüstenbogen, Riff „Riffbogen“, Gebirge „Passkurve“/Schikane, Orbit „Andockbogen“): nur lenken – die
   Fahrhilfe nimmt selbst kurz Gas weg. Zu zahm/zu wild? (`?kurven=alt` = alte Bögen, `?tempo=alt` = altes Tempo)
3. Seitliche Pads am Rand mitnehmen oder liegen lassen – lohnt das Risiko?
4. Unten mittig nur noch die ROLLE-Taste (leuchtet im Sprung). Keine Bremsknöpfe mehr.
5. Überholt sich das Feld jetzt öfter, oder fahren noch alle gleich?

### Grenzen Etappe 1

- Positionswechsel-Ziel (≥ 2×) im Gebirge (1,1×) und Riff (1,7×) nicht erreicht, s. o.
- Die Tempo-Streuung steigt nur mäßig; stärker streuen (`?streuung=1.5`) zieht das Feld auseinander und senkt die Zahl der
  Überholungen (gemessen), deshalb Standard 1.
- Bestzeiten beginnen neu (andere Streckenlänge/Tempo); alte Einträge bleiben gespeichert, gelten aber für die alte Fassung.
- Alles auf dem Mac in Node bzw. headless gemessen, nicht am echten Handy.

## Etappe 2 – Ruckeln und langsamer Start

Peter: „ruckeln zeitweise und starten langsam“ (Android, Mittelklasse). Gesucht waren **Hänger**, nicht mittlere Bildraten.
Profil wie im Mess-Gate: Hochformat 412×915, DPR 2,6, Touch/Mobil-UA, **CPU ×4 gedrosselt** (CDP), WebGL über Metal, beim
Kaltstart zusätzlich **Netz „Fast 4G“** (170 ms, 9 Mbit/s). Werkzeug `python3 tests/p3_ruckeln.py start|rennen` (ein Browser,
stumm, per `open` gestartet), Rohdaten `tests/perf/2026-10-26_p3_*.json`. Am Mac misst das die CPU-Seite realistisch; die
GPU (Shader-Übersetzung im Treiber) ist am Handy deutlich langsamer – deshalb zählt das Werkzeug auch jedes **erste Auftauchen**
eines Shaders/einer Textur/Geometrie im Rennen, das am Mac noch unter 50 ms bleibt, am Handy aber der typische Hänger ist.

### Messung vorher (0.1.18)

**Kaltstart live** (https://drpeterkalmar.github.io/hyperbahn/, gzip wie bei Peter):

| | leerer Cache, erster Besuch | mit Service-Worker-Cache |
|---|---|---|
| bis Menü mit 3D-Strecke | 3,99 s | 1,87 s |
| bis Rennen fährt (sofort geklickt) | 4,75 s | 2,38 s |
| Start-Klick → Rennen läuft | 0,73 s | 0,51 s |
| erstes Countdown-Bild | 300 ms (Long Task 117–209 ms) | 233 ms |

Lade-Wasserfall (erster Besuch): 71 Anfragen, 2,2 MB übertragen. Größte: Musik 983 KB (lädt erst beim Rennstart – blockiert
nichts), Gleiter-Modelle 354/251/91/85 KB (beginnen erst bei 2,4 s, weil sie am Ende des Modul-Baums hängen), three.js 103 +
91 KB. **Was blockiert:** der Import-Baum wird Ebene für Ebene geladen (index → main.js → 30 Module → three.core …, je Ebene
eine Rundreise ≈ 170 ms); danach im Hauptfaden KI-Pläne (CPU ×4: 350–790 ms je Strecke, Riff/Gebirge mit Gabelung doppelt),
Kulisse (Megastadt-Stadtplan ≈ 600 ms, Gebirge ≈ 590 ms) und das erste Bild mit Shader-Übersetzung (≈ 260 ms). Doppelt
geladen: nur `icons/icon-192.png` (Manifest + Link, 36 KB, harmlos). Der Service-Worker lud beim ersten Besuch seine 4,2 MB
gleichzeitig mit dem Spiel.

**Rennen** (Autopilot + 7 Gegner, CPU ×4):

| | Megastadt 150 s | Gebirge 120 s | Riff 120 s |
|---|---|---|---|
| Bildzeit Median / p95 / p99 ms | 16,7 / 16,7 / 16,8 | 16,7 / 16,7 / 16,8 | 16,7 / 16,7 / 16,8 |
| Bilder > 50 ms / > 100 ms | 2 / 1 | 1 / 1 | 1 / 1 |
| längster Hänger | **350 ms** bei t = 0 (Countdown-Start: Aufbau + Shader, Long Task 134 ms) | **367 ms** (dito) | **333 ms** (dito) |
| weitere | 83 ms bei 98,6 s, Hafenkurve: CPU-Profil 72 % „(program)“ = Treiber/GPU, kein JS | – | – |
| Erstauftritte im Rennen (Shader/Textur/Geometrie) | 8 | 11 | 23 |
| Wechsel der Renderskala (Auflösungs-Regler) | 4 | 7 | 4 |

Start-Klick im Detail (CPU ×4, Marken im Code): `starte()` 188 ms – davon Audio-Kontext anlegen 76 ms, HUD-Layout nach dem
Einblenden 69 ms, 8 Gleiter bauen 21 ms –, danach erstes Rennbild 114 ms (Shader + Hochladen). Speicher: ≈ 7,5 MB/s
Allokation, davon das meiste in der Physik (`Gleiter.schritt`, `Pilot.steuer`, Rangliste/Gummiband je Physik-Schritt).

### Was geändert wurde (jede Maßnahme mit Regler)

| Maßnahme | Regler |
|---|---|
| **Vorwärmen im Menü**: Gleiter der Standard-Aufstellung, Funken, Schlieren, Drohne, Minikarte, Kino-Look-Renndurchgang einmal unsichtbar rechnen (`renderer.compileAsync` + 2 Bilder) | `?vorwaermen=0` |
| Gleiter für das Rennen aus diesem Vorrat; Audio-Kontext im Menü (Leerlauf) statt im Start-Klick; HUD im Menü `visibility: hidden` statt `display: none` | (mit `?vorwaermen=0` wird neu gebaut) |
| **KI-Pläne + Stadt-Plan im Worker** (`src/ai/plan_worker.js`), Menü zeigt die Strecke schon vorher; Ergebnis bitgleich geprüft (Linie, Tempoplan, 7229 Türme) | `?planworker=0` |
| **modulepreload** aller Start-Module + der zuletzt gewählten Strecke (aus `tools/update_sw.py`); Gleiter-Modelle bewusst nicht vorab (gemessen: verdrängen three.js) | – |
| Service-Worker registriert erst, wenn Menü + Modelle bereit sind (spätestens 20 s nach `load`) | `?nosw` wie bisher |
| Weniger Speicherbereinigung: Rangliste an Ort und Stelle, Gummiband/KI/Drift ohne neue Objekte je Schritt | – |
| Auflösungs-Regler mit Ruhe (runter nach 2 s, rauf nach 4 s, nicht in den ersten 3 s) | `?skalaruhe=0` |

### Messung nachher (Gate)

**Rennen** (gleiches Profil):

| | Megastadt 150 s | Gebirge 120 s | Riff 120 s | Summe vorher → nachher |
|---|---|---|---|---|
| Bilder > 50 ms | 1 | 0 | 0 | **4 → 1** (Gate: halbiert ✓) |
| Bilder > 100 ms | 0 | 0 | 0 | **3 → 0** |
| längster Hänger | 50,1 ms (Hafenkurve, Treiber/GPU) | 33,3 ms | 33,4 ms | **367 → 50 ms** (Ziel < 100 ms ✓) |
| p95 ms | 16,7 | 16,8 | 16,7 | gleich ✓ |
| Erstauftritte im Rennen | 1 | 0 | 5 | 42 → 6 |
| Renderskala-Wechsel | 2 | 2 | 2 | 15 → 6 |

**Start** (CPU ×4): Start-Klick → erstes Rennbild **302 → 38 ms** (`starte()` 188 → 7 ms, erstes Bild 114 → 31 ms); erstes
Menübild mit Strecke **1,57 → 0,70 s** (ohne Netz). Kaltstart lokal mit Fast 4G (ohne gzip, gleicher Rechner, gleiche
Drossel): Menü **4,14 → 2,91 s**, Klick bis Rennen läuft 0,56 → 0,23 s, Countdown-Hänger 350 → 33 ms.

**Optik:** Standbild hoch an derselben Stelle (Megastadt, Grafikstufe fest) alt/neu nebeneinander angesehen – gleiche
Stadt, Schilder, Bahn, Farben; die Pixel-Abweichung ist Zeit-/Kamera-Versatz, keine Material- oder Licht-Änderung (an Shadern
und Materialien wurde nichts geändert, nur *wann* sie übersetzt werden).

Prüfungen: `npm run test:node` 141/141, `tests/smoke.py`, `tests/p2_cup.py` (alle 5 Strecken nacheinander, mit Worker),
`tests/p3_bilder.py` – 0 Fehler.

### Handy-Test für Peter (Etappe 2)

1. App einmal neu laden: Wie schnell steht das Menü, wie schnell fährt man nach „RENNEN STARTEN“? Hängt der Countdown noch?
2. Zwei, drei Rennen auf verschiedenen Strecken: kommen noch Ruckler? Wenn ja: Strecke + Stelle merken (z. B. „Megastadt
   Hafenkurve“) – mit `?vorwaermen=0` bzw. `?skalaruhe=0` lässt sich vergleichen, ob es vorher schlimmer war.

### Grenzen Etappe 2

- Gemessen am Mac (Metal) mit gedrosselter CPU, nicht am echten Android; die GPU-Seite (Shader-Übersetzung) ist am Handy
  langsamer – deshalb die zusätzliche Zählung der Erstauftritte (42 → 6).
- Der verbleibende Hänger in der Megastadt-Hafenkurve (50 ms) liegt im Treiber/GPU (kein JS) – nicht weiter verfolgt.
- Gebirge-Kulisse (≈ 590 ms bei CPU ×4) läuft weiter im Hauptfaden beim Strecken-Wechsel (Menü/Cup), nicht im Rennen.
- Die Allokationsrate der Physik ist weiter hoch (kurze, häufige Bereinigungen); große Umbauten (Physik ohne Objekte) wären
  ein eigener Auftrag.
