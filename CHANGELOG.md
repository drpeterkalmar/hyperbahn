# Hyperbahn – Änderungen

Kurzfassung je Version; Details in den Berichten (`*_BERICHT.md`).

## NEU (P2: Riff-Röhre)
- **Neue Strecke „Riff-Röhre“** (Technik): unter Wasser – Glasröhren durch ein Korallenriff, Lichtstrahlen von oben,
  wogender Seetang, Fischschwärme, Luftblasen. Korkenzieher, Doppel-Korkenzieher, Röhren-Schlange, lange
  Magnet-Überkopf-Röhre, **Gabelung**: innen schmal, ohne Bande und mit Boost-Pads (≈ 2 s je Runde schneller, aber wer
  über die Kante fährt, stürzt ins Riff), außen breit und sicher; Riesensprung über den Riffgraben. Runde 1:30, 3 Runden.
- KI wählt an Gabelungen je nach Stärke den schnellen oder den sicheren Weg; die Fahrhilfe folgt dem Weg, den du fährst.

## 0.1.10 – 26.10.2026 (P2: Streckenwahl + Wüsten-Raumhafen)
- **Streckenwahl im Menü:** Karten mit drehender 3D-Vorschau der Strecke (Höhen, Magnet/Röhre/Landezone farbig, Pads gelb),
  Name, Charakter, Rundenzahl und Bestzeit; „🎲 Zufällig“ (nie zweimal hintereinander dieselbe), 🔗 Teilen-Link je Strecke.
  URL `?strecke=wueste|megastadt|lang|zufall`; die Megastadt behält Kurz/Lang und alle Bestzeiten. Wechsel ohne Neuladen.
- **Neue Strecke „Wüsten-Raumhafen“** (Vollgas): Dämmerung mit tiefer Sonne, Dünen, Tafelberge, Raumhafen mit Rakete,
  Startturm, Hangar-Tunnel, Pistenlichtern und Sandsturm. Lange Geraden mit Boost-Ketten, weite schnelle Bögen, Kuppen-Hüpfer,
  Riesensprung über das Raketensilo (500 m Lücke, 5–8 s Flug, bis ≈ 900 m weit). Runde 1:28 (KI Mittel), 3 Runden ≈ 4:30.
- Technik: Strecken-Register mit Lazy-Laden (Daten + Kulisse je Strecke), Himmel/Nebel/Licht/Farbkorrektur je Strecke,
  neue Bahn-Eigenschaften für die nächsten Strecken (offene Kante ohne Bande, Gabelungs-Teiler, schwache Schwerkraft).

## 0.1.9 – 26.10.2026 (P1b Abschluss)
- Bericht `P1B_VORLAGEN_BERICHT.md` (Messtabelle Vorlage / Ziel / vorher / nachher, Handy-Testhinweise, Regler, Grenzen),
  Messprotokolle `docs/mess/`, Bilder `docs/bilder/p1b_*`. Rundenzeit der langen Fassung neu gemessen (158 s, weiter 1 Runde).

## 0.1.8 – 26.10.2026 (P1b Etappe D: Start-Varianten, KI-Revanche, Seitwärts-Schub, G-Vignette)
- **Abgestufter Start-Boost** (`?startgrad=0` = bisher „Tipp auf Grün“): Idealpunkt 0,25 s **vor** Grün = 100 % („PERFEKTER
  START!“), linear bis 30 % am Fensterrand (±0,2 s), Meldung zeigt die Stärke. KI trifft je Profil Ø 12/33/54 %.
- **Drehzahl-Band** für den analogen Gas-Abzug (Gamepad RT, `?startband=0` aus): Drehzahl-Anzeige im Countdown, bei Grün
  85–90 % = voller Start-Boost, darüber 0,8 s Stotterer. Tastatur/Touch nutzen den abgestuften Tipp.
- **KI-Revanche** (`?revanche=0` aus): eine KI „Mittel“/„Profi“, die du gerade überholt hast, fährt 3 s mit +8 % Höchsttempo
  (nur offline) – Zurück-Überholquote 28 % (Ziel 25–40 %, vorher 9 %; Datenblatt-Startwert ×1,5 Beschleunigung gab 55 %).
