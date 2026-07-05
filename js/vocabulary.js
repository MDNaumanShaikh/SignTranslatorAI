/**
 * vocabulary.js
 * Loads gloss labels into window.SIGNS (same order as the trained model).
 * Optionally merges models/gloss_media.json so each sign has a dataset reference image.
 */
'use strict';

window.SIGNS = [];
window._vocabularyLoadError = null;
window._vocabularyLoadedUrl = null;
/** Bumped after vocabulary + media load so dictionary images bypass stale cache. */
window.__mediaVersion = '1';

function resolveLabelUrls() {
  const href = window.location.href;
  const bases = [];
  bases.push(new URL('models/labels.json', href).href);
  bases.push(new URL('./models/labels.json', href).href);
  bases.push(new URL('labels.json', href).href);
  try {
    bases.push(new URL('../models/labels.json', href).href);
  } catch {
    /* ignore */
  }
  return [...new Set(bases)];
}

function resolveMediaManifestUrls() {
  const href = window.location.href;
  return [
    new URL('models/gloss_media.json', href).href,
    new URL('./models/gloss_media.json', href).href,
  ];
}

async function attachGlossMedia(bust) {
  for (const base of resolveMediaManifestUrls()) {
    const url = base + (base.includes('?') ? '&' : '?') + bust;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) continue;
      const map = await r.json();
      if (!map || typeof map !== 'object') continue;

      window.SIGNS.forEach((s) => {
        const media = map[s.name];
        // Handle both old format (string) and new format (object with thumbnailUrl/videoUrl)
        if (typeof media === 'string' && media.length) {
          s.mediaUrl = media;
          s.videoUrl = null;
        } else if (media && typeof media === 'object') {
          s.mediaUrl = media.thumbnailUrl || null;
          s.videoUrl = media.videoUrl || null;
        } else {
          s.mediaUrl = null;
          s.videoUrl = null;
        }
        
        if (s.mediaUrl || s.videoUrl) {
          s.desc = 'Reference media from dataset — use video to learn the sign pose for Live recognition.';
        }
      });
      window.__mediaVersion = String(Date.now());
      return;
    } catch {
      /* try next */
    }
  }
}

/**
 * @returns {Promise<Array<{name:string,emoji:string,cat:string,desc:string,detect:Function,mediaUrl?:string|null}>>}
 */
window.loadVocabulary = async function loadVocabulary() {
  window._vocabularyLoadError = null;
  window._vocabularyLoadedUrl = null;

  const bust = 't=' + Date.now();
  const tryUrls = resolveLabelUrls();

  for (const baseUrl of tryUrls) {
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + bust;
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        continue;
      }
      const labels = await r.json();
      if (!Array.isArray(labels) || !labels.length) {
        window._vocabularyLoadError = 'labels.json is not a non-empty JSON array.';
        window.SIGNS = [];
        break;
      }
      window.SIGNS = labels.map((name) => ({
        name: String(name),
        emoji: '✋',
        cat: 'Gloss',
        desc: 'ASL gloss from your trained vocabulary.',
        mediaUrl: null,
        detect() {
          return 0;
        },
      }));
      window._vocabularyLoadedUrl = url.split('?')[0];
      window._vocabularyLoadError = null;
      await attachGlossMedia(bust);
      break;
    } catch (e) {
      window._vocabularyLoadError = e && e.message ? e.message : String(e);
    }
  }

  if (!window.SIGNS.length && !window._vocabularyLoadError) {
    window._vocabularyLoadError =
      'Could not load models/labels.json (HTTP 404 or blocked). Serve the site from the project folder that contains the models/ folder.';
  }

  if (typeof window.applyVocabularyToDictionary === 'function') {
    try {
      window.applyVocabularyToDictionary();
    } catch (e) {
      console.warn('[SignFlowAI] dictionary refresh failed:', e);
    }
  }

  return window.SIGNS;
};
