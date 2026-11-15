/**
 * Choreography that belongs to one section only.
 *
 * "scrub" = the animation is tied to the scroll position instead of to time:
 * scroll down and it moves forward, scroll up and it runs backwards.
 */

export function initSections() {
  initProblem();
  initProcess();
}

/**
 * MASALAH: the four pain lines start at four different widths, weights and indents
 * (see .problem__item--a..d in sections.css). While the visitor scrolls through the list
 * they move to one shared width, weight and left edge, and brighten: manual becomes system.
 *
 * The values are CSS variables, so GSAP animates plain numbers and the CSS turns them into
 * font-stretch / font-weight / padding. Changing a font's width re-flows the text, which is
 * more work for the phone than a transform; that is why it is used on these four lines only.
 */
function initProblem() {
  const { gsap } = window;
  const list = document.querySelector('.problem__list');
  if (!list) return;

  gsap.to(list.querySelectorAll('.problem__item'), {
    '--w': 100,
    '--wt': 400,
    '--indent': 0,
    color: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim(),
    ease: 'none',          // linear: the scroll itself provides the pacing
    stagger: 0.12,         // top line settles first, the last line last
    scrollTrigger: {
      trigger: list,
      start: 'top 78%',    // begins when the top of the list is 78% down the screen
      end: 'bottom 55%',   // done when the bottom of the list reaches 55%
      scrub: 0.4,          // 0.4 s of smoothing so it does not feel mechanical
    },
  });
}

/**
 * PROSES: an orange line draws itself along the steps as the visitor scrolls, and each
 * square marker turns orange when the line reaches it.
 * Phone: the line runs down the left side. Desktop: along the top of the row.
 * No pinning and no sideways scrolling: the page scrolls normally the whole time.
 *
 * gsap.matchMedia() runs the right setup for the current screen width and cleans up
 * by itself when the width crosses the breakpoint.
 */
function initProcess() {
  const { gsap, ScrollTrigger } = window;
  const list = document.querySelector('.steps');
  if (!list) return;
  const steps = [...list.querySelectorAll('.step')];

  const build = (start, end) => {
    ScrollTrigger.create({
      trigger: list,
      start,
      end,
      scrub: true,
      onUpdate(self) {
        list.style.setProperty('--progress', self.progress.toFixed(4)); // read by .steps::before in motion.css
        // step i is "done" once the line has passed its share of the length
        steps.forEach((step, i) => step.classList.toggle('is-done', self.progress > i / steps.length + 0.02));
      },
    });
  };

  const mm = gsap.matchMedia();
  mm.add('(max-width: 59.99rem)', () => build('top 65%', 'bottom 65%')); // phone: line tip stays 65% down the screen
  mm.add('(min-width: 60rem)', () => build('top 80%', 'top 35%'));       // desktop: drawn while the row crosses the screen
}
