/**
 * dict.js
 * ───────
 * Dictionary for the trained gloss vocabulary (models/labels.json → window.SIGNS).
 */

'use strict';

function getSignList() {
  return window.SIGNS && Array.isArray(window.SIGNS) ? window.SIGNS : [];
}

function updateDictBanner() {
  const title = document.getElementById('dictBannerTitle');
  const hint = document.getElementById('dictBannerHint');
  if (!title || !hint) return;

  const n = getSignList().length;
  if (n === 0) {
    title.textContent = 'No glosses loaded';
    const err = window._vocabularyLoadError
      ? `<p class="dict-banner-err">${escapeHtml(String(window._vocabularyLoadError))}</p>`
      : '';
    hint.innerHTML =
      err +
      '<p style="margin:0 0 6px">Copy <code>training/export/labels.json</code> → <code>models/labels.json</code>, then hard-refresh (Ctrl+Shift+R).</p>' +
      '<p style="margin:0;font-size:0.72rem;color:var(--t3)">Run the dev server from the <strong>signflow-ai</strong> project folder (the one that contains <code>index.html</code> and <code>models/</code>).</p>';
    return;
  }

  title.textContent = `${n} gloss${n === 1 ? '' : 'es'} in your current model`;
  const src =
    window._vocabularyLoadedUrl ?
      `<span style="font-size:0.72rem;color:var(--t3)">Loaded from <code>${escapeHtml(window._vocabularyLoadedUrl)}</code></span> ` :
      '';
  const thumbs = getSignList().filter((s) => s.mediaUrl).length;
  const thumbNote =
    thumbs > 0 ?
      ` <strong>${thumbs}</strong> entries show a dataset reference image. ` :
      ' Run <code>python training/export_gloss_thumbnails.py</code> to add images. ';
  hint.innerHTML =
    src +
    thumbNote +
    'Live uses the same gloss names via your TF.js model. Use <strong>Text→Sign</strong> or <strong>Copy</strong> on each card to practice.';
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Open Text→Sign with this gloss (append if field already has text). */
window.openT2sWithGloss = function (glossName) {
  const input = document.getElementById('t2sIn');
  if (input) {
    const cur = input.value.trim();
    input.value = cur ? `${cur} ${glossName}` : glossName;
  }
  nav('t2s');
  if (typeof handleT2S === 'function') handleT2S();
  toast(`Text→Sign: ${glossName}`, '✍️');
};

window.copyGlossLabel = async function (glossName) {
  try {
    await navigator.clipboard.writeText(glossName);
    toast(`Copied "${glossName}"`, '📋');
  } catch {
    toast('Copy failed — select the label manually', '⚠️');
  }
};

window.playSignVideo = function (sign) {
  if (sign.videoUrl) {
    // Create modal to play the video
    const modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.innerHTML = `
      <div class="video-modal-content">
        <button class="video-modal-close" onclick="this.closest('.video-modal').remove()">✕</button>
        <h3>${sign.name}</h3>
        <video src="${sign.videoUrl}" controls autoplay loop playsinline style="max-width:100%; max-height:70vh; border-radius:8px;"></video>
        <p style="margin-top:1rem; color:var(--t3)">Watch the sign gesture and match this pose in Live recognition.</p>
      </div>
    `;
    modal.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.8); z-index:9999; display:flex;
      align-items:center; justify-content:center;
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  } else if (sign.mediaUrl) {
    // Fallback to image if video not available
    const modal = document.createElement('div');
    modal.className = 'video-modal';
    modal.innerHTML = `
      <div class="video-modal-content">
        <button class="video-modal-close" onclick="this.closest('.video-modal').remove()">✕</button>
        <h3>${sign.name}</h3>
        <img src="${sign.mediaUrl}" alt="${sign.name}" style="max-width:100%; max-height:70vh; border-radius:8px;">
        <p style="margin-top:1rem; color:var(--t3)">Sign reference image. Match this pose in Live recognition.</p>
      </div>
    `;
    modal.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.8); z-index:9999; display:flex;
      align-items:center; justify-content:center;
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  } else {
    toast('No video/image available for this sign', '⚠️');
  }
};

