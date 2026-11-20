"""shortkit: motion-graphics renderer for vertical maths Shorts (1080x1920, 30 fps).

A Short is a list of timed elements (cards, text, emoji, stamps, bars, counters,
countdown rings, confetti) plus sound-effect cues. Background music and SFX are
synthesised with numpy, so no outside assets are needed besides the fonts folder.
"""
import math, os, random, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS, SR = 1080, 1920, 30, 44100
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = {
    "x": os.path.join(HERE, "fonts/poppins-latin-800-normal.woff"),
    "b": os.path.join(HERE, "fonts/poppins-latin-700-normal.woff"),
    "s": os.path.join(HERE, "fonts/poppins-latin-600-normal.woff"),
    "te": os.path.join(HERE, "fonts/noto-sans-telugu-telugu-800-normal.woff"),
}
EMOJI = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
YEL, WHITE, BLACK = (255, 214, 0), (255, 255, 255), (20, 14, 40)
RED, GREEN, CYAN, PINK = (255, 59, 92), (0, 214, 120), (0, 200, 255), (255, 92, 200)

_fc = {}
def font(kind, size):
    k = (kind, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(FONT[kind], size)
    return _fc[k]

def is_telugu(s):
    return any("ఀ" <= ch <= "౿" for ch in s)

# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def out_cubic(p): return 1 - (1 - p) ** 3
def out_back(p, c=1.9):
    return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2

# ---------------------------------------------------------------- sprites
def _runs(txt):
    """Split into (text, font kind) runs: Telugu letters use the Telugu face, the rest Poppins."""
    runs = []
    for ch in txt:
        k = "te" if "\u0c00" <= ch <= "\u0c7f" else ("keep" if ch == " " else "x")
        if k == "keep":
            k = runs[-1][1] if runs else "x"
        if runs and runs[-1][1] == k:
            runs[-1][0] += ch
        else:
            runs.append([ch, k])
    return runs

def text_sprite(txt, size, color=WHITE, kind=None, stroke=None, stroke_color=BLACK, shadow=True):
    if stroke is None:
        stroke = 0 if color == BLACK else 8
    runs = [[txt, kind]] if kind else _runs(txt)
    d0 = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    fonts = [font(k, size) for _, k in runs]
    widths = [d0.textlength(r, font=f) for (r, _), f in zip(runs, fonts)]
    asc = max(f.getmetrics()[0] for f in fonts)
    desc = max(f.getmetrics()[1] for f in fonts)
    pad = 30 + stroke
    im = Image.new("RGBA", (int(sum(widths)) + pad * 2, asc + desc + pad * 2), (0, 0, 0, 0))
    def draw_all(d, ox, oy, fill, sw, sf):
        x = pad + ox
        for (r, _), f, w in zip(runs, fonts, widths):
            d.text((x, pad + oy + asc), r, font=f, fill=fill, anchor="ls", stroke_width=sw, stroke_fill=sf)
            x += w
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        draw_all(ImageDraw.Draw(sh), 8, 10, (0, 0, 0, 150), stroke, (0, 0, 0, 150))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(6)))
    draw_all(ImageDraw.Draw(im), 0, 0, color, stroke, stroke_color)
    return im.crop(im.getbbox()) if im.getbbox() else im

def emoji_sprite(ch, size):
    f = ImageFont.truetype(EMOJI, 109)
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((80, 80), ch, font=f, embedded_color=True, anchor="mm")
    im = im.crop(im.getbbox())
    s = size / max(im.size)
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)

def box_sprite(w, h, fill, radius=40, border=None, shadow=True):
    pad = 40
    im = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    if shadow:
        sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle([pad + 6, pad + 16, pad + w + 6, pad + h + 16], radius, fill=(0, 0, 0, 140))
        im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([pad, pad, pad + w, pad + h], radius, fill=fill,
                        outline=border, width=8 if border else 0)
    return im

