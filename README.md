# Hyperbahn

Futuristischer Anti-Grav-Racer im Browser (Neon-Noir, Handy zuerst, Hoch- und Querformat). three.js ohne Build,
ES-Module, PWA über GitHub Pages. Plan: Phasen 1–4 als Queue-Jobs (`~/.hermes/plans/antigrav-racer.md`).

**Spielen:** https://drpeterkalmar.github.io/hyperbahn/ (als App installierbar, offline spielbar)

**Stand:** Phase 1 fertig (Schwebe-Physik mit Magnethaftung, Strecke „Neon-Megastadt“, Neon-Noir-Look, 7 KI-Gegner,
3D-Minikarte, Musik) – Bericht: `PHASE1_BERICHT.md`. Nächste Phasen: Items/Waffen, Strecken-Generator + Cups, Online.
P1b (Vorlagen-Nachträge): Änderungen je Version in `CHANGELOG.md`, Bericht `P1B_VORLAGEN_BERICHT.md`.

## Steuerung
| Aktion | Tastatur | Touch | Gamepad |
|---|---|---|---|
| Lenken | ← / → (A / D) | linke / rechte Bildschirmhälfte (weiter außen = stärker) | linker Stick |
| Gas | ↑ (W) – auf „Leicht“ automatisch | automatisch | RT |
| Gas weg | ↓ (S) | – | – |
| Luftbremse links / rechts | Q / E | Tasten „◀︎ BREMSE“ / „BREMSE ▶︎“ | LB / RB |
| Barrel-Roll im Sprung (Turbo nach der Landung, kostet 10 % Energie) | Leertaste | Taste „⟲ ROLLE“ | A |
| Energie-Boost am Boden (ab Runde 2, kostet 12 %) | Leertaste | dieselbe Taste („⚡ BOOST“) | A / X |
| Seitwärts-Schub | Y / X (QWERTY: Z / X) | – (Luftbremsen) | rechter Stick seitlich |
| Nase heben / senken (in der Luft) | ↓ / ↑ neu drücken (über den Absprung gehaltenes ↑ bleibt Gas) | – | linker Stick zurück/vor |

**Drift + Mini-Turbo:** In der Kurve die Luftbremse auf der Innenseite halten = Rutschen. Kurz lösen und wieder ziehen
(„pumpen“) hebt die Funkenstufe (cyan → magenta → weiß-gold); loslassen ab Stufe 2 gibt einen Turbo-Schub. Zu lange
halten (> 1,7 s) lässt die Stufe verfallen. **Start-Boost:** Gas kurz **vor** „Grün“ antippen (Touch: Finger auf den
Bildschirm) – am stärksten 0,25 s vor Grün (100 %, „PERFEKTER START!“), am Rand des Fensters (±0,2 s) noch 30 %; wer schon
lange vorher Vollgas gibt, überdreht. Mit Gamepad-Gas (RT) gilt das Drehzahl-Band: bei Grün 85–90 % halten. **Treffer** (ab Phase 2): beide Luftbremsen ziehen fängt
den Gleiter ab; im Dreher 5× schnell Gas tippen = Neustart-Schub. **Gleiter-Klassen:** Leicht (spritzig), Mittel, Schwer
(oben stark, rammt). Fahrgefühl inspiriert von klassischen Fun-Racern der 90er.

**In der Luft:** Gas einfach halten – die Nase bleibt dann auf der Flugbahn, der Gleiter landet sauber. Wer nicken will,
drückt in der Luft neu: ↓ = Nase hoch (weiter), ↑ = Nase runter (kürzer). Eine Hülle verhindert Sturzflug und Absturz in
die Schlucht, kurz vor dem Aufsetzen richtet die Landehilfe die Nase zur Bahn aus.

**Energie:** Ein Balken ist Schild und Boost zugleich. Wandtreffer und Rempler kosten Energie, ab Runde 2 gibt die
Boost-Taste am Boden +35 % Tempo für 1,6 s (12 %), eine Barrel-Roll im Sprung kostet 10 % und zündet bei der Landung einen
Turbo. Aufladen in der grünen Boxengasse rechts auf der Start-Ziel-Geraden (leer → voll ≈ 3 s). Unter 25 % glüht der Gleiter
rot, bei 0 % läuft er nur noch im Notlauf (70 % Tempo).

**Flug-Boost:** Wer nach einem Sprung sauber landet (Nase gerade), bekommt je nach Flugzeit Stufe 1–3 Boost – der
Flugmesser in der Bildmitte zeigt Flugzeit und Stufe. **Pad-Ketten** sammeln Boost-Zeit (bis 4 s) und werden mit jedem Pad
schneller (+50 → +80 %).

