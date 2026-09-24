"""Writes public/lottie/it-hero.json: run `python scripts/it-hero-lottie.py public/lottie/it-hero.json`."""
import json
import sys

FR, OP, W, H = 30, 330, 1600, 900
RESET_START, RESET_END = 300, 322

WHITE = [1, 1, 1, 1]
MINT = [0.584, 0.898, 0.863, 1]
BLUE = [0.075, 0.275, 0.773, 1]
NAVY = [0.031, 0.110, 0.184, 1]
# Night lifted a step, solid so the links behind a window stay hidden.
PANEL = [0.07, 0.145, 0.215, 1]

EASE = {'i': {'x': 0.25, 'y': 1}, 'o': {'x': 0.6, 'y': 0}}
EASE_BACK = {'i': {'x': 0.3, 'y': 1.4}, 'o': {'x': 0.5, 'y': 0}}


def static(v):
    return {'a': 0, 'k': v}


def anim(keys, ease=EASE):
    """keys: list of (frame, value) or (frame, value, 'hold')."""
    out = []
    for index, key in enumerate(keys):
        t, v = key[0], key[1]
        v = v if isinstance(v, list) else [v]
        frame = {'t': t, 's': v}
        if index < len(keys) - 1:
            if len(key) > 2 and key[2] == 'hold':
                frame['h'] = 1
            else:
                frame.update(ease)
        out.append(frame)
    return {'a': 1, 'k': out}


def tr(p=(0, 0), s=None, o=None, r=0):
    return {
        'ty': 'tr',
        'p': static(list(p)),
        'a': static([0, 0]),
        's': s or static([100, 100]),
        'r': static(r),
        'o': o or static(100),
        'sk': static(0),
        'sa': static(0),
    }


def group(name, items, transform=None):
    return {'ty': 'gr', 'nm': name, 'it': items + [transform or tr()]}


def rect(size, pos=(0, 0), radius=0):
    return {'ty': 'rc', 'd': 1, 's': static(list(size)), 'p': static(list(pos)), 'r': static(radius)}


def ellipse(size, pos=(0, 0)):
    return {'ty': 'el', 'd': 1, 's': static(list(size)), 'p': static(list(pos))}


def path(points, closed=False):
    zero = [[0, 0] for _ in points]
    return {'ty': 'sh', 'ks': static({'i': zero, 'o': zero, 'v': [list(p) for p in points], 'c': closed})}


def curve(a, b, bend):
    """A cubic from a to b whose handles bow sideways by `bend`."""
    return {
        'ty': 'sh',
        'ks': static(
            {
                'i': [[0, 0], [-bend, 0]],
                'o': [[bend, 0], [0, 0]],
                'v': [list(a), list(b)],
                'c': False,
            }
        ),
    }


def fill(color, opacity=100):
    return {'ty': 'fl', 'c': color if isinstance(color, dict) else static(color), 'o': static(opacity) if not isinstance(opacity, dict) else opacity, 'r': 1}


def stroke(color, width, opacity=100, dashes=None):
    s = {'ty': 'st', 'c': static(color), 'o': static(opacity), 'w': static(width), 'lc': 2, 'lj': 2}
    if dashes:
        s['d'] = dashes
    return s


def trim(end):
    return {'ty': 'tm', 's': static(0), 'e': end, 'o': static(0), 'm': 1}


def layer(index, name, shapes, position, float_phase=0.0, float_amp=6):
    x, y = position
    q = OP / 4
    # A slow bob that lands back on its start; the phase rotates it so windows don't bob in sync.
    turn = int(float_phase * 4) % 4
    cycle = [0, -float_amp, 0, float_amp]
    cycle = cycle[turn:] + cycle[:turn]
    keys = []
    for step, dy in enumerate(cycle + cycle[:1]):
        t = round(step * q)
        keys.append((t, [x, y + dy, 0]))
    ks = {
        'o': static(100),
        'r': static(0),
        'p': anim(keys, {'i': {'x': 0.45, 'y': 1}, 'o': {'x': 0.55, 'y': 0}}),
        'a': static([0, 0, 0]),
        's': static([100, 100, 100]),
    }
    return {
        'ddd': 0,
        'ind': index,
        'ty': 4,
        'nm': name,
        'sr': 1,
        'ks': ks,
        'ao': 0,
        'shapes': shapes,
        'ip': 0,
        'op': OP,
        'st': 0,
        'bm': 0,
    }


