const BJ = { lila: '#6c67e4', blau: '#2a8aff', gruen: '#22a872', coral: '#fc7070' };
const NF = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const NI = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const BAD = new Set(['error', 'connect', 'declined', 'missing']);

const mehrAls = (r) => String(r.einheit || '').includes('mehr als');
const fmt = (v, f) => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  switch (f) {
    case 'pct': return NF.format(n) + ' %';
    case 'plus': return '+' + NF.format(n) + ' %';
    case 'neg': return '−' + NF.format(Math.abs(n)) + ' %';
    case 'x': return NF.format(n) + '×';
    case 'mal': return NF.format(n) + '-mal';
    case 'pp': return NF.format(n) + ' Prozentpunkte';
    case 'num': return new Intl.NumberFormat('de-DE').format(n);
    case 'int': return NI.format(n);
    case 'dec': return NF.format(n);
    default: return String(v);
  }
};

const h = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
};

const pick = (rows, where) => {
  if (!where) return rows[0];
  const conds = where.split('&').map((p) => p.split('=').map(decodeURIComponent));
  return rows.find((r) => conds.every(([k, v]) => String(r[k]) === v));
};

const need = (el, ids) => {
  const ds = ids.map((id) => dash.data(id));
  if (ds.some((d) => BAD.has(d.status))) {
    el.classList.remove('dash-skeleton');
    el.replaceChildren(h('div', 'fail', 'Daten nicht geladen'));
    return null;
  }
  if (ds.some((d) => d.status !== 'ok')) {
    el.replaceChildren();
    el.classList.add('dash-skeleton');
    return null;
  }
  el.classList.remove('dash-skeleton');
  el.replaceChildren();
  return ds.map((d) => d.data);
};

const byId = (rows, id) => rows.find((r) => r.id === id);
const topic = (rows, t) => rows.filter((r) => r.thema === t).map((r) => ({ ...r, wert: Number(r.wert), x: r.x === null ? null : Number(r.x) }));

const svgIn = (el, w, hgt, label) => d3.select(el).append('svg')
  .attr('viewBox', `0 0 ${w} ${hgt}`)
  .attr('width', '100%')
  .attr('role', 'img')
  .attr('aria-label', label);

const textW = (svg, str, cls) => {
  const t = svg.append('text').attr('class', cls || null).text(str);
  const w = t.node().getComputedTextLength();
  t.remove();
  return w;
};

const makeTip = (el) => {
  const t = h('div', 'wp-tip');
  t.setAttribute('aria-hidden', 'true');
  el.append(t);
  return {
    show(ev, title, value) {
      t.replaceChildren(h('div', 'tt', title), h('div', 'tv', value));
      t.classList.add('on');
      const r = el.getBoundingClientRect();
      let x = ev.clientX - r.left + 14;
      let y = ev.clientY - r.top + 14;
      if (x + t.offsetWidth > r.width) x = ev.clientX - r.left - t.offsetWidth - 14;
      if (y + t.offsetHeight > r.height) y = ev.clientY - r.top - t.offsetHeight - 14;
      t.style.left = Math.max(0, x) + 'px';
      t.style.top = Math.max(0, y) + 'px';
    },
    hide() { t.classList.remove('on'); },
  };
};

const anchorFit = (cx, w, W) => {
  if (cx - w / 2 < 0) return { x: 0, a: 'start' };
  if (cx + w / 2 > W) return { x: W, a: 'end' };
  return { x: cx, a: 'middle' };
};

dash.calc('rogers_faktor', {
  inputs: ['experimente'],
  title: 'Knappe vs. ausführliche Mail',
  description: 'Antwortquote der knappen Mail geteilt durch die der ausführlichen, auf eine Nachkommastelle gerundet.',
  fn: (experimente) => {
    const kurz = Number(experimente.find((r) => r.id === 'rogers_kurz').wert);
    const lang = Number(experimente.find((r) => r.id === 'rogers_lang').wert);
    return [{ kennzahl: 'faktor', wert: Math.round((kurz / lang) * 10) / 10 }];
  },
});

dash.calc('sweetspot', {
  inputs: ['boomerang'],
  title: 'Sweet Spot der Mail-Länge',
  description: 'Kleinste und größte Wortzahl, bei der die Antwortquote mindestens 50 % erreicht.',
  fn: (boomerang) => {
    const w = boomerang.filter((r) => r.thema === 'laenge' && Number(r.wert) >= 50).map((r) => Number(r.x));
    return [{ kennzahl: 'von', wert: Math.min(...w) }, { kennzahl: 'bis', wert: Math.max(...w) }];
  },
});

