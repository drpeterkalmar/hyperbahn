# Hyperbahn – Änderungen

Kurzfassung je Version; Details in den Berichten (`*_BERICHT.md`).

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
