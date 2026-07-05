/**
 * sentence.js
 * ───────────
 * Manages the live sentence builder: add, remove, undo, speak, copy, clear.
 */

'use strict';

const sentence = [];

function addToSentence(word) {
  sentence.push(word);
  renderSentence();
}

function renderSentence() {
  const container = document.getElementById('sentWords');
  const output    = document.getElementById('sentOutput');
  container.innerHTML = '';

  if (!sentence.length) {
    container.innerHTML = '<span style="color:var(--t3);font-size:.82rem">Signs will appear here as a sentence…</span>';
    output.textContent  = '';
    return;
  }

  sentence.forEach((word, idx) => {
    const chip = document.createElement('span');
    chip.className   = 's-word';
    chip.textContent = word;
    chip.title       = 'Click to remove';
    chip.style.animationDelay = (idx * 0.04) + 's';
    chip.onclick = () => { sentence.splice(idx, 1); renderSentence(); };
    container.appendChild(chip);
  });

  output.textContent = '📝 ' + sentence.join(' ');
}

function clearSentence() {
  sentence.length = 0;
  renderSentence();
  toast('Sentence cleared', '🗑️');
}

function undoWord() {
  if (!sentence.length) return;
  sentence.pop();
  renderSentence();
  toast('Word removed', '↩');
}

function speakSentence() {
  if (!sentence.length) { toast('No sentence to speak', '⚠️'); return; }
  speak(sentence.join(' '));
  toast('Speaking sentence…', '🔊');
}

function copySentence() {
  if (!sentence.length) return;
  navigator.clipboard?.writeText(sentence.join(' '));
  toast('Copied to clipboard!', '📋');
}