def compose(base, parts):
    """parts: list of (sprite, cx, cy) placed relative to base centre."""
    for sp, cx, cy in parts:
        base.alpha_composite(sp, (int(base.width / 2 + cx - sp.width / 2), int(base.height / 2 + cy - sp.height / 2)))
    return base

def card_sprite(lines, w=460, h=420, fill=YEL, fg=BLACK, emoji=None, tag=True):
    im = box_sprite(w, h, fill, radius=46, border=WHITE)
    d = ImageDraw.Draw(im)
    if tag:  # price-tag hole
        d.ellipse([70, 70, 100, 100], fill=(0, 0, 0, 0), outline=WHITE, width=6)
    parts, n = [], len(lines) + (1 if emoji else 0)
    y = -(n - 1) * 62
    if emoji:
        parts.append((emoji_sprite(emoji, 110), 0, y)); y += 130
    for txt, size in lines:
        parts.append((text_sprite(txt, size, fg, stroke=0, shadow=False), 0, y)); y += size * 1.15
    return compose(im, parts)

def pill_sprite(txt, fill=YEL, fg=BLACK, size=62, emoji=None):
    t = text_sprite(txt, size, fg, shadow=False)
    e = emoji_sprite(emoji, int(size * 1.1)) if emoji else None
    gap = int(size * 0.35)
    cw = t.width + (e.width + gap if e else 0)
    im = box_sprite(cw + int(size * 1.4), int(size * 1.9), fill, radius=int(size * 0.95))
    if e:
        return compose(im, [(e, -cw / 2 + e.width / 2, 0), (t, cw / 2 - t.width / 2, 0)])
    return compose(im, [(t, 0, 0)])

def circle_sprite(txt, d=210, fill=RED, fg=WHITE, size=90):
    pad = 30
    im = Image.new("RGBA", (d + pad * 2, d + pad * 2), (0, 0, 0, 0))
    ImageDraw.Draw(im).ellipse([pad, pad, pad + d, pad + d], fill=fill, outline=WHITE, width=10)
    return compose(im, [(text_sprite(txt, size, fg, stroke=0, shadow=False), 0, 0)])

def stamp_sprite(txt, color, size=110, angle=-12):
    t = text_sprite(txt, size, color, stroke=0, shadow=False)
    w, h = t.width + 70, t.height + 50
    im = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([20, 20, 20 + w, 20 + h], 24, fill=WHITE, outline=color, width=14)
    im = compose(im, [(t, 0, 0)])
    return im.rotate(angle, expand=True, resample=Image.BICUBIC)

# ---------------------------------------------------------------- elements
class El:
    def __init__(self, t0, t1, x=0, y=0, anim="pop", dur=0.35, sprite=None, draw=None, pulse=0):
        self.t0, self.t1, self.x, self.y, self.anim, self.dur = t0, t1, x, y, anim, dur
        self.sprite, self.drawfn, self.pulse = sprite, draw, pulse

    def render(self, frame, t):
        if not (self.t0 <= t < self.t1):
            return
        lt = t - self.t0
        p = clamp(lt / self.dur)
        out = clamp((self.t1 - t) / 0.15)
        if self.drawfn:
            self.drawfn(frame, lt, self)
            return
        sc, a, dx, dy = 1.0, 1.0, 0, 0
        if self.anim == "pop":
            sc = max(0.01, out_back(p))
        elif self.anim == "slam":  # big to normal, for stamps
            sc = 2.2 - 1.2 * out_cubic(p); a = clamp(p * 3)
        elif self.anim in ("left", "right"):
            dx = (-1 if self.anim == "left" else 1) * (1 - out_cubic(p)) * 1100
        elif self.anim == "up":
            dy = (1 - out_cubic(p)) * 300; a = p
        elif self.anim == "fade":
            a = p
        if self.pulse and p >= 1:
            sc *= 1 + self.pulse * math.sin(lt * 7)
        sc *= 0.85 + 0.15 * out
        a *= out
        sp = self.sprite
        if abs(sc - 1) > 0.01:
            sp = sp.resize((max(1, int(sp.width * sc)), max(1, int(sp.height * sc))), Image.BILINEAR)
        if a < 0.999:
            sp = sp.copy(); sp.putalpha(sp.getchannel("A").point(lambda v: int(v * a)))
        cx, cy = W / 2 + self.x + dx, H / 2 + self.y + dy
        frame.paste(sp, (int(cx - sp.width / 2), int(cy - sp.height / 2)), sp)

