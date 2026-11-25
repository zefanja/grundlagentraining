"""Erzeugt Eingangstest, Satzblätter und Sprintblätter (A4, PDF) für das Grundaufgaben-Training."""
import random
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit

import os
FD = os.environ.get('FONT_DIR', '/usr/share/fonts/truetype/dejavu/').rstrip('/') + '/'
pdfmetrics.registerFont(TTFont('Sans', FD + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('SansB', FD + 'DejaVuSans-Bold.ttf'))
TEAL = HexColor('#0f6e6e'); GREY = HexColor('#5b6b69'); LINE = HexColor('#b9cbc8'); SOFT = HexColor('#eef6f5'); CORAL = HexColor('#d9452f')
W, H = A4
M = 16 * mm
MINUS, DOT = '−', '·'

# ---------------- Faktensätze ----------------
SETS = [
    ('A1', '+0, +1, +2', 'Nachbarzahl: +1 ist die nächste Zahl, +2 die übernächste.', '7 + 2: nach 7 kommt 8, dann 9.'),
    ('A2', 'Zehnerfreunde, +10', 'Zehnerfreunde ergeben zusammen 10. +10: die Zehnerstelle wird um 1 größer.', '6 + 4 = 10, also 10 − 4 = 6.'),
    ('A3', 'Verdoppeln bis 10 + 10', 'Doppelte zuerst sicher auswendig: 6 + 6, 7 + 7, 8 + 8 …', '8 + 8 = 16, also 16 − 8 = 8.'),
    ('A4', 'Fast-Verdoppeln', 'Nachbarn: das Doppelte der kleineren Zahl plus 1.', '7 + 8 = 7 + 7 + 1 = 15.'),
    ('A5', '+9', 'Plus 9 ist plus 10 und dann 1 weniger.', '6 + 9 = 16 − 1 = 15.'),
    ('A6', 'Zehnerübergang mit 8 und 7', 'Erst bis zur 10 auffüllen, dann den Rest dazu.', '8 + 5 = 8 + 2 + 3 = 13.'),
    ('A7', 'Restliche Plusaufgaben', 'Gemischt: Nutze die Aufgabe, die du schon kannst.', '4 + 7: 7 + 3 = 10, plus 1 = 11.'),
    ('M1', DOT + '0, ' + DOT + '1, ' + DOT + '10', 'Mal 0 ist 0. Mal 1 bleibt die Zahl. Mal 10 hängt eine 0 an.', '7 ' + DOT + ' 10 = 70, also 70 : 10 = 7.'),
    ('M2', DOT + '2, ' + DOT + '5', 'Mal 2 ist verdoppeln. Mal 5 ist die Hälfte von mal 10.', '8 ' + DOT + ' 5 = 80 : 2 = 40.'),
    ('M3', DOT + '9', 'Mal 9 ist mal 10 und dann einmal weniger.', '7 ' + DOT + ' 9 = 70 − 7 = 63.'),
    ('M4', 'Quadratzahlen', 'Ankerfakten: auswendig lernen, sie tragen die anderen.', '7 ' + DOT + ' 7 = 49, 8 ' + DOT + ' 8 = 64.'),
    ('M5', DOT + '4', 'Mal 4 ist doppelt verdoppeln.', '4 ' + DOT + ' 7: 2 ' + DOT + ' 7 = 14, doppelt = 28.'),
    ('M6', DOT + '3', 'Mal 3 ist mal 2 und einmal mehr.', '3 ' + DOT + ' 7 = 14 + 7 = 21.'),
    ('M7', '6 ' + DOT + ' 7, 6 ' + DOT + ' 8, 7 ' + DOT + ' 8', 'Vom Quadrat aus: eine Reihe mehr.', '7 ' + DOT + ' 8 = 7 ' + DOT + ' 7 + 7 = 56.'),
]
IDS = [s[0] for s in SETS]
INFO = {s[0]: s for s in SETS}

def candidates(sid):
    R = range(11)
    c = {
        'A1': [(a, b) for b in (0, 1, 2) for a in R],
        'A2': [(a, 10 - a) for a in range(1, 6)] + [(a, 10) for a in R],
        'A3': [(a, a) for a in range(3, 11)],
        'A4': [(a, a + 1) for a in range(2, 10)],
        'A5': [(a, 9) for a in R],
        'A6': [(8, a) for a in range(3, 10)] + [(7, a) for a in range(3, 10)],
        'A7': [(a, b) for a in R for b in R],
        'M1': [(a, b) for b in (0, 1, 10) for a in R],
        'M2': [(a, b) for b in (2, 5) for a in R],
        'M3': [(a, 9) for a in R],
        'M4': [(a, a) for a in (3, 4, 6, 7, 8)],
        'M5': [(4, b) for b in (3, 6, 7, 8)],
        'M6': [(3, b) for b in (6, 7, 8)],
        'M7': [(6, 7), (6, 8), (7, 8)],
    }
    return c[sid]

PAIRS = {}
seen = {'A': set(), 'M': set()}
for sid in IDS:
    tr = sid[0]; out = []
    for a, b in candidates(sid):
        k = (min(a, b), max(a, b))
        if k not in seen[tr]:
            seen[tr].add(k); out.append(k)
    PAIRS[sid] = out
assert len(seen['A']) == 66 and len(seen['M']) == 66

def family(sid, pair, op=None):
    """Alle Aufgaben einer Faktenfamilie. op: '+','-','*',':' filtert."""
    a, b = pair; F = []
    if sid[0] == 'A':
        s = a + b
        F += [('+', f'{a} + {b}', s)] + ([('+', f'{b} + {a}', s)] if a != b else [])
        F += [('-', f'{s} {MINUS} {a}', b)] + ([('-', f'{s} {MINUS} {b}', a)] if a != b else [])
    else:
        p = a * b
        F += [('*', f'{a} {DOT} {b}', p)] + ([('*', f'{b} {DOT} {a}', p)] if a != b else [])
        if a: F.append((':', f'{p} : {a}', b))
        if b and a != b: F.append((':', f'{p} : {b}', a))
    return [(t, r, sid) for o, t, r in F if op is None or o == op]

def facts(sid, op=None):
    return [f for p in PAIRS[sid] for f in family(sid, p, op)]

def digits(n): return len(str(n))

def draw_seq(pools, n, rnd):
    """pools: [(liste, anzahl)] -> gemischte Folge ohne direkte Wiederholung."""
    items = []
    for pool, k in pools:
        if not pool or k <= 0: continue
        bag = []
        while len(bag) < k:
            p = pool[:]; rnd.shuffle(p); bag += p
        items += bag[:k]
    for _ in range(200):
        rnd.shuffle(items)
        if all(items[i][0] != items[i + 1][0] for i in range(len(items) - 1)):
            break
    return items[:n]

def sprint_items(i, variant, n=60):
    sid = IDS[i]; tr = sid[0]
    rnd = random.Random(f'{sid}-{variant}')
    track = [x for x in IDS[:i] if x[0] == tr]
    cur = facts(sid); prev = [f for x in track[-2:] for f in facts(x)]; old = [f for x in track[:-2] for f in facts(x)]
    scr = 0
    if tr == 'M':
        scr = 4
        add = [f for x in IDS if x[0] == 'A' for f in facts(x)]
    w = [(cur, 50), (prev, 30 if prev else 0), (old, 20 if old else 0)]
    tot = sum(k for _, k in w); m = n - scr
    counts = [round(m * k / tot) for _, k in w]
    counts[0] += m - sum(counts)
    pools = [(p, c) for (p, _), c in zip(w, counts)]
    if scr: pools.append((add, scr))
    return draw_seq(pools, n, rnd)

def mix_note(i):
    sid = IDS[i]; track = [x for x in IDS[:i] if x[0] == sid[0]]
    if not track: return 'nur dieser Satz' + (' plus 4 Plus-/Minusaufgaben' if sid[0] == 'M' else '')
    if len(track) <= 2: return 'etwa 60 % dieser Satz, 40 % die Sätze davor' + (', plus 4 Plus-/Minusaufgaben' if sid[0] == 'M' else '')
    return '50 % dieser Satz, 30 % die zwei Sätze davor, 20 % ältere' + (', plus 4 Plus-/Minusaufgaben' if sid[0] == 'M' else '')

# ---------------- Zeichenhilfen ----------------
def header(c, title, right='', sub=None):
    c.setFillColor(TEAL); c.rect(0, H - 24 * mm, W, 24 * mm, stroke=0, fill=1)
    c.setFillColor(white); c.setFont('SansB', 18); c.drawString(M, H - 14 * mm, title)
    if right: c.setFont('Sans', 11); c.drawRightString(W - M, H - 14 * mm, right)
    if sub: c.setFont('Sans', 9); c.drawString(M, H - 20 * mm, sub)
    c.setFillColor(black)

def fields(c, y, extra=None):
    c.setFont('Sans', 10); c.setFillColor(GREY)
    parts = [('Name', 70 * mm), ('Klasse', 25 * mm), ('Datum', 35 * mm)] + (extra or [])
    x = M
    for lab, wd in parts:
        c.drawString(x, y, lab)
        lw = c.stringWidth(lab, 'Sans', 10) + 2 * mm
        c.setStrokeColor(LINE); c.line(x + lw, y - 1, x + wd - 4 * mm, y - 1); x += wd
    c.setFillColor(black)

def para(c, text, x, y, width, font='Sans', size=10, leading=None, color=black):
    leading = leading or size * 1.35
    c.setFont(font, size); c.setFillColor(color)
    for line in simpleSplit(text, font, size, width):
        c.drawString(x, y, line); y -= leading
    c.setFillColor(black)
    return y

def footer(c, text):
    c.setFont('Sans', 8); c.setFillColor(GREY); c.drawString(M, 9 * mm, text)
    c.drawRightString(W - M, 9 * mm, 'Grundaufgaben-Training Kl. 5–7'); c.setFillColor(black)

def grid(c, items, top, bottom, cols, rows, size, solution=False, tag=False):
    """Aufgabengitter. Reihenfolge: Zeile für Zeile, links nach rechts."""
    left, right = M + 10 * mm, W - M - (14 * mm if solution else 0)
    cw = (right - left) / cols; rh = (top - bottom) / rows
    cum = 0
    for r in range(rows):
        y = top - (r + 0.68) * rh
        c.setFont('Sans', 8); c.setFillColor(GREY); c.drawRightString(M + 4 * mm, y + 1, str(r + 1))
        if r % 2 == 0:
            c.setFillColor(SOFT); c.rect(left - 2 * mm, top - (r + 1) * rh + 1, right - left + 2 * mm, rh - 2, stroke=0, fill=1)
        for k in range(cols):
            idx = r * cols + k
            if idx >= len(items): continue
            t, res, sid = items[idx]
            x = left + k * cw
            c.setFillColor(black); c.setFont('Sans', size)
            ex = x + cw * 0.58
            c.drawRightString(ex, y, t + ' =')
            if solution:
                c.setFont('SansB', size); c.setFillColor(TEAL); c.drawString(ex + 2 * mm, y, str(res))
                if tag:
                    c.setFont('Sans', 6.5); c.setFillColor(GREY); c.drawString(ex + 2 * mm + c.stringWidth(str(res), 'SansB', size) + 1.2 * mm, y + 2, sid)
                cum += 1
            else:
                c.setStrokeColor(LINE); c.line(ex + 2 * mm, y - 2, x + cw - 4 * mm, y - 2)
        if solution:
            c.setFont('Sans', 8); c.setFillColor(GREY); c.drawRightString(W - M, y, f'bis hier {cum}')
    c.setFillColor(black)
    return cum

# ---------------- Sprintblätter ----------------
def sprint_pdf(path):
    c = canvas.Canvas(path, pagesize=A4); c.setTitle('Sprintblätter Grundaufgaben')
    for i, sid in enumerate(IDS):
        for v in range(1, 5):
            items = sprint_items(i, v)
            for sol in (False, True):
                name = INFO[sid][1]
                header(c, ('Lösung · ' if sol else 'Sprint · ') + f'Satz {sid}', f'{name} · Variante {v}',
                       'Rechts: Anzahl der Aufgaben bis zum Zeilenende. Klein: Satz der Aufgabe (für die Reparaturliste).' if sol else None)
                if not sol:
                    fields(c, H - 33 * mm)
                    para(c, '1 Minute. Zeile für Zeile von links nach rechts. Bei einer Aufgabe nicht hängen bleiben, sondern weiter. Auswerten: letzte bearbeitete Zeile × 4, minus Fehler und Lücken.', M, H - 41 * mm, W - 2 * M, size=9.5, color=GREY)
                top = H - 46 * mm; bottom = 32 * mm
                grid(c, items, top, bottom, 4, 15, 14, solution=sol, tag=sol)
                if not sol:
                    c.setStrokeColor(TEAL); c.setLineWidth(1); c.roundRect(M, 14 * mm, W - 2 * M, 13 * mm, 3 * mm)
                    c.setFont('SansB', 11); c.setFillColor(TEAL)
                    xs = [M + 5 * mm, M + 65 * mm, M + 115 * mm]
                    for x, lab in zip(xs, ['Richtige Aufgaben: ______', 'Fehler: ____', 'Mein Ziel: ______']):
                        c.drawString(x, 19 * mm, lab)
                    c.setLineWidth(1); c.setFillColor(black)
                footer(c, f'Satz {sid} · Variante {v}' + (' · Lösung' if sol else '') + ' · ' + mix_note(i))
                c.showPage()
    c.save()

# ---------------- Satzblätter (Cover-Copy-Compare) ----------------
SCRIPT = {
    'A1': ('7 plus 1 ist die nächste Zahl: 8. 7 plus 2 ist 9.', '6 + 2? 9 + 1? 8 − 2?'),
    'A2': ('6 und 4 sind Zehnerfreunde. 6 plus 4 ist 10. 10 minus 4 ist 6.', '3 + 7? 10 − 8? 5 + 10?'),
    'A3': ('7 plus 7 ist 14. 14 minus 7 ist 7.', '8 + 8? 14 − 7? 9 + 9?'),
    'A4': ('7 plus 8: 7 plus 7 ist 14, eins mehr: 15.', '6 + 7? 15 − 8? 8 + 9?'),
    'A5': ('6 plus 9: 6 plus 10 ist 16, eins weniger: 15.', '4 + 9? 15 − 9? 9 + 7?'),
    'A6': ('8 plus 5: 8 plus 2 ist 10, plus 3 ist 13.', '8 + 6? 13 − 5? 7 + 5?'),
    'A7': ('3 plus 5 ist 8. 8 minus 3 ist 5.', '3 + 6? 9 − 3? 5 + 3?'),
    'M1': ('7 mal 10 ist 70. 70 durch 10 ist 7. Mal 0 ist immer 0.', '8 · 10? 9 · 1? 60 : 10?'),
    'M2': ('8 mal 5: 8 mal 10 ist 80, die Hälfte ist 40.', '7 · 5? 6 · 2? 45 : 5?'),
    'M3': ('7 mal 9: 7 mal 10 ist 70, minus 7 ist 63.', '6 · 9? 63 : 9? 9 · 8?'),
    'M4': ('7 mal 7 ist 49. 49 durch 7 ist 7.', '8 · 8? 36 : 6? 7 · 7?'),
    'M5': ('4 mal 7: 2 mal 7 ist 14, doppelt ist 28.', '4 · 8? 28 : 4? 6 · 4?'),
    'M6': ('3 mal 7: 2 mal 7 ist 14, plus 7 ist 21.', '3 · 8? 21 : 3? 6 · 3?'),
    'M7': ('7 mal 8: 7 mal 7 ist 49, plus 7 ist 56.', '8 · 7? 56 : 8? 6 · 8?'),
}

def ccc_items(sid):
    full = facts(sid)
    if len(full) <= 26: return full
    items = []
    for p in PAIRS[sid]:
        fam = family(sid, p)
        items.append(fam[0])
        inv = [f for f in fam if ('−' in f[0] or ':' in f[0])]
        if inv: items.append(inv[0])
    if len(items) > 26:
        rnd = random.Random('ccc-' + sid); items = rnd.sample(items, 26)
    return items

def satz_pdf(path):
    c = canvas.Canvas(path, pagesize=A4); c.setTitle('Satzblätter und Einführungsskripte')
    # Lehrkraft: Einführungsskripte
    header(c, 'Einführungsskripte für die Lehrkraft', 'Model – Lead – Test')
    y = para(c, 'So läuft die Einführung eines Satzes (1–2 Minuten): Modell vorsprechen, im Chor mit Handsignal mitsprechen lassen, dann testen (auch Tausch- und Umkehraufgabe). Danach gezieltes Drannehmen, zuerst unsichere Kinder. Nach zwei anderen Aufgaben die neue Aufgabe noch einmal (verzögerter Test). Bei einem Fehler: sofort korrekte Antwort sagen, Chor wiederholen, später erneut fragen.', M, H - 33 * mm, W - 2 * M, size=10)
    y -= 4 * mm
    c.setFont('SansB', 9); c.setFillColor(GREY)
    c.drawString(M, y, 'Satz'); c.drawString(M + 14 * mm, y, 'Inhalt'); c.drawString(M + 52 * mm, y, 'Modell (Lehrkraft sagt)'); c.drawString(M + 130 * mm, y, 'Testfragen')
    y -= 3 * mm; c.setStrokeColor(LINE); c.line(M, y, W - M, y); y -= 5 * mm
    for sid in IDS:
        mod, test = SCRIPT[sid]
        c.setFont('SansB', 10); c.setFillColor(TEAL); c.drawString(M, y, sid)
        c.setFont('Sans', 9); c.setFillColor(black)
        y1 = para(c, INFO[sid][1], M + 14 * mm, y, 36 * mm, size=9)
        y2 = para(c, mod, M + 52 * mm, y, 74 * mm, size=9)
        y3 = para(c, test, M + 130 * mm, y, W - M - (M + 130 * mm), size=9)
        y = min(y1, y2, y3) - 2 * mm; c.setStrokeColor(LINE); c.line(M, y + 1.5 * mm, W - M, y + 1.5 * mm); y -= 3 * mm
    footer(c, 'Einführungsskripte'); c.showPage()

    for sid in IDS:
        name, strat, ex = INFO[sid][1], INFO[sid][2], INFO[sid][3]
        header(c, f'Satzblatt {sid}', name)
        fields(c, H - 33 * mm)
        c.setFillColor(SOFT); c.roundRect(M, H - 58 * mm, W - 2 * M, 19 * mm, 3 * mm, stroke=0, fill=1)
        c.setFillColor(TEAL); c.setFont('SansB', 11); c.drawString(M + 4 * mm, H - 45 * mm, 'So geht’s')
        para(c, strat + '  Beispiel: ' + ex, M + 4 * mm, H - 51 * mm, W - 2 * M - 8 * mm, size=10)
        para(c, 'Abdecken – Aufschreiben – Vergleichen: Lies die Aufgabe mit Lösung. Decke sie ab. Schreibe Aufgabe und Lösung aus dem Kopf auf. Decke auf und vergleiche. Richtig: Haken. Falsch: durchstreichen und noch einmal.', M, H - 64 * mm, W - 2 * M, size=9.5, color=GREY)
        items = ccc_items(sid)
        top = H - 82 * mm; bottom = 18 * mm
        rows = len(items); rh = min(9.5 * mm, (top - bottom) / max(rows, 1))
        cols = [M, M + 52 * mm, M + 132 * mm, W - M]
        c.setFont('SansB', 9); c.setFillColor(GREY)
        c.drawString(cols[0], top + 2 * mm, 'Ansehen'); c.drawString(cols[1], top + 2 * mm, 'Abdecken und aufschreiben'); c.drawString(cols[2], top + 2 * mm, 'Vergleichen')
        for r, (t, res, _) in enumerate(items):
            y = top - (r + 0.7) * rh
            if r % 2 == 0:
                c.setFillColor(SOFT); c.rect(M, top - (r + 1) * rh, W - 2 * M, rh, stroke=0, fill=1)
            c.setFillColor(black); c.setFont('Sans', 12); c.drawString(cols[0] + 2 * mm, y, f'{t} = {res}')
            c.setStrokeColor(LINE); c.line(cols[1], y - 2, cols[2] - 8 * mm, y - 2)
            c.rect(cols[2] + 2 * mm, y - 2, 4 * mm, 4 * mm)
            c.rect(cols[2] + 10 * mm, y - 2, 4 * mm, 4 * mm)
            c.rect(cols[2] + 18 * mm, y - 2, 4 * mm, 4 * mm)
        c.setFont('Sans', 8); c.setFillColor(GREY); c.drawString(cols[2] + 2 * mm, bottom - 3 * mm, 'drei Kästchen = drei Durchgänge')
        footer(c, f'Satzblatt {sid} · alle Aufgaben des Satzes mit Umkehraufgabe' + (' (Auswahl)' if len(items) == 26 else ''))
        c.showPage()

    # Begleitblätter: Kurvenblatt + Reparaturliste
    header(c, 'Mein Kurvenblatt', 'Richtige Aufgaben pro Minute')
    fields(c, H - 33 * mm, [('Mein Ziel', 35 * mm)])
    para(c, 'Nach jedem Sprint: Punkt bei deiner Zahl richtiger Aufgaben eintragen und mit dem letzten Punkt verbinden. Zeichne dein Ziel als Linie ein. Bei einem neuen Satz: senkrechten Strich und Satz darüber schreiben.', M, H - 41 * mm, W - 2 * M, size=9.5, color=GREY)
    gl, gr, gb, gt = M + 10 * mm, W - M, 22 * mm, H - 52 * mm
    days, maxv = 40, 60
    c.setStrokeColor(LINE); c.setLineWidth(0.4)
    for d in range(days + 1):
        x = gl + d * (gr - gl) / days; c.line(x, gb, x, gt)
        if d and d % 5 == 0: c.setFont('Sans', 7); c.setFillColor(GREY); c.drawCentredString(x, gb - 4 * mm, str(d))
    for v in range(0, maxv + 1, 5):
        y = gb + v * (gt - gb) / maxv
        c.setLineWidth(0.8 if v % 10 == 0 else 0.3); c.line(gl, y, gr, y)
        if v % 10 == 0: c.setFont('Sans', 7); c.setFillColor(GREY); c.drawRightString(gl - 2 * mm, y - 2, str(v))
    c.setLineWidth(1); c.setFont('Sans', 8); c.drawString(gl, gb - 9 * mm, 'Sprint Nr.')
    footer(c, 'Kurvenblatt'); c.showPage()

    header(c, 'Meine Reparaturliste', 'Falsche oder ausgelassene Aufgaben')
    fields(c, H - 33 * mm)
    para(c, 'Jede falsche Aufgabe hier eintragen und dreimal üben: abdecken, aufschreiben, vergleichen. Sitzt sie in einem späteren Sprint, darf sie abgehakt werden.', M, H - 41 * mm, W - 2 * M, size=9.5, color=GREY)
    top = H - 50 * mm; rh = 8.5 * mm
    hdr = [('Datum', 0), ('Aufgabe = Lösung', 26), ('1.', 82), ('2.', 108), ('3.', 134), ('sitzt ✓', 160)]
    c.setFont('SansB', 9); c.setFillColor(GREY)
    for lab, off in hdr: c.drawString(M + off * mm, top, lab)
    for r in range(28):
        y = top - 3 * mm - r * rh
        c.setStrokeColor(LINE); c.line(M, y - rh + 2 * mm, W - M, y - rh + 2 * mm)
    footer(c, 'Reparaturliste'); c.showPage()
    c.save()

# ---------------- Eingangstest ----------------
def mix_items(op, form, n=100):
    rnd = random.Random(f'eingang-{op}-{form}')
    tr = 'A' if op in '+-' else 'M'
    sets = [s for s in IDS if s[0] == tr]
    per = n // len(sets); extra = n - per * len(sets)
    pools = [(facts(s, op), per + (1 if k < extra else 0)) for k, s in enumerate(sets)]
    return draw_seq(pools, n, rnd)

OPS = [('+', 'Addition'), ('-', 'Subtraktion'), ('*', 'Multiplikation'), (':', 'Division')]

def eingang_pdf(path):
    c = canvas.Canvas(path, pagesize=A4); c.setTitle('Eingangstest Grundaufgaben')
    # Anleitung
    header(c, 'Eingangstest: Anleitung', 'für die Lehrkraft · etwa 25 Minuten')
    y = H - 34 * mm
    blocks = [
        ('Wozu', 'Der Test legt für jedes Kind drei Dinge fest: das persönliche Sprintziel, die Gruppe (A Aufbau, B Tempo, C Sicher) und den Startsatz. Form A dient als Eingangstest, Form B als Halbjahrestest mit denselben Regeln.'),
        ('Ablauf', '1. Schreibtempo-Test, 1 Minute. 2. Vier Mischsprints (Addition, Subtraktion, Multiplikation, Division), je 2 Minuten und 100 Aufgaben, mit kurzer Pause dazwischen. Ansage: „Zeile für Zeile von links nach rechts. Wenn du eine Aufgabe nicht weißt, lass sie aus und mach weiter. Niemand muss fertig werden.“ 3. Kurzinterview (2 Minuten pro Kind) nur mit den Kindern, die in einem Sprint 4 oder mehr Fehler hatten oder auffällig langsam waren.'),
        ('Auswerten', 'Schreibtempo: Anzahl der geschriebenen Ziffern. Ziel in richtigen Aufgaben pro Minute = Schreibtempo geteilt durch 2,5, gerundet (Beispiel: 90 Ziffern → Ziel 36 Aufgaben). Mischsprints: richtige Aufgaben zählen (letzte bearbeitete Zeile × 4, minus Fehler und Lücken; das Lösungsblatt zeigt rechts die Aufgabenzahl bis zum Zeilenende) und durch 2 teilen, weil der Sprint 2 Minuten dauert. Fehler zählen. Neben jeder Lösung steht klein der Satz der Aufgabe: Kreise bei jedem Fehler den Satz ein.'),
        ('Gruppe', 'C Sicher: alle vier Werte mindestens so hoch wie das Ziel und höchstens 2 Fehler pro Sprint. A Aufbau: in mindestens einem Sprint 4 oder mehr Fehler, oder im Interview sichtbares Zählen. B Tempo: alle übrigen Kinder (meist richtig, aber unter dem Ziel).'),
        ('Startsatz', 'Gruppe A und B: der früheste Satz, in dem ein Fehler eingekreist ist. Addition und Subtraktion zählen für die A-Sätze, Multiplikation und Division für die M-Sätze. Liegen Addition und Subtraktion über dem Ziel, beginnt das Kind in den M-Sätzen. Ein Kind ohne Fehler, aber unter dem Ziel, beginnt in Stufe Flüssigkeit mit A6 (wenn Plus oder Minus langsam ist) oder sonst mit M4. Gruppe C: Erweiterungspfad, einmal pro Woche ein Erhaltungssprint.'),
        ('In die App', 'Im Sprint-Tracker unter „Verwalten“: Kürzel, Gruppe, Schreibtempo, Satz und Stufe eintragen (Stufe Akquisition bei Gruppe A, sonst Flüssigkeit). Die vier Werte unter „Schüler“ als Eingangstest speichern.'),
    ]
    for t, txt in blocks:
        c.setFont('SansB', 11); c.setFillColor(TEAL); c.drawString(M, y, t)
        y = para(c, txt, M + 28 * mm, y, W - 2 * M - 28 * mm, size=10) - 4 * mm
    footer(c, 'Eingangstest · Anleitung'); c.showPage()

    # Schreibtempo
    header(c, 'Schreibtempo', '1 Minute')
    fields(c, H - 33 * mm)
    para(c, 'Schreibe die Ziffern 0 1 2 3 4 5 6 7 8 9 immer wieder der Reihe nach, eine Ziffer pro Kästchen, so schnell du sauber schreiben kannst. Auf das Startsignal warten.', M, H - 41 * mm, W - 2 * M, size=10)
    bx = 9 * mm; cols = int((W - 2 * M) // bx); top = H - 56 * mm
    c.setStrokeColor(LINE)
    for r in range(22):
        for k in range(cols):
            c.rect(M + k * bx, top - r * (bx + 1.5 * mm), bx, bx)
    c.setFont('SansB', 11); c.setFillColor(TEAL); c.drawString(M, 16 * mm, 'Geschriebene Ziffern: ______        Ziel (÷ 2,5) in Aufgaben: ______')
    footer(c, 'Eingangstest · Schreibtempo'); c.showPage()

    for form in ('A', 'B'):
        for op, name in OPS:
            items = mix_items(op, form)
            for sol in (False, True):
                header(c, ('Lösung · ' if sol else '') + f'Mischsprint {name}', f'Form {form} · 2 Minuten',
                       'Rechts: Anzahl der Aufgaben bis zum Zeilenende. Klein: Satz der Aufgabe.' if sol else None)
                if not sol:
                    fields(c, H - 33 * mm)
                    para(c, 'Zeile für Zeile von links nach rechts. Wenn du eine Aufgabe nicht weißt: auslassen und weiter. Niemand muss fertig werden.', M, H - 41 * mm, W - 2 * M, size=9.5, color=GREY)
                grid(c, items, H - 46 * mm, 30 * mm, 4, 25, 11.5, solution=sol, tag=sol)
                if not sol:
                    c.setStrokeColor(TEAL); c.roundRect(M, 13 * mm, W - 2 * M, 12 * mm, 3 * mm)
                    c.setFont('SansB', 10.5); c.setFillColor(TEAL)
                    c.drawString(M + 5 * mm, 17.5 * mm, 'Richtige Aufgaben: ______      ÷ 2 = ______ pro Minute      Fehler: ____')
                    c.setFillColor(black)
                footer(c, f'Eingangstest · Form {form} · {name}' + (' · Lösung' if sol else ''))
                c.showPage()

    # Interviewbogen
    tasks = ['7 + 8', '13 ' + MINUS + ' 6', '9 + 6', '6 ' + DOT + ' 7', '56 : 8', '4 ' + DOT + ' 8']
    header(c, 'Kurzinterview', 'nur für auffällige Kinder · 2 Minuten')
    para(c, 'Aufgabe mündlich stellen, Antwort abwarten, Vorgehen ankreuzen. Abruf = Antwort innerhalb von etwa 3 Sekunden ohne sichtbares Rechnen. Bei Ableitung kurz notieren, wie (z. B. „7 + 7 + 1“).', M, H - 33 * mm, W - 2 * M, size=9.5, color=GREY)
    colx = [M, M + 28 * mm, M + 50 * mm, M + 72 * mm, M + 94 * mm, M + 116 * mm]
    heads = ['Aufgabe', 'Abruf', 'Ableitung', 'Zählen', 'falsch', 'Notiz']
    for blk in range(2):
        top = H - 46 * mm - blk * 118 * mm
        c.setFont('SansB', 11); c.setFillColor(TEAL); c.drawString(M, top, 'Kürzel: ________     Datum: ________')
        y = top - 9 * mm
        c.setFont('SansB', 9); c.setFillColor(GREY)
        for x, hd in zip(colx, heads): c.drawString(x, y, hd)
        y -= 3 * mm; c.setStrokeColor(LINE); c.line(M, y, W - M, y)
        for t in tasks:
            y -= 11 * mm
            c.setFont('Sans', 12); c.setFillColor(black); c.drawString(colx[0], y + 3 * mm, t + ' =')
            for x in colx[1:5]: c.rect(x + 2 * mm, y + 2.5 * mm, 4 * mm, 4 * mm)
            c.line(M, y, W - M, y)
        c.setFont('Sans', 9); c.setFillColor(GREY); c.drawString(M, y - 8 * mm, 'Eindruck / Gruppe:')
        c.line(M + 32 * mm, y - 8.5 * mm, W - M, y - 8.5 * mm)
    footer(c, 'Eingangstest · Kurzinterview'); c.showPage()

    # Klassenauswertung
    header(c, 'Klassenauswertung', 'Eingangstest · Klasse ______   Datum ______')
    para(c, 'Schreibtempo in Ziffern pro Minute, alle anderen Werte in richtigen Aufgaben pro Minute. Ziel = Schreibtempo ÷ 2,5. Fehler-Sätze: alle Sätze, in denen ein Fehler eingekreist wurde.', M, H - 33 * mm, W - 2 * M, size=9.5, color=GREY)
    heads = [('Kürzel', 0), ('Schreib-\ntempo', 20), ('Ziel', 38), ('+', 52), (MINUS, 64), (DOT, 76), (':', 88), ('Fehler-Sätze', 100), ('Gruppe', 140), ('Startsatz', 158)]
    top = H - 44 * mm
    for lab, off in heads:
        c.setFont('SansB', 9); c.setFillColor(GREY)
        for j, part in enumerate(lab.split('\n')): c.drawString(M + off * mm, top - j * 3.6 * mm, part)
    rh = 7.6 * mm; y = top - 7 * mm
    c.setStrokeColor(LINE)
    for r in range(30):
        c.line(M, y - r * rh, W - M, y - r * rh)
    for lab, off in heads[1:]:
        c.line(M + off * mm - 2 * mm, y, M + off * mm - 2 * mm, y - 29 * rh)
    footer(c, 'Eingangstest · Klassenauswertung'); c.showPage()
    c.save()

if __name__ == '__main__':
    import os
    out = os.environ.get('OUT_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')); os.makedirs(out, exist_ok=True)
    eingang_pdf(out + '/Eingangstest_Grundaufgaben.pdf')
    satz_pdf(out + '/Satzblaetter_Grundaufgaben.pdf')
    sprint_pdf(out + '/Sprintblaetter_Grundaufgaben.pdf')
    for s in IDS: print(s, len(PAIRS[s]), 'Paare,', len(facts(s)), 'Aufgaben')
