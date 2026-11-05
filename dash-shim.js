(() => {
  const SOURCES = {
    boomerang: 'data/boomerang.json',
    experimente: 'data/experimente.json',
    branchendaten: 'data/branchendaten.json',
    kadenz: 'data/kadenz.json',
    quellen: 'data/quellen.json',
  };
  const store = {};
  const calcs = [];
  const draws = new Map();
  const widths = new WeakMap();
  Object.keys(SOURCES).forEach((id) => { store[id] = { status: 'loading', data: [] }; });

  const evalCalcs = () => {
    calcs.forEach(({ id, inputs, fn }) => {
      const ins = inputs.map((i) => store[i] || { status: 'missing', data: [] });
      if (ins.every((s) => s.status === 'ok')) {
        try {
          store[id] = { status: 'ok', data: fn(...ins.map((s) => s.data)) };
        } catch (e) {
          console.error('calc', id, e);
          store[id] = { status: 'error', data: [] };
        }
      } else if (ins.some((s) => s.status === 'error')) {
        store[id] = { status: 'error', data: [] };
      } else {
        store[id] = { status: 'loading', data: [] };
      }
    });
  };

  const runOne = (name, el) => {
    const fn = draws.get(name);
    if (!fn) return;
    try { fn(el); } catch (e) { console.error('draw', name, e); }
    widths.set(el, el.clientWidth);
  };
  const runAll = () => {
    evalCalcs();
    draws.forEach((fn, name) => document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => runOne(name, el)));
  };

  const ro = new ResizeObserver((entries) => {
    entries.forEach((en) => {
      const el = en.target;
      if (Math.abs((widths.get(el) || 0) - el.clientWidth) < 1) return;
      cancelAnimationFrame(el.__wpFrame);
      el.__wpFrame = requestAnimationFrame(() => runOne(el.dataset.draw, el));
    });
  });

  window.dash = {
    data: (id) => store[id] || { status: 'missing', data: [] },
    calc: (id, c) => { calcs.push({ id, inputs: c.inputs, fn: c.fn }); store[id] = { status: 'loading', data: [] }; },
    draw: (name, fn) => {
      if (typeof fn === 'function') draws.set(name, fn);
      else document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => runOne(name, el));
    },
    setLink: (id) => { try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ } },
    onData: () => {},
    colors: ['#6c67e4', '#2a8aff', '#22a872', '#fc7070'],
  };

  const start = () => {
    runAll();
    document.querySelectorAll('.viz[data-draw]').forEach((el) => ro.observe(el));
    const ids = Object.keys(SOURCES);
    let done = 0;
    ids.forEach((id) => {
      fetch(SOURCES[id], { cache: 'no-cache' })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((rows) => { store[id] = { status: 'ok', data: rows }; })
        .catch((e) => { console.error('data', id, e); store[id] = { status: 'error', data: [] }; })
        .finally(() => { done += 1; if (done === ids.length) runAll(); });
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0));
  else setTimeout(start, 0);
})();
