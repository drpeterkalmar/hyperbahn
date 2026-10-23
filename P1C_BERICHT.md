# Hyperbahn – Bericht p1c (Peters Rückmeldung nach dem Anspielen von Phase 1)

Stand 23.10.2026 · Versionen 0.1.1 (Etappe A), 0.1.2 (Etappe B), 0.1.3 (Mess-Gate-Nachbesserung) · gebaut und gemessen auf
rog17 (Windows 11, RTX 3070 Ti) · live: https://drpeterkalmar.github.io/hyperbahn/ · Bilder: `docs/bilder/p1c_*`

## Kurz für Peter

Die Kamera taucht im Looping (und in Röhre, Wand, Überkopf, Twist) nicht mehr unter die Fahrbahn – vorher waren es in einer
Runde 337 Bilder, jetzt 0. Rempler sind jetzt ein Anstupsen: halber Impuls, gedeckelt, nie mehr nach oben, keine Abflüge
mehr durch Zusammenstöße, und die KI macht Platz statt neben dir zu schleifen. Neu ist der gelbe ↺-Knopf (bzw. Taste R,
Gamepad Y), der dich sofort mittig auf die Bahn zurücksetzt – ohne Abkürzen.

## 1. Looping-Kamera (0.1.1)

**Ursache:** nicht nur die Höhe wie in der Stuntbahn, sondern vor allem der Nachlauf der Verfolger-Kamera. Sie glättet das
Tempo; im Looping dreht die Flugrichtung schnell, die geglättete hinkt nach, und der Versatz `−(v − vGlatt)·0,55` zeigt
nach außen – also durch die Fahrbahn (bis ~4 m).

**Fix (`src/gfx/kamera.js`):**
- Looping-Höhe wie Stuntbahn 0.12.2: steiler als ~32° geneigte **Bahn-Normale** (nicht Welt-oben; in der Luft das
  Kamera-Oben) → Kamera steigt weich um 1,2 m entlang Kamera-Oben, voll ab senkrecht, schnell hoch (4/s), langsam zurück
  (1,5/s). Gilt so auch für Korkenzieher, Wand, Überkopf, Twist. `?camloop=0` = alt, `?camloop=0…4` m.
- Nachlauf zur Fahrbahn hin weich auf 0,6 m begrenzt (`KAM.nachlaufUnten`).
- Weicher Mindestabstand zur Fahrfläche: Bahn-Raycast an der Kamera-Lage (wie die Schwebe-Punkte), unter 2 m Höhe stetig
  angehoben, nie unter 1 m; gilt für jede Kamera-Lage einschließlich Bullet-Time-Halbkreis und Shake. `?camboden=0` aus.
- Replay-Kameras gibt es in der Hyperbahn nicht; die einzige Action-Kamera ist der Bullet-Time-Halbkreis (mitgeprüft).

**Beleg ohne Browser** (`node tools/kamera_probe.mjs [?camloop=0&camboden=0] [--orbit]`, Profi-KI, eine Runde, 60 Bilder/s):

| Abschnitt | min. Kamera-Höhe über Fahrbahn vorher | nachher | Bilder unter der Fahrbahn vorher → nachher |
|---|---|---|---|
| Großer Looping | −3,89 m | 3,37 m | 337 → 0 |
| Korkenzieher-Röhre | 3,91 m | 3,93 m | 0 → 0 |
| Fassade (Wandfahrt) | 3,61 m | 3,86 m | 0 → 0 |
| Unter der Brücke (Überkopf) | 3,11 m | 3,96 m | 0 → 0 |
| Möbius-Twist | 3,60 m | 3,82 m | 0 → 0 |
| ganze Runde (9728 Bilder) | | | **337 → 0**; mit Bullet-Time-Halbkreis jede 25. Stelle: 0; `?speed=1.4`: 0 |

Mit „Horizont halten“ (träges Kamera-Oben) sinkt die Kamera im Looping bis 1,31 m – dort greift der Mindestabstand.