def reset_keys(on_frame, on_value, off_value):
    """Off until `on_frame`, on until the loop's reset, off again before it wraps."""
    return [
        (0, off_value, 'hold'),
        (on_frame, off_value),
        (on_frame + 10, on_value),
        (RESET_START, on_value),
        (RESET_END, off_value),
    ]


def window(size, click):
    w, h = size
    left, top = -w / 2, -h / 2
    button = (left + 28 + 36, top + 118)
    shapes = []

    # Frame, top bar, dots, and address pill.
    shapes.append(group('frame', [rect(size, radius=14), stroke(WHITE, 1.5, 22), fill(PANEL)]))
    shapes.append(group('bar', [path([(left, top + 30), (left + w, top + 30)]), stroke(WHITE, 1, 14)]))
    for i in range(3):
        shapes.append(
            group(f'dot{i}', [ellipse((8, 8), (left + 18 + i * 14, top + 15)), fill(MINT if i == 2 else WHITE, 90 if i == 2 else 35)])
        )
    shapes.append(group('url', [rect((w * 0.4, 12), (0, top + 15), 6), fill(WHITE, 10)]))

    # Headline is always there; the sub line types in after the click.
    shapes.append(
        group('headline', [path([(left + 28, top + 60), (left + 28 + w * 0.45, top + 60)]), stroke(WHITE, 10, 70)])
    )
    shapes.append(
        group(
            'subline',
            [
                path([(left + 28, top + 84), (left + 28 + w * 0.32, top + 84)]),
                trim(anim(reset_keys(click + 2, 100, 0))),
                stroke(WHITE, 6, 40),
            ],
        )
    )

    # The button flips brand → mint when the cursor presses it, then a ring ripples out.
    shapes.append(
        group(
            'button',
            [rect((72, 24), button, 12), fill(anim(reset_keys(click, MINT, BLUE)))],
        )
    )
    shapes.append(
        group(
            'ring',
            [ellipse((24, 24)), stroke(MINT, 2, 100)],
            tr(
                p=button,
                s=anim([(0, [0, 0], 'hold'), (click, [40, 40]), (click + 18, [320, 320]), (OP, [320, 320])]),
                o=anim([(0, 0, 'hold'), (click, 90), (click + 18, 0), (OP, 0)]),
            ),
        )
    )

    # Cards build in, staggered, after the click.
    gap = 12
    cw = (w - 56 - gap * 2) / 3
    ctop, cbottom = top + 150, h / 2 - 20
    ch = cbottom - ctop
    for i in range(3):
        cx = left + 28 + cw / 2 + i * (cw + gap)
        cy = ctop + ch / 2
        start = click + 6 + i * 4
        shapes.append(
            group(
                f'card{i}',
                [rect((cw, ch), radius=8), stroke(MINT, 1.5, 45), fill(MINT, 8)],
                tr(
                    p=(cx, cy),
                    s=anim(
                        [(0, [60, 60], 'hold'), (start, [60, 60]), (start + 12, [100, 100]), (RESET_START, [100, 100]), (RESET_END, [60, 60])],
                        EASE_BACK,
                    ),
                    o=anim(reset_keys(start, 100, 0)),
                ),
            )
        )
    # Lottie paints the first shape on top, so the frame goes last and the content above it.
    return shapes[::-1], button


