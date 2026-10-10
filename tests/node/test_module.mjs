// Modul-Rauchtest ohne Browser: alle src-Module laden (three über den Lade-Haken), und für main.js (braucht DOM) alle
// statischen + dynamischen Importe/benannten Exporte prüfen – fängt Tippfehler, bevor der Heavy-Job den Browser startet.
// Aufruf: node --test tests/node/test_module.mjs
import './three_haken.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src');
const alle = [];
(function lauf(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) lauf(p); else if (f.endsWith('.js')) alle.push(p); } })(SRC);

test('alle Module außer main.js laden ohne Fehler', async () => {
  for (const p of alle) {
    if (p.endsWith('main.js')) continue;
    await import(pathToFileURL(p).href);
  }
  assert.ok(alle.length > 20, `${alle.length} Module`);
});

test('main.js: alle importierten Namen existieren (statisch + dynamisch)', async () => {
  const quelle = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');
  const re = /import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g;
  let m, n = 0;
  while ((m = re.exec(quelle))) {
    const mod = await import(pathToFileURL(path.join(SRC, m[2])).href);
    for (const name of m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
      assert.ok(name in mod, `${m[2]} exportiert ${name} nicht`);
      n++;
    }
  }
  const dyn = { './gfx/stadt.js': 'baueStadt', './gfx/regen.js': 'Regen', './audio/ton.js': 'Ton' };
  for (const [datei, name] of Object.entries(dyn)) {
    assert.ok(quelle.includes(`import('${datei}')`), `main.js lädt ${datei}`);
    const p = path.join(SRC, datei);
    assert.ok(fs.existsSync(p), `${datei} fehlt`);
    const mod = await import(pathToFileURL(p).href);
    assert.ok(name in mod, `${datei} exportiert ${name} nicht`);
  }
  assert.ok(n > 25);
});

test('index.html und Manifest: Importmap, Hoch+Quer, Icons vorhanden', () => {
  const root = path.join(SRC, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(html.includes('"three": "./lib/three.module.min.js"') && html.includes('src/main.js'));
  const man = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(man.orientation, 'any');
  for (const i of man.icons) assert.ok(fs.existsSync(path.join(root, i.src)), `${i.src} fehlt`);
});
