/* ============================================================
   MotorIndex — Landing Page · Tree Browser
   Hierarchy: Make → Year → Model → Variant → car.html
   ============================================================ */

// ── Year range ─────────────────────────────────────────────────
const YEAR_START = new Date().getFullYear() + 1;
const YEAR_END   = 1995;
const ALL_YEARS  = [];
for (let y = YEAR_START; y >= YEAR_END; y--) ALL_YEARS.push(y);

// ── Top 10 popular brands (NA + Europe combined, ranked by volume) ──
const POPULAR_MAKES_ORDERED = [
  'Toyota', 'Ford', 'Volkswagen', 'Honda', 'Hyundai',
  'Chevrolet', 'BMW', 'Kia', 'Mercedes-Benz', 'Nissan',
];

// ── Curated makes — cars (VEHICLE_DB entries with at least one non-moto model)
const CURATED_MAKES = (window.VEHICLE_DB || [])
  .filter(entry => entry.models.some(m => !m.types.every(t => t === 'motorcycle')))
  .map(entry => ({ name: entry.make, country: entry.country }));

// Alphabetical for tree search
const CURATED_SORTED = [...CURATED_MAKES].sort((a, b) => a.name.localeCompare(b.name));

// Moto makes — VEHICLE_DB entries with at least one motorcycle model
const MOTO_MAKES = (window.VEHICLE_DB || [])
  .filter(entry => entry.models.some(m => m.types.includes('motorcycle')))
  .map(entry => ({ name: entry.make, country: entry.country }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ── DOM refs ───────────────────────────────────────────────────
const treeRoot    = document.getElementById('treeRoot');
const treeSearch  = document.getElementById('treeSearch');
const floatSearch = document.getElementById('floatSearch');
const searchStrip    = document.getElementById('searchStrip');
const stripCarBtn    = document.getElementById('stripCarBtn');
const stripMotoBtn   = document.getElementById('stripMotoBtn');
const stripSearchBtn = document.getElementById('stripSearchBtn');
const spotlightOverlay = document.getElementById('spotlightOverlay');
const spotlightInput   = document.getElementById('spotlightInput');
const spotlightResults = document.getElementById('spotlightResults');
const spotlightClose   = document.getElementById('spotlightClose');
const modeCarBtn  = document.getElementById('modeCarBtn');
const modeMotoBtn = document.getElementById('modeMotoBtn');
const modePill    = document.getElementById('modePill');
const modeToggle  = document.getElementById('modeToggle');
const treeTitle   = document.querySelector('.tree-list-title');

// ── Current mode ───────────────────────────────────────────────
let TREE_MODE = 'car';

// ── Init pill position + initial render ───────────────────────
function initPill() {
  movePillTo(modeCarBtn);
  renderTree(CURATED_SORTED);
}

function movePillTo(btn) {
  if (!modePill || !modeToggle || !btn) return;
  // offsetLeft relative to toggle container
  modePill.style.width     = btn.offsetWidth + 'px';
  modePill.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
}

function switchMode(mode) {
  if (mode === TREE_MODE) return;
  TREE_MODE = mode;

  const carActive  = mode === 'car';
  modeCarBtn.classList.toggle('active', carActive);
  modeMotoBtn.classList.toggle('active', !carActive);
  modeCarBtn.setAttribute('aria-selected', carActive);
  modeMotoBtn.setAttribute('aria-selected', !carActive);

  movePillTo(carActive ? modeCarBtn : modeMotoBtn);

  // Update placeholder text
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.placeholder = carActive
      ? 'Search by make or model...'
      : 'Search motorcycles...';
  }

  // Update tree title
  if (treeTitle) {
    treeTitle.textContent = carActive ? 'Tree Vehicle List' : 'Motorcycle Brands';
  }

  // Dispatch to search.js
  window.dispatchEvent(new CustomEvent('modechange', { detail: mode }));

  // Re-render tree
  if (carActive) {
    renderTree(CURATED_SORTED);
  } else {
    renderMotoTree(MOTO_MAKES);
  }
}

if (modeCarBtn)  modeCarBtn.addEventListener('click',  () => switchMode('car'));
if (modeMotoBtn) modeMotoBtn.addEventListener('click', () => switchMode('motorcycle'));

// Strip button handlers
if (stripCarBtn)    stripCarBtn.addEventListener('click',    () => { switchMode('car');         _syncStrip(); });
if (stripMotoBtn)   stripMotoBtn.addEventListener('click',   () => { switchMode('motorcycle'); _syncStrip(); });
if (stripSearchBtn) stripSearchBtn.addEventListener('click', openSpotlight);

function _syncStrip() {
  if (!stripCarBtn || !stripMotoBtn) return;
  stripCarBtn.classList.toggle('strip-active',  TREE_MODE === 'car');
  stripMotoBtn.classList.toggle('strip-active', TREE_MODE === 'motorcycle');
}

// ── Spotlight search overlay ───────────────────────────────────
function openSpotlight() {
  if (!spotlightOverlay) return;
  spotlightOverlay.classList.add('spotlight-open');
  setTimeout(() => spotlightInput && spotlightInput.focus(), 60);
}

function closeSpotlight() {
  if (!spotlightOverlay) return;
  spotlightOverlay.classList.remove('spotlight-open');
  if (spotlightInput)   spotlightInput.value = '';
  if (spotlightResults) spotlightResults.innerHTML = '';
}

if (spotlightClose) spotlightClose.addEventListener('click', closeSpotlight);

// Click backdrop (not the box itself) to close
if (spotlightOverlay) {
  spotlightOverlay.addEventListener('click', e => {
    if (e.target === spotlightOverlay) closeSpotlight();
  });
}

// Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && spotlightOverlay?.classList.contains('spotlight-open')) {
    closeSpotlight();
  }
});