def T(t0, t1, txt, y=0, size=90, color=WHITE, x=0, anim="pop", **kw):
    return El(t0, t1, x, y, anim, sprite=text_sprite(txt, size, color, kind=kw.pop("kind", None), stroke=kw.pop("stroke", None)), **kw)

def S(t0, t1, sprite, x=0, y=0, anim="pop", **kw):
    return El(t0, t1, x, y, anim, sprite=sprite, **kw)

def countdown(t0, y=0, n=3, color=YEL):
    def draw(frame, lt, el):
        k = int(lt)
        frac = lt - k
        num = n - k
        d = ImageDraw.Draw(frame)
        r = 230
        cx, cy = W / 2, H / 2 + y
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(110, 90, 170), width=26)
        d.arc([cx - r, cy - r, cx + r, cy + r], -90, -90 + 360 * (1 - frac), fill=color, width=26)
        sp = text_sprite(str(num), 300, WHITE)
        s = out_back(clamp(frac / 0.3))
        sp = sp.resize((max(1, int(sp.width * s)), max(1, int(sp.height * s))))
        frame.paste(sp, (int(cx - sp.width / 2), int(cy - sp.height / 2)), sp)
    return El(t0, t0 + n, draw=draw)

def bars(t0, t1, items, y=0):
    """items: [(label, value, color)], value in %; bars grow from 0."""
    def draw(frame, lt, el):
        d = ImageDraw.Draw(frame)
        maxw = 700
        for i, (label, val, col) in enumerate(items):
            p = out_cubic(clamp((lt - i * 0.25) / 0.8))
            by = H / 2 + y + i * 230
            lab = text_sprite(label, 54, WHITE, stroke=6)
            frame.paste(lab, (110 - 30, int(by - 120)), lab)
            d.rounded_rectangle([110, by - 40, 110 + maxw, by + 40], 40, fill=(255, 255, 255))
            if p > 0.02:
                d.rounded_rectangle([110, by - 40, 110 + max(80, maxw * val / 40 * p), by + 40], 40, fill=col)
            num = text_sprite(f"{val * p:.1f}%", 64, WHITE, stroke=7)
            frame.paste(num, (int(110 + maxw + 10 - num.width / 2 + 60), int(by - num.height / 2)), num)
    return El(t0, t1, draw=draw)

def counter(t0, t1, frm, to, x=0, y=0, size=150, color=YEL, prefix="Rs ", dur=0.8):
    def draw(frame, lt, el):
        v = frm + (to - frm) * out_cubic(clamp(lt / dur))
        sp = text_sprite(f"{prefix}{int(round(v))}", size, color)
        frame.paste(sp, (int(W / 2 + x - sp.width / 2), int(H / 2 + y - sp.height / 2)), sp)
    return El(t0, t1, draw=draw)

def confetti(t0, dur=2.2, n=140, seed=1):
    rnd = random.Random(seed)
    cols = [YEL, RED, GREEN, CYAN, PINK, WHITE]
    ps = [(rnd.uniform(0, W), rnd.uniform(-400, -20), rnd.uniform(-120, 120), rnd.uniform(500, 1100),
           rnd.choice(cols), rnd.uniform(14, 26), rnd.uniform(0, 6.28)) for _ in range(n)]
    def draw(frame, lt, el):
        d = ImageDraw.Draw(frame)
        for x, y0, vx, vy, c, s, ph in ps:
            x1, y1 = x + vx * lt + 30 * math.sin(lt * 5 + ph), y0 + vy * lt
            w = s * abs(math.cos(lt * 8 + ph)) + 3
            d.rectangle([x1 - w / 2, y1 - s / 2, x1 + w / 2, y1 + s / 2], fill=c)
    return El(t0, t0 + dur, draw=draw)

