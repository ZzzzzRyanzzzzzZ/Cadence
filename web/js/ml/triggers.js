(function () {
  const CAD = window.CAD;
  const S = CAD.stats;

  const BEHAVIOURS = [
    { id: "screenMinutes", label: "Screen time", unit: "min", verb: "screen minutes", advice: "Try shorter screen blocks with real breaks between them." },
    { id: "exerciseMinutes", label: "Light exercise", unit: "min", verb: "minutes of light exercise", advice: "Keep sessions below the intensity that pushes symptoms up more than 2 points." },
    { id: "sleepHours", label: "Sleep duration", unit: "h", verb: "hours of sleep", advice: "Protect a consistent sleep window — it is the single most modifiable recovery input." },
    { id: "stress", label: "Stress level", unit: "/10", verb: "stress rating", advice: "Pair high-demand days with a scheduled decompression block." },
    { id: "cognitiveMinutes", label: "Study or work load", unit: "min", verb: "minutes of study or work", advice: "Split cognitive work into blocks and stop before symptoms climb." },
    { id: "screenStrain", label: "Screen strain", unit: "/100", verb: "measured screen strain", advice: "Watch the tolerance meter and stop at the amber band rather than pushing to the red one." }
  ];

  const LAGS = [
    { lag: 0, label: "same day" },
    { lag: 1, label: "next day" }
  ];

  const MIN_PAIRS = 8;

  function buildPairs(checkins, behaviourId, lag) {
    const byDay = {};
    checkins.forEach((c) => { byDay[c.day] = c; });
    const xs = [], ys = [], days = [], ts = [];
    checkins.forEach((c, i) => {
      const x = c[behaviourId];
      if (!isFinite(x)) return;
      const target = lag === 0 ? c : byDay[CAD.fmt.dayKey(new Date(CAD.fmt.fromKey(c.day).getTime() + CAD.DAY))];
      if (!target || !isFinite(target.total)) return;
      xs.push(Number(x));
      ys.push(Number(target.total));
      days.push(c.day);
      ts.push(i);
    });
    return { xs, ys, days, ts };
  }

  function detrend(values, ts) {
    const fit = S.linreg(ts, values);
    if (!isFinite(fit.slope)) return values.slice();
    return values.map((v, i) => v - (fit.intercept + fit.slope * ts[i]));
  }

  function partialSpearman(xs, ys, ts) {
    const rx = detrend(S.rank(xs), ts);
    const ry = detrend(S.rank(ys), ts);
    return S.pearson(rx, ry);
  }

  function tertileContrast(xs, ys) {
    if (xs.length < 6) return null;
    const sorted = xs.slice().sort((a, b) => a - b);
    const lowCut = sorted[Math.floor(sorted.length / 3)];
    const highCut = sorted[Math.floor((2 * sorted.length) / 3)];
    const low = [], high = [];
    xs.forEach((x, i) => {
      if (x <= lowCut) low.push(ys[i]);
      else if (x >= highCut) high.push(ys[i]);
    });
    if (low.length < 2 || high.length < 2) return null;
    return {
      lowCut, highCut,
      lowMean: S.mean(low), highMean: S.mean(high),
      diff: S.mean(high) - S.mean(low),
      nLow: low.length, nHigh: high.length
    };
  }

  function analyse(state, opts) {
    opts = opts || {};
    const checkins = state.checkins.slice();
    const tests = [];
    BEHAVIOURS.forEach((b) => {
      LAGS.forEach((L) => {
        const { xs, ys, ts } = buildPairs(checkins, b.id, L.lag);
        if (xs.length < MIN_PAIRS) {
          tests.push({ behaviour: b, lag: L, n: xs.length, insufficient: true });
          return;
        }
        const rho = partialSpearman(xs, ys, ts);
        if (!isFinite(rho)) {
          tests.push({ behaviour: b, lag: L, n: xs.length, insufficient: true });
          return;
        }
        const rx = detrend(S.rank(xs), ts);
        const ry = detrend(S.rank(ys), ts);
        const p = S.permutationP(rx, ry, S.pearson, opts.iterations || 1500);
        tests.push({
          behaviour: b, lag: L, n: xs.length, rho, p,
          contrast: tertileContrast(detrend(xs, ts).map((v, i) => v), detrend(ys, ts)),
          rawContrast: tertileContrast(xs, ys),
          insufficient: false
        });
      });
    });

    const testable = tests.filter((t) => !t.insufficient);
    const flags = S.benjaminiHochberg(testable.map((t) => t.p), opts.alpha || 0.1);
    testable.forEach((t, i) => { t.significant = flags[i]; });

    const findings = testable
      .filter((t) => t.significant && Math.abs(t.rho) >= 0.35)
      .sort((a, b) => Math.abs(b.rho) - Math.abs(a.rho))
      .map((t) => ({
        id: t.behaviour.id + "_lag" + t.lag.lag,
        title: sentence(t),
        detail: detailFor(t),
        advice: t.behaviour.advice,
        rho: t.rho,
        p: t.p,
        n: t.n,
        direction: t.rho > 0 ? "worse" : "better",
        behaviour: t.behaviour,
        lag: t.lag
      }));

    return {
      tests, testable, findings,
      tested: testable.length,
      dataDays: checkins.length,
      ready: testable.length > 0
    };
  }

  function sentence(t) {
    const dir = t.rho > 0 ? "higher" : "lower";
    const when = t.lag.lag === 0 ? "on the same day" : "the next day";
    return "On your higher " + t.behaviour.verb + " days, symptoms run " + dir + " " + when + ".";
  }

  function detailFor(t) {
    const parts = ["Partial Spearman ρ = " + t.rho.toFixed(2) + " across " + t.n + " day pairs, after removing the overall recovery trend from both series. Permutation p = " + t.p.toFixed(3) + ", survives false-discovery correction."];
    if (t.contrast) {
      const diff = t.contrast.diff;
      parts.push("On days when your " + t.behaviour.label.toLowerCase() + " ran unusually high for that stage of your recovery, symptoms averaged " + Math.abs(diff).toFixed(1) + " points " + (diff > 0 ? "higher" : "lower") + " than on your unusually low days.");
    }
    return parts.join(" ");
  }

  CAD.triggers = { analyse, BEHAVIOURS, LAGS, MIN_PAIRS };
})();
