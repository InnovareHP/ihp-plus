"""Writes public/lottie/it-hero.json: run `python scripts/it-hero-lottie.py public/lottie/it-hero.json`."""
import json
import sys

FR, OP, W, H = 30, 360, 1600, 900
# Every transient state fades back together here, so frame OP matches frame 0.
R0, R1 = 332, 352

WHITE = [1, 1, 1, 1]
BLACK = [0, 0, 0, 1]
INK = [0.133, 0.133, 0.133, 1]
MINT = [0.584, 0.898, 0.863, 1]
BLUE = [0.075, 0.275, 0.773, 1]
BLUE_LIGHT = [0.380, 0.545, 0.945, 1]
NAVY = [0.043, 0.157, 0.420, 1]
NIGHT = [0.031, 0.110, 0.184, 1]
PANEL = [0.063, 0.137, 0.208, 1]
CHROME = [0.086, 0.176, 0.259, 1]
RAISED = [0.106, 0.227, 0.341, 1]
RED = [1, 0.373, 0.341, 1]
AMBER = [0.996, 0.737, 0.180, 1]
GREEN = [0.157, 0.784, 0.251, 1]

EASE = {'i': {'x': 0.25, 'y': 1}, 'o': {'x': 0.6, 'y': 0}}
BACK = {'i': {'x': 0.3, 'y': 1.5}, 'o': {'x': 0.5, 'y': 0}}
LINEAR = {'i': {'x': 1, 'y': 1}, 'o': {'x': 0, 'y': 0}}


# ---------- Lottie primitives ----------


def static(v):
    return {'a': 0, 'k': v}


def anim(keys, ease=EASE):
    """keys: (frame, value) or (frame, value, 'hold'); a hold jumps instead of easing."""
    out = []
    for index, key in enumerate(keys):
        value = key[1] if isinstance(key[1], list) else [key[1]]
        frame = {'t': key[0], 's': value}
        if index < len(keys) - 1:
            if len(key) > 2 and key[2] == 'hold':
                frame['h'] = 1
            else:
                frame.update(ease)
        out.append(frame)
    return {'a': 1, 'k': out}


def prop(v):
    return v if isinstance(v, dict) else static(v)


def tr(p=(0, 0), s=None, o=None):
    return {
        'ty': 'tr',
        'p': prop(list(p)) if not isinstance(p, dict) else p,
        'a': static([0, 0]),
        's': prop(s) if s is not None else static([100, 100]),
        'r': static(0),
        'o': prop(o) if o is not None else static(100),
        'sk': static(0),
        'sa': static(0),
    }


def group(items, transform=None, name='g'):
    return {'ty': 'gr', 'nm': name, 'it': items + [transform or tr()]}


def rect_shape(w, h, cx, cy, r=0):
    return {'ty': 'rc', 'd': 1, 's': static([w, h]), 'p': static([cx, cy]), 'r': static(r)}


def ellipse_shape(w, h, cx, cy):
    return {'ty': 'el', 'd': 1, 's': static([w, h]), 'p': static([cx, cy])}


def path_shape(points, closed=False, curves=None):
    zero = [[0, 0] for _ in points]
    i, o = (curves or (zero, zero))
    return {'ty': 'sh', 'ks': static({'i': i, 'o': o, 'v': [list(p) for p in points], 'c': closed})}


def fill(color, opacity=100):
    return {'ty': 'fl', 'c': prop(color), 'o': prop(opacity), 'r': 1}


def gradient(c1, c2, start, end, opacity=100):
    return {
        'ty': 'gf',
        'o': static(opacity),
        'r': 1,
        't': 1,
        'g': {'p': 2, 'k': static([0, *c1[:3], 1, *c2[:3]])},
        's': static(list(start)),
        'e': static(list(end)),
    }


def stroke(color, width, opacity=100, cap=2):
    return {'ty': 'st', 'c': prop(color), 'o': prop(opacity), 'w': static(width), 'lc': cap, 'lj': 2}


def trim(end):
    return {'ty': 'tm', 's': static(0), 'e': prop(end), 'o': static(0), 'm': 1}


# ---------- UI building blocks (x, y is the top-left, like CSS) ----------


def box(x, y, w, h, r=0, color=None, opacity=100, line=None, line_op=100, line_w=1, grad=None):
    items = [rect_shape(w, h, x + w / 2, y + h / 2, r)]
    if line:
        items.append(stroke(line, line_w, line_op))
    if grad:
        items.append(gradient(*grad))
    if color:
        items.append(fill(color, opacity))
    return group(items)