def flash(t0, dur=0.12):
    def draw(frame, lt, el):
        a = int(220 * (1 - lt / dur))
        frame.paste(Image.new("RGB", frame.size, WHITE), (0, 0), Image.new("L", frame.size, a))
    return El(t0, t0 + dur, draw=draw)

# ---------------------------------------------------------------- background
def gradient(c1, c2):
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    k = clamp_arr(0.75 * y + 0.25 * x)
    arr = np.array(c1)[None, None, :] * (1 - k[..., None]) + np.array(c2)[None, None, :] * k[..., None]
    # soft vignette
    vx, vy = (x - 0.5) * 2, (y - 0.5) * 2
    v = 1 - 0.35 * clamp_arr(vx ** 2 * 0.6 + vy ** 2 * 0.4)
    return Image.fromarray((arr * v[..., None]).astype(np.uint8))

def clamp_arr(a): return np.clip(a, 0, 1)

class Background:
    def __init__(self, themes, seed=3):
        """themes: [(t0, (c1, c2))] — the background switches at each t0."""
        self.themes = [(t0, gradient(*cols)) for t0, cols in themes]
        rnd = random.Random(seed)
        syms = ["%", "+", "×", "÷", "=", "?", "Rs"]
        self.floaters = []
        for _ in range(16):
            sp = text_sprite(rnd.choice(syms), rnd.randint(90, 170), WHITE, stroke=0, shadow=False)
            sp.putalpha(sp.getchannel("A").point(lambda v: int(v * 0.10)))
            self.floaters.append((sp, rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(25, 70), rnd.uniform(0, 6)))

    def frame(self, t):
        bg = [im for t0, im in self.themes if t >= t0][-1].copy()
        for sp, x, y, v, ph in self.floaters:
            yy = (y - v * t) % (H + 300) - 150
            xx = x + 25 * math.sin(t * 0.8 + ph)
            bg.paste(sp, (int(xx - sp.width / 2), int(yy - sp.height / 2)), sp)
        return bg

# ---------------------------------------------------------------- audio
def _env(n, a=0.005, r=0.1):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / r)

def sfx(kind):
    if kind == "pop":
        n = int(0.12 * SR); t = np.arange(n) / SR
        return 0.6 * np.sin(2 * np.pi * (900 - 2500 * t) * t) * _env(n, 0.002, 0.04)
    if kind == "whoosh":
        n = int(0.4 * SR); noise = np.random.default_rng(1).standard_normal(n)
        k = np.sin(np.linspace(0, np.pi, n)) ** 2
        sm = np.convolve(noise, np.ones(12) / 12, "same")
        return 0.35 * sm * k
    if kind == "tick":
        n = int(0.06 * SR); t = np.arange(n) / SR
        return 0.5 * np.sin(2 * np.pi * 1800 * t) * _env(n, 0.001, 0.015)
    if kind == "ding":
        n = int(1.2 * SR); t = np.arange(n) / SR
        return 0.35 * (np.sin(2 * np.pi * 1318 * t) + 0.6 * np.sin(2 * np.pi * 1975 * t)
                       + 0.3 * np.sin(2 * np.pi * 2637 * t)) * _env(n, 0.002, 0.35)
    if kind == "buzz":
        n = int(0.45 * SR); t = np.arange(n) / SR
        w = np.sign(np.sin(2 * np.pi * 110 * t)) + 0.5 * np.sign(np.sin(2 * np.pi * 116 * t))
        return 0.22 * w * np.minimum(1, (0.45 - t) / 0.05)
    if kind == "boom":
        n = int(0.6 * SR); t = np.arange(n) / SR
        return 0.9 * np.sin(2 * np.pi * (120 * np.exp(-t * 6) + 40) * t) * _env(n, 0.002, 0.18)
    if kind == "cash":
        a = sfx("ding")[: int(0.5 * SR)]
        out = np.zeros(int(0.8 * SR)); out[: len(a)] += a; out[int(0.12 * SR): int(0.12 * SR) + len(a)] += a * 0.8
        return out
    raise ValueError(kind)

