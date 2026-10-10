/**
 * Shared motion presets.
 *
 * Forty-odd screens already animate, each with its own hand-written durations and
 * easings, so the same gesture looked slightly different depending where you were.
 * These are the house settings: import them instead of inventing numbers.
 *
 * The timings are deliberately short. This is a counter tool -- an operator moves
 * through it all day with a customer waiting -- so motion is there to show what
 * changed, never to be admired. Anything above ~250ms starts to feel like latency.
 */

/** Page-level easing: quick out of the gate, gentle landing. */
export const EASE = [0.22, 1, 0.36, 1];

export const DURATION = {
  fast: 0.15,
  base: 0.22,
  slow: 0.32,
};

/** A page arriving: fades up a few pixels, no further. */
export const pageEnter = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.base, ease: EASE },
};

/** A parent that deals its children in one at a time. */
export const stagger = (step = 0.035, delay = 0) => ({
  initial: {},
  animate: {
    transition: { staggerChildren: step, delayChildren: delay },
  },
});

/** The child of a stagger: the same small rise as a page. */
export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.base, ease: EASE },
  },
};

/** Something appearing in place -- a panel, a result, a row of totals. */
export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DURATION.fast, ease: EASE },
};

/** A section opening or closing, measured rather than guessed. */
export const collapse = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: DURATION.base, ease: EASE },
};

/**
 * Strip the movement out of a variant while keeping the fade, for operators who
 * have asked their system not to animate. Returns the variant unchanged otherwise,
 * so call sites stay a single expression.
 */
export const respectReducedMotion = (variant, reduced) => {
  if (!reduced) return variant;

  return {
    ...variant,
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: DURATION.fast },
  };
};