dash.calc('betreff_best', {
  inputs: ['boomerang'],
  title: 'Beste Betreff-Länge',
  description: 'Wortzahlen im Betreff mit der höchsten Antwortquote.',
  fn: (boomerang) => {
    const b = boomerang.filter((r) => r.thema === 'betreff');
    const top = Math.max(...b.map((r) => Number(r.wert)));
    const w = b.filter((r) => Number(r.wert) === top).map((r) => Number(r.x));
    return [{ kennzahl: 'von', wert: Math.min(...w) }, { kennzahl: 'bis', wert: Math.max(...w) }];
  },
});

dash.calc('absender_diff', {
  inputs: ['experimente'],
  title: 'Vorsprung vertrauter Absender',
  description: 'Rücklauf bei vertrautem minus Rücklauf bei unbekanntem Absender, in Prozentpunkten.',
  fn: (experimente) => {
    const a = Number(experimente.find((r) => r.id === 'absender_bekannt').wert);
    const b = Number(experimente.find((r) => r.id === 'absender_unbekannt').wert);
    return [{ kennzahl: 'diff', wert: Math.round((a - b) * 10) / 10 }];
  },
});

dash.draw('val', (el) => {
  const d = dash.data(el.dataset.source);
  const row = d.status === 'ok' && Array.isArray(d.data) ? pick(d.data, el.dataset.where) : null;
  el.textContent = row ? fmt(row[el.dataset.field || 'wert'], el.dataset.fmt) : '—';
});

dash.draw('duell', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const ds = ['rogers_lang', 'rogers_kurz'].map((id) => byId(got[0], id)).filter(Boolean);
  const max = d3.max(ds, (d) => Number(d.wert));
  const widths = [96, 88, 93, 72, 90, 84, 95, 66, 91, 80, 94, 70, 89, 58];
  const wrap = h('div', 'duel');
  ds.forEach((d) => {
    const hero = d.id === 'rogers_kurz';
    const card = h('div', 'duel-mail' + (hero ? ' is-hero' : ''));
    const head = h('div', 'duel-head');
    head.append(h('span'), h('span'), h('span'), h('em', null, fmt(d.x, 'int') + ' Wörter'));
    const lines = h('div', 'duel-lines');
    const n = Math.max(2, Math.round(Number(d.x) / 9));
    for (let k = 0; k < n; k++) {
      const l = h('i', 'gx');
      l.style.width = widths[k % widths.length] + '%';
      l.style.setProperty('--d', (k * 0.04).toFixed(2) + 's');
      lines.append(l);
    }
    const bar = h('div', 'duel-bar');
    const fill = h('i', 'gx');
    fill.style.width = (Number(d.wert) / max) * 100 + '%';
    fill.style.setProperty('--d', '.6s');
    bar.append(fill);
    card.append(head, lines, h('div', 'duel-label', d.label), h('div', 'duel-big', fmt(d.wert, 'pct')), h('div', 'duel-cap', 'Antwortquote'), bar);
    wrap.append(card);
  });
  el.append(wrap);
});

