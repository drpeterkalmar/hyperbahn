# Hyperbahn – Bericht P1b (Etappe 0 + Vorlagen-Nachträge)

Stand 26.10.2026 · live: https://drpeterkalmar.github.io/hyperbahn/ (Mechaniken bis **0.1.8**, Bericht 0.1.9; Live-Prüfung hoch + quer: 0 Fehler,
Service-Worker aktiv) · Grundlage: Vorlagen-Datenblatt `~/.hermes/plans/vorlagen/hyperbahn.md` (Clean-Room, nur Mechanik und
Zahlen; im Spiel, in Commits und Texten keine Namen der Vorbilder – hier wie im Datenblatt nur „Vorlage A … G“).

Fünf Releases, jeder einzeln gemessen, getestet, gepusht und live geprüft:

| Version | Etappe | Inhalt |
|---|---|---|
| 0.1.4 | **0** (Peters Wunsch 20.10.) | gehaltenes ↑ senkt in der Luft nie mehr die Nase; Kurzfassung der Megastadt → Rennen ≤ 5 min |
| 0.1.5 | **A** (P1-Nachtrag, Datenblatt Abschn. 4, 1. Punkt) | 1/h-Schwebe-Feder, Luftbremse, Gegenlenken, Wandschaden, Bergungs-Drohne, Landungs-Nicken, Schräglage |
| 0.1.6 | **B** | Energie = Schild = Boost, Boxengasse, Notlauf, Rot-Warnung, Barrel-Roll kostet Energie |
| 0.1.7 | **C** | Flugzeit-Boost mit HUD-Flugmesser, Pads als Boost-Reserve mit Ketten-Deckel |
| 0.1.8 | **D** | Start abgestuft + Drehzahl-Band, KI-Revanche, Seitwärts-Schub, G-Vignette |

Nicht gebaut (laut Datenblatt Phase P2/P3): Seitenstoß, Drehangriff, KO-Bonus, Aufsaugen, Item-Stufen, Waffen-Zeiten,
Explosion bei leerer Energie, Boost-Handicap online, Rein-Modus, Cup-Punkte – als Notiz in `~/.hermes/plans/antigrav-racer.md`.
Weggelassen nach Tabelle bzw. Wirkung < 3: Luftschwerkraft 2,67×, langsamer Gasaufbau, Drift-Meter mit roter Zone,
„Gas-los“-Bonus, Hitze-Meter, 30er-Feld, Bahnkante saugt Energie (Wirkung 2), KI kopiert Start-Boost (Wirkung 2).

## Etappe 0 – kein Abschmieren in der Luft, Rennen ≤ 5 min

**Ursache:** ↑/W war am Boden Gas und in der Luft zugleich „Nase senken“ (1,1 rad/s, solange gehalten). Wer über einen Sprung
einfach Gas hält, drehte die Nase bis −85…−90° unter die Flugbahn → Sturzflug → Abflug. Eine Bedien-Falle.

**Lösung:** (1) Eingabe: ein über den Absprung gehaltenes ↑ bleibt reines Gas; Nicken erst nach einem *neuen* Druck in der Luft
(↑ = Nase runter, ↓ = hoch), Gamepad-Stick genauso. (2) Hülle in der Physik: Nase höchstens 12° unter / 25° über der Flugbahn;
über einer Sprung-Lücke kein Senken mehr, sobald die Wurfparabel die Landezone nicht mehr mit 4 m Reserve erreicht; ab 30–50 m
über der Bahn kein Steigen mehr. (3) Landehilfe: in den letzten 0,9 s vor dem Aufsetzen richtet sich die Nase zur Fahrfläche
aus – nur die Lage, Schub und Auftrieb folgen dabei der Flugbahn (sonst würden Sprünge leichter: Mindesttempo blieb 73/70 m/s).
`?nase=alt` = bisher. Messwerkzeug `node tools/luft_mess.mjs [?nase=alt]` (Tasten laufen durch die echte Eingabe).

