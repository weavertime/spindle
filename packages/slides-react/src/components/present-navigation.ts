// Pure navigation/fade scheduler for PresentMode, extracted so its timing logic
// is testable without a DOM. It holds the "slide we're heading toward" and
// decides when to arm the single fade-commit timer.
//
// The regression this guards against: the commit timer must NOT be reset on
// every keypress. A held arrow key repeats faster than the fade duration, so
// resetting the timer each time keeps it from ever firing — the deck freezes on
// a faded-out (blank) slide until the key is released. Instead we advance the
// target synchronously and leave an already-armed timer to fire on schedule, so
// a held key steps forward every fade interval and always commits the latest
// target.

export interface FadeNavState {
  /** The slide index we're heading toward (advanced synchronously per press). */
  pending: number;
  /** Whether a commit timer is currently armed. */
  timerArmed: boolean;
}

export interface FadeNavStep {
  state: FadeNavState;
  /** Caller should turn the fade on. */
  fade: boolean;
  /** Caller should arm a fresh commit timer (only when one isn't already armed). */
  arm: boolean;
}

/** Clamp a requested index into [0, length). */
export function clampIndex(target: number, length: number): number {
  return Math.max(0, Math.min(length - 1, target));
}

/**
 * Handle a navigation request toward `target`. Advances the pending index and
 * decides whether to fade and whether to arm the commit timer. A request to the
 * slide we're already heading to is a no-op.
 */
export function requestGo(state: FadeNavState, target: number, length: number): FadeNavStep {
  const next = clampIndex(target, length);
  if (next === state.pending) {
    return { state, fade: false, arm: false };
  }
  // Never reset an already-armed timer (see the freeze regression above).
  const arm = !state.timerArmed;
  return { state: { pending: next, timerArmed: true }, fade: true, arm };
}

/** The commit timer fired: return the index to commit and clear the armed flag. */
export function commitGo(state: FadeNavState): { state: FadeNavState; commit: number } {
  return { state: { pending: state.pending, timerArmed: false }, commit: state.pending };
}
