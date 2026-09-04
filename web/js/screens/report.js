(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  function kv(label, value) {
    return h("div", null, h("b", label), h("span", value || "—"));
  }

  function download(filename, text, type) {
    try {
      const blob = new Blob([text], { type: type || "application/json" });
      const url = URL.createObjectURL(blob);
      const a = h("a", { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      CAD.toast("Saved " + filename);
    } catch (e) {
      CAD.toast("This browser blocked the download. Use Copy summary instead.");
    }
  }

  function textSummary(state) {
    const latest = CAD.derive.latestCheckin(state);
    const traj = CAD.derive.trajectory(state);
    const risk = CAD.risk.assess(state);
    const r = CAD.protocol.readiness(state);
    const oculo = state.oculomotorRuns[state.oculomotorRuns.length - 1];
    const bal = state.balanceRuns[state.balanceRuns.length - 1];
    const lines = [];
    lines.push("CADENCE RECOVERY SUMMARY");
    lines.push("Generated " + CAD.fmt.longDate(new Date()));
    lines.push("");
    lines.push("Injury date: " + (state.profile.injuryDate || "not set") + " (day " + (CAD.store.daysSinceInjury() || "?") + ")");
    lines.push("Mechanism: " + (state.profile.mechanism || "not recorded"));
    lines.push("History: prior prolonged concussion " + (state.profile.priorProlonged ? "yes" : "no") + "; migraine " + (state.profile.migraineHistory ? "yes" : "no") + "; mood history " + (state.profile.anxietyOrMoodHistory ? "yes" : "no") + "; ADHD/LD " + (state.profile.learningOrAdhd ? "yes" : "no"));
    lines.push("");
    lines.push("SYMPTOMS (Post-Concussion Symptom Scale, 22 items, 0-6)");
    if (latest) {
      lines.push("Latest " + latest.day + ": total " + latest.total + "/132 across " + latest.count + "/22 symptoms");
      lines.push("Clusters — physical " + latest.clusters.somatic + ", cognitive " + latest.clusters.cognitive + ", sleep " + latest.clusters.sleep + ", emotional " + latest.clusters.emotional);
      lines.push("Check-ins logged: " + state.checkins.length);
    } else lines.push("No check-ins logged.");
    if (traj.ok) {
      lines.push("Fitted exponential decay: tau " + CAD.fmt.n(traj.params.tau, 1) + " d, half-life " + CAD.fmt.n(traj.halfLife, 1) + " d, modelled floor " + CAD.fmt.n(traj.plateau, 1) + ", R2 " + CAD.fmt.n(traj.r2, 2));
    }
    lines.push("");
    lines.push("GRADED RETURN");
    lines.push(r.track.label + " step " + r.stage.n + "/" + r.track.stages.length + ": " + r.stage.title);
    lines.push("Hours at current step: " + Math.floor(r.hoursInStage) + ". Progression status: " + (r.ready ? "criteria met" : "holding"));
    lines.push("");
    lines.push("OCULOMOTOR / VESTIBULAR SCREEN (VOMS-adapted)");
    if (oculo) {
      const sc = CAD.oculo.scoreRun(oculo);
      lines.push("Run " + CAD.fmt.shortDate(oculo.ts) + ": " + sc.flaggedItems + " provocative items, max symptom increase " + sc.maxDelta + " points, NPC " + (sc.npcCm ? sc.npcCm + " cm" : "not measured"));
      sc.perItem.filter((i) => i.flagged).forEach((i) => lines.push("  - " + i.name + ": +" + i.delta));
    } else lines.push("Not performed.");
    lines.push("");
    lines.push("BALANCE (modified BESS)");
    if (bal) lines.push("Run " + CAD.fmt.shortDate(bal.ts) + ": total " + bal.total + "/30 (double " + bal.double + ", single " + bal.single + ", tandem " + bal.tandem + ")");
    else lines.push("Not performed.");
    lines.push("");
    lines.push("COGNITIVE TASKS (Reliable Change Index vs personal baseline)");
    const rc = CAD.derive.rciSummary(state);
    if (rc.results.length) {
      rc.results.forEach((x) => lines.push("  " + x.metric.label + ": baseline " + CAD.fmt.n(x.baselineValue, 2) + " -> " + CAD.fmt.n(x.latest.value, 2) + " " + x.metric.unit + ", RCI " + CAD.fmt.n(x.rci, 2) + " (" + x.status + ")"));
    } else lines.push("Insufficient repeat testing.");
    lines.push("");
    lines.push("RISK PANEL (5P predictor set, educational implementation)");
    lines.push("Score " + risk.score + "/" + risk.maxScore + " — " + risk.band + " band. Inputs: " + risk.confidence);
    if (risk.drivers.length) lines.push("Contributing: " + risk.drivers.map((d) => d.label + " (+" + d.points + ")").join("; "));
    const trig = CAD.derive.triggers(state);
    if (trig.findings.length) {
      lines.push("");
      lines.push("PERSONAL ASSOCIATIONS (FDR-corrected)");
      trig.findings.forEach((f) => lines.push("  " + f.title + " rho " + CAD.fmt.n(f.rho, 2) + ", n " + f.n + ", p " + CAD.fmt.n(f.p, 3)));
    }
    lines.push("");
    lines.push("Self-reported data collected on the patient's own device. Not a diagnostic instrument. Scores adapted from published tools and are not clinician-administered.");
    return lines.join("\n");
  }

  CAD.screens.report = function () {
    const state = CAD.store.get();
    const latest = CAD.derive.latestCheckin(state);
    const traj = CAD.derive.trajectory(state);
    const risk = CAD.risk.assess(state);
    const r = CAD.protocol.readiness(state);
    const rc = CAD.derive.rciSummary(state);
    const oculo = state.oculomotorRuns[state.oculomotorRuns.length - 1];
    const bal = state.balanceRuns[state.balanceRuns.length - 1];
    const trig = CAD.derive.triggers(state);
    const oculoScore = oculo ? CAD.oculo.scoreRun(oculo) : null;

    const sheet = h("div", { class: "report-sheet stack" },
      h("div", { class: "row row--between" },
        h("div", null,
          h("p", { class: "eyebrow" }, "Cadence recovery summary"),
          h("h2", (state.profile.name || "Patient") + " · day " + (CAD.store.daysSinceInjury() === null ? "—" : CAD.store.daysSinceInjury()) + " post-injury")),
        h("span", { class: "tiny muted" }, CAD.fmt.longDate(new Date()))),

      h("div", { class: "report-block" },
        h("h3", "Presentation"),
        h("div", { class: "kv" },
          kv("Injury date", state.profile.injuryDate ? CAD.fmt.longDate(CAD.fmt.fromKey(state.profile.injuryDate)) : "—"),
          kv("Mechanism", state.profile.mechanism),
          kv("Age band", state.profile.ageBand),
          kv("Loss of consciousness", state.profile.lossOfConsciousness ? "Yes" : "No"),
          kv("Amnesia", state.profile.amnesia ? "Yes" : "No"),
          kv("Prior concussion > 1 week", state.profile.priorProlonged ? "Yes" : "No"),
          kv("Migraine history", state.profile.migraineHistory ? "Yes" : "No"),
          kv("Mood history", state.profile.anxietyOrMoodHistory ? "Yes" : "No"),
          kv("ADHD / learning difference", state.profile.learningOrAdhd ? "Yes" : "No"))),

      h("div", { class: "report-block" },
        h("h3", "Symptom burden"),
        latest ? h("div", { class: "stack" },
          h("div", { class: "grid grid--4" },
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Total"), h("span", { class: "stat__value" }, latest.total, h("small", " / 132"))),
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Symptoms endorsed"), h("span", { class: "stat__value" }, latest.count, h("small", " / 22"))),
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Check-ins"), h("span", { class: "stat__value" }, state.checkins.length)),
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "7-day change"), h("span", { class: "stat__value" }, CAD.derive.weeklyDelta(state) === null ? "—" : CAD.fmt.signed(CAD.derive.weeklyDelta(state), 1)))),
          h("div", { class: "table-wrap" }, h("table", null,
            h("thead", h("tr", ["Cluster", "Score", "Maximum", "Items endorsed"].map((t) => h("th", t)))),
            h("tbody", ["somatic", "cognitive", "sleep", "emotional"].map((k) => h("tr", [
              h("td", CAD.pcss.CLUSTERS[k].full),
              h("td", String(latest.clusters[k])),
              h("td", String({ somatic: 54, cognitive: 36, sleep: 18, emotional: 24 }[k])),
              h("td", String(latest.counts[k]))
            ]))))),
          state.checkins.length >= 2 ? CAD.charts.line({
            series: [{ name: "Total symptom score", color: "var(--series-1)", values: state.checkins.map((c) => ({ x: CAD.derive.dayIndex(state, c.day), y: c.total })) }],
            height: 220, yZero: true, formatX: (x) => "d" + Math.round(x), formatY: (y) => String(Math.round(y)),
            ariaLabel: "Symptom score by day since injury"
          }) : null,
          traj.ok ? h("p", { class: "tiny muted" }, "Exponential decay fitted to " + traj.n + " check-ins: τ = " + CAD.fmt.n(traj.params.tau, 1) + " days, half-life " + CAD.fmt.n(traj.halfLife, 1) + " days, modelled floor " + CAD.fmt.n(traj.plateau, 1) + " points, R² " + CAD.fmt.n(traj.r2, 2) + ".") : null)
          : h("p", { class: "muted" }, "No check-ins logged.")),

      h("div", { class: "report-block" },
        h("h3", "Graded return status"),
        h("div", { class: "kv" },
          kv("Strategy", r.track.label),
          kv("Current step", r.stage.n + " of " + r.track.stages.length + " — " + r.stage.title),
          kv("Hours at step", String(Math.floor(r.hoursInStage))),
          kv("Progression criteria", r.ready ? "Met" : "Not met")),
        h("ul", { class: "tiny muted", style: { marginTop: "10px", paddingLeft: "18px" } },
          r.reasons.map((x) => h("li", (x.ok ? "✓ " : "· ") + x.text)))),

      h("div", { class: "report-block" },
        h("h3", "Vestibular / ocular motor screen"),
        oculo ? h("div", { class: "stack" },
          h("div", { class: "kv" },
            kv("Date", CAD.fmt.longDate(oculo.ts)),
            kv("Provocative items", oculoScore.flaggedItems + " (threshold ≥ 2-point rise)"),
            kv("Largest increase", oculoScore.maxDelta + " points"),
            kv("Near point of convergence", oculoScore.npcCm ? oculoScore.npcCm + " cm" + (oculoScore.npcFlag ? " (abnormal, ≥ 6 cm)" : " (normal)") : "Not measured")),
          oculoScore.perItem.length ? h("div", { class: "table-wrap" }, h("table", null,
            h("thead", h("tr", ["Item", "Symptom rise", "Flagged"].map((t) => h("th", t)))),
            h("tbody", oculoScore.perItem.map((i) => h("tr", [h("td", i.name), h("td", CAD.fmt.signed(i.delta, 0)), h("td", i.flagged ? "Yes" : "No")]))))) : null)
          : h("p", { class: "muted" }, "Not performed.")),

      h("div", { class: "report-block" },
        h("h3", "Postural control (modified BESS)"),
        bal ? h("div", { class: "kv" },
          kv("Date", CAD.fmt.longDate(bal.ts)),
          kv("Total errors", bal.total + " / 30"),
          kv("Double-leg", String(bal.double)),
          kv("Single-leg", String(bal.single)),
          kv("Tandem", bal.tandem + (bal.tandem >= 4 ? " (≥ 4)" : ""))) : h("p", { class: "muted" }, "Not performed.")),

      h("div", { class: "report-block" },
        h("h3", "Cognitive testing"),
        rc.results.length ? h("div", { class: "table-wrap" }, h("table", null,
          h("thead", h("tr", ["Measure", "Baseline", "Latest", "RCI", "Interpretation"].map((t) => h("th", t)))),
          h("tbody", rc.results.map((x) => h("tr", [
            h("td", x.metric.label),
            h("td", CAD.fmt.n(x.baselineValue, x.metric.unit === "ms" ? 0 : 2) + " " + x.metric.unit),
            h("td", CAD.fmt.n(x.latest.value, x.metric.unit === "ms" ? 0 : 2) + " " + x.metric.unit),
            h("td", CAD.fmt.n(x.rci, 2)),
            h("td", x.status)
          ]))))) : h("p", { class: "muted" }, "Insufficient repeat testing."),
        h("p", { class: "tiny muted" }, "Self-administered, unsupervised, on the patient's own device. Reliable Change Index computed against their own baseline using " + (rc.results.some((x) => x.method === "personal") ? "within-person variability where available" : "published test-retest constants") + ". Not equivalent to formal neuropsychological assessment.")),

      h("div", { class: "report-block" },
        h("h3", "Risk panel"),
        h("div", { class: "kv" },
          kv("Score", risk.score + " / " + risk.maxScore),
          kv("Band", risk.band),
          kv("Inputs", risk.confidence),
          kv("Contributing factors", risk.drivers.length ? risk.drivers.map((d) => d.label).join("; ") : "None")),
        h("p", { class: "tiny muted" }, "Educational implementation of the 5P predictor set (Zemek et al., JAMA 2016), self-scored. Not the validated clinician-administered instrument and not calibrated for adults.")),

      trig.findings.length ? h("div", { class: "report-block" },
        h("h3", "Personal associations"),
        h("ul", { style: { paddingLeft: "18px", margin: 0 } }, trig.findings.map((f) =>
          h("li", { style: { marginBottom: "6px" } }, h("span", f.title), h("span", { class: "tiny muted" }, " ρ " + CAD.fmt.n(f.rho, 2) + ", n = " + f.n + ", p = " + CAD.fmt.n(f.p, 3) + ", FDR-corrected"))))) : null,

      (function () {
        const items = (state.ladder && state.ladder.items) || [];
        const attempts = [];
        items.forEach((i) => (i.attempts || []).forEach((a) => {
          if (isFinite(a.predicted) && isFinite(a.actual)) attempts.push(Object.assign({ item: i.title }, a));
        }));
        if (attempts.length < 3) return null;
        const errors = attempts.map((a) => a.predicted - a.actual);
        const over = errors.filter((e) => e >= 1).length;
        return h("div", { class: "report-block" },
          h("h3", "Graded exposure and symptom expectancy"),
          h("div", { class: "kv" },
            kv("Activities tracked", String(items.length)),
            kv("Attempts logged", String(attempts.length)),
            kv("Mean expectancy error", CAD.fmt.signed(CAD.stats.mean(errors), 1) + " points (predicted minus actual)"),
            kv("Overestimated", over + " of " + attempts.length + " attempts")),
          h("p", { class: "tiny muted" }, CAD.stats.mean(errors) >= 1
            ? "Consistent overestimation of symptom cost is the pattern associated with fear avoidance. Patient is repeatedly finding activities easier than anticipated."
            : CAD.stats.mean(errors) <= -1
              ? "Patient is underestimating symptom cost, which usually indicates activity steps are too large rather than a fear avoidance pattern."
              : "Symptom expectancy is well calibrated against actual experience."));
      })(),

      h("div", { class: "report-block" },
        h("h3", "Declaration"),
        h("p", { class: "tiny muted" }, "All data above is patient-reported and self-administered outside a clinical setting, stored only on the patient's device. Instruments are adaptations of published tools (Post-Concussion Symptom Scale; VOMS; modified BESS; King–Devick paradigm; PHQ-2; GAD-2; 5P predictor set) and have not been validated in this delivery format. Nothing here constitutes a diagnosis or a clearance decision.")));

    return h("div", { class: "wrap stack" },
      h("div", { class: "page-head no-print" },
        h("p", { class: "eyebrow" }, "Recover"),
        h("h1", "Clinician report"),
        h("p", "Everything worth bringing to an appointment, on one page. Nothing is uploaded — you print it, save it, or copy it and send it yourself.")),
      h("div", { class: "row no-print" },
        h("button", { class: "btn btn--primary", onclick: () => window.print() }, CAD.icon("print"), "Print or save as PDF"),
        h("button", { class: "btn btn--ghost", onclick: () => download("cadence-summary-" + CAD.store.todayKey() + ".txt", textSummary(state), "text/plain") }, CAD.icon("download"), "Download text summary"),
        h("button", { class: "btn btn--ghost", onclick: () => download("cadence-data-" + CAD.store.todayKey() + ".json", CAD.store.exportJSON()) }, CAD.icon("download"), "Download raw data"),
        h("button", {
          class: "btn btn--ghost",
          onclick: () => {
            const text = textSummary(state);
            if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => CAD.toast("Summary copied to clipboard.")).catch(() => CAD.toast("Copy blocked — use download instead."));
            else CAD.toast("Clipboard unavailable in this browser.");
          }
        }, "Copy summary")),
      sheet);
  };

  CAD.screens.report.textSummary = textSummary;
})();