dash.draw('kurve', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const rows = topic(got[0], 'laenge').sort((a, b) => a.x - b.x);
  const W = Math.max(280, el.clientWidth || 560);
  const H = 270;
  const svg = svgIn(el, W, H, 'Antwortquote nach Wortzahl der Mail');
  const yl = textW(svg, '55 %');
  const m = { t: 34, r: 22, b: 44, l: yl + 12 };
  const x = d3.scaleLog([d3.min(rows, (d) => d.x) * 0.82, d3.max(rows, (d) => d.x) * 1.12], [m.l, W - m.r]);
  const lo = Math.floor((d3.min(rows, (d) => d.wert) - 4) / 5) * 5;
  const hi = Math.ceil((d3.max(rows, (d) => d.wert) + 3) / 5) * 5;
  const y = d3.scaleLinear([lo, hi], [H - m.b, m.t]);
  const g = svg.append('g').attr('class', 'grid');
  y.ticks(4).forEach((t) => {
    g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t));
    svg.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(NI.format(t) + ' %');
  });
  const sweet = rows.filter((d) => d.wert >= 50);
  if (sweet.length) {
    const x0 = x(sweet[0].x) - 10;
    const x1 = x(sweet[sweet.length - 1].x) + 10;
    svg.append('rect').attr('class', 'fade').attr('x', x0).attr('y', m.t - 6).attr('width', x1 - x0).attr('height', H - m.b - m.t + 6).attr('rx', 10).attr('fill', BJ.lila).attr('fill-opacity', 0.12).style('--d', '.2s');
    svg.append('text').attr('class', 't-strong fade').attr('x', (x0 + x1) / 2).attr('y', m.t - 12).attr('text-anchor', 'middle').text('Sweet Spot').style('--d', '.9s');
  }
  const solid = rows.filter((d) => !d.ca);
  const ln = d3.line().x((d) => x(d.x)).y((d) => y(d.wert));
  svg.append('path').attr('class', 'line').attr('pathLength', 1).attr('d', ln(solid)).attr('fill', 'none').attr('stroke', BJ.lila).attr('stroke-width', 2.5).attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round');
  const approx = rows.filter((d) => d.ca);
  if (approx.length && solid.length) {
    svg.append('path').attr('class', 'fade').attr('d', ln([solid[solid.length - 1], ...approx])).attr('fill', 'none').attr('stroke', BJ.lila).attr('stroke-width', 2).attr('stroke-dasharray', '5 5').style('--d', '1.4s');
  }
  const tip = makeTip(el);
  rows.forEach((d, i) => {
    const inSweet = d.wert >= 50;
    svg.append('circle').attr('class', 'pop').style('--d', (0.25 + i * 0.09).toFixed(2) + 's')
      .attr('cx', x(d.x)).attr('cy', y(d.wert)).attr('r', inSweet ? 5.5 : 4.5)
      .attr('fill', inSweet ? BJ.lila : 'var(--color-panel)').attr('stroke', inSweet ? 'var(--color-panel)' : BJ.lila)
      .attr('stroke-width', 2).attr('stroke-dasharray', d.ca ? '2 2' : null);
    svg.append('circle').attr('cx', x(d.x)).attr('cy', y(d.wert)).attr('r', 16).attr('fill', 'transparent')
      .on('pointermove', (ev) => tip.show(ev, fmt(d.x, 'int') + ' Wörter', (d.ca ? 'ca. ' : '') + fmt(d.wert, 'pct') + ' Antworten'))
      .on('pointerleave', () => tip.hide());
  });
  const peak = rows.reduce((a, b) => (b.wert > a.wert ? b : a), rows[0]);
  [rows[0], peak, rows[rows.length - 1]].forEach((d) => {
    const label = (d.ca ? 'ca. ' : '') + fmt(d.wert, 'pct');
    const w = textW(svg, label, 't-strong');
    const p = anchorFit(x(d.x), w, W);
    svg.append('text').attr('class', 't-strong fade').style('--d', '1.2s').attr('x', p.x).attr('y', y(d.wert) - 12).attr('text-anchor', p.a).text(label);
  });
  const ticks = rows.map((d) => d.x).filter((v) => [10, 25, 50, 100, 200, 500].includes(v));
  const ax = svg.append('g').attr('class', 'axis');
  ax.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b);
  let lastRight = -Infinity;
  ticks.forEach((t) => {
    const s = NI.format(t);
    const w = textW(svg, s);
    if (x(t) - w / 2 < lastRight + 6) return;
    svg.append('text').attr('x', x(t)).attr('y', H - m.b + 18).attr('text-anchor', 'middle').text(s);
    lastRight = x(t) + w / 2;
  });
  svg.append('text').attr('x', W - m.r).attr('y', H - 4).attr('text-anchor', 'end').text('Wörter in der Mail (logarithmische Achse)');
});

const columns = (el, rows, opt) => {
  const W = Math.max(260, el.clientWidth || 360);
  const H = opt.H || 220;
  const svg = svgIn(el, W, H, opt.aria);
  const m = { t: 26, r: 4, b: opt.axisTitle ? 52 : 34, l: 4 };
  const x = d3.scaleBand(rows.map((d) => d.key), [m.l, W - m.r]).padding(0.28);
  const max = d3.max(rows, (d) => d.wert);
  const y = d3.scaleLinear([0, max * 1.12], [H - m.b, m.t]);
  const tip = makeTip(el);
  rows.forEach((d, i) => {
    const top = d.wert === max;
    const bw = Math.min(x.bandwidth(), 56);
    const bx = x(d.key) + (x.bandwidth() - bw) / 2;
    svg.append('rect').attr('class', 'gy').style('--d', (i * 0.07).toFixed(2) + 's')
      .attr('x', bx).attr('width', bw).attr('y', y(d.wert)).attr('height', y(0) - y(d.wert)).attr('rx', 6)
      .attr('fill', top ? BJ.lila : 'var(--cds-chart-muted)');
    if (opt.labelIf(d, top)) {
      svg.append('text').attr('class', (top ? 't-strong' : '') + ' fade').style('--d', '.8s')
        .attr('x', x(d.key) + x.bandwidth() / 2).attr('y', y(d.wert) - 7).attr('text-anchor', 'middle').text(fmt(d.wert, 'pct'));
    }
    const lw = textW(svg, d.short);
    const p = anchorFit(x(d.key) + x.bandwidth() / 2, lw, W);
    svg.append('text').attr('class', top ? 't-strong' : null).attr('x', p.x).attr('y', H - m.b + 18).attr('text-anchor', p.a).text(d.short);
    svg.append('rect').attr('x', x(d.key)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.b - m.t).attr('fill', 'transparent')
      .on('pointermove', (ev) => tip.show(ev, d.long, fmt(d.wert, 'pct') + ' Antworten'))
      .on('pointerleave', () => tip.hide());
  });
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'var(--cds-chart-axis)');
  if (opt.axisTitle) svg.append('text').attr('x', W / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(opt.axisTitle);
};

