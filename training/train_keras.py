"""
Train a small softmax classifier on export/landmarks.npz and export Keras + label map.

  python train_keras.py --data-dir ./export --epochs 40 --min-per-class 5

Copy export/labels.json to ../models/labels.json (must match softmax class order).

For Live in the browser (recommended — no tensorflowjs_converter):
  python training/export_mlp_json.py --keras export/sign_model.keras --labels ../models/labels.json

Optional TF.js bundle:
  tensorflowjs_converter --input_format=keras export/sign_model.keras ../models/tfjs
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

import numpy as np
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--data-dir",
        type=Path,
        default=SCRIPT_DIR / "export",
        help="Folder containing landmarks.npz from extract_landmarks.py",
    )
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--min-per-class", type=int, default=5)
    ap.add_argument("--learning-rate", type=float, default=1e-3)
    args = ap.parse_args()

    npz_path = args.data_dir / "landmarks.npz"
    raw = np.load(npz_path, allow_pickle=True)
    X = raw["X"].astype(np.float32)
    y = raw["y"].astype(str)

    # Drop rare classes so softmax is stable on small extracts.
    counts: dict[str, int] = {}
    for g in y:
        counts[g] = counts.get(g, 0) + 1
    keep = {g for g, c in counts.items() if c >= args.min_per_class}
    mask = np.array([g in keep for g in y])
    X, y = X[mask], y[mask]
    if len(X) < 2:
        raise SystemExit("Too few rows after filtering — extract more videos or lower --min-per-class.")

    le = LabelEncoder()
    yi = le.fit_transform(y)
    num_classes = int(yi.max() + 1)

    _, per_class = np.unique(yi, return_counts=True)
    strat = yi if np.all(per_class >= 2) else None
    n = len(X)
    val_n = max(1, int(round(n * 0.15)))
    # Stratified split needs enough val rows for every class to appear in train & val.
    if strat is not None and val_n < num_classes:
        strat = None
    X_train, X_val, y_train, y_val = train_test_split(
        X, yi, test_size=0.15, stratify=strat, random_state=42
    )

    classes_in_train = np.unique(y_train)
    cw = compute_class_weight("balanced", classes=classes_in_train, y=y_train)
    class_weight = {int(i): 1.0 for i in range(num_classes)}
    for c, w in zip(classes_in_train, cw):
        class_weight[int(c)] = float(w)

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(63,)),
            tf.keras.layers.Dense(192, activation="relu"),
            tf.keras.layers.Dropout(0.35),
            tf.keras.layers.Dense(96, activation="relu"),
            tf.keras.layers.Dropout(0.25),
            tf.keras.layers.Dense(num_classes, activation="softmax"),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(args.learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    es = tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True)

    model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        epochs=args.epochs,
        batch_size=args.batch_size,
        class_weight=class_weight,
        callbacks=[es],
        verbose=1,
    )

    loss, acc = model.evaluate(X_val, y_val, verbose=0)
    print(f"Val accuracy (subset): {acc:.4f} loss={loss:.4f} classes={num_classes}")

    keras_path = args.data_dir / "sign_model.keras"
    model.save(keras_path)

    labels_out = [str(x) for x in le.classes_.tolist()]
    (args.data_dir / "labels.json").write_text(json.dumps(labels_out, indent=2))

    print("Saved:", keras_path)
    print("Saved:", args.data_dir / "labels.json")
    repo_root = SCRIPT_DIR.parent
    tfjs_dir = repo_root / "models" / "tfjs"
    print("\nConvert for TensorFlow.js (from repo root):")
    print(
        f'  tensorflowjs_converter --input_format=keras "{keras_path.resolve()}" "{tfjs_dir}"'
    )
    labels_repo = repo_root / "models" / "labels.json"
    print(f'  copy "{(args.data_dir / "labels.json").resolve()}" "{labels_repo}"')
    print("\nBrowser Live (no tensorflowjs_converter required):")
    print(f'  python training/export_mlp_json.py --keras "{keras_path.resolve()}" --labels "{labels_repo}"')
    print("\nOptional: dataset stills for Dictionary:")
    print(
        f'  python training/export_gloss_thumbnails.py --labels-json "{labels_repo}"'
    )


if __name__ == "__main__":
    main()
