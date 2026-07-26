// Masthead section menu. On desktop the links show inline and the ☰ toggle is
// hidden by CSS, so this script only does anything once the menu collapses on
// narrow screens: it flips the toggle's aria-expanded state (which the CSS uses
// to reveal the dropdown) and closes the menu on link choice, Escape, or an
// outside click.
(function () {
  const toggle = document.querySelector('.site-nav__toggle');
  const menu = document.getElementById('site-menu');
  if (!toggle || !menu) return;

  const setOpen = (open) => toggle.setAttribute('aria-expanded', String(open));

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.site-nav')) setOpen(false);
  });
})();
