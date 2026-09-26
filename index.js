'use strict';

const express = require('express');
const axios   = require('axios');
const app  = express();
const serverless = require('serverless-http');

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const TMDB_KEY        = '83d364331c40bfbe29858aeed82f45cc';
const UA              = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TORRENTIO_BASE  = 'https://torrentio.strem.fun';

const PROXY_1 = 'https://corsproxy.io/?url=';
const PROXY_2 = 'https://api.codetabs.com/v1/proxy?quest=';
const PROXY_3 = 'https://thingproxy.freeboard.io/fetch/';

const MAX_SIZE_GB_MOVIE  = 4;
const MAX_SIZE_GB_SERIES = 1.5;
const LINKS_PER_QUALITY  = 5;
const ALLOWED_QUALITIES  = ['4k', '1080p', '720p', '576p', '480p', 'webrip'];

const QUALITY_RANK = {
  '1080p': 1, '720p': 2, '576p': 3, '480p': 4,
  '4k': 5, '2160p': 5, 'webrip': 6, 'webdl': 6,
};

const PRIORITY_PROVIDERS = ['yts', 'knaben', 'torrentsdb', 'eztv', 'nyaasi', 'thepiratebay'];

const ALLOWED_PROVIDERS = [
  'yts',
  'knaben',
  'thepiratesbay',
  'thepiratebay',
  'eztv',
  'torrentcsv',
  'nyaa',
  'nyaasi',
  'limetorrent',
  'kickasstorrents',
  'animetosho',
  'tokyotosho'
];

const TR = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://tracker.dler.org:6969/announce',
  'https://tracker.moeblog.cn:443/announce',
  'https://tracker.zhuqiy.com:443/announce',
].map(t => '&tr=' + encodeURIComponent(t)).join('');

// ─── Proxy fallback function ────────────────────────────────────────
async function fetchWithProxy(url, options = {}) {
  const proxies = [
    url,
    PROXY_1 + encodeURIComponent(url),
    PROXY_2 + encodeURIComponent(url),
    PROXY_3 + encodeURIComponent(url),
  ];

  for (const proxyUrl of proxies) {
    try {
      const response = await axios.get(proxyUrl, { timeout: 12000, headers: { 'User-Agent': UA }, ...options });
      return response;
    } catch (e) {
      console.warn(`[Proxy] Failed: ${proxyUrl.substring(0, 50)}... Error: ${e.message}`);
      continue;
    }
  }
  throw new Error('All proxy attempts failed');
}

function buildMagnet(hash, name) {
  return 'magnet:?xt=urn:btih:' + hash.toLowerCase() + '&dn=' + encodeURIComponent(name) + TR;
}

function getQuality(str = '') {
  const s = str.toLowerCase();
  if (s.includes('4k') || s.includes('2160p') || s.includes('uhd')) return '4k';
  if (s.includes('1080p'))  return '1080p';
  if (s.includes('720p'))   return '720p';
  if (s.includes('576p'))   return '576p';
  if (s.includes('480p'))   return '480p';
  if (s.includes('webrip')) return 'webrip';
  if (s.includes('webdl') || s.includes('web-dl')) return 'webdl';
  return null;
}

