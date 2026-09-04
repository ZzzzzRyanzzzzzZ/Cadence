(function () {
  const CAD = window.CAD;
  const S = CAD.stats;

  const WINDOW_MS = 20000;
  const BASELINE_WINDOWS = 8;
  const MAX_LOG = 400;

  const SIGNALS = [
    {
      id: "tortuosity",
      label: "Pointer steadiness",
      plain: "how straight your cursor travels between two points",
      weight: 1.1,
      worseWhen: "up",
      why: "Motor noise rises with fatigue and with vestibular symptoms. A wandering path to the same target is one of the earliest things to change."
    },
    {
      id: "reversals",
      label: "Scroll re-reading",
      plain: "how often you scroll back up over something you just passed",
      weight: 1.0,
      worseWhen: "up",
      why: "Reversing direction usually means a line did not land the first time. It tracks reading comprehension load without asking you anything."
    },
    {
      id: "corrections",
      label: "Typing corrections",
      plain: "backspaces as a share of what you type",
      weight: 0.9,
      worseWhen: "up",
      why: "Correction rate climbs before people notice they are struggling — a classic index of cognitive load."
    },
    {
      id: "refocus",
      label: "Attention breaks",
      plain: "how often you leave the tab and come back",
      weight: 0.7,
      worseWhen: "up",
      why: "Frequent task-switching away from a page is a behavioural marker of attentional fatigue."
    },
    {
      id: "pauses",
      label: "Long pauses",
      plain: "gaps of eight seconds or more between actions",
      weight: 0.7,
      worseWhen: "up",
      why: "Micro-pauses lengthen as processing slows, even when the person feels they are keeping up."
    },
    {
      id: "dwell",
      label: "Time on screen",
      plain: "unbroken minutes in this session",
      weight: 1.2,
      worseWhen: "up",
      why: "Screen exposure is the single most common self-reported trigger after concussion, and it accumulates whether or not you feel it yet."
    }
  ];

  const LEVELS = [
    { id: "ok", min: 0, label: "Comfortable", tone: "good" },
    { id: "soft", min: 56, label: "Easing off", tone: "warning" },
    { id: "rest", min: 74, label: "Time to stop", tone: "serious" }
  ];

  const live = {
    running: false,
    strain: null,
    level: "ok",
    signals: {},
    zs: {},
    windowStart: 0,
    sessionStart: 0,
    lastEventAt: 0,
    raw: null,
    subscribers: new Set(),
    sustainedSince: null,
    manualOverrideUntil: 0
  };

  function blankRaw() {
    return {
      pathLength: 0,
      netStart: null,
      netEnd: null,
      moveCount: 0,
      reversals: 0,
      lastScrollDir: 0,
      lastScrollY: window.scrollY,
      keystrokes: 0,
      backspaces: 0,
      refocus: 0,
      pauses: 0
    };
  }

  function ensureState() {
    const s = CAD.store.get();
    if (!s.tolerance) {
      s.tolerance = { enabled: true, adapt: true, baseline: {}, log: [], acknowledged: false };
    }
    if (!s.tolerance.baseline) s.tolerance.baseline = {};
    if (!s.tolerance.log) s.tolerance.log = [];
    return s.tolerance;
  }

  function onPointerMove(e) {
    const r = live.raw;
    if (!r) return;
    const p = { x: e.clientX, y: e.clientY };
    if (r.netStart === null) r.netStart = p;
    if (r.netEnd) {
      const dx = p.x - r.netEnd.x;
      const dy = p.y - r.netEnd.y;
      const step = Math.sqrt(dx * dx + dy * dy);
      if (step > 1 && step < 400) r.pathLength += step;
    }
    r.netEnd = p;
    r.moveCount++;
    mark();
  }

  function onScroll() {
    const r = live.raw;
    if (!r) return;
    const y = window.scrollY;
    const delta = y - r.lastScrollY;
    if (Math.abs(delta) < 6) return;
    const dir = delta > 0 ? 1 : -1;
    if (r.lastScrollDir !== 0 && dir !== r.lastScrollDir) r.reversals++;
    r.lastScrollDir = dir;
    r.lastScrollY = y;
    mark();
  }

  function onKey(e) {
    const r = live.raw;
    if (!r) return;
    if (e.key === "Backspace" || e.key === "Delete") r.backspaces++;
    else if (e.key.length === 1) r.keystrokes++;
    mark();
  }

  function onVisibility() {
    const r = live.raw;
    if (!r) return;
    if (document.visibilityState === "visible") r.refocus++;
    mark();
  }

  function mark() {
    const now = Date.now();
    if (live.lastEventAt && now - live.lastEventAt > 8000 && live.raw) live.raw.pauses++;
    live.lastEventAt = now;
  }

  function collect() {
    const r = live.raw;
    const minutes = WINDOW_MS / 60000;
    let tortuosity = 1;
    if (r.netStart && r.netEnd && r.moveCount > 12) {
      const dx = r.netEnd.x - r.netStart.x;
      const dy = r.netEnd.y - r.netStart.y;
      const net = Math.max(40, Math.sqrt(dx * dx + dy * dy));
      tortuosity = CAD.clamp(r.pathLength / net, 1, 25);
    }
    return {
      tortuosity,
      reversals: r.reversals / minutes,
      corrections: r.keystrokes + r.backspaces > 12 ? r.backspaces / (r.keystrokes + r.backspaces) : 0,
      refocus: r.refocus / minutes,
      pauses: r.pauses / minutes,
      dwell: (Date.now() - live.sessionStart) / 60000
    };
  }

  function score(sample) {
    const store = ensureState();
    const zs = {};
    let weighted = 0;
    let weightSum = 0;
    let ready = 0;

    SIGNALS.forEach((sig) => {
      const hist = (store.baseline[sig.id] || []).slice();
      if (hist.length >= 4) {
        const z = S.robustZ(sample[sig.id], hist);
        zs[sig.id] = isFinite(z) ? CAD.clamp(z, -4, 6) : 0;
        ready++;
      } else {
        zs[sig.id] = 0;
      }
      weighted += (zs[sig.id] || 0) * sig.weight;
      weightSum += sig.weight;
    });

    const meanZ = weightSum ? weighted / weightSum : 0;
    const dwellPush = CAD.clamp((sample.dwell - 12) / 18, 0, 1) * 14;
    const strain = CAD.clamp(50 + meanZ * 13 + dwellPush, 0, 100);
    return { strain, zs, ready, calibrating: ready < 3 };
  }

  function levelFor(strain) {
    let out = LEVELS[0];
    LEVELS.forEach((l) => { if (strain >= l.min) out = l; });
    return out;
  }

  function apply(level) {
    const store = ensureState();
    if (!store.adapt || Date.now() < live.manualOverrideUntil) {
      document.documentElement.dataset.comfort = "ok";
      return;
    }
    document.documentElement.dataset.comfort = level;
  }

  function tick() {
    if (!live.running) return;
    const sample = collect();
    const result = score(sample);
    const store = ensureState();

    SIGNALS.forEach((sig) => {
      if (!store.baseline[sig.id]) store.baseline[sig.id] = [];
      if (sig.id === "dwell") return;
      if (store.baseline[sig.id].length < BASELINE_WINDOWS * 3) {
        store.baseline[sig.id].push(Number(sample[sig.id].toFixed(4)));
      } else if (result.strain < 60) {
        store.baseline[sig.id].push(Number(sample[sig.id].toFixed(4)));
        if (store.baseline[sig.id].length > 60) store.baseline[sig.id].shift();
      }
    });

    live.strain = result.strain;
    live.signals = sample;
    live.zs = result.zs;
    live.calibrating = result.calibrating;

    const lvl = levelFor(result.strain);
    if (lvl.id === "rest") {
      if (!live.sustainedSince) live.sustainedSince = Date.now();
    } else {
      live.sustainedSince = null;
    }
    const effective = lvl.id === "rest" && Date.now() - live.sustainedSince < 40000 ? "soft" : lvl.id;
    live.level = effective;
    apply(effective);

    store.log.push({ ts: Date.now(), strain: Math.round(result.strain), level: effective });
    if (store.log.length > MAX_LOG) store.log.splice(0, store.log.length - MAX_LOG);
    CAD.store.save();

    live.raw = blankRaw();
    live.windowStart = Date.now();
    live.subscribers.forEach((fn) => { try { fn(snapshot()); } catch (e) {} });
  }

  function snapshot() {
    return {
      strain: live.strain,
      level: live.level,
      calibrating: live.calibrating,
      signals: live.signals,
      zs: live.zs,
      running: live.running,
      sessionMinutes: live.sessionStart ? (Date.now() - live.sessionStart) / 60000 : 0
    };
  }

  let timer = null;

  function start() {
    const store = ensureState();
    if (live.running || !store.enabled) return;
    live.running = true;
    live.raw = blankRaw();
    live.sessionStart = Date.now();
    live.windowStart = Date.now();
    live.lastEventAt = Date.now();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    timer = setInterval(tick, WINDOW_MS);
  }

  function stop() {
    live.running = false;
    clearInterval(timer);
    timer = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("keydown", onKey);
    document.removeEventListener("visibilitychange", onVisibility);
    document.documentElement.dataset.comfort = "ok";
  }

  function resetSession() {
    live.sessionStart = Date.now();
    live.sustainedSince = null;
    live.raw = blankRaw();
    live.strain = Math.min(live.strain === null ? 40 : live.strain, 45);
    live.level = "ok";
    apply("ok");
    live.subscribers.forEach((fn) => { try { fn(snapshot()); } catch (e) {} });
  }

  function overrideFor(minutes) {
    live.manualOverrideUntil = Date.now() + minutes * 60000;
    document.documentElement.dataset.comfort = "ok";
  }

  function subscribe(fn) {
    live.subscribers.add(fn);
    return () => live.subscribers.delete(fn);
  }

  function dailyMean(dayKey) {
    const store = ensureState();
    const rows = store.log.filter((r) => CAD.fmt.dayKey(r.ts) === dayKey);
    if (!rows.length) return null;
    return S.mean(rows.map((r) => r.strain));
  }

  function todayStats() {
    const store = ensureState();
    const key = CAD.store.todayKey();
    const rows = store.log.filter((r) => CAD.fmt.dayKey(r.ts) === key);
    if (!rows.length) return null;
    return {
      mean: S.mean(rows.map((r) => r.strain)),
      peak: Math.max.apply(null, rows.map((r) => r.strain)),
      windows: rows.length,
      minutesTracked: Math.round((rows.length * WINDOW_MS) / 60000),
      restWindows: rows.filter((r) => r.level === "rest").length
    };
  }

  CAD.tolerance = {
    SIGNALS, LEVELS, WINDOW_MS,
    start, stop, tick, snapshot, subscribe, resetSession, overrideFor,
    levelFor, dailyMean, todayStats, ensureState
  };
})();
