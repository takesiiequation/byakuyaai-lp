# -*- coding: utf-8 -*-
"""public/me-icon.png を生成する（512x512）。
依存を増やさないよう zlib+struct だけで PNG を手書きする。
輪郭は 4x スーパーサンプリング + ボックスフィルタでアンチエイリアス。

  python scripts/make_me_icon.py [--out FILE]

意匠: グリーン地に「85% まで閉じたリング」＋中央に "85"。
      リングは「85点」というプロダクト名をそのまま図にしたもの。
      数字はドットフォントでも7セグでもなく、丸ペン先で描いた
      ストローク（線分＋円弧を太らせる）で組み、角を丸めてある。
"""
import struct, zlib, os, sys, math

W = H = 512
SS = 4
OUT = None
if "--out" in sys.argv:
    OUT = sys.argv[sys.argv.index("--out") + 1]

BG = (26, 138, 79)
FG = (250, 251, 250)

ss_w = ss_h = W * SS
mask = bytearray(ss_w * ss_h)


def stamp(cx, cy, r):
    """半径 r の円を塗る（ペン先1打）。"""
    x0, x1 = max(0, int(cx - r)), min(ss_w, int(cx + r) + 1)
    y0, y1 = max(0, int(cy - r)), min(ss_h, int(cy + r) + 1)
    rr = r * r
    for y in range(y0, y1):
        dy = y - cy
        base = y * ss_w
        left = rr - dy * dy
        if left < 0:
            continue
        half = math.sqrt(left)
        for x in range(max(x0, int(cx - half)), min(x1, int(cx + half) + 1)):
            mask[base + x] = 255


def seg(p, q, r):
    """丸ペンで線分を引く（両端キャップ付き）。"""
    (x0, y0), (x1, y1) = p, q
    d = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(d / (r * 0.4)) + 1)
    for i in range(n + 1):
        t = i / n
        stamp(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r)


def arc(cx, cy, rad, a0, a1, r):
    """丸ペンで円弧を引く。角度は 12時起点の時計回り（度）。"""
    length = abs(math.radians(a1 - a0)) * rad
    n = max(3, int(length / (r * 0.4)) + 1)
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        stamp(cx + math.sin(a) * rad, cy - math.cos(a) * rad, r)


# ── 数字（仮想 100 x 150、丸ペンのストローク）─────────────────────
def draw_digit(ch, ox, oy, s, pen):
    """s = 拡大率, pen = ペン半径(px)。"""
    def X(v): return ox + v * s
    def Y(v): return oy + v * s

    if ch == "8":
        # 上下2つの環。Ru+Rl=75 で「接する」ようにして胴のくびれを作る
        # （重ねると中央が塊になって 8 に見えない）。上を小さく、下を
        # 大きくするのは活字の定石。
        arc(X(50), Y(33), 33 * s, 0, 360, pen)
        arc(X(50), Y(108), 42 * s, 0, 360, pen)
    elif ch == "5":
        # 上バー → 左の縦 → 肩 → 下のボウル（右回りに開いた C）
        seg((X(17), Y(7)), (X(87), Y(7)), pen)
        seg((X(17), Y(7)), (X(17), Y(63)), pen)
        seg((X(17), Y(63)), (X(52), Y(58)), pen)
        arc(X(52), Y(102), 44 * s, 2, 252, pen)


def build():
    cx = cy = ss_w / 2.0

    # ── リング（85% まで） ──
    # 角丸マスクで端が欠けないよう、外周を安全域の内側に収める
    ring_r = ss_w * 0.383
    ring_pen = ss_w * 0.030
    arc(cx, cy, ring_r, 0.0, 360.0 * 0.85, ring_pen)
    # 始点・終点を丸く締める
    stamp(cx, cy - ring_r, ring_pen)
    a_end = math.radians(360.0 * 0.85)
    stamp(cx + math.sin(a_end) * ring_r, cy - math.cos(a_end) * ring_r, ring_pen)

    # ── 中央の "85" ──
    GW, GH, GAP = 100.0, 150.0, 26.0
    total_w = GW * 2 + GAP
    s = (ss_w * 0.40) / total_w
    ox0 = (ss_w - total_w * s) / 2.0
    oy0 = (ss_h - GH * s) / 2.0
    pen = 11.5 * s
    for i, ch in enumerate("85"):
        draw_digit(ch, ox0 + i * (GW + GAP) * s, oy0, s, pen)

    # ── ダウンサンプル ──
    px = [[BG for _ in range(W)] for _ in range(H)]
    area = SS * SS * 255.0
    for y in range(H):
        row = px[y]
        for x in range(W):
            acc = 0
            for sy in range(SS):
                base = (y * SS + sy) * ss_w + x * SS
                for sx in range(SS):
                    acc += mask[base + sx]
            if not acc:
                continue
            a = acc / area
            row[x] = (int(BG[0] + (FG[0] - BG[0]) * a),
                      int(BG[1] + (FG[1] - BG[1]) * a),
                      int(BG[2] + (FG[2] - BG[2]) * a))
    return px


def write_png(px, path):
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in px)

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw, 9))
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    return len(png)


root = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
out = OUT or os.path.join(root, "public", "me-icon.png")
print("wrote", out, write_png(build(), out), "bytes")