def music(total, bpm=124):
    n = int(total * SR); out = np.zeros(n)
    beat = 60 / bpm
    kick = sfx("boom")[: int(0.3 * SR)] * 0.55
    hat_n = int(0.04 * SR); hat = np.random.default_rng(2).standard_normal(hat_n) * _env(hat_n, 0.001, 0.01) * 0.12
    roots = [110.0, 87.31, 130.81, 98.0]  # A F C G
    i = 0
    while i * beat < total:
        s = int(i * beat * SR)
        seg = kick[: max(0, n - s)]; out[s:s + len(seg)] += seg
        hs = int((i + 0.5) * beat * SR)
        if hs < n:
            seg = hat[: n - hs]; out[hs:hs + len(seg)] += seg
        f = roots[(i // 4) % 4]
        bl = int(beat * SR * 0.9); tt = np.arange(bl) / SR
        bass = 0.13 * np.tanh(2 * np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 3)
        seg = bass[: max(0, n - s)]; out[s:s + len(seg)] += seg
        for j, mult in enumerate([2, 3, 4, 3]):  # arpeggio pluck
            ps = int((i + j / 4) * beat * SR)
            pl = int(0.2 * SR); tp = np.arange(pl) / SR
            pluck = 0.05 * np.sin(2 * np.pi * f * mult * 2 * tp) * np.exp(-tp * 18)
            seg = pluck[: max(0, n - ps)]
            if ps < n: out[ps:ps + len(seg)] += seg
        i += 1
    fade = int(1.0 * SR); out[-fade:] *= np.linspace(1, 0, fade)
    return out

def mix_audio(total, cues, path):
    out = music(total) * 0.8
    for t, kind in cues:
        a = sfx(kind); s = int(t * SR); seg = a[: max(0, len(out) - s)]
        out[s:s + len(seg)] += seg
    out = np.tanh(out * 1.1) * 0.9
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((out * 32767).astype(np.int16).tobytes())

# ---------------------------------------------------------------- render
def render(out, total, bg, elements, cues=(), shakes=(), punches=()):
    wav = out + ".wav"
    mix_audio(total, list(cues), wav)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
           "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    rnd = random.Random(7)
    for i in range(int(total * FPS)):
        t = i / FPS
        fr = bg.frame(t)
        for el in elements:
            el.render(fr, t)
        # progress bar
        d = ImageDraw.Draw(fr)
        d.rectangle([0, 0, W, 14], fill=(0, 0, 0))
        d.rectangle([0, 0, int(W * t / total), 14], fill=YEL)
        for t0, dur in punches:  # zoom punch
            if t0 <= t < t0 + dur:
                z = 1 + 0.07 * math.sin(math.pi * (t - t0) / dur)
                big = fr.resize((int(W * z), int(H * z)), Image.BILINEAR)
                fr = big.crop(((big.width - W) // 2, (big.height - H) // 2, (big.width - W) // 2 + W, (big.height - H) // 2 + H))
        for t0, dur in shakes:
            if t0 <= t < t0 + dur:
                amp = 26 * (1 - (t - t0) / dur)
                sh = Image.new("RGB", (W, H), BLACK)
                sh.paste(fr, (int(rnd.uniform(-amp, amp)), int(rnd.uniform(-amp, amp))))
                fr = sh
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    rc = p.wait()
    os.remove(wav)
    return rc
