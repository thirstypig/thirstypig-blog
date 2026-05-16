"""Build favicon set from redpig.jpg.

Square-crops the source (350x309) to a slightly-inset square focused on the
pig, then generates the standard modern-favicon set:
- public/favicon.ico (multi-resolution: 16, 32, 48)
- public/favicon-32.png
- public/apple-touch-icon.png (180x180 — iOS Safari)
- public/icon-192.png, public/icon-512.png (PWA / Android homescreen)

Re-run only if redpig.jpg is replaced.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE = REPO_ROOT / "public" / "images" / "redpig.jpg"
PUBLIC = REPO_ROOT / "public"

# Inset off each side when square-cropping. The pig sits roughly centered in
# the source; trimming 30px around shaves the wide red margins and brings the
# pig closer to the favicon's edges so it reads at 16px.
CROP_INSET = 30


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    w, h = src.size

    side = min(w, h) - CROP_INSET
    x = (w - side) // 2
    y = (h - side) // 2
    square = src.crop((x, y, x + side, y + side))
    print(f"cropped {w}x{h} -> {square.size}")

    raster_outputs = {
        "favicon-32.png": 32,
        "apple-touch-icon.png": 180,
        "icon-192.png": 192,
        "icon-512.png": 512,
    }
    for filename, size in raster_outputs.items():
        img = square.resize((size, size), Image.LANCZOS)
        out = PUBLIC / filename
        img.save(out, optimize=True)
        print(f"  wrote {out.relative_to(REPO_ROOT)} ({out.stat().st_size:,} bytes)")

    # Multi-resolution ICO. PIL handles downsampling internally.
    ico_path = PUBLIC / "favicon.ico"
    square.save(ico_path, format="ICO", sizes=[(16, 16), (32, 32)])
    print(f"  wrote {ico_path.relative_to(REPO_ROOT)} ({ico_path.stat().st_size:,} bytes)")

    # Remove the old Astro-default SVG favicon — replaced by the ICO + PNG set.
    old_svg = PUBLIC / "favicon.svg"
    if old_svg.exists():
        old_svg.unlink()
        print(f"  removed {old_svg.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