function buildDict() {
  updateDictBanner();

  const select = document.getElementById('dictCat');
  if (!select) return;

  select.innerHTML = '<option value="all">All categories</option>';
  const signs = getSignList();
  const cats = [...new Set(signs.map((s) => s.cat))].sort();
  cats.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  filterDict();
}

function filterDict() {
  const searchEl = document.getElementById('dictSearch');
  const query = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const catEl = document.getElementById('dictCat');
  const category = catEl ? catEl.value : 'all';
  const grid = document.getElementById('dictGrid');
  if (!grid) return;

  grid.innerHTML = '';

  const filtered = getSignList().filter((s) => {
    const matchQ =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.desc.toLowerCase().includes(query) ||
      s.cat.toLowerCase().includes(query);
    const matchC = category === 'all' || s.cat === category;
    return matchQ && matchC;
  });

  if (!getSignList().length) {
    grid.innerHTML =
      '<div style="color:var(--t3);grid-column:1/-1;text-align:center;padding:2rem">' +
      'No vocabulary loaded. Check <code style="color:var(--a2)">models/labels.json</code> and refresh.</div>';
    return;
  }

  if (!filtered.length) {
    grid.innerHTML =
      '<div style="color:var(--t3);grid-column:1/-1;text-align:center;padding:2rem">' +
      'No glosses match your search.</div>';
    return;
  }

  const v = typeof window.__mediaVersion !== 'undefined' ? window.__mediaVersion : '1';

  filtered.forEach((sign) => {
    const card = document.createElement('div');
    card.className = 'd-card d-card--with-thumb';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'd-thumb-wrap';

    if (sign.mediaUrl) {
      const img = document.createElement('img');
      img.className = 'd-thumb';
      img.alt = 'Dataset reference for gloss ' + sign.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = sign.mediaUrl + '?v=' + encodeURIComponent(v);
      img.addEventListener('error', () => {
        img.remove();
        thumbWrap.classList.add('d-thumb-fallback');
        thumbWrap.textContent = '';
        const fb = document.createElement('span');
        fb.className = 'd-thumb-fallback-ico';
        fb.textContent = sign.emoji || '✋';
        thumbWrap.appendChild(fb);
      });
      thumbWrap.appendChild(img);
    } else {
      thumbWrap.classList.add('d-thumb-fallback');
      const fb = document.createElement('span');
      fb.className = 'd-thumb-fallback-ico';
      fb.textContent = sign.emoji || '✋';
      thumbWrap.appendChild(fb);
    }

    const info = document.createElement('div');
    info.className = 'd-info';

    const h4 = document.createElement('h4');
    h4.className = 'd-gloss-name';
    h4.textContent = sign.name;

    const p = document.createElement('p');
    p.className = 'd-gloss-desc';
    p.textContent = sign.desc || 'Trained gloss label.';

    const cat = document.createElement('span');
    cat.className = 'd-cat';
    cat.textContent = sign.cat || 'Gloss';

    const actions = document.createElement('div');
    actions.className = 'd-actions';

    const btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'd-btn-play';
    btnPlay.textContent = '▶ Play';
    btnPlay.addEventListener('click', (e) => {
      e.stopPropagation();
      window.playSignVideo(sign);
    });

    const btnT2s = document.createElement('button');
    btnT2s.type = 'button';
    btnT2s.className = 'd-btn-primary';
    btnT2s.textContent = 'Try in Text→Sign';
    btnT2s.addEventListener('click', (e) => {
      e.stopPropagation();
      window.openT2sWithGloss(sign.name);
    });

    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.textContent = 'Copy label';
    btnCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      window.copyGlossLabel(sign.name);
    });

    actions.appendChild(btnPlay);
    actions.appendChild(btnT2s);
    actions.appendChild(btnCopy);

    info.appendChild(h4);
    info.appendChild(p);
    info.appendChild(cat);
    info.appendChild(actions);

    card.appendChild(thumbWrap);
    card.appendChild(info);
    grid.appendChild(card);
  });
}

/**
 * Call after reloading vocabulary (e.g. future hot-reload).
 */
window.refreshDictionaryUI = function () {
  buildDict();
};

/** Called from vocabulary.js as soon as labels are fetched (or fail). */
window.applyVocabularyToDictionary = function () {
  buildDict();
};

window.updateDictBanner = updateDictBanner;
window.buildDict = buildDict;
