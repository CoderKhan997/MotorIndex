/* ============================================================
   MotorIndex — API Layer
   Data from NHTSA VPIC, NHTSA Safety/Recalls, Wikipedia
   ============================================================ */

const NHTSA_VPIC    = 'https://vpic.nhtsa.dot.gov/api/vehicles';
const NHTSA_RATINGS = 'https://api.nhtsa.gov/SafetyRatings';
const NHTSA_RECALLS = 'https://api.nhtsa.gov/recalls/recallsByVehicle';
const WIKI_REST     = 'https://en.wikipedia.org/api/rest_v1/page/summary';

// In-memory cache (cleared on page reload)
const _cache = new Map();

async function _fetch(url, cacheKey, ttlMs = 86400000) {
  // 1. Memory cache
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  // 2. localStorage cache
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

  // 3. Network
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  const data = await res.json();

  _cache.set(cacheKey, data);
  try {
    localStorage.setItem('mi_c_' + cacheKey, JSON.stringify({ d: data, t: Date.now() }));
  } catch (_) { /* storage full — skip */ }

  return data;
}

// ── Public API ────────────────────────────────────────────────

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

    // Try cache first
    try {
      const raw = localStorage.getItem('mi_c_' + key);
      if (raw) {
        const { d, t } = JSON.parse(raw);
        if (Date.now() - t < 86400000) return d;
      }
    } catch (_) {}

    // Batch-check years in parallel (groups of 6)
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
      if (results.length > 0 && i > 20) break; // stop early if we found many
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

      // Fetch detail for first variant
      const vehicleId = data.Results[0].VehicleId;
      const detail = await _fetch(
        `${NHTSA_RATINGS}/VehicleId/${vehicleId}`,
        `rating_v_${vehicleId}`,
        86400000
      );

      return {
        variants: data.Results,
        detail: detail.Results?.[0] || null,
      };
    } catch {
      return null;
    }
  },

  /** NHTSA active recalls. */
  async getRecalls(make, model, year) {
    const key = `recalls_${year}_${make}_${model}`.toLowerCase().replace(/\s+/g, '_');
    try {
      const url = `${NHTSA_RECALLS}?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${year}`;
      const data = await _fetch(url, key, 3600000 /* 1h */);
      return data.results || [];
    } catch {
      return [];
    }
  },

  /** Wikipedia page summary + image. */
  async getWikiInfo(make, model) {
    const queries = [
      `${make}_${model}`,
      `${make}_${model}_(automobile)`,
      `${model}_(automobile)`,
    ].map(q => q.replace(/\s+/g, '_'));

    for (const q of queries) {
      const key = `wiki_${q.toLowerCase()}`;
      try {
        const data = await _fetch(`${WIKI_REST}/${encodeURIComponent(q)}`, key, 86400000);
        if (data.type === 'standard') {
          return {
            title:    data.title,
            summary:  data.extract,
            image:    data.thumbnail?.source || null,
            imageHQ:  data.originalimage?.source || null,
            url:      data.content_urls?.desktop?.page || null,
          };
        }
      } catch { continue; }
    }
    return null;
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
