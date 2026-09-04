(function () {
  const CAD = window.CAD;

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const WEIGHTS = {
    headache: 1.00, pressure: 0.80, neck: 0.45, nausea: 0.35, dizzy: 0.75, blurred: 0.55,
    balance: 0.50, light: 0.90, noise: 0.85, slowed: 0.80, fog: 0.85, notright: 0.75,
    concentrate: 0.90, remember: 0.65, confusion: 0.35, fatigue: 0.95, drowsy: 0.60,
    sleeponset: 0.55, emotional: 0.45, irritable: 0.60, sad: 0.35, anxious: 0.50
  };

  function build(days) {
    const r = rng(20240917);
    const n = days || 28;
    const injury = new Date(Date.now() - (n - 1) * CAD.DAY);
    const state = CAD.store.blank();

    state.profile = {
      name: "Sam",
      ageBand: "13-17",
      sexAtBirth: "female",
      injuryDate: CAD.fmt.dayKey(injury),
      mechanism: "Sport — collision during soccer",
      priorConcussions: 1,
      priorProlonged: true,
      migraineHistory: true,
      anxietyOrMoodHistory: false,
      learningOrAdhd: false,
      lossOfConsciousness: false,
      amnesia: true,
      answeredSlowly: true,
      seenClinician: true,
      clinicianNote: "Seen in clinic day 2. Cleared to start graded return-to-learn."
    };
    state.settings = Object.assign(state.settings, { onboarded: true, acknowledgedDisclaimer: true, reduceMotion: true });

    const screen = [], sleep = [], exercise = [], stress = [], cognitive = [];
    for (let d = 0; d < n; d++) {
      const ramp = Math.min(1, d / 16);
      let sc = 25 + ramp * 130 + (r() - 0.5) * 40;
      if (d === 5 || d === 10 || d === 17) sc = 215 + (r() - 0.5) * 40;
      if (d === 22) sc = 155 + (r() - 0.5) * 30;
      if (d === 8 || d === 14 || d === 20) sc = 35 + (r() - 0.5) * 20;
      screen.push(Math.max(10, Math.round(sc)));
      let sl = 8.4 - ramp * 0.7 + (r() - 0.5) * 1.6;
      if (d === 10) sl = 5.4;
      if (d === 17) sl = 6.0;
      sleep.push(Number(sl.toFixed(1)));
      exercise.push(d < 5 ? 0 : Math.round(Math.max(0, (d - 4) * 3.4 + (r() - 0.5) * 12)));
      stress.push(Math.round(CAD.clamp(4 + (r() - 0.5) * 4 + (d === 10 ? 3 : 0), 0, 10)));
      cognitive.push(d < 3 ? 0 : Math.round(Math.min(300, (d - 2) * 16 + (r() - 0.5) * 40)));
    }

    const totals = [];
    for (let d = 0; d < n; d++) {
      let signal = 47 * Math.exp(-d / 7.6) + 0.2;
      if (d >= 1) signal += 0.075 * Math.max(0, screen[d - 1] - 95);
      if (d >= 1) signal += 1.3 * Math.max(0, 7.2 - sleep[d - 1]);
      const noise = (r() - 0.5) * (1.4 + signal * 0.2);
      totals.push(Math.max(0, Math.round(signal + noise)));
    }

    for (let d = 0; d < n; d++) {
      const day = CAD.fmt.dayKey(new Date(injury.getTime() + d * CAD.DAY));
      const target = totals[d];
      const weightSum = Object.keys(WEIGHTS).reduce((s, k) => s + WEIGHTS[k], 0);
      const pcss = {};
      let running = 0;
      CAD.pcss.SYMPTOMS.forEach((sym) => {
        const share = (WEIGHTS[sym.id] / weightSum) * target;
        const jitter = (r() - 0.45) * 0.9;
        const v = Math.round(CAD.clamp(share + jitter, 0, 6));
        pcss[sym.id] = v;
        running += v;
      });
      let guard = 0;
      while (running > target && guard < 200) {
        const keys = Object.keys(pcss).filter((k) => pcss[k] > 0);
        if (!keys.length) break;
        const k = keys[Math.floor(r() * keys.length)];
        pcss[k] -= 1; running -= 1; guard++;
      }
      guard = 0;
      while (running < target && guard < 200) {
        const keys = Object.keys(pcss).filter((k) => pcss[k] < 6);
        if (!keys.length) break;
        const k = keys[Math.floor(r() * keys.length)];
        pcss[k] += 1; running += 1; guard++;
      }
      const scored = CAD.pcss.scorePcss(pcss);
      const entry = {
        id: CAD.uid(),
        day,
        ts: new Date(injury.getTime() + d * CAD.DAY).setHours(20, 15, 0, 0),
        pcss,
        total: scored.total,
        count: scored.count,
        clusters: scored.clusters,
        counts: scored.counts,
        sleepHours: sleep[d],
        screenMinutes: screen[d],
        exerciseMinutes: exercise[d],
        cognitiveMinutes: cognitive[d],
        screenStrain: Math.round(CAD.clamp(38 + (screen[d] - 90) * 0.085 + (r() - 0.5) * 9, 18, 96)),
        stress: stress[d],
        exacerbation: Math.round(CAD.clamp((totals[d] - (totals[d - 1] === undefined ? totals[d] : totals[d - 1])) / 3, 0, 6)),
        notes: d === 10 ? "Tried to catch up on three days of homework in one evening. Rough night." : ""
      };
      if (d % 4 === 0) {
        const sev = Math.min(3, Math.round(scored.clusters.emotional / 4));
        entry.phq = { phq1: Math.max(0, sev - 1), phq2: sev };
        entry.gad = { gad1: sev, gad2: Math.max(0, sev - 1) };
      }
      state.checkins.push(entry);
    }

    const cogDays = [1, 8, 15, 22];
    const tasks = {
      srt: (f) => ({ medianRt: 268 + 96 * f, iqrRt: 34 + 26 * f, lapses: Math.round(4.6 * f), anticipations: 0, trials: 20 }),
      gng: (f) => ({ medianRt: 392 + 118 * f, commissions: Math.round(1 + 5.4 * f), omissions: Math.round(0.4 + 2.2 * f), dprime: 3.2 - 1.5 * f, accuracy: 0.97 - 0.13 * f, trials: 60 }),
      stroop: (f) => ({ congruentRt: 620 + 130 * f, incongruentRt: 700 + 300 * f, interference: 80 + 170 * f, accuracy: 0.96 - 0.1 * f, trials: 48 }),
      nback: (f) => ({ dprime: 2.65 - 1.35 * f, hits: Math.round(17 - 5 * f), falseAlarms: Math.round(1 + 5 * f), medianRt: 560 + 200 * f, trials: 60 }),
      pursuit: (f) => ({ rmseNorm: 0.041 + 0.062 * f, onTarget: 0.88 - 0.3 * f, lagMs: 110 + 190 * f, samples: 900 }),
      rapid: (f) => ({ totalSec: 42.5 + 20 * f, errors: Math.round(0.3 + 2.4 * f), cards: 3 })
    };
    cogDays.forEach((d, i) => {
      const f = Math.max(0, Math.exp(-d / 9.5));
      Object.keys(tasks).forEach((t) => {
        const metrics = tasks[t](f);
        Object.keys(metrics).forEach((k) => {
          if (typeof metrics[k] === "number" && k !== "trials" && k !== "cards" && k !== "samples") {
            metrics[k] = Number((metrics[k] * (1 + (r() - 0.5) * 0.06)).toFixed(3));
          }
        });
        const run = {
          id: CAD.uid(),
          ts: new Date(injury.getTime() + d * CAD.DAY).setHours(17, 30, 0, 0),
          task: t,
          metrics,
          isBaseline: i === 0
        };
        state.cognitionRuns.push(run);
        if (i === 0) state.baseline.cognition[t] = metrics;
      });
    });
    state.baseline.capturedAt = new Date(injury.getTime() + CAD.DAY).setHours(17, 30, 0, 0);

    [[2, 12, 5, 4, 3], [13, 6, 2, 2, 2], [21, 3, 1, 1, 1]].forEach((row) => {
      state.balanceRuns.push({
        id: CAD.uid(),
        ts: new Date(injury.getTime() + row[0] * CAD.DAY).setHours(18, 0, 0, 0),
        double: row[3] - 3 >= 0 ? row[3] - 3 : 0,
        single: row[2],
        tandem: row[4],
        total: row[1],
        surface: "firm",
        footwear: "barefoot"
      });
    });

    const oculoRuns = [
      { d: 2, base: { headache: 3, dizziness: 2, nausea: 1, fogginess: 3 }, bump: 3, npc: 9.5 },
      { d: 14, base: { headache: 1, dizziness: 1, nausea: 0, fogginess: 1 }, bump: 2, npc: 7.0 },
      { d: 22, base: { headache: 0, dizziness: 0, nausea: 0, fogginess: 1 }, bump: 1, npc: 5.5 }
    ];
    oculoRuns.forEach((o) => {
      const items = {};
      CAD.oculo.ITEMS.forEach((item, idx) => {
        if (item.id === "convergence") return;
        const extra = idx < 3 ? Math.max(0, o.bump - 1) : o.bump;
        items[item.id] = {
          headache: CAD.clamp(o.base.headache + (idx % 2 === 0 ? extra : extra - 1), 0, 10),
          dizziness: CAD.clamp(o.base.dizziness + (idx > 3 ? extra : 0), 0, 10),
          nausea: CAD.clamp(o.base.nausea + (idx > 4 ? extra - 1 : 0), 0, 10),
          fogginess: CAD.clamp(o.base.fogginess + Math.max(0, extra - 1), 0, 10)
        };
      });
      state.oculomotorRuns.push({
        id: CAD.uid(),
        ts: new Date(injury.getTime() + o.d * CAD.DAY).setHours(16, 0, 0, 0),
        baseline: o.base,
        items,
        npcCm: o.npc
      });
    });

    state.protocol = {
      track: "learn",
      stage: 3,
      stageStartedAt: Date.now() - 30 * 3600000,
      history: [
        { ts: injury.getTime() + 2 * CAD.DAY, stage: 2, event: "advanced", track: "learn" },
        { ts: injury.getTime() + 6 * CAD.DAY, stage: 3, event: "advanced", track: "learn" },
        { ts: injury.getTime() + 11 * CAD.DAY, stage: 2, event: "stepped back", track: "learn", reason: "Symptom flare after a long homework session" },
        { ts: Date.now() - 30 * 3600000, stage: 3, event: "advanced", track: "learn" }
      ]
    };

    state.journal = [
      { id: CAD.uid(), ts: injury.getTime() + 5 * CAD.DAY, prompt: "What did today ask of me that I could not give?", text: "Missed the tournament. Everyone keeps asking when I'm back and I don't know what to say.", mood: 3 },
      { id: CAD.uid(), ts: injury.getTime() + 11 * CAD.DAY, prompt: "What is the thought, and what is the evidence?", text: "Thought: I'm going to fall behind and lose my spot. Evidence against: coach texted that my spot is fine, and I'm two weeks in, not two months.", mood: 4 },
      { id: CAD.uid(), ts: injury.getTime() + 19 * CAD.DAY, prompt: "One thing that went better than last week", text: "Read for 40 minutes straight with no headache. First time since the hit.", mood: 7 }
    ];

    const ladderPlan = [
      { title: "Read for 10 minutes", category: "screen", tries: [[7, 4], [6, 3], [4, 2], [3, 2]] },
      { title: "Walk outside for 20 minutes", category: "motion", tries: [[6, 5], [5, 2], [3, 2]] },
      { title: "Sit in the cafeteria at lunch", category: "social", tries: [[9, 7], [8, 5], [6, 5]] },
      { title: "Ride in the car to school", category: "motion", tries: [[8, 6], [6, 4]] },
      { title: "Watch practice from the sideline", category: "social", tries: [[7, 3]] },
      { title: "Do 30 minutes of catch up work", category: "load", tries: [] }
    ];
    state.ladder = {
      items: ladderPlan.map((plan, idx) => ({
        id: CAD.uid(),
        title: plan.title,
        category: plan.category,
        createdAt: injury.getTime() + (5 + idx) * CAD.DAY,
        attempts: plan.tries.map((pair, j) => ({
          ts: injury.getTime() + (8 + idx + j * 4) * CAD.DAY,
          predicted: pair[0],
          actual: pair[1],
          note: idx === 2 && j === 0 ? "Lasted about ten minutes then had to leave. Still less bad than I had built it up to be." : ""
        }))
      }))
    };

    state.redFlagChecks = [{ ts: injury.getTime() + CAD.DAY, flags: [], clear: true }];

    return state;
  }

  function load(days) {
    CAD.store.replace(build(days));
  }

  CAD.seed = { build, load };
})();
