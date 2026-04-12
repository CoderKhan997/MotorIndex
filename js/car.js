/* ============================================================
   MotorIndex — Car Detail Page Logic
   Orchestrates all data fetching and tab rendering
   ============================================================ */

const params    = new URLSearchParams(window.location.search);
const make      = params.get('make')  || '';
const model     = params.get('model') || '';
const year      = params.get('year')  || '';

// ── Guard ──────────────────────────────────────────────────────
if (!make || !model || !year) {
  window.location.href = 'index.html';
}

// ── DOM refs ───────────────────────────────────────────────────
const els = {
  title:             document.getElementById('carTitle'),
  yearBadge:         document.getElementById('carYear'),
  carMeta:           document.getElementById('carMeta'),
  carRatingRow:      document.getElementById('carRatingRow'),
  breadcrumbMake:    document.getElementById('breadcrumbMakeLink'),
  breadcrumbModel:   document.getElementById('breadcrumbModelLink'),
  breadcrumbYear:    document.getElementById('breadcrumbYear'),
  recallBanner:      document.getElementById('recallBanner'),
  recallBannerText:  document.getElementById('recallBannerText'),
  recallBanner:      document.getElementById('recallBanner'),
  overviewDesc:      document.getElementById('overviewDesc'),
  safetyBlock:       document.getElementById('safetyBlock'),
  quickFactsBody:    document.getElementById('quickFactsBody'),
  externalLinks:     document.getElementById('externalLinks'),
  specsContent:      document.getElementById('specsContent'),
  maintenanceContent:document.getElementById('maintenanceContent'),
  videosGrid:        document.getElementById('videosGrid'),
  carImage:          document.getElementById('carImage'),
  carImagePlaceholder: document.getElementById('carImagePlaceholder'),
  recallsSection:    document.getElementById('recallsSection'),
  recallsList:       document.getElementById('recallsList'),
};

// ── Set page header ────────────────────────────────────────────
document.title = `${year} ${make} ${model} — MotorIndex`;
els.title.textContent      = `${make} ${model}`;
els.yearBadge.textContent  = `MODEL YEAR ${year}`;
els.breadcrumbYear.textContent  = year;

els.breadcrumbMake.textContent  = make;
els.breadcrumbMake.href = `browse.html?make=${encodeURIComponent(make)}`;
els.breadcrumbModel.textContent = model;
els.breadcrumbModel.href = `browse.html?make=${encodeURIComponent(make)}`;

// Meta chips
els.carMeta.innerHTML = [
  make, model, year
].map(v => `<span class="car-meta-item">${escHtml(v)}</span>`).join('');

