// Client-side search over the pre-built index (search-index.json). Zero
// dependencies. The site is static (cPanel / GitHub Pages), so there is no
// server to query — the whole index ships as one small JSON file and we filter
// it in the browser. See build/build-dossiers.mjs → buildSearchIndex/renderSearch.

(() => {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const filterBtns = [...document.querySelectorAll('.search-filter')];
  if (!input || !results) return;

  const GROUP_LABEL = {
    character: 'Character', toy: 'Toy', comic: 'Comic',
    media: 'Media', merch: 'Merchandise', creator: 'Creator',
    article: 'News',
  };
  const MAX_RESULTS = 200;

  let index = [];
  let group = 'all';
  let ready = false;

  const esc = (s) => String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

  // Index URL is resolved relative to this page (/search/index.html), so it
  // works at the domain root or under any subpath.
  fetch(new URL('../search-index.json', location.href))
    .then((r) => r.ok ? r.json() : Promise.reject(r.status))
    .then((data) => {
      index = data;
      ready = true;
      // Support deep links like /search/?q=cyborg
      const q = new URLSearchParams(location.search).get('q');
      if (q) input.value = q;
      render();
      input.focus({ preventScroll: true });
    })
    .catch(() => {
      status.textContent = 'Search index could not be loaded.';
    });

  const score = (entry, terms) => {
    const title = entry.t.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (title.startsWith(t)) s += 4;
      else if (title.includes(t)) s += 2;
      else if ((entry.m || '').includes(t)) s += 1;
      else return -1; // every term must match somewhere
    }
    return s;
  };

  const render = () => {
    if (!ready) return;
    const q = input.value.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    let pool = group === 'all' ? index : index.filter((e) => e.g === group);

    let hits;
    if (terms.length) {
      hits = pool
        .map((e) => ({ e, s: score(e, terms) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s || String(a.e.t).localeCompare(String(b.e.t)));
    } else {
      // No query: show the pool alphabetically (a browsable directory).
      hits = pool.slice()
        .sort((a, b) => String(a.t).localeCompare(String(b.t)))
        .map((e) => ({ e, s: 0 }));
    }

    const shown = hits.slice(0, MAX_RESULTS);
    if (!hits.length) {
      results.innerHTML = '';
      status.textContent = q
        ? `No matches for “${input.value.trim()}”.`
        : 'Nothing to show.';
      return;
    }
    status.textContent = q
      ? `${hits.length} result${hits.length === 1 ? '' : 's'} for “${input.value.trim()}”`
        + (hits.length > MAX_RESULTS ? ` — showing first ${MAX_RESULTS}` : '')
      : `Browsing ${hits.length} record${hits.length === 1 ? '' : 's'}`;

    results.innerHTML = shown.map(({ e }) => `<a class="search-result" href="${esc(e.u)}">
        <span class="search-result__kind" data-group="${esc(e.g)}">${esc(e.k || GROUP_LABEL[e.g] || '')}</span>
        <span class="search-result__title">${esc(e.t)}</span>
        ${e.y ? `<span class="search-result__year">${esc(e.y)}</span>` : ''}
      </a>`).join('');
  };

  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(render, 120);
    // Keep the URL shareable without spamming history.
    const q = input.value.trim();
    const url = q ? `?q=${encodeURIComponent(q)}` : location.pathname;
    history.replaceState(null, '', url);
  });

  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    group = btn.dataset.group;
    filterBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
    render();
  }));
})();
