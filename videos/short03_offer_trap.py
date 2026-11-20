"""Short: Offer Trap #1 — Buy 2 Get 1 FREE vs 30% OFF, plus the 50% + 20% bonus trap."""
import sys
from shortkit import *

PURPLE = ((40, 10, 95), (120, 20, 140))
RED_BG = ((90, 5, 30), (170, 30, 60))
GREEN_BG = ((5, 60, 70), (20, 110, 90))

bg = Background([(0, PURPLE), (16.5, RED_BG), (24.2, GREEN_BG)])
E = []
cues = []

# 0.0 – 3.4  HOOK: the offer battle
E += [S(0.0, 3.4, pill_sprite("SHOPPING TRAP", emoji="🛒"), y=-700),
      S(0.3, 3.4, card_sprite([("BUY 2", 78), ("GET 1", 78), ("FREE", 92)], fill=YEL, emoji="🛍️"), x=-255, y=-170, anim="left"),
      S(0.55, 3.4, card_sprite([("30%", 130), ("OFF", 92)], fill=CYAN, emoji="🏷️"), x=255, y=-170, anim="right"),
      S(0.85, 3.4, circle_sprite("VS"), y=-170, pulse=0.06),
      T(1.3, 3.4, "ఏది తక్కువ ధర?", y=330, size=110, color=YEL),
      S(1.6, 3.4, emoji_sprite("🤔", 170), y=560, pulse=0.08)]
cues += [(0.0, "pop"), (0.3, "whoosh"), (0.55, "whoosh"), (0.85, "boom"), (1.3, "pop"), (1.6, "pop")]

# 3.4 – 5.6  Most people pick 30% OFF... true?
E += [T(3.4, 5.6, "చాలా మంది ఎంచుకునేది", y=-560, size=80),
      S(3.6, 5.6, card_sprite([("30%", 170), ("OFF", 110)], w=560, h=480, fill=CYAN, emoji="🏷️"), y=-80, pulse=0.04),
      T(4.4, 5.6, "నిజమేనా?", y=420, size=140, color=YEL, anim="slam"),
      S(4.4, 5.6, emoji_sprite("😳", 150), x=330, y=620)]
cues += [(3.4, "pop"), (3.6, "whoosh"), (4.4, "boom")]
shakes = [(4.4, 0.3)]

# 5.6 – 8.6  Countdown: comment your guess
E += [flash(5.6),
      T(5.6, 8.6, "కామెంట్ చేయండి!", y=-600, size=100, color=YEL),
      S(5.6, 8.6, emoji_sprite("💬", 120), y=-430),
      countdown(5.6, y=150)]
cues += [(5.6, "whoosh"), (5.6, "tick"), (6.6, "tick"), (7.6, "tick")]

# 8.6 – 13.4  Explanation: pay for 2, take 3
E += [flash(8.6),
      S(8.6, 13.4, pill_sprite("BUY 2 GET 1", fill=YEL), y=-720)]
for i, x in enumerate((-310, 0, 310)):
    t0 = 8.9 + i * 0.35
    E += [S(t0, 13.4, emoji_sprite("🛍️", 190), x=x, y=-420),
          T(t0 + 0.1, 13.4, "Rs 100", x=x, y=-250, size=62)]
    cues += [(t0, "pop")]
E += [S(10.1, 13.4, stamp_sprite("FREE", GREEN, size=64), x=310, y=-430, anim="slam"),
      T(10.7, 13.4, "Pay Rs 200", y=-20, size=100),
      T(11.1, 13.4, "Get Rs 300", y=120, size=100, color=GREEN),
      S(11.8, 13.4, box_sprite(860, 200, YEL, radius=50), y=400),
      T(11.8, 13.4, "100 / 300 = 33.3% OFF", y=400, size=72, color=BLACK, anim="pop")]
cues += [(10.1, "boom"), (10.7, "pop"), (11.1, "pop"), (11.8, "cash")]
punches = [(10.1, 0.25), (11.8, 0.25)]

