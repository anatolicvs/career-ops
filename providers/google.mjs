// @ts-check
/** @typedef {import('./_types.js').Provider} Provider */
/** @typedef {import('./_types.js').PortalEntry} PortalEntry */
/** @typedef {import('./_types.js').Job} Job */

// Google Careers & Google DeepMind provider
// Extracts structured job postings directly from Google's Careers boq frontend
// (`https://www.google.com/about/careers/applications/jobs/results`).
//
// The page embeds the full structured data catalog in `AF_initDataCallback` with key `ds:1`.
// This provider performs zero-browser HTTP fetches and extracts the JSON data directly.
import { htmlToText } from './_html-to-text.mjs';

const BASE_URL = 'https://www.google.com/about/careers/applications/jobs/results';
const PAGE_SIZE = 20;
const DEFAULT_MAX_PAGES = 5;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Parses the raw `ds:1` payload from Google Careers HTML response.
 * @param {string} html
 * @returns {any[] | null}
 */
export function extractDs1(html) {
  const marker = "key: 'ds:1', hash: '2', data:";
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  let jsonEnd = html.indexOf(', sideChannel:', jsonStart);
  if (jsonEnd === -1) jsonEnd = html.indexOf('});', jsonStart);
  if (jsonEnd === -1) return null;

  try {
    const raw = html.slice(jsonStart, jsonEnd).trim();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.[0]) ? parsed[0] : null;
  } catch {
    return null;
  }
}

/**
 * Normalizes one Google job array entry into a career-ops Job object.
 * @param {any[]} j
 * @param {string} defaultCompany
 * @returns {Job | null}
 */
export function normalizeJob(j, defaultCompany) {
  if (!Array.isArray(j) || !j[0] || !j[1]) return null;

  const id = String(j[0]);
  const title = String(j[1]);
  const url = `https://www.google.com/about/careers/applications/jobs/results/${id}`;
  const company = (typeof j[7] === 'string' && j[7].trim()) ? j[7].trim() : defaultCompany;

  let location = '';
  if (Array.isArray(j[9])) {
    location = j[9]
      .filter((loc) => Array.isArray(loc) && typeof loc[0] === 'string')
      .map((loc) => loc[0].trim())
      .join('; ');
  }

  let descParts = [];
  if (Array.isArray(j[3]) && typeof j[3][1] === 'string') {
    descParts.push(j[3][1]);
  }
  if (Array.isArray(j[4]) && typeof j[4][1] === 'string') {
    descParts.push(j[4][1]);
  }
  const description = htmlToText(descParts.join('\n\n'));

  let postedAt = undefined;
  if (Array.isArray(j[13]) && typeof j[13][0] === 'number') {
    postedAt = j[13][0] * 1000;
  }

  return {
    title,
    url,
    company,
    location,
    description,
    postedAt,
  };
}

/** @type {Provider} */
export default {
  id: 'google',

  detect(entry) {
    if (entry.provider === 'google') return { url: entry.careers_url || BASE_URL };
    const url = entry.careers_url || '';
    if (/google\.com\/about\/careers\/applications\/jobs/i.test(url) || /careers\.google\.com/i.test(url)) {
      return { url };
    }
    return null;
  },

  async fetch(entry, ctx) {
    const cfg = /** @type {any} */ (entry).google || {};
    const maxPages = Number.isInteger(cfg.max_pages) && cfg.max_pages > 0
      ? Math.min(cfg.max_pages, 10)
      : (ctx.maxPages || DEFAULT_MAX_PAGES);

    const baseSearchUrl = entry.careers_url && entry.careers_url.startsWith('http')
      ? entry.careers_url
      : BASE_URL;

    /** @type {Job[]} */
    const out = [];
    const seenIds = new Set();

    for (let page = 1; page <= maxPages; page++) {
      const urlObj = new URL(baseSearchUrl);
      if (page > 1) {
        urlObj.searchParams.set('page', String(page));
      }
      if (cfg.company && !urlObj.searchParams.has('company')) {
        urlObj.searchParams.set('company', cfg.company);
      }
      if (cfg.location && !urlObj.searchParams.has('location')) {
        urlObj.searchParams.set('location', cfg.location);
      }
      if (cfg.q && !urlObj.searchParams.has('q')) {
        urlObj.searchParams.set('q', cfg.q);
      }

      const html = await ctx.fetchText(urlObj.toString(), {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'error',
      });

      const rawJobs = extractDs1(html);
      if (!rawJobs || rawJobs.length === 0) {
        break;
      }

      let freshInPage = 0;
      for (const j of rawJobs) {
        const id = String(j[0]);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const normalized = normalizeJob(j, entry.name);
        if (normalized) {
          out.push(normalized);
          freshInPage++;
        }
      }

      if (rawJobs.length < PAGE_SIZE || freshInPage === 0) {
        break;
      }
    }

    return out;
  },
};