def bar(x, y, w, h=6, color=WHITE, opacity=40):
    return box(x, y, w, h, h / 2, color, opacity)


def dot(cx, cy, d, color, opacity=100):
    return group([ellipse_shape(d, d, cx, cy), fill(color, opacity)])


def moving(items, p, s=None, o=None):
    """A group whose children are drawn around its own origin, placed and animated at p."""
    # Sub-groups are listed bottom-up like the screens, so flip them; bare shapes keep their styles last.
    if all(item['ty'] == 'gr' for item in items):
        items = items[::-1]
    return group(items, tr(p, s, o))


def toggle(t_on, off, on, dur=8):
    """Off until t_on, eases on, holds until the loop's reset, then eases off again."""
    return anim([(0, off, 'hold'), (t_on, off), (t_on + dur, on), (R0, on), (R1, off)])


def pulse(t, low, high, dur=12):
    """A one-shot swell at t that settles back, used for ripples and pops."""
    return anim([(0, low, 'hold'), (t, low), (t + dur, high), (OP, high)])


def typed(t, steps, every=3):
    """Trim-end keys that advance in jumps, the way characters land while typing."""
    keys = [(0, 0, 'hold'), (t, 0, 'hold')]
    for k in range(1, steps + 1):
        keys.append((t + k * every, round(100 * k / steps), 'hold'))
    keys += [(R0, 100), (R1, 0)]
    return anim(keys)


def chrome(w, h, url_w=0.44):
    """Shadow, body, title bar, traffic lights, a tab, and the address bar."""
    return [
        box(6, 14, w, h, 14, BLACK, 32),
        box(0, 0, w, h, 14, PANEL, 100, WHITE, 14, 1),
        box(0, 0, w, 36, 14, CHROME),
        box(0, 22, w, 14, 0, CHROME),
        box(0, 36, w, 1, 0, WHITE, 8),
        dot(16, 18, 10, RED, 95),
        dot(31, 18, 10, AMBER, 95),
        dot(46, 18, 10, GREEN, 95),
        box(w * (1 - url_w) / 2, 9, w * url_w, 18, 9, WHITE, 7),
        box(w * (1 - url_w) / 2 + 10, 16, 6, 5, 1, WHITE, 45),
        bar(w * (1 - url_w) / 2 + 22, 16, w * url_w * 0.45, 4, WHITE, 30),
        dot(w - 20, 18, 3, WHITE, 35),
        dot(w - 26, 18, 3, WHITE, 35),
        dot(w - 32, 18, 3, WHITE, 35),
    ]


# ---------- The five screens ----------


def signup(w, h):
    """A sign-up form: focus, type an email, fill a password, submit, success tick."""
    items = chrome(w, h, 0.4)
    items += [
        dot(30, 60, 14, MINT),
        bar(44, 57, 56, 7, WHITE, 70),
        bar(24, 84, 170, 12, WHITE, 90),
        bar(24, 104, 230, 6, WHITE, 35),
        bar(24, 126, 44, 5, WHITE, 50),
        box(24, 136, w - 48, 30, 8, WHITE, 5, WHITE, 18),
        bar(24, 178, 60, 5, WHITE, 50),
        box(24, 188, w - 48, 30, 8, WHITE, 5, WHITE, 18),
    ]
    # Focus rings, the typed email, its caret, and the password dots.
    items.append(moving([rect_shape(w - 44, 34, 0, 0, 10), stroke(MINT, 2)], (w / 2, 151), o=anim(
        [(0, 0, 'hold'), (22, 0), (26, 100), (68, 100), (72, 0), (OP, 0)])))
    items.append(moving([rect_shape(w - 44, 34, 0, 0, 10), stroke(MINT, 2)], (w / 2, 203), o=anim(
        [(0, 0, 'hold'), (70, 0), (74, 100), (96, 100), (100, 0), (OP, 0)])))
    items.append(group([path_shape([(36, 151), (196, 151)]), trim(typed(26, 12)), stroke(WHITE, 6, 80)]))
    caret_keys = [(0, [36, 151], 'hold')]
    for k in range(1, 13):
        caret_keys.append((26 + k * 3, [36 + 160 * k / 12 + 5, 151], 'hold'))
    caret_keys.append((OP, [201, 151]))
    blink = [(0, 0, 'hold'), (22, 100, 'hold')]
    for t in range(64, 70, 4):
        blink += [(t, 0, 'hold'), (t + 2, 100, 'hold')]
    blink += [(70, 0, 'hold'), (OP, 0)]
    items.append(moving([rect_shape(2, 16, 0, 0), fill(MINT)], anim(caret_keys), o=anim(blink)))
    for i in range(9):
        items.append(moving([ellipse_shape(7, 7, 0, 0), fill(WHITE, 85)], (38 + i * 12, 203),
                            o=toggle(74 + i * 2, 0, 100, 2)))
    # Submit turns mint on press; its label gives way to a drawn tick.
    items.append(group([rect_shape(w - 48, 30, w / 2, 247, 8), fill(toggle(98, BLUE, MINT, 5))]))
    items.append(moving([rect_shape(64, 6, 0, 0, 3), fill(WHITE, 90)], (w / 2, 247), o=toggle(98, 100, 0, 4)))
    items.append(group([
        path_shape([(w / 2 - 8, 247), (w / 2 - 2, 253), (w / 2 + 9, 241)]),
        trim(toggle(102, 0, 100, 12)),
        stroke(INK, 3),
    ]))
    return items


