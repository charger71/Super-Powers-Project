// Power-action bubble text auto-fit. The bubble text (.power-bubble__text) is
// sized in cqw so short phrases like "POWER ACTION PUNCH" fill the circle — but
// long ones ("POWER ACTION DEFLECTOR BRACELETS") would overflow the round edge.
// Each word is put on its own line (reads best as comic lettering), then the
// font is shrunk only when needed so every phrase fits inside the round outline,
// never enlarging past the CSS design size. Runs after fonts load and on resize;
// the words are already in the HTML, so this is presentation-only (no SEO impact).
(function () {
  const nodes = document.querySelectorAll('.power-bubble__text');
  if (!nodes.length) return;

  // One word per line. Keep the original phrase in a data attribute so re-runs
  // (and any future re-splitting) always work from the real text, not the <br>s.
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  nodes.forEach((el) => {
    if (!el.dataset.phrase) el.dataset.phrase = el.textContent.trim();
    el.innerHTML = el.dataset.phrase.split(/\s+/).map(esc).join('<br>');
  });

  // The bubble is a CIRCLE, so fitting the rectangular text box isn't enough —
  // text that fills the box still pokes past the round outline on the top/bottom
  // lines. Instead test the text's four corners against the circle. The circle's
  // centre and inner radius (inside the outline, with a little breathing room)
  // were measured from the SVG as fractions of the .power-bubble box:
  const CX = 0.5, CY = 0.45, R = 0.4;

  // True when every corner of the text sits inside the bubble circle. Measured
  // with the rotation removed (Range gives the untilted text bounds); the small
  // tilt is absorbed by R's margin.
  const fits = (el, box) => {
    const prev = el.style.transform;
    el.style.transform = 'none';
    const range = document.createRange();
    range.selectNodeContents(el);
    const t = range.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    el.style.transform = prev;
    const cx = b.left + CX * b.width;
    const cy = b.top + CY * b.height;
    const r = R * b.width;
    return [
      [t.left, t.top], [t.right, t.top],
      [t.left, t.bottom], [t.right, t.bottom],
    ].every(([x, y]) => Math.hypot(x - cx, y - cy) <= r);
  };

  const fit = (el) => {
    const box = el.closest('.power-bubble');
    if (!box) return;
    el.style.fontSize = '';                                   // back to the CSS cqw size
    const max = parseFloat(getComputedStyle(el).fontSize);
    if (!max || fits(el, box)) return;                        // already fits at design size
    let lo = 8, hi = max, best = lo;                          // largest size that still fits
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      if (fits(el, box)) { best = mid; lo = mid; } else { hi = mid; }
    }
    el.style.fontSize = best + 'px';
  };

  const fitAll = () => nodes.forEach(fit);

  // Wait for the Balloon face so measurements use real glyph metrics.
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fitAll);

  let raf;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(fitAll);
  });
})();
