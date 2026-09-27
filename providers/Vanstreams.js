'use strict';

const TMDB_KEY         = '83d364331c40bfbe29858aeed82f45cc';
const UA               = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TORRENTCLAW_API  = 'https://torrentclaw.com/api/stremio';
const TORRENTIO_BASE   = 'https://torrentio.strem.fun';

const MAX_SIZE_GB_MOVIE  = 4;
const MAX_SIZE_GB_SERIES = 1.5;
const LINKS_PER_QUALITY  = 5;
const ALLOWED_QUALITIES  = ['4k', '1080p', '720p', '576p', '480p', 'webrip'];

const QUALITY_RANK = {
  '1080p': 1, '720p': 2, '576p': 3, '480p': 4,
  '4k': 5, '2160p': 5, 'webrip': 6, 'webdl': 6,
};

const PRIORITY_PROVIDERS = ['yts', 'knaben', 'torrentsdb', 'eztv', 'nyaasi', 'thepiratebay', 'torrentclaw'];

const KNOWN_PROVIDERS = [
  'YTS', 'EZTV', 'Knaben', 'Torrentio', 'Bitmagnet', 'Prowlarr',
  'DonTorrent', 'Torrents.csv', '1337x', 'TorrentGalaxy', 'RARBG',
  'ThePirateBay', 'BitSearch', 'LimeTorrents', 'Nyaa', 'KickassTorrents',
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
].map(function(t) { return '&tr=' + encodeURIComponent(t); }).join('');

function buildMagnet(hash, name) {
  return 'magnet:?xt=urn:btih:' + hash.toLowerCase() + '&dn=' + encodeURIComponent(name) + TR;
}

function getQuality(str) {
  var s = (str || '').toLowerCase();
  if (s.indexOf('4k') !== -1 || s.indexOf('2160p') !== -1 || s.indexOf('uhd') !== -1) return '4k';
  if (s.indexOf('1080p') !== -1) return '1080p';
  if (s.indexOf('720p') !== -1)  return '720p';
  if (s.indexOf('576p') !== -1)  return '576p';
  if (s.indexOf('480p') !== -1)  return '480p';
  if (s.indexOf('webrip') !== -1) return 'webrip';
  if (s.indexOf('webdl') !== -1 || s.indexOf('web-dl') !== -1) return 'webdl';
  return null;
}

function getSizeGB(stream) {
  var raw = (stream.title || '') + ' ' + (stream.name || '');
  var m = raw.match(/💾\s*([\d.]+)\s*(GB|MB)/i) || raw.match(/([\d.]+)\s*(GB|MB)/i);
  if (!m) {
    if (typeof stream.size === 'number' && stream.size > 0) return stream.size / 1073741824;
    if (typeof stream.bytes === 'number' && stream.bytes > 0) return stream.bytes / 1073741824;
    return null;
  }
  var val = parseFloat(m[1]);
  return m[2].toUpperCase() === 'GB' ? val : val / 1024;
}

function formatSize(sizeGB) {
  if (sizeGB === null || sizeGB === undefined || isNaN(sizeGB)) return 'Unknown Size';
  if (sizeGB < 1) return Math.round(sizeGB * 1024) + 'MB';
  return sizeGB.toFixed(1) + 'GB';
}

