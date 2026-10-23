#!/usr/bin/env python3
"""Regenerate Primeria's printable kit. Requires reportlab; run from any folder."""
from collections import Counter
from pathlib import Path
import re

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A2, letter, landscape
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
CSS = (ROOT / 'styles.css').read_text()
ENGINE = (ROOT / 'engine.js').read_text()
COLORS = {int(d): HexColor(h) for d, h in re.findall(r'--digit-(\d):\s*(#[0-9a-fA-F]{6})', CSS)}
PILE = [int(n) for n in re.search(r'export const PILE = \[([^]]+)\]', ENGINE).group(1).split(',')]
BOARD_SIZES = [int(n) for n in re.search(r'export const BOARD_SIZES = \[([^]]+)\]', ENGINE).group(1).split(',')]
DIGITS = [d for d, count in enumerate(PILE) for _ in range(count)]
BAR_ROWS = [
    [1, 1, 1, 1, 1, 2, 2, 2, 0],
    [3, 3, 3, 3, 3, 4, 4, 4, 0],
    [7, 7, 7, 7, 7, 6, 6, 6, 5],
    [9, 9, 9, 9, 9, 8, 8, 8, 5],
]
BAR_DIGITS = [digit for row in BAR_ROWS for digit in row]
assert len(BAR_ROWS) == 4 and all(len(row) == 9 for row in BAR_ROWS)
assert Counter(BAR_DIGITS) == Counter(DIGITS)
assert len(COLORS) == 10 and len(DIGITS) == 36
assert PILE == [2, 5, 3, 5, 3, 2, 3, 5, 3, 5]