def dashboard(w, h):
    """An analytics dashboard: pick a nav item, KPIs tick up, the chart redraws."""
    items = chrome(w, h, 0.36)
    items += [box(0, 37, 92, h - 37, 0, WHITE, 3), dot(22, 56, 14, MINT), bar(36, 53, 42, 7, WHITE, 70)]
    # The active-row highlight slides from Overview to Analytics on the click.
    items.append(moving([rect_shape(76, 22, 0, 0, 6), fill(BLUE, 70)], toggle(132, [46, 86], [46, 138], 10)))
    for i in range(5):
        y = 82 + i * 26
        items += [box(16, y, 10, 10, 3, WHITE, 40), bar(32, y + 2, 44 - (i % 2) * 10, 6, WHITE, 45)]
    items += [bar(108, 52, 110, 10, WHITE, 85)]
    for i in range(3):
        items.append(box(w - 186 + i * 58, 46, 50, 20, 10, WHITE, 6))
    items.append(moving([rect_shape(50, 20, 0, 0, 10), stroke(MINT, 1.5, 70)], toggle(134, [w - 161, 56], [w - 45, 56], 10)))

    card_w = (w - 108 - 16 - 20) / 3
    for i in range(3):
        x = 108 + i * (card_w + 10)
        items += [box(x, 80, card_w, 56, 10, WHITE, 5, WHITE, 8), bar(x + 10, 92, 44, 5, WHITE, 45)]
        items.append(moving([rect_shape(56, 11, 28, 0, 3), fill(WHITE, 90)], (x + 10, 113),
                            s=toggle(140 + i * 3, [100, 100], [128 - i * 8, 100], 12)))
        items.append(box(x + card_w - 34, 90, 24, 10, 5, MINT, 30))

    cx, cy, cw, ch = 108, 146, w - 124, h - 162
    items.append(box(cx, cy, cw, ch, 10, WHITE, 4, WHITE, 8))
    for i in range(1, 4):
        items.append(box(cx + 12, cy + ch * i / 4, cw - 24, 1, 0, WHITE, 7))
    xs = [cx + 14 + (cw - 28) * k / 8 for k in range(9)]
    now = [0.72, 0.6, 0.66, 0.44, 0.5, 0.3, 0.36, 0.2, 0.14]
    before = [0.8, 0.74, 0.7, 0.66, 0.62, 0.64, 0.56, 0.52, 0.5]
    pts = [(x, cy + ch * v) for x, v in zip(xs, now)]
    items.append(group([path_shape([(x, cy + ch * v) for x, v in zip(xs, before)]), stroke(BLUE_LIGHT, 2, 55)]))
    items.append(group([path_shape(pts + [(xs[-1], cy + ch - 6), (xs[0], cy + ch - 6)], True),
                        gradient(MINT, PANEL, (0, cy), (0, cy + ch), 35)]))
    redraw = anim([(0, 100, 'hold'), (134, 100), (138, 0, 'hold'), (139, 0), (170, 100), (OP, 100)], EASE)
    items.append(group([path_shape(pts), trim(redraw), stroke(MINT, 2.5)]))
    items.append(moving([ellipse_shape(9, 9, 0, 0), fill(MINT)], pts[-1], s=anim(
        [(0, [100, 100], 'hold'), (170, [100, 100]), (176, [170, 170]), (184, [100, 100]), (OP, [100, 100])], BACK)))
    return items