// ── Tab system ─────────────────────────────────────────────────
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
let loadedTabs  = new Set(['overview']);

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  tabBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
  tabPanels.forEach(p => {
    p.classList.toggle('active', p.id === `tab-${tab}`);
  });

  // Lazy load tab content
  if (!loadedTabs.has(tab)) {
    loadedTabs.add(tab);
    if (tab === 'specs')       renderSpecs();
    if (tab === 'maintenance') renderMaintenance();
    if (tab === 'videos')      renderVideos();
  }

  // Scroll to top of content
  document.getElementById(`tab-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Main data load ─────────────────────────────────────────────
(async function init() {
  // Run fetches in parallel
  const [wiki, ratings, recalls] = await Promise.allSettled([
    API.getWikiInfo(make, model, year),
    API.getSafetyRatings(year, make, model),
    API.getRecalls(make, model, year),
  ]);

  renderOverview(
    wiki.status    === 'fulfilled' ? wiki.value    : null,
    ratings.status === 'fulfilled' ? ratings.value : null,
  );

  renderRecallBanner(
    recalls.status === 'fulfilled' ? recalls.value : []
  );

  renderQuickFacts(
    wiki.status    === 'fulfilled' ? wiki.value    : null,
    ratings.status === 'fulfilled' ? ratings.value : null,
  );

  renderExternalLinks(
    wiki.status === 'fulfilled' ? wiki.value : null
  );
})();

// ── Overview Tab ───────────────────────────────────────────────
function renderOverview(wiki, ratings) {
  // Description
  if (wiki?.summary) {
    const paras = wiki.summary.split('\n').filter(Boolean).slice(0, 3);
    els.overviewDesc.innerHTML = paras
      .map(p => `<p>${escHtml(p)}</p>`)
      .join('');
  } else {
    els.overviewDesc.innerHTML = `
      <p>The <strong>${escHtml(year)} ${escHtml(make)} ${escHtml(model)}</strong> is a vehicle manufactured by ${escHtml(make)}.</p>
      <p>Detailed description data is not available for this vehicle. Visit the manufacturer's website or Wikipedia for more information.</p>`;
  }

  // Car image — fade in smoothly, fallback chain: imageHQ → image → placeholder
  if (wiki?.image) {
    const imgEl = els.carImage;
    const urls  = [wiki.imageHQ, wiki.image].filter(Boolean);
    let   attempt = 0;

    function tryLoad() {
      if (attempt >= urls.length) {
        imgEl.classList.add('hidden');
        els.carImagePlaceholder.style.display = '';
        return;
      }
      imgEl.style.opacity = '0';
      imgEl.src = urls[attempt];
      imgEl.alt = `${year} ${make} ${model}`;
    }

    imgEl.addEventListener('load', () => {
      imgEl.classList.remove('hidden');
      els.carImagePlaceholder.style.display = 'none';
      // Smooth fade-in
      requestAnimationFrame(() => {
        imgEl.style.transition = 'opacity 0.5s ease';
        imgEl.style.opacity = '1';
      });
    }, { once: false });

    imgEl.addEventListener('error', () => {
      attempt++;
      tryLoad();
    }, { once: false });

    tryLoad();
  }

  // Safety ratings
  if (ratings?.detail) {
    const d = ratings.detail;
    const overall = parseInt(d.OverallRating) || 0;
    els.carRatingRow.innerHTML = `
      <div class="rating-stars" title="${overall} out of 5 stars — NHTSA Overall Safety Rating">
        ${starsHtml(overall, 5)}
      </div>
      <span class="rating-label">NHTSA OVERALL · ${overall}/5 stars</span>
    `;

    els.safetyBlock.innerHTML = `
      <div class="safety-title">NHTSA SAFETY RATINGS</div>
      <div class="safety-grid">
        ${ratingItem('Overall', d.OverallRating)}
        ${ratingItem('Frontal Crash', d.OverallFrontCrashRating)}
        ${ratingItem('Side Crash', d.OverallSideCrashRating)}
        ${ratingItem('Rollover', d.RolloverRating)}
      </div>`;
  } else {
    els.safetyBlock.innerHTML = `
      <div class="safety-title">NHTSA SAFETY RATINGS</div>
      <p style="font-size:13px;color:var(--text-3);margin-top:8px;">
        Safety rating data is not available for this vehicle. Check
        <a href="https://www.nhtsa.gov/vehicle/${encodeURIComponent(year)}/${encodeURIComponent(make)}/${encodeURIComponent(model)}/fourWD" target="_blank" rel="noopener" style="color:var(--accent)">NHTSA.gov</a>
        for the latest information.
      </p>`;
  }
}

function ratingItem(label, value) {
  const v = parseInt(value) || 0;
  return `
    <div class="safety-item">
      <span class="safety-item-label">${label}</span>
      <div class="safety-stars">${starsHtml(v, 5, 16)}</div>
    </div>`;
}

function starsHtml(filled, total, size = 20) {
  let html = '';
  for (let i = 1; i <= total; i++) {
    const f = i <= filled ? '#F5A623' : 'var(--border)';
    html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${f}" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>`;
  }
  return html;
}

