/**
 * Micro-interactions: small feedback on things the visitor touches or points at.
 */

/**
 * The floating WhatsApp button (phones) steps aside while another WhatsApp button
 * is already on screen, so there are never two competing buttons and it never covers one.
 * Works with or without GSAP, and for reduced-motion visitors too (it then just appears/disappears).
 *
 * IntersectionObserver tells us when an element enters or leaves the screen,
 * without listening to every scroll event.
 */
export function initFab() {
  const fab = document.querySelector('.fab');
  const others = document.querySelectorAll('.cta'); // only the Contact page's closing WhatsApp block now
  if (!fab || !others.length || !('IntersectionObserver' in window)) return;

  const visible = new Set();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
    fab.classList.toggle('is-hidden', visible.size > 0);
  });
  others.forEach((el) => observer.observe(el));
}

/**
 * Magnetic buttons (mouse only): the button leans a little towards the pointer and
 * springs back when the pointer leaves. Not essential, so touch devices skip it.
 *
 * gsap.quickTo() makes a fast function for a value that changes many times per second.
 */
export function initMagnetic() {
  const { gsap } = window;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('.btn').forEach((btn) => {
    const moveX = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
    const moveY = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
    const STRENGTH = 0.25; // how far it follows: 25% of the pointer's distance from the button centre

    btn.addEventListener('pointermove', (event) => {
      const box = btn.getBoundingClientRect();
      moveX((event.clientX - (box.left + box.width / 2)) * STRENGTH);
      moveY((event.clientY - (box.top + box.height / 2)) * STRENGTH);
    });
    btn.addEventListener('pointerleave', () => {
      moveX(0);
      moveY(0);
    });
  });
}

/**
 * Partially persistent header: it slides up out of view while the visitor scrolls down
 * (more room to read), and slides back on any scroll up (the menu is there when wanted).
 * Pattern recommended by Nielsen Norman Group for long pages, with a 300-400 ms slide.
 * Stays visible near the top of the page and while the phone menu is open.
 * Works with native scrolling and with Lenis (both move window.scrollY).
 */
export function initHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  const menu = header.querySelector('.menu');
  let lastY = window.scrollY;
  let ticking = false;
  const TOLERANCE = 6; // ignore tiny jitters (e.g. the phone address bar resizing)

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    const delta = y - lastY;
    if (Math.abs(delta) < TOLERANCE) return;
    const nearTop = y < header.offsetHeight * 2;
    const menuOpen = menu && menu.open;
    header.classList.toggle('is-hidden', delta > 0 && !nearTop && !menuOpen);
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  // Keyboard users: if focus moves into the header (Tab), always show it.
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));
}