def shop(w, h):
    """A product grid: hover lifts a card, Add to cart confirms, the cart badge pops."""
    items = chrome(w, h, 0.4)
    items += [dot(26, 56, 14, MINT), bar(40, 53, 50, 7, WHITE, 70), box(w * 0.32, 46, w * 0.4, 20, 10, WHITE, 6),
              dot(w * 0.32 + 12, 56, 7, WHITE, 35)]
    items += [group([path_shape([(w - 44, 49), (w - 40, 49), (w - 36, 61), (w - 26, 61), (w - 23, 52), (w - 38, 52)]),
                     stroke(WHITE, 1.6, 70)]),
              dot(w - 35, 65, 3.5, WHITE, 70), dot(w - 27, 65, 3.5, WHITE, 70)]
    items.append(moving([ellipse_shape(14, 14, 0, 0), fill(MINT), rect_shape(4, 6, 0, 0, 1)], (w - 21, 46),
                        s=anim([(0, [0, 0], 'hold'), (198, [0, 0]), (206, [100, 100]), (R0, [100, 100]), (R1, [0, 0])], BACK)))
    items.append(moving([rect_shape(4, 6, 0, 0, 1), fill(INK)], (w - 21, 46), o=toggle(200, 0, 100, 4)))

    card_w = (w - 32 - 20) / 3
    hues = [(BLUE, MINT), (NAVY, BLUE_LIGHT), (MINT, BLUE)]
    for i in range(3):
        x, y = 16 + i * (card_w + 10), 80
        card = [
            box(0, 0, card_w, h - 96, 10, WHITE, 5, WHITE, 10),
            box(8, 8, card_w - 16, 92, 7, grad=(hues[i][0], hues[i][1], (8, 100), (card_w - 8, 8))),
            dot(card_w - 26, 30, 14, WHITE, 55),
            group([path_shape([(8, 100), (card_w * 0.35, 62), (card_w * 0.55, 82), (card_w * 0.7, 70), (card_w - 8, 100)], True),
                   fill(NIGHT, 35)]),
            bar(10, 110, card_w * 0.6, 6, WHITE, 75),
            bar(10, 124, 34, 8, MINT, 85),
            box(8, h - 136, card_w - 16, 26, 7, BLUE),
            bar(card_w / 2 - 22, h - 126, 44, 5, WHITE, 90),
        ]
        if i == 1:
            card += [
                group([rect_shape(card_w - 16, 26, card_w / 2, h - 123, 7), fill(toggle(196, BLUE, MINT, 5), toggle(196, 0, 100, 5))]),
                group([path_shape([(card_w / 2 - 6, h - 123), (card_w / 2 - 1, h - 118), (card_w / 2 + 7, h - 128)]),
                       trim(toggle(200, 0, 100, 10)), stroke(INK, 2.5)]),
                group([rect_shape(card_w + 4, h - 92, card_w / 2, (h - 96) / 2, 12), stroke(MINT, 1.5, toggle(188, 0, 70, 6))]),
            ]
            items.append(moving(card, anim([(0, [x, y], 'hold'), (186, [x, y]), (192, [x, y - 5]), (R0, [x, y - 5]), (R1, [x, y])])))
        else:
            items.append(moving(card, (x, y)))
    return items


