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
  // Phase 1 — critical content, all in parallel
  const [wiki, ratings, recalls] = await Promise.allSettled([
    API.getWikiInfo(make, model, year),
    API.getSafetyRatings(year, make, model),
    API.getRecalls(make, model, year),
  ]);

  const wikiVal = wiki.status    === 'fulfilled' ? wiki.value    : null;
  const rateVal = ratings.status === 'fulfilled' ? ratings.value : null;

  renderOverview(wikiVal, rateVal);
  renderRecallBanner(recalls.status === 'fulfilled' ? recalls.value : []);
  renderExternalLinks(wikiVal);

  // Render Quick Facts with basic info immediately so the box isn't empty
  renderQuickFacts(wikiVal, rateVal, {}, []);

  // Phase 2 — enrich Quick Facts with infobox specs + NHTSA Canadian specs
  // Both run in parallel; they don't block Phase 1 rendering above.
  const [wikiSpecs, canSpecs] = await Promise.allSettled([
    wikiVal?.title ? API.getVehicleSpecs(wikiVal.title) : Promise.resolve({}),
    API.getCanadianSpecs(year, make, model),
  ]);

  renderQuickFacts(
    wikiVal,
    rateVal,
    wikiSpecs.status === 'fulfilled' ? wikiSpecs.value : {},
    canSpecs.status  === 'fulfilled' ? canSpecs.value  : [],
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

  // Car image — fade in smoothly; fallback chain: imageHQ → image → placeholder
  if (wiki?.image) {
    const imgEl = els.carImage;
    // Deduplicate: if imageHQ and image are the same URL (both set to commonsImage)
    // only keep one entry to avoid a redundant network hit on error.
    const seen = new Set();
    const urls = [wiki.imageHQ, wiki.image]
      .filter(u => u && !seen.has(u) && seen.add(u));

    let attempt = 0;

    function showPlaceholder() {
      imgEl.classList.add('hidden');
      imgEl.style.opacity = '0';
      els.carImagePlaceholder.style.display = '';
    }

    function tryLoad() {
      if (attempt >= urls.length) { showPlaceholder(); return; }

      // Must remove hidden BEFORE setting src so the browser initiates the load
      imgEl.classList.remove('hidden');
      imgEl.style.opacity = '0';
      imgEl.style.transition = '';
      els.carImagePlaceholder.style.display = 'none';

      imgEl.src = urls[attempt];
      imgEl.alt = `${year} ${make} ${model}`;
    }

    // Use property assignment so handlers auto-replace on each tryLoad call
    imgEl.onload = () => {
      requestAnimationFrame(() => {
        imgEl.style.transition = 'opacity 0.5s ease';
        imgEl.style.opacity = '1';
      });
    };

    imgEl.onerror = () => {
      attempt++;
      tryLoad();
    };

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

  // Wire up the "View recalls" link to smooth-scroll to the section
  const link = recallBanner.querySelector('.recall-banner-link');
  if (link) {
    link.addEventListener('click', e => {
      e.preventDefault();
      els.recallsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

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

// ── Quick Facts helpers ─────────────────────────────────────────

/**
 * Split a string by top-level commas (ignores commas inside parentheses).
 * e.g. "A (1, 2), B" → ["A (1, 2)", "B"]
 */
function _splitTopLevel(str) {
  const items = [];
  let depth = 0, cur = '';
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { items.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) items.push(cur.trim());
  return items.filter(Boolean);
}

/**
 * Given a Wikipedia infobox value that may list options across multiple years,
 * return only the entries that apply to `yr`.
 *
 * Patterns recognised: (2013–2022), (2016-present), (2024)
 * If nothing matches `yr` exactly, returns the last item (most recent gen).
 * Year-range annotations are stripped from the returned text.
 */
function _filterByYear(value, yr) {
  if (!value) return null;
  const yrNum = parseInt(yr);
  const items = _splitTopLevel(value);
  if (items.length <= 1) {
    // Single value — just strip any year annotation and return
    return value.replace(/\s*\(\d{4}[–\-](?:\d{4}|present)\)/gi, '').trim();
  }

  const YR_RANGE = /\((\d{4})[–\-](\d{4}|present)\)/i;
  const YR_SOLO  = /\((\d{4})\)/;

  const applicable = items.filter(item => {
    const rangeM = item.match(YR_RANGE);
    if (rangeM) {
      const start = parseInt(rangeM[1]);
      const end   = rangeM[2].toLowerCase() === 'present' ? 9999 : parseInt(rangeM[2]);
      return yrNum >= start && yrNum <= end;
    }
    const soloM = item.match(YR_SOLO);
    if (soloM) return parseInt(soloM[1]) === yrNum;
    return true; // no year tag → always applicable
  });

  // Use exact matches; fall back to last item if none match
  const pool = applicable.length > 0 ? applicable : [items[items.length - 1]];

  return pool
    .map(s => s
      .replace(YR_RANGE, '')
      .replace(YR_SOLO, '')
      // Also remove engine-size parentheticals added by Wikipedia like "(2.4 L)"
      .replace(/\s*\([^)]{0,20}\)\s*/g, ' ')
      .trim())
    .filter(Boolean)
    // Deduplicate (same engine listed under two year bands)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ')
    || items[items.length - 1];
}

/**
 * Remove verbose Wikipedia internal identifiers from spec text.
 * e.g. "Honda K engine K24Z7 I4" → "2.4L I4"
 *      "ZF 8HP70 8-speed automatic" → "8-speed automatic"
 */
function _tidySpec(value) {
  if (!value) return null;
  return value
    // Remove "Make Model engine" jargon  e.g. "Honda K engine"
    .replace(/\b\w+ \w+ engine\b/gi, '')
    // Remove bare engine codes like K24Z7, LEA-MF6, R20A
    .replace(/\b[A-Z]{1,3}\d{2}[A-Z0-9\-]*\b/g, '')
    // Remove ZF part numbers e.g. "ZF 8HP70"
    .replace(/\bZF\s+\w+\b/gi, '')
    // Normalise L (litre) — "2.4 L" → "2.4L"
    .replace(/(\d)\s+L\b/g, '$1L')
    // Remove repeated commas / spaces left by the above
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
}

/**
 * Parse a Wikipedia production field like "2015–present", "2015–2022",
 * "January 2015 – December 2022", "2015" into a clean display string.
 * Returns null if nothing useful can be extracted.
 */
function _parseProduction(raw) {
  if (!raw) return null;
  // Normalise dash variants
  const s = raw.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();

  // Try "YYYY-present" or "YYYY-YYYY" patterns
  const rangeM = s.match(/(\d{4})\s*[-–]\s*(present|\d{4})/i);
  if (rangeM) {
    const start = rangeM[1];
    const end   = rangeM[2].toLowerCase() === 'present' ? 'Present' : rangeM[2];
    return `${start} – ${end}`;
  }

  // Try lone year
  const singleM = s.match(/\b(\d{4})\b/);
  if (singleM) return singleM[1];

  return null;
}

// ── Quick Facts ────────────────────────────────────────────────
// wikiSpecs  — parsed {{Infobox automobile}} fields (primary, covers all brands)
// canSpecs   — NHTSA Canadian specs array (fallback, US/Canada vehicles only)
function renderQuickFacts(wiki, ratings, wikiSpecs, canSpecs) {
  const ws = (typeof wikiSpecs === 'object' && wikiSpecs !== null) ? wikiSpecs : {};
  const hasWiki = Object.keys(ws).length > 0;

  // Helper: try multiple infobox field names, return first hit
  function wi(...keys) {
    for (const k of keys) {
      const v = ws[k];
      if (v && v.trim() && v !== '—') return v.trim();
    }
    return null;
  }

  // Helper: look up an NHTSA Canadian spec by partial name match
  const cs = Array.isArray(canSpecs) ? canSpecs : [];
  function ca(needle) {
    const hit = cs.find(s => s.Specs_Name?.toLowerCase().includes(needle.toLowerCase()));
    return hit?.Specs_Value?.trim() || null;
  }

  const DASH = '—';

  // ── Subtitle ─────────────────────────────────────────────────
  // "2020 Toyota RAV4  ·  XLE AWD" (trim from NHTSA VehicleDescription if available)
  let trimPart = '';
  if (ratings?.detail?.VehicleDescription) {
    // NHTSA format: "2020 TOYOTA RAV4 XLE AWD" → strip "YEAR MAKE MODEL "
    const prefix = `${year} ${make.toUpperCase()} ${model.toUpperCase()} `;
    const desc   = ratings.detail.VehicleDescription.toUpperCase();
    const trimRaw = desc.startsWith(prefix) ? ratings.detail.VehicleDescription.substring(prefix.length).trim() : '';
    // Title-case it
    trimPart = trimRaw.replace(/\b\w/g, c => c.toUpperCase());
  }
  const subtitleText = trimPart
    ? `${year} ${make} ${model} · ${trimPart}`
    : `${year} ${make} ${model}`;

  // Update the header subtitle
  const header = document.querySelector('.quick-facts-header');
  if (header) {
    header.innerHTML = `
      <div class="quick-facts-label">QUICK FACTS</div>
      <div class="quick-facts-subtitle" title="${escHtml(subtitleText)}">${escHtml(subtitleText)}</div>`;
  }

  // ── Engine ───────────────────────────────────────────────────
  let engineStr = _tidySpec(_filterByYear(wi('engine', 'engine_type', 'engines', 'powertrain'), year));
  if (!engineStr) {
    const dispL     = ca('displacement (l') || ca('engine displacement (l');
    const cylinders = ca('number of cylinder') || ca('cylinders');
    const config    = ca('engine configuration') || ca('configuration');
    if (config || cylinders || dispL) {
      engineStr = [config, cylinders ? `${cylinders}-cyl` : null, dispL ? `${dispL}L` : null]
        .filter(Boolean).join(' ');
    }
  }

  // ── Horsepower ───────────────────────────────────────────────
  let hpStr = _filterByYear(wi('horsepower', 'power', 'max_power'), year);
  if (hpStr && !/hp|kw|ps\b/i.test(hpStr)) hpStr += ' hp';
  if (!hpStr && wiki?.summary) {
    const m = wiki.summary.match(/(\d[\d,–\-]*)\s*(?:hp|horsepower|bhp)\b/i);
    if (m) hpStr = `${m[1]} hp`;
  }

  // ── Torque ───────────────────────────────────────────────────
  let torqueStr = null;
  const torqueLbFt = _filterByYear(wi('torqueft-lbf', 'torqueft_lbf', 'torque_ft_lbf', 'torque_lbft'), year);
  const torqueNm   = _filterByYear(wi('torquenm', 'torque_nm', 'torque'), year);
  if (torqueLbFt) torqueStr = /lb|ft/i.test(torqueLbFt) ? torqueLbFt : `${torqueLbFt} lb-ft`;
  else if (torqueNm) torqueStr = /n.?m/i.test(torqueNm) ? torqueNm : `${torqueNm} N·m`;
  if (!torqueStr && wiki?.summary) {
    const m = wiki.summary.match(/(\d[\d,–\-]*)\s*(?:lb-ft|lb·ft|pound-feet|ft·lb)\b/i);
    if (m) torqueStr = `${m[1]} lb-ft`;
  }

  // ── Drivetrain ───────────────────────────────────────────────
  let driveStr = _filterByYear(wi('drive_wheel', 'drive_type', 'drivetrain', 'drive'), year);
  if (!driveStr) driveStr = ca('drive type') || ca('drive');

  // ── Seats ────────────────────────────────────────────────────
  const seatsRaw = wi('seats', 'capacity', 'seating_capacity', 'passengers', 'seating');
  let seatsStr = null;
  if (seatsRaw) {
    const m = seatsRaw.match(/(\d[\d–\-]*)/);
    seatsStr = m ? m[1].replace(/\s/g, '') : seatsRaw;
  }
  if (!seatsStr) {
    seatsStr = ca('seating capacity') || ca('seating') || ca('passengers');
  }

  // ── Fuel economy (MPG ↔ L/100km toggle) ──────────────────────
  // Wikipedia fields: fuel_economy (generic), fuel_economy_imp (UK mpg),
  // fuel_economy_us (US mpg), fuel_economy_met (L/100km)
  // Parse city / highway from strings like "25 mpg city, 35 mpg hwy" or "25/35 mpg"
  function parseMpg(raw) {
    if (!raw) return null;
    // "city / hwy" slash format: e.g. "25/35" or "25/35 mpg"
    const slashM = raw.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (slashM) return { city: parseFloat(slashM[1]), hwy: parseFloat(slashM[2]) };
    // "X city Y hwy" or "X mpg city, Y mpg hwy" etc.
    const cityM = raw.match(/(\d+(?:\.\d+)?)\s*(?:mpg\s*)?city/i);
    const hwyM  = raw.match(/(\d+(?:\.\d+)?)\s*(?:mpg\s*)?(?:hwy|highway|motorway)/i);
    if (cityM || hwyM) return { city: cityM ? parseFloat(cityM[1]) : null, hwy: hwyM ? parseFloat(hwyM[1]) : null };
    // Single number
    const singleM = raw.match(/(\d+(?:\.\d+)?)/);
    if (singleM) return { city: null, hwy: parseFloat(singleM[1]) };
    return null;
  }

  const fuelRawUs  = wi('fuel_economy_us', 'fuel_economy', 'fuel economy');
  const fuelRawImp = wi('fuel_economy_imp');
  const fuelRawMet = wi('fuel_economy_met');

  // Try US MPG first, then imperial, then NHTSA
  let mpgData = parseMpg(fuelRawUs) || parseMpg(fuelRawImp);
  if (!mpgData) {
    const nhtsaCity = ca('city mpg') || ca('city fuel') || ca('mpg city');
    const nhtsaHwy  = ca('highway mpg') || ca('hwy mpg') || ca('highway fuel');
    if (nhtsaCity || nhtsaHwy) {
      mpgData = { city: nhtsaCity ? parseFloat(nhtsaCity) : null, hwy: nhtsaHwy ? parseFloat(nhtsaHwy) : null };
    }
  }

  let lData = parseMpg(fuelRawMet);
  // Convert MPG → L/100km if we have mpgData but no metric
  if (mpgData && !lData) {
    lData = {
      city: mpgData.city ? +(235.214 / mpgData.city).toFixed(1) : null,
      hwy:  mpgData.hwy  ? +(235.214 / mpgData.hwy).toFixed(1)  : null,
    };
  }
  // Convert L/100km → MPG if we only have metric
  if (lData && !mpgData) {
    mpgData = {
      city: lData.city ? +( 235.214 / lData.city).toFixed(0) : null,
      hwy:  lData.hwy  ? +(235.214 / lData.hwy).toFixed(0)   : null,
    };
  }

  function fmtFuel(d, unit) {
    if (!d) return DASH;
    if (unit === 'mpg') {
      const parts = [d.city ? `${Math.round(d.city)} city` : null, d.hwy ? `${Math.round(d.hwy)} hwy` : null].filter(Boolean);
      return parts.length ? parts.join(' / ') + ' mpg' : DASH;
    } else {
      const parts = [d.city ? `${d.city.toFixed(1)} city` : null, d.hwy ? `${d.hwy.toFixed(1)} hwy` : null].filter(Boolean);
      return parts.length ? parts.join(' / ') + ' L/100km' : DASH;
    }
  }

  // ── Build rows ────────────────────────────────────────────────
  // Each row: { key, val } — val is a plain string OR raw HTML string (flagged with html:true)
  const rows = [
    { key: 'Engine',     val: engineStr  || DASH },
    { key: 'Horsepower', val: hpStr      || DASH },
    { key: 'Torque',     val: torqueStr  || DASH },
    { key: 'Drivetrain', val: driveStr   || DASH },
    { key: 'Seats',      val: seatsStr   || DASH },
    { key: 'Fuel',       val: null, mpg: true },   // rendered specially
  ];

  const mpgHtml = (mpgData || lData) ? `
    <div class="mpg-wrap">
      <span class="mpg-figures" id="mpgFigures">${escHtml(fmtFuel(mpgData, 'mpg'))}</span>
      <div class="mpg-toggle" role="group" aria-label="Fuel economy unit">
        <button class="mpg-unit-btn mpg-active" data-unit="mpg">MPG</button>
        <button class="mpg-unit-btn" data-unit="l100">L/100</button>
      </div>
    </div>` : `<span class="fact-val">${DASH}</span>`;

  els.quickFactsBody.innerHTML = rows.map(r => {
    const valHtml = r.mpg
      ? mpgHtml
      : `<span class="fact-val">${escHtml(String(r.val))}</span>`;
    return `<div class="fact-row"><span class="fact-key">${escHtml(r.key)}</span>${valHtml}</div>`;
  }).join('');

  // ── Wire MPG toggle ───────────────────────────────────────────
  if (mpgData || lData) {
    els.quickFactsBody.querySelectorAll('.mpg-unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        els.quickFactsBody.querySelectorAll('.mpg-unit-btn').forEach(b => b.classList.remove('mpg-active'));
        btn.classList.add('mpg-active');
        const unit = btn.dataset.unit;
        const fig  = document.getElementById('mpgFigures');
        if (fig) fig.textContent = fmtFuel(unit === 'mpg' ? mpgData : lData, unit === 'mpg' ? 'mpg' : 'l100');
      });
    });
  }
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
