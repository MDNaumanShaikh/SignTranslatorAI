/**
 * app.js
 * ──────
 * Entry point — runs after all other scripts are loaded.
 * Kicks off particles and dictionary; everything else is event-driven.
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  mkParticles();
  if (typeof window.loadVocabulary === 'function') {
    await window.loadVocabulary();
  }
  const nEl = document.getElementById('statVocabN');
  if (nEl && window.SIGNS && window.SIGNS.length) {
    nEl.textContent = String(window.SIGNS.length);
  } else if (nEl) {
    nEl.textContent = '0';
  }
  buildDict();
});