// ── Spotlight live search ──────────────────────────────────────
let _spTimer = null;
let _spFocusIdx = -1;

function _spItems() {
  return spotlightResults ? Array.from(spotlightResults.querySelectorAll('.spotlight-result-item')) : [];
}

function _spMoveFocus(delta) {
  const items = _spItems();
  if (!items.length) return;
  items.forEach(i => i.classList.remove('sp-focused'));
  _spFocusIdx = Math.max(0, Math.min(items.length - 1, _spFocusIdx + delta));
  items[_spFocusIdx].classList.add('sp-focused');
  items[_spFocusIdx].scrollIntoView({ block: 'nearest' });
}

if (spotlightInput) {
  spotlightInput.addEventListener('input', () => {
    clearTimeout(_spTimer);
    _spFocusIdx = -1;
    _spTimer = setTimeout(() => _spRender(spotlightInput.value.trim()), 120);
  });

  spotlightInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); _spMoveFocus(1); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); _spMoveFocus(-1); }
    if (e.key === 'Enter') {
      const focused = spotlightResults?.querySelector('.sp-focused');
      if (focused) focused.click();
      else {
        // Navigate via the first result
        const first = spotlightResults?.querySelector('.spotlight-result-item');
        if (first) first.click();
      }
    }
  });
}

