#!/usr/bin/env python3
"""Сравнение эталонных изображений Figma со скриншотами приложения."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageStat

MOBILE_HEIGHTS = (717, 936, 920)
SLIDES = ("desktop-1", "desktop-2", "desktop-3",
          "mobile-1", "mobile-2", "mobile-3")


def load_images(figma: Path, browser: Path, frame: str) -> tuple[Image.Image, Image.Image]:
    reference = Image.open(figma / f"{frame}.png").convert("RGB")

    if frame.startswith("mobile"):
        index = int(frame[-1]) - 1
        page = Image.open(browser / "mobile" / "mobile-320.png").convert("RGB")
        start = sum(MOBILE_HEIGHTS[:index])
        image = page.crop((0, start, 320, start + MOBILE_HEIGHTS[index]))
        expected = (320, MOBILE_HEIGHTS[index])
    else:
        # На размере 1920 × 1080 центральная сцена 1240 × 800.
        # Положение сцены вычисляется по её центру, без статичных координат.
        viewport = Image.open(browser / "desktop" / f"slide-{frame[-1]}-1920.png").convert("RGB")
        left = (viewport.width - 1240) // 2
        top = (viewport.height - 800) // 2
        image = viewport.crop((left, top, left + 1240, top + 800))
        expected = (1240, 800)

    if reference.size != expected or image.size != expected:
        raise ValueError(
            f"{frame}: эталон {reference.size}, сайт {image.size}; ожидается {expected}"
        )

    return reference, image


def compare(ref: Image.Image, actual: Image.Image, tolerance: int) -> dict:
    difference = ImageChops.difference(ref, actual)
    channels = difference.split()
    pixels = ref.width * ref.height
    # Каждый ненулевой пиксель маски превышает заданный порог.
    # Для точного сравнения берём максимум из трёх каналов.
    maximum = ImageChops.lighter(
        ImageChops.lighter(channels[0], channels[1]), channels[2]
    )
    mask = maximum.point(lambda value: 255 if value > tolerance else 0)
    changed = mask.histogram()[255]
    averages = ImageStat.Stat(difference).mean

    return {
        "difference": difference,
        "mae_rgb": round(sum(averages) / 3, 4),
        "mismatch_pct": round(changed * 100 / pixels, 4),
        "pixels": pixels,
        "changed_pixels": changed,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--figma", type=Path, required=True,
                        help="Папка с шестью экспортами Figma")
    parser.add_argument("--browser", type=Path, required=True,
                        help="Папка со скриншотами Chromium")
    parser.add_argument("--output", type=Path, default=Path("test-results/diff"))
    parser.add_argument("--tolerance", type=int, default=16)
    parser.add_argument("--max-mismatch", type=float,
                        help="Максимальный процент отличий (для CI)")
    args = parser.parse_args()

    if not 0 <= args.tolerance <= 255:
        parser.error("--tolerance должен находиться в пределах 0–255")

    args.output.mkdir(parents=True, exist_ok=True)
    report = []

    for frame in SLIDES:
        reference, actual = load_images(args.figma, args.browser, frame)
        result = compare(reference, actual, args.tolerance)
        difference = ImageEnhance.Contrast(result["difference"]).enhance(3)
        difference.save(args.output / f"{frame}-diff.png")
        Image.blend(reference, actual, 0.5).save(
            args.output / f"{frame}-overlay.png"
        )

        # Тройная панель помогает находить расхождения без масштабирования.
        panel = Image.new(
            "RGB", (reference.width * 3, reference.height), "#ffffff"
        )
        panel.paste(reference, (0, 0))
        panel.paste(actual, (reference.width, 0))
        panel.paste(difference, (reference.width * 2, 0))
        panel.save(args.output / f"{frame}-comparison.png")

        report.append({
            "slide": frame,
            "mae_rgb": result["mae_rgb"],
            "mismatch_pct": result["mismatch_pct"],
            "changed_pixels": result["changed_pixels"],
            "total_pixels": result["pixels"],
        })
        print(f'{frame}: {result["mismatch_pct"]:.2f}% пикселей отличаются, '
              f'MAE {result["mae_rgb"]:.2f}')

    with (args.output / "summary.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=report[0].keys())
        writer.writeheader()
        writer.writerows(report)

    if args.max_mismatch is not None and any(
        row["mismatch_pct"] > args.max_mismatch for row in report
    ):
        raise SystemExit("Допустимый процент различий превышен")


if __name__ == "__main__":
    main()