def landing(w, h):
    """A marketing page: a nav link underlines on hover, the CTA fires a toast."""
    items = chrome(w, h, 0.46)
    items += [dot(28, 58, 16, MINT), bar(44, 55, 64, 7, WHITE, 75)]
    for i in range(4):
        items.append(bar(w - 290 + i * 50, 55, 34, 6, WHITE, 55))
    items.append(group([path_shape([(w - 240, 66), (w - 206, 66)]), trim(toggle(226, 0, 100, 6)), stroke(MINT, 2)]))
    items += [box(w - 82, 46, 64, 22, 11, BLUE), bar(w - 66, 54, 32, 5, WHITE, 90)]
    items += [
        box(22, 88, 84, 16, 8, MINT, 20), bar(30, 93, 60, 5, MINT, 85),
        bar(22, 114, 240, 18, WHITE, 92), bar(22, 138, 190, 18, WHITE, 92),
        bar(22, 168, 250, 6, WHITE, 38), bar(22, 180, 230, 6, WHITE, 38), bar(22, 192, 150, 6, WHITE, 38),
        box(126, 214, 92, 32, 16, None, 100, WHITE, 25, 1.5), bar(146, 227, 52, 6, WHITE, 70),
    ]
    items.append(group([rect_shape(106, 32, 75, 230, 16), fill(toggle(256, BLUE, MINT, 5))]))
    items.append(group([rect_shape(106, 32, 75, 230, 16), fill(WHITE, anim(
        [(0, 0, 'hold'), (246, 0), (250, 14), (256, 0), (OP, 0)]))]))
    items.append(moving([rect_shape(56, 6, 0, 0, 3), fill(toggle(256, WHITE, INK, 5))], (75, 230)))
    items += [
        box(w - 262, 90, 240, 158, 14, grad=(BLUE, MINT, (w - 262, 248), (w - 22, 90))),
        dot(w - 70, 126, 26, WHITE, 70),
        group([path_shape([(w - 262, 248), (w - 196, 170), (w - 150, 212), (w - 110, 180), (w - 22, 248)], True), fill(NIGHT, 45)]),
        box(w - 244, 212, 110, 26, 8, NIGHT, 70), bar(w - 234, 219, 50, 5, WHITE, 80), bar(w - 234, 229, 30, 4, MINT, 80),
    ]
    for i in range(5):
        items.append(bar(22 + i * 104, 276, 70, 8, WHITE, 14))
    toast = [
        box(0, 0, 176, 44, 10, RAISED, 100, MINT, 45),
        dot(20, 22, 16, MINT),
        group([path_shape([(15, 22), (19, 26), (26, 18)]), stroke(INK, 2)]),
        bar(36, 14, 90, 6, WHITE, 85),
        bar(36, 26, 120, 5, WHITE, 45),
    ]
    items.append(moving(toast, toggle(260, [w - 196, 70], [w - 196, 84], 10), o=toggle(260, 0, 100, 8)))
    return items


def phone(w, h):
    """A phone app: tap the switch, it slides on, a notification drops in."""
    items = [
        box(5, 12, w, h, 28, BLACK, 32),
        box(0, 0, w, h, 28, NIGHT, 100, WHITE, 22, 2),
        box(8, 8, w - 16, h - 16, 22, PANEL),
        box(w / 2 - 26, 14, 52, 14, 7, BLACK),
        bar(22, 18, 22, 5, WHITE, 70), bar(w - 42, 18, 20, 5, WHITE, 70),
        bar(22, 46, 80, 10, WHITE, 90), dot(w - 32, 51, 18, BLUE_LIGHT, 80),
    ]
    for i in range(5):
        y = 76 + i * 44
        items += [dot(34, y + 16, 22, [MINT, BLUE_LIGHT, WHITE, MINT, BLUE_LIGHT][i], 70),
                  bar(52, y + 9, 70 - (i % 3) * 12, 6, WHITE, 75), bar(52, y + 20, 50, 5, WHITE, 35),
                  box(18, y + 38, w - 36, 1, 0, WHITE, 8)]
    items += [box(18, 300, w - 36, 1, 0, WHITE, 8), bar(22, 306, 60, 6, WHITE, 70)]
    items.append(group([rect_shape(34, 20, w - 42, 309, 10), fill(toggle(302, WHITE, MINT, 6), toggle(302, 25, 100, 6))]))
    items.append(moving([ellipse_shape(14, 14, 0, 0), fill(WHITE)], toggle(302, [w - 52, 309], [w - 32, 309], 8)))
    note = [box(0, 0, w - 24, 40, 12, RAISED, 100, WHITE, 18), dot(16, 20, 14, MINT), bar(30, 13, 70, 6, WHITE, 85),
            bar(30, 24, 90, 5, WHITE, 45)]
    items.append(moving(note, toggle(306, [12, -20], [12, 34], 12), o=toggle(306, 0, 100, 8)))
    return items


# ---------- Scene ----------


WINDOWS = [
    # name, builder, centre, size, bob phase
    ('signup', signup, (270, 185), (380, 280), 0),
    ('dashboard', dashboard, (1330, 175), (470, 310), 1),
    ('shop', shop, (1395, 720), (400, 300), 2),
    ('landing', landing, (790, 760), (560, 330), 3),
    ('phone', phone, (175, 690), (170, 340), 1),
]
CENTRES = {name: (centre, size) for name, _, centre, size, _ in WINDOWS}


def at(name, x, y):
    (cx, cy), (w, h) = CENTRES[name]
    return [cx - w / 2 + x, cy - h / 2 + y]


def shop_button():
    w, h = CENTRES['shop'][1]
    card_w = (w - 32 - 20) / 3
    return at('shop', 16 + card_w + 10 + card_w / 2, 80 - 5 + h - 123)