dash.draw('lesestufe', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const rows = topic(got[0], 'lesestufe').sort((a, b) => a.x - b.x).map((d) => ({ ...d, key: d.id, short: d.label, long: 'Leseniveau: ' + d.label }));
  columns(el, rows, { aria: 'Antwortquote nach Leseniveau', labelIf: () => true });
});

dash.draw('betreff', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const rows = topic(got[0], 'betreff').sort((a, b) => a.x - b.x).map((d) => ({ ...d, key: d.id, short: NI.format(d.x), long: d.x === 0 ? 'Ohne Betreff' : d.label + ' im Betreff' }));
  columns(el, rows, { aria: 'Antwortquote nach Wörtern im Betreff', axisTitle: 'Wörter im Betreff', labelIf: (d, top) => top || d.x === 0 });
});

const hbars = (rows, o) => {
  const max = o.max || d3.max(rows, (d) => Math.abs(d.wert));
  const wrap = h('div', 'hb');
  rows.forEach((d, i) => {
    const row = h('div', 'hb-row ' + (o.cls ? o.cls(d, i) : ''));
    const lab = h('div', 'hb-label', d.label);
    if (o.sub) {
      const s = o.sub(d);
      if (s) lab.append(h('small', null, s));
    }
    const val = h('div', 'hb-val', o.fmt(d));
    const track = h('div', 'hb-track' + (d.wert < 0 ? ' neg' : ''));
    const fill = h('i', d.wert < 0 ? 'gxr' : 'gx');
    fill.style.width = (Math.abs(d.wert) / max) * 100 + '%';
    fill.style.setProperty('--d', (0.15 + i * 0.12).toFixed(2) + 's');
    track.append(fill);
    row.append(lab, val, track);
    if (o.tag) {
      const t = o.tag(d);
      if (t) row.append(h('span', 'hb-tag', t));
    }
    wrap.append(row);
  });
  return wrap;
};

dash.draw('fragen', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const rows = topic(got[0], 'fragen');
  el.append(hbars(rows, { cls: (d, i) => (i === 0 ? 'accent' : ''), fmt: (d) => fmt(d.wert, 'plus'), sub: () => 'mehr Antworten' }));
});

