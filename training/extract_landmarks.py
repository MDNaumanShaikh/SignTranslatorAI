"""
Extract 21×3 wrist-relative hand landmarks from ASL Citizen–style MP4 files.

Filenames expected: <digits>-<GLOSS>.mp4  (e.g. 0000197996356050556-CELERY.mp4)

Usage (small smoke test):
  python extract_landmarks.py --videos-root "D:\\...\\videos" --out-dir ./export --max-videos 200

Full corpus is huge (~80k clips); use --max-videos and/or --min-samples-per-class with subsampling.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

import urllib.request

import cv2
import mediapipe as mp
import numpy as np
from tqdm import tqdm

SCRIPT_DIR = Path(__file__).resolve().parent
HAND_TASK_URL = (
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
    "hand_landmarker/float16/1/hand_landmarker.task"
)

GLOSS_RE = re.compile(r"^\d+-(.+)\.mp4$", re.IGNORECASE)


def parse_gloss(filename: str, merge_variants: bool) -> str | None:
    m = GLOSS_RE.match(filename)
    if not m:
        return None
    g = m.group(1).strip()
    if merge_variants:
        g = re.sub(r"\s+\d+$", "", g).strip()
    return g.upper()


def landmarks_to_vec_legacy(hand_lm) -> np.ndarray:
    """Legacy mp.solutions: wrist-relative 63-D (matches js/ml_classifier.js)."""
    pts = np.array([[p.x, p.y, p.z] for p in hand_lm.landmark], dtype=np.float32)
    pts = pts - pts[0:1]
    return pts.reshape(-1)


def landmarks_to_vec_tasks(lm_list) -> np.ndarray:
    """Tasks API: list of NormalizedLandmark with x,y,z."""
    pts = np.array([[p.x, p.y, p.z] for p in lm_list], dtype=np.float32)
    pts = pts - pts[0:1]
    return pts.reshape(-1)


def ensure_hand_task_model(model_path: Path) -> None:
    model_path.parent.mkdir(parents=True, exist_ok=True)
    if model_path.is_file() and model_path.stat().st_size > 10_000:
        return
    print("Downloading Hand Landmarker task model to:\n ", model_path)
    urllib.request.urlretrieve(HAND_TASK_URL, model_path)


class _LegacyHandsWrapper:
    def __init__(self) -> None:
        mp_hands = mp.solutions.hands
        self._hands = mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )

    def process_rgb(self, rgb: np.ndarray) -> np.ndarray | None:
        res = self._hands.process(rgb)
        if not res.multi_hand_landmarks:
            return None
        return landmarks_to_vec_legacy(res.multi_hand_landmarks[0])

    def close(self) -> None:
        self._hands.close()


class _TasksHandsWrapper:
    def __init__(self, model_path: Path) -> None:
        from mediapipe.tasks.python.core import base_options
        from mediapipe.tasks.python.vision import HandLandmarker, HandLandmarkerOptions
        ensure_hand_task_model(model_path)
        opts = HandLandmarkerOptions(
            base_options=base_options.BaseOptions(model_asset_path=str(model_path)),
            num_hands=1,
            min_hand_detection_confidence=0.5,
            min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._lm = HandLandmarker.create_from_options(opts)
        from mediapipe.tasks.python.vision.core import image as mp_image

        self._mp_image = mp_image

    def process_rgb(self, rgb: np.ndarray) -> np.ndarray | None:
        if rgb.dtype != np.uint8:
            rgb = rgb.astype(np.uint8)
        image = self._mp_image.Image(
            image_format=self._mp_image.ImageFormat.SRGB, data=rgb
        )
        res = self._lm.detect(image)
        if not res.hand_landmarks:
            return None
        return landmarks_to_vec_tasks(res.hand_landmarks[0])

    def close(self) -> None:
        self._lm.close()


def create_hand_extractor(tasks_model_path: Path):
    """Python 3.13+ wheels often omit mp.solutions; use Tasks HandLandmarker."""
    if hasattr(mp, "solutions"):
        return _LegacyHandsWrapper()
    return _TasksHandsWrapper(tasks_model_path)


def sample_frame_indices(n_frames: int, k: int) -> np.ndarray:
    if n_frames <= 0:
        return np.array([], dtype=int)
    k = min(k, n_frames)
    return np.linspace(0, n_frames - 1, num=k, dtype=int)


def main() -> None:
    ap = argparse.ArgumentParser(description="ASL Citizen MP4 → MediaPipe landmarks")
    ap.add_argument(
        "--videos-root",
        type=Path,
        default=Path(r"D:\OFFICIAL (D)\Downloads\ASL_Citizen\ASL_Citizen\videos"),
        help="Folder containing .mp4 files",
    )
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=SCRIPT_DIR / "export",
        help="Where to write landmarks.npz",
    )
    ap.add_argument(
        "--tasks-model",
        type=Path,
        default=SCRIPT_DIR / "models" / "hand_landmarker.task",
        help="Path to hand_landmarker.task (downloaded if missing; Tasks API only)",
    )
    ap.add_argument("--max-videos", type=int, default=800, help="Cap processed clips (order arbitrary)")
    ap.add_argument("--frames-per-video", type=int, default=12, help="Uniformly spaced RGB frames")
    ap.add_argument("--merge-gloss-variants", action="store_true", help='Merge "WORD 1" → WORD')
    ap.add_argument(
        "--min-detected-frames",
        type=int,
        default=4,
        help="Discard clip if fewer frames have a detected hand",
    )
    args = ap.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)

    hands = create_hand_extractor(args.tasks_model)

    files = sorted(args.videos_root.glob("*.mp4"))
    if args.max_videos:
        files = files[: args.max_videos]

    X_list: list[np.ndarray] = []
    y_list: list[str] = []
    skipped: Counter[str] = Counter()

    for path in tqdm(files, desc="Videos"):
        gloss = parse_gloss(path.name, args.merge_gloss_variants)
        if gloss is None:
            skipped["bad_filename"] += 1
            continue

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            skipped["open_failed"] += 1
            continue

        n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        idxs = sample_frame_indices(n_frames, args.frames_per_video)
        feats_per_frame: list[np.ndarray] = []

        for fi in idxs:
            cap.set(cv2.CAP_PROP_POS_FRAMES, float(fi))
            ok, bgr = cap.read()
            if not ok or bgr is None:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            vec = hands.process_rgb(rgb)
            if vec is None:
                continue
            feats_per_frame.append(vec)

        cap.release()

        if len(feats_per_frame) < args.min_detected_frames:
            skipped["insufficient_hands"] += 1
            continue

        # Robust aggregate across frames (dims separate); mirrors temporal pooling baseline.
        stack = np.stack(feats_per_frame, axis=0)
        sample_feat = np.median(stack, axis=0).astype(np.float32)
        X_list.append(sample_feat)
        y_list.append(gloss)

    hands.close()

    if not X_list:
        raise SystemExit("No samples extracted — check paths and MP4 readability.")

    X = np.stack(X_list, axis=0)
    meta = {
        "videos_root": str(args.videos_root.resolve()),
        "n_samples": int(X.shape[0]),
        "feature_dim": int(X.shape[1]),
        "skipped_reasons": dict(skipped),
        "merge_gloss_variants": bool(args.merge_gloss_variants),
    }

    np.savez_compressed(args.out_dir / "landmarks.npz", X=X, y=np.array(y_list, dtype=object))
    (args.out_dir / "extract_meta.json").write_text(json.dumps(meta, indent=2))
    print("Saved:", args.out_dir / "landmarks.npz")
    print(meta)


if __name__ == "__main__":
    main()