| Messung (4 Riesensprünge: Häuserschlucht/Neon-Schlucht, mit/ohne Pad-Kette) | Ziel | vorher (0.1.3) | nachher |
|---|---|---|---|
| ↑ dauerhaft: Abstürze | 0 | **4 von 4** | **0** |
| ↑ dauerhaft: Bauchlandungen | 0 | – (alle abgestürzt) | 0 |
| ↑ dauerhaft: Weite/Airtime | wie neutral | Absturz nach 2,3–2,8 s | = neutral (z. B. 5,43 s / 555 m) |
| Kürzer/Weiter-Spanne (bestes sauberes Ergebnis über ein Halte-Raster) | ≥ 80 % von vorher | 1 198 m | 2 216 m (185 %) |
| Nase bis zum Anschlag (↑ neu 5 s / ↓ 5 s) | – | 4 Abstürze / 2 Abstürze + 2 Bauch | 0 Abstürze, 0 Bauch (2× „hart“ bei 10 s Flug, siehe Grenzen) |
| 2 Runden mit ↑ dauerhaft (KI lenkt, Mittel/Profi) | 0 Abflüge | 4 / 4 | 0 / 0 |
| KI-Gate 8 × 10 Runden | 0 Abflüge | 0 | 0 |

Bildfolge im Browser (echte Tastatur, ↑ gehalten): `docs/bilder/p1b_e0_sprung_hoch_gehalten.jpg` (ruhiger Flug, Landung
„5,4 s · 552 m“) gegen `…_alt.jpg` (`?nase=alt`: Nase −85°, ABFLUG).

**Rennen ≤ 5 min:** Die lange Megastadt (15,8 km) braucht für die KI „Mittel“ ~2:45 je Runde – zwei Runden wären 5:30. Neue
**Kurzfassung** (13,3 km): alle Passagen bleiben (Looping, Korkenzieher-Röhre, Wandfahrt, Überkopf ≥ 500 m, Möbius-Twist,
Tunnel, Steilkurven, beide Riesensprünge samt Pad-Ketten, Rampen und Landezonen *unverändert*); gekürzt sind Geraden, Ausläufe
und Bögen, die halbe Drehung in die Überkopf-Passage liegt jetzt im Anlauf (Querneigung bleibt < 3° je 2 m). Schließ-Parameter
mit `tools/strecke_schliessen.mjs kurz`. Die Rundenzahl ist eine Strecken-Eigenschaft: `rundenFuer(Median-Rundenzeit)` =
so viele Runden, dass Countdown + Startverlust + n Runden ≤ 5:00 (`tools/rundenzeit_mess.mjs`).

| Fassung | Median-Runde KI Mittel | Runden | Rennen inkl. Countdown (Mittel / Profi / Leicht / schnellste KI) |
|---|---|---|---|
| Kurz (Standard) | 135,5 s | 2 | **4:38** / 4:31 / 4:47 / 4:30 |
| Lang (`?strecke=lang`, Menü „Strecke“) | 158,3 s | 1 | 2:43 / 2:41 / 2:48 / 2:38 |
| vorher: lang, 3 Runden | 163–165 s | 3 | ≈ 8:20 |

Menü zeigt „Neon-Megastadt · 2 Runden“ und die Wahl „Kurz · 2 Runden / Lang · 1 Runde“ (Wechsel lädt die Seite neu), HUD
„RUNDE 1/2“. Die alte gespeicherte Einstellung „3 Runden“ wird ignoriert. **Bestzeiten** neu und getrennt je Fassung +
Rundenzahl + Streckenlänge (`hyperbahn-bestzeiten-v2`, Zielanzeige mit „NEU!“) – nichts wird falsch verglichen.

## Messgrößen aus dem Datenblatt (Abschnitt 5): Vorlage / Ziel / vorher / nachher

Werkzeug: `node tools/vorlagen_mess.mjs [regler]` (Node, ohne Browser); „vorher“ = alle neuen Regler aus + lange Strecke
(`docs/mess/vorlagen_vorher.txt`), „nachher“ = Standard 0.1.8 (`docs/mess/vorlagen_nachher.txt`).