- **Seitwärts-Schub** (`?strafe=0` aus): Gamepad rechter Stick seitlich, Tastatur Y/X – bis 8 m/s quer, ohne zu drehen,
  kostet kein Tempo (Touch: die Luftbremsen übernehmen).
- **G-Vignette** (`?gvignette=0` aus): magenta/schwarzer Rand ab 3 g, höchstens 35 % – in jedem Looping, aus mit „Blitze
  reduzieren“, bremst nicht.

## 0.1.7 – 26.10.2026 (P1b Etappe C: Flugzeit-Boost, Boost-Reserve mit Ketten-Deckel)
- **Flugzeit-Boost** (`?flugboost=0` aus): saubere Landung (Nase ≤ 12° zur Bahn) nach ≥ 0,8 / 1,6 / 3,0 s Flug gibt Stufe
  1/2/3 (+1,0 s/+15 %, +1,5 s/+20 %, +1,5 s/+25 %). Jeder Riesensprung = Stufe 3, Zeitgewinn 0,55–0,67 s.
  **HUD-Flugmesser** in der Bildmitte: Flugzeit mit Marken bei 0,8/1,6/3,0 s, nach der Landung 1,5 s das Ergebnis.
- **Pads als Reserve** (`?reserve=4`, 0 = bisher): jedes Pad legt 1,3 s Boost-Zeit drauf (höchstens 4 s), jedes weitere Pad
  der Kette hebt die Stufe (+50 → +60 → +70 → Deckel +80 %); solange Reserve läuft, zieht der Antrieb doppelt (am Boden,
  ohne gezogene Luftbremse). Luftbremse während eines Boosts nimmt das Zwangs-Vollgas weg (sonst käme man vor Kurven nicht
  mehr runter). Kamera-Nachlauf in Fahrtrichtung weich auf 0,5 m begrenzt.
- KI: Energie-Boost nie vor Magnet-/Röhren-/Sprung-Passagen (über ~120 m/s hebt der Gleiter dort ab), weicher Spurwechsel
  in die Boxengasse. Rundenzeit Kurzfassung (KI Mittel) 135 s, Rennen 4:38.

## 0.1.6 – 26.10.2026 (P1b Etappe B: Energie = Schild = Boost, Boxengasse)
- **Ein Energie-Balken** (HUD „ENERGIE“, vorher „SCHILD“): Wandtreffer/Rempler kosten wie bisher, dazu **manueller Boost**
  am Boden (Leertaste/ROLLE-Taste, die am Boden „⚡ BOOST“ zeigt; Gamepad A/X) ab Runde 2 (1-Runden-Rennen: ab der Hälfte):
  +35 % Höchsttempo für 1,6 s, kostet 12 %, nie unter 1 % – 8 Boosts aus vollem Balken.
- **Boxengasse**: grüne Lade-Spur mit wandernden „+“ rechts auf der Start-Ziel-Geraden, lädt 35 %/s (leer → voll 2,9 s).
- **Notlauf** bei leerem Balken (70 % Höchsttempo, Funken), **Rot-Warnung** unter 25 % (Gleiter-Lichter + Balken rot,
  2 Hz Puls – mit „Blitze reduzieren“ ruhig rot – und Warnton).
- **Barrel-Roll kostet 10 %** (nur ab 25 % Rest), nur 1× je Sprung, der Turbo (+30 %, 1,2 s) zündet erst bei der Landung.
- KI nutzt Boost (Geraden, genug Energie) und Boxengasse (unter 35–60 % je Stärke).
- Regler: `?energie=0` (alles bisher), `?boostkosten=12`, `?box=35`, `?rollkosten=10` (0 = Rolle frei wie bisher).

## 0.1.5 – 26.10.2026 (P1b Etappe A: Fahrphysik nach dem Vorlagen-Datenblatt)
- **Schwebe-Feder nach dem 1/h-Gesetz** (`?schwebe=0` = bisher): weich oben, sehr hart nah am Boden, Ruhelage 1,20 m;
  Landung aus 10 m federt 0,36 m ein und ist nach 0,36 s ruhig (vorher bretthart 0,03 m). Drift-Hüpfer nur aus der Ruhelage.
