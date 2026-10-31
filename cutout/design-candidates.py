#!/usr/bin/env python3
"""Render center-mark alternatives without changing the selected tile sheet."""
import importlib.util
from math import cos, sin, pi
from pathlib import Path

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('kit', ROOT/'generate.py')
kit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kit)
mm = kit.mm

FAMILIES = [
    ('A', 'Pips', 'Counts of 2, 3, and 5.'),
    ('B', 'Outlines', 'Circle, diamond, square.'),
    ('C', 'Solids', 'Circle, triangle, square.'),
    ('D', 'Card suits', 'Diamond, club, spade.'),
    ('E', 'Frames', 'Open ring, corners, grid.'),
    ('F', 'Petals', 'Two, three, five petals.'),
]
GROUPS = ['{0, 5}', '{2, 4, 6, 8}', '{1, 3, 7, 9}']
EXAMPLES = [0, 2, 1]
CENTERS = [92*mm, 135*mm, 178*mm]


def polygon(c, vertices, fill=False):
    path = c.beginPath()
    path.moveTo(*vertices[0])
    for vertex in vertices[1:]:
        path.lineTo(*vertex)
    path.close()
    c.drawPath(path, stroke=not fill, fill=fill)


def mark(c, x, y, family, group, digit):
    tile_color = kit.COLORS[digit]
    shade = kit.Color(*(a*.62+b*.38 for a,b in zip(
        (kit.INK.red, kit.INK.green, kit.INK.blue),
        (tile_color.red, tile_color.green, tile_color.blue))))
    c.saveState()
    c.translate(x, y)
    c.setStrokeColor(shade)
    c.setFillColor(shade)
    c.setLineWidth(.65)
    c.setLineCap(1)
    c.setLineJoin(1)
    if family == 'A':
        points = [
            [(-.9, 0), (.9, 0)],
            [(0, 1.05), (-.95, -.6), (.95, -.6)],
            [(-.95, -.95), (-.95, .95), (0, 0), (.95, -.95), (.95, .95)],
        ][group]
        for a, b in points:
            c.circle(a*mm, b*mm, .42*mm, stroke=0, fill=1)
    elif family == 'B':
        if group == 0:
            c.circle(0, 0, 1.6*mm, stroke=1, fill=0)
        elif group == 1:
            polygon(c, [(0,1.9*mm),(1.9*mm,0),(0,-1.9*mm),(-1.9*mm,0)])
        else:
            c.rect(-1.45*mm,-1.45*mm,2.9*mm,2.9*mm,stroke=1,fill=0)
    elif family == 'C':
        if group == 0:
            c.circle(0,0,1.2*mm,stroke=0,fill=1)
        elif group == 1:
            polygon(c,[(0,1.6*mm),(-1.6*mm,-1.1*mm),(1.6*mm,-1.1*mm)],fill=True)
        else:
            c.rect(-1.1*mm,-1.1*mm,2.2*mm,2.2*mm,stroke=0,fill=1)
    elif family == 'D':
        if group == 0:
            polygon(c,[(0,1.9*mm),(1.35*mm,0),(0,-1.9*mm),(-1.35*mm,0)],fill=True)
        elif group == 1:
            for a,b in [(0,.85),(-.8,0),(.8,0)]:
                c.circle(a*mm,b*mm,.8*mm,stroke=0,fill=1)
            polygon(c,[(-.45*mm,-1.7*mm),(.45*mm,-1.7*mm),(0,-.15*mm)],fill=True)
        else:
            path=c.beginPath()
            path.moveTo(0,1.9*mm)
            path.curveTo(-.6*mm,1.1*mm,-1.65*mm,.45*mm,-1.65*mm,-.25*mm)
            path.curveTo(-1.65*mm,-1.1*mm,-.55*mm,-1.3*mm,0,-.5*mm)
            path.curveTo(.55*mm,-1.3*mm,1.65*mm,-1.1*mm,1.65*mm,-.25*mm)
            path.curveTo(1.65*mm,.45*mm,.6*mm,1.1*mm,0,1.9*mm)
            path.close()
            c.drawPath(path,stroke=0,fill=1)
            polygon(c,[(-.45*mm,-1.7*mm),(.45*mm,-1.7*mm),(0,-.15*mm)],fill=True)
    elif family == 'E':
        if group == 0:
            for angle in [12,102,192,282]:
                c.arc(-1.65*mm,-1.65*mm,1.65*mm,1.65*mm,startAng=angle,extent=66)
        elif group == 1:
            for angle in [0,90,180,270]:
                c.saveState()
                c.rotate(angle)
                path=c.beginPath()
                path.moveTo(.55*mm,1.65*mm)
                path.lineTo(1.65*mm,1.65*mm)
                path.lineTo(1.65*mm,.55*mm)
                c.drawPath(path)
                c.restoreState()
        else:
            for delta in [-.6*mm,.6*mm]:
                c.line(delta,-1.6*mm,delta,1.6*mm)
                c.line(-1.6*mm,delta,1.6*mm,delta)
    else:
        petals = [2,3,5][group]
        c.setLineWidth(.55)
        for i in range(petals):
            c.saveState()
            c.rotate((90 if petals == 2 else 0)+i*360/petals)
            path=c.beginPath()
            path.moveTo(0,0)
            path.curveTo(-.85*mm,.65*mm,-.6*mm,1.8*mm,0,1.8*mm)
            path.curveTo(.6*mm,1.8*mm,.85*mm,.65*mm,0,0)
            path.close()
            c.drawPath(path,stroke=1,fill=0)
            c.restoreState()
    c.restoreState()


def sample(c, x, y, family, group):
    digit = EXAMPLES[group]
    c.setFillColor(kit.COLORS[digit])
    c.setStrokeColor(kit.HexColor('#67776b'))
    c.setLineWidth(.35)
    c.roundRect(x,y,kit.TILE,kit.TILE,kit.TILE_RADIUS,stroke=1,fill=1)
    kit.four_digits(c,x,y,kit.TILE,digit,17)
    mark(c,x+kit.TILE/2,y+kit.TILE/2,family,group,digit)


def generate():
    w,h=kit.letter
    c=kit.pdf('tile-center-candidates.pdf',kit.letter,'Primeria - six tile center-mark candidates')
    for page in range(2):
        kit.header(c,w,h,'TILE CENTER MARKS / CANDIDATES '+('A-C' if page==0 else 'D-F'),
            'Each column shows one digit group. All samples use the current 17 pt numerals.',
            'PAPER: US Letter (8.5 x 11 in), portrait / print at 100% for actual-size samples.')
        for x,label in zip(CENTERS,GROUPS):
            kit.text(c,x,h-54*mm,label,9,'Medium',align='center')
        for row,(code,name,description) in enumerate(FAMILIES[page*3:page*3+3]):
            center=h-(80+55*row)*mm
            kit.text(c,16*mm,center+3*mm,f'{code}. {name}',14,'Display')
            kit.text(c,16*mm,center-4*mm,description,8,color=kit.MUTED)
            for group,x in enumerate(CENTERS):
                sample(c,x-kit.TILE/2,center-kit.TILE/2,code,group)
            c.setStrokeColor(kit.HexColor('#e1e4da'))
            c.setLineWidth(.4)
            c.line(16*mm,center-23*mm,w-16*mm,center-23*mm)
        kit.text(c,w/2,48*mm,'Samples are 24 x 24 mm with 2 mm rounded corners.',9,align='center')
        kit.scale_bar(c,(w-50*mm)/2,30*mm)
        kit.footer(c,w,page+1,2)
        c.showPage()
    c.save()


if __name__ == '__main__':
    generate()