WINDOWS = [
    # name, center, size, float phase
    ('w3', (1350, 160), (400, 270), 0.1),
    ('w5', (1430, 700), (340, 240), 0.6),
    ('w2', (820, 745), (500, 300), 0.35),
    ('w4', (210, 690), (320, 230), 0.8),
    ('w1', (260, 190), (380, 250), 0.2),
]
ARRIVALS = [28, 84, 140, 196, 252]
HOME = (800, 470)

layers = []
targets = []
for (name, center, size, phase), arrive in zip(WINDOWS, ARRIVALS):
    click = arrive + 4
    shapes, button = window(size, click)
    targets.append((arrive, (center[0] + button[0] + 6, center[1] + button[1] + 4), click))
    layers.append(layer(0, name, shapes, center, phase))

# Dashed links between neighbouring windows, their dashes flowing toward the next click.
links = []
order = [w[1] for w in WINDOWS]
for i, (a, b) in enumerate(zip(order, order[1:] + order[:1])):
    links.append(
        group(
            f'link{i}',
            [
                curve(a, b, 180 if i % 2 else -180),
                stroke(
                    MINT,
                    1.5,
                    22,
                    dashes=[
                        {'n': 'd', 'nm': 'dash', 'v': static(6)},
                        {'n': 'g', 'nm': 'gap', 'v': static(10)},
                        {'n': 'o', 'nm': 'offset', 'v': anim([(0, 0), (OP, -160)], {'i': {'x': 1, 'y': 1}, 'o': {'x': 0, 'y': 0}})},
                    ],
                ),
            ],
        )
    )
links_layer = {
    'ddd': 0,
    'ind': 0,
    'ty': 4,
    'nm': 'links',
    'sr': 1,
    'ks': {'o': static(100), 'r': static(0), 'p': static([0, 0, 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
    'ao': 0,
    'shapes': links,
    'ip': 0,
    'op': OP,
    'st': 0,
    'bm': 0,
}

# The cursor glides window to window, dips on each click, and returns home to close the loop.
pos_keys = [(0, [HOME[0], HOME[1], 0])]
scale_keys = [(0, [100, 100, 100])]
for arrive, (x, y), click in targets:
    depart = pos_keys[-1][0] + (10 if len(pos_keys) > 1 else 4)
    pos_keys.append((depart, pos_keys[-1][1]))
    pos_keys.append((arrive, [x, y, 0]))
    scale_keys += [(click - 2, [100, 100, 100]), (click + 2, [80, 80, 100]), (click + 8, [100, 100, 100])]
pos_keys += [(pos_keys[-1][0] + 12, pos_keys[-1][1]), (300, [HOME[0], HOME[1], 0]), (OP, [HOME[0], HOME[1], 0])]
scale_keys.append((OP, [100, 100, 100]))

arrow = [(0, 0), (0, 26), (7, 20), (12, 31), (16, 29), (11, 18), (20, 18)]
cursor_layer = {
    'ddd': 0,
    'ind': 0,
    'ty': 4,
    'nm': 'cursor',
    'sr': 1,
    'ks': {
        'o': static(100),
        'r': static(0),
        'p': anim(pos_keys, {'i': {'x': 0.35, 'y': 1}, 'o': {'x': 0.65, 'y': 0}}),
        'a': static([0, 0, 0]),
        's': anim(scale_keys),
    },
    'ao': 0,
    'shapes': [group('arrow', [path(arrow, closed=True), stroke(NAVY, 1.5), fill(WHITE)])],
    'ip': 0,
    'op': OP,
    'st': 0,
    'bm': 0,
}

# Lottie draws the first layer on top.
all_layers = [cursor_layer] + layers + [links_layer]
for index, item in enumerate(all_layers, start=1):
    item['ind'] = index

doc = {
    'v': '5.7.4',
    'fr': FR,
    'ip': 0,
    'op': OP,
    'w': W,
    'h': H,
    'nm': 'IHP+ IT hero — building the web',
    'ddd': 0,
    'assets': [],
    'layers': all_layers,
}

with open(sys.argv[1], 'w', encoding='utf-8') as out:
    json.dump(doc, out, separators=(',', ':'))
