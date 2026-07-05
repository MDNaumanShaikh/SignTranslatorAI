# SignFlow AI v2.0 — 110+ Signs | Sentence Builder

Visit the platform here
https://sign-translator-ffnhha6vp-md-nauman-shaikhs-projects.vercel.app/

Real-time ASL sign language recognition powered by MediaPipe, running 100% in the browser.

---

## 🚀 Quick Start (VS Code)

### Option A — Live Server (recommended, no install needed)
1. Open the `signflow-ai` folder in VS Code
2. Install the **Live Server** extension (search "Live Server" by Ritwick Dey)
3. Right-click `index.html` → **Open with Live Server**
4. Browser opens automatically at `http://127.0.0.1:5500`

### Option B — VS Code built-in server
1. Open `index.html` in the editor
2. Press `Ctrl+Shift+P` → type "Simple Browser: Show"
3. Enter `http://127.0.0.1:5500/index.html`

> ⚠️ **Do NOT open index.html directly as a file:// URL.**  
> MediaPipe and the camera API require an HTTP server (localhost is fine).

---

## 📁 Project Structure

```
signflow-ai/
├── index.html          ← Main entry point
├── README.md
│
├── css/
│   ├── reset.css       ← CSS variables & reset
│   ├── theme.css       ← Colors, buttons, glass cards, animations
│   ├── nav.css         ← Navigation bar
│   ├── pages.css       ← Page layout, hero, features, tutorial
│   ├── live.css        ← Live recognition + sentence builder
│   ├── t2s.css         ← Text-to-Sign page
│   ├── dict.css        ← Dictionary page
│   └── components.css  ← Shared overrides
│
└── js/
    ├── signs.js        ← 110-sign database with detect() functions
    ├── speech.js       ← Web Speech API wrapper
    ├── ui.js           ← Navigation, particles, toast
    ├── sentence.js     ← Sentence builder (add/remove/speak/copy)
    ├── camera.js       ← MediaPipe + recognition loop + hand renderer
    ├── t2s.js          ← Text → Sign translation logic
    ├── dict.js         ← Dictionary build + filter
    └── app.js          ← DOMContentLoaded entry point
```

---

## 🎯 Features

| Feature | Description |
|---------|-------------|
| **110 Signs** | 8 categories: Greetings, Emotions, Questions, Responses, Actions, People, Time, Food, Phrases, Numbers |
| **Live Recognition** | MediaPipe tracks 21 hand landmarks at 30fps |
| **Sentence Builder** | Signs auto-assemble; click chips to remove, speak the sentence, or copy it |
| **Kinetic Typography** | Per-letter wave animation on every recognised sign |
| **Voice Output** | Web Speech API speaks each sign and full sentences |
| **Text → Sign** | Type text; matching signs render as animated cards |
| **Dictionary** | Search + filter all 110 signs by category |
| **100% Client-Side** | No server, no API keys, no data sent anywhere |

---

## 🔌 Replacing the Heuristic Classifier with an AI Model

Open `js/camera.js` and find the comment **`🔌 AI MODEL HOOK`**.

Replace the `for (const sign of SIGNS)` loop with your model call:

```js
// Example: TensorFlow.js model
const tensor  = landmarksToTensor(lm);          // your preprocessing
const output  = await myModel.predict(tensor);   // shape [1, numClasses]
const classId = output.argMax(-1).dataSync()[0];
bestSign = SIGNS[classId];
bestConf = output.max().dataSync()[0];
```

The rest of the pipeline (hold-to-confirm, cooldown, kinetic display, sentence builder) works unchanged.

---

## 🌐 Browser Requirements

- **Chrome** or **Edge** (recommended) — best MediaPipe support
- **Firefox** — works but may be slower
- Camera permission required for Live Recognition
- Internet required (MediaPipe loads from CDN)

---

## 📝 License

MIT — free to use, modify, and distribute.
