"""Проверка точности сравнения и чтения результатов браузерных тестов."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "tools" / "compare-figma.py"

spec = importlib.util.spec_from_file_location("pixel_compare", SOURCE)
assert spec is not None and spec.loader is not None
compare_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compare_module)

with TemporaryDirectory() as temp_dir:
    directory = Path(temp_dir)
    reference = directory / "reference"
    browser = directory / "browser"
    reference.mkdir()
    (browser / "desktop").mkdir(parents=True)
    (browser / "mobile").mkdir(parents=True)

    heights = (717, 936, 920)
    page = Image.new("RGB", (320, sum(heights)))
    offset = 0

    for index, height in enumerate(heights, start=1):
        color = (index * 43, index * 57, index * 71)
        slide = Image.new("RGB", (320, height), color)
        slide.save(reference / f"mobile-{index}.png")
        page.paste(slide, (0, offset))
        offset += height

    page.save(browser / "mobile" / "mobile-320.png")

    for index in range(1, 4):
        color = (index * 39, index * 52, index * 63)
        slide = Image.new("RGB", (1240, 800), color)
        slide.save(reference / f"desktop-{index}.png")
        viewport = Image.new("RGB", (1920, 1080), "#746d68")
        viewport.paste(slide, ((1920 - 1240) // 2, (1080 - 800) // 2))
        viewport.save(browser / "desktop" / f"slide-{index}-1920.png")

    for frame in compare_module.SLIDES:
        figma, site = compare_module.load_images(reference, browser, frame)
        result = compare_module.compare(figma, site, 16)
        assert result["changed_pixels"] == 0, (frame, result)

    left, right = compare_module.load_images(reference, browser, "mobile-2")
    changed = right.copy()
    changed.putpixel((13, 25), (255, 255, 255))
    result = compare_module.compare(left, changed, 16)
    assert result["changed_pixels"] == 1, result
    assert result["mismatch_pct"] > 0
    assert result["mae_rgb"] > 0

    result = compare_module.compare(left, changed, 255)
    assert result["changed_pixels"] == 0

print("Сравнение Figma и скриншотов браузера: проверки пройдены")