const devPlot = (el, rows, base, accent, aria) => {
  rows.sort((a, b) => b.wert - a.wert);
  const W = Math.max(280, el.clientWidth || 420);
  const rowH = 40;
  const top = 30;
  const H = top + rows.length * rowH + 6;
  const svg = svgIn(el, W, H, aria);
  const lw = Math.min(W * 0.42, d3.max(rows, (d) => Math.max(textW(svg, d.label, 't-strong'), d.de && d.de !== d.label ? textW(svg, d.de) : 0)) + 12);
  const vw = textW(svg, '00,0 %', 't-strong') + 16;
  const x = d3.scaleLinear([Math.min(base, d3.min(rows, (d) => d.wert)) - 2, d3.max(rows, (d) => d.wert) + 1], [lw + 8, W - vw]);
  svg.append('line').attr('x1', x(base)).attr('x2', x(base)).attr('y1', top - 6).attr('y2', H).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 4');
  const bl = 'Ø ' + fmt(base, 'pct');
  const p = anchorFit(x(base), textW(svg, bl), W);
  svg.append('text').attr('x', p.x).attr('y', top - 12).attr('text-anchor', p.a).text(bl);
  const tip = makeTip(el);
  rows.forEach((d, i) => {
    const cy = top + i * rowH + rowH / 2;
    const on = accent(d);
    const col = on ? BJ.lila : 'var(--cds-chart-muted)';
    const gloss = d.de && d.de !== d.label;
    svg.append('text').attr('class', 't-strong').attr('x', 0).attr('y', gloss ? cy - 2 : cy + 4).text(d.label);
    if (gloss) svg.append('text').attr('x', 0).attr('y', cy + 13).attr('font-size', 11).text(d.de);
    svg.append('line').attr('class', 'gx').style('--d', (i * 0.06).toFixed(2) + 's').attr('x1', x(base)).attr('x2', x(d.wert)).attr('y1', cy).attr('y2', cy).attr('stroke', col).attr('stroke-width', 3).attr('stroke-linecap', 'round');
    svg.append('circle').attr('class', 'pop').style('--d', (0.4 + i * 0.06).toFixed(2) + 's').attr('cx', x(d.wert)).attr('cy', cy).attr('r', 7).attr('fill', col).attr('stroke', 'var(--color-panel)').attr('stroke-width', 2);
    svg.append('text').attr('class', (on ? 't-strong ' : '') + 'fade').style('--d', '.9s').attr('x', x(d.wert) + 12).attr('y', cy + 4).text(fmt(d.wert, 'pct'));
    svg.append('rect').attr('x', 0).attr('width', W).attr('y', cy - rowH / 2).attr('height', rowH).attr('fill', 'transparent')
      .on('pointermove', (ev) => tip.show(ev, d.label + (gloss ? ' (' + d.de + ')' : ''), fmt(d.wert, 'pct') + ' Antworten · ' + bl))
      .on('pointerleave', () => tip.hide());
  });
};

dash.draw('anrede', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const rows = topic(got[0], 'anrede');
  const base = Number(byId(got[0], 'anrede_basis').wert);
  const max = d3.max(rows, (d) => d.wert);
  devPlot(el, rows, base, (d) => d.wert === max, 'Antwortquote nach Anrede');
});

dash.draw('abschluss', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const rows = topic(got[0], 'abschluss');
  const base = Number(byId(got[0], 'abschluss_basis').wert);
  devPlot(el, rows, base, (d) => /thank/i.test(d.label), 'Antwortquote nach Abschlussformel');
});

dash.draw('weil', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const rows = ['langer_ohne', 'langer_schein', 'langer_echt'].map((id) => byId(got[0], id)).filter(Boolean);
  const wrap = h('div', 'rings');
  rows.forEach((d, i) => {
    const v = Number(d.wert);
    const col = d.id === 'langer_ohne' ? 'var(--cds-chart-muted)' : BJ.lila;
    const box = h('div', 'ring');
    const svg = d3.select(box).append('svg').attr('viewBox', '0 0 120 120').attr('aria-hidden', 'true');
    svg.append('circle').attr('class', 'ring-bg').attr('cx', 60).attr('cy', 60).attr('r', 48).attr('stroke-width', 12);
    svg.append('circle').attr('class', 'ring-fg ringa').attr('cx', 60).attr('cy', 60).attr('r', 48).attr('stroke-width', 12)
      .attr('stroke', col).attr('pathLength', 100).attr('stroke-dasharray', `${v} 100`).attr('transform', 'rotate(-90 60 60)')
      .style('--len', v).style('--d', (0.1 + i * 0.2).toFixed(2) + 's');
    svg.append('text').attr('class', 't-big').attr('x', 60).attr('y', 67).attr('text-anchor', 'middle').attr('font-size', 22).text(fmt(v, 'pct'));
    box.append(h('div', 'rl', d.label), h('div', 'rq', '„' + d.beispiel + '“'));
    wrap.append(box);
  });
  el.append(wrap);
});

dash.draw('dank', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const rows = ['dank_ohne', 'dank_mit'].map((id) => byId(got[0], id)).filter(Boolean);
  const wrap = h('div', 'waffles');
  rows.forEach((d) => {
    const filled = Math.round(Number(d.wert));
    const w = h('div', 'waffle ' + (d.id === 'dank_mit' ? 'on' : 'off'));
    w.append(h('div', 'waffle-big', fmt(d.wert, 'pct')), h('div', 'waffle-lab', d.label));
    const grid = h('div', 'waffle-grid');
    grid.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < 100; k++) {
      const c = h('i', k < filled ? 'f pop' : 'pop');
      c.style.setProperty('--d', (k * 0.008).toFixed(3) + 's');
      grid.append(c);
    }
    w.append(grid);
    wrap.append(w);
  });
  el.append(wrap);
});