for name, file in [('Body', 'dm-sans-400.ttf'), ('Medium', 'dm-sans-600.ttf'), ('Display', 'manrope-700.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(ROOT / 'vendor' / file)))

INK = HexColor('#233b33')
GREEN = HexColor('#254e41')
MUTED = HexColor('#6f7b71')
PAPER = HexColor('#f6f3eb')
CELL = 26 * mm
TILE = 24 * mm
TILE_RADIUS = 2 * mm
BORDER = 10 * mm
PRINT_MARGIN = 10 * mm


def board_dimensions(size):
    border = min(BORDER, (A2[0]-2*PRINT_MARGIN-size*CELL)/2)
    if border < 5*mm-0.01:
        raise ValueError(f'{size} x {size} does not fit A2 with readable coordinates and 10 mm margins.')
    return size*CELL+2*border, border


def blend(color, amount=.75):
    """Mix a tile color with white, retaining its hue."""
    return Color(*(v * (1 - amount) + amount for v in (color.red, color.green, color.blue)))


def pdf(name, size, title):
    c = Canvas(str(HERE / name), pagesize=size, pageCompression=1, invariant=1, initialFontName='Body')
    c.setTitle(title)
    c.setAuthor('Primeria / Yunhai Xiang')
    c.setSubject('Print at Actual Size / 100%. Do not scale to fit.')
    return c


def text(c, x, y, value, size=9, font='Body', color=INK, align='left'):
    c.setFillColor(color)
    c.setFont(font, size)
    getattr(c, {'left': 'drawString', 'center': 'drawCentredString', 'right': 'drawRightString'}[align])(x, y, value)


def header(c, w, h, title, detail, paper):
    text(c, 16*mm, h-19*mm, 'Primeria', 22, 'Display')
    text(c, 16*mm, h-26*mm, title, 10, 'Medium')
    text(c, 16*mm, h-32*mm, detail, 8, color=MUTED)
    text(c, 16*mm, h-38*mm, paper, 8, 'Medium', MUTED)
    c.setStrokeColor(HexColor('#d5dcd3'))
    c.setLineWidth(.5)
    c.line(16*mm, h-42*mm, w-16*mm, h-42*mm)


def footer(c, w, page, total):
    text(c, 16*mm, 10*mm, 'PRINT AT 100% / ACTUAL SIZE', 7, 'Medium', MUTED)
    text(c, w-16*mm, 10*mm, f'{page} / {total}', 7, 'Medium', MUTED, 'right')


def scale_bar(c, x, y):
    c.setStrokeColor(INK)
    c.setLineWidth(.6)
    c.line(x, y, x+50*mm, y)
    for i in range(6):
        c.line(x+i*10*mm, y-1.2*mm, x+i*10*mm, y+1.2*mm)
    text(c, x+25*mm, y-5*mm, '50 mm - check with a ruler', 7, color=MUTED, align='center')


def crop_marks(c, x, y, w, h):
    c.setStrokeColor(INK)
    c.setLineWidth(.4)
    for cx, cy, dx, dy in [(x,y,-1,-1), (x+w,y,1,-1), (x,y+h,-1,1), (x+w,y+h,1,1)]:
        c.line(cx+dx*1.3*mm, cy, cx+dx*4*mm, cy)
        c.line(cx, cy+dy*1.3*mm, cx, cy+dy*4*mm)


def numeral(c, x, y, digit, angle, size, color=INK):
    c.saveState()
    c.translate(x, y)
    c.rotate(angle)
    text(c, 0, 0, str(digit), size, 'Display', color, 'center')
    # These underlines distinguish 6 and 9 from every viewing direction.
    if digit in (6, 9):
        c.setStrokeColor(color)
        c.setStrokeAlpha(.23)
        c.setLineWidth(size*.105)
        half = pdfmetrics.stringWidth(str(digit), 'Display', size) * .3
        c.line(-half, -size*.14, half, -size*.14)
    c.restoreState()


def four_digits(c, x, y, side, digit, size, color=INK):
    center = side / 2
    inset = 2.1*mm
    numeral(c, x+center, y+side-inset-size*.74, digit, 0, size, color)
    numeral(c, x+center, y+inset+size*.74, digit, 180, size, color)
    numeral(c, x+inset+size*.74, y+center, digit, 90, size, color)
    numeral(c, x+side-inset-size*.74, y+center, digit, -90, size, color)


def board(c, size, border):
    side = size*CELL+2*border
    c.setFillColor(GREEN)
    c.rect(0, 0, side, side, stroke=0, fill=1)
    c.setStrokeColor(HexColor('#416355'))
    c.setLineWidth(.3)
    for row in range(size):
        for col in range(size):
            x, y = border+col*CELL, border+(size-1-row)*CELL
            c.setFillColor(HexColor('#e6e8dc' if (row+col)%2 == 0 else '#d9dfd0'))
            c.rect(x, y, CELL, CELL, stroke=1, fill=1)
    if border >= 8*mm:
        c.setStrokeColor(HexColor('#90aa94'))
        c.setLineWidth(.7)
        c.rect(1.5*mm, 1.5*mm, side-3*mm, side-3*mm, stroke=1, fill=0)
    axis_font = 9 if border >= 8*mm else 8
    baseline = (border-axis_font*.72)/2
    for i in range(size):
        middle = border+(i+.5)*CELL
        text(c, middle, baseline, chr(65+i), axis_font, 'Medium', PAPER, 'center')
        c.saveState()
        c.translate(middle, side-baseline)
        c.rotate(180)
        text(c, 0, 0, chr(65+i), axis_font, 'Medium', PAPER, 'center')
        c.restoreState()
        y = border+(size-i-.5)*CELL
        text(c, border/2, y-axis_font*.33, str(i+1), axis_font, 'Medium', PAPER, 'center')
        c.saveState()
        c.translate(side-border/2, y+axis_font*.33)
        c.rotate(180)
        text(c, 0, 0, str(i+1), axis_font, 'Medium', PAPER, 'center')
        c.restoreState()


def full_board(size):
    w, h = A2
    side, border = board_dimensions(size)
    finished = f'{side/mm:.0f} x {side/mm:.0f} mm'
    c = pdf(f'board-{size}x{size}-A2.pdf', A2, f'Primeria - {size} x {size} board - A2')
    header(c, w, h, f'{size} x {size} BOARD / SINGLE SHEET', f'26 mm squares / finished board: {finished}', 'PAPER: A2 (420 x 594 mm), portrait / 90-120 gsm matte paper; mount on cardboard.')
    x, y = (w-side)/2, (h-side)/2
    assert x >= PRINT_MARGIN-0.01 and y >= PRINT_MARGIN
    c.saveState()
    c.translate(x, y)
    board(c, size, border)
    c.restoreState()
    crop_marks(c, x, y, side, side)
    text(c, w/2, y-14*mm, 'Trim to the green outer edge. Mount on 1-2 mm cardboard.', 10, align='center')
    text(c, w/2, y-21*mm, f'Keep the finished board at {finished}; do not enlarge it to fill the sheet.', 9, color=MUTED, align='center')
    scale_bar(c, (w-50*mm)/2, 30*mm)
    footer(c, w, 1, 1)
    c.showPage()
    c.save()


def tile_sheet():
    w, h = letter
    c = pdf('tiles-two-player-set.pdf', letter, 'Primeria - reusable 36-tile sheet - print two copies')
    pitch = TILE+3*mm
    width = 6*TILE+5*3*mm
    left = (w-width)/2
    bottom = 65*mm
    header(c, w, h, 'TILE SET', '36 tiles / 24 x 24 mm each / print two copies for a two-player game', 'PAPER: US Letter (8.5 x 11 in), portrait / 200-250 gsm matte cardstock.')
    for i, digit in enumerate(DIGITS):
        row, col = divmod(i, 6)
        x, y = left+col*pitch, bottom+(5-row)*pitch
        c.setFillColor(COLORS[digit])
        c.setStrokeColor(HexColor('#67776b'))
        c.setLineWidth(.35)
        c.roundRect(x, y, TILE, TILE, TILE_RADIUS, stroke=1, fill=1)
        four_digits(c, x, y, TILE, digit, 20)
    text(c, w/2, 53*mm, 'Cut along the rounded outlines (2 mm corner radius). Discard the white gutters.', 8, align='center')
    text(c, w/2, 47*mm, 'Numbers read from all four sides. Underlines identify 6 and 9.', 8, align='center')
    text(c, w/2, 41*mm, 'Both players use identical tiles; tiles can transfer during challenges.', 8, align='center')
    scale_bar(c, (w-50*mm)/2, 28*mm)
    footer(c, w, 1, 1)
    c.showPage()
    c.save()


def draw_tile_bar(c, left, bottom, rows, title, digits=None):
    bh = (rows*26+12)*mm
    text(c,left+6*mm,bottom+bh-6*mm,title,9,'Display')
    counts = Counter()
    for i in range(rows*9):
        digit = digits[i] if digits is not None else None
        row, col = divmod(i,9)
        x, y = left+6*mm+col*CELL, bottom+4*mm+(rows-1-row)*CELL
        c.setFillColor(blend(COLORS[digit],.72) if digit is not None else HexColor('#f0f2ec'))
        c.setStrokeColor(blend(INK,.63))
        c.setLineWidth(.35)
        c.setDash(1.5,1.8)
        c.rect(x+.5*mm,y+.5*mm,CELL-mm,CELL-mm,stroke=1,fill=1)
        c.setDash()
        if digit is not None:
            counts[digit] += 1
            c.setFillColor(COLORS[digit])
            c.rect(x+.5*mm,y+CELL-2*mm,CELL-mm,1.5*mm,stroke=0,fill=1)
            four_digits(c,x+mm,y+mm,TILE,digit,10,blend(INK,.52))
            text(c,x+CELL/2,y+CELL/2-2,f'{counts[digit]} / {PILE[digit]}',6,color=MUTED,align='center')


def tile_bars():
    w, h = landscape(letter)
    c = pdf('tile-bars-4x9.pdf',(w,h),'Primeria - uniform tile plate with extra-tile row')
    left = (w-246*mm)/2
    text(c,16*mm,h-12*mm,'Primeria',18,'Display')
    text(c,16*mm,h-20*mm,'TILE PLATE - print two copies; cut around the outer outline; keep the plate whole.',9,'Medium')
    text(c,16*mm,h-26*mm,'PAPER: US Letter (11 x 8.5 in), landscape / 200-250 gsm matte cardstock.',8,'Medium',MUTED)
    c.setStrokeColor(HexColor('#d5dcd3'))
    c.setLineWidth(.5)
    c.line(16*mm,h-30*mm,w-16*mm,h-30*mm)
    c.setFillColor(HexColor('#fbfaf5'))
    c.setStrokeColor(GREEN)
    c.setLineWidth(.6)
    c.rect(left,30*mm,246*mm,152*mm,stroke=1,fill=1)
    draw_tile_bar(c,left,64*mm,4,'TILE PILE',BAR_DIGITS)
    draw_tile_bar(c,left,30*mm,1,'EXTRA TILES')
    crop_marks(c,left,30*mm,246*mm,152*mm)
    scale_bar(c,(w-50*mm)/2,16*mm)
    footer(c,w,1,1)
    c.showPage()
    c.save()


if __name__ == '__main__':
    for size in BOARD_SIZES:
        full_board(size)
    tile_sheet()
    tile_bars()
    print(f'Generated {len(BOARD_SIZES)+2} PDFs: {len(BOARD_SIZES)} A2 boards, 1 reusable tile sheet, 1 reusable tile-plate page (print each reusable page twice).')
    print('Tile count per player:', dict(Counter(DIGITS)))
    print('Dimensions: 26 mm board cells, 24 mm tiles, 246 x 152 mm connected tile plate.')
