/**
 * Headline reveals.
 * Every element marked data-reveal="lines" is split into its lines; each line slides up
 * from behind a clipping box when the headline scrolls into view.
 *
 * SplitText (GSAP plugin) does the splitting:
 *  - type: 'lines'      wrap each visual line in its own <div>
 *  - mask: 'lines'      put a clipping box around each line, so the text appears to rise out of nothing
 *  - autoSplit: true    split again by itself when the font finishes loading or the width changes
 *                       (line breaks move, so the old split would be wrong)
 *  - onSplit            runs after every (re)split; the animation it returns is kept in sync by SplitText
 * Screen readers: SplitText puts the full sentence in aria-label on the heading and hides the
 * pieces, so the heading is still read as one sentence.
 */
import { DUR, EASE, STAGGER } from './tokens.js';

/** All active splits, kept so they can be undone (needed when the language changes in Phase 4). */
const splits = [];

export function initTextReveals() {
  const { gsap, SplitText } = window;

  document.querySelectorAll('[data-reveal="lines"]').forEach((el) => {
    const split = SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'line',   // each line gets class "line"; its clipping box gets "line-mask" (styled in motion.css)
      autoSplit: true,
      onSplit(self) {
        gsap.set(el, { opacity: 1 }); // the CSS hid the whole heading; from here the lines do the hiding
        return gsap.from(self.lines, {
          yPercent: 110,              // start one line-height below, outside the clipping box
          duration: DUR.slow,
          ease: EASE.out,
          stagger: STAGGER,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }, // play once, when the top of the heading is 88% down the screen
        });
      },
    });
    splits.push(split);
  });
}

/**
 * Undo every split and put the plain text back.
 * Call this BEFORE changing text (language switch), then call initTextReveals() again.
 */
export function revertTextReveals() {
  splits.splice(0).forEach((split) => split.revert());
}