const picto = (el, rows, o) => {
  const wrap = h('div', 'pic');
  if (o.big) wrap.append(h('div', 'pic-big', o.big));
  rows.forEach((d, ri) => {
    const row = h('div', 'pic-row ' + o.cls(d));
    const lab = h('div', 'pic-lab', d.label);
    lab.append(h('small', null, o.val(d)));
    const dots = h('div', 'pic-dots');
    dots.setAttribute('aria-hidden', 'true');
    const n = Math.round(Number(d.wert));
    for (let k = 0; k < n; k++) {
      const c = h('i', 'pop');
      if (o.size) { c.style.width = o.size + 'px'; c.style.height = o.size + 'px'; }
      c.style.setProperty('--d', (ri * 0.2 + k * 0.03).toFixed(2) + 's');
      dots.append(c);
    }
    row.append(lab, dots);
    wrap.append(row);
  });
  el.append(wrap);
};

dash.draw('kanal', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const rows = ['kanal_mail', 'kanal_persoenlich'].map((id) => byId(got[0], id)).filter(Boolean);
  const p = byId(got[0], 'kanal_persoenlich');
  picto(el, rows, { big: fmt(p.wert, 'x'), cls: (d) => (d.id === 'kanal_mail' ? 'muted' : ''), val: (d) => fmt(d.wert, 'x') });
});

dash.draw('byaf', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const rows = topic(got[0], 'byaf');
  el.append(hbars(rows, {
    cls: (d) => (d.id === 'byaf_alle' ? 'accent' : ''),
    fmt: (d) => 'g = ' + fmt(d.wert, 'dec'),
    tag: (d) => (d.id === 'byaf_sauber' ? 'Kein nachweisbarer Effekt' : null),
  }));
});

dash.draw('absender', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const rows = topic(got[0], 'absender');
  el.append(hbars(rows, { max: 100, cls: (d) => (d.id === 'absender_bekannt' ? 'good' : ''), fmt: (d) => fmt(d.wert, 'pct') }));
});

dash.draw('design', (el) => {
  const got = need(el, ['branchendaten']);
  if (!got) return;
  const rows = topic(got[0], 'design');
  el.append(hbars(rows, { cls: () => 'bad', fmt: (d) => fmt(d.wert, 'neg') }));
});

const toneFmt = (d) => {
  if (Number(d.wert) === 0) return (d.ca ? '≈ ' : '') + '±0 %';
  return (d.ca ? 'bis zu +' : '+') + NF.format(Number(d.wert)) + ' %';
};

dash.draw('ton', (el) => {
  const got = need(el, ['boomerang']);
  if (!got) return;
  const segs = topic(got[0], 'emotion').sort((a, b) => a.x - b.x);
  const best = segs.reduce((a, b) => (b.wert > a.wert ? b : a), segs[0]);
  const W = Math.max(280, el.clientWidth || 420);
  const R = Math.max(70, Math.min(W / 2 - 40, 120));
  const cy = R + 56;
  const H = cy + 44;
  const cx = W / 2;
  const wrap = h('div', 'gauge-wrap');
  el.append(wrap);
  const svg = d3.select(wrap).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', 'Antwortquote nach Ton der Mail');
  const step = Math.PI / segs.length;
  const arc = d3.arc().innerRadius(R - 22).outerRadius(R).cornerRadius(5).padAngle(0.03);
  const arcs = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  segs.forEach((d, i) => {
    const a0 = -Math.PI / 2 + i * step;
    const on = d === best;
    arcs.append('path').attr('class', 'pop').style('--d', (i * 0.15).toFixed(2) + 's')
      .attr('d', arc({ startAngle: a0, endAngle: a0 + step })).attr('fill', on ? BJ.lila : 'var(--cds-chart-muted)').attr('fill-opacity', on ? 1 : 0.55);
    const mid = a0 + step / 2;
    if (on) {
      svg.append('text').attr('class', 't-strong fade').attr('x', cx + Math.sin(mid) * (R + 26)).attr('y', cy - Math.cos(mid) * (R + 26) - 14).attr('text-anchor', 'middle').text(d.label);
      svg.append('text').attr('class', 't-big fade').attr('font-size', 18).attr('x', cx + Math.sin(mid) * (R + 26)).attr('y', cy - Math.cos(mid) * (R + 26) + 6).attr('text-anchor', 'middle').text(toneFmt(d));
    } else {
      const ex = cx + Math.sin(mid > 0 ? Math.PI / 2 : -Math.PI / 2) * (R - 11);
      const t1 = d.label;
      const t2 = toneFmt(d);
      const pa = anchorFit(ex, Math.max(textW(svg, t1, 't-strong'), textW(svg, t2)), W);
      svg.append('text').attr('class', 't-strong').attr('x', pa.x).attr('y', cy + 22).attr('text-anchor', pa.a).text(t1);
      svg.append('text').attr('x', pa.x).attr('y', cy + 38).attr('text-anchor', pa.a).text(t2);
    }
  });
  const bi = segs.indexOf(best);
  const ang = -Math.PI / 2 + bi * step + step / 2;
  svg.append('line').attr('class', 'fade').style('--d', '.6s').attr('x1', cx).attr('y1', cy).attr('x2', cx + Math.sin(ang) * (R - 36)).attr('y2', cy - Math.cos(ang) * (R - 36))
    .attr('stroke', 'var(--color-fg)').attr('stroke-width', 4).attr('stroke-linecap', 'round');
  svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 8).attr('fill', 'var(--color-fg)');
  const mein = topic(got[0], 'meinung');
  wrap.append(hbars(mein, { max: 100, cls: (d) => (d.id === 'meinung_mit' ? 'accent' : ''), fmt: (d) => fmt(d.wert, 'pct'), sub: () => 'Antwortquote' }));
});

