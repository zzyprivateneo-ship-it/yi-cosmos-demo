(function () {
  "use strict";

  /* 防止重复初始化 */
  if (window.__YX_HOME__ && window.__YX_HOME__.getState) return;

  /* ============================================================
     诊断状态对象
     ============================================================ */
  const state = {
    initialized: false,
    canvasAvailable: false,
    width: 0,
    height: 0,
    pixelRatio: 1,
    starCount: 0,
    reducedMotion: false,
    animationRunning: false,
    scrollY: 0,
    enteringPortals: false
  };

  let canvas = null;
  let context = null;
  let stars = [];
  let rafId = 0;
  let enterRaf = 0;
  let pointerX = 0;
  let pointerY = 0;
  let scrollCamera = 0;
  let disposed = false;
  let motionQuery = null;

  function getState() {
    return {
      initialized: state.initialized,
      canvasAvailable: state.canvasAvailable,
      width: state.width,
      height: state.height,
      pixelRatio: state.pixelRatio,
      starCount: state.starCount,
      reducedMotion: state.reducedMotion,
      animationRunning: state.animationRunning,
      scrollY: state.scrollY,
      enteringPortals: state.enteringPortals
    };
  }

  window.__YX_HOME__ = { getState };

  function hasReducedMotion() {
    if (!window.matchMedia) return false;
    motionQuery = motionQuery || window.matchMedia("(prefers-reduced-motion: reduce)");
    return Boolean(motionQuery.matches);
  }

  /* ============================================================
     星空动画 —— 直接采用参考项目实现
     ============================================================ */

  function randomStar(index) {
    const bright = index % 17 === 0;
    return {
      x: Math.random(),
      y: Math.random(),
      radius: bright ? .75 + Math.random() * 1.1 : .18 + Math.random() * .72,
      alpha: bright ? .55 + Math.random() * .4 : .12 + Math.random() * .42,
      phase: Math.random() * Math.PI * 2,
      depth: .18 + Math.random() * .82,
    };
  }

  function resize() {
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.round(window.innerWidth || document.documentElement.clientWidth || 1));
    const height = Math.max(1, Math.round(window.innerHeight || document.documentElement.clientHeight || 1));
    state.width = width;
    state.height = height;
    state.pixelRatio = ratio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scrollCamera = window.scrollY || window.pageYOffset || 0;
    state.scrollY = scrollCamera;
    const count = Math.max(120, Math.round((state.width * state.height) / 7600));
    stars = Array.from({ length: count }, (_, index) => randomStar(index));
    state.starCount = stars.length;
    render(0);
  }

  function render(time) {
    if (!context) return;
    const width = state.width;
    const height = state.height;
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    const driftX = state.reducedMotion ? 0 : time * .00000046;
    const driftY = state.reducedMotion ? 0 : time * .00000013;
    for (const star of stars) {
      const x = ((star.x + driftX * star.depth) % 1) * width + pointerX * star.depth;
      const rawY = (star.y + driftY * star.depth) * height + pointerY * star.depth - scrollCamera * (.08 + star.depth * .12);
      const y = ((rawY % (height + 36)) + height + 36) % (height + 36) - 18;
      const pulse = state.reducedMotion ? 1 : .78 + Math.sin(time * .0007 + star.phase) * .22;
      context.beginPath();
      context.fillStyle = 'rgba(244,246,243,' + star.alpha * pulse + ')';
      context.arc(x, y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  function animate(time) {
    if (disposed || state.reducedMotion) {
      state.animationRunning = false;
      rafId = 0;
      return;
    }
    render(time);
    rafId = window.requestAnimationFrame ? window.requestAnimationFrame(animate) : 0;
    state.animationRunning = Boolean(rafId);
  }

  function startAnimation() {
    if (state.reducedMotion || !window.requestAnimationFrame || rafId || !context) {
      state.animationRunning = false;
      return;
    }
    rafId = window.requestAnimationFrame(animate);
    state.animationRunning = true;
  }

  function stopAnimation() {
    if (rafId && window.cancelAnimationFrame) window.cancelAnimationFrame(rafId);
    rafId = 0;
    state.animationRunning = false;
  }

  /* ============================================================
     指针视差 & 滚动
     ============================================================ */

  function onPointerMove(event) {
    if (state.reducedMotion) return;
    pointerX = (event.clientX / Math.max(state.width, 1) - .5) * -28;
    pointerY = (event.clientY / Math.max(state.height, 1) - .5) * -18;
  }

  function onScroll() {
    scrollCamera = window.scrollY || window.pageYOffset || 0;
    state.scrollY = scrollCamera;
    if (state.reducedMotion) render(performance.now ? performance.now() : Date.now());
  }

  function onResize() {
    state.reducedMotion = hasReducedMotion();
    resize();
    if (state.reducedMotion) stopAnimation();
    else startAnimation();
  }

  /* ============================================================
     平滑滚动至 portals —— 采用参考项目实现
     ============================================================ */

  let entryScrollFrame = 0;

  function enterPortals(event) {
    if (event) event.preventDefault();
    const portals = document.querySelector('#portals');
    if (!portals || entryScrollFrame) return;

    const targetY = window.scrollY + portals.getBoundingClientRect().top;
    if (state.reducedMotion) {
      window.scrollTo(0, targetY);
      return;
    }

    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 1800;
    const startedAt = performance.now ? performance.now() : Date.now();
    root.style.scrollBehavior = 'auto';
    state.enteringPortals = true;

    const step = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = progress < .5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      window.scrollTo(0, startY + distance * eased);

      if (progress < 1 && state.enteringPortals) {
        entryScrollFrame = requestAnimationFrame(step);
      } else {
        window.scrollTo(0, targetY);
        root.style.scrollBehavior = previousScrollBehavior;
        state.enteringPortals = false;
        entryScrollFrame = 0;
      }
    };

    entryScrollFrame = requestAnimationFrame(step);
  }

  function onHeroClick(event) {
    if (event.defaultPrevented || state.enteringPortals) return;
    const hero = document.querySelector('.home-hero');
    if (!hero) return;
    if (event.target.closest('a,button,input,textarea,select,[role="button"],[tabindex]:not([tabindex="-1"])')) return;
    const heroBounds = hero.getBoundingClientRect();
    const isInsideUpperPage = event.clientY >= heroBounds.top && event.clientY <= heroBounds.bottom;
    if (isInsideUpperPage) enterPortals(event);
  }

  /* ============================================================
     __YI_QUALITY__ 诊断接口集成
     ============================================================ */

  function extendQuality() {
    if (!window.__YI_QUALITY__) return;
    const baseRead = window.__YI_QUALITY__.read;
    window.__YI_QUALITY__.read = function () {
      const base = baseRead ? baseRead() : {};
      return Object.assign(base, {
        page: "home",
        canvasAvailable: state.canvasAvailable,
        animationRunning: state.animationRunning,
        starCount: state.starCount,
        reducedMotion: state.reducedMotion
      });
    };
  }

  /* ============================================================
     路由状态恢复（route-state.js 集成）
     与 route-state.js 的 createHistoryState 格式保持兼容，
     使首页历史状态在路由系统中可被正确识别。
     ============================================================ */

  function initRouteState() {
    try {
      if (history.replaceState) {
        history.replaceState({
          namespace: "yi-cosmos",
          version: "1.0.0",
          route: "home",
          signature: "home",
          source: "user"
        }, "", window.location.href);
      }
    } catch (error) {
      /* 路由状态设置失败时静默降级 */
    }
  }

  /* ============================================================
     事件绑定 —— 含 visibilitychange 暂停/恢复、
     prefers-reduced-motion 运行时检测
     ============================================================ */

  function bindEvents() {
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener('click', onHeroClick);

    const cue = document.querySelector('.scroll-cue');
    if (cue) cue.addEventListener('click', enterPortals);

    /* 页面卸载时清理 */
    window.addEventListener('pagehide', cleanup, { once: true });

    /* visibilitychange 暂停/恢复动画 */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAnimation();
      else if (!state.reducedMotion) startAnimation();
    });

    /* prefers-reduced-motion 运行时检测 */
    if (window.matchMedia) {
      motionQuery = motionQuery || window.matchMedia("(prefers-reduced-motion: reduce)");
      if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', function (e) {
          state.reducedMotion = e.matches;
          if (e.matches) stopAnimation();
          else startAnimation();
        });
      } else if (motionQuery.addListener) {
        motionQuery.addListener(function (e) {
          state.reducedMotion = e.matches;
          if (e.matches) stopAnimation();
          else startAnimation();
        });
      }
    }
  }

  /* ============================================================
     清理
     ============================================================ */

  function cleanup() {
    disposed = true;
    stopAnimation();
    if (entryScrollFrame && window.cancelAnimationFrame) window.cancelAnimationFrame(entryScrollFrame);
    entryScrollFrame = 0;
    state.enteringPortals = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('click', onHeroClick);
  }

  /* ============================================================
     初始化
     ============================================================ */

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    state.reducedMotion = hasReducedMotion();
    scrollCamera = window.scrollY || window.pageYOffset || 0;
    state.scrollY = scrollCamera;
    canvas = document.getElementById("home-sky");
    if (canvas && canvas.getContext) {
      try {
        context = canvas.getContext("2d", { alpha: false });
      } catch (error) {
        context = null;
      }
    }
    state.canvasAvailable = Boolean(canvas && context);
    if (state.canvasAvailable) {
      resize();
      startAnimation();
    }
    bindEvents();
    extendQuality();
    initRouteState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