function getSeeders(stream) {
  if (stream._seeders != null) return stream._seeders;
  if (stream.behaviorHints && stream.behaviorHints.seeders) return stream.behaviorHints.seeders;
  var raw = (stream.title || '') + ' ' + (stream.name || '');
  var m = raw.match(/🌱\s*(\d+)/) || raw.match(/👤\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function getLangLine(str) {
  var lower = (str || '').toLowerCase();
  var found = [];
  var checks = [
    [/\benglish\b/,          'English'],
    [/\bjapanese\b/,         'Japanese'],
    [/\bhindi\b/,            'Hindi'],
    [/\bfrench\b/,           'French'],
    [/\bgerman\b/,           'German'],
    [/\bspanish\b/,          'Spanish'],
    [/\bitalian\b/,          'Italian'],
    [/\brussian\b/,          'Russian'],
    [/\bkorean\b/,           'Korean'],
    [/\bchinese\b/,          'Chinese'],
    [/\barabic\b/,           'Arabic'],
    [/\bportuguese\b/,       'Portuguese'],
    [/\bturkish\b/,          'Turkish'],
    [/\bpolish\b/,           'Polish'],
    [/\bdutch\b/,            'Dutch'],
    [/\bczech\b/,            'Czech'],
    [/\bswedish\b/,          'Swedish'],
    [/\bnorwegian\b/,        'Norwegian'],
    [/\bdanish\b/,           'Danish'],
    [/\bfinnish\b/,          'Finnish'],
    [/\bromanian\b/,         'Romanian'],
    [/\bgreek\b/,            'Greek'],
    [/\bhebrew\b/,           'Hebrew'],
    [/\bthai\b/,             'Thai'],
    [/\bindonesian\b/,       'Indonesian'],
    [/\bvietnamese\b/,       'Vietnamese'],
    [/\btamil\b/,            'Tamil'],
    [/\btelugu\b/,           'Telugu'],
    [/\burdu\b/,             'Urdu'],
    [/\bdubbed\b/,           'Dubbed'],
    [/\bdual[\s\-]audio\b/,  'Dual Audio'],
    [/\bmulti[\s\-]audio\b/, 'Multi Audio'],
    [/\bmulti\b/,            'Multi'],
  ];
  for (var i = 0; i < checks.length; i++) {
    if (checks[i][0].test(lower)) {
      if (checks[i][1] === 'Multi' && found.indexOf('Multi Audio') !== -1) continue;
      found.push(checks[i][1]);
    }
  }
  return found.filter(function(v, i, a) { return a.indexOf(v) === i; }).join(' / ');
}

function detectProvider(combined, item, idx) {
  var upper = combined.toUpperCase();
  if (item && item.provider) return String(item.provider);
  if (item && item.source)   return String(item.source);
  if (item && item.indexer)  return String(item.indexer);
  for (var i = 0; i < KNOWN_PROVIDERS.length; i++) {
    if (upper.indexOf(KNOWN_PROVIDERS[i].toUpperCase()) !== -1) return KNOWN_PROVIDERS[i];
  }
  return KNOWN_PROVIDERS[idx % KNOWN_PROVIDERS.length];
}

function qualityEmoji(quality) {
  if (quality === '4k' || quality === '2160p') return '🔥';
  if (quality === '1080p')  return '🌟';
  if (quality === '720p')   return '💎';
  if (quality === '576p' || quality === '480p') return '📱';
  if (quality === 'webrip' || quality === 'webdl') return '🌐';
  return '🔥';
}

function buildUnifiedTitle(opts) {
  var isSeries  = opts.isSeries;
  var title     = opts.title;
  var year      = opts.year;
  var season    = opts.season;
  var episode   = opts.episode;
  var quality   = opts.quality;
  var tagLine   = opts.tagLine;
  var seeders   = opts.seeders;
  var sizeStr   = opts.sizeStr;
  var provider  = opts.provider;
  var header    = isSeries
    ? '📺 ' + title + ' | S' + (season || 1) + ' E' + (episode || 1)
    : '🎬 ' + title + (year ? ' - ' + year : '');
  var qLine     = qualityEmoji(quality) + ' ' + (quality || 'unknown') + (tagLine ? ' | ' + tagLine : '');
  var statsLine = '🌱 ' + seeders + ' | 💾 ' + sizeStr + ' | 🔗 ' + provider;
  return header + '\n' + qLine + '\n' + statsLine;
}

function buildUnifiedName(opts) {
  var quality     = opts.quality;
  var seeders     = opts.seeders;
  var sourceLabel = opts.sourceLabel;
  return sourceLabel + ' | ' + (quality || 'unknown').toUpperCase() + ' | 🌱' + seeders;
}

// ── Safe fetch with timeout using Promise.race ───────────────────────

function fetchWithTimeout(url, options, ms) {
  var timeout = ms || 15000;
  var timeoutPromise = new Promise(function(_, reject) {
    setTimeout(function() { reject(new Error('timeout')); }, timeout);
  });
  return Promise.race([fetch(url, options), timeoutPromise]);
}

function fetchWithProxy(url) {
  var proxies = [
    url,
    'https://corsproxy.io/?url=' + encodeURIComponent(url),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
    'https://thingproxy.freeboard.io/fetch/' + url,
  ];
  var i = 0;
  function tryNext() {
    if (i >= proxies.length) return Promise.resolve(null);
    var p = proxies[i++];
    return fetchWithTimeout(p, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, 15000)
      .then(function(r) {
        if (r && r.ok) return r.json();
        return tryNext();
      })
      .catch(function() { return tryNext(); });
  }
  return tryNext();
}

// ── Process & deduplicate ────────────────────────────────────────────

function processStreams(streams, type) {
  var maxSize = type === 'series' ? MAX_SIZE_GB_SERIES : MAX_SIZE_GB_MOVIE;

  var filtered = streams.filter(function(s) {
    if (!s.infoHash && !s.url) return false;
    var q = s._quality || getQuality(s.title || s.name || '');
    if (!q || ALLOWED_QUALITIES.indexOf(q) === -1) return false;
    var sizeGB = s._sizeGB != null ? s._sizeGB : getSizeGB(s);
    if (sizeGB !== null && sizeGB > maxSize) return false;
    return true;
  });

  var seen = {};
  var unique = filtered.filter(function(s) {
    var key = (s.infoHash || '').toLowerCase();
    if (!key) return true;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  var byQuality = {};
  unique.forEach(function(s) {
    var q = s._quality || getQuality(s.title || s.name || '') || 'unknown';
    if (!byQuality[q]) byQuality[q] = [];
    byQuality[q].push(s);
  });

  Object.keys(byQuality).forEach(function(q) {
    byQuality[q].sort(function(a, b) {
      var rankA = PRIORITY_PROVIDERS.indexOf((a._source || '').toLowerCase());
      var rankB = PRIORITY_PROVIDERS.indexOf((b._source || '').toLowerCase());
      var pA = rankA === -1 ? 999 : rankA;
      var pB = rankB === -1 ? 999 : rankB;
      if (pA !== pB) return pA - pB;
      return getSeeders(b) - getSeeders(a);
    });
  });

  var sortedQualities = Object.keys(byQuality).sort(function(a, b) {
    return (QUALITY_RANK[a] || 99) - (QUALITY_RANK[b] || 99);
  });

  var result = [];
  sortedQualities.forEach(function(q) {
    var slice = byQuality[q].slice(0, LINKS_PER_QUALITY);
    slice.forEach(function(s) { result.push(s); });
  });
  return result;
}

// ── TMDB ─────────────────────────────────────────────────────────────

function tmdbLookup(tmdbId, type) {
  var isSeries = type === 'tv' || type === 'series';
  return fetchWithTimeout(
    'https://api.themoviedb.org/3/' + (isSeries ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY + '&append_to_response=external_ids',
    { headers: { 'User-Agent': UA } },
    8000
  ).then(function(r) {
    if (!r || !r.ok) {
      return fetchWithTimeout(
        'https://api.themoviedb.org/3/find/' + tmdbId + '?api_key=' + TMDB_KEY + '&external_source=imdb_id',
        { headers: { 'User-Agent': UA } },
        8000
      ).then(function(r2) {
        if (!r2 || !r2.ok) return null;
        return r2.json().then(function(d) {
          var movie = d.movie_results && d.movie_results[0];
          var tv    = d.tv_results    && d.tv_results[0];
          if (movie) return { imdbId: tmdbId, title: movie.title || movie.original_title, year: (movie.release_date || '').slice(0, 4) };
          if (tv)    return { imdbId: tmdbId, title: tv.name    || tv.original_name,      year: (tv.first_air_date  || '').slice(0, 4) };
          return null;
        });
      });
    }
    return r.json().then(function(d) {
      var extIds = d.external_ids || {};
      return {
        imdbId: extIds.imdb_id || d.imdb_id || String(tmdbId),
        title:  d.title || d.name || '',
        year:   (d.release_date || d.first_air_date || '').slice(0, 4),
      };
    });
  }).catch(function() { return null; });
}

// ── 1. YTS ───────────────────────────────────────────────────────────

function scrapeYTS(imdbId) {
  return fetchWithTimeout(
    'https://movies-api.accel.li/api/v2/list_movies.json?query_term=' + imdbId + '&limit=10',
    { headers: { 'User-Agent': UA } },
    12000
  ).then(function(r) {
    if (!r || !r.ok) return [];
    return r.json().then(function(data) {
      if (data.status !== 'ok' || !data.data || !data.data.movies || !data.data.movies.length) return [];
      var streams = [];
      data.data.movies.forEach(function(movie) {
        if (movie.imdb_code && movie.imdb_code !== imdbId) return;
        (movie.torrents || []).forEach(function(t) {
          if (!t.hash) return;
          var qualityStr = (t.quality + ' ' + (t.type || '')).trim();
          var sizeGB     = t.size_bytes ? t.size_bytes / 1073741824 : null;
          var sizeStr    = formatSize(sizeGB);
          var quality    = getQuality(qualityStr);
          var upper      = qualityStr.toUpperCase();
          var tags       = [];
          if (upper.indexOf('HEVC') !== -1 || upper.indexOf('X265') !== -1 || upper.indexOf('H265') !== -1) tags.push('HEVC');
          var langLine   = getLangLine(qualityStr);
          tags.push(langLine || 'English');
          var tagLine = tags.join(' • ');
          streams.push({
            infoHash:  t.hash.toLowerCase(),
            name:      buildUnifiedName({ quality: quality, seeders: t.seeds || 0, sourceLabel: '🍿 YTS' }),
            title:     buildUnifiedTitle({ isSeries: false, title: movie.title, year: String(movie.year), season: '', episode: '', quality: quality, tagLine: tagLine, seeders: t.seeds || 0, sizeStr: sizeStr, provider: 'YTS' }),
            sources:   [],
            _quality:  quality,
            _seeders:  t.seeds || 0,
            _sizeGB:   sizeGB,
            _source:   'yts',
            _provider: 'yts',
          });
        });
      });
      return streams;
    });
  }).catch(function() { return []; });
}

// ── 2. TorrentClaw ───────────────────────────────────────────────────

function scrapeTorrentClaw(type, imdbId, title, year, season, episode) {
  var isSeries = type === 'series' || type === 'tv';
  var path     = isSeries
    ? 'series/' + imdbId + ':' + (season || 1) + ':' + (episode || 1)
    : 'movie/' + imdbId;
  var url = TORRENTCLAW_API + '/stream/' + path + '.json';

  return fetchWithProxy(url).then(function(data) {
    if (!data || !Array.isArray(data.streams) || !data.streams.length) return [];
    var streams = [];
    data.streams.forEach(function(item, idx) {
      if (!item) return;
      var rawName  = item.name  || '';
      var rawTitle = item.title || '';
      var rawDesc  = item.description || '';
      var combined = (rawName + ' ' + rawTitle + ' ' + rawDesc).replace(/\n/g, ' ');
      var upper    = combined.toUpperCase();
      var infoHashMatch = (item.url || '').match(/btih:([a-fA-F0-9]{32,40})/i);
      var infoHash = item.infoHash || (infoHashMatch ? infoHashMatch[1] : null);
      if (!infoHash && !item.url) return;
      var sizeGB = getSizeGB({ title: combined, size: item.size, bytes: item.bytes });
      var sizeStr = formatSize(sizeGB);
      var seeders = typeof item.seeders === 'number' ? item.seeders
        : (function() {
            var m = combined.match(/🌱\s*(\d+)/) || combined.match(/👤\s*(\d+)/) || combined.match(/(\d+)\s*seed/i);
            return m ? parseInt(m[1], 10) : 0;
          })();
      var provider = detectProvider(combined, item, idx);
      var quality  = getQuality(combined);
      var tags = [];
      if (upper.indexOf('DV') !== -1 || upper.indexOf('DOLBY VISION') !== -1) tags.push('DV');
      if (upper.indexOf('HDR10+') !== -1)      tags.push('HDR10+');
      else if (upper.indexOf('HDR10') !== -1)  tags.push('HDR10');
      else if (upper.indexOf('HDR') !== -1)    tags.push('HDR');
      if (upper.indexOf('HEVC') !== -1 || upper.indexOf('X265') !== -1 || upper.indexOf('H265') !== -1) tags.push('HEVC');
      var langLine = getLangLine(combined);
      tags.push(langLine || 'English');
      var tagLine = tags.join(' • ');
      streams.push({
        infoHash:  infoHash ? infoHash.toLowerCase() : undefined,
        url:       infoHash ? buildMagnet(infoHash, title) : item.url,
        name:      buildUnifiedName({ quality: quality, seeders: seeders, sourceLabel: '🦞 TorrentClaw' }),
        title:     buildUnifiedTitle({ isSeries: isSeries, title: title, year: year, season: season, episode: episode, quality: quality, tagLine: tagLine, seeders: seeders, sizeStr: sizeStr, provider: provider }),
        sources:   [],
        _quality:  quality,
        _seeders:  seeders,
        _sizeGB:   sizeGB,
        _source:   'torrentclaw',
        _provider: provider.toLowerCase(),
      });
    });
    return streams;
  }).catch(function() { return []; });
}

// ── 3. Torrentio ─────────────────────────────────────────────────────

function fetchTorrentio(type, id, title, year, season, episode) {
  var isSeries = type === 'series';
  var url = TORRENTIO_BASE + '/stream/' + type + '/' + id + '.json';

  return fetchWithProxy(url).then(function(data) {
    if (!data || !data.streams || !data.streams.length) return [];
    return data.streams.map(function(s) {
      var origTitle = s.title || '';
      var providerMatch = origTitle.match(/⚙️\s*(\S+)/);
      var provider = providerMatch ? providerMatch[1] : 'Unknown';
      provider = provider.toLowerCase().replace(/\.(to|com|org|net|io)$/, '');
      if (provider === 'thepiratebay') provider = 'thepiratesbay';
      if (provider === 'nyaa.si')      provider = 'nyaa';
      if (provider === 'limetorrents') provider = 'limetorrent';
      if (provider === 'kat')          provider = 'kickasstorrents';
      var bh = s.behaviorHints || {};
      var seeders = bh.seeders != null ? bh.seeders
        : (function() {
            var m = origTitle.match(/👤\s*(\d+)/) || origTitle.match(/🌱\s*(\d+)/);
            return m ? parseInt(m[1], 10) : 0;
          })();
      var sizeGB  = getSizeGB(s);
      var sizeStr = formatSize(sizeGB);
      var quality = getQuality(origTitle) || getQuality(s.name || '');
      var upper   = origTitle.toUpperCase();
      var tags    = [];
      if (upper.indexOf('DV') !== -1 || upper.indexOf('DOLBY VISION') !== -1) tags.push('DV');
      if (upper.indexOf('HDR10+') !== -1)      tags.push('HDR10+');
      else if (upper.indexOf('HDR10') !== -1)  tags.push('HDR10');
      else if (upper.indexOf('HDR') !== -1)    tags.push('HDR');
      if (upper.indexOf('HEVC') !== -1 || upper.indexOf('X265') !== -1 || upper.indexOf('H265') !== -1) tags.push('HEVC');
      var langLine = getLangLine(origTitle);
      tags.push(langLine || 'English');
      var tagLine = tags.join(' • ');
      var result = {};
      Object.keys(s).forEach(function(k) { result[k] = s[k]; });
      result.name     = buildUnifiedName({ quality: quality, seeders: seeders, sourceLabel: '🚀 Torrentio' });
      result.title    = buildUnifiedTitle({ isSeries: isSeries, title: title, year: year, season: season, episode: episode, quality: quality, tagLine: tagLine, seeders: seeders, sizeStr: sizeStr, provider: provider });
      result._quality = quality;
      result._seeders = seeders;
      result._sizeGB  = sizeGB;
      result._source  = 'torrentio';
      result._provider = provider;
      return result;
    });
  }).catch(function() { return []; });
}

// ── Main ──────────────────────────────────────────────────────────────

function getStreams(tmdbId, type, season, episode, settings) {
  type = type || 'movie';
  var isSeries = type === 'tv' || type === 'series';

  return tmdbLookup(tmdbId, type).then(function(meta) {
    var imdbId = (meta && meta.imdbId) ? meta.imdbId : String(tmdbId);
    var title  = (meta && meta.title)  ? meta.title  : '';
    var year   = (meta && meta.year)   ? meta.year   : '';
    var stremioId = isSeries && season && episode
      ? imdbId + ':' + season + ':' + episode
      : imdbId;

    var ytsPromise = isSeries ? Promise.resolve([]) : scrapeYTS(imdbId);
    var clawPromise = scrapeTorrentClaw(type, imdbId, title, year, season, episode);
    var torrentioPromise = fetchTorrentio(type, stremioId, title, year, season, episode);

    return Promise.all([
      ytsPromise.catch(function() { return []; }),
      clawPromise.catch(function() { return []; }),
      torrentioPromise.catch(function() { return []; }),
    ]).then(function(results) {
      var yts       = results[0] || [];
      var claw      = results[1] || [];
      var torrentio = results[2] || [];
      var all = yts.concat(claw).concat(torrentio);
      return processStreams(all, type).map(function(s) {
        return {
          name:  s.name,
          title: s.title,
          url:   s.url || (s.infoHash ? buildMagnet(s.infoHash, title) : ''),
        };
      });
    });
  }).catch(function() { return []; });
}

function onSettings() {
  return Promise.resolve([
    { type: 'header', label: '☀️ VanStreams+' },
    {
      type: 'select', key: 'quality', label: 'Preferred Quality',
      options: [
        { label: 'All',   value: 'all'   },
        { label: '4K',    value: '4k'    },
        { label: '1080p', value: '1080p' },
        { label: '720p',  value: '720p'  },
      ],
      default: 'all',
    },
    {
      type: 'select', key: 'sortBy', label: 'Sort By',
      options: [
        { label: 'Seeders', value: 'seeders' },
        { label: 'Quality', value: 'quality' },
        { label: 'Size',    value: 'size'    },
      ],
      default: 'seeders',
    },
  ]);
}

module.exports = { getStreams: getStreams, onSettings: onSettings };
