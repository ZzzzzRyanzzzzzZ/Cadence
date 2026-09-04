(function () {
  const CAD = window.CAD;
  const KEY = "cadence.state.v1";

  function blank() {
    return {
      version: 1,
      createdAt: Date.now(),
      profile: {
        name: "",
        ageBand: "",
        sexAtBirth: "",
        injuryDate: "",
        mechanism: "",
        priorConcussions: 0,
        priorProlonged: false,
        migraineHistory: false,
        anxietyOrMoodHistory: false,
        learningOrAdhd: false,
        lossOfConsciousness: false,
        amnesia: false,
        answeredSlowly: false,
        seenClinician: false,
        clinicianNote: ""
      },
      settings: {
        theme: "light",
        fontScale: 1,
        reduceMotion: true,
        highContrast: false,
        dyslexic: false,
        speech: false,
        restReminderMin: 15,
        onboarded: false,
        acknowledgedDisclaimer: false
      },
      baseline: { cognition: {}, capturedAt: null },
      checkins: [],
      cognitionRuns: [],
      oculomotorRuns: [],
      balanceRuns: [],
      journal: [],
      protocol: {
        track: "learn",
        stage: 1,
        stageStartedAt: null,
        history: []
      },
      redFlagChecks: []
    };
  }

  let state = blank();
  const subs = new Set();
  let saveTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      state = merge(blank(), parsed);
    } catch (e) {
      state = blank();
    }
  }

  function merge(base, incoming) {
    if (!incoming || typeof incoming !== "object") return base;
    const out = Array.isArray(base) ? incoming : Object.assign({}, base);
    for (const k in incoming) {
      const bv = base[k], iv = incoming[k];
      if (bv && typeof bv === "object" && !Array.isArray(bv) && iv && typeof iv === "object" && !Array.isArray(iv)) {
        out[k] = merge(bv, iv);
      } else if (iv !== undefined) {
        out[k] = iv;
      }
    }
    return out;
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { CAD.toast("Could not save locally — storage may be full or blocked."); }
    }, 60);
  }

  function get() { return state; }

  function update(fn) {
    fn(state);
    save();
    notify();
  }

  function notify() { subs.forEach((f) => f(state)); }
  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  function set(path, value) {
    const parts = path.split(".");
    let node = state;
    for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
    node[parts[parts.length - 1]] = value;
    save();
    notify();
  }

  function todayKey() { return CAD.fmt.dayKey(); }

  function checkinFor(dayKey) {
    return state.checkins.find((c) => c.day === dayKey) || null;
  }

  function saveCheckin(entry) {
    const day = entry.day || todayKey();
    const idx = state.checkins.findIndex((c) => c.day === day);
    const record = Object.assign({ id: CAD.uid(), day, ts: Date.now() }, entry, { day });
    if (idx >= 0) record.id = state.checkins[idx].id;
    if (idx >= 0) state.checkins[idx] = record; else state.checkins.push(record);
    state.checkins.sort((a, b) => (a.day < b.day ? -1 : 1));
    save();
    notify();
    return record;
  }

  function addRun(collection, run) {
    const record = Object.assign({ id: CAD.uid(), ts: Date.now() }, run);
    state[collection].push(record);
    save();
    notify();
    return record;
  }

  function daysSinceInjury() {
    if (!state.profile.injuryDate) return null;
    return Math.max(0, CAD.fmt.daysBetween(state.profile.injuryDate, new Date()));
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || !parsed.profile) throw new Error("Not a Cadence export file.");
    state = merge(blank(), parsed);
    save();
    notify();
  }

  function wipe() {
    state = blank();
    try { localStorage.removeItem(KEY); } catch (e) {}
    notify();
  }

  function replace(next) {
    state = merge(blank(), next);
    save();
    notify();
  }

  load();

  CAD.store = {
    get, update, set, subscribe, save, blank,
    todayKey, checkinFor, saveCheckin, addRun, daysSinceInjury,
    exportJSON, importJSON, wipe, replace
  };
})();
