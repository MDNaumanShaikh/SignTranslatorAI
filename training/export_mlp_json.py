"""
Export the trained Keras MLP to a single JSON file for browser inference (no TensorFlow.js converter).

Writes models/mlp_weights.json with flat weight matrices + labels (same order as training).

  python training/export_mlp_json.py --keras training/export/sign_model.keras --labels models/labels.json
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--keras",
        type=Path,
        default=REPO_ROOT / "training" / "export" / "sign_model.keras",
    )
    ap.add_argument(
        "--labels",
        type=Path,
        default=REPO_ROOT / "models" / "labels.json",
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "models" / "mlp_weights.json",
    )
    args = ap.parse_args()

    model = tf.keras.models.load_model(args.keras, compile=False)
    labels = json.loads(args.labels.read_text(encoding="utf-8"))
    if not isinstance(labels, list):
        raise SystemExit("labels.json must be a JSON array.")

    layers_out: list[dict] = []
    for layer in model.layers:
        if not isinstance(layer, tf.keras.layers.Dense):
            continue
        W, b = layer.get_weights()
        W = np.asarray(W, dtype=np.float32)
        b = np.asarray(b, dtype=np.float32)
        act = (layer.activation.__name__ if layer.activation else "linear").lower()
        if act == "linear" and layer == model.layers[-1]:
            act = "softmax"
        flat = W.reshape(-1).astype(float).tolist()
        layers_out.append(
            {
                "in": int(W.shape[0]),
                "out": int(W.shape[1]),
                "W": flat,
                "b": b.tolist(),
                "act": act if act in ("relu", "softmax", "linear") else "relu",
            }
        )

    payload = {
        "version": 1,
        "inputDim": 63,
        "labels": [str(x) for x in labels],
        "layers": layers_out,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload), encoding="utf-8")
    print("Wrote:", args.out.resolve())
    print("Classes:", len(labels), "Dense blocks:", len(layers_out))


if __name__ == "__main__":
    main()