- **Luftbremse** (`?bremse=0`, `?rutsch=1.2`): Wirkung baut sich in 0,2 s auf; Dauer-Halten ohne Drift senkt das Tempo
  auf 80 % (eine) bzw. 46 % (beide) – vorher 98 %/93 %; ohne Drift gleitet der Gleiter mit Bremse (Ausricht-Zeit 1,2 s);
  im Drift max. Schiebewinkel 25° (vorher 33°), Mini-Turbo-Gewinn unverändert (0,38/0,50 s).
- **Gegenlenken** (`?lenk=alt`): Gier-Beschleunigung begrenzt (3,5 rad/s², gegen die Drehung doppelt), Gierrate ≤ 100°/s.
- **Wandtreffer** (`?wand=0`): nur echte Einschläge kosten (Tempo −10…−30 % je Winkel, Energie ∝ Quertempo), Nase gleitet
  an der Wand ab – 30° bei Top: −19 % Tempo / −6 % Energie (vorher −46 % / −16 % durch Schleifen).
- **Bergung** (`?bergung=1.5`, 0 = bisher): Neon-Drohne mit Zugstrahl holt den Gleiter nach einem Abflug in 1,5 s, nach
  einem Sprung hinter der Lücke abgesetzt (40 % Tempo) – Zeitverlust 2,2 s (Ziel 2–3 s).
- **Landungs-Nicken** (`?nicken=0`): Landung mit Nase > 20° = „HARTE LANDUNG“ (−15 % Tempo, Funken).
- Schräglage des Modells folgt der Gierrate (`?schraeg=0` = bisher). Messwerkzeug `node tools/vorlagen_mess.mjs`.

## 0.1.4 – 26.10.2026 (P1b Etappe 0: kein Abschmieren in der Luft, Rennen ≤ 5 min)
- **Gehaltenes ↑ senkt in der Luft nie mehr die Nase** (Peter: „kein Abschmieren in der Luft, wenn ich Pfeil hinauf
  halte“): wer über den Absprung Gas hält, fliegt wie ohne Taste. Nicken nur nach einem NEUEN Druck in der Luft (↑ = Nase
  runter, ↓ = Nase hoch; Gamepad-Stick genauso). Sicherheits-Hülle: Nase höchstens 12° unter / 25° über der Flugbahn, über
  einer Sprung-Lücke kein Nase-Senken, sobald die Landezone nicht mehr sicher erreicht würde, ab 30–50 m über der Bahn kein
  Steigen mehr; Landehilfe richtet die Nase in den letzten 0,9 s zur Fahrfläche aus (ändert die Flugbahn nicht).
  `?nase=alt` = bisher. Gemessen (`node tools/luft_mess.mjs`, 4 Riesensprünge mit/ohne Pad-Kette): ↑ dauerhaft vorher
  4/4 Abstürze, jetzt 0 Abstürze, 0 Bauchlandungen, Weite = neutral; Kürzer/Weiter-Spanne 1 198 → 2 216 m; 2 Runden mit
  ↑ dauerhaft: 4 → 0 Abflüge. Mindesttempo an den Kanten unverändert (73/70 m/s).
- **Rennen höchstens 5 Minuten:** neue Kurzfassung der Neon-Megastadt (13,3 statt 15,8 km; alle Passagen bleiben, die
  Sprünge samt Pad-Ketten, Rampen und Landezonen sind unverändert, gekürzt sind Geraden, Ausläufe und Bögen) mit 2 Runden.
  Rundenzahl je Fassung aus der gemessenen Median-Rundenzeit der KI „Mittel“ (`node tools/rundenzeit_mess.mjs`): Kurz
  139 s → 2 Runden, Rennen inkl. Countdown Mittel 4:44, schnellste KI 4:37; Lang 165 s → 1 Runde. Menü „Strecke: Kurz ·
  2 Runden / Lang · 1 Runde“, `?strecke=lang`, `?runden=` überschreibt. Bestzeiten je Fassung + Rundenzahl getrennt
  (Zielanzeige, „NEU!“). Versionsnummer im Menü.

## 0.1.3 – 23.10.2026 (Mess-Gate-Nachbesserung zu 0.1.2)
- 0.1.2 kostete in den Sprung-Szenen des Mess-Gates +8 bis +30 % p95 (CPU-Profil: `Gleiter.schritt` +50 %): die Felder des
  weichen Stoßes wurden erst beim ersten Stoß an die Gleiter gehängt – das ändert die Objektform mitten im Rennen und bremst
  die JS-Engine. Jetzt im Konstruktor angelegt → A/B wieder −5 bis +3 % (Rauschen).
