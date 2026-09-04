(function () {
  const CAD = window.CAD;
  const S = CAD.stats;

  const FEATURES = [
    { id: "total", label: "Total symptom score", get: (c) => c.total, worseWhen: "up" },
    { id: "somatic", label: "Physical symptoms", get: (c) => c.clusters.somatic, worseWhen: "up" },
    { id: "cognitive", label: "Cognitive symptoms", get: (c) => c.clusters.cognitive, worseWhen: "up" },
    { id: "emotional", label: "Emotional symptoms", get: (c) => c.clusters.emotional, worseWhen: "up" },
    { id: "sleepHours", label: "Sleep duration", get: (c) => c.sleepHours, worseWhen: "down" },
    { id: "screenMinutes", label: "Screen time", get: (c) => c.screenMinutes, worseWhen: "up" }
  ];

  function matrix(checkins) {
    return checkins.map((c) => FEATURES.map((f) => {
      const v = f.get(c);
      return isFinite(v) ? Number(v) : NaN;
    }));
  }

  function shrinkCovariance(rows, means) {
    const d = means.length;
    const n = rows.length;
    const cov = [];
    for (let a = 0; a < d; a++) {
      cov.push(new Array(d).fill(0));
    }
    rows.forEach((r) => {
      for (let a = 0; a < d; a++) {
        for (let b = 0; b < d; b++) cov[a][b] += (r[a] - means[a]) * (r[b] - means[b]);
      }
    });
    for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) cov[a][b] /= Math.max(1, n - 1);
    const lambda = CAD.clamp(d / n, 0.15, 0.8);
    const avgVar = S.mean(cov.map((row, i) => row[i]));
    for (let a = 0; a < d; a++) {
      for (let b = 0; b < d; b++) {
        cov[a][b] = (1 - lambda) * cov[a][b] + (a === b ? lambda * avgVar : 0);
      }
      cov[a][a] += 1e-6;
    }
    return cov;
  }

  function detect(state) {
    const checkins = state.checkins.slice();
    if (checkins.length < 6) return { ok: false, reason: "Six check-ins unlock off-trend detection.", n: checkins.length };

    const today = checkins[checkins.length - 1];
    const history = checkins.slice(0, -1);
    const contributions = [];

    FEATURES.forEach((f, i) => {
      const hist = history.map((c) => f.get(c)).filter(isFinite);
      const now = f.get(today);
      if (!isFinite(now) || hist.length < 4) return;
      const smoothed = S.ewma(hist, 0.35);
      const expected = smoothed[smoothed.length - 1];
      const residuals = hist.map((v, j) => v - (j === 0 ? v : smoothed[j - 1]));
      const z = S.robustZ(now - expected, residuals);
      contributions.push({
        id: f.id, label: f.label, expected, actual: now,
        delta: now - expected, z: isFinite(z) ? z : 0,
        worseWhen: f.worseWhen,
        adverse: (f.worseWhen === "up" && z > 0) || (f.worseWhen === "down" && z < 0)
      });
    });

    if (!contributions.length) return { ok: false, reason: "Not enough complete check-ins yet.", n: checkins.length };

    const composite = Math.sqrt(S.mean(contributions.map((c) => c.z * c.z)));
    let mahalanobis = null;
    const usable = FEATURES.map((f, i) => i).filter((i) => checkins.every((c) => isFinite(FEATURES[i].get(c))));
    if (history.length >= 12 && usable.length >= 2) {
      const rows = matrix(history).map((r) => usable.map((i) => r[i]));
      const means = usable.map((_, k) => S.mean(rows.map((r) => r[k])));
      const cov = shrinkCovariance(rows, means);
      const x = usable.map((i) => FEATURES[i].get(today));
      const diff = x.map((v, k) => v - means[k]);
      const sol = S.solve(cov, diff);
      if (sol) {
        const md2 = diff.reduce((s, v, k) => s + v * sol[k], 0);
        if (isFinite(md2) && md2 >= 0) mahalanobis = Math.sqrt(md2);
      }
    }

    const adverse = contributions.filter((c) => c.adverse).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    const strong = adverse.filter((c) => Math.abs(c.z) >= 2.5);
    const flagged = strong.length > 0 || composite >= 1.9 || (mahalanobis !== null && mahalanobis >= 3.2);

    return {
      ok: true,
      n: checkins.length,
      composite,
      mahalanobis,
      contributions: contributions.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)),
      adverse,
      strong,
      flagged,
      day: today.day
    };
  }

  CAD.anomaly = { detect, FEATURES };
})();