// ── Recall Banner ──────────────────────────────────────────────
function renderRecallBanner(recalls) {
  const recallBanner = document.getElementById('recallBanner');
  if (!recalls || recalls.length === 0) return;

  const n = recalls.length;
  els.recallBannerText.textContent = `${n} active recall${n > 1 ? 's' : ''} found for this vehicle.`;
  recallBanner.classList.remove('hidden');

  // Render recalls section
  els.recallsSection.classList.remove('hidden');
  els.recallsList.innerHTML = recalls.map(r => `
    <div class="recall-card">
      <div class="recall-card-header">
        <span class="recall-campaign">Campaign #${escHtml(r.NHTSACampaignNumber || '—')}</span>
        <span class="recall-date">${formatDate(r.ReportReceivedDate)}</span>
      </div>
      <div class="recall-component">${escHtml(r.Component || 'Unknown Component')}</div>
      <div class="recall-summary">${escHtml(r.Summary || r.Consequence || 'No summary available.')}</div>
    </div>`
  ).join('');
}

// ── Quick Facts ────────────────────────────────────────────────
function renderQuickFacts(wiki, ratings) {
  const facts = [
    { key: 'Make',   val: make   },
    { key: 'Model',  val: model  },
    { key: 'Year',   val: year   },
    { key: 'Type',   val: 'Automobile' },
  ];

  if (ratings?.detail) {
    const d = ratings.detail;
    if (d.VehicleDescription) facts.push({ key: 'Variant', val: d.VehicleDescription });
  }

  if (wiki?.title) {
    facts.push({ key: 'Source', val: 'Wikipedia' });
  }

  els.quickFactsBody.innerHTML = facts.map(f => `
    <div class="fact-row">
      <span class="fact-key">${escHtml(f.key)}</span>
      <span class="fact-val">${escHtml(String(f.val))}</span>
    </div>`
  ).join('');
}

// ── External Links ─────────────────────────────────────────────
function renderExternalLinks(wiki) {
  const links = [];

  if (wiki?.url) {
    links.push({
      href:  wiki.url,
      icon:  'W',
      label: 'Wikipedia',
      desc:  `${make} ${model} article`,
    });
  }

  links.push({
    href:  `https://www.nhtsa.gov/vehicle/${encodeURIComponent(year)}/${encodeURIComponent(make)}/${encodeURIComponent(model)}/fourWD`,
    icon:  '★',
    label: 'NHTSA Safety',
    desc:  'Official safety ratings',
  });

  links.push({
    href:  `https://www.cars.com/research/${encodeURIComponent(make.toLowerCase())}-${encodeURIComponent(model.toLowerCase())}-${year}/`,
    icon:  '⊕',
    label: 'Cars.com',
    desc:  'Prices & reviews',
  });

  links.push({
    href:  `https://www.edmunds.com/${encodeURIComponent(make.toLowerCase())}/${encodeURIComponent(model.toLowerCase())}/${year}/review/`,
    icon:  'E',
    label: 'Edmunds',
    desc:  'Expert review',
  });

  els.externalLinks.innerHTML = links.map(l => `
    <a href="${escHtml(l.href)}" target="_blank" rel="noopener noreferrer" class="ext-link">
      <span class="ext-link-icon">${escHtml(l.icon)}</span>
      <span>
        <span class="ext-link-label">${escHtml(l.label)}</span><br>
        <span style="font-size:11px;color:var(--text-3)">${escHtml(l.desc)}</span>
      </span>
      <span class="ext-link-arrow">›</span>
    </a>`
  ).join('');
}