| # | Messgröße | Vorlage | Hyperbahn-Ziel | vorher | nachher |
|---|---|---|---|---|---|
| 1 | Schwebe-Ruhelage, Federweg nach Landung aus 10 m | 0,9 × Soll, hart nah am Boden | 1,15–1,25 m; Einfedern ≤ 0,4 m, ruhig ≤ 0,5 s, kein Durchschlag | 1,17 m; 0,03 m (bretthart); 0,06 s | **1,20 m; 0,35 m; 0,35 s; 0 Aufsetzer** |
| 2 | Kurvenradius Top mit/ohne eine Luftbremse | +65 % Gieren | mit ≤ 0,6 × ohne | 0,27 × | 0,32 × |
| 3 | Tempo nach 3 s Dauer-Luftbremse | → 57 % | eine 78–82 %, beide ≈ 45 % | 98 % / 93 % | **80 % / 46 %** |
| 4 | Schiebewinkel beim Bremsen-Drift | τ 2,5 s | max. 15–25°, zurück ≤ 1,2 s | 33,2° / 0,63 s | **24,7° / 0,73 s** |
| 5 | Boosts aus vollem Balken; Boxengasse | 6–7 (15 %) | 8 (12 %); leer → voll 2,5–3,5 s | – | **8; 2,86 s** |
| 6 | Flugzeit-Boost je Riesensprung | Stufen 0,67/1,0/1,5 s | jeder Riesensprung sauber = Stufe 3; Gewinn 0,4–0,7 s | – | **4/4 Stufe 3; +0,55…0,67 s** |
| 7 | Pad-Kette | Deckel +15/19/23 % | 3er-Kette +70–80 %, nie darüber; Reserve ≤ 4 s | +50/80/80 %, 1,3 s | **+50/60/70/80 %, Reserve max. 4,0 s** |
| 8 | Wandtreffer 30° bei Top | Tempo × 0,5 | −15…−25 % Tempo, −4…−8 % Energie | −46 % / −15,7 % | **−19 % / −6,1 %** |
| 9 | Sprung verfehlt | hinter Landezone absetzen | Zeitverlust 2,0–3,0 s, nie vor den Sprung | 1,14 s | **2,87 s**, nie vor den Sprung |
| 10 | KI-Revanche (20 Rennen à 2 Runden) | +27 % / ×2 | Zurück-Überholquote KI Mittel 25–40 % | 11 % (ohne) | **28 %** (ohne: 9 %) |
| 11 | Start-Boost abgestuft | ±0,2 s Fenster | Ø-Stärke Tester Handy 50–70 % | – | KI: Ø 12/33/54 % (leicht/mittel/profi) – **Tester offen** |
| 12 | Seiten-/Drehangriff | – | (P2) | – | nicht gebaut |
| 13 | G-Vignette | rein optisch | in jedem Looping, nie > 35 %, aus mit „Blitze reduzieren“ | – | **beide Looping-Durchfahrten 35 %, max. 35 %, reduziert 0 %** |
| – | Lenkwechsel 60 m/s (Gegenlenken ×2) | Gegenlenken doppelt so schnell | – | Anlenken 0,16 s, Wechsel 0,21 s (sofort) | Anlenken 0,22 s, Wechsel (doppelter Weg) 0,33 s |
| – | Seitwärts-Schub 1 s bei 80 m/s | Strafe ohne Drehung | 6 m/s² quer, kostet kein Tempo | – | 2,1 m Versatz, +0,1 m/s, 0° Drehung |

Wo das Datenblatt einen **unsicheren Startwert** hatte und die Messung anders entschied (alles im Code kommentiert):
- Wandschaden 0,6 %/(m/s) Quertempo widersprach der eigenen Ziel-Messgröße 8 (30° bei Top wären 28 %) → **0,13 %/(m/s)**.
- Flugzeit-Boost Stufe 3: 2,0 s Reserve gab 0,65–0,80 s Gewinn je Sprung (Ziel 0,4–0,7) → **1,5 s**.
- KI-Revanche ×1,5 Beschleunigung gab 55 % Zurück-Überholquote (Ziel 25–40 %) → **nur +8 % Höchsttempo, 3 s** (28 %).
- Luftbremse: Widerstand eine/beide **18 / 40 m/s²** (Ziel 80 % / 45 %); Drift-Seitenhaftung 0,45 → **0,5** (Schiebewinkel 25°).
- Luftbremse „+60 % Gieren“: der vorhandene Wert (+75 % auf der Innenseite, Grundlage des Drifts) erfüllt Messgröße 2 schon
  (0,32 ×) → unverändert gelassen, um das Drift-Gefühl nicht zu verschieben.

**Fahrgefühl-Messgrößen (MK64-Blatt) nach allen Etappen** (`docs/mess/gefuehl_nachher.txt`): alle im Ziel wie vor P1b –
Beschleunigung 1,00/2,58/4,14 s (leicht), Mini-Turbo 0,38/0,50 s, Drift-Quote 100 %, Treffer 0,80 s, Gummiband P1-Abstand
2,5 s, Kamera-Kick +12° in 0,29 s, Kamera-Nachlauf 4,7 % (mit neuer weicher Längs-Grenze 0,5 m, sonst 7,5 % durch die
doppelte Beschleunigung der Reserve).

