/**
 * camera.js
 * ─────────
 * MediaPipe Hands, camera, trained TF.js gloss classifier (js/ml_classifier.js),
 * kinetic typography, and history. Live recognition does not use legacy heuristics.
 */

'use strict';

// ─── Camera State ────────────────────────────────────────────────────────
const camState = {
  on:        false,
  curSign:   null,
  lastSign:  null,
  lastTime:  0,
  pendSign:  null,
  pendTime:  0,
  history:   [],
  voiceOn:   true,
  _modelWarned: false,
  // Motion sensing state
  prevLandmarks: [],
  motionHistory: [],
  motionVector: { x: 0, y: 0, z: 0 },
  motionIntensity: 0,
  lastMotionTime: 0,
};

const HOLD_MS = 1200;   // ms a sign must be held before it's confirmed
const COOL_MS = 800;    // ms before the same sign can fire again
const MOTION_WINDOW_MS = 500; // time window for motion analysis
const MOTION_THRESHOLD = 0.02; // minimum motion intensity to consider
const MOTION_HISTORY_SIZE = 10; // number of frames to keep for motion analysis

// ─── MediaPipe init ───────────────────────────────────────────────
async function initMP() {
  camState.hands = new Hands({
    locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`
  });
  camState.hands.setOptions({
    maxNumHands:            2,
    modelComplexity:        1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence:  0.55,
  });
  camState.hands.onResults(onHandResults);
}

// ─── Camera controls ──────────────────────────────────────────────
async function startCam() {
  try {
    if (!camState.hands) await initMP();

    const video = document.getElementById('camVid');
    camState.camera = new Camera(video, {
      onFrame: async () => {
        if (camState.on) await camState.hands.send({ image: video });
      },
      width:  640,
      height: 480,
    });

    await camState.camera.start();
    camState.on = true;

    document.getElementById('btnStart').style.display = 'none';
    document.getElementById('btnStop').style.display  = 'inline-flex';
    document.getElementById('camPill').classList.add('on');
    document.getElementById('camTxt').textContent = 'Live';

    toast('Camera active! Show a sign.', '📸');

    // Initialize speech synthesis on user interaction
    if (typeof initSpeech === 'function') initSpeech();

    if (!camState._modelWarned && !window.mlClassifierReady) {
      camState._modelWarned = true;
      toast(
        'For predictions: add models/mlp_weights.json or models/tfjs/ (see training/).',
        '🧠'
      );
    }
  } catch (err) {
    toast('Camera error: ' + err.message, '❌');
  }
}

function stopCam() {
  if (camState.camera) { camState.camera.stop(); camState.on = false; }
  
  // Reset motion state
  camState.prevLandmarks = [];
  camState.motionHistory = [];
  camState.motionVector = { x: 0, y: 0, z: 0 };
  camState.motionIntensity = 0;

  document.getElementById('btnStart').style.display = 'inline-flex';
  document.getElementById('btnStop').style.display  = 'none';
  document.getElementById('camPill').classList.remove('on');
  document.getElementById('camTxt').textContent = 'Offline';
  
  // Hide motion indicators
  document.getElementById('motionIndicator').style.display = 'none';
  document.getElementById('motionFill').style.width = '0%';

  const canvas = document.getElementById('outCanvas');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  toast('Camera stopped.', '⏹️');
}

function toggleVoice() {
  camState.voiceOn = !camState.voiceOn;
  document.getElementById('btnVoice').textContent =
    camState.voiceOn ? '🔊 Voice On' : '🔇 Voice Off';
  
  // Initialize speech synthesis on user interaction
  if (camState.voiceOn && typeof initSpeech === 'function') initSpeech();
  
  toast(camState.voiceOn ? 'Voice enabled' : 'Voice muted',
        camState.voiceOn ? '🔊' : '🔇');
}

// ─── Motion detection algorithms ───────────────────────────────────
function calculateMotionVector(currentLandmarks, prevLandmarks) {
  if (!prevLandmarks || !currentLandmarks || 
      prevLandmarks.length !== currentLandmarks.length) {
    return { x: 0, y: 0, z: 0, intensity: 0 };
  }

  let totalDx = 0, totalDy = 0, totalDz = 0;
  const numPoints = currentLandmarks.length;

  for (let i = 0; i < numPoints; i++) {
    const curr = currentLandmarks[i];
    const prev = prevLandmarks[i];
    totalDx += curr.x - prev.x;
    totalDy += curr.y - prev.y;
    totalDz += curr.z - prev.z;
  }

  const avgDx = totalDx / numPoints;
  const avgDy = totalDy / numPoints;
  const avgDz = totalDz / numPoints;
  const intensity = Math.sqrt(avgDx * avgDx + avgDy * avgDy + avgDz * avgDz);

  return { x: avgDx, y: avgDy, z: avgDz, intensity };
}

function updateMotionHistory(landmarks) {
  const now = Date.now();
  
  // Store current landmarks for next frame comparison
  camState.prevLandmarks = landmarks.map(lm => ({ ...lm }));
  
  // Calculate motion if we have previous data
  if (camState.prevLandmarks.length > 0) {
    const motion = calculateMotionVector(landmarks, camState.prevLandmarks);
    camState.motionVector = motion;
    camState.motionIntensity = motion.intensity;
    camState.lastMotionTime = now;
    
    // Add to motion history with timestamp
    camState.motionHistory.push({
      motion: motion,
      timestamp: now,
      intensity: motion.intensity
    });
    
    // Keep only recent motion history
    const cutoff = now - MOTION_WINDOW_MS;
    camState.motionHistory = camState.motionHistory.filter(
      entry => entry.timestamp > cutoff
    );
    
    // Limit history size
    if (camState.motionHistory.length > MOTION_HISTORY_SIZE) {
      camState.motionHistory.shift();
    }
  }
}

function getMotionPattern() {
  if (camState.motionHistory.length < 2) {
    return { type: 'static', intensity: 0, direction: 'none' };
  }
  
  const recent = camState.motionHistory.slice(-5); // Last 5 frames
  const avgIntensity = recent.reduce((sum, entry) => sum + entry.intensity, 0) / recent.length;
  
  if (avgIntensity < MOTION_THRESHOLD) {
    return { type: 'static', intensity: avgIntensity, direction: 'none' };
  }
  
  // Analyze motion direction
  let totalX = 0, totalY = 0;
  for (const entry of recent) {
    totalX += entry.motion.x;
    totalY += entry.motion.y;
  }
  
  const avgX = totalX / recent.length;
  const avgY = totalY / recent.length;
  
  let direction = 'none';
  if (Math.abs(avgX) > Math.abs(avgY)) {
    direction = avgX > 0 ? 'right' : 'left';
  } else if (Math.abs(avgY) > 0.01) {
    direction = avgY > 0 ? 'down' : 'up';
  }
  
  // Detect circular or complex motion
  const variance = calculateMotionVariance(recent);
  let type = 'linear';
  if (variance > 0.05) {
    type = 'circular';
  } else if (avgIntensity > 0.1) {
    type = 'dynamic';
  }
  
  return { type, intensity: avgIntensity, direction };
}

function calculateMotionVariance(motionEntries) {
  if (motionEntries.length < 3) return 0;
  
  const angles = [];
  for (let i = 1; i < motionEntries.length; i++) {
    const prev = motionEntries[i - 1].motion;
    const curr = motionEntries[i].motion;
    const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    angles.push(angle);
  }
  
  const avgAngle = angles.reduce((sum, a) => sum + a, 0) / angles.length;
  const variance = angles.reduce((sum, a) => sum + Math.pow(a - avgAngle, 2), 0) / angles.length;
  
  return variance;
}

// ─── Per-frame result handler ─────────────────────────────────────
function onHandResults(results) {
  const canvas = document.getElementById('outCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = results.image.width;
  canvas.height = results.image.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = results.multiHandLandmarks;
  if (!landmarks || !landmarks.length) {
    document.getElementById('confFill').style.width = '0%';
    document.getElementById('handInfo').textContent = 'Show one or two hands to begin';
    camState.pendSign = null;
    return;
  }

  for (let hi = 0; hi < landmarks.length; hi++) {
    drawHand(ctx, landmarks[hi], canvas.width, canvas.height, hi);
  }

  // Update motion detection
  updateMotionHistory(landmarks);
  const motionPattern = getMotionPattern();
  
  // Update motion UI indicators
  updateMotionUI(motionPattern);
  
  // ── Trained MLP / TF.js: run classifier on each hand, keep best confidence ──
  const mlThresh =
    typeof window.ML_CONF_THRESHOLD === 'number' ? window.ML_CONF_THRESHOLD : 0.25; // Lowered threshold for better NECK detection

  let bestSign = null;
  let bestConf = 0;
  /** Best top-1 even below threshold (for HUD + confidence bar). */
  let rawBest = null;
  let rawConf = 0;

  if (
    window.mlClassifierReady &&
    typeof window.mlPredictSignSync === 'function'
  ) {
    for (let hi = 0; hi < landmarks.length; hi++) {
      const hit = window.mlPredictSignSync(landmarks[hi]);
      
      // Special handling for NECK sign - enhance confidence with motion detection
      if (hit && hit.sign.name === 'NECK') {
        // Check for characteristic downward motion
        if (motionPattern.type === 'linear' && motionPattern.direction === 'down' && motionPattern.intensity > 0.015) {
          hit.conf = Math.min(1.0, hit.conf + 0.2); // Significant boost for proper NECK motion
        } else if (motionPattern.intensity < 0.01) {
          hit.conf = Math.max(0, hit.conf - 0.1); // Reduce confidence for static hands
        }
      }
      
      // Check for perfect recognition and freeze status
      if (hit && hit.conf > 0.85) { // High confidence threshold for perfect
        const now = Date.now();
        camState.perfectFreezeUntil = now + 3000; // Freeze for 3 seconds
        
        // Visual feedback for perfect recognition
        if (typeof showKinetic === 'function') {
          showKinetic(hit.sign.name);
        }
        
        // Add pulse animation to confidence bar
        const confFill = document.getElementById('confFill');
        confFill.style.animation = 'pulse 0.5s ease-in-out 3';
        setTimeout(() => {
          confFill.style.animation = '';
        }, 1500);
      }
      
      // Enhance confidence based on motion pattern
      if (hit && motionPattern.type !== 'static') {
        const motionBonus = getMotionBonus(hit.sign.name, motionPattern);
        hit.conf = Math.min(1.0, hit.conf + motionBonus);
      }
      
      if (hit && hit.conf > rawConf) {
        rawConf = hit.conf;
        rawBest = hit.sign;
      }
      if (hit && hit.conf >= mlThresh && hit.conf > bestConf) {
        bestConf = hit.conf;
        bestSign = hit.sign;
      }
    }
  }
  // ─────────────────────────────────────────────────────────────

  const now = Date.now();
  const nHands = landmarks.length;
  const handTag = nHands > 1 ? `${nHands} hands · ` : '';

  if (bestSign) {
    document.getElementById('confFill').style.width =
      Math.round(bestConf * 100) + '%';
    document.getElementById('handInfo').textContent =
      handTag + `Detecting: ${bestSign.name} (${bestSign.cat}) · Motion: ${motionPattern.type}`;

    if (bestSign.name === camState.pendSign) {
      if (now - camState.pendTime >= HOLD_MS) {
        if (bestSign.name !== camState.curSign || now - camState.lastTime > COOL_MS) {
          confirmSign(bestSign, bestConf);
          camState.lastTime = now;
        }
      }
    } else {
      camState.pendSign = bestSign.name;
      camState.pendTime = now;
    }
  } else {
    const hi = document.getElementById('handInfo');
    const fill = document.getElementById('confFill');
    if (window.mlClassifierLoading) {
      fill.style.width = '15%';
      hi.textContent =
        (nHands > 1 ? `${nHands} hands · ` : '') + 'Loading neural model…';
    } else if (window.mlClassifierError) {
      fill.style.width = '15%';
      hi.textContent =
        (nHands > 1 ? `${nHands} hands · ` : '') +
        'Model unavailable. Add models/mlp_weights.json or models/tfjs/ (see training/).';
    } else if (!window.mlClassifierReady) {
      fill.style.width = '15%';
      hi.textContent =
        (nHands > 1 ? `${nHands} hands · ` : '') + 'Model not ready — check console.';
    } else if (rawBest && rawConf > 0) {
      const pct = Math.round(rawConf * 100);
      fill.style.width = Math.max(12, Math.min(95, pct)) + '%';
      hi.textContent = handTag + rawBest.name;
    } else {
      fill.style.width = '15%';
      hi.textContent =
        (nHands > 1 ? `${nHands} hands · ` : '') + 'No confident gloss match yet';
    }
    camState.pendSign = null;
  }
}

// ─── Motion UI updates ───────────────────────────────────────────────
function updateMotionUI(motionPattern) {
  const indicator = document.getElementById('motionIndicator');
  const typeElement = document.getElementById('motionType');
  const intensityElement = document.getElementById('motionIntensity');
  const motionFill = document.getElementById('motionFill');
  
  if (motionPattern.intensity > MOTION_THRESHOLD) {
    indicator.style.display = 'flex';
    typeElement.textContent = motionPattern.type.toUpperCase();
    const intensityPercent = Math.min(100, Math.round(motionPattern.intensity * 500));
    intensityElement.textContent = intensityPercent + '%';
    motionFill.style.width = intensityPercent + '%';
    
    // Color code motion types
    if (motionPattern.type === 'static') {
      indicator.style.color = 'var(--a3)';
    } else if (motionPattern.type === 'linear') {
      indicator.style.color = 'var(--a4)';
    } else if (motionPattern.type === 'circular') {
      indicator.style.color = 'var(--a5)';
    } else {
      indicator.style.color = 'var(--a2)';
    }
  } else {
    indicator.style.display = 'none';
    motionFill.style.width = '0%';
  }
}

// ─── Motion-based confidence enhancement ───────────────────────────────
function getMotionBonus(signName, motionPattern) {
  // Define motion-sensitive signs and their preferred patterns
  const motionSensitiveSigns = {
    'NECK': { type: 'linear', direction: 'down', bonus: 0.15 },
    'THANK YOU': { type: 'linear', direction: 'down', bonus: 0.1 },
    'EYES AWAKE': { type: 'linear', direction: 'up', bonus: 0.12 },
    'FRIEND': { type: 'static', bonus: 0.08 },
    'PRETTY': { type: 'linear', direction: 'down', bonus: 0.1 },
    'CONFUSED': { type: 'circular', bonus: 0.12 },
    'RELAX': { type: 'linear', direction: 'down', bonus: 0.1 }
  };

  const signConfig = motionSensitiveSigns[signName];
  if (!signConfig) return 0;

  let bonus = 0;

  // Check if motion type matches
  if (motionPattern.type === signConfig.type) {
    bonus += signConfig.bonus * 0.6;
  }
  
  // Check if direction matches (for linear motion)
  if (signConfig.direction && motionPattern.direction === signConfig.direction) {
    bonus += signConfig.bonus * 0.4;
  }
  
  // Special bonus for NECK sign - requires downward motion
  if (signName === 'NECK' && motionPattern.type === 'linear' && motionPattern.direction === 'down' && motionPattern.intensity > 0.02) {
    bonus += 0.05; // Extra bonus for proper NECK motion
  }
  
  return bonus;
}

// ─── Confirm a sign ───────────────────────────────────────────────
function confirmSign(sign, conf) {
  camState.curSign = sign.name;
  showKinetic(sign.name);
  addToSentence(sign.name);
  addHistory(sign, conf);
  if (camState.voiceOn) speak(sign.name);
  toast(`${sign.emoji} ${sign.name}`, '✨');
}

// ─── Kinetic word animation ───────────────────────────────────────
function showKinetic(text) {
  const container = document.getElementById('kinDisplay');
  container.innerHTML = '';

  const word = document.createElement('div');
  word.className = 'kin-word';
  word.textContent = text;
  word.style.animation = 'kinPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

  container.appendChild(word);
}

// ─── History ──────────────────────────────────────────────────────
function addHistory(sign, conf) {
  const list = document.getElementById('histList');
  if (!camState.history.length) list.innerHTML = '';

  camState.history.unshift({ sign: sign.name, emoji: sign.emoji, time: new Date() });

  const item = document.createElement('div');
  item.className = 'hist-item';
  item.innerHTML =
    `<span>${sign.emoji} ${sign.name}</span>` +
    `<span class="tm">${new Date().toLocaleTimeString()}</span>`;
  list.prepend(item);

  if (camState.history.length > 50) {
    camState.history.pop();
    list.lastChild?.remove();
  }
}

// ─── Hand skeleton renderer ───────────────────────────────────────
/** handIndex 0 = primary (purple/teal), 1 = secondary (teal/pink) for two-hand tracking */
function drawHand(ctx, lm, w, h, handIndex) {
  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
  ];

  const secondary = handIndex === 1;
  const c0 = secondary ? 'rgba(0,206,201,.85)' : 'rgba(108,92,231,.8)';
  const c1 = secondary ? 'rgba(253,121,168,.85)' : 'rgba(0,206,201,.8)';
  const halo = secondary ? 'rgba(0,206,201,.22)' : 'rgba(108,92,231,.2)';
  const joint = secondary ? '#55efc4' : '#00cec9';
  const tip = '#fdcb6e';

  ctx.lineWidth = 3;
  for (const [a, b] of connections) {
    const p1 = lm[a], p2 = lm[b];
    const grad = ctx.createLinearGradient(p1.x*w, p1.y*h, p2.x*w, p2.y*h);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(p1.x*w, p1.y*h);
    ctx.lineTo(p2.x*w, p2.y*h);
    ctx.stroke();
  }

  const TIPS = new Set([4, 8, 12, 16, 20]);
  lm.forEach((point, i) => {
    const x = point.x * w, y = point.y * h;
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2);
    ctx.fillStyle = halo; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI*2);
    ctx.fillStyle = TIPS.has(i) ? tip : joint; ctx.fill();
  });
}