**Abflug:** Eine Bergungs-Drohne holt den Gleiter in 1,5 s zurück; wer einen Sprung nicht schafft, wird hinter der Lücke
abgesetzt. Wandtreffer bremsen je nach Winkel (−10…−30 %), der Gleiter gleitet an der Wand ab. Luftbremse geradeaus
gehalten bremst kräftig (eine ≈ 80 %, beide ≈ 45 % Tempo).

**Strecken (P2):** im Menü als Karten mit drehender Vorschau wählen (Tippen), 🔗 teilt einen Link direkt zur Strecke.
Jedes Rennen dauert höchstens 5 Minuten (Rundenzahl je Strecke). Bestzeiten werden je Strecke, Fassung und Rundenzahl gemerkt.

| Strecke | Charakter | Runde (KI Mittel) | Runden |
|---|---|---|---|
| Neon-Megastadt (Kurz / Lang) | Allrounder: Looping, Röhre, Wandfahrt, Überkopf, zwei Riesensprünge | 2:15 / 2:38 | 2 / 1 |
| Wüsten-Raumhafen | Vollgas: lange Geraden, Boost-Ketten, weite Bögen, Riesensprung über das Raketensilo | 1:28 | 3 |
| Gewitter-Pass | Sprünge: Serpentinen-Haarnadeln, Grat-Abkürzung ohne Bande, Kamm, Scharte, Talsprung, Blitze | 1:32 | 3 |
| Riff-Röhre | Technik: Glasröhren unter Wasser, Korkenzieher, Überkopf-Röhre, Gabelung (innen eng ohne Bande + Pads) | 1:30 | 3 |

„🎲 Zufällig“ wählt nie zweimal hintereinander dieselbe Strecke.

Luftbremsen machen Kurven enger (auf der Kurveninnenseite ziehen). Boost-Pads am Boden stapeln sich (Kette = immer
schneller, gedeckelt), Boost-Ringe in der Luft geben Extra-Schub. In Magnet-Abschnitten (violett/cyan pulsierende Streifen)
hält der Gleiter auch langsam kopfüber. Vor jedem Riesensprung zeigt das HUD „SPEED OK“ bzw. „MEHR TEMPO!“.

**Fahrhilfe:** Leicht = Auto-Gas + Lenkzug zur Ideallinie, Mittel = schwacher Lenkzug, Profi = ohne. Hilfen nehmen nie
die Kontrolle weg: deutliches Lenken blendet sie in 0,25 s aus.

**Optionen im Menü:** Fahrhilfe, Gleiter-Klasse, Gegner (0/3/7), KI-Stärke, 🎬 Action-Momente (Aus/Selten/Oft),
⚡ Blitze reduzieren (≤ 3 Blitze/s, gedämpfte Strobos – für Lichtempfindliche), Horizont halten (gegen Übelkeit), Ton,
Minikarte (3D/2D/Aus), Karte mitdrehend oder Norden oben, Credits. **Pause** (❚❚ oben rechts) → WEITER oder NEU STARTEN.

**Minikarte:** oben links die ganze Strecke als Neon-Band mit echten Höhen (Looping, Röhre, Wandfahrt, Sprung-Lücken offen,
Magnet-Abschnitte pulsieren, Boost-Pads gelb). Eigener Gleiter = gelber Pfeil, Gegner = Punkte in Teamfarbe, Führender mit
weißem Ring. Antippen = groß/klein.