**KI-Gate** (8 × 10 Runden Kurzfassung, `docs/mess/ki_gate.txt`): 0 Abflüge, 20–21 Sprung-Landungen je Gleiter, Runden
131–144 s, Wandtreffer 1–16 je 10 Runden.

## Was die einzelnen Mechaniken tun (Kurzfassung, Regler je Mechanik; 0/alt = Verhalten bis 0.1.4)

- **1/h-Schwebe-Feder** (`?schwebe=0`): Kraft ∝ (1,3 m / h − 1), weich oben, sehr hart nah am Boden, Dämpfung erst im Federweg;
  Drift-Hüpfer nur aus der Ruhelage (sonst stapelten sich Hüpfer – ein KI-Abflug im Gate, behoben).
- **Luftbremse** (`?bremse=0`, `?rutsch=1.2`): Wirkung baut sich in 0,2 s auf (im Drift sofort, Pump-Rhythmus bleibt), ohne
  Drift gleitet der Gleiter mit Bremse; Bremse im Boost nimmt das Zwangs-Vollgas weg.
- **Gegenlenken** (`?lenk=alt`): Gier-Beschleunigung ≤ 3,5 rad/s², gegen die Drehung ×2, Gierrate ≤ 100°/s.
- **Wandtreffer** (`?wand=0`): nur echte Einschläge kosten, Nase gleitet an der Wand ab.
- **Bergung** (`?bergung=1.5`, 0 = alt): Neon-Drohne mit Zugstrahl hebt den Gleiter, Absetzen hinter der Lücke mit 40 % Tempo
  (`docs/bilder/p1b_a_bergung_drohne.jpg`).
- **Landungs-Nicken** (`?nicken=0`): Landung mit Nase > 20° = „HARTE LANDUNG“, −15 % Tempo.
- **Schräglage** (`?schraeg=0`): Modell rollt mit der Gierrate (12 % je Bild).
- **Energie = Schild = Boost** (`?energie=0`, `?boostkosten=12`, `?box=35`, `?rollkosten=10`): Balken „ENERGIE“; ROLLE-Taste
  zeigt am Boden „⚡ BOOST“ (ab Runde 2; 1-Runden-Rennen ab der Hälfte); Boxengasse = grüne Spur rechts auf der Start-Ziel-
  Geraden (`docs/bilder/p1b_b_boxengasse.jpg`); unter 25 % roter Balken + rote Düse/Lichtspuren (2 Hz, ruhig bei „Blitze
  reduzieren“, `…_energie_warnung.jpg`); 0 % = Notlauf 70 %. KI nutzt Boost (nie vor Magnet/Röhre/Sprung) und Boxengasse.
- **Flugzeit-Boost** (`?flugboost=0`) mit Flugmesser in der Bildmitte (`docs/bilder/p1b_c_flugmesser.jpg`).
- **Reserve/Ketten-Deckel** (`?reserve=4`, 0 = alt).
- **Start** (`?startgrad=0`, `?startband=0`): Idealpunkt 0,25 s vor Grün; Gamepad-RT: Drehzahl-Band mit Anzeige.
- **KI-Revanche** (`?revanche=0`), **Seitwärts-Schub** (`?strafe=0`, Y/X bzw. rechter Stick), **G-Vignette** (`?gvignette=0`).

## Prüfungen

- **Node:** `npm run test:node` – **116/116 grün** (vor P1b 80; neu: `test_luft`, `test_runden`,
  `test_vorlagen_a…d`, angepasst: Start-Test auf abgestuft, Gummiband-Test 3 statt 2 Rennen, Abschnitts-Indizes im
  Bahn-Test). Vor jedem Push lief die Suite zusätzlich nach dem Rebase unter der Push-Sperre.
- **Browser** (ein Browser, `--mute-audio`, WebGL über Metal): `python3 tests/etappe0.py`, `python3 tests/vorlagen_bilder.py`
  – Rauchtest hoch + quer nach jeder Etappe 0 Fehler, keine Touch-Taste < 48 px; Bildfolgen Riesensprung mit ↑, Bergung,
  Wand, Landung, Boxengasse, Rot-Warnung, Flugmesser, Start-Tipp („START-BOOST 74 %“), G-Vignette, Seitwärts-Schub.
- **Bild-Selbstprüfung** (Screenshots selbst angesehen, ein `vision_analyze` gibt es auf diesem Rechner nicht): Flugmesser gut
  lesbar und verdeckt keine Touch-Zone; Boxengasse klar als Lade-Spur erkennbar; Drohne mit Rotor-Ringen und Strahl sichtbar;
  Rot-Warnung erst nach Nachbesserung deutlich (anfangs nur Unterboden – jetzt auch Düse/Lichtspuren); G-Vignette erst nach
  Nachbesserung sichtbar (Verlauf kräftiger, Deckel 35 % bleibt).
