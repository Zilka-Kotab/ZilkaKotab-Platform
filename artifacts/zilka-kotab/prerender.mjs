/**
 * prerender.mjs
 * Generates a fully-static multi-page website from the React SPA.
 * Output: dist/static/ — one index.html per route, ready for Apache/cPanel.
 *
 * Usage:  node prerender.mjs
 */

import { execSync }                                 from 'child_process';
import { existsSync, mkdirSync, readFileSync,
         writeFileSync, cpSync, rmSync }            from 'fs';
import { resolve, dirname }                         from 'path';
import { fileURLToPath }                            from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─────────────────────────────────────────────────────────────────────────────
// 1. Mock browser globals so React components render safely in Node.js
// ─────────────────────────────────────────────────────────────────────────────
const noop = () => {};

global.window = {
  scrollY: 0, scrollX: 0, innerWidth: 1280, innerHeight: 800,
  devicePixelRatio: 1,
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
  location: { pathname: '/', hash: '', search: '', origin: 'https://zilkakotab.com', href: 'https://zilkakotab.com/' },
  history: { pushState: noop, replaceState: noop, back: noop, forward: noop, go: noop, state: null, length: 1 },
  getComputedStyle: () => ({ getPropertyValue: () => '', setProperty: noop }),
  matchMedia: () => ({ matches: false, media: '', onchange: null, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop }),
  requestAnimationFrame: (fn) => setTimeout(fn, 16),
  cancelAnimationFrame: clearTimeout,
  performance: { now: () => Date.now(), mark: noop, measure: noop, getEntriesByName: () => [] },
  screen: { width: 1280, height: 800 },
  setTimeout, clearTimeout, setInterval, clearInterval,
};

const makeEl = (tag = 'div') => ({
  tagName: (tag || 'div').toUpperCase(), nodeName: (tag || 'div').toUpperCase(),
  nodeType: 1, namespaceURI: 'http://www.w3.org/1999/xhtml',
  id: '', className: '', innerHTML: '', textContent: '', innerText: '',
  style: { cssText: '', setProperty: noop, removeProperty: noop, getPropertyValue: () => '' },
  classList: { add: noop, remove: noop, contains: () => false, toggle: noop, replace: noop },
  dataset: {},
  setAttribute: noop, getAttribute: () => null, hasAttribute: () => false, removeAttribute: noop,
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
  appendChild: (c) => c, removeChild: noop, insertBefore: (n) => n, replaceChild: noop,
  querySelector: () => null, querySelectorAll: () => [],
  closest: () => null, matches: () => false,
  getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }),
  getClientRects: () => [],
  contains: () => false, hasChildNodes: () => false,
  childNodes: Object.assign([], { item: () => null }),
  children: Object.assign([], { item: () => null }),
  parentNode: null, parentElement: null, nextSibling: null, previousSibling: null,
  ownerDocument: null,
  focus: noop, blur: noop, click: noop, scrollIntoView: noop,
  cloneNode: function () { return makeEl(this.tagName); },
});

global.document = {
  createElement: (tag) => makeEl(tag),
  createElementNS: (_ns, tag) => makeEl(tag),
  createTextNode: (text) => ({ nodeType: 3, textContent: text, nodeValue: text }),
  createComment: () => ({ nodeType: 8 }),
  createDocumentFragment: () => ({ nodeType: 11, childNodes: [], appendChild: (c) => c }),
  querySelector: () => null, querySelectorAll: () => [],
  getElementById: () => null, getElementsByClassName: () => [], getElementsByTagName: () => [],
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
  documentElement: makeEl('html'),
  head: makeEl('head'),
  body: makeEl('body'),
  readyState: 'complete', title: '', cookie: '',
  implementation: { createHTMLDocument: () => global.document },
};
global.document.documentElement.ownerDocument = global.document;
global.document.head.ownerDocument = global.document;
global.document.body.ownerDocument = global.document;

const define = (key, val) =>
  Object.defineProperty(global, key, { value: val, writable: true, configurable: true });

define('navigator',             { userAgent: 'node/prerender', language: 'en-US', languages: ['en-US'], onLine: true });
define('location',              global.window.location);
define('history',               global.window.history);
define('performance',           global.window.performance);
define('matchMedia',            global.window.matchMedia);
define('requestAnimationFrame', global.window.requestAnimationFrame);
define('cancelAnimationFrame',  global.window.cancelAnimationFrame);
define('getComputedStyle',      global.window.getComputedStyle);

const def = (key, val) =>
  Object.defineProperty(global, key, { value: val, writable: true, configurable: true });

def('HTMLElement',          class HTMLElement {});
def('HTMLDivElement',       class HTMLDivElement extends global.HTMLElement {});
def('SVGElement',           class SVGElement {});
def('Element',              class Element {});
def('Event',                class Event { constructor(t, o) { this.type = t; this.bubbles = o?.bubbles ?? false; } stopPropagation() {} preventDefault() {} });
def('CustomEvent',          class CustomEvent extends global.Event { constructor(t, o) { super(t, o); this.detail = o?.detail ?? null; } });
def('IntersectionObserver', class { constructor() {} observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } });
def('ResizeObserver',       class { constructor() {} observe() {} unobserve() {} disconnect() {} });
def('MutationObserver',     class { constructor() {} observe() {} disconnect() {} takeRecords() { return []; } });
def('localStorage',         { getItem: () => null, setItem: noop, removeItem: noop, clear: noop, key: () => null, length: 0 });
def('sessionStorage',       global.localStorage);
def('crypto',               { getRandomValues: (a) => a, randomUUID: () => '00000000-0000-0000-0000-000000000000' });
def('CSS',                  { supports: () => false, escape: (s) => s });

