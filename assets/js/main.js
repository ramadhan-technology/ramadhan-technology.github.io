/**
 * Entry point. Loaded as an ES module from index.html (no build step).
 *
 * What runs when:
 *   - everyone:                 the floating WhatsApp button behaviour
 *   - motion allowed:           the WebGL hero (does not need GSAP; falls back to the static SVG by itself)
 *   - motion allowed + GSAP ok: text reveals, scroll reveals, section choreography,
 *                               magnetic buttons, smooth scroll (desktop)
 *   - reduced motion, or GSAP missing, or any error: nothing is animated and
 *     every element is simply visible.
 */
import { initTextReveals } from './motion/text.js';
import { initReveals } from './motion/reveal.js';
import { initSections } from './motion/sections.js';
import { initFab, initMagnetic, initHeader } from './motion/micro.js';
import { initSmoothScroll } from './motion/smooth-scroll.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const librariesLoaded = Boolean(window.gsap && window.ScrollTrigger && window.SplitText);

/** Removes the "js" class, which un-hides everything motion.css was holding back. */
function showEverything() {
  root.classList.remove('js');
}

initFab();
initHeader();

// Work page only: filter pills and screenshot dots (loaded on demand).
if (document.querySelector('.project-grid')) {
  import('./work.js').then(({ initWork }) => initWork()).catch((error) => console.warn('Work page extras not started:', error));
}

// The WebGL hero runs on its own: it does not wait for fonts or depend on GSAP.
// Setting WebGL up (compiling the shaders) is one solid block of work, so it is scheduled for a
// moment when the browser is idle: the page becomes readable and tappable first, the picture follows.
if (!reducedMotion) {
  // The WebGL code is downloaded only on pages that have a hero picture (import() loads a file on demand).
  const startHero = () => {
    if (!document.querySelector('.hero__visual')) return;
    import('./webgl/hero.js')
      .then(({ initHero }) => initHero())
      .then((controller) => (window.__hero = controller)) // kept on window only so it can be inspected while testing
      .catch((error) => {
        console.error('Hero failed to start; showing the static picture.', error);
        document.querySelector('.hero__visual')?.classList.add('is-fallback');
      });
  };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(startHero, { timeout: 1500 }); // "when idle, but within 1.5 s at the latest"
  } else {
    setTimeout(startHero, 200);                        // Safari has no requestIdleCallback
  }
}

if (reducedMotion || !librariesLoaded) {
  showEverything();
} else {
  try {
    const { gsap, ScrollTrigger, SplitText } = window;
    gsap.registerPlugin(ScrollTrigger, SplitText);

    // The mobile address bar hides and shows while scrolling, which changes the window height.
    // Without this, every such change would make ScrollTrigger recalculate and animations could jump.
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Split text only after the web fonts are in: line breaks depend on the real font.
    await document.fonts.ready;

    initTextReveals();
    initReveals();
    initSections();
    initMagnetic();
    window.__motionReady = true; // tells the safety timer in <head> that all is well

    initSmoothScroll().catch((error) => console.warn('Smooth scroll not started:', error));
  } catch (error) {
    console.error('Motion failed to start; showing the static page.', error);
    showEverything();
  }
}
