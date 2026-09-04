(function () {
  const CAD = window.CAD;
  const S = CAD.stats;

  const METRICS = [
    { key: "srt.medianRt", task: "srt", field: "medianRt", label: "Simple reaction time", unit: "ms", lowerIsBetter: true, refSd: 42, refReliability: 0.70 },
    { key: "srt.lapses", task: "srt", field: "lapses", label: "Attention lapses", unit: "", lowerIsBetter: true, refSd: 1.6, refReliability: 0.55 },
    { key: "gng.medianRt", task: "gng", field: "medianRt", label: "Choice reaction time", unit: "ms", lowerIsBetter: true, refSd: 48, refReliability: 0.75 },
    { key: "gng.commissions", task: "gng", field: "commissions", label: "Inhibition errors", unit: "", lowerIsBetter: true, refSd: 2.4, refReliability: 0.60 },
    { key: "stroop.interference", task: "stroop", field: "interference", label: "Stroop interference", unit: "ms", lowerIsBetter: true, refSd: 58, refReliability: 0.62 },
    { key: "nback.dprime", task: "nback", field: "dprime", label: "Working memory d′", unit: "", lowerIsBetter: false, refSd: 0.68, refReliability: 0.70 },
    { key: "pursuit.rmse", task: "pursuit", field: "rmseNorm", label: "Visual tracking error", unit: "", lowerIsBetter: true, refSd: 0.045, refReliability: 0.65 },
    { key: "rapid.totalSec", task: "rapid", field: "totalSec", label: "Rapid naming time", unit: "s", lowerIsBetter: true, refSd: 3.4, refReliability: 0.85 }
  ];

  const CRIT_90 = 1.645;
  const CRIT_95 = 1.96;

  function seriesFor(state, metric) {
    return state.cognitionRuns
      .filter((r) => r.task === metric.task && r.metrics && isFinite(r.metrics[metric.field]))
      .sort((a, b) => a.ts - b.ts)
      .map((r) => ({ ts: r.ts, value: Number(r.metrics[metric.field]), id: r.id }));
  }

  function evaluate(state, metric) {
    const series = seriesFor(state, metric);
    if (series.length < 2) return { metric, series, status: "insufficient", n: series.length };

    const baselineRun = state.baseline.cognition[metric.task];
    const baselineValue = baselineRun && isFinite(baselineRun[metric.field])
      ? Number(baselineRun[metric.field])
      : S.median(series.slice(0, Math.min(3, series.length - 1)).map((p) => p.value));

    const latest = series[series.length - 1];
    const history = series.slice(0, -1).map((p) => p.value);

    let seDiff, method;
    if (history.length >= 4) {
      const within = S.sd(history);
      if (isFinite(within) && within > 1e-9) {
        seDiff = within * Math.SQRT2;
        method = "personal";
      }
    }
    if (!seDiff) {
      seDiff = metric.refSd * Math.SQRT2 * Math.sqrt(1 - metric.refReliability);
      method = "reference";
    }

    const raw = latest.value - baselineValue;
    const rciValue = seDiff > 0 ? raw / seDiff : 0;
    const directed = metric.lowerIsBetter ? -rciValue : rciValue;

    let status = "stable";
    if (Math.abs(rciValue) >= CRIT_95) status = directed > 0 ? "improved" : "declined";
    else if (Math.abs(rciValue) >= CRIT_90) status = directed > 0 ? "improving" : "declining";

    return {
      metric, series, baselineValue, latest, raw, seDiff, rci: rciValue, directed,
      status, method, n: series.length,
      confidence: Math.abs(rciValue) >= CRIT_95 ? 0.95 : Math.abs(rciValue) >= CRIT_90 ? 0.9 : null
    };
  }

  function summary(state) {
    const results = METRICS.map((m) => evaluate(state, m)).filter((r) => r.status !== "insufficient");
    const declines = results.filter((r) => r.status === "declined" || r.status === "declining");
    const improves = results.filter((r) => r.status === "improved" || r.status === "improving");
    return { results, declines, improves, tested: results.length };
  }

  CAD.rci = { METRICS, evaluate, summary, seriesFor, CRIT_90, CRIT_95 };
})();