function _spRender(q) {
  if (!spotlightResults) return;
  if (!q) { spotlightResults.innerHTML = ''; return; }

  const ql = q.toLowerCase().replace(/[\s\-\/\._]/g, '');
  const SEARCH_MODE_SP = TREE_MODE; // inherit current car/moto mode
  const db = window.VEHICLE_DB || [];

  const hits = [];
  for (const entry of db) {
    const makeLow  = entry.make.toLowerCase();
    const isMoto   = entry.models.every(m => m.types.includes('motorcycle'));
    if (SEARCH_MODE_SP === 'car' && isMoto) continue;
    if (SEARCH_MODE_SP === 'motorcycle' && !isMoto) continue;

    for (const model of entry.models) {
      const nameLow = model.name.toLowerCase();
      const combined = (entry.make + ' ' + model.name).toLowerCase().replace(/[\s\-\/\._]/g, '');
      const aliasMatch = (model.aliases || []).some(a => a.toLowerCase().includes(q.toLowerCase()));

      if (combined.includes(ql) || aliasMatch) {
        hits.push({ make: entry.make, model: model.name, types: model.types });
        if (hits.length >= 8) break;
      }
    }
    if (hits.length >= 8) break;
  }

  if (!hits.length) {
    spotlightResults.innerHTML = `<div style="padding:16px 20px;color:var(--text-3);font-size:14px;">No results for "${escHtml(q)}"</div>`;
    return;
  }

  spotlightResults.innerHTML = hits.map((h, i) => `
    <div class="spotlight-result-item" data-make="${escHtml(h.make)}" data-model="${escHtml(h.model)}" tabindex="-1">
      <div class="spotlight-result-icon">${escHtml(h.make[0])}</div>
      <div style="flex:1;min-width:0">
        <div class="spotlight-result-name">${escHtml(h.make)} ${escHtml(h.model)}</div>
        <div class="spotlight-result-sub">${escHtml(h.types.join(' · '))}</div>
      </div>
      <span class="spotlight-result-arrow">›</span>
    </div>`
  ).join('');

  spotlightResults.querySelectorAll('.spotlight-result-item').forEach(row => {
    row.addEventListener('click', () => {
      const make  = row.dataset.make;
      const model = row.dataset.model;
      // Navigate to browse page so user can pick year
      window.location.href = `browse.html?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    });
  });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init — position pill after layout settles ──────────────────
requestAnimationFrame(() => requestAnimationFrame(initPill));

// ── Tree search (only if the input exists in DOM) ──────────────
if (treeSearch) {
  let _searchTimer = null;
  treeSearch.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      const q = treeSearch.value.trim().toLowerCase();
      if (!q) {
        renderTree(CURATED_SORTED);
      } else {
        const filtered = CURATED_SORTED.filter(m => m.name.toLowerCase().includes(q));
        renderTree(filtered.length ? filtered : []);
      }
    }, 200);
  });
}

// ── Floating search bar + strip scroll behaviour ───────────────
const FLOAT_TOP_RATIO = 0.44;
const FLOAT_GAP       = 36;
const FLOAT_MIN_TOP   = 76;
const CONTENT_GAP     = 48;
const HYSTERESIS      = 40;

// Vertical offset of the strip from the top of the visible viewport
// (tracks scroll so it stays comfortably in view beside the tree)
const STRIP_VIEWPORT_TOP = 120;  // px from top of viewport
const STRIP_MAX_TOP      = 76;   // never go above header

const floatArrow    = floatSearch ? floatSearch.querySelector('.float-arrow') : null;
const heroInner     = document.querySelector('.hero-inner');
const browseSection = document.querySelector('.browse-section');

let _isMinimized = false;

function _positionStrip() {
  if (!searchStrip || !treeRoot) return;

  // Horizontal: center the strip in the gap between viewport left and tree left edge
  const treeRect  = treeRoot.getBoundingClientRect();
  const gapWidth  = treeRect.left;           // px between viewport left and tree
  const stripW    = searchStrip.offsetWidth;
  const stripLeft = Math.max(8, (gapWidth - stripW) / 2);
  searchStrip.style.left = stripLeft + 'px';

  // Vertical: fixed viewport position that scrolls with the user
  const desiredTop = STRIP_VIEWPORT_TOP;
  searchStrip.style.top = Math.max(STRIP_MAX_TOP, desiredTop) + 'px';
}

function positionFloatSearch() {
  if (!floatSearch || !browseSection) return;

  const searchH    = floatSearch.offsetHeight;
  const browseRect = browseSection.getBoundingClientRect();
  const targetTop  = window.innerHeight * FLOAT_TOP_RATIO;
  const maxTop     = browseRect.top - searchH - FLOAT_GAP;

  // Hysteresis prevents flickering at the boundary
  const shouldMinimize = _isMinimized
    ? targetTop >= maxTop - HYSTERESIS
    : targetTop >= maxTop;

  if (shouldMinimize && !_isMinimized) {
    _isMinimized = true;
    floatSearch.classList.add('search-minimized');
    if (searchStrip) {
      _positionStrip();
      searchStrip.classList.add('strip-visible');
    }

  } else if (!shouldMinimize && _isMinimized) {
    _isMinimized = false;
    floatSearch.classList.remove('search-minimized');
    if (searchStrip) searchStrip.classList.remove('strip-visible');
    setTimeout(() => movePillTo(TREE_MODE === 'car' ? modeCarBtn : modeMotoBtn), 420);

  } else if (_isMinimized) {
    // Keep strip positioned while scrolling in minimized state
    _positionStrip();
  }

  // Normal scroll-track (only while not minimized)
  if (!_isMinimized) {
    let top = targetTop;
    if (top > maxTop) top = maxTop;
    if (heroInner) {
      const minFromHero = heroInner.getBoundingClientRect().bottom + CONTENT_GAP;
      if (top < minFromHero) top = minFromHero;
    }
    if (top < FLOAT_MIN_TOP) top = FLOAT_MIN_TOP;
    floatSearch.style.top = top + 'px';
  }

  // Arrow fades out when docked
  if (floatArrow) {
    const hide = shouldMinimize || _isMinimized;
    floatArrow.style.opacity       = hide ? '0' : '';
    floatArrow.style.pointerEvents = hide ? 'none' : '';
  }
}

window.addEventListener('scroll', positionFloatSearch, { passive: true });
window.addEventListener('resize', () => {
  positionFloatSearch();
  movePillTo(TREE_MODE === 'car' ? modeCarBtn : modeMotoBtn);
});

// ── Render car tree (NHTSA-backed: make → year → model) ────────
function renderTree(makes) {
  treeRoot.innerHTML = '';
  if (makes.length === 0) {
    treeRoot.innerHTML = '<div class="tree-empty">No makes matched your search</div>';
    return;
  }

  // Full unfiltered list → show popular brands first + "Show More"
  const isFullList = makes === CURATED_SORTED;
  if (isFullList) {
    renderPopularTree(makes);
    return;
  }

  // Filtered (search) → flat list
  const frag = document.createDocumentFragment();
  makes.forEach(make => frag.appendChild(buildMakeRow(make)));
  treeRoot.appendChild(frag);
}

function renderPopularTree(allMakes) {
  // Popular brands in popularity order
  const popularEntries = POPULAR_MAKES_ORDERED
    .map(name => allMakes.find(m => m.name === name))
    .filter(Boolean);

  // All remaining brands A–Z (excluding the popular 10)
  const popularSet  = new Set(POPULAR_MAKES_ORDERED);
  const restEntries = allMakes.filter(m => !popularSet.has(m.name));

  // ── Popular section ──
  const popularLabel = mkEl('div', 'tree-section-label');
  popularLabel.textContent = 'POPULAR BRANDS';
  treeRoot.appendChild(popularLabel);

  popularEntries.forEach(make => treeRoot.appendChild(buildMakeRow(make)));

  // ── Show More button ──
  const showMoreWrap = mkEl('div', 'tree-show-more-wrap');
  const showMoreBtn  = mkEl('button', 'tree-show-more-btn');
  showMoreBtn.setAttribute('aria-expanded', 'false');
  showMoreBtn.innerHTML = `
    <span class="show-more-label">Show all brands</span>
    <span class="show-more-count">${restEntries.length} more</span>
    <svg class="show-more-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;
  showMoreWrap.appendChild(showMoreBtn);
  treeRoot.appendChild(showMoreWrap);

  // ── Extended list (collapsed by default) ──
  const restOuter = mkEl('div', 'tree-extended');
  const restInner = mkEl('div', 'tree-extended-inner');

  const restLabel = mkEl('div', 'tree-section-label');
  restLabel.textContent = 'ALL BRANDS — A TO Z';
  restInner.appendChild(restLabel);
  restEntries.forEach(make => restInner.appendChild(buildMakeRow(make)));

  restOuter.appendChild(restInner);
  treeRoot.appendChild(restOuter);

  showMoreBtn.addEventListener('click', () => {
    const expanded = restOuter.classList.toggle('open');
    showMoreBtn.setAttribute('aria-expanded', String(expanded));
    showMoreBtn.querySelector('.show-more-label').textContent =
      expanded ? 'Show fewer brands' : 'Show all brands';
  });
}

// ── Render motorcycle tree (local DB: make → model, no year level) ─
function renderMotoTree(makes) {
  treeRoot.innerHTML = '';
  if (makes.length === 0) {
    treeRoot.innerHTML = '<div class="tree-empty">No motorcycle brands found</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  makes.forEach(make => frag.appendChild(buildMotoMakeRow(make)));
  treeRoot.appendChild(frag);
}

function buildMotoMakeRow(make) {
  // Get motorcycle models for this make from VEHICLE_DB
  const dbEntry  = (window.VEHICLE_DB || []).find(e => e.make === make.name);
  const motoModels = dbEntry
    ? dbEntry.models.filter(m => m.types.includes('motorcycle'))
    : [];

  const wrap   = mkEl('div', 'tree-make');
  const header = mkEl('div', 'tree-make-header');
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', make.name + ' — expand models');

  const icon    = mkEl('span', 'tree-expand-icon');
  icon.textContent = '+';

  const badge   = mkEl('span', 'country-badge');
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = make.country || '';

  const nameEl  = mkEl('span', 'tree-make-name');
  nameEl.textContent = make.name;

  header.appendChild(icon);
  header.appendChild(badge);
  header.appendChild(nameEl);

  const { collapsible, inner } = buildCollapsible();
  wrap.appendChild(header);
  wrap.appendChild(collapsible);

  let expanded = false;
  let built    = false;

  function toggle() {
    expanded = !expanded;
    header.setAttribute('aria-expanded', String(expanded));
    icon.textContent = expanded ? '−' : '+';
    icon.classList.toggle('open', expanded);
    collapsible.classList.toggle('open', expanded);

    if (expanded && !built) {
      built = true;
      if (motoModels.length === 0) {
        inner.innerHTML = '<div class="tree-empty-year">No models listed</div>';
      } else {
        const container = mkEl('div', 'tree-models');
        motoModels.forEach(m => {
          const row = mkEl('div', 'tree-model-header');
          row.setAttribute('tabindex', '0');
          row.setAttribute('role', 'button');
          row.setAttribute('aria-label', m.name + ' — view');

          const ri    = mkEl('span', 'tree-expand-icon');
          ri.textContent = '›';
          const rname = mkEl('span', 'tree-model-name');
          rname.textContent = m.name;
          row.appendChild(ri);
          row.appendChild(rname);

          function go() {
            window.location.href =
              'browse.html?make=' + encodeURIComponent(make.name) +
              '&model=' + encodeURIComponent(m.name);
          }
          row.addEventListener('click', go);
          row.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
          });
          container.appendChild(row);
        });
        inner.appendChild(container);
      }
    }
  }

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  return wrap;
}

// ══════════════════════════════════════════════════════════════
// MAKE ROW
// ══════════════════════════════════════════════════════════════
function buildMakeRow(make) {
  const wrap   = mkEl('div', 'tree-make');
  const header = mkEl('div', 'tree-make-header');
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', make.name + ' — expand years');

  const icon = mkEl('span', 'tree-expand-icon');
  icon.textContent = '+';

  // Country badge — styled chip using Space Mono, works everywhere
  const badgeEl = mkEl('span', 'country-badge');
  badgeEl.setAttribute('aria-hidden', 'true');
  badgeEl.textContent = make.country || '';

  const nameEl = mkEl('span', 'tree-make-name');
  nameEl.textContent = make.name;

  header.appendChild(icon);
  header.appendChild(badgeEl);
  header.appendChild(nameEl);

  const { collapsible, inner } = buildCollapsible();
  wrap.appendChild(header);
  wrap.appendChild(collapsible);

  let yearsBuilt = false;
  let expanded   = false;

  function toggle() {
    expanded = !expanded;
    header.setAttribute('aria-expanded', String(expanded));
    icon.textContent = expanded ? '−' : '+';
    icon.classList.toggle('open', expanded);
    collapsible.classList.toggle('open', expanded);

    // Lazy-build year list on first open
    if (expanded && !yearsBuilt) {
      yearsBuilt = true;
      inner.appendChild(buildYearList(make.name));
    }
  }

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  return wrap;
}

// ══════════════════════════════════════════════════════════════
// YEAR LIST  (all years pre-built once per make expand)
// ══════════════════════════════════════════════════════════════
function buildYearList(makeName) {
  const container = mkEl('div', 'tree-years');
  ALL_YEARS.forEach(year => container.appendChild(buildYearRow(makeName, year)));
  return container;
}

// ══════════════════════════════════════════════════════════════
// YEAR ROW
// ══════════════════════════════════════════════════════════════
function buildYearRow(makeName, year) {
  const wrap   = mkEl('div', 'tree-year');
  const header = mkEl('div', 'tree-year-header');
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', year + ' — expand models');

  const icon  = mkEl('span', 'tree-expand-icon');
  icon.textContent = '+';
  const label = mkEl('span', 'tree-year-label');
  label.textContent = String(year);

  header.appendChild(icon);
  header.appendChild(label);

  const { collapsible, inner } = buildCollapsible();
  wrap.appendChild(header);
  wrap.appendChild(collapsible);

  let modelsLoaded = false;
  let isLoading    = false;
  let expanded     = false;

  async function toggle() {
    // Block re-entry while a fetch is in progress
    if (isLoading) return;

    expanded = !expanded;
    header.setAttribute('aria-expanded', String(expanded));
    icon.textContent = expanded ? '−' : '+';
    icon.classList.toggle('open', expanded);
    collapsible.classList.toggle('open', expanded);

    // Fetch models on first expand
    if (expanded && !modelsLoaded) {
      isLoading = true;
      inner.innerHTML =
        '<div class="tree-loading"><span class="tree-spinner tree-spinner--xs"></span>Loading models...</div>';

      try {
        const models = await API.getModelsForMakeYear(makeName, year);
        modelsLoaded = true;
        inner.innerHTML = '';

        if (models.length === 0) {
          const empty = mkEl('div', 'tree-empty-year');
          empty.textContent = 'No models in database for this year';
          inner.appendChild(empty);
        } else {
          inner.appendChild(buildModelList(makeName, year, models));
        }
      } catch {
        // Show retry prompt; do NOT set modelsLoaded so next expand retries
        inner.innerHTML =
          '<div class="tree-empty-year tree-error">Failed to load — click to retry</div>';
        expanded = false;
        collapsible.classList.remove('open');
        icon.textContent = '+';
        icon.classList.remove('open');
        header.setAttribute('aria-expanded', 'false');
      } finally {
        isLoading = false;
      }
    }
  }

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  return wrap;
}

// ══════════════════════════════════════════════════════════════
// MODEL LIST
// ══════════════════════════════════════════════════════════════
function buildModelList(makeName, year, models) {
  const container = mkEl('div', 'tree-models');
  models.forEach(model => container.appendChild(buildModelRow(makeName, year, model)));
  return container;
}

// ══════════════════════════════════════════════════════════════
// MODEL ROW
// ══════════════════════════════════════════════════════════════
function buildModelRow(makeName, year, model) {
  const wrap   = mkEl('div', 'tree-model');
  const header = mkEl('div', 'tree-model-header');
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', model.name + ' — select');

  const icon   = mkEl('span', 'tree-expand-icon');
  icon.textContent = '+';
  const nameEl = mkEl('span', 'tree-model-name');
  nameEl.textContent = model.name;

  header.appendChild(icon);
  header.appendChild(nameEl);

  const { collapsible, inner } = buildCollapsible();
  wrap.appendChild(header);
  wrap.appendChild(collapsible);

  let variantsLoaded = false;
  let isLoading      = false;
  let expanded       = false;

  // Called on first click: fetch variants then navigate or expand
  async function activate() {
    if (isLoading) return;
    isLoading = true;

    // Show spinner inside the icon while fetching
    icon.innerHTML = '<span class="tree-spinner tree-spinner--xs"></span>';

    // getVariantsForModel never throws (returns [] on error)
    const variants = await API.getVariantsForModel(year, makeName, model.name);
    variantsLoaded = true;
    isLoading = false;

    if (variants.length <= 1) {
      // Navigate directly — no meaningful variant distinction
      window.location.href =
        'car.html?make=' + encodeURIComponent(makeName) +
        '&model=' + encodeURIComponent(model.name) +
        '&year=' + year;
      return;
    }

    // Multiple variants — expand to show them
    expanded = true;
    icon.textContent = '−';
    icon.classList.add('open');
    header.setAttribute('aria-expanded', 'true');
    collapsible.classList.add('open');
    inner.appendChild(buildVariantList(makeName, year, model.name, variants));
  }

  function toggle() {
    if (!variantsLoaded) {
      // First interaction: fetch + decide
      activate();
    } else if (expanded) {
      // Collapse (variants already shown)
      expanded = false;
      icon.textContent = '+';
      icon.classList.remove('open');
      header.setAttribute('aria-expanded', 'false');
      collapsible.classList.remove('open');
    } else {
      // Re-expand (variants cached in DOM)
      expanded = true;
      icon.textContent = '−';
      icon.classList.add('open');
      header.setAttribute('aria-expanded', 'true');
      collapsible.classList.add('open');
    }
  }

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });

  return wrap;
}

// ══════════════════════════════════════════════════════════════
// VARIANT LIST
// ══════════════════════════════════════════════════════════════
function buildVariantList(makeName, year, modelName, variants) {
  const container = mkEl('div', 'tree-variants');

  variants.forEach(v => {
    const row = mkEl('div', 'tree-variant-row');
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', v.description + ' — view vehicle');

    const arrow = mkEl('span', 'tree-variant-arrow');
    arrow.textContent = '›';

    const label = mkEl('span', 'tree-variant-label');
    label.textContent = cleanVariantLabel(v.description, year, makeName, modelName);

    row.appendChild(arrow);
    row.appendChild(label);

    function navigate() {
      window.location.href =
        'car.html?make=' + encodeURIComponent(makeName) +
        '&model=' + encodeURIComponent(modelName) +
        '&year=' + year;
    }

    row.addEventListener('click', navigate);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(); }
    });

    container.appendChild(row);
  });

  return container;
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * NHTSA VehicleDescription format: "2025 CADILLAC CT5 2.0L 4-CYL TURBO AWD"
 * Strip the leading "YEAR MAKE " prefix so we show just "CT5 2.0L 4-CYL TURBO AWD"
 * which makes the model+variant clear without redundancy.
 */
function cleanVariantLabel(desc, year, make, model) {
  if (!desc) return model;
  const prefix = String(year) + ' ' + make.toUpperCase() + ' ';
  const upper  = desc.toUpperCase();
  if (upper.startsWith(prefix)) {
    return desc.substring(prefix.length).trim() || desc;
  }
  return desc;
}

function buildCollapsible() {
  const collapsible = mkEl('div', 'tree-collapsible');
  const inner       = mkEl('div', 'tree-collapsible-inner');
  collapsible.appendChild(inner);
  return { collapsible, inner };
}

function mkEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
