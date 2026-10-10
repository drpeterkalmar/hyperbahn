# Erzeugt die PWA-Icons prozedural (reines Python: zlib + struct, kein PIL): dunkler Grund, Neon-Bahn-Schwung in Cyan/Magenta
# mit weichem Leuchten, Gleiter-Pfeil in Weiß. Maskable-Variante mit Sicherheitsrand (Motiv in den inneren 80 %).
# Aufruf: py tools/make_icons.py   → icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
import os, math, zlib, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')

def png(path, w, h, px):
    roh = b''.join(b'\x00' + bytes(px[y * w * 3:(y + 1) * w * 3]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(roh, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

def bild(n, rand=0.0):
    px = bytearray(n * n * 3)
    s = 1.0 - 2 * rand   # Motiv-Skala (maskable: kleiner)
    for y in range(n):
        for x in range(n):
            u = (x + 0.5) / n * 2 - 1; v = (y + 0.5) / n * 2 - 1
            u /= s; v /= s
            # Grund: Verlauf dunkelviolett → schwarz
            r, g, b = 0.03 + 0.05 * (1 - v) / 2, 0.02, 0.06 + 0.06 * (1 - v) / 2
            # Neon-Bahn: zwei Bögen (Cyan außen, Magenta innen) als Schwung von unten links nach oben rechts
            for (rad, col, dick) in ((0.95, (0.0, 0.9, 1.0), 0.07), (0.72, (1.0, 0.17, 0.84), 0.06)):
                cx, cy = -0.55, 0.85
                d = abs(math.hypot(u - cx, v - cy) - rad * 1.35)
                # weich ein-/ausblenden statt harter Kante (links und unten)
                blende = max(0.0, min(1.0, (u - cx + 0.45) / 0.6)) * max(0.0, min(1.0, (cy - v + 0.45) / 0.6))
                if blende > 0:
                    kern = max(0.0, 1 - d / dick)
                    glow = math.exp(-(d / (dick * 3.2)) ** 2) * 0.55
                    k = min(1.0, kern * 1.4 + glow) * blende
                    r += col[0] * k; g += col[1] * k; b += col[2] * k
            # Gleiter-Pfeil (Dreieck) in Weiß mit Cyan-Saum, Spitze nach oben rechts
            ax, ay = u * 0.7071 + v * 0.7071, -u * 0.7071 + v * 0.7071   # um 45° gedreht
            tx, ty = ax + 0.05, ay + 0.0
            inDreieck = -0.42 < tx < 0.32 and abs(ty) < (0.32 - tx) * 0.42
            if inDreieck:
                r, g, b = 0.95, 0.98, 1.0
            else:
                rd = abs(ty) - (0.32 - tx) * 0.42
                if -0.42 < tx < 0.36 and 0 < rd < 0.05:
                    k = 1 - rd / 0.05
                    r += 0.0 * k; g += 0.8 * k; b += 1.0 * k
            px[(y * n + x) * 3:(y * n + x) * 3 + 3] = bytes(int(max(0, min(1, c)) ** (1 / 1.1) * 255) for c in (r, g, b))
    return px

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, n, rand in (('icon-192.png', 192, 0.0), ('icon-512.png', 512, 0.0), ('icon-maskable-512.png', 512, 0.1), ('apple-touch-icon.png', 180, 0.0)):
        p = os.path.join(OUT, name)
        png(p, n, n, bild(n, rand))
        print(name, os.path.getsize(p), 'Bytes')
