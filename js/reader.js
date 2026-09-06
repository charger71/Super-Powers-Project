// Comic-page reader for generated pages. Any `.reader-trigger` on the page
// opens the <dialog class="reader"> injected by pageShell and pages through
// the triggers sharing its data-gallery, same grouping convention as
// js/lightbox.js. Distinct from the lightbox: a page counter, and numbered
// translation pins read from each trigger's data-captions JSON.
//
// Trigger contract: a `.reader-trigger` carries
//   data-gallery      — group key (all triggers sharing it page together)
//   data-full/-title/-credit/-caption — same meaning as a .lb-trigger
//   data-source-lang  — the page's own language (for the pin's original text)
//   data-captions     — JSON array of {n, x, y, translated, original, language}
//                        (x/y are 0-100 percent of the image)
(function () {
  const reader = document.getElementById('reader');
  if (!reader || typeof reader.showModal !== 'function') return;

  const triggers = Array.from(document.querySelectorAll('.reader-trigger'));
  if (!triggers.length) return;

  const imgEl      = document.getElementById('reader-img');
  const pinsEl      = document.getElementById('reader-pins');
  const calloutEl   = document.getElementById('reader-callout');
  const translatedEl = document.getElementById('reader-callout-translated');
  const originalEl  = document.getElementById('reader-callout-original');
  const titleEl     = document.getElementById('reader-title');
  const creditEl    = document.getElementById('reader-credit');
  const statusEl    = document.getElementById('reader-status');

  const groupKey = (el) => el.dataset.gallery || '__solo__';
  const groups = new Map();
  triggers.forEach((el) => {
    const key = groupKey(el);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  });

  let current = [];   // the active group's triggers (one comic's pages)
  let idx = 0;
  let openPin = null;  // the pin <button> whose callout is pinned open, if any

  function parseCaptions(el) {
    try { return JSON.parse(el.dataset.captions || '[]'); } catch { return []; }
  }

  function closeCallout() {
    openPin = null;
    calloutEl.hidden = true;
    pinsEl.querySelectorAll('.reader__pin[aria-expanded="true"]')
      .forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  function showCallout(pinBtn, cap, sourceLang) {
    translatedEl.textContent = cap.translated;
    if (cap.original) {
      originalEl.textContent = cap.original;
      originalEl.lang = sourceLang || '';
      originalEl.hidden = false;
    } else {
      originalEl.textContent = '';
      originalEl.hidden = true;
    }
    calloutEl.style.left = pinBtn.style.left;
    calloutEl.style.top = pinBtn.style.top;
    // A pin near the top of the page would push an upward-opening callout
    // past the stage's own edge — flip it below the pin when there's no
    // room above.
    calloutEl.classList.toggle('reader__callout--below', parseFloat(pinBtn.style.top) < 22);
    calloutEl.hidden = false;
    pinsEl.querySelectorAll('.reader__pin[aria-expanded="true"]')
      .forEach((b) => { if (b !== pinBtn) b.setAttribute('aria-expanded', 'false'); });
    pinBtn.setAttribute('aria-expanded', 'true');
  }

  function renderPins(el) {
    pinsEl.replaceChildren();
    closeCallout();
    const sourceLang = el.dataset.sourceLang || '';
    for (const cap of parseCaptions(el)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reader__pin';
      btn.style.left = `${cap.x}%`;
      btn.style.top = `${cap.y}%`;
      btn.textContent = cap.n;
      btn.setAttribute('aria-label', `Translation ${cap.n}`);
      btn.setAttribute('aria-expanded', 'false');

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (openPin === btn) { closeCallout(); return; }
        openPin = btn;
        showCallout(btn, cap, sourceLang);
      });
      btn.addEventListener('mouseenter', () => { if (!openPin) showCallout(btn, cap, sourceLang); });
      btn.addEventListener('focus', () => { if (!openPin) showCallout(btn, cap, sourceLang); });
      btn.addEventListener('mouseleave', () => { if (openPin !== btn) closeCallout(); });
      btn.addEventListener('blur', () => { if (openPin !== btn) closeCallout(); });

      pinsEl.append(btn);
    }
  }

  function render(i) {
    idx = (i + current.length) % current.length;
    const el = current[idx];
    const d = el.dataset;
    const thumb = el.querySelector('img');

    imgEl.src = d.full || (thumb ? thumb.src : '');
    imgEl.alt = d.title || (thumb ? thumb.alt : '') || '';
    titleEl.textContent = d.title || '';
    creditEl.textContent = d.credit || '';
    statusEl.textContent = current.length > 1 ? `Page ${idx + 1} of ${current.length}` : '';

    const solo = current.length < 2;
    reader.querySelectorAll('.reader__prev, .reader__next')
      .forEach((b) => { b.hidden = solo; });

    renderPins(el);
  }

  function open(el) {
    current = groups.get(groupKey(el)) || [el];
    render(current.indexOf(el));
    reader.showModal();
  }

  triggers.forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    open(el);
  }));

  reader.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') reader.close();
    else if (action === 'next') render(idx + 1);
    else if (action === 'prev') render(idx - 1);
    else if (e.target === reader) reader.close();  // backdrop
    else if (!e.target.closest('.reader__pin, .reader__callout')) closeCallout();
  });

  reader.addEventListener('keydown', (e) => {
    if (current.length < 2) return;
    if (e.key === 'ArrowRight') render(idx + 1);
    else if (e.key === 'ArrowLeft') render(idx - 1);
    // ESC handled natively by <dialog>
  });
})();
