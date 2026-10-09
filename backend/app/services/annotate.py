"""Defect overlay rendering. OWNER: B-side.

AI returns boxes only; drawing + file storage stay backend-side.
box_2d = [ymin, xmin, ymax, xmax] normalized 0-1000.
"""
from __future__ import annotations

import io

from PIL import Image, ImageDraw


def render_annotated(image_bytes: bytes, boxes: list[tuple[int, int, int, int]]) -> bytes:
    """Draw red boxes over defects; returns clean PNG bytes."""
    img = Image.open(io.BytesIO(image_bytes))
    img.load()
    img = img.convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size
    stroke = max(2, w // 200)
    for ymin, xmin, ymax, xmax in boxes:
        draw.rectangle(
            [xmin * w / 1000, ymin * h / 1000, xmax * w / 1000, ymax * h / 1000],
            outline="red",
            width=stroke,
        )
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()
