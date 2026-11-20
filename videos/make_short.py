"""Render a faceless maths Short (1080x1920, 30 fps) from a list of timed scenes."""
import subprocess, sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
BG, FG, ACC, DIM = (14, 27, 61), (255, 255, 255), (255, 204, 0), (150, 170, 210)
B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
F = lambda p, s: ImageFont.truetype(p, s)

# Each scene: (seconds, [(text, font_path, size, color, y)], beep?)
SCENES = [
    (3.0, [("SPEED MATHS", B, 70, ACC, 300), ("65² = ?", B, 260, FG, 800),
           ("Solve in 3 seconds?", R, 70, DIM, 1150)], False),
    (1.0, [("Pause & try!", B, 90, ACC, 500), ("3", B, 400, FG, 900)], True),
    (1.0, [("Pause & try!", B, 90, ACC, 500), ("2", B, 400, FG, 900)], True),
    (1.0, [("Pause & try!", B, 90, ACC, 500), ("1", B, 400, FG, 900)], True),
    (3.5, [("TRICK", B, 80, ACC, 350), ("Number ending in 5", B, 80, FG, 600),
           ("6 5", B, 220, FG, 950), ("first digit × next number", R, 60, DIM, 1250)], False),
    (3.5, [("STEP 1", B, 80, ACC, 350), ("6 × 7 = 42", B, 170, FG, 850),
           ("6 × (6 + 1)", R, 70, DIM, 1150)], False),
    (3.5, [("STEP 2", B, 80, ACC, 350), ("Write 25 at the end", B, 75, FG, 650),
           ("42 | 25", B, 220, FG, 950)], False),
    (3.5, [("ANSWER", B, 80, ACC, 350), ("65² = 4225", B, 150, ACC, 850),
           ("Done in 3 seconds!", R, 70, FG, 1150)], True),
    (5.0, [("YOUR TURN", B, 80, ACC, 350), ("85² = ?", B, 220, FG, 850),
           ("Comment your answer", R, 70, FG, 1200),
           ("Subscribe for daily tricks", B, 65, ACC, 1500)], False),
]

def frame(items, t):
    """Draw one frame; each line fades and slides in, staggered by 0.12 s."""
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle([0, H - 30, W, H], fill=ACC)  # brand bar
    for i, (txt, fp, size, col, y) in enumerate(items):
        p = max(0.0, min(1.0, (t - i * 0.12) / 0.3))
        if p <= 0:
            continue
        e = 1 - (1 - p) ** 3
        c = tuple(int(BG[k] + (col[k] - BG[k]) * e) for k in range(3))
        f = F(fp, size)
        w = d.textlength(txt, font=f)
        d.text(((W - w) / 2, y + (1 - e) * 60), txt, font=f, fill=c, anchor="lm")
    return img

def main(out):
    total = sum(s[0] for s in SCENES)
    # Sound: soft beep at the start of each scene flagged True.
    beeps, t0 = [], 0.0
    for dur, _, beep in SCENES:
        if beep:
            beeps.append(t0)
        t0 += dur
    filt = ";".join(
        f"sine=f=880:d=0.15,volume=0.4,adelay={int(b*1000)}|{int(b*1000)}[b{i}]"
        for i, b in enumerate(beeps))
    mix = "".join(f"[b{i}]" for i in range(len(beeps)))
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-f", "lavfi", "-t", str(total), "-i", "anullsrc=r=44100:cl=stereo",
           "-filter_complex", f"{filt};[1:a]{mix}amix=inputs={len(beeps)+1}:normalize=0[a]",
           "-map", "0:v", "-map", "[a]", "-t", str(total),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-c:a", "aac", out]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for dur, items, _ in SCENES:
        for n in range(int(dur * FPS)):
            p.stdin.write(frame(items, n / FPS).tobytes())
    p.stdin.close()
    sys.exit(p.wait())

if __name__ == "__main__":
    main(sys.argv[1])
