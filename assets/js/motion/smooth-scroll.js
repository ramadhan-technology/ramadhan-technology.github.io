/**
 * Smooth scrolling with Lenis, on mouse/trackpad devices only.
 *
 * Why not on phones: touch scrolling is already smooth and driven by the finger. Lenis leaves
 * touch alone by default, so loading it there would cost data for nothing.
 *
 * What Lenis does on desktop: a mouse wheel moves the page in steps; Lenis turns those steps
 * into one continuous glide. The page still scrolls natively (position: sticky keeps working).
 *
 * One clock for everything: Lenis is driven by GSAP's ticker (GSAP's frame loop), and tells
 * ScrollTrigger about every scroll change, so scroll animations and scrolling never drift apart.
 */
export async function initSmoothScroll() {
  const { gsap, ScrollTrigger } = window;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  // Loaded on demand: phones never download these two files.
  const { default: Lenis } = await import('../../vendor/lenis.mjs');
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('../../vendor/lenis.css', import.meta.url).href; // path relative to this file, so it works from a subfolder
  document.head.append(css);

  const lenis = new Lenis({
    lerp: 0.12,     // 0 to 1: how quickly the page catches up with the wheel. Higher = snappier, lower = floatier
    anchors: true,  // let in-page links (#kerja) scroll smoothly too
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000)); // GSAP counts seconds, Lenis wants milliseconds
  gsap.ticker.lagSmoothing(0);                        // do not "catch up" after a stall; keeps scroll and animation in step

  return lenis;
}
