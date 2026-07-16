import { requestGo, commitGo, clampIndex, type FadeNavState } from './present-navigation';

const fresh = (pending = 0): FadeNavState => ({ pending, timerArmed: false });

describe('present-navigation scheduler', () => {
  it('clamps requested indices into range', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(10, 5)).toBe(4);
    expect(clampIndex(2, 5)).toBe(2);
  });

  it('arms the timer and fades on the first request', () => {
    const step = requestGo(fresh(0), 1, 5);
    expect(step.fade).toBe(true);
    expect(step.arm).toBe(true);
    expect(step.state.pending).toBe(1);
    expect(step.state.timerArmed).toBe(true);
  });

  it('is a no-op when already heading to the target', () => {
    const state: FadeNavState = { pending: 3, timerArmed: true };
    const step = requestGo(state, 3, 5);
    expect(step.fade).toBe(false);
    expect(step.arm).toBe(false);
    expect(step.state).toBe(state);
  });

  it('does NOT re-arm the timer while one is already pending (held-key freeze regression)', () => {
    // Simulate a held ArrowRight repeating faster than the fade: every press
    // advances the target but must never arm a second timer, so the single
    // armed timer is free to fire.
    let state = fresh(0);
    let arms = 0;
    for (let press = 1; press <= 5; press++) {
      const step = requestGo(state, state.pending + 1, 100);
      state = step.state;
      if (step.arm) arms++;
    }
    expect(state.pending).toBe(5); // target advanced with every press
    expect(arms).toBe(1); // exactly one timer was armed across the whole burst
    expect(state.timerArmed).toBe(true);
  });

  it('commits the LATEST pending target when the timer fires, then disarms', () => {
    // First press arms the timer at target 1; three more presses arrive before
    // it fires, advancing the target to 4.
    let state = requestGo(fresh(0), 1, 100).state;
    state = requestGo(state, 2, 100).state;
    state = requestGo(state, 3, 100).state;
    state = requestGo(state, 4, 100).state;

    const done = commitGo(state);
    expect(done.commit).toBe(4); // lands on the newest target, not the first (1)
    expect(done.state.timerArmed).toBe(false);

    // A press after the commit arms a fresh timer again.
    const after = requestGo(done.state, 5, 100);
    expect(after.arm).toBe(true);
  });

  it('a single press commits exactly that slide', () => {
    const step = requestGo(fresh(0), 1, 5);
    const done = commitGo(step.state);
    expect(done.commit).toBe(1);
  });
});