dash.draw('smalltalk', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const rows = topic(got[0], 'smalltalk');
  const f = byId(got[0], 'smalltalk_faktor');
  const fx = (d) => (mehrAls(d) ? 'mehr als ' : '') + fmt(d.wert, 'x');
  picto(el, rows, { big: fx(f), size: 30, cls: (d) => (d.id === 'smalltalk_faktor' ? 'bad' : 'muted'), val: (d) => (d.id === 'smalltalk_faktor' ? fx(d) + ' so oft gescheitert' : 'Maßstab') });
});

dash.draw('personal', (el) => {
  const got = need(el, ['branchendaten', 'experimente']);
  if (!got) return;
  const rows = [...topic(got[0], 'personalisierung'), ...topic(got[1], 'personalisierung')];
  el.append(hbars(rows, {
    cls: (d, i) => (i === 0 ? 'accent' : ''),
    fmt: (d) => fmt(d.wert, 'plus'),
    sub: (d) => (String(d.einheit).includes('Öffnungsrate') ? 'höhere Öffnungsrate' : 'mehr Antworten'),
  }));
});

dash.draw('antwortzeit', (el) => {
  const got = need(el, ['experimente']);
  if (!got) return;
  const often = byId(got[0], 'kooti_haeufig');
  const half = byId(got[0], 'kooti_haelfte');
  const toMin = (d) => Number(d.wert) * (/Stunde/.test(d.einheit) ? 60 : 1);
  const W = Math.max(280, el.clientWidth || 700);
  const H = 150;
  const svg = svgIn(el, W, H, 'Zeit bis zur Antwort auf eine Mail');
  const m = { l: 6, r: 6 };
  const x = d3.scaleLog([1, 10080], [m.l, W - m.r]);
  const ty = 66;
  svg.append('rect').attr('x', x(1)).attr('y', ty - 5).attr('width', x(10080) - x(1)).attr('height', 10).attr('rx', 5).attr('fill', 'var(--cds-chart-grid)');
  svg.append('rect').attr('class', 'gx').style('--d', '.2s').attr('x', x(1)).attr('y', ty - 5).attr('width', x(toMin(half)) - x(1)).attr('height', 10).attr('rx', 5).attr('fill', BJ.lila).attr('fill-opacity', 0.45);
  const ox = x(toMin(often));
  svg.append('circle').attr('class', 'pop').style('--d', '.5s').attr('cx', ox).attr('cy', ty).attr('r', 10).attr('fill', BJ.lila).attr('stroke', 'var(--color-panel)').attr('stroke-width', 3);
  const l1 = often.label;
  const l2 = fmt(often.wert, 'int') + ' ' + often.einheit;
  const p1 = anchorFit(ox, Math.max(textW(svg, l1), textW(svg, l2, 't-big')), W);
  svg.append('text').attr('x', p1.x).attr('y', ty - 38).attr('text-anchor', p1.a).text(l1);
  svg.append('text').attr('class', 't-big').attr('font-size', 18).attr('x', p1.x).attr('y', ty - 18).attr('text-anchor', p1.a).text(l2);
  const hx = x(toMin(half));
  svg.append('line').attr('class', 'pop').style('--d', '.8s').attr('x1', hx).attr('x2', hx).attr('y1', ty - 14).attr('y2', ty + 14).attr('stroke', BJ.blau).attr('stroke-width', 3).attr('stroke-linecap', 'round');
  const l3 = 'Die Hälfte hat geantwortet nach ' + (half.ca ? 'knapp ' : '') + fmt(half.wert, 'int') + ' ' + half.einheit;
  const p3 = anchorFit(hx, textW(svg, l3, 't-strong'), W);
  svg.append('text').attr('class', 't-strong').attr('x', p3.x).attr('y', ty + 32).attr('text-anchor', p3.a).text(l3);
  const ticks = [[1, '1 Min.'], [10, '10 Min.'], [60, '1 Std.'], [1440, '1 Tag'], [10080, '1 Woche']];
  let lastR = -Infinity;
  ticks.forEach(([v, s]) => {
    const w = textW(svg, s);
    const pt = anchorFit(x(v), w, W);
    const left = pt.a === 'start' ? pt.x : pt.a === 'end' ? pt.x - w : pt.x - w / 2;
    if (left < lastR + 8) return;
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', ty + 44).attr('y2', ty + 50).attr('stroke', 'var(--cds-chart-axis)');
    svg.append('text').attr('x', pt.x).attr('y', ty + 66).attr('text-anchor', pt.a).text(s);
    lastR = left + w;
  });
});

