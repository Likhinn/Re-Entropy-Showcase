const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const jobs = new WeakMap();

// Decode-style reveal: characters resolve left to right out of random letters.
export function scramble(el, text, { delay = 0, dur = 650 } = {}) {
  cancelAnimationFrame(jobs.get(el));
  if (calm) { el.textContent = text; return; }
  const t0 = performance.now() + delay;
  el.textContent = '';
  const tick = (t) => {
    const k = (t - t0) / dur;
    if (k >= 1) { el.textContent = text; return; }
    if (k > 0) {
      const done = Math.floor(k * text.length);
      const shown = Math.min(text.length, done + Math.ceil(text.length * 0.5 * Math.min(1, k * 3)));
      let s = text.slice(0, done);
      for (let i = done; i < shown; i++) s += /\w/.test(text[i]) ? ABC[(Math.random() * 26) | 0] : text[i];
      el.textContent = s;
    }
    jobs.set(el, requestAnimationFrame(tick));
  };
  jobs.set(el, requestAnimationFrame(tick));
}