- Schleif-Kontakt: Folge-Stöße desselben Paars (< 0,4 s) lösen keinen Ton/Kamera-Ruck mehr aus (vorher bis ~27× je Sekunde).

## 0.1.2 – 23.10.2026 (weichere Zusammenstöße)
- **Rempler fühlen sich wie Anstupsen an** (Peter: „Zusammenstöße mit anderen Gleitern sind sehr hart“): Impuls halbiert
  (0,85 → 0,42 × Annäherungstempo), Gewichts-Deckel 3 → 2, höchstens 6 m/s je Kontakt, nur in der Fahrfläche (kein
  Abheben/Wegdrücken von der Magnet-Bahn), über 3 Physik-Schritte verteilt statt eines Schlags, Trennung der Überlappung
  weich, Drift bricht nur bei kräftigen Stößen ab. „Schwer“ schiebt weiterhin am stärksten (Verhältnis leicht/schwer ≈ 5×
  statt 7,6×). `?stoss=alt` = bisheriges Verhalten, `?stossmax=` Deckel je Kontakt.
- **KI weicht besser aus**: Gleiter direkt daneben → Platz machen statt Schleifen; Gleiter voraus → früher (Zeit bis zum
  Kontakt < 3 s) und schneller zur freien Seite. `?ausweich=0` = bisher.
- Messung 48 Bot-Rennen × 2 Runden je Stand (`node tools/rempler_mess.mjs 48 2 [?stoss=alt&ausweich=0]`): Abflüge nach
  Remplern 5 → 0, Tempoverlust je Rempler p95 88 → 47 km/h (Leicht 145 → 69), senkrechter Stoß p95 1,3 → 0,3 m/s,
  Rempler mit dem Spieler 17,4 → 9,3 je Rennen, KI fährt auf den Spieler auf 0,5 → 0,6 je Rennen (26 → 30, im Rauschen).

## 0.1.1 – 23.10.2026 (Looping-Kamera, Reset-Knopf)
- **Kamera im Looping nicht mehr unter der Fahrbahn** (Peter: „Kamera clippt im Looping durch den Boden“, Fix wie
  Stuntbahn 0.12.2): Ursache war vor allem der Nachlauf der Verfolger-Kamera – im Looping zog die Tempo-Glättung sie bis zu
  ~4 m zur Außenseite, also durch die Fahrbahn. Jetzt (a) steigt die Kamera weich um 1,2 m, sobald die Bahn steiler als ~32°
  geneigt ist (Looping, Korkenzieher, Wand, Überkopf, Twist; Bezug ist die Bahn-Normale), (b) ist der Nachlauf zur Fahrbahn
  hin weich auf 0,6 m begrenzt und (c) hält die Kamera einen weichen Mindestabstand von 1 m zur Fahrfläche (auch im
  Bullet-Time-Halbkreis). Gemessen über eine ganze Runde: vorher 337 Bilder mit Kamera unter der Fahrbahn (bis −3,9 m),
  jetzt 0. Regler `?camloop=0` (alt) bis `?camloop=4` (Meter), `?camboden=0` (Mindestabstand aus).
- **1-Klick-Reset auf die Strecke**: gelber ↺-Knopf links über der linken Bremse, Taste R oder Rücktaste, Gamepad Y bzw.
  Zurück/View. Setzt den Gleiter sofort mittig an die letzte sichere Stelle mit Schwung (45–70 % Höchsttempo, vor einem
  Riesensprung genug für den Sprung), kurze Überblendung. Kein Abkürzen: im Flug über einer Sprung-Lücke geht es nicht
  („IM SPRUNG – ERST LANDEN“), der Rückweg zählt in der Rundenwertung; Doppelklick-Schutz 1 s.
- Tests: `tests/node/test_reset.mjs`, Kamera-Test über Looping/Röhre/Wand/Überkopf/Twist, `tools/kamera_probe.mjs`
  (Kamera-Höhe je Abschnitt ohne Browser), `tests/kamera_folge.py` (Bildfolgen + Reset im Browser). Testhelfer mit
  Windows-Weiche (ANGLE/D3D11), `tools/update_sw.py` schreibt auch unter Windows `/`-Pfade und LF.
