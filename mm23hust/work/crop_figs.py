#!/usr/bin/env python3
"""Crop figures out of paper.pdf into web-ready PNGs.

Strategy: render a generous band (in PDF points) to PPM at a low dpi, locate the
true non-white bounding box in pure Python, then re-render exactly that box to
PNG at a high dpi. Optionally split a band at its widest internal whitespace
gutter (for side-by-side subfigures).
"""
import os
import subprocess
import sys

PDF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "paper.pdf")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "figures")
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tmp")
PROBE_DPI = 150
FINAL_DPI = 260
WHITE_CUT = 245  # pixel considered "ink" when any channel below this


def pt2px(v, dpi):
    return int(round(v / 72.0 * dpi))


def read_ppm(path):
    with open(path, "rb") as fh:
        data = fh.read()
    if not data.startswith(b"P6"):
        raise ValueError("expected binary PPM (P6), got %r" % data[:2])
    fields, idx = [], 2
    while len(fields) < 3:
        while idx < len(data) and data[idx : idx + 1].isspace():
            idx += 1
        if data[idx : idx + 1] == b"#":
            while data[idx : idx + 1] not in (b"\n", b"\r"):
                idx += 1
            continue
        start = idx
        while idx < len(data) and not data[idx : idx + 1].isspace():
            idx += 1
        fields.append(int(data[start:idx]))
    idx += 1  # single whitespace after maxval
    w, h, _maxval = fields
    return w, h, data[idx : idx + w * h * 3]


