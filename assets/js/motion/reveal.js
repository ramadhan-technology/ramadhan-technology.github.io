/**
 * Scroll reveals for everything that is not a headline.
 * Elements are marked in the HTML with data-reveal:
 *
 *   snap   the site's signature move: the element starts loose (lower, slightly tilted)
 *          and locks straight into the grid. Used for cards, steps, reasons.
 *   fade   quiet version for supporting text: a short rise, no tilt.
 *   wipe   for images: the picture is uncovered from left to right.
 *
 * Three different moves on purpose, so the page is not "fade-up on everything".
 *
 * ScrollTrigger.batch() groups elements that enter the screen at the same moment and hands
 * them over together, so a row of cards can be staggered one after another.
 */
import { DUR, EASE, STAGGER } from './tokens.js';

export function initReveals() {
  const { gsap, ScrollTrigger } = window;

  // ---- snap ----
  const snaps = gsap.utils.toArray('[data-reveal="snap"]');
  // (the length checks below: not every page has every kind of element, and GSAP warns about empty lists)
  if (snaps.length) gsap.set(snaps, {
    y: 32,
    rotation: (i) => (i % 2 ? 2 : -2), // alternate the tilt so neighbours do not move as one block
    transformOrigin: '0% 100%',
  });
  ScrollTrigger.batch(snaps, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        rotation: 0,
        duration: DUR.slow,
        ease: EASE.out,
        stagger: STAGGER,
        clearProps: 'transform', // remove the inline transform afterwards, so CSS (hover etc.) is in charge again
      }),
  });

  // ---- fade ----
  const fades = gsap.utils.toArray('[data-reveal="fade"]');
  if (fades.length) gsap.set(fades, { y: 16 });
  ScrollTrigger.batch(fades, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: DUR.slow, ease: EASE.out, stagger: STAGGER / 2, clearProps: 'transform' }),
  });

  // ---- wipe ----
  gsap.utils.toArray('[data-reveal="wipe"]').forEach((el) => {
    gsap.to(el, {
      clipPath: 'inset(0 0% 0 0)', // from "clipped 100% from the right" (set in motion.css) to fully open
      duration: DUR.slower,
      ease: EASE.inOut,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}