dash.draw('kadenz', (el) => {
  const got = need(el, ['kadenz', 'branchendaten']);
  if (!got) return;
  const steps = [...got[0]].map((r) => ({ ...r, tag: Number(r.tag) })).sort((a, b) => a.tag - b.tag);
  const spam = byId(got[1], 'belkins_spam');
  const gaps = steps.map((s, i) => (i < steps.length - 1 ? steps[i + 1].tag - s.tag : steps[steps.length - 1].tag - steps[steps.length - 2].tag));
  const grid = h('div', 'kad');
  grid.style.gridTemplateColumns = gaps.map((g) => `minmax(0, ${g}fr)`).join(' ') + ' minmax(0, 4fr)';
  steps.forEach((s, i) => {
    const st = h('div', 'kad-step' + (i === steps.length - 1 ? ' switch' : ''));
    const node = h('div', 'kad-node pop', NI.format(s.schritt_nr));
    node.style.setProperty('--d', (0.2 + i * 0.3).toFixed(2) + 's');
    st.append(node, h('div', 'kad-day', 'Tag ' + NI.format(s.tag)), h('div', 'kad-name', s.schritt), h('div', 'kad-ch', s.kanal), h('div', 'kad-in', s.inhalt));
    grid.append(st);
  });
  if (spam) {
    const dz = h('div', 'kad-danger');
    const node = h('div', 'kad-node pop', '!');
    node.style.setProperty('--d', (0.2 + steps.length * 0.3).toFixed(2) + 's');
    dz.append(node, h('div', 'kad-day', 'Vermeiden: ab Mail ' + NI.format(spam.x)), h('div', 'kad-big', (mehrAls(spam) ? 'mehr als ' : '') + fmt(spam.wert, 'x')), h('div', 'kad-in', 'Spam-Beschwerden und Abmeldungen'));
    grid.append(dz);
  }
  el.append(grid);
});

dash.draw('quellen', (tb) => {
  const d = dash.data('quellen');
  tb.replaceChildren();
  if (d.status !== 'ok') return;
  [...d.data].sort((a, b) => a.nr - b.nr).forEach((r) => {
    const tr = h('tr');
    tr.dataset.key = String(r.nr);
    const a = h('a', null, r.titel);
    if (/^https:\/\//.test(String(r.url))) {
      a.href = r.url;
      a.target = '_blank';
      a.rel = 'noopener';
    }
    const tdT = h('td');
    tdT.append(a);
    tr.append(h('td', null, String(r.nr)), h('td', null, r.autoren), tdT, h('td', null, r.jahr === null || r.jahr === undefined ? '' : String(r.jahr)), h('td', 'typ', r.typ));
    tb.append(tr);
  });
});

const goTo = (id) => {
  const t = document.getElementById(id);
  if (!t) return;
  t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  dash.setLink(id);
};
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));
document.querySelectorAll('.wp').forEach((w) => w.classList.add('anim'));
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
    setTimeout(() => e.target.classList.add('done'), 3600);
  });
}, { root: document, rootMargin: '0px 0px -10% 0px', threshold: 0.01 });
document.querySelectorAll('.reveal').forEach((r) => revealIO.observe(r));
const named = location.hash ? document.getElementById(location.hash.slice(1)) : null;
if (named) setTimeout(() => named.scrollIntoView(), 500);
