# -*- coding: utf-8 -*-
"""public/me-icon.png を生成する（512x512・緑地に "85"）。
依存を増やさないよう zlib+struct だけで PNG を手書きする。
字形はドットフォントではなく矩形ストロークで組み、拡大しても粗く見えないようにする。"""
import struct, zlib, os

W = H = 512
BG = (30, 158, 90)     # --acc
FG = (246, 247, 246)   # --bg (light)

# 仮想座標: 1文字 = 幅100 x 高さ150、ストローク幅 s
GW, GH, S = 100.0, 150.0, 21.0


def rects(ch):
    """(x0,y0,x1,y1) を仮想座標で返す。7セグ風の矩形ストローク。"""
    m = GW - S
    if ch == "8":
        mid = GH / 2
        return [
            (0, 0, GW, S),                       # 上バー
            (0, 0, S, mid),                      # 左上
            (m, 0, GW, mid),                     # 右上
            (0, mid - S / 2, GW, mid + S / 2),   # 中バー
            (0, mid, S, GH),                     # 左下
            (m, mid, GW, GH),                    # 右下
            (0, GH - S, GW, GH),                 # 下バー
        ]
    if ch == "5":
        mid = GH / 2
        return [
            (0, 0, GW, S),                       # 上バー
            (0, 0, S, mid + S / 2),              # 左上
            (0, mid - S / 2, GW, mid + S / 2),   # 中バー
            (m, mid, GW, GH),                    # 右下
            (0, GH - S, GW, GH),                 # 下バー
        ]
    return []


px = [[BG for _ in range(W)] for _ in range(H)]

GAP = 20.0
total_w = GW * 2 + GAP
scale = (W * 0.60) / total_w          # 文字塊が画像幅の60%
ox0 = (W - total_w * scale) / 2.0
oy0 = (H - GH * scale) / 2.0

for gi, ch in enumerate("85"):
    ox = ox0 + gi * (GW + GAP) * scale
    for (x0, y0, x1, y1) in rects(ch):
        ax0 = int(round(ox + x0 * scale))
        ay0 = int(round(oy0 + y0 * scale))
        ax1 = int(round(ox + x1 * scale))
        ay1 = int(round(oy0 + y1 * scale))
        for y in range(max(0, ay0), min(H, ay1)):
            row = px[y]
            for x in range(max(0, ax0), min(W, ax1)):
                row[x] = FG

raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in px)


def chunk(tag: bytes, data: bytes) -> bytes:
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9))
       + chunk(b"IEND", b""))

out = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "public", "me-icon.png"))
with open(out, "wb") as f:
    f.write(png)
print("wrote", out, len(png), "bytes")
