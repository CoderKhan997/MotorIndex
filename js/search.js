/* ============================================================
   MotorIndex — Unified Search Engine
   Handles: make, model, alias, year, and mixed queries
   e.g. "2019 toyota camry", "civic type r", "f-150 raptor"
   Exposes window.VEHICLE_SEARCH for use by both search bars.
   ============================================================ */

(function () {

  // ── Normalise: lower-case, strip spaces / punctuation ──────
  function n(s) {
    return String(s).toLowerCase().replace(/[\s\-\/\._,()]/g, '');
  }

  // ── Year token detection ───────────────────────────────────
  function extractYear(tokens) {
    const yearTokens = [];
    const rest       = [];
    for (const t of tokens) {
      if (/^(19|20)\d{2}$/.test(t)) yearTokens.push(parseInt(t));
      else rest.push(t);
    }
    return { year: yearTokens[0] || null, rest };
  }

  // ── Build index once ───────────────────────────────────────
  const INDEX = []; // { make, model, types, country, isMoto, tokens[] }

  if (window.VEHICLE_DB) {
    for (const entry of window.VEHICLE_DB) {
      const makeN = n(entry.make);
      for (const m of entry.models) {
        const modelN = n(m.name);
        const tokens = [
          makeN,
          modelN,
          makeN + modelN,                        // "toyotacamry"
          n(entry.make + ' ' + m.name),          // same but via n()
        ];
        for (const a of (m.aliases || [])) {
          tokens.push(n(a));
          tokens.push(makeN + n(a));             // "toyota" + alias
        }
        INDEX.push({
          make:    entry.make,
          model:   m.name,
          types:   m.types,
          country: entry.country,
          isMoto:  m.types.every(t => t === 'motorcycle'),
          tokens,
          makeN,
          modelN,
        });
      }
    }
  }

  // ── Core scorer ────────────────────────────────────────────
  // Returns 0-100 score for one entry against one normalised query token
  function scoreToken(entry, qt) {
    let best = 0;
    for (const tok of entry.tokens) {
      if (tok === qt)            { best = 100; break; }
      if (tok.startsWith(qt))    { best = Math.max(best, 85); continue; }
      if (tok.includes(qt))      { best = Math.max(best, 65); continue; }
      if (qt.includes(tok) && tok.length >= 3) { best = Math.max(best, 50); }
    }
    return best;
  }

  // ── Main search function ───────────────────────────────────
  // Returns array of result objects sorted by score desc.
  // Each result: { type:'make'|'model', make, model?, types?, country, score, yearHint }
  window.VEHICLE_SEARCH = function (query, mode) {
    if (!query || !query.trim()) return [];

    const raw    = query.trim().split(/\s+/);
    const { year, rest } = extractYear(raw);

    // If only a year was typed, nothing useful to show
    if (!rest.length) return [];

    const isMoto = mode === 'motorcycle';
    const qTokens = rest.map(n).filter(Boolean);
    const qFull   = qTokens.join('');   // concatenated for combo matching

    // ── Score every index entry ──────────────────────────────
    const modelResults = [];
    const makeScores   = {};  // make → best score seen across its models

    for (const entry of INDEX) {
      if (isMoto  && !entry.isMoto) continue;
      if (!isMoto &&  entry.isMoto) continue;

      let score = 0;

      if (qTokens.length === 1) {
        // Single token — score directly
        score = scoreToken(entry, qTokens[0]);

      } else {
        // Multi-token: every token must match something on this entry.
        // Strategy: try to assign each token to make or model/alias.
        let allMatched = true;
        let tokenScores = 0;
        for (const qt of qTokens) {
          const s = scoreToken(entry, qt);
          if (s === 0) { allMatched = false; break; }
          tokenScores += s;
        }
        if (allMatched) {
          // Bonus for make+model combo hit (e.g. "toyota camry")
          const comboScore = scoreToken(entry, qFull);
          score = Math.round(tokenScores / qTokens.length);
          if (comboScore > 0) score = Math.max(score, comboScore);
          // Extra bonus when one token hits the make and another hits model
          const makeHit  = qTokens.some(qt => entry.makeN.includes(qt) || qt.includes(entry.makeN));
          const modelHit = qTokens.some(qt => entry.modelN.includes(qt) || qt.includes(entry.modelN));
          if (makeHit && modelHit) score = Math.min(100, score + 15);
        } else {
          // Partial: at least one token matched — lower score
          let partialScore = 0;
          for (const qt of qTokens) {
            partialScore = Math.max(partialScore, scoreToken(entry, qt));
          }
          score = Math.round(partialScore * 0.4);
        }
      }

      if (score < 10) continue;

      modelResults.push({ ...entry, score, yearHint: year });

      // Track best score per make for make-level suggestions
      if (!makeScores[entry.make] || makeScores[entry.make] < score) {
        makeScores[entry.make] = score;
      }
    }

    // ── Make-level results (when query targets a make name) ──
    const makeResults = [];
    for (const [make, score] of Object.entries(makeScores)) {
      // Only surface a make row if the query strongly matches the make name
      const makeN = n(make);
      const makeMatch = qTokens.some(qt =>
        makeN === qt || makeN.startsWith(qt) || qt.startsWith(makeN)
      );
      if (!makeMatch || score < 60) continue;

      const count = INDEX.filter(e =>
        e.make === make && (isMoto ? e.isMoto : !e.isMoto)
      ).length;
      const entry = INDEX.find(e => e.make === make);
      makeResults.push({
        type: 'make', make, country: entry?.country || '',
        modelCount: count, score: score + 5, // tiny boost so make floats above models
      });
    }

    // ── Combine, de-dupe, sort ───────────────────────────────
    const combined = [
      ...makeResults,
      ...modelResults.map(e => ({ type: 'model', ...e })),
    ];

    // De-dupe make rows (keep highest score)
    const seen = new Set();
    const deduped = combined.filter(r => {
      const key = r.type === 'make' ? `make:${r.make}` : `model:${r.make}:${r.model}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped
      .sort((a, b) => b.score - a.score || a.make.localeCompare(b.make))
      .slice(0, 12);
  };

  // ── DOM wiring — main floating search bar ──────────────────
  let SEARCH_MODE = 'car';
  window.addEventListener('modechange', e => { SEARCH_MODE = e.detail; closeDropdown(); });

  const TYPE_LABELS = {
    suv: 'SUV', pickup: 'Pickup', sedan: 'Sedan', hatchback: 'Hatchback',
    wagon: 'Wagon', coupe: 'Coupé', convertible: 'Convertible',
    minivan: 'Minivan', motorcycle: 'Motorcycle',
  };

  let focusedIndex  = -1;
  let dropdownItems = [];

  const input    = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchDropdown');
  const clearBtn = document.getElementById('searchClear');

  if (!input) return;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearBtn.classList.toggle('hidden', val.length === 0);
    if (!val) { closeDropdown(); return; }
    renderDropdown(val);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.classList.add('hidden');
    closeDropdown();
    input.focus();
  });

  input.addEventListener('keydown', e => {
    if (!dropdown.classList.contains('open')) return;
    if      (e.key === 'ArrowDown') { e.preventDefault(); setFocus(Math.min(focusedIndex + 1, dropdownItems.length - 1)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setFocus(Math.max(focusedIndex - 1, -1)); }
    else if (e.key === 'Enter')     { e.preventDefault(); if (focusedIndex >= 0) dropdownItems[focusedIndex].click(); }
    else if (e.key === 'Escape')    { closeDropdown(); }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#floatSearch')) closeDropdown();
  });

  function renderDropdown(query) {
    const results = window.VEHICLE_SEARCH(query, SEARCH_MODE);

    if (!results.length) {
      dropdown.innerHTML = `<div class="dropdown-empty">No results for "<strong>${esc(query)}</strong>"</div>`;
      dropdown.classList.add('open');
      dropdownItems = [];
      return;
    }

    let html = '';
    let lastType = null;

    for (const r of results) {
      if (r.type !== lastType) {
        html += `<div class="dropdown-section-label">${r.type === 'make' ? 'MAKES' : 'MODELS'}</div>`;
        lastType = r.type;
      }
      if (r.type === 'make') {
        html += `
          <div class="dropdown-item" data-make="${esc(r.make)}" data-type="make" role="option" tabindex="-1">
            <div class="dropdown-item-icon">${esc(r.make[0])}</div>
            <div class="dropdown-item-meta">
              <span class="dropdown-item-name">${hlQuery(r.make, query)}</span>
              <span class="dropdown-item-make-label">${esc(r.country)} · ${r.modelCount} models</span>
            </div>
            <span class="dropdown-item-sub">Browse →</span>
          </div>`;
      } else {
        const yearTag  = r.yearHint ? ` <span style="color:var(--accent);font-size:11px">${r.yearHint}</span>` : '';
        const typeLabel = r.types.map(t => TYPE_LABELS[t] || t).join(' · ');
        html += `
          <div class="dropdown-item" data-make="${esc(r.make)}" data-model="${esc(r.model)}" data-year="${r.yearHint || ''}" data-type="model" role="option" tabindex="-1">
            <div class="dropdown-item-icon">${esc(r.model[0])}</div>
            <div class="dropdown-item-meta">
              <span class="dropdown-item-name">${hlQuery(r.make + ' ' + r.model, query)}${yearTag}</span>
              <span class="dropdown-item-make-label">${esc(r.make)} · ${esc(typeLabel)}</span>
            </div>
            <span class="dropdown-item-sub">View →</span>
          </div>`;
      }
    }

    dropdown.innerHTML = html;
    dropdown.classList.add('open');

    dropdownItems = Array.from(dropdown.querySelectorAll('.dropdown-item'));
    dropdownItems.forEach((el, i) => {
      el.addEventListener('mouseenter', () => setFocus(i));
      el.addEventListener('click', () => {
        if (el.dataset.type === 'make') {
          go(`browse.html?make=${enc(el.dataset.make)}`);
        } else if (el.dataset.year) {
          go(`car.html?make=${enc(el.dataset.make)}&model=${enc(el.dataset.model)}&year=${enc(el.dataset.year)}`);
        } else {
          go(`browse.html?make=${enc(el.dataset.make)}&model=${enc(el.dataset.model)}`);
        }
      });
    });
    focusedIndex = -1;
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

  // ── Highlight query terms inside result text ───────────────
  function hlQuery(text, query) {
    // Highlight each non-year token individually
    const tokens = query.trim().split(/\s+/)
      .filter(t => !/^(19|20)\d{2}$/.test(t))
      .filter(Boolean);
    let result = esc(text);
    for (const t of tokens) {
      if (t.length < 2) continue;
      // Case-insensitive highlight — work on the raw text, re-escape
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
      result = result.replace(re, '<strong>$1</strong>');
    }
    return result;
  }

  function go(url) { window.location.href = url; }
  function enc(s)  { return encodeURIComponent(s); }
  function esc(s)  { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

})();
