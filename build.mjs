/**
 * Builds the Home Screen app from the artifact page: `node build.mjs`.
 * maccabi-players-game.html stays the one source; this writes index.html (full document, iPhone meta,
 * install hint, service worker registration), sw.js (offline cache, versioned by content) and the icons.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = import.meta.dirname;
const NAVY = '#0B2A7A';
const YELLOW = '#FFD21F';

// ---------- icons ----------
const SHIRT = 'M62 22 L84 13 Q100 25 116 13 L138 22 L184 48 L168 88 L148 79 L148 186 L52 186 L52 79 L32 88 L16 48 Z';
function icon(scale) {
  const t = 256 - 100 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<rect width="512" height="512" fill="${NAVY}"/>
<g transform="translate(${t} ${t + 4 * scale}) scale(${scale})">
<path d="${SHIRT}" fill="${YELLOW}" stroke-linejoin="round"/>
<path d="M84 13 Q100 25 116 13" fill="none" stroke="${NAVY}" stroke-width="7" stroke-linecap="round"/>
<text x="100" y="160" text-anchor="middle" font-family="Arial Black, Helvetica Neue, Arial, sans-serif" font-weight="900" font-size="96" fill="${NAVY}">?</text>
</g>
</svg>
`;
}
const svgs = { icon: icon(2.2), 'icon-maskable': icon(1.6) };
for (const [name, svg] of Object.entries(svgs)) writeFileSync(join(ROOT, 'icons', `${name}.svg`), svg);
if (process.platform === 'darwin') {
  const work = mkdtempSync(join(tmpdir(), 'icons-'));
  for (const [source, name, size] of [
    ['icon', 'apple-touch-icon', 180],
    ['icon', 'icon-192', 192],
    ['icon', 'icon-512', 512],
    ['icon-maskable', 'icon-maskable-512', 512],
  ]) {
    execFileSync('qlmanage', ['-t', '-s', String(size), '-o', work, join(ROOT, 'icons', `${source}.svg`)], { stdio: 'ignore' });
    renameSync(join(work, `${source}.svg.png`), join(ROOT, 'icons', `${name}.png`));
  }
}

// ---------- index.html ----------
const src = readFileSync(join(ROOT, 'maccabi-players-game.html'), 'utf8');
const cut = src.indexOf('<div class="wrap"');
const head = src.slice(0, cut).replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '');
const body = src.slice(cut);

// The artifact viewer adds these; standalone the page needs them itself.
const base = `<style>
:root { color-scheme: light dark; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; -webkit-text-size-adjust: 100%; -webkit-tap-highlight-color: transparent; }
button { touch-action: manipulation; }
[hidden] { display: none !important; }
img { max-width: 100%; }
.install { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 12px; background: var(--yellow-soft); font-size: 15px; }
.install p { margin: 0; min-width: 0; }
.install button { background: none; border: 0; color: var(--muted); font-size: 14px; text-decoration: underline; padding: 4px; flex: none; }
</style>`;

const extra = `<script>
// Install hint in Safari on iPhone; gone once added to the Home Screen or dismissed.
(function () {
  var standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var dismissed = false;
  try { dismissed = localStorage.getItem('mta-install-hint') === 'no'; } catch (e) {}
  if (!ios || standalone || dismissed) return;
  var bar = document.createElement('div');
  bar.className = 'install';
  bar.innerHTML = '<p>להוספה למסך הבית: לוחצים על <b>שיתוף</b> ואז <b>הוספה למסך הבית</b>.</p><button type="button">לא עכשיו</button>';
  bar.querySelector('button').addEventListener('click', function () {
    bar.remove();
    try { localStorage.setItem('mta-install-hint', 'no'); } catch (e) {}
  });
  var wrap = document.querySelector('.wrap');
  wrap.insertBefore(bar, wrap.querySelector('nav.tabs'));
})();
if ('serviceWorker' in navigator) {
  addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
}
</script>`;

const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#F3F5FB" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#061029" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="הצהובים">
<meta name="description" content="משחק ללימוד סגל מכבי תל אביב בכדורגל 2026/27">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
${head.trim()}
${base}
</head>
<body>
${body.trim()}
${extra}
</body>
</html>
`;
writeFileSync(join(ROOT, 'index.html'), html);

// ---------- sw.js ----------
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
const hash = createHash('sha256');
for (const f of FILES.slice(1)) hash.update(f).update(readFileSync(join(ROOT, f)));
const version = hash.digest('hex').slice(0, 10);
writeFileSync(join(ROOT, 'sw.js'), `// Generated by build.mjs. Offline copy of the app; a new version installs on the next visit.
const CACHE = 'mta-${version}';
const FONTS = 'mta-fonts';
const FILES = ${JSON.stringify(FILES)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mta-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: serve what we have, refresh in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then((c) => c.match(req).then((hit) => {
      const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;

  // The page: network first so updates arrive, the cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html', { ignoreSearch: true })));
    return;
  }

  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
`);

console.log(`Built index.html and sw.js (${version}).`);
