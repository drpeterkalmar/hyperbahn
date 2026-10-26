# Hyperbahn – Bericht P3: Tempo, Boost, Windschatten (Etappe 1) · Ruckeln und Start (Etappe 2)

Stand 26.10.2026 · Auftrag `hyperbahn-p3-tempo-boost` · Peter: „Mehr Boost und Windschatten-Ansaugen, sonst wird's
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

(folgt)
