/**
 * ui.js
 * ─────
 * Navigation, background particles, toast notifications.
 */

'use strict';

// ─── Navigation ───────────────────────────────────────────────────
function nav(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) setTimeout(() => target.classList.add('active'), 30);

  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.p === pageId);
  });

  document.getElementById('navLinks').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Scroll shadow on navbar
window.addEventListener('scroll', () => {
  document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// ─── Particles ────────────────────────────────────────────────────
function mkParticles() {
  const container = document.querySelector('.bg-fx');
  const colors = ['#6c5ce7', '#00cec9', '#fd79a8', '#fdcb6e', '#55efc4'];

  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'bg-particle';
    p.style.left              = Math.random() * 100 + '%';
    p.style.background        = colors[i % 5];
    p.style.animationDuration = (8 + Math.random() * 14) + 's';
    p.style.animationDelay    = Math.random() * 10 + 's';
    p.style.width  = p.style.height = (2 + Math.random() * 2) + 'px';
    container.appendChild(p);
  }
}

// ─── Toast ────────────────────────────────────────────────────────
function toast(msg, icon = '✅') {
  const container = document.getElementById('toastC');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${icon}</span> ${msg}`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
