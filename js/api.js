/* ============================================================
   MotorIndex — API Layer
   Sources: NHTSA VPIC · NHTSA Safety/Recalls · Wikipedia · Wikimedia Commons
   ============================================================ */

const NHTSA_VPIC    = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const NHTSA_RATINGS = 'https://api.nhtsa.gov/SafetyRatings';
const NHTSA_RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVehicle';
const WIKI_REST     = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const WIKI_API      = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API   = 'https://commons.wikimedia.org/w/api.php';

// In-memory cache (cleared on page reload)
const _cache = new Map();

async function _fetch(url, cacheKey, ttlMs = 86400000) {
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  try {
    const raw = localStorage.getItem('mi_c_' + cacheKey);
    if (raw) {
      const { d, t } = JSON.parse(raw);
      if (Date.now() - t < ttlMs) {
        _cache.set(cacheKey, d);
        return d;
      }
    }
  } catch (_) {}

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  const data = await res.json();

  _cache.set(cacheKey, data);
  try {
    localStorage.setItem('mi_c_' + cacheKey, JSON.stringify({ d: data, t: Date.now() }));
  } catch (_) {}

  return data;
}

// ── Image source helpers ──────────────────────────────────────
//
// Two independent sources are queried in parallel:
//   1. Wikimedia Commons  — year-tagged photo files (primary)
//   2. Wikipedia REST API — article thumbnail + text (fallback / text source)
//
// Commons is preferred for images because editors explicitly name files
// like "2024_Land_Rover_Defender_90.jpg", giving year-accurate results.
// Wikipedia is still needed for article summary text.

// Words/phrases whose presence in a Commons filename reliably means
// the file is NOT an exterior car photo. Keep this list conservative —
// false exclusions (missing real photos) are worse than false inclusions.
// In particular, DO NOT add "motor" (blocks "Motor Show" photos) or
// "engine" (blocks "engine" variant names like "EcoBoost").
const _IMG_BLOCKLIST = [
  'logo', 'badge', 'emblem', 'insignia', 'coat of arms',
  'interior', 'dashboard', 'cockpit', 'cabin view',
  'diagram', 'cutaway', 'schematic', 'blueprint', 'cross-section',
  'brochure', 'advertisement', 'flyer',
  '.svg', '.gif',
];

/**
 * Search Wikimedia Commons for a year-accurate exterior photo.
 * Returns the best image URL found, or null.
 */
async function _getCommonsImage(make, model, yr) {
  // Build queries from most specific to broadest.
  // The no-year fallback ensures vintage/obscure models still get a photo
  // even when Commons has nothing tagged with the exact year.
  const queries = [
    `${yr} ${make} ${model}`,
    `${make} ${model} ${yr}`,
    `${make} ${model}`,
  ];

  for (const q of queries) {
    try {
      const searchKey = `commons_s_${q.toLowerCase().replace(/\s+/g, '_')}`;
      const searchUrl = `${COMMONS_API}?action=query&list=search&srnamespace=6` +
        `&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=15`;

      const data = await _fetch(searchUrl, searchKey, 86400000);
      const files = (data.query?.search || []).filter(f => {
        const t = f.title.toLowerCase();
        // Must be a photo format
        if (!t.match(/\.(jpg|jpeg|png|webp)$/i)) return false;
        // Reject non-exterior content
        if (_IMG_BLOCKLIST.some(w => t.includes(w))) return false;
        return true;
      });

      if (!files.length) continue;

      // Prefer files with the year in the filename (most accurate)
      files.sort((a, b) => {
        const aHasYr = a.title.includes(String(yr)) ? 1 : 0;
        const bHasYr = b.title.includes(String(yr)) ? 1 : 0;
        // Also prefer files that include both make and model words
        const makeWord = make.toLowerCase().split(/\s+/)[0];
        const modelWord = model.toLowerCase().split(/\s+/)[0];
        const aRelevance = aHasYr +
          (a.title.toLowerCase().includes(makeWord) ? 0.5 : 0) +
          (a.title.toLowerCase().includes(modelWord) ? 0.5 : 0);
        const bRelevance = bHasYr +
          (b.title.toLowerCase().includes(makeWord) ? 0.5 : 0) +
          (b.title.toLowerCase().includes(modelWord) ? 0.5 : 0);
        return bRelevance - aRelevance;
      });

      // Resolve image URL for the best candidate
      for (const file of files.slice(0, 3)) {
        const imgKey = `commons_img_${file.title.toLowerCase().replace(/[\s:]+/g, '_')}`;
        const imgUrl = `${COMMONS_API}?action=query&titles=${encodeURIComponent(file.title)}` +
          `&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json&origin=*`;
        try {
          const imgData = await _fetch(imgUrl, imgKey, 86400000);
          const page = Object.values(imgData.query?.pages || {})[0];
          const info = page?.imageinfo?.[0];
          const url = info?.thumburl || info?.url;
          if (url) return url;
        } catch { continue; }
      }
    } catch { continue; }
  }

  return null;
}

