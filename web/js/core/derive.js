(function () {
  const CAD = window.CAD;
  const S = CAD.stats;

  const cache = {};

  function key(state) {
    return [
      state.checkins.length,
      state.cognitionRuns.length,
      state.oculomotorRuns.length,
      state.balanceRuns.length,
      state.protocol.stage,
      state.protocol.track,
      state.checkins.length ? state.checkins[state.checkins.length - 1].ts : 0
    ].join("|");
  }

  function memo(name, state, fn) {
    const k = key(state);
    if (!cache[name] || cache[name].k !== k) cache[name] = { k, v: fn() };
    return cache[name].v;
  }

  function dayIndex(state, dayKey) {
    const anchor = state.profile.injuryDate || (state.checkins.length ? state.checkins[0].day : dayKey);
    return CAD.fmt.daysBetween(anchor, CAD.fmt.fromKey(dayKey));
  }

  function trajectoryPoints(state) {
    return state.checkins.map((c) => ({ t: dayIndex(state, c.day), y: c.total, day: c.day }));
  }

  function trajectory(state) {
    return memo("trajectory", state, () => CAD.trajectory.analyse(trajectoryPoints(state), { threshold: 5 }));
  }

  function triggers(state) {
    return memo("triggers", state, () => CAD.triggers.analyse(state));
  }

  function anomaly(state) {
    return memo("anomaly", state, () => CAD.anomaly.detect(state));
  }

  function rciSummary(state) {
    return memo("rci", state, () => CAD.rci.summary(state));
  }

  function latestCheckin(state) {
    return state.checkins.length ? state.checkins[state.checkins.length - 1] : null;
  }

  function todayCheckin(state) {
    return CAD.store.checkinFor(CAD.store.todayKey());
  }

  function streak(state) {
    let n = 0;
    let cursor = new Date();
    for (;;) {
      const k = CAD.fmt.dayKey(cursor);
      if (state.checkins.some((c) => c.day === k)) { n++; cursor = new Date(cursor.getTime() - CAD.DAY); }
      else break;
      if (n > 400) break;
    }
    if (n === 0) {
      const y = CAD.fmt.dayKey(new Date(Date.now() - CAD.DAY));
      if (state.checkins.some((c) => c.day === y)) {
        let m = 0;
        let cur = new Date(Date.now() - CAD.DAY);
        for (;;) {
          const k = CAD.fmt.dayKey(cur);
          if (state.checkins.some((c) => c.day === k)) { m++; cur = new Date(cur.getTime() - CAD.DAY); } else break;
          if (m > 400) break;
        }
        return m;
      }
    }
    return n;
  }

  function lastRun(state, collection, task) {
    const runs = state[collection].filter((r) => (task ? r.task === task : true));
    return runs.length ? runs[runs.length - 1] : null;
  }

  function daysSince(ts) {
    if (!ts) return null;
    return Math.floor((Date.now() - ts) / CAD.DAY);
  }

  function todayTasks(state) {
    const today = CAD.store.todayKey();
    const tasks = [];
    tasks.push({
      id: "checkin",
      label: "Symptom check-in",
      sub: "22 items, about 90 seconds",
      href: "#/checkin",
      icon: "checkin",
      done: !!CAD.store.checkinFor(today)
    });
    const cogToday = state.cognitionRuns.some((r) => CAD.fmt.dayKey(r.ts) === today);
    tasks.push({
      id: "cognition",
      label: "Cognitive battery",
      sub: state.baseline.capturedAt ? "Track reaction time and attention" : "Capture your baseline first",
      href: "#/cognition",
      icon: "cognition",
      done: cogToday
    });
    const oculoLast = lastRun(state, "oculomotorRuns");
    tasks.push({
      id: "oculomotor",
      label: "Oculomotor screen",
      sub: oculoLast ? "Last run " + CAD.fmt.shortDate(oculoLast.ts) : "Seven guided eye and head movements",
      href: "#/oculomotor",
      icon: "eye",
      done: oculoLast ? CAD.fmt.dayKey(oculoLast.ts) === today : false,
      optional: true
    });
    const balLast = lastRun(state, "balanceRuns");
    tasks.push({
      id: "balance",
      label: "Balance test",
      sub: balLast ? "Last run " + CAD.fmt.shortDate(balLast.ts) : "Three 20-second stances",
      href: "#/balance",
      icon: "balance",
      done: balLast ? CAD.fmt.dayKey(balLast.ts) === today : false,
      optional: true
    });
    return tasks;
  }

  function insights(state) {
    const out = [];
    const traj = trajectory(state);
    const anom = anomaly(state);
    const trig = triggers(state);
    const rc = rciSummary(state);
    const latest = latestCheckin(state);

    if (anom.ok && anom.flagged) {
      const top = anom.strong[0] || anom.adverse[0];
      out.push({
        priority: 1,
        tone: "serious",
        icon: "alert",
        title: "Today reads off your own trend",
        body: top
          ? top.label + " is " + CAD.fmt.signed(top.delta, 1) + " against a personal forecast of " + CAD.fmt.n(top.expected, 1) + " (robust z = " + CAD.fmt.n(top.z, 1) + ")."
          : "Several inputs moved together against your recent pattern.",
        why: "Compared with an exponentially weighted forecast built from your own history, not from population averages."
      });
    }

    if (traj.ok) {
      if (traj.recentSlope > 0.6) {
        out.push({
          priority: 2, tone: "warning", icon: "trend",
          title: "Symptom scores have been climbing",
          body: "Your last few check-ins trend upward by about " + CAD.fmt.n(traj.recentSlope, 1) + " points per day. That usually means the current activity step is too big.",
          why: "Least-squares slope over your five most recent check-ins."
        });
      } else if (traj.eta && traj.eta.point !== null && isFinite(traj.eta.point)) {
        const daysOut = traj.eta.point - (traj.observed.length ? traj.observed[traj.observed.length - 1].x : 0);
        if (daysOut > 0) {
          out.push({
            priority: 4, tone: "good", icon: "trend",
            title: "Modelled recovery curve is holding",
            body: "The fitted decay puts a symptom score under " + traj.threshold + " around " + Math.round(daysOut) + " days from now" + (traj.eta.lo !== null ? " (80% interval " + Math.max(0, Math.round(traj.eta.lo - (traj.observed[traj.observed.length - 1].x))) + "–" + Math.round(traj.eta.hi - traj.observed[traj.observed.length - 1].x) + " days)" : "") + ".",
            why: "Non-linear least-squares fit of an exponential decay, with residual bootstrap intervals. A projection of your curve so far, not a prognosis."
          });
        }
      }
    }

    trig.findings.slice(0, 3).forEach((f, i) => {
      out.push({
        priority: 3 + i * 0.1,
        tone: f.direction === "worse" ? "warning" : "good",
        icon: "sparkle",
        title: f.title,
        body: f.detail,
        why: f.advice
      });
    });

    rc.declines.slice(0, 2).forEach((d) => {
      out.push({
        priority: 2.5,
        tone: "warning",
        icon: "cognition",
        title: d.metric.label + " is below your baseline",
        body: "Reliable Change Index " + CAD.fmt.n(d.rci, 2) + " against a baseline of " + CAD.fmt.n(d.baselineValue, d.metric.unit === "ms" ? 0 : 2) + " " + d.metric.unit + ". This is larger than ordinary test-retest noise.",
        why: "Standard error of difference from " + (d.method === "personal" ? "your own repeat sessions" : "published test-retest estimates") + "."
      });
    });

    rc.improves.slice(0, 1).forEach((d) => {
      out.push({
        priority: 5, tone: "good", icon: "check",
        title: d.metric.label + " has recovered past baseline",
        body: "Reliable Change Index " + CAD.fmt.n(d.rci, 2) + ", which clears the reliable-change threshold.",
        why: "Improvement this size is unlikely to be practice effect alone, but repeated testing does make tasks easier."
      });
    });

    if (latest && latest.total === 0) {
      out.push({
        priority: 1.5, tone: "good", icon: "check",
        title: "Symptom-free check-in logged",
        body: "Symptom-free at rest is the entry condition for the next step, not the finish line — the graded strategy still applies.",
        why: "Amsterdam 2023 consensus keeps a minimum 24 hours at each step even when you feel well."
      });
    }

    if (!out.length) {
      out.push({
        priority: 9, tone: "neutral", icon: "info",
        title: "Keep checking in",
        body: "Models here need repeated measurements from you before they say anything. Four check-ins unlocks the trajectory fit, six unlocks off-trend detection, eight unlocks the trigger finder.",
        why: "Every model in Cadence is fitted to your data alone."
      });
    }

    return out.sort((a, b) => a.priority - b.priority);
  }

  function weeklyDelta(state) {
    const cs = state.checkins;
    if (cs.length < 4) return null;
    const last7 = cs.slice(-7).map((c) => c.total);
    const prev7 = cs.slice(-14, -7).map((c) => c.total);
    if (!prev7.length) return null;
    return S.mean(last7) - S.mean(prev7);
  }

  CAD.derive = {
    dayIndex, trajectoryPoints, trajectory, triggers, anomaly, rciSummary,
    latestCheckin, todayCheckin, streak, todayTasks, insights, lastRun, daysSince, weeklyDelta
  };
})();