**Beleg im Browser** (`py tests/kamera_folge.py`, je 12 Bilder durch Looping, Röhre, Wand, Überkopf, Twist, Höhe aus dem
Spiel gemessen): 60 Bilder, **0 mit Kamera hinter/unter der Fahrbahn** (min. 3,5–4,1 m); mit `&camloop=0&camboden=0`
im Looping 9 von 12 Bildern darunter (bis −1,5 m). Bilder: `docs/bilder/p1c_looping_kamera_vorher.jpg` (man sieht unter
der Fahrbahn durch in die Stadt) und `…_nachher.jpg`, `p1c_twist_kamera.jpg`. Node-Test: `test_kamera.mjs` (neu: Kamera
nie unter der Fahrbahn in allen fünf Abschnitten, mit und ohne Bullet-Time).

## 2. Weichere Zusammenstöße (0.1.2 / 0.1.3)

**Vorher** (`rennen.js stoesse`): Impuls je Gleiter = 0,85 × Annäherungstempo × min(3, Gewicht anderer/eigenes), auf einen
Schlag, entlang der 3D-Verbindungslinie. Ein leichter Gleiter, den ein schwerer trifft, bekam das **2,3-Fache** der
Annäherungsgeschwindigkeit – inklusive senkrechtem Anteil (Abheben, auf Magnet-Abschnitten Wegdrücken von der Bahn).