# 13.4 – 16.5  Result bars + winner
E += [flash(13.4),
      T(13.4, 16.5, "RESULT", y=-720, size=110, color=YEL),
      bars(13.6, 16.5, [("Buy 2 Get 1", 33.3, GREEN), ("30% OFF", 30.0, CYAN)], y=-330),
      S(14.8, 16.5, stamp_sprite("WINNER", GREEN, size=110), y=180, anim="slam"),
      S(14.8, 16.5, emoji_sprite("🏆", 150), y=420, pulse=0.08),
      T(15.2, 16.5, "3 వస్తువులు కావాలంటే మాత్రమే!", y=640, size=62, color=YEL, anim="up"),
      confetti(14.8)]
cues += [(13.4, "whoosh"), (14.8, "boom"), (14.8, "ding")]
punches += [(14.8, 0.3)]

# 16.5 – 19.6  BONUS TRAP
E += [flash(16.5),
      S(16.5, 19.6, pill_sprite("BONUS TRAP", fill=RED, fg=WHITE, emoji="⚠️"), y=-700),
      S(16.8, 19.6, card_sprite([("50% OFF", 100), ("+ EXTRA", 70), ("20% OFF", 100)], w=640, h=520, fill=YEL, emoji="🏷️"), y=-200, anim="up"),
      T(17.7, 19.6, "= 70% OFF?", y=330, size=150, color=WHITE, anim="slam"),
      S(18.2, 19.6, emoji_sprite("🤔", 160), y=580, pulse=0.08)]
cues += [(16.5, "whoosh"), (16.8, "pop"), (17.7, "boom"), (18.2, "pop")]

# 19.6 – 24.2  NO! price drops
E += [S(19.6, 24.2, stamp_sprite("NO!", RED, size=170), y=-650, anim="slam"),
      T(20.2, 24.2, "Rs 1000", y=-380, size=110, color=WHITE),
      S(20.8, 24.2, pill_sprite("- 50%", fill=RED, fg=WHITE, size=60), x=-270, y=-210),
      counter(20.8, 24.2, 1000, 500, x=170, y=-210, size=110, color=WHITE),
      S(21.8, 24.2, pill_sprite("- 20%", fill=RED, fg=WHITE, size=60), x=-270, y=-30),
      counter(21.8, 24.2, 500, 400, x=170, y=-30, size=110, color=WHITE),
      S(22.8, 24.2, box_sprite(820, 220, YEL, radius=50), y=280),
      T(22.8, 24.2, "ONLY 60% OFF", y=280, size=100, color=BLACK),
      S(23.2, 24.2, emoji_sprite("🤯", 170), y=560, pulse=0.08)]
cues += [(19.6, "buzz"), (20.2, "pop"), (20.8, "whoosh"), (21.8, "whoosh"), (22.8, "cash"), (23.2, "pop")]
shakes += [(19.6, 0.35)]
punches += [(22.8, 0.25)]

# 24.2 – 29.0  CTA
E += [flash(24.2),
      T(24.2, 29.0, "షాపింగ్ ముందు", y=-640, size=100, color=YEL),
      T(24.5, 29.0, "ఈ మ్యాథ్స్ గుర్తుపెట్టుకోండి!", y=-500, size=84),
      S(25.0, 29.0, emoji_sprite("🧠", 180), y=-250, pulse=0.07),
      S(25.6, 29.0, pill_sprite("Share with a friend", fill=CYAN, emoji="📲", size=60), y=40, anim="left"),
      S(26.2, 29.0, pill_sprite("SUBSCRIBE", fill=RED, fg=WHITE, emoji="🔔", size=80), y=260, pulse=0.05),
      T(26.8, 29.0, "Daily money maths", y=470, size=70, color=YEL, anim="up")]
cues += [(24.2, "whoosh"), (24.5, "pop"), (25.0, "pop"), (25.6, "whoosh"), (26.2, "boom"), (26.8, "pop")]

if __name__ == "__main__":
    sys.exit(render(sys.argv[1] if len(sys.argv) > 1 else "short03_offer_trap.mp4",
                    29.0, bg, E, cues, shakes, punches))