function getSizeGB(stream) {
  const raw = stream.title || stream.name || '';
  const m   = raw.match(/💾\s*([\d.]+)\s*(GB|MB)/i) || raw.match(/([\d.]+)\s*(GB|MB)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  return m[2].toUpperCase() === 'GB' ? val : val / 1024;
}

function getSeeders(stream) {
  if (stream._seeders != null) return stream._seeders;
  if (stream.behaviorHints?.seeders) return stream.behaviorHints.seeders;
  const m = (stream.title || '').match(/👤\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function getLangLine(str = '') {
  const lower = str.toLowerCase();
  const found = [];
  const checks = [
    [/\benglish\b/,           'English'],
    [/\bjapanese\b/,          'Japanese'],
    [/\bhindi\b/,             'Hindi'],
    [/\bfrench\b/,            'French'],
    [/\bgerman\b/,            'German'],
    [/\bspanish\b/,           'Spanish'],
    [/\bitalian\b/,           'Italian'],
    [/\brussian\b/,           'Russian'],
    [/\bkorean\b/,            'Korean'],
    [/\bchinese\b/,           'Chinese'],
    [/\barabic\b/,            'Arabic'],
    [/\bportuguese\b/,        'Portuguese'],
    [/\bturkish\b/,           'Turkish'],
    [/\bpolish\b/,            'Polish'],
    [/\bdutch\b/,             'Dutch'],
    [/\bczech\b/,             'Czech'],
    [/\bswedish\b/,           'Swedish'],
    [/\bnorwegian\b/,         'Norwegian'],
    [/\bdanish\b/,            'Danish'],
    [/\bfinnish\b/,           'Finnish'],
    [/\bromanian\b/,          'Romanian'],
    [/\bgreek\b/,             'Greek'],
    [/\bhebrew\b/,            'Hebrew'],
    [/\bthai\b/,              'Thai'],
    [/\bindonesian\b/,        'Indonesian'],
    [/\bvietnamese\b/,        'Vietnamese'],
    [/\btamil\b/,             'Tamil'],
    [/\btelugu\b/,            'Telugu'],
    [/\burdu\b/,              'Urdu'],
    [/\bdubbed\b/,            'Dubbed'],
    [/\bdual[\s\-]audio\b/,   'Dual Audio'],
    [/\bmulti[\s\-]audio\b/,  'Multi Audio'],
    [/\bmulti\b/,             'Multi'],
  ];
  for (const [re, label] of checks) {
    if (re.test(lower)) {
      if (label === 'Multi' && found.includes('Multi Audio')) continue;
      found.push(label);
    }
  }
  return [...new Set(found)].join(' / ');
}

function processStreams(streams, type) {
  const maxSize = type === 'series' ? MAX_SIZE_GB_SERIES : MAX_SIZE_GB_MOVIE;

  const filtered = streams.filter(s => {
    if (!s.infoHash && !s.url) return false;
    if (s._provider && !ALLOWED_PROVIDERS.includes(s._provider.toLowerCase())) return false;
    const q = s._quality || getQuality(s.title || s.name || '');
    if (!q || !ALLOWED_QUALITIES.includes(q)) return false;
    const sizeGB = s._sizeGB ?? getSizeGB(s);
    if (sizeGB !== null && sizeGB > maxSize) return false;
    return true;
  });

  const seen   = new Set();
  const unique = filtered.filter(s => {
    const key = (s.infoHash || '').toLowerCase();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const byQuality = {};
  unique.forEach(s => {
    const q = s._quality || getQuality(s.title || s.name || '') || 'unknown';
    if (!byQuality[q]) byQuality[q] = [];
    byQuality[q].push(s);
  });

  for (const q in byQuality) {
    byQuality[q].sort((a, b) => {
      const rankA = PRIORITY_PROVIDERS.indexOf((a._source || '').toLowerCase());
      const rankB = PRIORITY_PROVIDERS.indexOf((b._source || '').toLowerCase());
      const pA = rankA === -1 ? 999 : rankA;
      const pB = rankB === -1 ? 999 : rankB;
      if (pA !== pB) return pA - pB;
      return getSeeders(b) - getSeeders(a);
    });
  }

  const sortedQualities = Object.keys(byQuality).sort(
    (a, b) => (QUALITY_RANK[a] || 99) - (QUALITY_RANK[b] || 99)
  );

  const result = [];
  sortedQualities.forEach(q => result.push(...byQuality[q].slice(0, LINKS_PER_QUALITY)));
  return result;
}

async function tmdbLookup(imdbId) {
  try {
    const { data } = await axios.get(
      `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`,
      { timeout: 8000 }
    );
    const movie = data.movie_results?.[0];
    const tv    = data.tv_results?.[0];
    if (movie) return { title: movie.title || movie.original_title, year: (movie.release_date || '').slice(0, 4) };
    if (tv)    return { title: tv.name || tv.original_name, year: (tv.first_air_date || '').slice(0, 4) };
    return null;
  } catch (e) { console.error('[TMDB]', e.message); return null; }
}

async function scrapeYTS(imdbId) {
  try {
    const { data } = await axios.get(
      `https://movies-api.accel.li/api/v2/list_movies.json?query_term=${imdbId}&limit=10`,
      { timeout: 12000, headers: { 'User-Agent': UA } }
    );
    if (data.status !== 'ok' || !data.data?.movies?.length) return [];
    const streams = [];
    for (const movie of data.data.movies) {
      if (movie.imdb_code && movie.imdb_code !== imdbId) continue;
      for (const t of (movie.torrents || [])) {
        if (!t.hash) continue;
        const qualityStr = `${t.quality} ${t.type || ''}`.trim();
        const sizeGB     = t.size_bytes ? t.size_bytes / 1073741824 : null;
        const sizeStr    = sizeGB ? sizeGB.toFixed(2) + ' GB' : (t.size || '');
        const langLine   = getLangLine(qualityStr);
        streams.push({
          infoHash: t.hash.toLowerCase(),
          name:     qualityStr,
          title:    `☀️ ${movie.title} (${movie.year})\n🌱 ${t.seeds || 0}\n💾 ${sizeStr}\n🏅 YTS${langLine ? '\n🔊 ' + langLine : ''}`,
          sources:  [],
          _quality: getQuality(qualityStr),
          _seeders: t.seeds || 0,
          _sizeGB:  sizeGB,
          _source:  'yts',
          _provider: 'yts',
        });
      }
    }
    console.log(`[YTS] ${streams.length} for ${imdbId}`);
    return streams;
  } catch (e) { console.error('[YTS]', e.message); return []; }
}

async function scrapeKnaben(title, year, isSeries, season, episode) {
  if (!title) return [];
  try {
    let query = title;
    if (year && !isSeries) query += ' ' + year;
    if (isSeries && season && episode)
      query += ` S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    const categories = isSeries ? [5000000, 5001000] : [2000000, 2001000];
    const { data } = await axios.post(
      'https://api.knaben.org/v1',
      { search_type: '75%', search_field: 'title', query, order_by: 'seeders', order_direction: 'desc', categories, from: 0, size: 40, hide_unsafe: true, hide_xxx: true },
      { timeout: 14000, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA } }
    );
    if (!data?.hits?.length) return [];
    const streams = [];
    for (const hit of data.hits) {
      if (!hit.magnetUrl && !hit.hash) continue;
      const magnet    = hit.magnetUrl || buildMagnet(hit.hash, hit.title || '');
      const hashMatch = magnet.match(/btih:([a-fA-F0-9]{32,40})/i);
      const hash      = hashMatch ? hashMatch[1] : (hit.hash || '');
      if (!hash) continue;
      const sizeGB  = hit.bytes ? hit.bytes / 1073741824 : null;
      const sizeStr = sizeGB ? sizeGB.toFixed(2) + ' GB' : '';
      const langLine = getLangLine(hit.title || '');
      streams.push({
        infoHash: hash.toLowerCase(),
        name:     hit.title || '',
        title:    `☀️ ${title}${year ? ' (' + year + ')' : ''}\n🌱 ${hit.seeders || 0}\n💾 ${sizeStr}\n🏅 Knaben${langLine ? '\n🔊 ' + langLine : ''}`,
        sources:  [],
        _quality: getQuality(hit.title || ''),
        _seeders: hit.seeders || 0,
        _sizeGB:  sizeGB,
        _source:  'knaben',
        _provider: 'knaben',
      });
    }
    console.log(`[Knaben] ${streams.length} for "${query}"`);
    return streams;
  } catch (e) { console.error('[Knaben]', e.message); return []; }
}

async function fetchTorrentio(type, id, title, year) {
  try {
    const url = `${TORRENTIO_BASE}/stream/${type}/${id}.json`;
    const { data } = await fetchWithProxy(url);
    const streams = (data.streams || []).map(s => {
      const origTitle = s.title || '';
      const providerMatch = (s.title || '').match(/⚙️\s*(\S+)/);
      let provider = providerMatch ? providerMatch[1] : 'Unknown';
      provider = provider.toLowerCase().replace(/\.(to|com|org|net|io)$/, '');
      if (provider === 'thepiratebay') provider = 'thepiratesbay';
      if (provider === 'nyaa.si') provider = 'nyaa';
      if (provider === 'limetorrents') provider = 'limetorrent';
      if (provider === 'kat') provider = 'kickasstorrents';
      const seeders = s.behaviorHints?.seeders
        ?? (() => { const m = (s.title || '').match(/👤\s*(\d+)/); return m ? parseInt(m[1], 10) : 0; })();
      const sizeGB = getSizeGB(s);
      const langLine = getLangLine(origTitle);
      return {
        ...s,
        title:    `☀️ ${title}${year ? ' (' + year + ')' : ''}\n🌱 ${seeders}\n💾 ${sizeGB ? sizeGB.toFixed(2) + ' GB' : 'N/A'}\n🏅 ${provider}${langLine ? '\n🔊 ' + langLine : ''}`,
        _quality: getQuality(s.title || s.name || ''),
        _seeders: seeders,
        _sizeGB:  sizeGB,
        _source:  'torrentio',
        _provider: provider,
      };
    });
    console.log(`[Torrentio] ${streams.length} for ${type}/${id}`);
    return streams;
  } catch (e) { console.error('[Torrentio]', e.message); return []; }
}

// ─── Manifest ──────────────────────────────────────────────────────────
app.get('/manifest.json', (_, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.json({
    id:          'org.ghostream.plus.v2',
    name:        'VanStreams+',
    description: 'Stream Everything You Want\nMade With 🤍 By Van',
    version:     '15.0.7',
    resources:   ['stream'],
    types:       ['movie', 'series'],
    idPrefixes:  ['tt'],
    catalogs:    [],
  });
});

// ─── Stream handler ────────────────────────────────────────────────
app.get('/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const isSeries = type === 'series';
  const [imdbId, season = '', episode = ''] = id.split(':');

  const meta  = await tmdbLookup(imdbId);
  const title = meta?.title || '';
  const year  = meta?.year  || '';

  const [ytsR, knabenR, torrentioR] = await Promise.allSettled([
    isSeries ? Promise.resolve([]) : scrapeYTS(imdbId),
    scrapeKnaben(title, year, isSeries, season, episode),
    fetchTorrentio(type, id, title, year),
  ]);

  const yts       = ytsR.status       === 'fulfilled' ? (ytsR.value       || []) : [];
  const knaben    = knabenR.status    === 'fulfilled' ? (knabenR.value    || []) : [];
  const torrentio = torrentioR.status === 'fulfilled' ? (torrentioR.value || []) : [];

  const streams = processStreams([...yts, ...knaben, ...torrentio], type);

  console.log(`[stream] ${type}/${id} → yts:${yts.length} knaben:${knaben.length} torrentio:${torrentio.length} final:${streams.length}`);
  res.json({ streams });
});

// ─── Diagnostic endpoints ─────────────────────────────────────────────
app.get('/diag/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  const isSeries = type === 'series';
  const [imdbId, season = '', episode = ''] = id.split(':');
  const meta = await tmdbLookup(imdbId);
  const [ytsR, knabenR, torrentioR] = await Promise.allSettled([
    isSeries ? Promise.resolve([]) : scrapeYTS(imdbId),
    scrapeKnaben(meta?.title || '', meta?.year || '', isSeries, season, episode),
    fetchTorrentio(type, id, meta?.title || '', meta?.year || ''),
  ]);
  res.json({
    imdbId, title: meta?.title, year: meta?.year, isSeries,
    tmdb:      meta ? `OK: ${meta.title} (${meta.year})` : 'FAILED',
    yts:       { count: (ytsR.value       || []).length, err: ytsR.reason?.message       || null },
    knaben:    { count: (knabenR.value    || []).length, err: knabenR.reason?.message    || null },
    torrentio: { count: (torrentioR.value || []).length, err: torrentioR.reason?.message || null },
  });
});

app.get('/diag-raw/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  try {
    const url = `${TORRENTIO_BASE}/stream/${type}/${id}.json`;
    const { data } = await fetchWithProxy(url);
    res.json((data.streams || []).slice(0, 3).map(s => ({
      name: s.name, title: s.title, behaviorHints: s.behaviorHints,
    })));
  } catch (e) { res.json({ error: e.message }); }
});

// ══════════════════════════  LANDING PAGE  ═══════════════════════════
app.get('/', (req, res) => {
  const manifestUrl = 'https://vanseleem-vsplus.hf.space/manifest.json';
  const installUrl  = 'stremio://vanseleem-vsplus.hf.space/manifest.json';

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VanStreams+</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
      background: #050810;
      color: #dde6f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 20px;
      background-image:
        radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,0,0,0.05) 0%, transparent 70%),
        radial-gradient(ellipse 40% 30% at 80% 80%, rgba(255,0,0,0.03) 0%, transparent 60%);
    }
    .wrap { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 20px; }
    .header { display: flex; flex-direction: column; gap: 12px; }
    .logo { font-size: 2.6rem; font-weight: 800; letter-spacing: -1px; line-height: 1; }
    .logo .van  { color: #FF0000; }
    .logo .streams { color: #ffffff; }
    .badge-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(255,0,0,0.08); border: 1px solid rgba(255,0,0,0.18);
      color: #ffffff; padding: 4px 11px; border-radius: 100px;
      font-size: 0.72rem; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
    }
    .badge.series { color: #ffffff; }
    .desc { color: #ffffff; font-size: 0.9rem; line-height: 1.6; margin-top: 2px; }
    .card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
      border-radius: 16px; padding: 20px 22px;
    }
    .card-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #ffffff; margin-bottom: 10px; }
    .url-box {
      font-family: 'SF Mono','Fira Code','Consolas',monospace; font-size: 0.8rem;
      color: #ffffff; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,0,0,0.12);
      border-radius: 10px; padding: 11px 14px; word-break: break-all; line-height: 1.5;
    }
    .actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .btn { padding: 10px 22px; border-radius: 10px; font-size: 0.84rem; font-weight: 600; text-decoration: none; border: none; cursor: pointer; transition: all 0.15s; font-family: inherit; }
    .btn-install {
      background: #FF0000;
      color: #ffffff;
    }
    .btn-install:hover { background: #cc0000; }
    .btn-copy {
      background: #ffffff;
      color: #050810;
      border: 1px solid #ffffff;
    }
    .btn-copy:hover {
      background: #e6e6e6;
      border-color: #e6e6e6;
    }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .stat { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px 12px; text-align: center; }
    .stat-val { font-size: 1.5rem; font-weight: 800; color: #fff; line-height: 1; margin-bottom: 5px; }
    .stat-lbl { font-size: 0.68rem; color: #aaa; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; white-space: pre-line; }
    .made-by { text-align: center; color: #ffffff; font-size: 0.85rem; margin-top: 6px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">
        <span class="van">Van</span> <span class="streams">Streams+</span>
      </div>
      <div class="badge-row">
        <span class="badge">🎬 Movies</span>
        <span class="badge series">📺 Series</span>
      </div>
      <p class="desc">Get Your 🍿 Ready</p>
    </div>
    <div class="card">
      <div class="card-label">Stremio Install URL</div>
      <div class="url-box">${manifestUrl}</div>
      <div class="actions">
        <a href="${installUrl}" class="btn btn-install">Install in Stremio</a>
        <button class="btn btn-copy" onclick="navigator.clipboard.writeText('${manifestUrl}').then(()=>{this.textContent='✔ Copied';setTimeout(()=>this.textContent='Copy URL',2000)})">Copy URL</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="stat-val">100K+</div><div class="stat-lbl">Movies</div></div>
      <div class="stat"><div class="stat-val">40K+</div><div class="stat-lbl">Series</div></div>
      <div class="stat"><div class="stat-val">20K+</div><div class="stat-lbl">Anime</div></div>
    </div>
    <div class="made-by">Made With 🤍 By Van</div>
  </div>
</body>
</html>`);
});

module.exports.handler = serverless(app);
});
