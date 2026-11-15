"""Draws webview-ui/src/assets/cabin.png: the log cabin behind the bottom-left
controls (slate roof, brick chimney with smoke, balcony, window boxes, porch
with lantern, firewood, cobblestone, pines and bushes). Native 70x92, shown
at 2x; colours follow the office scene (maroon ground, near-black pines). Run: python3 scripts/draw-cabin.py"""
from PIL import Image, ImageDraw
import random

W, H = 70, 92
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
px = im.load()

def c(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def put(x, y, col):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = col

def rect(x0, y0, x1, y1, col):  # inclusive
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(x, y, col)

SL_D, SL_M, SL_L = c('#2c2f3a'), c('#4a4e5c'), c('#66a0b0'.replace('66a0b0', '646a7e'))
WD, WD_L, WD_LINE, TRIM, EDGE = c('#b6763b'), c('#cd8a4a'), c('#8a5528'), c('#6b3f1d'), c('#3a2210')
BRICK, MORTAR = c('#a05a44'), c('#d39a80')
GLOW, GLASS = c('#ffd36b'), c('#f2c35a')
G1, G2, G3 = c('#58612f'), c('#434b27'), c('#2f351c')
DIRT, DIRT_L = c('#3a221e'), c('#4a2d27')
PINE, PINE_D = c('#1d1c26'), c('#121118')
FAR, FAR_D = c('#3a2b36'), c('#2e2230')
STONE, STONE_D = c('#9a9a96'), c('#6c6c6a')
LOG_END, PINK, SMOKE = c('#e0ad6c'), c('#c98a96'), c('#ebf0f5', 150)
SIDE, SIDE_L, SIDE_LINE = c('#7d4f2a'), c('#8f5c32'), c('#5e3a1e')

# --- pines flanking the cabin (behind it)
def pine(cx, base, h):
    for i in range(h):
        y = base - i
        half = max(0, (h - i) * 5 // h + (1 if i % 5 < 2 else 0))
        rect(cx - half, y, cx + half, y, PINE if (i // 3) % 2 == 0 else PINE_D)
    rect(cx, base, cx, base + 2, TRIM)
def far_pine(cx, base, h):
    for i in range(h):
        half = max(0, (h - i) * 3 // h)
        rect(cx - half, base - i, cx + half, base - i, FAR if (i // 3) % 2 == 0 else FAR_D)

# --- chimney + smoke (behind the roof)
rect(14, 8, 20, 24, BRICK)
for y in range(8, 25, 3):
    rect(14, y, 20, y, MORTAR)
for y in range(8, 25):
    put(14 + ((y // 3) % 2) * 3, y, MORTAR)
rect(13, 7, 21, 8, EDGE)
for (x, y) in [(16, 4), (17, 3), (18, 1), (17, 0)]:
    rect(x, y, x + 1, y + 1, SMOKE)

# --- roof gable: slate band along both slopes, wood gable inside
APX, TOP, EAVE = 29, 8, 26
for y in range(TOP, EAVE + 1):
    half = int((y - TOP) * 1.5)
    for x in range(APX - half, APX + half + 1):
        d = half - abs(x - APX)
        if d < 5:  # slate band
            shade = SL_M if ((x + y) // 2) % 2 == 0 else SL_D
            if d == 0:
                shade = SL_L
            put(x, y, shade)
        else:  # gable wall
            put(x, y, WD if (x % 4) else WD_LINE)
rect(2, EAVE, 56, EAVE + 1, SL_D)
# gable window
rect(25, 15, 33, 23, TRIM)
rect(26, 16, 32, 22, GLASS)
rect(29, 16, 29, 22, TRIM)
rect(26, 19, 32, 19, TRIM)
rect(24, 24, 34, 24, TRIM)

def planks(x0, y0, x1, y1):
    rect(x0, y0, x1, y1, WD)
    for y in range(y0 + 3, y1 + 1, 4):
        rect(x0, y, x1, y, WD_LINE)
    for y in range(y0, y1 + 1, 4):
        rect(x0, y, x1, y, WD_L)
    rect(x0, y0, x0 + 1, y1, TRIM)  # corner posts
    rect(x1 - 1, y0, x1, y1, TRIM)

def window(x0, y0, box=False):
    rect(x0 - 1, y0 - 1, x0 + 6, y0 + 8, TRIM)
    rect(x0, y0, x0 + 5, y0 + 7, GLASS)
    rect(x0 + 2, y0, x0 + 3, y0 + 7, TRIM)
    rect(x0, y0 + 3, x0 + 5, y0 + 4, TRIM)
    if box:
        rect(x0 - 2, y0 + 8, x0 + 7, y0 + 10, TRIM)
        rect(x0 - 1, y0 + 8, x0 + 6, y0 + 8, G2)
        for fx in range(x0 - 1, x0 + 7, 2):
            put(fx, y0 + 8, PINK)
            put(fx + 1, y0 + 8, G1)

# --- 3/4 view: shaded right side wall and the roof plane receding behind it
d = ImageDraw.Draw(im)
d.polygon([(31, 8), (41, 6), (61, 25), (54, 26)], fill=SL_D)
for k in range(0, 20, 3):  # shingle courses along the receding roof
    d.line([(31 + k * 1.0, 9 + k * 0.8), (41 + k * 1.0, 7 + k * 0.9)], fill=SL_M)
# one continuous wall from the roof to the ground; its foot rises a little as
# it recedes, and the corner post closes it at the far end
for x in range(48, 60):
    bot = 84 - int((x - 48) * 0.3)
    for y in range(26, bot + 1):
        put(x, y, SIDE_L if y % 4 == 0 else (SIDE_LINE if y % 4 == 3 else SIDE))
    put(x, bot + 1, EDGE)
rect(59, 26, 60, 81, TRIM)
rect(48, 49, 60, 50, EDGE)
for y in range(65, 70):
    for x in range(48, 62):
        put(x, y, SL_D if ((x // 2 + y) % 2 == 0) else c('#232530'))
rect(48, 69, 61, 69, EDGE)

# --- top floor
planks(10, EAVE + 2, 47, 42)
window(13, 30)
# --- balcony railing + deck
rect(6, 43, 51, 43, TRIM)
for x in range(7, 51, 4):
    rect(x, 44, x + 1, 48, TRIM)
rect(5, 49, 52, 50, EDGE)
rect(5, 49, 52, 49, TRIM)
# --- middle floor
planks(10, 51, 47, 64)
window(13, 54, box=True)
# --- porch roof (wide slate eave)
for y in range(65, 70):
    for x in range(3, 55):
        rect(x, y, x, y, SL_M if ((x // 2 + y) % 2 == 0) else SL_D)
rect(3, 69, 54, 69, EDGE)
# --- ground floor + porch
planks(12, 70, 45, 84)
rect(10, 70, 12, 86, TRIM)   # porch posts
rect(45, 70, 47, 86, TRIM)
rect(8, 79, 49, 80, TRIM)    # porch rail top
for x in range(9, 49, 4):
    rect(x, 81, x + 1, 85, TRIM)
rect(8, 86, 49, 87, EDGE)
# lantern
rect(53, 70, 53, 71, EDGE)
rect(52, 72, 54, 75, GLOW)
rect(51, 71, 55, 71, EDGE)
for (dx, dy) in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
    pass
for y in range(70, 78):
    for x in range(49, 58):
        if px[x, y][3] and px[x, y] in (SIDE, SIDE_L):
            px[x, y] = c('#e0a050')

# --- ground: grass, firewood, cobble path, bushes, rock
rect(0, 86, W - 1, 91, DIRT)
random.seed(7)
for x in range(W):
    for y in range(86, 92):
        if random.random() < .18:
            put(x, y, DIRT_L)
    if random.random() < .55:
        put(x, 86, G2)
    if random.random() < .35:
        put(x, 87, G1)
    if random.random() < .25:
        put(x, 88, G3)
for y in range(86, 91):
    for x in range(8 + (y - 86), 62 - (y - 86)):
        if px[x, y][3] and px[x, y] in (DIRT, DIRT_L, G1, G2, G3):
            r, g, b, a = px[x, y]
            put(x, y, (r * 6 // 10, g * 6 // 10, b * 6 // 10, 255))
# firewood stack (log ends) bottom-left
for r in range(3):
    for k in range(4 - r):
        cx, cy = 12 + k * 4 + r * 2, 86 - r * 3
        rect(cx - 1, cy - 1, cx + 1, cy + 1, TRIM)
        put(cx, cy, LOG_END)
# cobble path bottom-right
for r in range(3):
    for k in range(5):
        x0 = 30 + k * 5 + (r % 2) * 2
        y0 = 87 + r * 2
        if y0 + 1 < H and x0 + 3 < W:
            rect(x0, y0, x0 + 3, min(y0 + 1, H - 1), STONE if (k + r) % 2 else STONE_D)
# bushes with flowers, corners
def bush(cx, cy, r, flowers=True):
    for y in range(cy - r, cy + 1):
        for x in range(cx - r, cx + r + 1):
            if (x - cx) ** 2 + ((y - cy) * 1.6) ** 2 <= r * r:
                put(x, y, G1 if (x + y) % 3 else G2)
    if flowers:
        for (dx, dy) in [(-2, -1), (1, -2), (2, 0)]:
            put(cx + dx, cy + dy, PINK)
bush(5, 88, 4)
bush(63, 88, 4)
bush(52, 88, 3, False)
# rock
rect(24, 87, 28, 88, STONE)
rect(25, 86, 27, 86, STONE)
put(24, 88, STONE_D)

for y in range(H):
    f = 1.0 - 0.28 * max(0, y - 30) / (H - 30)
    for x in range(W):
        r, g, b, a = px[x, y]
        if a and (r, g, b) not in ((255, 211, 107), (242, 195, 90), (201, 154, 60)):
            px[x, y] = (int(r * f), int(g * f * 0.97), int(b * f * 0.94), a)

im.save('webview-ui/src/assets/cabin.png')
print('ok')
