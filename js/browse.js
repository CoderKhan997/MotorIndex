/* ============================================================
   MotorIndex — Browse Page Logic
   Shows models for a selected make + year modal
   ============================================================ */

const params     = new URLSearchParams(window.location.search);
const makeName   = params.get('make') || '';

const breadcrumbMake  = document.getElementById('breadcrumbMake');
const makeInitialEl   = document.getElementById('makeInitial');
const makeNameHeading = document.getElementById('makeNameHeading');
const makeModelCount  = document.getElementById('makeModelCount');
const modelsGrid      = document.getElementById('modelsGrid');
const modelFilter     = document.getElementById('modelFilter');
const makeBadge       = document.getElementById('makeBadge');

const yearModal       = document.getElementById('yearModal');
const modalClose      = document.getElementById('modalClose');
const modalModelName  = document.getElementById('modalModelName');
const yearGrid        = document.getElementById('yearGrid');

let allModels = [];
let selectedModel = null;

// ── Init ───────────────────────────────────────────────────────
(async function init() {
  if (!makeName) {
    window.location.href = 'index.html';
    return;
  }

  document.title = `${makeName} — MotorIndex`;
  breadcrumbMake.textContent  = makeName;
  makeInitialEl.textContent   = makeName.charAt(0).toUpperCase();
  makeNameHeading.textContent = makeName;

  try {
    allModels = await API.getModelsForMake(makeName);
    makeModelCount.textContent = `${allModels.length} model${allModels.length !== 1 ? 's' : ''} found`;
    renderModels(allModels);
  } catch (err) {
    modelsGrid.innerHTML = `
      <div class="error-state" style="grid-column:1/-1">
        <h3>Could not load models</h3>
        <p>Please check your internet connection and refresh.</p>
      </div>`;
  }
})();

// ── Filter input ───────────────────────────────────────────────
modelFilter?.addEventListener('input', () => {
  const q = modelFilter.value.trim().toLowerCase();
  if (!q) {
    renderModels(allModels);
    return;
  }
  const filtered = allModels.filter(m => m.name.toLowerCase().includes(q));
  renderModels(filtered);
});

// ── Render models ──────────────────────────────────────────────
function renderModels(models) {
  if (models.length === 0) {
    modelsGrid.innerHTML = `
      <div class="no-results">
        <span>—</span>
        No models found
      </div>`;
    return;
  }

  modelsGrid.innerHTML = models.map(model => `
    <div class="model-card" data-model="${escHtml(model.name)}" role="button" tabindex="0" aria-label="Select ${escHtml(model.name)}">
      <div class="model-card-name">${escHtml(model.name)}</div>
      <div class="model-card-make">${escHtml(model.make || makeName)}</div>
      <span class="model-card-arrow">›</span>
    </div>`
  ).join('');

  // Animate in
  requestAnimationFrame(() => {
    Array.from(modelsGrid.querySelectorAll('.model-card')).forEach((card, i) => {
      card.style.animationDelay = `${i * 25}ms`;
      card.classList.add('anim-in');
    });
  });

  // Wire clicks
  modelsGrid.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => openYearModal(card.dataset.model));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') openYearModal(card.dataset.model);
    });
  });
}

// ── Year Modal ─────────────────────────────────────────────────
async function openYearModal(modelName) {
  selectedModel = modelName;
  modalModelName.textContent = `${makeName} · ${modelName}`;
  yearGrid.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading years...</p></div>';
  yearModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  try {
    const years = await API.getYearsForModel(makeName, modelName);

    if (years.length === 0) {
      // Fallback: offer years 1995–current+1
      const current = new Date().getFullYear() + 1;
      for (let y = current; y >= 1995; y--) years.push(y);
    }

    renderYearGrid(years, modelName);
  } catch {
    renderYearGrid(getFallbackYears(), modelName);
  }
}

function renderYearGrid(years, modelName) {
  if (years.length === 0) {
    yearGrid.innerHTML = '<p style="color:var(--text-3); font-size:14px;">No year data available.</p>';
    return;
  }

  yearGrid.innerHTML = years.map(year => `
    <button class="year-btn" data-year="${year}" aria-label="${year} ${escHtml(modelName)}">${year}</button>
  `).join('');

  yearGrid.querySelectorAll('.year-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const year = btn.dataset.year;
      window.location.href = `car.html?make=${encodeURIComponent(makeName)}&model=${encodeURIComponent(modelName)}&year=${year}`;
    });
  });
}

function getFallbackYears() {
  const current = new Date().getFullYear() + 1;
  const years = [];
  for (let y = current; y >= 1995; y--) years.push(y);
  return years;
}

// ── Modal close ────────────────────────────────────────────────
modalClose?.addEventListener('click', closeModal);

yearModal?.addEventListener('click', (e) => {
  if (e.target === yearModal) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function closeModal() {
  yearModal.classList.add('hidden');
  document.body.style.overflow = '';
  selectedModel = null;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