## URL-Regler (A/B-Vergleich)
`?speed=1.2` Höchsttempo · `?mag=1.8` Magnetkraft (g) · `?boost=0.5` Schub je Pad · `?air=0.55` (`?sprung=`) Schwerkraft in
der Luft · `?slowmo=0` Absprung-Zeitlupe aus · `?action=0|1|2` · `?blitze=0` Blitze reduzieren · `?horizont=1` ·
`?hilfe=leicht|mittel|profi` · `?gegner=0…7` · `?ki=leicht|mittel|profi` · `?runden=2` (Standard: je Strecke, Rennen ≤ 5 min) ·
`?strecke=megastadt|wueste|riff|gebirge|lang|zufall` (Strecke; `lang` = lange Megastadt, 1 Runde) · `?nase=alt` (Nase in der Luft wie bis 0.1.3) · `?look=0|1|2` Grafikstufe ·
`?kl=-bloom` Kino-Look-Stufen · `?streak=1.2` Neon-Linsen-Streifen (0 = aus) · `?blur=0.3` Bewegungsunschärfe ·
`?tacho=1.9` Anzeige-Faktor km/h · `?karte=3d|2d|aus` · `?kartenord=1` · `?startplatz=1…8` (Standard 6) ·
`?online=1` (Test: Zeit-Logik wie online, nur Schein-Zeitlupe) · `?gpu=1` GPU-Zeit messen (Mess-Gate).
Fahrgefühl: `?klasse=leicht|mittel|schwer` · `?beschl=1` · `?gewicht=0` (alle gleich) · `?kurve=0.01` · `?lenk=1` ·
`?drift=1` (Mini-Turbo-Schub) · `?mtzeit=0.3` · `?hupf=0` · `?startfenster=0.25` · `?rand=0.3` (Störfeld am Rand) ·
`?landebonus=0.1` · `?treffer=1` · `?neustart=0` · `?stoss=0.85` · `?gummiband=0|1|2` · `?fov=62` · `?fovboost=12` ·
`?items=hb|ref` (Phase 2).
Vorlagen-Mechaniken (P1b, je 0/alt = bisher): `?schwebe=0` (1/h-Feder) · `?bremse=0` / `?rutsch=1.2` (Luftbremse) ·
`?lenk=alt` (Gegenlenken) · `?wand=0` (Wandschaden) · `?bergung=1.5` (Bergungs-Drohne, s) · `?nicken=0` (harte Landung) ·
`?schraeg=0` (Schräglage) · `?energie=0` (Energie/Boxengasse aus) · `?boostkosten=12` · `?box=35` (%/s) · `?rollkosten=10` · `?flugboost=0` · `?reserve=4` (s, 0 = bisher) · `?startgrad=0` · `?startband=0` · `?revanche=0` · `?strafe=0` · `?gvignette=0`.
Für Tests/Screenshots: `?autostart=1`, `?at=<Abschnitt|Meter>` (fliegender Start), `?autopilot=1`, `?nosw`.

## Tests (ohne Browser)
`npm run test:node` bzw. `node --test tests/node/test_*.mjs` – Strecke (geschlossen, stetig, Pflicht-Passagen),
Schwebe-Physik (Magnethaftung kopfüber, Looping bei 25 m/s und 800 km/h, Boost, Sprünge, Wand), KI-Gate (8 Gleiter ×
10 Runden ohne Abflug), Zeit-Logik/Action-Momente, Fahrhilfe, Kamera, Geometrie, Modul-Rauchtest.
Werkzeuge: `node tools/gefuehl_mess.mjs` (14 Fahrgefühl-Messgrößen als Tabelle), `node tools/luft_mess.mjs [?nase=alt]`
(Spieler-Profile über die Riesensprünge), `node tools/rundenzeit_mess.mjs` (Rundenzeit je Fassung → Rundenzahl), `node tools/vorlagen_mess.mjs [regler]`
(Messgrößen des Vorlagen-Datenblatts), `node tools/strecke_plan.mjs` (Grundriss), `node tools/ki_rennen.mjs 10` (KI-Rennen), `node tools/fahrt_probe.mjs`,
`node tools/strecke_schliessen.mjs` (Runde schließen nach Änderungen an Strecke 1).

## Tests im Browser (ein Browser, stumm)
`python3 tests/smoke.py` (Laden, Rennen, 0 Fehler) · `python3 tests/etappe0.py` (Rauchtest hoch + quer, Bildfolge
Riesensprung mit gehaltenem ↑, neu und `?nase=alt`) · `python3 tests/vorlagen_bilder.py` (Rauchtest + Bildfolgen der
P1b-Mechaniken) · `python3 tests/p1_shots.py [--nur looping,sprung1]` (Abnahme-Bilder
hoch + quer aller Passagen, Bullet-Time-Bildfolge, Collagen) · `python3 tests/test_eingabe_zeitlupe.py` (Lenken wirkt in der
Bullet-Time) · `python3 tests/perf_gate.py --szenen tests/perf_szenen.json --stand <name>` (Mess-Gate Mittelklasse-Android).
Konsole: `__hb.galerie()` zeigt alle Gleiter nebeneinander, `__hb.moment('sprungScheitel')` erzwingt eine Bullet-Time.
`node tools/action_mess.mjs` misst die Häufigkeit der Action-Momente je Rennen.

## Recht
Eigener Name, eigene Teams; nur Spielmechaniken des Genres. Gleiter-Modelle von Sketchfab (CC BY 4.0: Nikcore, Mattdude,
pedrolopezgarcia, totidoki), Musik „Cyber Runner“ von ansimuz (CC0). three.js: MIT. Einzelheiten in `LICENSES.md`, im Spiel
unter „Credits“.
