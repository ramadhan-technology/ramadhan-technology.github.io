/**
 * Motion tokens for GSAP.
 * These mirror the --dur-* and --ease-* values in assets/css/tokens.css.
 * GSAP uses seconds and its own ease names, so they are repeated here. Change both together.
 *
 * GSAP in one line: gsap.to(element, { x: 100, duration: 1 }) animates CSS properties over time.
 * "expo.out" = starts fast, slows down for a long time: the same feel as --ease-out in the CSS.
 */
export const DUR = {
  base: 0.3,   // small state changes
  slow: 0.7,   // things entering the screen
  slower: 1.0, // large surfaces (images)
};

export const EASE = {
  out: 'expo.out',        // default: fast start, soft landing ("locks into place")
  inOut: 'power3.inOut',  // moving from A to B while visible
};

/** Delay between items that enter as a group, in seconds. */
export const STAGGER = 0.08;
