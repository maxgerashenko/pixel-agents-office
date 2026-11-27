"""Draws the mission control furniture sprites:

- MISSION_SCREEN (144x32, 9x2 tiles with one background row, so 9 wide and 1 deep on the floor):
  a free-standing cabinet with a dark screen and faint orbit tracks. The five status counts are drawn live by the renderer (engine/missionScreen.ts).
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
    W, H = 144, 32
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    px = im.load()
    EDGE, BODY, BODY_L, BODY_D = c('#1a1e30'), c('#3a4268'), c('#5a6490'), c('#2c3350')
    BG, MAP, TRACK = c('#10121c'), c('#2c1a38'), c('#173a24')
    # the cabinet: a lit top edge, the screen housing, and a console strip along the floor
    rect(px, 0, 0, W - 1, H - 1, EDGE)
    rect(px, 1, 1, W - 2, 1, BODY_L)
    rect(px, 1, 2, W - 2, 25, BODY)
    rect(px, 1, 26, W - 2, H - 2, BODY_D)
    rect(px, 1, 26, W - 2, 26, EDGE)
    # the screen, set into the housing
    rect(px, 2, 3, W - 3, 24, EDGE)
    rect(px, 3, 4, W - 4, 23, BG)
    # two orbit ground tracks, kept dim under the digits
    for phase, col in ((0.0, TRACK), (2.1, MAP)):
        for x in range(3, W - 3):
            y = round(13.5 + 8 * math.sin(x / 17.0 + phase))
            if 4 <= y <= 23:
                px[x, y] = col
    # console strip: a status light and a speaker grille under each column, feet at the ends
    lights = [c('#4f8df7'), c('#5fe04f'), c('#ffd83a'), c('#4f8df7'), c('#f0503c')]
    for i, col in enumerate(lights):
        x0 = 4 + i * 27 + 5
        rect(px, x0, 28, x0 + 1, 29, col)
        for g in range(5):
            rect(px, x0 + 5 + g * 2, 28, x0 + 5 + g * 2, 29, EDGE)
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
