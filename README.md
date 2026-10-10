# Hyperbahn

Futuristischer Anti-Grav-Racer im Browser (Neon-Noir, Handy zuerst, Hoch- und Querformat). three.js ohne Build,
ES-Module, PWA über GitHub Pages. Plan: Phasen 1–4 als Queue-Jobs (`~/.hermes/plans/antigrav-racer.md`).

**Stand:** Phase 1 im Aufbau (Vorbau auf Branch `vorbau/hyperbahn-p1-grundspiel`, Abnahme im Browser folgt).

## Steuerung
| Aktion | Tastatur | Touch | Gamepad |
|---|---|---|---|
| Lenken | ← / → (A / D) | linke / rechte Bildschirmhälfte (weiter außen = stärker) | linker Stick |
| Gas | ↑ (W) – auf „Leicht“ automatisch | automatisch | RT |
| Gas weg | ↓ (S) | – | – |
| Luftbremse links / rechts | Q / E | Tasten „◀︎ BREMSE“ / „BREMSE ▶︎“ | LB / RB |
| Barrel-Roll im Sprung (= Turbo) | Leertaste | Taste „⟲ ROLLE“ | A |
| Nase heben / senken (in der Luft) | ↓ / ↑ | – | linker Stick vor/zurück |

Luftbremsen machen Kurven enger (auf der Kurveninnenseite ziehen). Boost-Pads am Boden stapeln sich (Kette = immer
schneller, gedeckelt), Boost-Ringe in der Luft geben Extra-Schub. In Magnet-Abschnitten (violett/cyan pulsierende Streifen)
hält der Gleiter auch langsam kopfüber. Vor jedem Riesensprung zeigt das HUD „SPEED OK“ bzw. „MEHR TEMPO!“.

**Fahrhilfe:** Leicht = Auto-Gas + Lenkzug zur Ideallinie, Mittel = schwacher Lenkzug, Profi = ohne. Hilfen nehmen nie
die Kontrolle weg: deutliches Lenken blendet sie in 0,25 s aus.

**Optionen im Menü:** Fahrhilfe, Gegner (0/3/7), KI-Stärke, 🎬 Action-Momente (Aus/Selten/Oft), ⚡ Blitze reduzieren
(≤ 3 Blitze/s, gedämpfte Strobos – für Lichtempfindliche), Horizont halten (gegen Übelkeit), Ton.

## URL-Regler (A/B-Vergleich)
`?speed=1.2` Höchsttempo · `?mag=1.8` Magnetkraft (g) · `?boost=0.5` Schub je Pad · `?air=0.55` (`?sprung=`) Schwerkraft in
der Luft · `?slowmo=0` Absprung-Zeitlupe aus · `?action=0|1|2` · `?blitze=0` Blitze reduzieren · `?horizont=1` ·
`?hilfe=leicht|mittel|profi` · `?gegner=0…7` · `?ki=leicht|mittel|profi` · `?runden=3` · `?look=0|1|2` Grafikstufe ·
`?kl=-bloom` Kino-Look-Stufen · `?online=1` (Test: Zeit-Logik wie online, nur Schein-Zeitlupe).
Für Tests/Screenshots: `?autostart=1`, `?at=<Abschnitt|Meter>` (fliegender Start), `?autopilot=1`, `?nosw`.

## Tests (ohne Browser)
`npm run test:node` bzw. `node --test tests/node/test_*.mjs` – Strecke (geschlossen, stetig, Pflicht-Passagen),
Schwebe-Physik (Magnethaftung kopfüber, Looping bei 25 m/s und 800 km/h, Boost, Sprünge, Wand), KI-Gate (8 Gleiter ×
10 Runden ohne Abflug), Zeit-Logik/Action-Momente, Fahrhilfe, Kamera, Geometrie, Modul-Rauchtest.
Werkzeuge: `node tools/strecke_plan.mjs` (Grundriss), `node tools/ki_rennen.mjs 10` (KI-Rennen), `node tools/fahrt_probe.mjs`,
`node tools/strecke_schliessen.mjs` (Runde schließen nach Änderungen an Strecke 1).

## Recht
Eigener Name, eigene Teams und Gleiter-Designs; nur Spielmechaniken des Genres. three.js: MIT (`lib/THREE_LICENSE.txt`).
Siehe `LICENSES.md`.
