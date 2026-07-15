const root = document.documentElement;
const ROUTE_KEY = 'yiyuzhou-route-direction';
const reduceRouteMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEAVE_DURATION = reduceRouteMotion ? 80 : 1080;
let routeLocked = false;
let arrivalPayload = null;
let cosmos = null;
let preloadState = { status: 'idle', target: null, startedAt: 0, resources: 0 };
const hintedResources = new Set();

try {
  const stored = sessionStorage.getItem(ROUTE_KEY);
  if (stored) {
    try { arrivalPayload = JSON.parse(stored); }
    catch (_error) { arrivalPayload = stored === 'right' ? { direction: 'right', seed: Date.now() } : null; }
  }
  sessionStorage.removeItem(ROUTE_KEY);
} catch (_error) {
  arrivalPayload = null;
}

const arriving = arrivalPayload?.direction === 'right';
if (arriving) root.classList.add('yx-route-arriving');

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function normalizedPath(url) {
  const pathname = url.pathname.replace(/index\.html$/, '').replace(/\/$/, '') || '/';
  return `${url.origin}${pathname}${url.search}`;
}

function isSameView(url) {
  return normalizedPath(url) === normalizedPath(new URL(window.location.href));
}

function createCosmosLayer() {
  const element = document.createElement('div');
  element.className = 'yx-route-cosmos';
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `
    <canvas class="yx-route-cosmos-canvas"></canvas>
    <div class="yx-route-cosmos-title"><span>YI · COSMOS</span><i></i></div>`;
  document.body.append(element);

  const canvas = element.querySelector('canvas');
  const context = canvas.getContext('2d');
  let frame = 0;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let streaks = [];
  let dust = [];
  let startTime = 0;
  let phaseOffset = 0;
  let activeSeed = 0;

  function buildScene(seed) {
    const random = mulberry32(seed >>> 0);
    const streakCount = Math.max(20, Math.min(38, Math.round(width / 46)));
    streaks = Array.from({ length: streakCount }, (_, index) => {
      const bright = index % 8 === 0 || random() > .88;
      const alpha = bright ? .48 + random() * .42 : .045 + Math.pow(random(), 2.2) * .34;
      return {
        y: 20 + random() * Math.max(40, height - 40),
        speed: (bright ? 370 : 190) + random() * (bright ? 430 : 320),
        length: (bright ? 115 : 28) + random() * (bright ? 210 : 145),
        alpha,
        width: bright ? .72 + random() * .7 : .28 + random() * .58,
        phase: random(),
        flicker: random() * Math.PI * 2,
      };
    });
    dust = Array.from({ length: Math.max(34, Math.round(width / 25)) }, () => ({
      x: random() * width,
      y: random() * height,
      speed: 6 + random() * 22,
      radius: .18 + random() * .65,
      alpha: .06 + random() * .28,
      phase: random() * Math.PI * 2,
    }));
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (activeSeed) buildScene(activeSeed);
  }

  function draw(time) {
    const elapsed = Math.max(0, time - startTime + phaseOffset) / 1000;
    context.clearRect(0, 0, width, height);

    for (const star of dust) {
      const x = ((star.x - elapsed * star.speed) % (width + 20) + width + 20) % (width + 20) - 10;
      const pulse = .7 + Math.sin(elapsed * 1.4 + star.phase) * .3;
      context.beginPath();
      context.fillStyle = `rgba(244,246,243,${star.alpha * pulse})`;
      context.arc(x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }

    for (const streak of streaks) {
      const span = width + streak.length + 380;
      const phase = streak.phase * span;
      const headX = width + 190 - ((elapsed * streak.speed + phase) % span);
      const shimmer = .82 + Math.sin(elapsed * 4.5 + streak.flicker) * .18;
      const alpha = streak.alpha * shimmer;
      const gradient = context.createLinearGradient(headX, streak.y, headX + streak.length, streak.y);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(.045, `rgba(243,246,243,${alpha * .88})`);
      gradient.addColorStop(.28, `rgba(224,230,227,${alpha * .34})`);
      gradient.addColorStop(1, 'rgba(210,220,216,0)');
      context.beginPath();
      context.strokeStyle = gradient;
      context.lineWidth = streak.width;
      context.moveTo(headX, streak.y);
      context.lineTo(headX + streak.length, streak.y);
      context.stroke();

      if (alpha > .32) {
        context.save();
        context.shadowColor = `rgba(255,255,255,${alpha})`;
        context.shadowBlur = 7;
        context.beginPath();
        context.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + .14)})`;
        context.arc(headX, streak.y, Math.max(.55, streak.width * .82), 0, Math.PI * 2);
        context.fill();
        context.restore();
      }
    }
    if (!reduceRouteMotion) frame = requestAnimationFrame(draw);
  }

  function start(seed, offset = 0) {
    cancelAnimationFrame(frame);
    activeSeed = Number(seed) || Date.now();
    phaseOffset = offset;
    resize();
    startTime = performance.now();
    if (!reduceRouteMotion) frame = requestAnimationFrame(draw);
    else draw(startTime);
    element.classList.add('is-active');
  }

  function reveal() {
    element.classList.remove('is-active');
    window.setTimeout(() => cancelAnimationFrame(frame), 760);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  return { element, start, reveal };
}

function createStarCursor() {
  if (!window.matchMedia('(pointer: fine)').matches) return null;
  const cursor = document.createElement('div');
  cursor.className = 'yx-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = '<i class="yx-cursor-core"></i>';
  document.body.append(cursor);

  const interactiveSelector = [
    'a[href]', 'button:not(:disabled)', 'input:not(:disabled)', 'textarea:not(:disabled)',
    'select:not(:disabled)', 'label', '[role="button"]', '[tabindex]:not([tabindex="-1"])',
    '#universe', '.hex-star-label', '.node-label', '.focus-yao', '.timeline-scale', '.home-hero', '.yx-page-home .yx-site-header',
  ].join(',');

  document.addEventListener('pointermove', (event) => {
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.add('is-visible');
    cursor.classList.toggle('is-interactive', Boolean(event.target.closest(interactiveSelector)));
  }, { passive: true });
  document.addEventListener('pointerdown', () => cursor.classList.add('is-pressed'), { passive: true });
  document.addEventListener('pointerup', () => cursor.classList.remove('is-pressed'), { passive: true });
  document.addEventListener('pointercancel', () => cursor.classList.remove('is-pressed'), { passive: true });
  document.documentElement.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  return cursor;
}

function addResourceHint(url, kind) {
  if (hintedResources.has(url)) return;
  hintedResources.add(url);
  const link = document.createElement('link');
  link.href = url;
  if (kind === 'module') {
    link.rel = 'modulepreload';
  } else {
    link.rel = 'preload';
    link.as = kind;
  }
  document.head.append(link);
  preloadState.resources += 1;
}

function routeDataUrls(target) {
  const path = target.pathname.replace(/index\.html$/, '');
  if (path.endsWith('/star-map/')) {
    return [
      new URL('../data/zhouyi-integrated-v2.json?v=20260713-white-hexagrams-v1', target).href,
      new URL('../data/semantic-layout.json?v=20260713-white-hexagrams-v1', target).href,
    ];
  }
  if (path.endsWith('/divination/')) {
    return [new URL('../data/zhouyi-integrated-v2.json?v=20260713-v2', target).href];
  }
  if (path.endsWith('/life-history/')) {
    return [new URL('./data/life-history-v2.json?v=life-history-galaxy-v6-pivot-20260714', target).href];
  }
  return [];
}

async function preloadTarget(target) {
  preloadState = {
    status: 'loading',
    target: target.href,
    startedAt: performance.now(),
    resources: 0,
  };
  root.dataset.yxPreloading = target.pathname;

  const dataRequests = routeDataUrls(target).map((url) => fetch(url, {
    cache: 'force-cache', credentials: 'same-origin',
  }).catch(() => null));

  try {
    const response = await fetch(target.href, { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const declaredBase = parsed.querySelector('base[href]')?.getAttribute('href');
    const resourceBase = declaredBase ? new URL(declaredBase, target) : target;

    parsed.querySelectorAll('link[rel~="stylesheet"][href]').forEach((node) => {
      addResourceHint(new URL(node.getAttribute('href'), resourceBase).href, 'style');
    });
    parsed.querySelectorAll('script[src]').forEach((node) => {
      const kind = node.type === 'module' ? 'module' : 'script';
      addResourceHint(new URL(node.getAttribute('src'), resourceBase).href, kind);
    });
    await Promise.allSettled(dataRequests);
    preloadState.status = 'ready';
  } catch (_error) {
    await Promise.allSettled(dataRequests);
    preloadState.status = 'partial';
  }
}

function transitionTo(anchor) {
  if (routeLocked) return;
  const target = new URL(anchor.href, window.location.href);
  if (!['http:', 'https:', 'file:'].includes(target.protocol)) return;
  if (target.origin !== window.location.origin && target.protocol !== 'file:') return;
  if (isSameView(target)) return;

  routeLocked = true;
  void preloadTarget(target);
  const seed = Math.floor(Math.random() * 0xFFFFFFFF);
  const payload = { direction: 'right', seed, startedAt: Date.now() };
  try { sessionStorage.setItem(ROUTE_KEY, JSON.stringify(payload)); } catch (_error) { /* file previews may block storage */ }
  root.classList.add('yx-route-leaving');
  cosmos?.start(seed, 0);
  window.setTimeout(() => window.location.assign(target.href), LEAVE_DURATION);
}

document.addEventListener('DOMContentLoaded', () => {
  cosmos = createCosmosLayer();
  createStarCursor();
  if (arriving) {
    const elapsedSinceDeparture = Math.max(LEAVE_DURATION, Date.now() - Number(arrivalPayload.startedAt || Date.now()));
    cosmos.start(arrivalPayload.seed, elapsedSinceDeparture);
    window.setTimeout(() => root.classList.remove('yx-route-arriving'), reduceRouteMotion ? 0 : 90);
    window.setTimeout(() => cosmos.reveal(), reduceRouteMotion ? 20 : 430);
  }

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const target = new URL(anchor.href, window.location.href);
    if (!['http:', 'https:', 'file:'].includes(target.protocol)) return;
    if (target.origin !== window.location.origin && target.protocol !== 'file:') return;
    if (target.hash && isSameView(target)) return;
    if (isSameView(target)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    transitionTo(anchor);
  });
});

window.__yxShell = {
  get preloadState() { return { ...preloadState }; },
  get routeLocked() { return routeLocked; },
};
