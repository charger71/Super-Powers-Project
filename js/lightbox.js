// Shared lightbox for generated pages. Any trigger on the page opens the
// <dialog class="lightbox"> injected by pageShell. Triggers are grouped so
// prev/next cycles only within the gallery the user clicked.
//
// Trigger contract (new): a `.lb-trigger` element carrying
//   data-gallery  — group key (all triggers sharing it cycle together)
//   data-full     — full-res image URL (falls back to inner <img> src)
//   data-title    — heading shown in the caption
//   data-credit   — photo credit line (the red dek)
//   data-caption  — longer description / alt
// Legacy `.gallery__item` (data-image/data-title/data-year/data-status/data-desc)
// is still supported so the hand-authored prototype gallery keeps working.
(function () {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox || typeof lightbox.showModal !== 'function') return;

  const triggers = Array.from(document.querySelectorAll('.lb-trigger, .gallery__item'));
  if (!triggers.length) return;

  const imgEl    = document.getElementById('lightbox-img');
  const titleEl  = document.getElementById('lightbox-title');
  const descEl   = document.getElementById('lightbox-desc');
  const statusEl = document.getElementById('lightbox-status');

  const meta = (el) => {
    const d = el.dataset;
    // the trigger may be a wrapper containing an <img>, or an <img> itself
    // (rich-text prose images) — in which case it is its own thumbnail
    const thumb = el.tagName === 'IMG' ? el : el.querySelector('img');
    return {
      image:  d.full || d.image || (thumb ? thumb.src : ''),
      title:  d.title || (thumb ? thumb.alt : '') || '',
      // new: explicit credit; legacy: "year · status"
      status: d.credit || [d.year, d.status].filter(Boolean).join(' · '),
      desc:   d.caption || d.desc || '',
    };
  };

  // group by data-gallery; legacy items (no data-gallery) share one group
  const groupKey = (el) => el.dataset.gallery || '__legacy__';
  const groups = new Map();
  triggers.forEach((el) => {
    const key = groupKey(el);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  });

  let current = [];   // the active group's triggers
  let idx = 0;

  function render(i) {
    idx = (i + current.length) % current.length;
    const m = meta(current[idx]);
    imgEl.src = m.image;
    imgEl.alt = m.title;
    titleEl.textContent  = m.title;
    descEl.textContent   = m.desc;
    statusEl.textContent = m.status;
    // hide prev/next when the group has a single image
    const solo = current.length < 2;
    lightbox.querySelectorAll('.lightbox__prev, .lightbox__next')
      .forEach((b) => { b.hidden = solo; });
  }

  function open(el) {
    current = groups.get(groupKey(el)) || [el];
    render(current.indexOf(el));
    lightbox.showModal();
  }

  triggers.forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    open(el);
  }));

  lightbox.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') lightbox.close();
    else if (action === 'next') render(idx + 1);
    else if (action === 'prev') render(idx - 1);
    else if (e.target === lightbox) lightbox.close();  // backdrop
  });

  lightbox.addEventListener('keydown', (e) => {
    if (current.length < 2) return;
    if (e.key === 'ArrowRight') render(idx + 1);
    else if (e.key === 'ArrowLeft') render(idx - 1);
    // ESC handled natively by <dialog>
  });
})();
