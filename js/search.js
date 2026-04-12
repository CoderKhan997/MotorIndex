/* ============================================================
   MotorIndex — Search Autocomplete
   Fully instant — scored matching with alias + fuzzy fallback
   Supports car / motorcycle mode via modechange event
   ============================================================ */

(function () {

  // ── Current mode (car | motorcycle) ──────────────────────
  let SEARCH_MODE = 'car';
  window.addEventListener('modechange', e => {
    SEARCH_MODE = e.detail;
    closeDropdown();
  });

  // ── Body type labels / aliases ─────────────────────────────
  const TYPE_ALIASES = {
    suv:         ['suv','crossover','cuv','sport utility'],
    pickup:      ['pickup','truck','pick-up','ute'],
    sedan:       ['sedan','saloon'],
    hatchback:   ['hatchback','hatch'],
    wagon:       ['wagon','estate','touring','avant','sport wagon'],
    coupe:       ['coupe','coupé','cp'],
    convertible: ['convertible','cabriolet','cabrio','roadster','spider','spyder','vert','droptop'],
    minivan:     ['minivan','van','mpv','people mover'],
    motorcycle:  ['motorcycle','bike','moto','motorbike'],
  };

  const TYPE_LABELS = {
    suv: 'SUV / Crossover', pickup: 'Pickup Truck', sedan: 'Sedan',
    hatchback: 'Hatchback', wagon: 'Wagon', coupe: 'Coupé',
    convertible: 'Convertible', minivan: 'Minivan', motorcycle: 'Motorcycle',
  };

  // ── Normalise ──────────────────────────────────────────────
  function n(s) {
    return String(s).toLowerCase().replace(/[\s\-\/\._]/g, '');
  }

  // ── Build flat index from VEHICLE_DB ──────────────────────
  const MAKE_INDEX  = [];
  const MODEL_INDEX = [];

  if (window.VEHICLE_DB) {
    for (const entry of window.VEHICLE_DB) {
      MAKE_INDEX.push({
        name: entry.make,
        country: entry.country,
        tokens: [n(entry.make)],
        hasCar:  entry.models.some(m => !m.types.every(t => t === 'motorcycle')),
        hasMoto: entry.models.some(m => m.types.includes('motorcycle')),
      });

      for (const m of entry.models) {
        const tokens = [
          n(m.name),
          n(entry.make + m.name),
        ];
        if (m.aliases) {
          for (const a of m.aliases) tokens.push(n(a));
        }
        MODEL_INDEX.push({
          name: m.name,
          make: entry.make,
          country: entry.country,
          types: m.types,
          isMoto: m.types.every(t => t === 'motorcycle'),
          tokens,
        });
      }
    }
  }

  // ── Scoring ────────────────────────────────────────────────
  const SCORE = { EXACT: 100, STARTS_WITH: 80, CONTAINS: 60, QUERY_IN: 40, FUZZY: 20 };

  function scoreEntry(tokens, qn) {
    let best = 0;
    for (const tok of tokens) {
      if (tok === qn)                              { best = SCORE.EXACT; break; }
      if (tok.startsWith(qn))                      best = Math.max(best, SCORE.STARTS_WITH);
      else if (tok.includes(qn))                   best = Math.max(best, SCORE.CONTAINS);
      else if (qn.length > 2 && qn.includes(tok))  best = Math.max(best, SCORE.QUERY_IN);
    }
    if (best === 0 && qn.length >= 3) {
      for (const tok of tokens) {
        const s = subseq(qn, tok);
        if (s >= 0.75) best = Math.max(best, Math.round(s * SCORE.FUZZY));
      }
    }
    return best;
  }

  function subseq(needle, hay) {
    if (!hay.length) return 0;
    let ni = 0;
    for (let hi = 0; hi < hay.length && ni < needle.length; hi++) {
      if (hay[hi] === needle[ni]) ni++;
    }
    return ni / needle.length;
  }

  // ── DOM ────────────────────────────────────────────────────
  let focusedIndex  = -1;
  let dropdownItems = [];

  const input    = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  const clearBtn = document.getElementById('searchClear');

  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearBtn.classList.toggle('hidden', val.length === 0);
    if (val.length < 1) { closeDropdown(); return; }
    showResults(val);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    closeDropdown();
    input.focus();
  });

  input.addEventListener('keydown', e => {
    if (!dropdown.classList.contains('open')) return;
    if (e.key === 'ArrowDown')  { e.preventDefault(); setFocus(Math.min(focusedIndex + 1, dropdownItems.length - 1)); }
    else if (e.key === 'ArrowUp')  { e.preventDefault(); setFocus(Math.max(focusedIndex - 1, -1)); }
    else if (e.key === 'Enter')    { e.preventDefault(); if (focusedIndex >= 0) dropdownItems[focusedIndex].click(); }
    else if (e.key === 'Escape')   { closeDropdown(); }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.float-search') && !e.target.closest('#searchBox')) closeDropdown();
  });

  // ── Core search ────────────────────────────────────────────
  function showResults(query) {
    const qn = n(query);
    if (!qn) { closeDropdown(); return; }

    const isMotoMode = SEARCH_MODE === 'motorcycle';

    // 1. Body type detection (only non-moto types in car mode)
    let matchedType = null;
    for (const [type, aliases] of Object.entries(TYPE_ALIASES)) {
      if (isMotoMode && type !== 'motorcycle') continue;
      if (!isMotoMode && type === 'motorcycle') continue;
      if (aliases.some(a => n(a).startsWith(qn) || qn.startsWith(n(a)))) {
        matchedType = type;
        break;
      }
    }

    // 2. Score makes — filtered by mode
    const scoredMakes = MAKE_INDEX
      .filter(m => isMotoMode ? m.hasMoto : m.hasCar)
      .map(m => ({ ...m, score: scoreEntry(m.tokens, qn) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    // 3. Score models — filtered by mode
    const scoredModels = MODEL_INDEX
      .filter(m => isMotoMode ? m.isMoto : !m.isMoto)
      .map(m => ({ ...m, score: scoreEntry(m.tokens, qn) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, 8);

    // 4. Body type results
    let typeResults = [];
    if (matchedType) {
      typeResults = MODEL_INDEX
        .filter(m => m.types.includes(matchedType))
        .slice(0, 8);
    }

    if (scoredMakes.length === 0 && scoredModels.length === 0 && typeResults.length === 0) {
      dropdown.innerHTML = `<div class="dropdown-empty">No results for "<strong>${esc(query)}</strong>"</div>`;
      dropdown.classList.add('open');
      dropdownItems = [];
      return;
    }

    let html = '';

    if (matchedType && typeResults.length > 0 && scoredModels.length === 0 && scoredMakes.length === 0) {
      html += `<div class="dropdown-section-label">${esc(TYPE_LABELS[matchedType]).toUpperCase()}</div>`;
      typeResults.forEach(m => { html += modelItem(m, query); });
    }

    if (scoredMakes.length > 0) {
      html += '<div class="dropdown-section-label">MAKES</div>';
      scoredMakes.forEach(make => {
        const count = MODEL_INDEX.filter(m => m.make === make.name && (isMotoMode ? m.isMoto : !m.isMoto)).length;
        html += `
          <div class="dropdown-item" data-make="${esc(make.name)}" data-type="make" role="option" tabindex="-1">
            <div class="dropdown-item-icon">${make.name.charAt(0).toUpperCase()}</div>
            <div class="dropdown-item-meta">
              <span class="dropdown-item-name">${highlight(make.name, query)}</span>
              <span class="dropdown-item-make-label">${esc(make.country)} · ${count} models</span>
            </div>
            <span class="dropdown-item-sub">Browse →</span>
          </div>`;
      });
    }

    if (scoredModels.length > 0) {
      html += '<div class="dropdown-section-label">MODELS</div>';
      scoredModels.forEach(m => { html += modelItem(m, query); });
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('open');

    dropdownItems = Array.from(dropdown.querySelectorAll('.dropdown-item'));
    dropdownItems.forEach((el, i) => {
      el.addEventListener('mouseenter', () => setFocus(i));
      el.addEventListener('click', () => {
        el.dataset.type === 'make'
          ? go(`browse.html?make=${enc(el.dataset.make)}`)
          : go(`browse.html?make=${enc(el.dataset.make)}&model=${enc(el.dataset.model)}`);
      });
    });
    focusedIndex = -1;
  }

  // ── Helpers ────────────────────────────────────────────────

  function modelItem(m, query) {
    const label = m.types.map(t => TYPE_LABELS[t] || t).join(', ');
    return `
      <div class="dropdown-item" data-make="${esc(m.make)}" data-model="${esc(m.name)}" data-type="model" role="option" tabindex="-1">
        <div class="dropdown-item-icon">${m.name.charAt(0).toUpperCase()}</div>
        <div class="dropdown-item-meta">
          <span class="dropdown-item-name">${highlight(m.name, query)}</span>
          <span class="dropdown-item-make-label">${esc(m.make)} · ${esc(label)}</span>
        </div>
        <span class="dropdown-item-sub">View →</span>
      </div>`;
  }

  function setFocus(i) {
    dropdownItems.forEach((el, j) => el.classList.toggle('focused', j === i));
    focusedIndex = i;
  }

  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    dropdownItems = [];
    focusedIndex = -1;
  }

  function go(url)  { window.location.href = url; }
  function enc(s)   { return encodeURIComponent(s); }

  function highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase().trim());
    if (idx === -1) return esc(text);
    const q = query.trim();
    return esc(text.slice(0, idx)) + `<strong>${esc(text.slice(idx, idx + q.length))}</strong>` + esc(text.slice(idx + q.length));
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
