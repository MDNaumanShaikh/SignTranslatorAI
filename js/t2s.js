/**
 * t2s.js
 * ──────
 * Text → Sign translation page: kinetic word display + sign card grid.
 */

'use strict';

function handleT2S() {
  const input = document.getElementById('t2sIn').value.trim().toLowerCase();
  const words = input.split(/\s+/).filter(Boolean);

  const kinContainer  = document.getElementById('t2sWords');
  const cardsContainer = document.getElementById('signCards');

  kinContainer.innerHTML  = '';
  cardsContainer.innerHTML = '';

  if (!words.length) {
    kinContainer.innerHTML  = '<span style="color:var(--t3);font-size:.9rem">Your animated text appears here…</span>';
    return;
  }

  // Kinetic animated word chips
  words.forEach((word, i) => {
    const span = document.createElement('span');
    span.className = 't2s-w';
    span.textContent = word;
    span.style.animationDelay = (i * 0.06) + 's';
    kinContainer.appendChild(span);
  });

  const signs = window.SIGNS && Array.isArray(window.SIGNS) ? window.SIGNS : [];

  const signMap = new Map();
  signs.forEach((s) => signMap.set(s.name.toLowerCase(), s));

  const matched = new Set();
  const fullText = words.join(' ');
  signs.forEach((s) => {
    if (fullText.includes(s.name.toLowerCase())) matched.add(s.name.toLowerCase());
  });
  words.forEach(w => { if (signMap.has(w)) matched.add(w); });

  if (!matched.size) {
    cardsContainer.innerHTML =
      '<div style="color:var(--t3);font-size:.82rem;grid-column:1/-1;text-align:center;padding:1rem">' +
      'No matching signs. Browse the Dictionary for available signs.</div>';
    return;
  }

  let idx = 0;
  matched.forEach(name => {
    const sign = signMap.get(name);
    if (!sign) return;

    const card = document.createElement('div');
    card.className = 's-card';
    card.style.animationDelay = (idx * 0.08) + 's';
    card.innerHTML =
      `<span class="em">${sign.emoji}</span>` +
      `<span class="nm">${sign.name}</span>`;
    cardsContainer.appendChild(card);
    idx++;
  });
}

function speakT2S() {
  const text = document.getElementById('t2sIn').value.trim();
  if (!text) { toast('Type text first', '⚠️'); return; }
  speak(text);
  toast('Speaking…', '🔊');
}