/**
 * Fetch Wikipedia article summary + image for the vehicle.
 * Tries year-specific articles first, then search, then generic.
 * Returns structured object or null.
 */
async function _getWikiArticle(make, model, yr) {
  async function trySlug(slug, requireImage = true) {
    const key = `wiki_${slug.toLowerCase()}`;
    try {
      const data = await _fetch(`${WIKI_REST}/${encodeURIComponent(slug)}`, key, 86400000);
      if (data.type !== 'standard') return null;
      if (requireImage && !data.thumbnail && !data.originalimage) return null;
      return {
        title:   data.title,
        summary: data.extract,
        image:   data.thumbnail?.source    || null,
        imageHQ: data.originalimage?.source || null,
        url:     data.content_urls?.desktop?.page || null,
      };
    } catch { return null; }
  }

  // 1. Try year-specific slugs in parallel
  const yearSlugs = [
    `${yr}_${make}_${model}`.replace(/\s+/g, '_'),
    `${make}_${model}_(${yr})`.replace(/\s+/g, '_'),
  ];
  const yearResults = await Promise.all(yearSlugs.map(s => trySlug(s)));
  const yearHit = yearResults.find(Boolean);
  if (yearHit) return yearHit;

  // 2. Wikipedia search with year in query
  try {
    const searchKey = `wikis_${yr}_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
    const searchUrl = `${WIKI_API}?action=query&list=search` +
      `&srsearch=${encodeURIComponent(`${yr} ${make} ${model}`)}` +
      `&format=json&origin=*&srlimit=5`;
    const sd = await _fetch(searchUrl, searchKey, 86400000);
    const hits = sd.query?.search || [];

    // Try search results in parallel (up to 3 at once)
    const searchResults = await Promise.all(
      hits.slice(0, 3).map(h => trySlug(h.title.replace(/\s+/g, '_')))
    );
    const searchHit = searchResults.find(Boolean);
    if (searchHit) return searchHit;
  } catch {}

  // 3. Generic make+model slugs (with image)
  const genericSlugs = [
    `${make}_${model}`.replace(/\s+/g, '_'),
    `${make}_${model}_(automobile)`.replace(/\s+/g, '_'),
    `${model}_(automobile)`.replace(/\s+/g, '_'),
    `${make}_${model}_(motorcycle)`.replace(/\s+/g, '_'),
    `${model}_(motorcycle)`.replace(/\s+/g, '_'),
  ];
  const genericResults = await Promise.all(genericSlugs.map(s => trySlug(s)));
  const genericHit = genericResults.find(Boolean);
  if (genericHit) return genericHit;

  // 4. Accept pages with no image (text-only fallback)
  const textResults = await Promise.all(genericSlugs.slice(0, 2).map(s => trySlug(s, false)));
  return textResults.find(Boolean) || null;
}

// ── Public API ─────────────────────────────────────────────────

const API = {

  /** All vehicle makes (VPIC). Cached 24h. */
  async getAllMakes() {
    const data = await _fetch(
      `${NHTSA_VPIC}/getallmakes?format=json`,
      'all_makes'
    );
    return data.Results
      .map(m => ({ id: m.Make_ID, name: m.Make_Name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Models for a given make + year (VPIC). Cached 24h. */
  async getModelsForMakeYear(make, year) {
    const key = `mmy_${make}_${year}`.toLowerCase().replace(/\s+/g, '_');
    const data = await _fetch(
      `${NHTSA_VPIC}/getmodelsformakeyear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`,
      key
    );
    return (data.Results || [])
      .map(m => ({ id: m.Model_ID, name: m.Model_Name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** NHTSA safety rating variants for a model (e.g. 4DR AWD, 2DR, etc.). */
  async getVariantsForModel(year, make, model) {
    const key = `variants_${year}_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const data = await _fetch(
        `${NHTSA_RATINGS}/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`,
        key,
        86400000
      );
      return (data.Results || []).map(r => ({
        id: r.VehicleId,
        description: r.VehicleDescription || '',
      }));
    } catch {
      return [];
    }
  },

  /** Models for a given make name. Cached 24h. */
  async getModelsForMake(make) {
    const key = `models_${make.toLowerCase().replace(/\s+/g, '_')}`;
    const data = await _fetch(
      `${NHTSA_VPIC}/getmodelsformake/${encodeURIComponent(make)}?format=json`,
      key
    );
    return data.Results
      .map(m => ({ id: m.Model_ID, name: m.Model_Name, make: m.Make_Name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  /** Model years available for make+model (checks current year down to 1995). */
  async getYearsForModel(make, model) {
    const currentYear = new Date().getFullYear() + 1;
    const key = `years_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');

    try {
      const raw = localStorage.getItem('mi_c_' + key);
      if (raw) {
        const { d, t } = JSON.parse(raw);
        if (Date.now() - t < 86400000) return d;
      }
    } catch (_) {}

    const yearsToCheck = [];
    for (let y = currentYear; y >= 1995; y--) yearsToCheck.push(y);

    const results = [];
    const batchSize = 8;

    for (let i = 0; i < yearsToCheck.length; i += batchSize) {
      const batch = yearsToCheck.slice(i, i + batchSize);
      const checks = await Promise.all(
        batch.map(async (year) => {
          try {
            const url = `${NHTSA_VPIC}/getmodelsformakeyear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`;
            const data = await _fetch(url, `modelyear_${make}_${year}`.toLowerCase(), 86400000);
            const found = data.Results.some(
              r => r.Model_Name.toLowerCase() === model.toLowerCase()
            );
            return found ? year : null;
          } catch { return null; }
        })
      );
      checks.forEach(y => { if (y) results.push(y); });
      if (results.length > 0 && i > 20) break;
    }

    const sorted = results.sort((a, b) => b - a);
    try {
      localStorage.setItem('mi_c_' + key, JSON.stringify({ d: sorted, t: Date.now() }));
    } catch (_) {}

    return sorted;
  },

  /** NHTSA Safety Ratings for a specific vehicle. */
  async getSafetyRatings(year, make, model) {
    const key = `ratings_${year}_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const url = `${NHTSA_RATINGS}/modelyear/${year}/make/${encodeURIComponent(make)}/model/${encodeURIComponent(model)}`;
      const data = await _fetch(url, key, 86400000);
      if (!data.Results || data.Results.length === 0) return null;

      const vehicleId = data.Results[0].VehicleId;
      const detail = await _fetch(
        `${NHTSA_RATINGS}/VehicleId/${vehicleId}`,
        `rating_v_${vehicleId}`,
        86400000
      );
      return { variants: data.Results, detail: detail.Results?.[0] || null };
    } catch {
      return null;
    }
  },

  /** NHTSA active recalls. */
  async getRecalls(make, model, year) {
    const key = `recalls_${year}_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const url = `${NHTSA_RECALLS}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
      const data = await _fetch(url, key, 3600000);
      return data.results || [];
    } catch {
      return [];
    }
  },

  /**
   * Vehicle image + Wikipedia article summary.
   *
   * Image strategy (most → least accurate):
   *   1. Wikimedia Commons year-specific file search  (primary)
   *   2. Wikipedia article image (generation-specific or generic)
   *
   * Commons and Wikipedia are queried in parallel.
   * Commons image is preferred when found because files are explicitly
   * named with the model year (e.g. "2024_Land_Rover_Defender_90.jpg").
   */
  async getWikiInfo(make, model, year) {
    const yr = parseInt(year) || new Date().getFullYear();

    // Fire both sources simultaneously
    const [commonsRes, wikiRes] = await Promise.allSettled([
      _getCommonsImage(make, model, yr),
      _getWikiArticle(make, model, yr),
    ]);

    const commonsImage = commonsRes.status === 'fulfilled' ? commonsRes.value : null;
    const wiki         = wikiRes.status   === 'fulfilled' ? wikiRes.value   : null;

    if (!commonsImage && !wiki) return null;

    return {
      title:   wiki?.title   || `${make} ${model}`,
      summary: wiki?.summary || null,
      // Commons wins for image accuracy; Wikipedia is fallback
      image:   commonsImage || wiki?.image   || null,
      imageHQ: commonsImage || wiki?.imageHQ || null,
      url:     wiki?.url     || null,
    };
  },

  /** Canadian vehicle specs from NHTSA (supplemental). */
  async getCanadianSpecs(year, make, model) {
    const key = `canspecs_${year}_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const url = `${NHTSA_VPIC}/GetCanadianVehicleSpecifications/?Year=${year}&Make=${encodeURIComponent(make)}&Model=${encodeURIComponent(model)}&units=&format=json`;
      const data = await _fetch(url, key, 86400000);
      return data.Results || [];
    } catch {
      return [];
    }
  },
};

// Expose globally
window.API = API;
