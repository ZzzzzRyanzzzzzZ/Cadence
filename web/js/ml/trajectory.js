(function () {
  const CAD = window.CAD;
  const S = CAD.stats;

  function model(p, t) { return p.C + p.A * Math.exp(-t / p.tau); }

  function fitExponential(ts, ys, init) {
    const n = ts.length;
    let p = init || {
      A: Math.max(1, Math.max.apply(null, ys) - Math.min.apply(null, ys)),
      tau: Math.max(2, (Math.max.apply(null, ts) - Math.min.apply(null, ts)) / 2 || 7),
      C: Math.max(0, Math.min.apply(null, ys) * 0.6)
    };
    let lambda = 0.01;
    let prevCost = Infinity;

    for (let iter = 0; iter < 80; iter++) {
      const r = [], J = [];
      for (let i = 0; i < n; i++) {
        const e = Math.exp(-ts[i] / p.tau);
        r.push(ys[i] - (p.C + p.A * e));
        J.push([e, (p.A * ts[i] / (p.tau * p.tau)) * e, 1]);
      }
      const cost = S.sum(r.map((v) => v * v));
      const JtJ = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const Jtr = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        for (let a = 0; a < 3; a++) {
          Jtr[a] += J[i][a] * r[i];
          for (let b = 0; b < 3; b++) JtJ[a][b] += J[i][a] * J[i][b];
        }
      }
      for (let a = 0; a < 3; a++) JtJ[a][a] *= (1 + lambda);
      const delta = S.solve(JtJ, Jtr);
      if (!delta) break;
      const next = {
        A: CAD.clamp(p.A + delta[0], 0, 300),
        tau: CAD.clamp(p.tau + delta[1], 0.5, 400),
        C: CAD.clamp(p.C + delta[2], 0, 132)
      };
      let nextCost = 0;
      for (let i = 0; i < n; i++) { const d = ys[i] - model(next, ts[i]); nextCost += d * d; }
      if (nextCost < cost) { p = next; lambda = Math.max(1e-6, lambda * 0.6); }
      else { lambda = Math.min(1e6, lambda * 3); }
      if (Math.abs(prevCost - nextCost) < 1e-7) break;
      prevCost = nextCost;
    }

    let ssRes = 0;
    for (let i = 0; i < n; i++) { const d = ys[i] - model(p, ts[i]); ssRes += d * d; }
    const my = S.mean(ys);
    let ssTot = 0;
    for (let i = 0; i < n; i++) ssTot += (ys[i] - my) * (ys[i] - my);
    return { p, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot, rmse: Math.sqrt(ssRes / Math.max(1, n)) };
  }

  function timeToThreshold(p, threshold) {
    if (p.C >= threshold) return null;
    if (p.A <= 0.01) return 0;
    const v = (threshold - p.C) / p.A;
    if (v <= 0) return null;
    const t = -p.tau * Math.log(v);
    return t;
  }

  function analyse(points, opts) {
    opts = opts || {};
    const threshold = opts.threshold === undefined ? 5 : opts.threshold;
    const pts = points.slice().sort((a, b) => a.t - b.t);
    const ts = pts.map((p) => p.t);
    const ys = pts.map((p) => p.y);
    const n = pts.length;
    if (n < 4) {
      return { ok: false, reason: "Needs at least four check-ins to model a trajectory.", n };
    }

    const base = fitExponential(ts, ys);
    const lin = S.linreg(ts, ys);
    const usable = isFinite(base.p.tau) && base.r2 >= -0.5;

    const resid = ts.map((t, i) => ys[i] - model(base.p, t));
    const B = 240;
    const tauSamples = [], etaSamples = [], curveSamples = [];
    const lastT = ts[n - 1];
    const horizon = Math.max(14, Math.min(70, Math.round(base.p.tau * 2.2)));
    const gridStart = ts[0];
    const grid = [];
    for (let t = gridStart; t <= lastT + horizon; t += 1) grid.push(t);

    for (let b = 0; b < B; b++) {
      const ysB = ts.map((t, i) => model(base.p, t) + resid[Math.floor(Math.random() * n)]);
      const f = fitExponential(ts, ysB, { A: base.p.A, tau: base.p.tau, C: base.p.C });
      if (!isFinite(f.p.tau)) continue;
      tauSamples.push(f.p.tau);
      const eta = timeToThreshold(f.p, threshold);
      etaSamples.push(eta === null ? Infinity : eta);
      curveSamples.push(grid.map((t) => model(f.p, t)));
    }

    const bandLo = [], bandHi = [], centre = [];
    grid.forEach((t, gi) => {
      const col = curveSamples.map((c) => c[gi]).filter(isFinite).sort((a, b) => a - b);
      centre.push({ x: t, y: Math.max(0, model(base.p, t)) });
      if (col.length > 10) {
        bandLo.push(Math.max(0, col[Math.floor(col.length * 0.1)]));
        bandHi.push(Math.max(0, col[Math.floor(col.length * 0.9)]));
      } else { bandLo.push(NaN); bandHi.push(NaN); }
    });

    const etaFinite = etaSamples.filter((v) => isFinite(v)).sort((a, b) => a - b);
    const etaPoint = timeToThreshold(base.p, threshold);
    const reachable = etaFinite.length / Math.max(1, etaSamples.length);
    const eta = {
      point: etaPoint,
      lo: etaFinite.length > 10 ? etaFinite[Math.floor(etaFinite.length * 0.1)] : null,
      hi: etaFinite.length > 10 ? etaFinite[Math.floor(etaFinite.length * 0.9)] : null,
      reachable
    };

    const recent = ys.slice(-Math.min(5, n));
    const recentSlope = S.linreg(ts.slice(-recent.length), recent).slope;

    return {
      ok: true,
      n,
      params: base.p,
      r2: base.r2,
      rmse: base.rmse,
      halfLife: base.p.tau * Math.LN2,
      tauCi: tauSamples.length > 10 ? [
        tauSamples.slice().sort((a, b) => a - b)[Math.floor(tauSamples.length * 0.1)],
        tauSamples.slice().sort((a, b) => a - b)[Math.floor(tauSamples.length * 0.9)]
      ] : null,
      eta,
      threshold,
      grid,
      centre,
      band: grid.map((t, i) => ({ x: t, lo: bandLo[i], hi: bandHi[i] })).filter((d) => isFinite(d.lo) && isFinite(d.hi)),
      observed: pts.map((p) => ({ x: p.t, y: p.y })),
      linear: lin,
      recentSlope,
      plateau: base.p.C,
      quality: base.r2 >= 0.6 ? "good" : base.r2 >= 0.25 ? "fair" : "weak",
      usable
    };
  }

  CAD.trajectory = { analyse, fitExponential, model, timeToThreshold };
})();