// ── Specs Tab ──────────────────────────────────────────────────
async function renderSpecs() {
  els.specsContent.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Loading specifications...</p></div>';

  try {
    const [canSpecs, ratings] = await Promise.allSettled([
      API.getCanadianSpecs(year, make, model),
      API.getSafetyRatings(year, make, model),
    ]);

    const cs = canSpecs.status === 'fulfilled' ? canSpecs.value : [];
    const rt = ratings.status === 'fulfilled'  ? ratings.value  : null;

    let html = '';

    // NHTSA Safety Ratings data as specs
    if (rt?.detail) {
      const d = rt.detail;
      html += specGroup('SAFETY RATINGS (NHTSA)', [
        { k: 'Overall Rating',       v: formatRating(d.OverallRating) },
        { k: 'Frontal Crash',        v: formatRating(d.OverallFrontCrashRating) },
        { k: 'Frontal — Driver',     v: formatRating(d.FrontCrashDriversideRating) },
        { k: 'Frontal — Passenger',  v: formatRating(d.FrontCrashPassengersideRating) },
        { k: 'Side Crash',           v: formatRating(d.OverallSideCrashRating) },
        { k: 'Side — Driver',        v: formatRating(d.SideCrashDriversideRating) },
        { k: 'Side — Passenger',     v: formatRating(d.SideCrashPassengersideRating) },
        { k: 'Side Pole',            v: formatRating(d.SidePoleCrashRating) },
        { k: 'Rollover',             v: formatRating(d.RolloverRating) },
        { k: 'Rollover Risk',        v: d.RolloverPossibility ? `${(parseFloat(d.RolloverPossibility) * 100).toFixed(1)}%` : '—' },
      ].filter(r => r.v !== '—'));
    }

    // Canadian specs
    if (cs.length > 0) {
      const specItems = cs.map(s => ({ k: s.Specs_Name, v: s.Specs_Value || '—' }));
      html += specGroup('VEHICLE SPECIFICATIONS', specItems);
    }

    // Identification
    html += specGroup('IDENTIFICATION', [
      { k: 'Make',       v: make  },
      { k: 'Model',      v: model },
      { k: 'Model Year', v: year  },
      { k: 'Data Source', v: 'NHTSA Vehicle Database' },
    ]);

    if (!html) {
      html = `
        <div class="error-state">
          <h3>Limited Data Available</h3>
          <p>Detailed specifications for the ${year} ${make} ${model} are not available in the database.<br>
          Visit the manufacturer's website for complete specs.</p>
          <br>
          <a href="https://www.${make.toLowerCase().replace(/[^a-z]/g,'')}.com" target="_blank" rel="noopener" class="btn btn-outline" style="margin-top:8px">
            Visit ${make} Website ›
          </a>
        </div>`;
    }

    els.specsContent.innerHTML = html;

  } catch {
    els.specsContent.innerHTML = `
      <div class="error-state">
        <h3>Could not load specifications</h3>
        <p>Please check your internet connection and try again.</p>
      </div>`;
  }
}

function specGroup(title, rows) {
  if (!rows || rows.length === 0) return '';
  return `
    <div class="spec-group">
      <div class="spec-group-title">${escHtml(title)}</div>
      <table class="spec-table">
        ${rows.map(r => `
          <tr class="spec-row">
            <td class="spec-key">${escHtml(r.k)}</td>
            <td class="spec-val">${escHtml(String(r.v))}</td>
          </tr>`).join('')}
      </table>
    </div>`;
}

function formatRating(val) {
  if (!val || val === 'Not Rated') return '—';
  const n = parseInt(val);
  if (isNaN(n)) return val;
  return `${'★'.repeat(n)}${'☆'.repeat(Math.max(0, 5 - n))} (${n}/5)`;
}

// ── Maintenance Tab ────────────────────────────────────────────
function renderMaintenance() {
  const { schedule, makeData } = MAINTENANCE_DB.getSchedule(make);

  const high   = schedule.filter(i => i.priority === 'high');
  const medium = schedule.filter(i => i.priority === 'medium');
  const low    = schedule.filter(i => i.priority === 'low');

  let html = '';

  // Brand-specific intro
  if (makeData) {
    html += `
      <div class="maintenance-intro">
        <strong>${escHtml(makeData.brand)} Note:</strong> ${escHtml(makeData.notes)}
        ${makeData.oilNote ? `<br><br><strong>Oil Recommendation:</strong> ${escHtml(makeData.oilNote)}` : ''}
      </div>`;
  } else {
    html += `
      <div class="maintenance-intro">
        The following maintenance schedule is based on industry-standard recommendations.
        Always consult your <strong>${escHtml(make)} ${escHtml(model)}</strong> owner's manual for manufacturer-specific intervals.
      </div>`;
  }

  html += maintenanceGroup('CRITICAL SERVICES', high);
  html += maintenanceGroup('ROUTINE SERVICES', medium);
  html += maintenanceGroup('PERIODIC CHECKS', low);

  els.maintenanceContent.innerHTML = html;
}

