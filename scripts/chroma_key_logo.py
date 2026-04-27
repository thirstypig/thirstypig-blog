"""Chroma-key the red background out of redpig.jpg, then upscale 4×.

Documents the technique used to produce `public/images/redpig-transparent.png`
(the pig alone, on a transparent background, suitable for a full-bleed hero).

Pipeline:
1. HSV threshold to mask the red field (tighter than RGB distance — robust to
   JPEG compression noise, which jitters R/G/B more than hue).
2. 1px alpha erosion to kill the halo around the pig outline.
3. 4× LANCZOS upscale on the masked RGBA image.

Note: the *currently committed* PNG was produced from a higher-resolution
AI-rendered source (`thirsty-pig-exact.svg` — an SVG container around a
1335×1178 PNG) chroma-keyed with the same HSV technique below. Re-running this
script against `redpig.jpg` will produce a usable but lower-fidelity result
since the JPG source is only 350×309. For maximum sharpness on a re-run, start
from the highest-resolution source available and consider swapping LANCZOS for
a model-based upscaler (Real-ESRGAN, waifu2x).

Run:
    python3 scripts/chroma_key_logo.py

The output PNG is committed; this script does not need to be on the build
path.
"""

from __future__ import annotations

import colorsys
from pathlib import Path

from PIL import Image, ImageFilter

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "public" / "images" / "redpig.jpg"
OUTPUT = REPO_ROOT / "public" / "images" / "redpig-transparent.png"

# HSV thresholds tuned for #E4152B with JPEG noise tolerance.
HUE_TOLERANCE = 15 / 360.0
SAT_FLOOR = 0.40
VAL_FLOOR = 0.30
UPSCALE = 4


def is_red(r: int, g: int, b: int) -> bool:
    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    near_zero = h <= HUE_TOLERANCE or h >= 1.0 - HUE_TOLERANCE
    return near_zero and s >= SAT_FLOOR and v >= VAL_FLOOR


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"missing source: {SOURCE}")

    src = Image.open(SOURCE).convert("RGB")
    w, h = src.size
    out = Image.new("RGBA", (w, h))
    src_px = src.load()
    out_px = out.load()

    for y in range(h):
        for x in range(w):
            r, g, b = src_px[x, y]
            if is_red(r, g, b):
                out_px[x, y] = (0, 0, 0, 0)
            else:
                out_px[x, y] = (r, g, b, 255)

    # Erode alpha by 1px to kill JPEG halo bleed around the pig outline.
    alpha = out.getchannel("A").filter(ImageFilter.MinFilter(3))
    out.putalpha(alpha)

    upscaled = out.resize((w * UPSCALE, h * UPSCALE), Image.LANCZOS)
    upscaled.save(OUTPUT, "PNG", optimize=True)
    print(f"wrote {OUTPUT.relative_to(REPO_ROOT)} {upscaled.size} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
