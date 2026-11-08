/** Must match IDLE_MINUTES in api/src/modules/auth/session.service.ts. */
export const IDLE_MINUTES = 30;
const IDLE_MS = IDLE_MINUTES * 60_000;
/** While the user is active, the server session is refreshed at most this often. */
const PING_EVERY_MS = 5 * 60_000;
const CHECK_EVERY_MS = 20_000;
const EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

/**
 * Logs the user out after 30 minutes without mouse/keyboard/touch activity.
 * The server enforces the same limit (sliding cookie); this side keeps the server session
 * alive while the user is active without making requests, and logs out on time with a notice.
 * Activity is shared between tabs through localStorage, so another open tab counts too.
 * Browser only; returns a stop function.
 */
export function watchIdle(key: 'admin' | 'customer', opts: { ping: () => Promise<unknown>; timeout: () => void }): () => void {
  const storeKey = `pipeox:activity:${key}`;
  const read = () => {
    try {
      return Number(localStorage.getItem(storeKey)) || 0;
    } catch {
      return 0;
    }
  };
  let last = Date.now();
  let lastWrite = 0;
  let lastPing = Date.now();

  const onActivity = () => {
    const now = Date.now();
    last = now;
    if (now - lastWrite > 5_000) {
      lastWrite = now;
      try {
        localStorage.setItem(storeKey, String(now));
      } catch {
        /* private mode: this tab still tracks itself */
      }
    }
  };
  onActivity();

  const check = () => {
    const now = Date.now();
    const lastActive = Math.max(last, read());
    if (now - lastActive >= IDLE_MS) {
      stop();
      opts.timeout();
    } else if (lastActive > lastPing && now - lastPing >= PING_EVERY_MS) {
      lastPing = now;
      opts.ping().catch(() => {});
    }
  };

  EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
  const timer = setInterval(check, CHECK_EVERY_MS);
  // Coming back to a sleeping tab: check right away instead of waiting for the next tick
  const onVisible = () => document.visibilityState === 'visible' && check();
  document.addEventListener('visibilitychange', onVisible);

  function stop() {
    clearInterval(timer);
    EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
    document.removeEventListener('visibilitychange', onVisible);
  }
  return stop;
}
