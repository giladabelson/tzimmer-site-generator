// Motion is an enhancement. Nothing here is required to read the page.
//
// Scroll storytelling is driven by scrollcraft (MIT, vendored in
// src/vendor/scrollcraft). It replaced the GSAP + ScrollTrigger reveal layer:
// it is dependency-free, does the same job in every browser without the
// CSS-scroll-timeline/GSAP split, and carrying two animation engines for one
// job was the single biggest avoidable weight on the page.
import '../vendor/scrollcraft/scrollcraft.mech.css';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

async function start() {
  // The engine mounts under reduced motion too — it degrades the devices itself
  // (opacity survives, translation is dropped, a rail becomes a scroll region)
  // rather than leaving the page half-built.
  await import('../vendor/scrollcraft/scrollcraft.js');
  if (window.ScrollCraft) window.ScrollCraft.mount(document.body);

  if (reduce.matches) return;

  // Smooth scroll (Lenis, MIT). Loaded after paint so it never blocks first render.
  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
  const raf = (t) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
  window.__lenis = lenis;

  // Lenis owns the scroll position from here on, so a link that arrived with a
  // #hash has to be re-honoured — otherwise it snaps back to the top.
  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) lenis.scrollTo(target, { immediate: true, offset: -12 });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -12 });
  });
}

if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1500 });
else window.addEventListener('load', start);
