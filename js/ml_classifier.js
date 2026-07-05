/**
 * Live gloss classifier: prefers models/mlp_weights.json (pure JS, no TF.js converter).
 * Falls back to TensorFlow.js models/tfjs/model.json if present.
 * Landmarks: 63-D wrist-relative (same as training/extract_landmarks.py).
 */
'use strict';

window.ENABLE_ASL_CITIZEN_MODEL = true;

/** Minimum softmax probability to accept a prediction (lower if you see weak matches). */
window.ML_CONF_THRESHOLD = 0.05;

/**
 * Sharpen softmax on the last layer (T < 1 => higher peak probs). Helps when train (Python MediaPipe)
 * and Live (JS MediaPipe) distributions differ slightly. Set to 1.0 to match training exactly.
 */
window.ML_SOFTMAX_TEMPERATURE = 0.65;

window.mlClassifierReady = false;
window.mlClassifierLoading = false;
window.mlClassifierError = null;
window.mlPredictSignSync = null;

function landmarksToMlVector(lm) {
  const wx = lm[0].x;
  const wy = lm[0].y;
  const wz = lm[0].z;
  const v = new Float32Array(63);
  let o = 0;
  for (let i = 0; i < 21; i++) {
    v[o++] = lm[i].x - wx;
    v[o++] = lm[i].y - wy;
    v[o++] = lm[i].z - wz;
  }
  return v;
}

window.landmarksToMlVector = landmarksToMlVector;

function denseForward(x, layer) {
  const inD = layer.in;
  const outD = layer.out;
  const W = layer.W;
  const b = layer.b;
  const y = new Float32Array(outD);
  for (let j = 0; j < outD; j++) {
    let s = b[j];
    for (let i = 0; i < inD; i++) {
      s += x[i] * W[i * outD + j];
    }
    y[j] = s;
  }
  return y;
}

function applyActivation(h, act) {
  if (act === 'relu') {
    for (let i = 0; i < h.length; i++) {
      if (h[i] < 0) h[i] = 0;
    }
    return h;
  }
  if (act === 'softmax') {
    const T =
      typeof window.ML_SOFTMAX_TEMPERATURE === 'number' &&
      window.ML_SOFTMAX_TEMPERATURE > 0.05
        ? window.ML_SOFTMAX_TEMPERATURE
        : 1;
    let max = -Infinity;
    for (let i = 0; i < h.length; i++) {
      const z = h[i] / T;
      if (z > max) max = z;
    }
    let sum = 0;
    for (let i = 0; i < h.length; i++) {
      h[i] = Math.exp(h[i] / T - max);
      sum += h[i];
    }
    for (let i = 0; i < h.length; i++) {
      h[i] /= sum;
    }
    return h;
  }
  return h;
}

function predictMlp(vec, pack) {
  let h = vec;
  for (let li = 0; li < pack.layers.length; li++) {
    const layer = pack.layers[li];
    h = denseForward(h, layer);
    applyActivation(h, layer.act);
  }
  return h;
}

function makeSignHit(name, conf) {
  return {
    conf,
    sign: {
      name,
      emoji: '✋',
      cat: 'Gloss',
      detect() {
        return 0;
      },
    },
  };
}

function tryMlpUrls() {
  const href = window.location.href;
  const list = [
    new URL('models/mlp_weights.json', href).href,
    new URL('./models/mlp_weights.json', href).href,
  ];
  return [...new Set(list)];
}

function installMlpJsonPredict(pack) {
  window._mlpPack = pack;
  window._mlLabels = pack.labels;

  window.mlPredictSignSync = function (lm) {
    const vec = landmarksToMlVector(lm);
    const probs = predictMlp(vec, pack);
    let idx = 0;
    for (let i = 1; i < probs.length; i++) {
      if (probs[i] > probs[idx]) idx = i;
    }
    const name = pack.labels[idx];
    const conf = probs[idx];
    return makeSignHit(name, conf);
  };
}

(function bootstrapMl() {
  if (!window.ENABLE_ASL_CITIZEN_MODEL) return;

  window.mlClassifierLoading = true;

  (async function go() {
    const bust = 't=' + Date.now();

    for (const base of tryMlpUrls()) {
      const url = base + (base.includes('?') ? '&' : '?') + bust;
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        const ct = (r.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('text/html')) continue;
        const pack = await r.json();
        if (
          pack &&
          pack.version === 1 &&
          Array.isArray(pack.layers) &&
          pack.layers.length &&
          Array.isArray(pack.labels) &&
          pack.labels.length
        ) {
          const last = pack.layers[pack.layers.length - 1];
          if (last.out !== pack.labels.length) {
            console.warn('[SignFlowAI] mlp_weights.json: last layer out !== labels length');
            continue;
          }
          installMlpJsonPredict(pack);
          window.mlClassifierReady = true;
          window.mlClassifierLoading = false;
          window.mlClassifierError = null;
          console.info('[SignFlowAI] Live model ready (models/mlp_weights.json).');
          return;
        }
      } catch (e) {
        console.warn('[SignFlowAI] mlp_weights.json load attempt failed:', e);
      }
    }

    if (typeof tf === 'undefined') {
      window.mlClassifierError =
        'Missing models/mlp_weights.json — run: python training/export_mlp_json.py';
      window.mlClassifierLoading = false;
      console.warn('[SignFlowAI]', window.mlClassifierError);
      return;
    }

    try {
      const [model, labels] = await Promise.all([
        tf.loadLayersModel('models/tfjs/model.json'),
        fetch('models/labels.json?' + bust, { cache: 'no-store' }).then((res) => {
          if (!res.ok) throw new Error('models/labels.json HTTP ' + res.status);
          return res.json();
        }),
      ]);
      window._mlModel = model;
      window._mlLabels = labels;

      window.mlPredictSignSync = function (lm) {
        const vec = landmarksToMlVector(lm);
        const input = tf.tensor2d([vec], [1, 63]);
        const out = window._mlModel.predict(input);
        const probs = out.dataSync();
        input.dispose();
        out.dispose();
        let idx = 0;
        for (let i = 1; i < probs.length; i++) {
          if (probs[i] > probs[idx]) idx = i;
        }
        return makeSignHit(window._mlLabels[idx], probs[idx]);
      };

      window.mlClassifierReady = true;
      window.mlClassifierLoading = false;
      window.mlClassifierError = null;
      console.info('[SignFlowAI] TF.js model ready (models/tfjs/).');
    } catch (err) {
      window.mlClassifierError = err && err.message ? err.message : String(err);
      window.mlClassifierLoading = false;
      console.warn('[SignFlowAI] No MLP JSON and TF.js load failed:', err);
    }
  })();
})();