function maintenanceGroup(title, items) {
  if (!items || items.length === 0) return '';
  return `
    <div class="maintenance-group">
      <div class="maintenance-group-title">${escHtml(title)}</div>
      <table class="maintenance-table">
        ${items.map(item => `
          <tr class="maintenance-row">
            <td class="maint-priority">
              <div class="priority-bar priority-${item.priority}"></div>
            </td>
            <td>
              <div class="maint-service">
                ${escHtml(item.service)}
                <span class="maint-badge badge-${item.priority}">${item.priority.toUpperCase()}</span>
                ${item.overridden ? `<span class="maint-badge" style="background:var(--accent-dim);color:var(--accent)">BRAND-SPECIFIC</span>` : ''}
              </div>
              ${item.notes ? `<div style="font-size:12px;color:var(--text-3);margin-top:4px;">${escHtml(item.notes)}</div>` : ''}
            </td>
            <td class="maint-interval">${escHtml(item.interval)}</td>
          </tr>`).join('')}
      </table>
    </div>`;
}

// ── Videos Tab ────────────────────────────────────────────────
function renderVideos() {
  const searches = [
    {
      category: 'REVIEW',
      title:    `${year} ${make} ${model} — Full Review`,
      desc:     `In-depth review of the ${year} ${make} ${model} covering performance, comfort, and value.`,
      query:    `${year} ${make} ${model} review`,
    },
    {
      category: 'OIL CHANGE',
      title:    `${make} ${model} Oil Change Guide`,
      desc:     `Step-by-step tutorial for changing the oil and filter on a ${make} ${model}.`,
      query:    `${make} ${model} oil change how to`,
    },
    {
      category: 'MAINTENANCE',
      title:    `${make} ${model} Maintenance Tips`,
      desc:     `Essential maintenance guide covering common services for the ${make} ${model}.`,
      query:    `${make} ${model} maintenance guide tips`,
    },
    {
      category: 'COMMON PROBLEMS',
      title:    `${make} ${model} Common Problems`,
      desc:     `Known issues and reliability concerns to watch for on the ${make} ${model}.`,
      query:    `${make} ${model} common problems issues`,
    },
    {
      category: 'BRAKES',
      title:    `${make} ${model} Brake Service`,
      desc:     `How to inspect and replace brake pads and rotors on the ${make} ${model}.`,
      query:    `${make} ${model} brake pad rotor replacement`,
    },
    {
      category: 'BUYER\'S GUIDE',
      title:    `${year} ${make} ${model} — Buyer's Guide`,
      desc:     `What to look for when buying a ${year} ${make} ${model}. Inspection checklist and tips.`,
      query:    `${year} ${make} ${model} buyers guide used`,
    },
  ];

  els.videosGrid.innerHTML = searches.map(s => {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(s.query)}`;
    return `
      <a href="${escHtml(ytUrl)}" target="_blank" rel="noopener noreferrer" class="video-card">
        <div class="video-thumb">
          <span class="video-category">${escHtml(s.category)}</span>
          <div class="video-play-icon">
            <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
        </div>
        <div class="video-info">
          <div class="video-title">${escHtml(s.title)}</div>
          <div class="video-desc">${escHtml(s.desc)}</div>
          <div class="video-link-label">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.22 6.22 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z"/>
            </svg>
            Search on YouTube
          </div>
        </div>
      </a>`;
  }).join('');
}

// ── Utilities ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(str) {
  if (!str) return '—';
  try {
    const d = new Date(str);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return str; }
}
