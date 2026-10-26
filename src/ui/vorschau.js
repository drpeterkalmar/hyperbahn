// Strecken-Vorschau für die Menü-Karten (P2): die ganze Strecke als Neon-Band mit echten Höhen, langsam drehend, schräg
// von oben – wie die 3D-Minikarte, aber als 2D-Canvas (kein eigener WebGL-Kontext je Karte, billig am Handy).
// Farben wie in der Minikarte: Magnet violett, Röhre cyan, Landezone grün, Rest in der Strecken-Farbe; Lücken offen,
// Boost-Pads als gelbe Punkte, Start/Ziel weiß.
import { F_MAGNET, F_LUECKE, F_ROEHRE, F_LANDEZONE } from '../track/bahn.js';

// rein: Punkte der Mittellinie (alle ~12 m) mit Art (0 normal, 1 Magnet, 2 Röhre, 3 Landezone, -1 Lücke), Pads, Mitte, Radius
export function vorschauDaten(bahn, schritt = 12) {
  const k = Math.max(1, Math.round(schritt / bahn.ds)), pts = [];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= bahn.N; i += k) {
    const j = i % bahn.N, f = bahn.flags[j];
    const art = (f & F_LUECKE) ? -1 : (f & F_MAGNET) ? 1 : (f & F_ROEHRE) ? 2 : (f & F_LANDEZONE) ? 3 : 0;
    pts.push(bahn.px[j], bahn.py[j], bahn.pz[j], art);
    x0 = Math.min(x0, bahn.px[j]); x1 = Math.max(x1, bahn.px[j]); z0 = Math.min(z0, bahn.pz[j]); z1 = Math.max(z1, bahn.pz[j]);
    y0 = Math.min(y0, bahn.py[j]); y1 = Math.max(y1, bahn.py[j]);
  }
  const pads = [];
  for (const p of bahn.pads) { const j = Math.round(((p.s0 + p.s1) / 2) / bahn.ds) % bahn.N; pads.push(bahn.px[j], bahn.py[j], bahn.pz[j]); }
  return { pts, pads, mitte: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], radius: Math.max(1, Math.hypot(x1 - x0, z1 - z0) / 2), y0 };
}

const FARBE = ['', 'rgb(190,110,255)', 'rgb(60,240,255)', 'rgb(110,255,140)'];

export class Vorschau {
  constructor(canvas, daten, farbe = '#4af') {
    this.c = canvas; this.d = daten; this.farbe = farbe;
  }

  zeichne(t) {
    const c = this.c, g = c.getContext('2d'), d = this.d;
    if (!g || !d) return;
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const a = t * 0.35, ca = Math.cos(a), sa = Math.sin(a), neig = 0.5, hz = 2.4;
    const sk = Math.min(W, H * 1.6) * 0.46 / d.radius;
    const [mx, my, mz] = d.mitte;
    const proj = (x, y, z, out) => {
      const X = (x - mx) * ca - (z - mz) * sa, Z = (x - mx) * sa + (z - mz) * ca;
      out[0] = W / 2 + X * sk; out[1] = H / 2 + (Z * neig - (y - my) * hz * (1 - neig * 0.5)) * sk * 0.9;
      return out;
    };
    const p = [0, 0], q = [0, 0], pts = d.pts;
    // Schatten auf dem Boden (Tiefen-Hinweis)
    g.lineWidth = 1; g.strokeStyle = 'rgba(80,120,200,0.18)';
    g.beginPath();
    for (let i = 0; i < pts.length; i += 4) { proj(pts[i], d.y0 - 40, pts[i + 2], p); if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }
    g.stroke();
    // Band: Glühen breit, Kern schmal; Segmente nach Art gefärbt, Lücken offen
    for (const [breite, alpha] of [[6, 0.22], [2.2, 1]]) {
      g.lineWidth = breite; g.lineCap = 'round'; g.globalAlpha = alpha;
      for (let i = 4; i < pts.length; i += 4) {
        const art = pts[i + 3], artV = pts[i - 1];
        if (art < 0 || artV < 0) continue;
        proj(pts[i - 4], pts[i - 3], pts[i - 2], p); proj(pts[i], pts[i + 1], pts[i + 2], q);
        g.strokeStyle = art ? FARBE[art] : this.farbe;
        g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
      }
    }
    g.globalAlpha = 1;
    // Pads und Start/Ziel
    g.fillStyle = 'rgb(255,215,40)';
    for (let i = 0; i < d.pads.length; i += 3) { proj(d.pads[i], d.pads[i + 1], d.pads[i + 2], p); g.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); }
    proj(pts[0], pts[1], pts[2], p);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(p[0], p[1], 3.5, 0, Math.PI * 2); g.fill();
  }
}
