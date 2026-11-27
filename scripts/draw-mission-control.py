"""Draws the mission control furniture sprites:

- MISSION_SCREEN (112x32, 7x2 tiles, wall): a framed dark screen with a faint world map and orbit
  tracks. The five status counts are drawn live by the renderer (engine/missionScreen.ts).
- MISSION_DESK (48x32, 3x2 tiles with one background row, so 3x1 solid): the plain desk with a
  raised console of four small CRTs and the office PC at its right end. OFF plus three ON frames.

Run: python3 scripts/draw-mission-control.py"""
import math
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'webview-ui', 'public', 'assets', 'furniture')


def c(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def rect(px, x0, y0, x1, y1, col):  # inclusive
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[x, y] = col


# ── MISSION_SCREEN ──────────────────────────────────────────────
def draw_screen():
    W, H = 112, 32
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    EDGE, FRAME, FRAME_L, FRAME_D = c('#394449'), c('#73787e'), c('#9aa0a6'), c('#555a60')
    BG, MAP, TRACK, TICK = c('#10121c'), c('#3a2148'), c('#1d4a2c'), c('#3c4152')
    rect(px, 0, 0, W - 1, H - 1, EDGE)
    rect(px, 1, 1, W - 2, H - 2, FRAME)
    rect(px, 1, 1, W - 2, 1, FRAME_L)
    rect(px, 1, H - 2, W - 2, H - 2, FRAME_D)
    rect(px, 2, 2, W - 3, H - 3, EDGE)
    rect(px, 3, 3, W - 4, H - 4, BG)
    # a rough world map: continent outlines as short runs, kept dim under the digits
    continents = [
        # (y, x-runs) in screen pixels
        (7, [(12, 22), (50, 56), (62, 84)]),
        (8, [(9, 24), (48, 58), (60, 90)]),
        (9, [(10, 23), (47, 57), (61, 92)]),
        (10, [(13, 22), (49, 55), (63, 90)]),
        (11, [(15, 21), (50, 58), (66, 88)]),
        (12, [(17, 21), (49, 59), (70, 86)]),
        (13, [(19, 23), (49, 60), (74, 84)]),
        (14, [(21, 27), (50, 60), (77, 82)]),
        (15, [(22, 29), (52, 59), (84, 88)]),
        (16, [(22, 29), (53, 58), (86, 96)]),
        (17, [(23, 28), (53, 57), (88, 98)]),
        (18, [(23, 27), (54, 56), (89, 98)]),
        (19, [(24, 26), (91, 96)]),
        (20, [(24, 25)]),
    ]
    filled = set()
    for y, runs in continents:
        for x0, x1 in runs:
            for x in range(x0, x1 + 1):
                filled.add((x, y))
    for x, y in filled:  # outline only
        if any((x + dx, y + dy) not in filled for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            px[x, y] = MAP
    # two orbit ground tracks
    for phase in (0.0, 1.3):
        for x in range(3, W - 3):
            y = round(15.5 + 8 * math.sin(x / 17.0 + phase))
            if 4 <= y <= H - 5:
                px[x, y] = TRACK
    # readout ticks in the top corners
    for x0 in (5, 9, 14):
        rect(px, x0, 4, x0 + 2, 4, TICK)
    for x0 in (95, 100, 104):
        rect(px, x0, 4, x0 + 2, 4, TICK)
    out = os.path.join(ROOT, 'MISSION_SCREEN')
    os.makedirs(out, exist_ok=True)
    im.save(os.path.join(out, 'MISSION_SCREEN.png'))


# ── MISSION_DESK ────────────────────────────────────────────────
def draw_desk(state, frame):
    """state 'off' or 'on'; frame 0..2 picks the blinking lights and the PC's ON frame."""
    desk = Image.open(os.path.join(ROOT, 'DESK', 'DESK_FRONT.png')).convert('RGBA')
    pc_name = 'PC_FRONT_OFF.png' if state == 'off' else f'PC_FRONT_ON_{frame + 1}.png'
    pc = Image.open(os.path.join(ROOT, 'PC', pc_name)).convert('RGBA')
    im = desk.copy()
    px = im.load()
    EDGE = c('#3f3740')
    PANEL, PANEL_L, PANEL_D = c('#d6cdb2'), c('#ebe4cd'), c('#aaa087')
    BEZEL, DARK = c('#4a4650'), c('#2a2530')
    # the console: a raised cream panel along the back of the desk, left of the PC
    X0, X1, Y0, Y1 = 1, 31, 1, 15
    rect(px, X0, Y0, X1, Y1, EDGE)
    rect(px, X0 + 1, Y0 + 1, X1 - 1, Y1 - 1, PANEL)
    rect(px, X0 + 1, Y0 + 1, X1 - 1, Y0 + 1, PANEL_L)
    rect(px, X0 + 1, Y1 - 1, X1 - 1, Y1 - 1, PANEL_D)
    screens = [c('#5fdbe6'), c('#5fdbe6'), c('#3f6fe0'), c('#60c677')]
    lights = [c('#e0524a'), c('#f2c14e'), c('#60c677'), c('#5fa8e8')]
    for i, col in enumerate(screens):
        sx = X0 + 2 + i * 7
        rect(px, sx, Y0 + 3, sx + 5, Y0 + 8, BEZEL)
        if state == 'off':
            rect(px, sx + 1, Y0 + 4, sx + 4, Y0 + 7, DARK)
            px[sx + 1, Y0 + 4] = BEZEL
        else:
            rect(px, sx + 1, Y0 + 4, sx + 4, Y0 + 7, col)
            px[sx + 1, Y0 + 4] = c('#ffffff')
            # a trace that moves down the screen frame by frame
            ty = Y0 + 5 + (frame + i) % 3
            rect(px, sx + 2, ty, sx + 4, ty, DARK)
        # a row of buttons under each screen; one of them blinks
        for b in range(3):
            lit = state == 'on' and (b + i + frame) % 3 != 0
            px[sx + b * 2, Y0 + 11] = lights[(i + b) % 4] if lit else BEZEL
    # the PC at the right end, and a second keyboard in front of the console
    im.alpha_composite(pc, (32, 0))
    keys = pc.crop((0, 17, 16, 24))
    im.alpha_composite(keys, (9, 17))
    return im


def main():
    draw_screen()
    out = os.path.join(ROOT, 'MISSION_DESK')
    os.makedirs(out, exist_ok=True)
    draw_desk('off', 0).save(os.path.join(out, 'MISSION_DESK_OFF.png'))
    for f in range(3):
        draw_desk('on', f).save(os.path.join(out, f'MISSION_DESK_ON_{f + 1}.png'))


main()