- **Leistung** (Mess-Gate-Profil CPU ×4, quer, Mac mini/Metal – kein echtes Handy; 3 Wiederholungen je Stand,
  `tests/perf/2026-10-26_p1b_*`): Pulk p50 5,4–5,7 → 5,4–5,7 ms, Looping 5,2 → 5,4 ms, Sprung 5,2–5,4 → 5,6 ms; p95 jeweils
  im Rauschen (±1 ms). Dreiecke −17 % (kürzere Strecke), Draw-Calls ±5.
- **Live:** nach jeder Etappe `src/version.js?x=$RANDOM` = neue Version (0.1.4 … 0.1.8); Schluss-Prüfung live hoch + quer:
  Version 0.1.8, „Neon-Megastadt · 2 Runden“, HUD 1/2, ENERGIE, ⚡ BOOST, Service-Worker aktiv, 0 Fehler.

## Handy-Testhinweise für Peter

1. **Sprung mit Daumen auf dem Gas** (Tastatur: ↑ halten): Häuserschlucht anfahren und einfach halten – der Gleiter muss ruhig
   fliegen und sauber landen; der Flugmesser zeigt „STUFE 3“, danach „FLUG-BOOST STUFE 3“. Zum Vergleich `?nase=alt`.
2. **Rennlänge:** ein normales Rennen (Leicht, 7 Gegner) sollte bei ~4:30–4:50 enden. Die lange Strecke: Menü „Strecke · Lang“.
3. **Start:** kurz *vor* Grün auf den Bildschirm tippen – Meldung zeigt die Stärke (Ziel am Handy Ø 50–70 %, Messgröße 11
   ist offen, bitte ausprobieren: zu schwer? → `?startgrad=0` ist der alte Tipp auf Grün).
4. **Energie:** ab Runde 2 wird die mittlere Taste am Boden zu „⚡ BOOST“; Wand-Rempler leeren den Balken, die grüne Spur
   rechts nach dem Start-Ziel-Strich lädt. Unter 25 % wird der Gleiter rot.
5. **Bergung:** absichtlich zu langsam über eine Schlucht – die Drohne holt dich, abgesetzt wirst du hinter der Lücke.
6. Mit „⚡ Blitze reduzieren“: keine G-Vignette, Rot-Warnung ohne Puls.

## Grenzen / offen

- Messgröße 11 (Start-Stärke bei Testern) braucht echte Spieler am Handy.
- Wer in der Luft ↓ (Nase hoch) dauerhaft hält, segelt bis zu ~10 s / 1 km und landet in der Steilkurve hinter der Landezone
  „hart“ (Aufsetzer ~9 m/s, kein Absturz, keine Bauchlandung) – Absicht des Spielers, kein Fehler; die Decke begrenzt das.
- Passagen mit Magnet/Röhre sind bis ~120 m/s ausgelegt; ein Mensch, der davor Energie-Boost zündet, kann im Twist kurz
  abheben (wie schon vorher mit Pads, die es dort nicht gibt). Die KI boostet dort nie.
- Sprung verfehlt: 2,87 s Zeitverlust liegt am oberen Rand des Ziels (2–3 s), weil der geschaffte Sprung jetzt den Flug-Boost
  bekommt.
- Mess-Gate nur auf dem Mac (gedrosselt), nicht auf einem echten Android-Handy.
- Mehrspieler/online: KI-Revanche ist offline-only; Energie-Boost, Boxengasse, Flug-Boost gelten online für alle gleich
  (Phase 3 muss sie über die gemeinsame Uhr laufen lassen).

## Dateien

Neu: `tools/luft_mess.mjs`, `tools/rundenzeit_mess.mjs`, `tools/vorlagen_mess.mjs`, `tools/version_heben.py`,
`src/game/bestzeiten.js`, `src/game/gvignette.js`, `src/gfx/drohne.js`, `src/version.js`, `tests/etappe0.py`,
`tests/vorlagen_bilder.py`, `tests/node/test_luft.mjs`, `test_runden.mjs`, `test_vorlagen_a.mjs` … `_d.mjs`; Messprotokolle
`docs/mess/`, Bilder `docs/bilder/p1b_*`. Alle neuen Werte in **einer** Gruppe `VORLAGE` (+ `NASE`) in `src/config.js`.
