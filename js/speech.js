/**
 * speech.js
 * ─────────
 * Thin wrapper around Web Speech API (SpeechSynthesis).
 */

'use strict';

let speechInitialized = false;

function initSpeech() {
  if (!('speechSynthesis' in window)) return false;
  if (speechInitialized) return true;
  
  // Warm up speech synthesis with a silent utterance (required by some browsers)
  const dummy = new SpeechSynthesisUtterance('');
  dummy.volume = 0;
  window.speechSynthesis.speak(dummy);
  speechInitialized = true;
  return true;
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    console.warn('[Speech] Web Speech API not supported');
    return;
  }

  initSpeech();

  // Normalize text
  const normalized = text.replace(/_/g, ' ').trim();
  const words = normalized.split(/\s+/).filter(w => w.length > 0);

  // Speak each word separately with a small pause between them
  let index = 0;
  
  function speakNext() {
    if (index >= words.length) {
      window._speechActive = false;
      return;
    }
    
    window._speechActive = true;
    const utter = new SpeechSynthesisUtterance(words[index]);
    utter.rate  = 0.9;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.lang = 'en-US';
    
    utter.onend = () => {
      index++;
      setTimeout(speakNext, 100); // Small pause between words
    };
    
    utter.onerror = (e) => {
      console.warn('[Speech] Error:', e.error);
      index++;
      setTimeout(speakNext, 100);
    };
    
    window.speechSynthesis.speak(utter);
  }

  window.speechSynthesis.cancel();
  speakNext();
}