**Jetzt („weich“):** 0,42 × Annäherungstempo × min(2, Gewichtsverhältnis), höchstens 6 m/s je Kontakt-Impuls, nur in der
Fahrfläche, über 3 Physik-Schritte verteilt, danach kurze Paar-Pause, Überlappung weich getrennt, Drift bricht nur bei
kräftigen Stößen ab, Folge-Stöße eines Schleif-Kontakts ohne Ton/Kamera-Ruck. „Schwer“ schiebt weiter am stärksten
(Verhältnis leicht/schwer ≈ 5× statt 7,6×; Datenblatt-Test #12 entsprechend angepasst). `?stoss=alt` = bisher,
`?stossmax=` Deckel.

**KI-Ausweichen (`ai/pilot.js`)**: Die erste Messung zeigte, dass weiche Stöße die Gleiter kaum noch trennen – die KI
schliff länger neben dem Spieler. Neu: Gleiter direkt daneben → 5 m Platz machen; Gleiter voraus → der nächste zählt,
Reaktion schon bei < 3 s bis zum Kontakt und schneller (4/s), Seite = die mit mehr Abstand zum anderen. `?ausweich=0` = bisher.

**Messung** (`node tools/rempler_mess.mjs 48 2 [?stoss=alt&ausweich=0]`): je Stand 48 Bot-Rennen × 2 Runden (268 min
Rennzeit), 8 Gleiter, Klassen gemischt wie im Spiel, Spieler-Bot (Klasse reihum leicht/mittel/schwer, Startplatz 6)
**weicht selbst nicht aus** (wie ein Mensch, der stur seine Linie fährt). Rempler = Kontakt-Episode eines Gleiters mit
einem anderen (Impulse ohne Pause > 0,3 s), Werte je beteiligtem Gleiter.

| Stand | Gleiter | Rempler | Tempoverlust km/h (Median / p95) | Quer-Stoß km/h (Median / p95) | senkrecht m/s (p95) | Querversatz nach 0,5 s m (Median / p95) | Wand ≤ 1 s | Absturz ≤ 3 s |
|---|---|---|---|---|---|---|---|---|
| vorher | alle | 3758 | 1,1 / 88,4 | 9,8 / 109,4 | 1,32 | 0,97 / 4,71 | 58 | **5** |
| vorher | Leicht | 1341 | 18,7 / 144,5 | 19,6 / 150,5 | 3,02 | 0,86 / 4,21 | 38 | 2 |
| vorher | Mittel | 1084 | −8,0 / 58,5 | 10,3 / 106,4 | 1,05 | 1,05 / 5,16 | 13 | 1 |
| vorher | Schwer | 1333 | −1,8 / 23,3 | 5,3 / 32,4 | 0,57 | 1,04 / 4,68 | 7 | 2 |
| vorher | Tempounterschied > 15 m/s | 568 | 5,9 / 163,8 | 29,1 / 174,1 | 4,75 | 1,65 / 5,59 | 18 | 1 |
| nur weicher Stoß | alle | 3804 | 0,3 / 53,2 | 6,4 / 59,7 | 0,44 | 0,97 / 4,71 | 31 | 0 |
| nur weicher Stoß | Leicht | 1376 | 9,0 / 73,0 | 11,4 / 90,1 | 0,65 | 0,97 / 4,57 | 18 | 0 |
| **nachher** | alle | 2306 | 0,4 / 46,8 | 10,4 / 55,4 | 0,32 | 1,12 / 5,29 | 60 | **0** |
| **nachher** | Leicht | 856 | 3,3 / 68,5 | 15,7 / 76,1 | 0,43 | 1,13 / 5,21 | 38 | 0 |
| **nachher** | Mittel | 638 | −0,9 / 40,1 | 12,8 / 68,7 | 0,33 | 1,15 / 6,40 | 11 | 0 |
| **nachher** | Schwer | 812 | 0,3 / 16,7 | 6,2 / 34,6 | 0,19 | 1,10 / 5,01 | 11 | 0 |
| **nachher** | Tempounterschied > 15 m/s | 622 | 3,0 / 79,8 | 24,3 / 103,8 | 0,24 | 1,55 / 5,58 | 30 | 0 |

(Negativer Tempoverlust = Schub nach vorn, z. B. wer von hinten angeschoben wird.)

| Kennzahl (48 Rennen) | vorher | nur weicher Stoß | nachher |
|---|---|---|---|
| Abflüge gesamt / davon ≤ 3 s nach einem Rempler | 15 / 5 | 0 / 0 | 1 / 0 |
| Rempler mit dem Spieler je Rennen | 17,4 | 17,5 | **9,3** |
| KI fährt auf den Spieler auf (≥ 5 m/s schneller, von hinten, ohne Startgedränge) | 26 (0,5 je Rennen) | 33 | 30 (0,6 je Rennen) |

**KI-Gate** (`node tools/ki_rennen.mjs 10`, 8 KI × 10 Runden): 0 Abflüge, alle Sprünge gelandet, beste Runden wie vorher
(Profi 161,4–161,6 s, Mittel 163,2–164,5 s, Leicht 168,0–168,5 s). Wandtreffer Mittel 4–24 (vorher 4–11).
**Gummiband** (`test_gefuehl` #9/#10): grün.

## 3. 1-Klick-Reset (0.1.1)

- Gelber runder ↺-Knopf links über der linken Bremse (60 px, im Hochformat 64 px, mit dem linken Daumen erreichbar, auch
  ohne Touch sichtbar), Taste **R** oder **Rücktaste**, Gamepad **Y** bzw. **Zurück/View**. Einen Zurückspulen-Knopf gab
  es nicht.
- `Gleiter.zuruecksetzen()` (nutzt `setzeAuf` wie `respawn()`): sofort mittig an die letzte sichere Stelle (`sicherS`:
  zuletzt ≥ 0,5 s am Boden auf der Bahn – nie vor der aktuellen Stelle), ausgerichtet, Schwung = aktuelles Tempo begrenzt
  auf 45–70 % Höchsttempo; liegt in ≤ 900 m ein Riesensprung, mindestens Sprung-Mindesttempo × 1,15. Schild bleibt.
  Kurze Überblendung (0,4 s), Kamera springt mit, Meldung „ZURÜCK AUF DIE BAHN“. Bei automatischem Respawn jetzt dieselbe
  Überblendung.
- **Kein Abkürzen:** im Flug über einer Sprung-Lücke abgelehnt („IM SPRUNG – ERST LANDEN“), erst wenn man unter die
  Lücken-Bahn gefallen ist, zählt der Reset als Absturz (normaler Respawn hinter der Lücke nach 1,6 s); schon abgestürzt
  → Respawn sofort (gleiches Ziel). Der Rücksprung zählt als negativer Fortschritt in der Rundenwertung (vorher hätte ein
  Sprung > 80 m zurück ohne Respawn-Zähler nicht gezählt → doppelt gefahrene Meter). Nur im laufenden Rennen.
- Doppelklick-Schutz 1 s (Knopf solange halb durchsichtig).
- Tests: `tests/node/test_reset.mjs` (4 Tests), im Browser `tests/kamera_folge.py`: Taste R setzt mittig (u = 0,00),
  sofortiger zweiter Druck abgelehnt, nach 1,3 s wieder möglich. Bild: `docs/bilder/p1c_reset_knopf_hoch.jpg`.

## 4. Prüfungen

- **Live geprüft:** https://drpeterkalmar.github.io/hyperbahn/sw.js liefert `VERSION = '3f79470cc3'` = lokaler Stand 0.1.3
  (jede Etappe einzeln über `omen_land.sh` auf main: 775b9e6, 9457283, b2fe031).
- `npm run test:node`: **80/80 grün** (74 + 1 Kamera + 4 Reset + 1 weicher Stoß).
- `py tests/smoke.py`: 0 Fehler, keine zu kleinen Tasten. `py tests/test_eingabe_zeitlupe.py`: OK.
  `py tests/kamera_folge.py`: 0 Bilder unter der Fahrbahn, Reset OK.
- Testhelfer mit Windows-Weiche (`tests/util.py`, `tests/perf_gate.py`: ANGLE/D3D11, GPU-Prüfung erkennt Direct3D/NVIDIA;
  Mac/Linux unverändert). `tools/update_sw.py` schreibt unter Windows `/`-Pfade und LF (geprüft: ergibt auf dem
  Ausgangsstand exakt die Mac-Version `6ca41467d0`), `perf_gate.py` schreibt JSON mit LF.

**Mess-Gate** (Mittelklasse-Profil: CPU ×4 gedrosselt, DPR 2,6, 412×915 / 915×412; gemessen auf rog17, RTX 3070 Ti,
Windows, beide Stände auf derselben Maschine; Rechner nebenbei durch fremde Prozesse belastet):

| Szene | Gerät | p95 vorher (f2f56ea) | p95 nachher (b2fe031) | Δ | Calls vorher (f2f56ea) | Calls nachher (b2fe031) |
|---|---|---|---|---|---|---|
| menu_standard | hoch | 12.6 | 10.9 | -13.5 % | 33 | 33 |
| menu_standard | quer | 12 | 11.4 | -5.0 % | 34 | 34 |
| start_standard | hoch | 40.1 | 42.6 | +6.2 % | 85 | 78 |
| start_standard | quer | 41.8 | 40.9 | -2.2 % | 85 | 80 |
| start_kino | hoch | 43.4 | 45.4 | +4.6 % | 87 | 80 |
| start_kino | quer | 48.7 | 45.4 | -6.8 % | 87 | 82 |
| pulk_standard | hoch | 56.3 | 61.4 | +9.1 % | 77 | 79 |
| pulk_standard | quer | 67.4 | 63.8 | -5.3 % | 78 | 81 |
| looping_standard | hoch | 28.7 | 28.4 | -1.0 % | 74 | 76 |
| looping_standard | quer | 28.5 | 29 | +1.8 % | 76 | 79 |
| roehre_standard | hoch | 46.9 | 50.9 | +8.5 % | 79 | 80 |
| roehre_standard | quer | 44.3 | 51.4 | +16.0 % | 81 | 81 |
| sprung_standard | hoch | 39.2 | 44.1 | +12.5 % | 76 | 70 |
| sprung_standard | quer | 40.6 | 39.3 | -3.2 % | 75 | 69 |
| sprung_einfach | hoch | 36.3 | 36.1 | -0.6 % | 67 | 61 |
| sprung_einfach | quer | 42.4 | 38.9 | -8.3 % | 66 | 60 |

Ladegröße gzip: 0.36 → 0.35 MB

Draw-Calls, Dreiecke und Ladegröße (0,36 → 0,35 MB gzip) unverändert; Fehler 0. Einzelläufe streuen auf diesem Rechner
um ±10 % (gleiche Szene, gleicher Stand). Zur Klärung **A/B im Wechsel** (3 Runden, derselbe Code, alter Stand per Regler
`&stoss=alt&ausweich=0&camloop=0&camboden=0`): Looping/Sprung im Rauschen (−5 … +3 %), aber **Pulk quer +10 % und
Röhre quer +10 % p95** (p50 +1,3 bzw. +4 ms). Eingegrenzt per Regler und CPU-Profil auf das **neue KI-Ausweichen**
(`?ausweich=0` bringt die Zeiten zurück): Im Spiel wird die Gleiter-Physik damit je Schritt ~30–40 % teurer
(ungedrosselt 124 → 164 µs je Rennen-Schritt mit 8 Gleitern, ≈ +0,15 ms je Bild). In Node und im Browser ohne Grafik
(gleiche Szene, gleiche Seeds) kostet es dagegen nichts (36 vs. 36 µs) – vermutlich ein Effekt der JS-Engine im vollen
Spiel. Eine seltenere Ausweich-Entscheidung (60 Hz) änderte nichts und wurde verworfen. → siehe „offen“.

Unterwegs gefunden und behoben (0.1.3): 0.1.2 kostete in den Sprung-Szenen +8 bis +30 % p95 (A/B im Wechsel, 3 Runden).
CPU-Profil: `Gleiter.schritt` +50 % – die Stoß-Felder wurden erst beim ersten Stoß an die Gleiter gehängt, das ändert die
Objektform mitten im Rennen. Im Konstruktor angelegt → A/B gegen `?stoss=alt` −5 bis +3 %.

## 5. Grenzen / offen

- **Gefühl nicht von Hand gespielt:** Rempler und Reset sind per Bot-Rennen, Node-Tests und emuliertem Touch geprüft, nicht
  auf einem echten Handy. Ob 0,42/Deckel 2/6 m/s „Anstupsen“ trifft, muss Peter anspielen (`?stoss=alt` zum Vergleich,
  `?stossmax=4` noch weicher).
- **KI-Auffahrer** auf den Spieler: 26 → 30 in 48 Rennen – im Rauschen (±5), also nicht nachweislich weniger, nur nicht
  deutlich mehr; Kontakte mit dem Spieler insgesamt fast halbiert.
- Wandtreffer nach Remplern bzw. der KI etwas häufiger (das neue Seite-an-Seite-Ausweichen drückt sie öfter an die Bande).
- Der ↺-Reset-Knopf und das ⟲ der ROLLE-Taste sehen sich ähnlich (gelb/rund vs. magenta/eckig); ggf. anderes Symbol.
- Im Modus „Horizont halten“ fährt die Kamera im Looping tief (1,3 m, vom Mindestabstand gehalten) – sichtbar flacher.
- **Offen für den Mac – Mess-Gate Pulk/Röhre +10 % p95** durch das KI-Ausweichen (siehe Abschnitt 4). Absolut klein
  (≈ 0,15 ms je Bild am Desktop, gedrosselt ≈ 1 ms), aber nicht „unverändert“. Nächster Schritt: am Mac mit dem dortigen
  Mess-Gate A/B `--ab "alt=&ausweich=0" --ab "neu="` gegenmessen; falls bestätigt, im Chrome-Profiler mit
  `--js-flags=--trace-deopt` nach Deoptimierungen in `Gleiter.schritt` suchen. Rückfall ohne Code-Änderung: `?ausweich=0`
  (dann KI-Auffahrer 33 statt 26/30 in 48 Rennen und Spieler-Rempler 17,5 statt 9,3 je Rennen).
- Datenblatt-Messungen mit Endstand (`node tools/gefuehl_mess.mjs`): #9 Gummiband P1-Abstand 2,5 s, Feld 8,4 s, 5 Wechsel;
  #10 ohne Gummiband 2,44× gestreut; #12 Stoß-Verhältnis leicht/schwer 4,9× (Ziel jetzt ≈ 5×, vorher 7,6×).
