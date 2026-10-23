# Hyperbahn – Änderungen

Kurzfassung je Version; Details in den Berichten (`*_BERICHT.md`).

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
