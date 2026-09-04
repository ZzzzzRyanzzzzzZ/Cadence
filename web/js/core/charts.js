(function () {
  const CAD = window.CAD;
  const s = CAD.svgEl;
  const h = CAD.h;

  const W = 720;
  const PAD = { l: 46, r: 84, t: 18, b: 34 };

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step * 0.5; v += step) out.push(Number(v.toFixed(6)));
    return out;
  }

  function seriesColor(i) {
    return ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"][i % 4];
  }

  function emptyBox(message) {
    return h("div", { class: "chart-empty" }, message);
  }

  function line(opts) {
    const series = (opts.series || []).filter((sr) => sr.values && sr.values.length);
    if (!series.length) return emptyBox(opts.empty || "Not enough data yet — this chart fills in as you check in.");

    const H = opts.height || 260;
    const band = opts.band && opts.band.values && opts.band.values.length ? opts.band : null;
    const allX = [];
    const allY = [];
    series.forEach((sr) => sr.values.forEach((p) => { allX.push(p.x); allY.push(p.y); }));
    if (band) band.values.forEach((p) => { allX.push(p.x); allY.push(p.lo); allY.push(p.hi); });

    let xMin = Math.min.apply(null, allX);
    let xMax = Math.max.apply(null, allX);
    if (xMin === xMax) { xMin -= 0.5; xMax += 0.5; }
    let yMin = Math.min.apply(null, allY);
    let yMax = Math.max.apply(null, allY);
    if (opts.yZero) yMin = Math.min(0, yMin);
    if (opts.yMax !== undefined) yMax = Math.max(yMax, opts.yMax);
    if (opts.yMin !== undefined) yMin = Math.min(yMin, opts.yMin);
    const ticks = niceTicks(yMin, yMax, 4);
    const tMin = ticks[0], tMax = ticks[ticks.length - 1];

    const px = (x) => PAD.l + ((x - xMin) / (xMax - xMin)) * (W - PAD.l - PAD.r);
    const py = (y) => H - PAD.b - ((y - tMin) / (tMax - tMin || 1)) * (H - PAD.t - PAD.b);

    const svg = s("svg", { class: "chart", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.ariaLabel || opts.title || "Line chart" });

    ticks.forEach((t) => {
      svg.appendChild(s("line", { class: "chart__grid", x1: PAD.l, x2: W - PAD.r, y1: py(t), y2: py(t) }));
      svg.appendChild(s("text", { class: "chart__axis-label", x: PAD.l - 9, y: py(t) + 4, "text-anchor": "end", fill: "var(--ink-3)", "font-size": 11 })).textContent = opts.formatY ? opts.formatY(t) : String(t);
    });
    svg.appendChild(s("line", { class: "chart__baseline", x1: PAD.l, x2: W - PAD.r, y1: H - PAD.b, y2: H - PAD.b }));

    const xTickCount = Math.min(6, Math.max(2, Math.round((xMax - xMin) + 1)));
    const step = (xMax - xMin) / (xTickCount - 1);
    for (let i = 0; i < xTickCount; i++) {
      const xv = xMin + step * i;
      const label = opts.formatX ? opts.formatX(xv) : String(Math.round(xv));
      const t = s("text", { class: "chart__axis-label", x: px(xv), y: H - PAD.b + 18, "text-anchor": "middle", fill: "var(--ink-3)", "font-size": 11 });
      t.textContent = label;
      svg.appendChild(t);
    }

    if (opts.threshold !== undefined) {
      svg.appendChild(s("line", {
        x1: PAD.l, x2: W - PAD.r, y1: py(opts.threshold), y2: py(opts.threshold),
        stroke: "var(--ink-3)", "stroke-width": 1, "stroke-dasharray": "5 5", opacity: 0.7
      }));
      const tl = s("text", { x: W - PAD.r + 6, y: py(opts.threshold) + 4, fill: "var(--ink-3)", "font-size": 11 });
      tl.textContent = opts.thresholdLabel || "";
      svg.appendChild(tl);
    }

    if (band) {
      const pts = band.values.slice().sort((a, b) => a.x - b.x);
      let d = "";
      pts.forEach((p, i) => { d += (i ? "L" : "M") + px(p.x) + " " + py(p.hi); });
      for (let i = pts.length - 1; i >= 0; i--) d += "L" + px(pts[i].x) + " " + py(pts[i].lo);
      d += "Z";
      svg.appendChild(s("path", { d, fill: band.color || "var(--series-1)", opacity: 0.16 }));
    }

    series.forEach((sr, i) => {
      const color = sr.color || seriesColor(i);
      const pts = sr.values.slice().sort((a, b) => a.x - b.x);
      let d = "";
      pts.forEach((p, j) => { d += (j ? "L" : "M") + px(p.x) + " " + py(p.y); });
      svg.appendChild(s("path", {
        d, fill: "none", stroke: color, "stroke-width": 2,
        "stroke-linecap": "round", "stroke-linejoin": "round",
        "stroke-dasharray": sr.dashed ? "6 5" : null
      }));
      if (pts.length <= 40 && sr.dots !== false) {
        pts.forEach((p) => {
          svg.appendChild(s("circle", { cx: px(p.x), cy: py(p.y), r: 4.5, fill: color, stroke: "var(--chart-surface)", "stroke-width": 2 }));
        });
      }
      const last = pts[pts.length - 1];
      const lbl = s("text", {
        x: px(last.x) + 9, y: py(last.y) + 4, fill: "var(--ink-2)", "font-size": 11.5, "font-weight": 600
      });
      lbl.textContent = sr.name;
      svg.appendChild(lbl);
    });

    const frame = h("div", { class: "chart-frame" });
    const tip = h("div", { class: "chart-tip", hidden: true });
    const cross = s("line", { y1: PAD.t, y2: H - PAD.b, stroke: "var(--line-strong)", "stroke-width": 1, opacity: 0 });
    svg.appendChild(cross);
    const hit = s("rect", { class: "chart__hit", x: PAD.l, y: PAD.t, width: W - PAD.l - PAD.r, height: H - PAD.t - PAD.b });
    svg.appendChild(hit);

    function onMove(ev) {
      const rect = svg.getBoundingClientRect();
      const scale = rect.width / W;
      const cx = (ev.clientX - rect.left) / scale;
      const xv = xMin + ((cx - PAD.l) / (W - PAD.l - PAD.r)) * (xMax - xMin);
      let nearest = null;
      series.forEach((sr) => {
        sr.values.forEach((p) => {
          const dist = Math.abs(p.x - xv);
          if (!nearest || dist < nearest.dist) nearest = { dist, x: p.x };
        });
      });
      if (!nearest) return;
      cross.setAttribute("x1", px(nearest.x));
      cross.setAttribute("x2", px(nearest.x));
      cross.setAttribute("opacity", 0.9);
      tip.innerHTML = "";
      tip.appendChild(h("strong", opts.formatX ? opts.formatX(nearest.x) : String(nearest.x)));
      series.forEach((sr, i) => {
        const p = sr.values.find((v) => v.x === nearest.x);
        if (!p) return;
        tip.appendChild(h("div", { class: "chart-tip__row" },
          h("span", { class: "row", style: { gap: "6px" } },
            h("i", { class: "chart-legend__swatch", style: { background: sr.color || seriesColor(i) } }),
            sr.name),
          h("b", { class: "mono" }, opts.formatY ? opts.formatY(p.y) : String(p.y))));
      });
      if (band) {
        const bp = band.values.find((v) => v.x === nearest.x);
        if (bp) tip.appendChild(h("div", { class: "chart-tip__row muted tiny" }, h("span", band.name || "range"), h("b", { class: "mono" }, (opts.formatY ? opts.formatY(bp.lo) : bp.lo) + "–" + (opts.formatY ? opts.formatY(bp.hi) : bp.hi))));
      }
      tip.hidden = false;
      const rectF = frame.getBoundingClientRect();
      tip.style.left = (px(nearest.x) * scale) + "px";
      tip.style.top = Math.max(28, (ev.clientY - rectF.top)) + "px";
    }

    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("opacity", 0); });

    frame.appendChild(svg);
    frame.appendChild(tip);

    const wrap = h("div", { class: "stack stack--s" });
    wrap.appendChild(frame);
    if (series.length >= 2) {
      wrap.appendChild(h("div", { class: "chart-legend" }, series.map((sr, i) =>
        h("span", { class: "chart-legend__item" },
          h("i", { class: "chart-legend__swatch", style: { background: sr.color || seriesColor(i) } }),
          sr.name))));
    }
    if (opts.tableRows) wrap.appendChild(tableToggle(opts.tableHeaders, opts.tableRows));
    return wrap;
  }

  function tableToggle(headers, rows) {
    const box = h("div", { class: "stack stack--s" });
    const tableWrap = h("div", { class: "table-wrap", hidden: true },
      h("table", h("thead", h("tr", headers.map((x) => h("th", x)))), h("tbody", rows.map((r) => h("tr", r.map((c) => h("td", c)))))));
    const btn = h("button", { class: "btn btn--ghost btn--sm", "aria-pressed": "false", "aria-expanded": "false" }, "Table view");
    btn.addEventListener("click", () => {
      const on = tableWrap.hidden;
      tableWrap.hidden = !on;
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-expanded", String(on));
    });
    box.appendChild(h("div", { class: "row" }, btn));
    box.appendChild(tableWrap);
    return box;
  }

  function bars(opts) {
    const items = opts.items || [];
    if (!items.length) return emptyBox(opts.empty || "No data yet.");
    const max = opts.max || Math.max.apply(null, items.map((i) => Math.abs(i.value))) || 1;
    return h("div", { class: "stack stack--s" }, items.map((it) => {
      const pct = CAD.clamp(Math.abs(it.value) / max, 0, 1) * 100;
      return h("div", { class: "stack", style: { gap: "5px" } },
        h("div", { class: "row row--between", style: { gap: "10px" } },
          h("span", { style: { fontSize: "0.88em" } }, it.label),
          h("b", { class: "mono", style: { fontSize: "0.88em" } }, opts.format ? opts.format(it.value) : String(it.value))),
        h("div", { class: "meter" }, h("div", { class: "meter__fill" + (it.status ? " meter__fill--" + it.status : ""), style: { width: pct + "%", background: it.color || null } })));
    }));
  }

  function radar(opts) {
    const axes = opts.axes || [];
    if (axes.length < 3) return emptyBox("Not enough dimensions.");
    const size = 260, cx = size / 2, cy = size / 2, R = size / 2 - 42;
    const svg = s("svg", { class: "chart", viewBox: `0 0 ${size} ${size}`, role: "img", "aria-label": opts.ariaLabel || "Symptom cluster profile" });
    const n = axes.length;
    const pt = (i, frac) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(a) * R * frac, cy + Math.sin(a) * R * frac];
    };
    [0.25, 0.5, 0.75, 1].forEach((f) => {
      let d = "";
      for (let i = 0; i < n; i++) { const p = pt(i, f); d += (i ? "L" : "M") + p[0] + " " + p[1]; }
      svg.appendChild(s("path", { d: d + "Z", fill: "none", stroke: "var(--grid)", "stroke-width": 1 }));
    });
    for (let i = 0; i < n; i++) {
      const p = pt(i, 1);
      svg.appendChild(s("line", { x1: cx, y1: cy, x2: p[0], y2: p[1], stroke: "var(--grid)", "stroke-width": 1 }));
      const lp = pt(i, 1.2);
      const t = s("text", { x: lp[0], y: lp[1] + 4, "text-anchor": lp[0] > cx + 5 ? "start" : lp[0] < cx - 5 ? "end" : "middle", fill: "var(--ink-3)", "font-size": 11 });
      t.textContent = axes[i].label;
      svg.appendChild(t);
    }
    (opts.series || []).forEach((sr, si) => {
      let d = "";
      axes.forEach((ax, i) => {
        const frac = CAD.clamp((sr.values[i] || 0) / (ax.max || 1), 0, 1);
        const p = pt(i, frac);
        d += (i ? "L" : "M") + p[0] + " " + p[1];
      });
      const color = sr.color || seriesColor(si);
      svg.appendChild(s("path", { d: d + "Z", fill: color, opacity: si === 0 ? 0.22 : 0.12, stroke: color, "stroke-width": 2, "stroke-linejoin": "round" }));
      axes.forEach((ax, i) => {
        const frac = CAD.clamp((sr.values[i] || 0) / (ax.max || 1), 0, 1);
        const p = pt(i, frac);
        svg.appendChild(s("circle", { cx: p[0], cy: p[1], r: 4, fill: color, stroke: "var(--chart-surface)", "stroke-width": 2 }));
      });
    });
    const wrap = h("div", { class: "stack stack--s" }, h("div", { class: "chart-frame", style: { display: "grid", placeItems: "center" } }, svg));
    if ((opts.series || []).length >= 2) {
      wrap.appendChild(h("div", { class: "chart-legend" }, opts.series.map((sr, i) =>
        h("span", { class: "chart-legend__item" }, h("i", { class: "chart-legend__swatch", style: { background: sr.color || seriesColor(i) } }), sr.name))));
    }
    return wrap;
  }

  function spark(values, opts) {
    opts = opts || {};
    const w = 120, hh = opts.height || 30;
    if (!values || values.length < 2) return s("svg", { viewBox: `0 0 ${w} ${hh}`, width: w, height: hh });
    const min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    const svg = s("svg", { viewBox: `0 0 ${w} ${hh}`, width: w, height: hh, "aria-hidden": "true", style: "display:block" });
    let d = "";
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = hh - 3 - ((v - min) / (max - min || 1)) * (hh - 6);
      d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    });
    svg.appendChild(s("path", { d, fill: "none", stroke: opts.color || "var(--accent)", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return svg;
  }

  function ring(opts) {
    const size = opts.size || 132, sw = opts.stroke || 11, r = (size - sw) / 2, c = 2 * Math.PI * r;
    const frac = CAD.clamp(opts.value, 0, 1);
    const svg = s("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}`, "aria-hidden": "true" });
    svg.appendChild(s("circle", { class: "ring__track", cx: size / 2, cy: size / 2, r, "stroke-width": sw }));
    svg.appendChild(s("circle", {
      class: "ring__bar", cx: size / 2, cy: size / 2, r, "stroke-width": sw,
      "stroke-dasharray": c, "stroke-dashoffset": c * (1 - frac),
      style: "stroke:" + (opts.color || "var(--accent)")
    }));
    return h("div", { class: "ring", role: "img", "aria-label": opts.ariaLabel || "" },
      svg,
      h("div", { class: "ring__center" }, h("b", opts.label), h("span", opts.sub)));
  }

  CAD.charts = { line, bars, radar, spark, ring, tableToggle, seriesColor, emptyBox };
})();
