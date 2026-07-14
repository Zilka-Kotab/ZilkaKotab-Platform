// ─── PROGRESSIVE ENHANCEMENT: mark JS as available ───
// Must run first so .js-enabled CSS gates apply before paint
document.documentElement.classList.add('js-enabled');

// ─── MOBILE MENU ───
(function () {
  const btn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const iconOpen = document.getElementById('icon-menu');
  const iconClose = document.getElementById('icon-close');
  if (!btn || !menu) return;

  function openMenu() {
    menu.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (iconOpen)  iconOpen.style.display  = 'none';
    if (iconClose) iconClose.style.display = 'block';
    btn.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    menu.classList.remove('open');
    document.body.style.overflow = '';
    if (iconOpen)  iconOpen.style.display  = 'block';
    if (iconClose) iconClose.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', () => {
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
})();

// ─── FADE-IN ON SCROLL ───
(function () {
  const els = document.querySelectorAll('.fade-in');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const delay = e.target.dataset.delay || 0;
        setTimeout(() => e.target.classList.add('visible'), parseFloat(delay) * 1000);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
})();

// ─── ANIMATED COUNTERS ───
(function () {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el) {
    const target = parseInt(el.dataset.counter, 10);
    const duration = 1600;
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const val = Math.round(easeOut(progress) * target);
      el.textContent = val.toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(step);
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(el => obs.observe(el));
})();

// ─── FOOTER YEAR ───
(function () {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
})();

// ─── YEARS IN BUSINESS ───
(function () {
  const el = document.getElementById('years-counter');
  if (el) el.dataset.counter = String(new Date().getFullYear() - 2000);
})();

// ─── ACTIVE NAV LINK ───
// Uses resolved absolute href so relative paths work correctly
(function () {
  const links = document.querySelectorAll('.nav-links a, .mobile-menu a[href]');
  const currentPath = window.location.pathname
    .replace(/\/index\.html$/, '/')
    .replace(/([^/])$/, '$1/'); // ensure trailing slash for comparison

  links.forEach(a => {
    try {
      const linkPath = new URL(a.href).pathname
        .replace(/\/index\.html$/, '/')
        .replace(/([^/])$/, '$1/');
      const isCurrent = linkPath === currentPath;
      const isParent  = linkPath !== '/' && currentPath.startsWith(linkPath);
      if (isCurrent || isParent) a.classList.add('active');
    } catch (e) { /* external links: skip */ }
  });
})();