def render_ppm(page, box, dpi, tag):
    """box = (x0, y0, x1, y1) in PDF points, y from page top."""
    x0, y0, x1, y1 = box
    os.makedirs(TMP, exist_ok=True)
    stem = os.path.join(TMP, tag)
    cmd = [
        "pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page),
        "-x", str(pt2px(x0, dpi)), "-y", str(pt2px(y0, dpi)),
        "-W", str(pt2px(x1 - x0, dpi)), "-H", str(pt2px(y1 - y0, dpi)),
        PDF, stem,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    for suffix in ("-%d" % page, "-%02d" % page, "-0%d" % page, ""):
        cand = "%s%s.ppm" % (stem, suffix)
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError("no ppm produced for %s" % tag)


def ink_profiles(w, h, raw, cut=None):
    """Return (per-column ink counts, per-row ink counts)."""
    cut = WHITE_CUT if cut is None else cut
    cols = [0] * w
    rows = [0] * h
    for y in range(h):
        base = y * w * 3
        rowcount = 0
        for x in range(w):
            p = base + x * 3
            if raw[p] < cut or raw[p + 1] < cut or raw[p + 2] < cut:
                cols[x] += 1
                rowcount += 1
        rows[y] = rowcount
    return cols, rows


def tight_box(page, box, tag, pad=3.0, min_ink=1):
    """Shrink `box` to the ink bounding box, keeping `pad` points of margin."""
    ppm = render_ppm(page, box, PROBE_DPI, tag + "_probe")
    w, h, raw = read_ppm(ppm)
    cols, rows = ink_profiles(w, h, raw)
    xs = [i for i, c in enumerate(cols) if c >= min_ink]
    ys = [i for i, r in enumerate(rows) if r >= min_ink]
    if not xs or not ys:
        return box, (w, h, cols, rows)
    x0, y0, x1, y1 = box
    scale = 72.0 / PROBE_DPI
    nx0 = max(x0, x0 + xs[0] * scale - pad)
    nx1 = min(x1, x0 + (xs[-1] + 1) * scale + pad)
    ny0 = max(y0, y0 + ys[0] * scale - pad)
    ny1 = min(y1, y0 + (ys[-1] + 1) * scale + pad)
    return (nx0, ny0, nx1, ny1), (w, h, cols, rows)


def find_gutter(page, box, tag, lo=0.28, hi=0.72):
    """Find the widest all-white vertical band inside the middle of `box`."""
    ppm = render_ppm(page, box, PROBE_DPI, tag + "_gut")
    w, h, raw = read_ppm(ppm)
    cols, _ = ink_profiles(w, h, raw)
    best, run_start = None, None
    for x in range(int(w * lo), int(w * hi)):
        if cols[x] == 0:
            if run_start is None:
                run_start = x
        else:
            if run_start is not None:
                run = (run_start, x - 1)
                if best is None or (run[1] - run[0]) > (best[1] - best[0]):
                    best = run
                run_start = None
    if run_start is not None:
        run = (run_start, int(w * hi) - 1)
        if best is None or (run[1] - run[0]) > (best[1] - best[0]):
            best = run
    if best is None:
        return None
    mid = (best[0] + best[1]) / 2.0
    return box[0] + mid * 72.0 / PROBE_DPI


def emit(page, box, name):
    x0, y0, x1, y1 = box
    os.makedirs(OUT, exist_ok=True)
    stem = os.path.join(OUT, name)
    cmd = [
        "pdftoppm", "-png", "-r", str(FINAL_DPI), "-f", str(page), "-l", str(page),
        "-x", str(pt2px(x0, FINAL_DPI)), "-y", str(pt2px(y0, FINAL_DPI)),
        "-W", str(pt2px(x1 - x0, FINAL_DPI)), "-H", str(pt2px(y1 - y0, FINAL_DPI)),
        PDF, stem,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    for suffix in ("-%d" % page, "-%02d" % page, "-0%d" % page, ""):
        cand = "%s%s.png" % (stem, suffix)
        if os.path.exists(cand):
            final = "%s.png" % stem
            if cand != final:
                os.replace(cand, final)
            size = os.path.getsize(final)
            print("  %-14s p%-2d box=(%.0f,%.0f,%.0f,%.0f) %.0fx%.0fpt  %.1fKB"
                  % (name, page, x0, y0, x1, y1, x1 - x0, y1 - y0, size / 1024.0))
            return final
    raise FileNotFoundError(name)


# page, generous band (x0, y0, x1, y1) in points, name, split?
# Running heads end at y=69, so y0=78 is a safe top for column-top figures.
JOBS = [
    (1, (306, 176, 568, 332), "fig01_normal_vs_adverse", None),
    (3, (46, 78, 300, 178), "fig02_accuracy_timeline", "fig02a_accuracy_curve|fig02b_latency_accuracy"),
    (4, (46, 78, 568, 250), "fig03_system_overview", None),
    (5, (306, 78, 568, 176), "fig04_05_tradeoff_and_linear", "fig04_config_tradeoff|fig05_linear_latency"),
    (6, (306, 78, 568, 214), "fig06_07_testbed_and_fit", "fig06_testbed|fig07_accuracy_fit"),
    (7, (46, 78, 568, 253), "fig08_first_update_compare", None),
    (8, (46, 78, 300, 203), "fig09_avg_f1", None),
    (8, (46, 216, 300, 317), "fig10_acc_vs_time", None),
    (8, (306, 78, 568, 173), "fig11_12_bandwidth_and_times", "fig11_bandwidth|fig12_retrain_times"),
    (8, (306, 200, 568, 317), "fig13_time_decomposition", None),
]


def main():
    print("Cropping figures from paper.pdf -> assets/figures/")
    for page, band, name, split in JOBS:
        box, _ = tight_box(page, band, name)
        emit(page, box, name)
        if split:
            gut = find_gutter(page, box, name)
            left_name, right_name = split.split("|")
            if gut is None:
                print("    (no gutter found for %s, skipping split)" % name)
                continue
            lbox, _ = tight_box(page, (box[0], box[1], gut, box[3]), left_name)
            emit(page, lbox, left_name)
            rbox, _ = tight_box(page, (gut, box[1], box[2], box[3]), right_name)
            emit(page, rbox, right_name)
    print("done")


if __name__ == "__main__":
    sys.exit(main())
