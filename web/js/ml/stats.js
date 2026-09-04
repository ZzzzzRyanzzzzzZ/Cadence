(function () {
  const CAD = window.CAD;

  function sum(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : NaN; }
  function variance(a) {
    if (a.length < 2) return NaN;
    const m = mean(a);
    let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return s / (a.length - 1);
  }
  function sd(a) { return Math.sqrt(variance(a)); }
  function median(a) {
    if (!a.length) return NaN;
    const b = a.slice().sort((x, y) => x - y);
    const mid = b.length >> 1;
    return b.length % 2 ? b[mid] : (b[mid - 1] + b[mid]) / 2;
  }
  function quantile(a, q) {
    if (!a.length) return NaN;
    const b = a.slice().sort((x, y) => x - y);
    const pos = (b.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    return b[lo] + (b[hi] - b[lo]) * (pos - lo);
  }
  function iqr(a) { return quantile(a, 0.75) - quantile(a, 0.25); }
  function mad(a) {
    const m = median(a);
    return median(a.map((x) => Math.abs(x - m)));
  }
  function robustZ(x, a) {
    const m = median(a);
    const scale = 1.4826 * mad(a);
    if (!isFinite(scale) || scale < 1e-9) {
      const s = sd(a);
      if (!isFinite(s) || s < 1e-9) return 0;
      return (x - mean(a)) / s;
    }
    return (x - m) / scale;
  }

  function rank(a) {
    const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
    const out = new Array(a.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[idx[k][1]] = r;
      i = j + 1;
    }
    return out;
  }

  function pearson(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return NaN;
    const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const a = x[i] - mx, b = y[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    if (dx === 0 || dy === 0) return NaN;
    return num / Math.sqrt(dx * dy);
  }

  function spearman(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 3) return NaN;
    return pearson(rank(x.slice(0, n)), rank(y.slice(0, n)));
  }

  function linreg(x, y) {
    const n = Math.min(x.length, y.length);
    if (n < 2) return { slope: NaN, intercept: NaN, r2: NaN };
    const mx = mean(x), my = mean(y);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); den += (x[i] - mx) * (x[i] - mx); }
    const slope = den === 0 ? 0 : num / den;
    const intercept = my - slope * mx;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      const pred = intercept + slope * x[i];
      ssRes += (y[i] - pred) * (y[i] - pred);
      ssTot += (y[i] - my) * (y[i] - my);
    }
    return { slope, intercept, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot };
  }

  function erf(x) {
    const s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return s * y;
  }
  function normalCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function normalInv(p) {
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q, r;
    if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  function dPrime(hits, targets, falseAlarms, nonTargets) {
    const hr = (hits + 0.5) / (targets + 1);
    const far = (falseAlarms + 0.5) / (nonTargets + 1);
    return normalInv(Math.min(0.999, Math.max(0.001, hr))) - normalInv(Math.min(0.999, Math.max(0.001, far)));
  }

  function ewma(values, alpha) {
    const out = [];
    let prev = null;
    for (let i = 0; i < values.length; i++) {
      prev = prev === null ? values[i] : alpha * values[i] + (1 - alpha) * prev;
      out.push(prev);
    }
    return out;
  }

  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat([b[i]]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) return null;
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  function permutationP(x, y, statFn, iterations) {
    const observed = Math.abs(statFn(x, y));
    if (!isFinite(observed)) return 1;
    const iter = iterations || 2000;
    let extreme = 0;
    for (let i = 0; i < iter; i++) {
      const shuffled = CAD.shuffle(y);
      const stat = Math.abs(statFn(x, shuffled));
      if (isFinite(stat) && stat >= observed) extreme++;
    }
    return (extreme + 1) / (iter + 1);
  }

  function benjaminiHochberg(pValues, alpha) {
    const a = alpha === undefined ? 0.1 : alpha;
    const n = pValues.length;
    const order = pValues.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
    const flags = new Array(n).fill(false);
    let maxK = -1;
    order.forEach((o, k) => { if (o.p <= ((k + 1) / n) * a) maxK = k; });
    for (let k = 0; k <= maxK; k++) flags[order[k].i] = true;
    return flags;
  }

  function clampFinite(v, fallback) { return isFinite(v) ? v : (fallback === undefined ? 0 : fallback); }

  CAD.stats = {
    sum, mean, variance, sd, median, quantile, iqr, mad, robustZ, rank,
    pearson, spearman, linreg, erf, normalCdf, normalInv, dPrime, ewma,
    solve, permutationP, benjaminiHochberg, clampFinite
  };
})();