HOME = [800, 470]
# (arrive, target, click) — the cursor holds at each target until it leaves for the next.
PATH = [
    (18, at('signup', 120, 151), 22),
    (66, at('signup', 120, 203), 70),
    (92, at('signup', 190, 247), 98),
    (126, at('dashboard', 50, 138), 132),
    (182, shop_button(), 196),
    (222, at('landing', 560 - 222, 60), None),
    (246, at('landing', 75, 230), 256),
    (294, at('phone', 170 - 42, 309), 302),
]


def bob_layer(index, name, shapes, centre, size, phase):
    x, y = centre
    w, h = size
    cycle = [0, -4, 0, 4]
    cycle = cycle[phase:] + cycle[:phase]
    keys = [(round(step * OP / 4), [x, y + dy, 0]) for step, dy in enumerate(cycle + cycle[:1])]
    return {
        'ddd': 0, 'ind': index, 'ty': 4, 'nm': name, 'sr': 1,
        'ks': {'o': static(100), 'r': static(0), 'p': anim(keys, {'i': {'x': 0.45, 'y': 1}, 'o': {'x': 0.55, 'y': 0}}),
               'a': static([w / 2, h / 2, 0]), 's': static([100, 100, 100])},
        'ao': 0, 'shapes': shapes, 'ip': 0, 'op': OP, 'st': 0, 'bm': 0,
    }


def plain_layer(name, shapes, ks=None):
    return {
        'ddd': 0, 'ind': 0, 'ty': 4, 'nm': name, 'sr': 1,
        'ks': ks or {'o': static(100), 'r': static(0), 'p': static([0, 0, 0]), 'a': static([0, 0, 0]), 's': static([100, 100, 100])},
        'ao': 0, 'shapes': shapes, 'ip': 0, 'op': OP, 'st': 0, 'bm': 0,
    }


layers = []
for name, build, centre, size, phase in WINDOWS:
    # Built bottom-up for readability; Lottie paints the first shape on top, so flip it.
    layers.append(bob_layer(0, name, build(*size)[::-1], centre, size, phase))

ripples = []
for arrive, target, click in PATH:
    if click is None:
        continue
    ripples.append(moving([ellipse_shape(20, 20, 0, 0), stroke(MINT, 2)], target,
                          s=pulse(click, [30, 30], [260, 260], 16), o=anim([(0, 0, 'hold'), (click, 90), (click + 16, 0), (OP, 0)])))
    ripples.append(moving([ellipse_shape(20, 20, 0, 0), fill(MINT, 35)], target,
                          s=pulse(click, [20, 20], [120, 120], 10), o=anim([(0, 0, 'hold'), (click, 100), (click + 12, 0), (OP, 0)])))

pos = [(0, HOME)]
scale = [(0, [100, 100, 100])]
held_until = 4
for arrive, target, click in PATH:
    pos.append((held_until, pos[-1][1]))
    pos.append((arrive, target))
    held_until = (click or arrive) + 6
    if click:
        scale += [(click - 2, [100, 100, 100]), (click + 1, [82, 82, 100]), (click + 7, [100, 100, 100])]
pos += [(held_until, pos[-1][1]), (330, HOME), (OP, HOME)]
scale.append((OP, [100, 100, 100]))

arrow = [(0, 0), (0, 25), (6.5, 19), (11, 29), (15, 27.5), (10.5, 17.5), (18, 17.5)]
cursor = plain_layer('cursor', [
    group([path_shape(arrow, True), stroke(BLACK, 1.4), fill(WHITE)]),
    group([path_shape([(x + 2, y + 3) for x, y in arrow], True), fill(BLACK, 35)]),
], {
    'o': static(100), 'r': static(0), 'a': static([0, 0, 0]),
    'p': anim([(t, [x, y, 0]) for t, (x, y) in pos], {'i': {'x': 0.3, 'y': 1}, 'o': {'x': 0.7, 'y': 0}}),
    's': anim(scale),
})

all_layers = [cursor, plain_layer('ripples', ripples)] + layers[::-1]
for index, item in enumerate(all_layers, start=1):
    item['ind'] = index

doc = {'v': '5.7.4', 'fr': FR, 'ip': 0, 'op': OP, 'w': W, 'h': H, 'nm': 'IHP+ IT hero — a web in use',
       'ddd': 0, 'assets': [], 'layers': all_layers}
with open(sys.argv[1], 'w', encoding='utf-8') as out:
    json.dump(doc, out, separators=(',', ':'))
