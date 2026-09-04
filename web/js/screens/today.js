(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  function insightCard(ins) {
    const toneColor = {
      good: "var(--good)", warning: "var(--warning)", serious: "var(--serious)",
      critical: "var(--critical)", neutral: "var(--ink-3)"
    }[ins.tone] || "var(--ink-3)";
    const soft = {
      good: "var(--good-soft)", warning: "var(--warning-soft)", serious: "var(--serious-soft)",
      critical: "var(--critical-soft)", neutral: "var(--surface-2)"
    }[ins.tone] || "var(--surface-2)";
    return h("div", { class: "insight" },
      h("div", { class: "insight__ico", style: { background: soft, color: toneColor } }, CAD.icon(ins.icon, 18)),
      h("div", null,
        h("strong", ins.title),
        h("p", ins.body),
        ins.why ? h("p", { class: "insight__why" }, ins.why) : null));
  }

  CAD.screens.today = function () {
    const state = CAD.store.get();
    const latest = CAD.derive.latestCheckin(state);
    const today = CAD.derive.todayCheckin(state);
    const dsi = CAD.store.daysSinceInjury();
    const tasks = CAD.derive.todayTasks(state);
    const traj = CAD.derive.trajectory(state);
    const insights = CAD.derive.insights(state);
    const readiness = CAD.protocol.readiness(state);
    const band = latest ? CAD.pcss.severityBand(latest.total) : null;
    const prev = state.checkins.length > 1 ? state.checkins[state.checkins.length - 2] : null;
    const delta = latest && prev ? latest.total - prev.total : null;

    const wrap = h("div", { class: "wrap stack" });

    const ringValue = latest ? 1 - CAD.clamp(latest.total / 66, 0, 1) : 0;
    wrap.appendChild(h("section", { class: "hero" },
      h("svg", { class: "hero__pulse", viewBox: "0 0 340 90", "aria-hidden": "true", html: '<path d="M2 62h44l16-40 22 74 18-52 12 22h38l14-30 18 50 16-34h132"/>' }),
      h("div", { class: "hero__grid" },
        h("div", { class: "stack" },
          h("p", { class: "eyebrow" }, dsi === null ? "Cadence" : "Day " + dsi + " since injury"),
          h("h1", latest
            ? (today ? "Checked in for today." : "How is today going?")
            : "Let's start with a check-in."),
          h("p", { style: { color: "var(--ink-2)", maxWidth: "52ch" } }, latest
            ? (today
              ? "Your symptom score today is " + latest.total + " out of 132 across " + latest.count + " of 22 symptoms — " + band.label.toLowerCase() + "."
              : "Your last check-in was " + CAD.fmt.shortDate(latest.ts) + " at " + latest.total + " out of 132. Logging today keeps the models honest.")
            : "The 22-item symptom scale takes about 90 seconds and drives everything else in Cadence."),
          h("div", { class: "row" },
            h("a", { class: "btn btn--primary btn--lg", href: "#/checkin" }, CAD.icon("checkin"), today ? "Update today's check-in" : "Start today's check-in"),
            h("a", { class: "btn btn--ghost btn--lg", href: "#/plan" }, "See my plan")),
          latest && state.checkins.length > 3 ? h("div", { class: "row", style: { marginTop: "4px" } },
            CAD.charts.spark(state.checkins.slice(-14).map((c) => c.total), { color: "var(--accent)" }),
            h("span", { class: "tiny muted" }, "Last " + Math.min(14, state.checkins.length) + " check-ins" + (delta !== null ? " · " + CAD.fmt.signed(delta, 0) + " vs yesterday" : ""))) : null),
        latest ? h("div", { class: "stack", style: { alignItems: "center", gap: "10px" } },
          CAD.charts.ring({
            value: ringValue, size: 148, stroke: 12,
            color: band.tone === "good" ? "var(--good)" : band.tone === "warning" ? "var(--warning)" : band.tone === "serious" ? "var(--serious)" : "var(--critical)",
            label: String(latest.total),
            sub: "of 132",
            ariaLabel: "Symptom severity score " + latest.total + " out of 132"
          }),
          h("span", { class: "chip chip--" + band.tone }, h("i", { class: "dot dot--" + band.tone }), band.label)) : null)));

    wrap.appendChild(h("section", { class: "stack" },
      h("div", { class: "row row--between" },
        h("h2", "Today"),
        h("span", { class: "chip" }, CAD.fmt.plural(CAD.derive.streak(state), "day") + " logged in a row")),
      h("div", { class: "grid grid--2 enter-stagger" }, tasks.map((t) =>
        h("a", { class: "tile", href: t.href },
          h("span", { class: "tile__ico" }, CAD.icon(t.icon)),
          h("span", { class: "tile__body" }, h("strong", t.label), h("span", t.sub)),
          t.done ? h("span", { class: "tile__done" }, "Done") : h("span", { style: { color: "var(--ink-3)" } }, CAD.icon("arrow", 20)))))));

    const stage = readiness.stage;
    wrap.appendChild(h("section", { class: "card" },
      h("div", { class: "card__head" },
        h("div", null,
          h("p", { class: "eyebrow" }, readiness.track.label + " · step " + stage.n + " of " + readiness.track.stages.length),
          h("h2", stage.title),
          h("p", { class: "card__sub" }, stage.detail)),
        h("span", { class: "chip chip--" + (readiness.ready ? "good" : "warning") }, readiness.ready ? "Ready to progress" : "Hold here")),
      h("div", { class: "meter", style: { marginBottom: "14px" } },
        h("div", { class: "meter__fill", style: { width: (stage.n / readiness.track.stages.length * 100) + "%" } })),
      h("div", { class: "row" },
        h("a", { class: "btn btn--ghost btn--sm", href: "#/plan" }, "Open the graded plan", CAD.icon("arrow")))));

    wrap.appendChild(h("section", { class: "stack" },
      h("div", { class: "row row--between" },
        h("h2", "What your data is saying"),
        h("a", { class: "btn btn--ghost btn--sm", href: "#/insights" }, "All insights")),
      h("div", { class: "grid grid--2 enter-stagger" }, insights.slice(0, 4).map(insightCard))));

    if (state.checkins.length >= 2) {
      const series = [{
        name: "Symptom score",
        color: "var(--series-1)",
        values: state.checkins.map((c) => ({ x: CAD.derive.dayIndex(state, c.day), y: c.total }))
      }];
      let band2 = null;
      if (traj.ok) {
        series.push({ name: "Fitted decay", color: "var(--series-2)", values: traj.centre.map((p) => ({ x: p.x, y: Number(p.y.toFixed(2)) })), dots: false, dashed: true });
        band2 = { values: traj.band, color: "var(--series-2)", name: "80% interval" };
      }
      wrap.appendChild(h("section", { class: "card" },
        h("div", { class: "card__head" },
          h("div", null,
            h("h2", "Symptom trajectory"),
            h("p", { class: "card__sub" }, traj.ok
              ? "Exponential decay fitted to your check-ins by non-linear least squares, with an 80% bootstrap interval. Fit quality: " + traj.quality + " (R² " + CAD.fmt.n(traj.r2, 2) + ")."
              : "Four check-ins unlock the fitted recovery curve."))),
        CAD.charts.line({
          series, band: band2, height: 280, yZero: true, threshold: 5, thresholdLabel: "target",
          formatX: (x) => "d" + Math.round(x),
          formatY: (y) => String(Math.round(y)),
          ariaLabel: "Symptom score by day since injury with fitted recovery curve",
          tableHeaders: ["Day", "Symptom score", "Symptoms endorsed"],
          tableRows: state.checkins.slice(-30).map((c) => [String(CAD.derive.dayIndex(state, c.day)), String(c.total), c.count + " / 22"])
        })));
    }

    return wrap;
  };

  CAD.screens.today.insightCard = insightCard;
})();
