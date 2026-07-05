"""
Build one reference frame (JPEG) per gloss from ASL Citizen–style videos, plus a web manifest.

Expected video names: <digits>-<GLOSS>.mp4  (gloss may contain spaces, e.g. GO THROUGH)

Usage (from repo root or training/):
  python training/export_gloss_thumbnails.py ^
    --videos-root "D:\\...\\ASL_Citizen\\videos" ^
    --labels-json "models/labels.json" ^
    --thumb-dir "media/gloss_thumbs" ^
    --manifest "models/gloss_media.json"

Then refresh the app: Dictionary shows each gloss with its dataset still.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import cv2

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

GLOSS_RE = re.compile(r"^\d+-(.+)\.mp4$", re.IGNORECASE)


def parse_gloss(filename: str) -> str | None:
    m = GLOSS_RE.match(filename)
    if not m:
        return None
    return m.group(1).strip().upper()


def safe_thumb_stem(gloss: str) -> str:
    s = re.sub(r'[\s<>:\"/\\|?*]+', "_", gloss.strip())
    s = re.sub(r"_+", "_", s).strip("_")
    return (s[:100] or "gloss") + ".jpg"


def index_first_video_per_gloss(videos_root: Path) -> dict[str, Path]:
    out: dict[str, Path] = {}
    for p in sorted(videos_root.glob("*.mp4")):
        g = parse_gloss(p.name)
        if g and g not in out:
            out[g] = p
    return out


def extract_mid_frame_jpeg(video: Path, dest: Path, quality: int = 88) -> bool:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        return False
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    idx = max(0, n // 2)
    cap.set(cv2.CAP_PROP_POS_FRAMES, float(idx))
    ok, bgr = cap.read()
    cap.release()
    if not ok or bgr is None:
        return False
    dest.parent.mkdir(parents=True, exist_ok=True)
    params = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    return bool(cv2.imwrite(str(dest), bgr, params))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--videos-root",
        type=Path,
        default=Path(r"D:\OFFICIAL (D)\Downloads\ASL_Citizen\ASL_Citizen\videos"),
    )
    ap.add_argument(
        "--labels-json",
        type=Path,
        default=REPO_ROOT / "models" / "labels.json",
    )
    ap.add_argument(
        "--thumb-dir",
        type=Path,
        default=REPO_ROOT / "media" / "gloss_thumbs",
    )
    ap.add_argument(
        "--manifest",
        type=Path,
        default=REPO_ROOT / "models" / "gloss_media.json",
    )
    args = ap.parse_args()

    labels_path = args.labels_json.resolve()
    raw = json.loads(labels_path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit("labels.json must be a JSON array of gloss strings.")

    gloss_index = index_first_video_per_gloss(args.videos_root.resolve())
    args.thumb_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, str] = {}
    missing: list[str] = []

    for gloss in raw:
        g = str(gloss).strip().upper()
        video = gloss_index.get(g)
        if not video:
            missing.append(g)
            continue
        stem = safe_thumb_stem(g)
        dest = args.thumb_dir / stem
        rel = "media/gloss_thumbs/" + stem.replace("\\", "/")
        if extract_mid_frame_jpeg(video, dest):
            manifest[g] = rel
        else:
            missing.append(g)

    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print("Wrote manifest:", args.manifest)
    print("Thumbnails in:", args.thumb_dir.resolve())
    print("Mapped:", len(manifest), "/", len(raw))
    if missing:
        print("No video / failed frame for:", ", ".join(missing[:20]), ("…" if len(missing) > 20 else ""))


if __name__ == "__main__":
    main()
