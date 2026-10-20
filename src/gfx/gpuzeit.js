// GPU-Zeit je Bild über EXT_disjoint_timer_query_webgl2 (Mess-Gate, nur mit ?gpu=1): getrennte Abschnitte („szene“ = Kino-Look
// mit allen Durchgängen, „karte“ = Minikarte). Abfragen dürfen nicht verschachtelt sein → Abschnitte nacheinander.
// Ergebnisse kommen 1–3 Bilder später; Mittel über die letzten 60 Werte je Abschnitt.
export class GpuZeit {
  constructor(gl) {
    this.gl = gl; this.ext = gl && gl.getExtension('EXT_disjoint_timer_query_webgl2');
    this.offen = []; this.werte = {}; this.aktiv = null;
  }
  get verfuegbar() { return !!this.ext; }
  start(name) {
    if (!this.ext || this.aktiv) return;
    const q = this.gl.createQuery(); this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.aktiv = { q, name };
  }
  ende() {
    if (!this.aktiv) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.offen.push(this.aktiv); this.aktiv = null;
  }
  // je Bild einmal: fertige Abfragen einsammeln
  sammle() {
    if (!this.ext) return;
    const gl = this.gl, disjunkt = gl.getParameter(this.ext.GPU_DISJOINT_EXT);
    this.offen = this.offen.filter(({ q, name }) => {
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) return true;
      if (!disjunkt) { const ms = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; (this.werte[name] = this.werte[name] || []).push(ms); if (this.werte[name].length > 60) this.werte[name].shift(); }
      gl.deleteQuery(q); return false;
    });
  }
  mittel(name) { const w = this.werte[name]; return w && w.length ? w.reduce((a, b) => a + b, 0) / w.length : null; }
  p95(name) { const w = this.werte[name]; if (!w || !w.length) return null; const s = [...w].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(0.95 * s.length))]; }
}
