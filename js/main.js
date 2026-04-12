/* ============================================================
   MotorIndex — Landing Page · Tree Browser
   Hierarchy: Make → Year → Model → Variant → car.html
   ============================================================ */

// ── Year range ─────────────────────────────────────────────────
const YEAR_START = new Date().getFullYear() + 1;
const YEAR_END   = 1995;
const ALL_YEARS  = [];
for (let y = YEAR_START; y >= YEAR_END; y--) ALL_YEARS.push(y);

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

// ── Floating search bar scroll behaviour ──────────────────────
const FLOAT_TOP_RATIO  = 0.44;  // target: 44% of viewport height
const FLOAT_GAP        = 36;    // px gap above the browse section when docked
const FLOAT_MIN_TOP    = 76;    // never go above the header (60px + 16px buffer)
const CONTENT_GAP      = 48;    // min px below hero title/subtitle

const floatArrow    = floatSearch ? floatSearch.querySelector('.float-arrow') : null;
const heroInner     = document.querySelector('.hero-inner');
const browseSection = document.querySelector('.browse-section');

function positionFloatSearch() {
  if (!floatSearch || !browseSection) return;

  const searchH      = floatSearch.offsetHeight;
  const browseRect   = browseSection.getBoundingClientRect();
  const targetTop    = window.innerHeight * FLOAT_TOP_RATIO;

  // Stop the search bar before the browse section (includes title + padding)
  const maxTop       = browseRect.top - searchH - FLOAT_GAP;

  // Whether we've reached the docking point
  const isDocked     = targetTop >= maxTop;

  let top = isDocked ? maxTop : targetTop;

  // Never overlap the hero title / subtitle — enforce min distance below content
  if (heroInner) {
    const heroBottom     = heroInner.getBoundingClientRect().bottom;
    const minFromContent = heroBottom + CONTENT_GAP;
    if (top < minFromContent) top = minFromContent;
  }

  // Hard floor: never go above the header
  if (top < FLOAT_MIN_TOP) top = FLOAT_MIN_TOP;

  floatSearch.style.top = top + 'px';

  // Fade the arrow out when docked above the tree section
  if (floatArrow) {
    floatArrow.style.opacity      = isDocked ? '0' : '1';
    floatArrow.style.pointerEvents = isDocked ? 'none' : '';
  }
}

window.addEventListener('scroll', positionFloatSearch, { passive: true });
window.addEventListener('resize', () => { positionFloatSearch(); movePillTo(TREE_MODE === 'car' ? modeCarBtn : modeMotoBtn); });

// ── Render car tree (NHTSA-backed: make → year → model) ────────
function renderTree(makes) {
  treeRoot.innerHTML = '';
  if (makes.length === 0) {
    treeRoot.innerHTML = '<div class="tree-empty">No makes matched your search</div>';
    return;
  }
  const frag = document.createDocumentFragment();
  makes.forEach(make => frag.appendChild(buildMakeRow(make)));
  treeRoot.appendChild(frag);
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
