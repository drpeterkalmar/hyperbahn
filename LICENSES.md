# Lizenzen und Quellen

| Teil | Quelle | Lizenz |
|---|---|---|
| three.js (`lib/three.*.min.js`, `lib/addons/…`) | three.js r18x, kopiert aus dem Stuntbahn-Repo | MIT (`lib/THREE_LICENSE.txt`) |
| Kino-Look + TAAU (`src/gfx/kinolook.js`, `src/gfx/kern/taau*.js`), Mess-Gate (`tests/perf_gate.py`, `tests/util.py`, `tests/collage.py`) | Stuntbahn (Peters eigener Code) | eigener Code |
| Strecke, Physik, KI, Zeit-Logik, HUD, Minikarte, Stadt, Himmel, Ton (Synthese), Leucht-Teile der Gleiter | eigene Arbeit | eigener Code |
| Icons (`icons/`) | prozedural erzeugt (`tools/make_icons.py`) | eigene Arbeit |

## Gleiter-Modelle (`assets/gleiter/*.glb`)

Von Sketchfab, Lizenz aus der Sketchfab-API gelesen (`license.label` = „CC Attribution“, CC BY 4.0,
http://creativecommons.org/licenses/by/4.0/). Bearbeitet: ausgerichtet, skaliert, Texturen auf 512 px verkleinert
(WebP), Teamfarben per Farbton-Maske im Spiel umgefärbt (`assets_src/blender/gleiter_backen.py`, `src/gfx/gleitermesh.js`).

| Datei (Bauform) | Original | Urheber | Link |
|---|---|---|---|
| `pfeil.glb` (Pfeil) | „Racing spaceship“ | Nikcore (nikcore76) | https://sketchfab.com/3d-models/racing-spaceship-2d554e676c724b82920f208dd80d8a0c |
| `klinge.glb` (Klinge) | „Blue Demon (Space Racer)“ | Mattdude | https://sketchfab.com/3d-models/blue-demon-space-racer-aa32bfaa9b56407b8b8a229cedd5e58a |
| `hammer.glb` (Hammer) | „Racing ship“ | pedrolopezgarcia | https://sketchfab.com/3d-models/racing-ship-7cd18154a5f947ce88e919868e415ce8 |
| `stachel.glb` (Stachel) | „The Arrow“ | totidoki | https://sketchfab.com/3d-models/the-arrow-7413bafdd1c34babae726b72187eed1c |

Im Spiel genannt unter Menü → „Credits“. Bewusst nicht genommen: Modelle, die Fahrzeuge aus WipEout, F-Zero, Star Wars oder
Hot Wheels nachbauen (Marken), auch wenn sie als CC-BY markiert sind.

Namen der Teams/Schriftzüge sind Fantasienamen. Keine fremden Schriften oder Klänge (Ton und Musik werden im Browser
synthetisiert).