// ─────────────────────────────────────────────────────────────────────────────
// 2. Build client bundle (CSS + JS for browser hydration)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📦  Building client bundle...');
execSync(
  'PORT=3000 BASE_PATH="/" pnpm --filter @workspace/zilka-kotab run build',
  { cwd: resolve(__dirname, '../..'), stdio: 'inherit' },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Build SSR bundle
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🔧  Building SSR bundle...');
execSync(
  'pnpm exec vite build --config vite.ssr.config.ts',
  { cwd: __dirname, stdio: 'inherit', env: { ...process.env, PORT: '3000', BASE_PATH: '/' } },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Pre-render each route
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n🖨️   Pre-rendering routes...');

// Dynamically import the just-built SSR bundle
const { render } = await import('./dist/server/entry-server.js');

const routes = [
  { path: '/',                                    out: 'index.html' },
  { path: '/about',                               out: 'about/index.html' },
  { path: '/services',                            out: 'services/index.html' },
  { path: '/team',                                out: 'team/index.html' },
  { path: '/contact',                             out: 'contact/index.html' },
  { path: '/team/kevin-zilka',                    out: 'team/kevin-zilka/index.html' },
  { path: '/team/dominic-kotab',                  out: 'team/dominic-kotab/index.html' },
  { path: '/team/jamie-rossi',                    out: 'team/jamie-rossi/index.html' },
  { path: '/team/britten-sessions',               out: 'team/britten-sessions/index.html' },
  { path: '/team/sally-billstrom-schroeder',      out: 'team/sally-billstrom-schroeder/index.html' },
];

// Read client-built index.html as the HTML shell
const template = readFileSync(resolve(__dirname, 'dist/public/index.html'), 'utf-8');

// Output directory
const outDir = resolve(__dirname, 'dist/static');
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

for (const route of routes) {
  // Update location before each render so location-aware code sees the right path
  global.window.location.pathname = route.path;
  global.location.pathname = route.path;

  const helmetContext = {};
  let appHtml = '';

  try {
    appHtml = render(route.path, helmetContext);
  } catch (err) {
    console.warn(`  ⚠  ${route.path}: render error — ${err.message}`);
  }

  // Extract Helmet-managed <title> and <meta> tags
  const helmet = helmetContext.helmet;
  const titleStr = helmet?.title?.toString()  || '';
  const metaStr  = helmet?.meta?.toString()   || '';
  const linkStr  = helmet?.link?.toString()   || '';

  let html = template
    // Inject pre-rendered body
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
    // Replace title
    .replace(/<title>[^<]*<\/title>/, titleStr || '<title>Zilka-Kotab PC</title>');

  // Inject additional head tags before </head>
  const extraHead = [metaStr, linkStr].filter(Boolean).join('\n');
  if (extraHead) html = html.replace('</head>', `${extraHead}\n</head>`);

  const outPath = resolve(outDir, route.out);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html, 'utf-8');
  console.log(`  ✓  ${route.out}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Copy static assets
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📂  Copying assets...');
cpSync(resolve(__dirname, 'dist/public/assets'), resolve(outDir, 'assets'), { recursive: true });
cpSync(resolve(__dirname, 'public/images'),      resolve(outDir, 'images'), { recursive: true });

for (const f of ['favicon.svg', 'robots.txt']) {
  const src = resolve(__dirname, 'dist/public', f);
  if (existsSync(src)) cpSync(src, resolve(outDir, f));
}
console.log('  ✓  assets/ images/ favicon.svg robots.txt');

// ─────────────────────────────────────────────────────────────────────────────
// 6. Write .htaccess for Apache/cPanel
// ─────────────────────────────────────────────────────────────────────────────
const htaccess = `# Zilka-Kotab PC — Apache / cPanel configuration
# Disable directory listings
Options -Indexes

<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Serve real files and directories as-is
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Clean URL → pre-rendered page
  RewriteRule ^about/?$                                  about/index.html   [L]
  RewriteRule ^services/?$                               services/index.html [L]
  RewriteRule ^team/?$                                   team/index.html    [L]
  RewriteRule ^contact/?$                                contact/index.html [L]
  RewriteRule ^team/kevin-zilka/?$                       team/kevin-zilka/index.html [L]
  RewriteRule ^team/dominic-kotab/?$                     team/dominic-kotab/index.html [L]
  RewriteRule ^team/jamie-rossi/?$                       team/jamie-rossi/index.html [L]
  RewriteRule ^team/britten-sessions/?$                  team/britten-sessions/index.html [L]
  RewriteRule ^team/sally-billstrom-schroeder/?$         team/sally-billstrom-schroeder/index.html [L]
</IfModule>

# Compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>

# Cache headers — long for hashed assets, short for HTML
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html                "access plus 1 hour"
  ExpiresByType text/css                 "access plus 1 year"
  ExpiresByType application/javascript   "access plus 1 year"
  ExpiresByType image/jpeg               "access plus 1 year"
  ExpiresByType image/png                "access plus 1 year"
  ExpiresByType image/webp               "access plus 1 year"
  ExpiresByType image/svg+xml            "access plus 1 year"
  ExpiresByType font/woff2               "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
`;

writeFileSync(resolve(outDir, '.htaccess'), htaccess, 'utf-8');
console.log('  ✓  .htaccess');

console.log('\n✅  Static site ready in dist/static/\n');
