(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  function contribBar(label, value, scale, format) {
    const frac = CAD.clamp(Math.abs(value) / scale, 0, 1) * 50;
    const dir = value > 0 ? "up" : "down";
    return h("div", { class: "contrib__row" },
      h("span", label),
      h("div", { class: "contrib__bar" },
        h("span", { class: "contrib__mid" }),
        h("i", {
          dataset: { dir },
          style: value > 0
            ? { left: "50%", width: frac + "%" }
            : { left: (50 - frac) + "%", width: frac + "%" }
        })),
      h("b", { class: "mono", style: { textAlign: "right" } }, format(value)));
  }

  function modelCard(title, lines) {
    const body = h("div", { class: "stack stack--s" }, lines.map((l) =>
      h("div", null, h("strong", { class: "tiny" }, l[0] + ": "), h("span", { class: "tiny muted" }, l[1]))));
    const box = h("details", { class: "card", style: { padding: "16px 20px" } },
      h("summary", { style: { cursor: "pointer", fontWeight: 600, fontSize: "0.92em" } }, title),
      h("div", { style: { marginTop: "12px" } }, body));
    return box;
  }

  CAD.screens.insights = function () {
    const state = CAD.store.get();
    const traj = CAD.derive.trajectory(state);
    const anom = CAD.derive.anomaly(state);
    const trig = CAD.derive.triggers(state);
    const rc = CAD.derive.rciSummary(state);
    const risk = CAD.risk.assess(state);
    const insights = CAD.derive.insights(state);
    const lastX = traj.ok && traj.observed.length ? traj.observed[traj.observed.length - 1].x : 0;

    const wrap = h("div", { class: "wrap stack" });

    wrap.appendChild(h("div", { class: "page-head" },
      h("p", { class: "eyebrow" }, "Recover"),
      h("h1", "Insights"),
      h("p", "Six models run entirely on this device, fitted to your data and nobody else's. Each one shows its inputs, its uncertainty and the point at which it refuses to answer.")));

    wrap.appendChild(h("div", { class: "grid grid--2" }, insights.map(CAD.screens.today.insightCard)));

    const trajCard = h("section", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Recovery trajectory"),
          h("p", { class: "card__sub" }, "Symptom scores after concussion typically fall along an exponential decay. Cadence fits that curve to your check-ins by damped Gauss–Newton least squares, then resamples the residuals 240 times to get an honest interval.")),
        h("span", { class: "chip chip--" + (traj.ok ? (traj.quality === "good" ? "good" : "warning") : "") }, traj.ok ? "Fit: " + traj.quality : "Not enough data")));

    if (traj.ok) {
      trajCard.appendChild(h("div", { class: "grid grid--4" },
        h("div", { class: "stat" },
          h("span", { class: "stat__label" }, "Decay constant τ"),
          h("span", { class: "stat__value" }, CAD.fmt.n(traj.params.tau, 1), h("small", " days")),
          h("span", { class: "stat__meta" }, traj.tauCi ? "80% CI " + CAD.fmt.n(traj.tauCi[0], 1) + "–" + CAD.fmt.n(traj.tauCi[1], 1) : "")),
        h("div", { class: "stat" },
          h("span", { class: "stat__label" }, "Half-life"),
          h("span", { class: "stat__value" }, CAD.fmt.n(traj.halfLife, 1), h("small", " days")),
          h("span", { class: "stat__meta" }, "Time to halve the remaining burden")),
        h("div", { class: "stat" },
          h("span", { class: "stat__label" }, "Modelled floor"),
          h("span", { class: "stat__value" }, CAD.fmt.n(traj.plateau, 1)),
          h("span", { class: "stat__meta" }, "Where the curve settles")),
        h("div", { class: "stat" },
          h("span", { class: "stat__label" }, "Under " + traj.threshold + " points"),
          h("span", { class: "stat__value" }, traj.eta.point !== null && isFinite(traj.eta.point)
            ? Math.max(0, Math.round(traj.eta.point - lastX))
            : (traj.eta.lo !== null ? "~" + Math.max(0, Math.round(traj.eta.lo - lastX)) + "+" : "—"), h("small", " days")),
          h("span", { class: "stat__meta" }, traj.eta.lo !== null
            ? "80% interval " + Math.max(0, Math.round(traj.eta.lo - lastX)) + "–" + Math.round(traj.eta.hi - lastX) + " days" +
              (traj.eta.point === null ? ", and " + Math.round((1 - traj.eta.reachable) * 100) + "% of refits flatten above it" : "")
            : "The fitted curve flattens above this level — the floor, not the slope, is the problem"))));

      trajCard.appendChild(CAD.charts.line({
        series: [
          { name: "Your check-ins", color: "var(--series-1)", values: traj.observed },
          { name: "Fitted decay", color: "var(--series-2)", dashed: true, dots: false, values: traj.centre.map((p) => ({ x: p.x, y: Number(p.y.toFixed(2)) })) }
        ],
        band: { values: traj.band, color: "var(--series-2)", name: "80% interval" },
        height: 300, yZero: true, threshold: traj.threshold, thresholdLabel: "target",
        formatX: (x) => "day " + Math.round(x),
        formatY: (y) => String(Math.round(y)),
        ariaLabel: "Fitted exponential recovery curve with bootstrap interval",
        tableHeaders: ["Day since injury", "Symptom score"],
        tableRows: traj.observed.map((p) => [String(p.x), String(p.y)])
      }));

      trajCard.appendChild(h("div", { class: "callout" },
        h("span", { class: "callout__ico" }, CAD.icon("info")),
        h("div",
          h("strong", "Read this as a projection of your own curve, not a prognosis."),
          h("p", { style: { margin: "4px 0 0" } }, "The interval covers sampling noise in your check-ins. It cannot cover a new injury, a bad week, or the fact that recovery is rarely as smooth as a curve. R² of the fit is " + CAD.fmt.n(traj.r2, 2) + " on " + traj.n + " check-ins."))));
    } else {
      trajCard.appendChild(CAD.charts.emptyBox(traj.reason || "Not enough check-ins yet."));
    }

    trajCard.appendChild(modelCard("Model card — trajectory", [
      ["Form", "S(t) = C + A·exp(−t/τ), fitted to total symptom score against days since injury"],
      ["Estimator", "Gauss–Newton with Levenberg damping, 80 iterations, parameters bounded to A ∈ [0,300], τ ∈ [0.5,400], C ∈ [0,132]"],
      ["Uncertainty", "Residual bootstrap, 240 resamples, 10th–90th percentile band"],
      ["Gate", "Refuses to fit under four check-ins"],
      ["Known failure", "A single very bad day early in the series pulls A up and shortens τ. The band widens rather than hiding it"],
      ["Source", "Exponential symptom resolution described in Ledoux et al. 2019"]
    ]));
    wrap.appendChild(trajCard);

    const anomCard = h("section", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Off-trend detection"),
          h("p", { class: "card__sub" }, "Each input gets its own exponentially weighted forecast from your history. Today is compared against that forecast using a median-absolute-deviation z-score, which one wild day cannot inflate.")),
        h("span", { class: "chip chip--" + (anom.ok ? (anom.flagged ? "warning" : "good") : "") },
          anom.ok ? (anom.flagged ? "Off trend" : "On trend") : "Needs six check-ins")));

    if (anom.ok) {
      anomCard.appendChild(h("div", { class: "grid grid--3" },
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Composite deviation"), h("span", { class: "stat__value" }, CAD.fmt.n(anom.composite, 2)), h("span", { class: "stat__meta" }, "Flags above 1.9")),
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Mahalanobis distance"), h("span", { class: "stat__value" }, anom.mahalanobis === null ? "—" : CAD.fmt.n(anom.mahalanobis, 2)), h("span", { class: "stat__meta" }, anom.mahalanobis === null ? "Needs 12 complete days" : "Shrinkage covariance")),
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Inputs watched"), h("span", { class: "stat__value" }, anom.contributions.length), h("span", { class: "stat__meta" }, "Symptom clusters, sleep, screen time"))));
      anomCard.appendChild(h("div", { class: "contrib" }, anom.contributions.map((c) =>
        contribBar(c.label, c.z, 3.5, (v) => "z " + CAD.fmt.n(v, 1)))));
      anomCard.appendChild(h("p", { class: "tiny muted" },
        "Bars to the right are above your forecast, to the left below it. Orange means the direction that is worse for you. Today's expected values: " +
        anom.contributions.slice(0, 3).map((c) => c.label.toLowerCase() + " " + CAD.fmt.n(c.expected, 1) + " (actual " + CAD.fmt.n(c.actual, 1) + ")").join(", ") + "."));
    } else {
      anomCard.appendChild(CAD.charts.emptyBox(anom.reason));
    }
    anomCard.appendChild(modelCard("Model card — off-trend detection", [
      ["Per-feature", "EWMA forecast (α = 0.35) with robust z-scoring of the one-step residuals, scale = 1.4826 × MAD"],
      ["Joint", "Mahalanobis distance on the complete-case feature matrix, covariance shrunk toward its diagonal by λ = clamp(d/n, 0.15, 0.8)"],
      ["Flag rule", "Any adverse |z| ≥ 2.5, or composite ≥ 1.9, or Mahalanobis ≥ 3.2"],
      ["Gate", "Six check-ins for per-feature, twelve for the joint distance"],
      ["Known failure", "A steady worsening trend is learned by the EWMA and stops flagging. The trajectory model is what catches that"]
    ]));
    wrap.appendChild(anomCard);

    const trigCard = h("section", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Trigger finder"),
          h("p", { class: "card__sub" }, "Rank correlations between what you did and how you felt, at same-day and next-day lags. Both series are detrended first, so the fact that you are gradually getting better and gradually doing more cannot masquerade as cause and effect. Each survivor is permutation-tested and corrected for false discovery.")),
        h("span", { class: "chip" }, trig.tested + " of " + (CAD.triggers.BEHAVIOURS.length * 2) + " tests have enough data")));

    if (trig.findings.length) {
      trigCard.appendChild(h("div", { class: "stack" }, trig.findings.map((f) =>
        h("div", { class: "insight" },
          h("div", { class: "insight__ico", style: { background: f.direction === "worse" ? "var(--warning-soft)" : "var(--good-soft)", color: f.direction === "worse" ? "var(--warning)" : "var(--good)" } }, CAD.icon("sparkle", 18)),
          h("div", null,
            h("strong", f.title),
            h("p", f.detail),
            h("p", { class: "insight__why" }, f.advice))))));
    } else {
      trigCard.appendChild(h("div", { class: "callout" },
        h("span", { class: "callout__ico" }, CAD.icon("info")),
        h("div", h("strong", "Nothing has cleared the bar yet."),
          h("p", { style: { margin: "4px 0 0" } }, "Each association needs at least " + CAD.triggers.MIN_PAIRS + " day pairs, a rank correlation of at least 0.35, and a permutation p-value that survives false-discovery correction at 10%. Silence here is a feature."))));
    }

    trigCard.appendChild(h("div", { class: "table-wrap" },
      h("table", null,
        h("thead", h("tr", ["Behaviour", "Lag", "n pairs", "ρ", "p", "Survives FDR"].map((t) => h("th", t)))),
        h("tbody", trig.tests.map((t) => h("tr", [
          h("td", t.behaviour.label),
          h("td", t.lag.label),
          h("td", String(t.n)),
          h("td", t.insufficient ? "—" : CAD.fmt.n(t.rho, 2)),
          h("td", t.insufficient ? "—" : CAD.fmt.n(t.p, 3)),
          h("td", t.insufficient ? h("span", { class: "muted" }, "not tested") : (t.significant ? h("span", { class: "chip chip--good" }, "yes") : h("span", { class: "muted" }, "no")))
        ]))))));

    trigCard.appendChild(modelCard("Model card — trigger finder", [
      ["Statistic", "Partial Spearman correlation: both series are rank-transformed, then linearly detrended against day index, so the shared recovery trend is removed before correlating"],
      ["Inference", "1,500-iteration permutation test on the detrended residuals — no distributional assumption on a 20-point series"],
      ["Multiplicity", "Benjamini–Hochberg at FDR 10% across every test run, per Benjamini & Hochberg 1995"],
      ["Effect gate", "|ρ| ≥ 0.35 on top of significance, so a tiny-but-significant association is not surfaced"],
      ["Known failure", "Correlation is not causation and confounding by day-of-week or by symptom severity itself is not modelled. Treat findings as hypotheses to test deliberately"]
    ]));
    wrap.appendChild(trigCard);

    const riskCard = h("section", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Persistent-symptom risk panel"),
          h("p", { class: "card__sub" }, "An educational implementation of the predictor set from the published 5P clinical risk score for children and adolescents. Every contribution is shown, and fixed factors are separated from ones you can act on.")),
        h("span", { class: "chip chip--" + risk.tone }, risk.band + " band")));

    riskCard.appendChild(h("div", { class: "grid grid--3" },
      h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Score"), h("span", { class: "stat__value" }, risk.score, h("small", " / " + risk.maxScore))),
      h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Modelled probability"), h("span", { class: "stat__value" }, CAD.fmt.pct(risk.probability)), h("span", { class: "stat__meta" }, "Illustrative calibration only")),
      h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Input completeness"), h("span", { class: "stat__value", style: { fontSize: "1.3em" } }, risk.confidence), h("span", { class: "stat__meta" }, risk.gaps.length ? "Missing: " + risk.gaps.join(", ") : "All inputs present"))));

    riskCard.appendChild(h("div", { class: "contrib" }, risk.features.map((f) =>
      contribBar(f.label + (f.modifiable ? "" : " (fixed)"), f.points, risk.maxScore / 3, (v) => v > 0 ? "+" + v : "0"))));

    if (risk.modifiable.length) {
      riskCard.appendChild(h("div", { class: "callout callout--accent" },
        h("span", { class: "callout__ico" }, CAD.icon("sparkle")),
        h("div", h("strong", "What is actually actionable here"),
          h("p", { style: { margin: "4px 0 0" } }, "Of the factors currently adding to your score, these are the ones that can change: " +
            risk.modifiable.map((f) => f.label.toLowerCase()).join(", ") + ". The rest are fixed characteristics and are shown so you know what the number is made of."))));
    }

    riskCard.appendChild(h("div", { class: "callout callout--warn" },
      h("span", { class: "callout__ico" }, CAD.icon("alert")),
      h("div", h("strong", "This is not the validated clinical score."),
        h("p", { style: { margin: "4px 0 0" } }, "The published 5P score was derived on children aged 5–17 presenting to emergency departments within 48 hours, and it is scored by a clinician. Cadence reuses its predictor set for education and self-tracking. It cannot be used to decide clearance, and it is not calibrated for adults."))));

    riskCard.appendChild(modelCard("Model card — risk panel", [
      ["Predictors", "Age band, sex at birth, prior prolonged concussion, migraine history, slow answering, tandem-stance errors, headache, noise sensitivity, fatigue"],
      ["Weighting", "Integer point weights approximating the published score's structure, summed to " + risk.maxScore],
      ["Probability", "Logistic link 1/(1+e^−(−2.30 + 0.285·score)), chosen so the three bands land near published band rates. Not recalibrated on any local data"],
      ["Explainability", "Every feature's contribution is displayed; no feature is hidden inside the score"],
      ["Population", "Derived on children and adolescents in emergency departments. Out of population for adults and for late presentations"],
      ["Source", "Zemek et al., JAMA 2016"]
    ]));
    wrap.appendChild(riskCard);

    const cogCard = h("section", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Cognitive change"),
          h("p", { class: "card__sub" }, "Reliable Change Index against your own baseline. Beyond ±1.96 is change that test-retest noise would produce less than 5% of the time."))));
    if (rc.results.length) {
      cogCard.appendChild(h("div", { class: "table-wrap" },
        h("table", null,
          h("thead", h("tr", ["Measure", "Baseline", "Latest", "RCI", "Reading", "SE source"].map((t) => h("th", t)))),
          h("tbody", rc.results.map((r) => h("tr", [
            h("td", r.metric.label),
            h("td", CAD.fmt.n(r.baselineValue, r.metric.unit === "ms" ? 0 : 2) + " " + r.metric.unit),
            h("td", CAD.fmt.n(r.latest.value, r.metric.unit === "ms" ? 0 : 2) + " " + r.metric.unit),
            h("td", CAD.fmt.n(r.rci, 2)),
            h("td", r.status),
            h("td", r.method === "personal" ? "your repeats" : "published")
          ]))))));
    } else {
      cogCard.appendChild(CAD.charts.emptyBox("Run a task twice and this table fills in."));
    }
    wrap.appendChild(cogCard);

    if (state.checkins.length >= 4) {
      const first = state.checkins.slice(0, Math.min(3, state.checkins.length));
      const recent = state.checkins.slice(-3);
      const clusters = ["somatic", "cognitive", "sleep", "emotional"];
      const maxes = { somatic: 54, cognitive: 36, sleep: 18, emotional: 24 };
      const avg = (rows, k) => CAD.stats.mean(rows.map((c) => c.clusters[k]));
      wrap.appendChild(h("section", { class: "card stack" },
        h("div", { class: "card__head" }, h("div", null,
          h("h2", "Symptom profile"),
          h("p", { class: "card__sub" }, "Cluster totals scaled to each cluster's own maximum, so a 3-item cluster is not dwarfed by a 9-item one. Grouping follows the revised four-factor structure of the symptom scale."))),
        CAD.charts.radar({
          axes: clusters.map((k) => ({ label: CAD.pcss.CLUSTERS[k].label, max: maxes[k] })),
          series: [
            { name: "First three days logged", color: "var(--series-2)", values: clusters.map((k) => avg(first, k)) },
            { name: "Last three days", color: "var(--series-1)", values: clusters.map((k) => avg(recent, k)) }
          ],
          ariaLabel: "Symptom cluster profile, first three days versus last three days"
        }),
        CAD.charts.tableToggle(["Cluster", "First three days", "Last three days", "Change"],
          clusters.map((k) => [CAD.pcss.CLUSTERS[k].full, CAD.fmt.n(avg(first, k), 1), CAD.fmt.n(avg(recent, k), 1), CAD.fmt.signed(avg(recent, k) - avg(first, k), 1)])),
        CAD.refs.cite("kontos")));
    }

    if (CAD.api.state.coach && CAD.api.state.account) {
      const out = h("div", { class: "stack stack--s" });
      const btn = h("button", { class: "btn btn--primary" }, CAD.icon("sparkle"), "Explain my week in plain language");
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        out.innerHTML = "";
        out.appendChild(h("p", { class: "tiny muted" }, "Sending aggregate numbers only…"));
        const w = CAD.derive.weeklyDelta(state);
        const lines = [
          "Days since injury: " + CAD.store.daysSinceInjury(),
          latest ? "Latest symptom total: " + latest.total + "/132 across " + latest.count + "/22 symptoms" : "",
          latest ? "Clusters — physical " + latest.clusters.somatic + ", cognitive " + latest.clusters.cognitive + ", sleep " + latest.clusters.sleep + ", emotional " + latest.clusters.emotional : "",
          w === null ? "" : "Change vs the previous week: " + CAD.fmt.signed(w, 1) + " points",
          traj.ok ? "Fitted decay constant " + CAD.fmt.n(traj.params.tau, 1) + " days, modelled floor " + CAD.fmt.n(traj.plateau, 1) : "",
          "Graded return: " + CAD.protocol.readiness(state).track.label + " step " + CAD.protocol.readiness(state).stage.n,
          trig.findings.length ? "Detected association: " + trig.findings[0].title : "No associations have cleared the statistical bar yet."
        ].filter(Boolean);
        try {
          const res = await CAD.api.coach(lines.join("\n"));
          out.innerHTML = "";
          String(res.text || "").split("\n").filter((x) => x.trim()).forEach((para) => out.appendChild(h("p", para)));
          out.appendChild(h("p", { class: "tiny muted" }, "Written by a language model from the numbers listed above. It has no access to your journal, your notes or your identity, and it is not clinical advice."));
        } catch (e) {
          out.innerHTML = "";
          out.appendChild(h("p", { class: "tiny muted" }, e.message || "The summary service did not respond."));
        }
        btn.disabled = false;
      });
      wrap.appendChild(h("section", { class: "card stack" },
        h("div", { class: "card__head" }, h("div", null,
          h("h2", "Plain-language summary"),
          h("p", { class: "card__sub" }, "Optional. Sends this week's aggregate numbers — never your journal, notes or identity — to a language model that is instructed not to diagnose, not to predict a recovery date, and not to contradict the graded protocol."))),
        h("div", { class: "row" }, btn),
        out));
    }

    const tol = CAD.tolerance.ensureState();
    const tolStats = CAD.tolerance.todayStats();
    const tolCard = h("section", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Screen tolerance"),
          h("p", { class: "card__sub" }, "The old advice was a dark room until symptoms stop. The current evidence says the opposite: stay engaged, but below the level that provokes you. That needs a threshold you can actually see, so Cadence infers one from how you use the page.")),
        h("span", { class: "chip chip--" + (tolStats ? CAD.tolerance.levelFor(tolStats.mean).tone : "") },
          tol.enabled ? (tolStats ? CAD.tolerance.levelFor(tolStats.mean).label : "Calibrating") : "Off")));

    if (!tol.enabled) {
      tolCard.appendChild(CAD.charts.emptyBox("Tolerance sensing is switched off. Turn it on in Settings to see this."));
    } else if (!tolStats || tol.log.length < 4) {
      tolCard.appendChild(CAD.charts.emptyBox("Cadence is still learning your normal. A few minutes of ordinary use fills this in."));
    } else {
      const todayKey = CAD.store.todayKey();
      const rows = tol.log.filter((r) => CAD.fmt.dayKey(r.ts) === todayKey);
      const t0 = rows[0].ts;
      tolCard.appendChild(h("div", { class: "grid grid--4" },
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Mean today"), h("span", { class: "stat__value" }, Math.round(tolStats.mean), h("small", " / 100"))),
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Peak"), h("span", { class: "stat__value" }, Math.round(tolStats.peak), h("small", " / 100"))),
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Screen time sensed"), h("span", { class: "stat__value" }, tolStats.minutesTracked, h("small", " min"))),
        h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Over threshold"), h("span", { class: "stat__value" }, tolStats.restWindows, h("small", " windows")), h("span", { class: "stat__meta" }, "Periods above 74"))));

      tolCard.appendChild(CAD.charts.line({
        series: [{ name: "Strain", color: "var(--series-2)", values: rows.map((r) => ({ x: Math.round((r.ts - t0) / 60000), y: r.strain })), dots: rows.length <= 30 }],
        height: 220, yZero: true, yMax: 100, threshold: 74, thresholdLabel: "stop",
        formatX: (x) => Math.round(x) + "m", formatY: (y) => String(Math.round(y)),
        ariaLabel: "Screen strain over this session",
        tableHeaders: ["Minutes into session", "Strain", "Level"],
        tableRows: rows.map((r) => [String(Math.round((r.ts - t0) / 60000)), String(r.strain), r.level])
      }));

      const snap = CAD.tolerance.snapshot();
      tolCard.appendChild(h("div", { class: "contrib" }, CAD.tolerance.SIGNALS.map((sig) =>
        contribBar(sig.label, snap.zs[sig.id] || 0, 3.5, (v) => "z " + CAD.fmt.n(v, 1)))));
      tolCard.appendChild(h("p", { class: "tiny muted" },
        "Each bar is that signal against your own median in robust z units — " +
        CAD.tolerance.SIGNALS.map((s2) => s2.label.toLowerCase() + " is " + s2.plain).join("; ") + "."));
    }

    tolCard.appendChild(modelCard("Model card — screen tolerance", [
      ["Inputs", "Pointer path tortuosity, scroll direction reversals, backspace ratio, tab refocus count, pauses over 8 seconds, unbroken session minutes"],
      ["Window", "20 seconds per sample; each signal robust-z scored against your own rolling median and MAD"],
      ["Composite", "Weighted mean of the z scores mapped to 0–100, plus a dwell term that grows after 12 minutes on screen"],
      ["Action", "Above 56 the interface eases off; above 74, sustained 40 seconds, it goes flat and prompts a break. Adaptation is user-disableable and always explained on screen"],
      ["Gate", "Changes nothing until at least three signals have four baseline samples each"],
      ["Privacy", "Event timings and geometry only. No keystroke content, no camera, no network. Deleting the baseline is one button in Settings"],
      ["Known failure", "A trackpad and a mouse produce different tortuosity, so switching device mid-session inflates the score until the baseline catches up"]
    ]));
    wrap.appendChild(tolCard);

    wrap.appendChild(h("div", { class: "callout callout--accent" },
      h("span", { class: "callout__ico" }, CAD.icon("shield")),
      h("div",
        h("strong", "How these models are allowed to behave"),
        h("p", { style: { margin: "4px 0 0" } }, "They run on your device and send nothing anywhere. They refuse to answer below a stated amount of data rather than guessing. They show uncertainty, not just a number. They never output a diagnosis, a clearance decision, or a date you will be better. Where a model reuses a clinical instrument, the difference between the published version and this one is stated on the same screen."))));

    return wrap;
  };
})();
