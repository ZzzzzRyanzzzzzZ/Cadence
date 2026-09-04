(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  const S = CAD.stats;
  CAD.screens = CAD.screens || {};

  const STROOP_COLORS = [
    { id: "blue", label: "Blue", css: "var(--series-1)" },
    { id: "orange", label: "Orange", css: "var(--series-2)" },
    { id: "green", label: "Green", css: "var(--series-3)" },
    { id: "amber", label: "Amber", css: "var(--series-4)" }
  ];

  let cleanup = null;

  function keyResponder(handler) {
    const fn = (e) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "Enter" || e.key === " ") { e.preventDefault(); handler(e); }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }

  const TASKS = {
    srt: {
      id: "srt", name: "Simple reaction time", icon: "clock",
      domain: "Processing speed",
      blurb: "Tap the moment the circle appears. Twenty trials, about 90 seconds.",
      science: "The most sensitive single measure of post-concussive slowing. Median rather than mean, because one distraction should not move the score.",
      instructions: "A circle will appear at random intervals. Tap the screen, or press space, as fast as you can when it does. Do not tap before it appears.",
      run(arena, api) {
        return new Promise((resolve) => {
          const TRIALS = 20;
          let trial = 0, shownAt = 0, waiting = false, armed = false;
          const rts = [], anticipations = [];
          const stim = h("div", { class: "arena__stim", hidden: true });
          const msg = h("div", { class: "arena__msg" }, h("h3", "Get ready"), h("p", "Tap as soon as the circle appears."));
          arena.appendChild(msg);
          arena.appendChild(stim);
          let timer = null;

          function next() {
            if (trial >= TRIALS) return done();
            api.progress(trial, TRIALS);
            msg.hidden = false;
            stim.hidden = true;
            waiting = true; armed = false;
            const delay = 1200 + Math.random() * 2400;
            timer = setTimeout(() => {
              msg.hidden = true;
              stim.hidden = false;
              shownAt = performance.now();
              armed = true;
            }, delay);
          }

          function respond() {
            if (!waiting) return;
            if (!armed) {
              clearTimeout(timer);
              anticipations.push(trial);
              waiting = false;
              msg.innerHTML = "";
              msg.appendChild(h("h3", "Too early"));
              msg.appendChild(h("p", "Wait for the circle. That trial will repeat."));
              setTimeout(next, 900);
              return;
            }
            const rt = performance.now() - shownAt;
            rts.push(rt);
            waiting = false;
            trial++;
            stim.hidden = true;
            msg.hidden = false;
            msg.innerHTML = "";
            msg.appendChild(h("h3", Math.round(rt) + " ms"));
            msg.appendChild(h("p", "Trial " + trial + " of " + TRIALS));
            setTimeout(next, 650);
          }

          function done() {
            offKeys();
            arena.onpointerdown = null;
            resolve({
              medianRt: S.median(rts),
              iqrRt: S.iqr(rts),
              meanRt: S.mean(rts),
              sdRt: S.sd(rts),
              lapses: rts.filter((r) => r > 500).length,
              anticipations: anticipations.length,
              trials: rts.length
            });
          }

          const offKeys = keyResponder(respond);
          arena.onpointerdown = respond;
          api.cleanup(() => { clearTimeout(timer); offKeys(); arena.onpointerdown = null; });
          setTimeout(next, 800);
        });
      }
    },

    gng: {
      id: "gng", name: "Go / no-go", icon: "shield",
      domain: "Attention & inhibition",
      blurb: "Respond to the circle, hold back on the square. Forty-eight trials.",
      science: "Separates being slow from being impulsive. Commission errors — responding to a no-go — index inhibitory control, which is disproportionately affected after concussion.",
      instructions: "Tap when you see the round orange target. Do nothing when you see the violet square. Twenty-five percent of trials are squares.",
      run(arena, api) {
        return new Promise((resolve) => {
          const TRIALS = 48;
          const order = CAD.shuffle(Array.from({ length: TRIALS }, (_, i) => i < Math.round(TRIALS * 0.25)));
          let trial = 0, shownAt = 0, responded = false, isNoGo = false, live = false;
          const rts = [];
          let commissions = 0, omissions = 0, correct = 0;
          const stim = h("div", { class: "arena__stim", hidden: true });
          const msg = h("div", { class: "arena__msg" }, h("h3", "Get ready"));
          arena.appendChild(msg); arena.appendChild(stim);
          let t1 = null, t2 = null;

          function next() {
            if (trial >= TRIALS) return done();
            api.progress(trial, TRIALS);
            stim.hidden = true; msg.hidden = true;
            responded = false;
            isNoGo = order[trial];
            t1 = setTimeout(() => {
              stim.hidden = false;
              stim.className = "arena__stim" + (isNoGo ? " arena__stim--nogo" : "");
              stim.style.borderRadius = isNoGo ? "18px" : "50%";
              shownAt = performance.now();
              live = true;
              t2 = setTimeout(() => {
                live = false;
                stim.hidden = true;
                if (!responded) {
                  if (isNoGo) correct++;
                  else omissions++;
                }
                trial++;
                next();
              }, 800);
            }, 550 + Math.random() * 650);
          }

          function respond() {
            if (!live || responded) return;
            responded = true;
            const rt = performance.now() - shownAt;
            if (isNoGo) commissions++;
            else { rts.push(rt); correct++; }
            stim.hidden = true;
          }

          function done() {
            offKeys(); arena.onpointerdown = null;
            const targets = TRIALS - order.filter(Boolean).length;
            const nonTargets = order.filter(Boolean).length;
            resolve({
              medianRt: S.median(rts),
              sdRt: S.sd(rts),
              commissions, omissions,
              accuracy: correct / TRIALS,
              dprime: S.dPrime(rts.length, targets, commissions, nonTargets),
              trials: TRIALS
            });
          }

          const offKeys = keyResponder(respond);
          arena.onpointerdown = respond;
          api.cleanup(() => { clearTimeout(t1); clearTimeout(t2); offKeys(); arena.onpointerdown = null; });
          setTimeout(next, 900);
        });
      }
    },

    stroop: {
      id: "stroop", name: "Colour interference", icon: "sparkle",
      domain: "Executive control",
      blurb: "Name the ink colour, not the word. Forty trials.",
      science: "Interference cost — incongruent minus congruent reaction time — is a clean index of executive control and is reliably elevated in the first weeks after concussion.",
      instructions: "A colour word appears in coloured ink. Choose the colour of the INK, ignoring what the word says. Keys 1 to 4 work too. The palette is chosen to stay distinguishable with colour vision deficiency.",
      run(arena, api) {
        return new Promise((resolve) => {
          const TRIALS = 40;
          const trials = [];
          for (let i = 0; i < TRIALS; i++) {
            const ink = STROOP_COLORS[Math.floor(Math.random() * 4)];
            const congruent = i % 2 === 0;
            let word = ink;
            if (!congruent) {
              const others = STROOP_COLORS.filter((c) => c.id !== ink.id);
              word = others[Math.floor(Math.random() * others.length)];
            }
            trials.push({ ink, word, congruent });
          }
          CAD.shuffle(trials).forEach((t, i) => { trials[i] = t; });
          let idx = 0, shownAt = 0, live = false;
          const con = [], incon = [];
          let correct = 0;
          const wordEl = h("div", { class: "arena__word" }, "");
          const feedback = h("p", { class: "muted tiny", style: { minHeight: "20px" } }, "");
          const buttons = STROOP_COLORS.map((c, i) => h("button", {
            class: "choice-btn", type: "button",
            onclick: () => respond(c.id)
          }, h("span", { style: { display: "block", width: "26px", height: "8px", borderRadius: "4px", background: c.css, margin: "0 auto 6px" } }), (i + 1) + " · " + c.label));
          const panel = h("div", { class: "stack", style: { alignItems: "center" } },
            wordEl, feedback, h("div", { class: "arena__choices" }, buttons));
          arena.appendChild(panel);

          function show() {
            if (idx >= trials.length) return done();
            api.progress(idx, trials.length);
            const t = trials[idx];
            wordEl.textContent = t.word.label.toUpperCase();
            wordEl.style.color = t.ink.css;
            shownAt = performance.now();
            live = true;
          }

          function respond(id) {
            if (!live) return;
            live = false;
            const t = trials[idx];
            const rt = performance.now() - shownAt;
            const ok = id === t.ink.id;
            if (ok) { correct++; (t.congruent ? con : incon).push(rt); }
            feedback.textContent = ok ? "" : "Ink colour was " + t.ink.label.toLowerCase();
            wordEl.textContent = "";
            idx++;
            setTimeout(show, ok ? 260 : 700);
          }

          const keyFn = (e) => {
            const n = Number(e.key);
            if (n >= 1 && n <= 4) { e.preventDefault(); respond(STROOP_COLORS[n - 1].id); }
          };
          document.addEventListener("keydown", keyFn);

          function done() {
            document.removeEventListener("keydown", keyFn);
            resolve({
              congruentRt: S.median(con),
              incongruentRt: S.median(incon),
              interference: S.median(incon) - S.median(con),
              accuracy: correct / trials.length,
              trials: trials.length
            });
          }

          api.cleanup(() => document.removeEventListener("keydown", keyFn));
          setTimeout(show, 800);
        });
      }
    },

    nback: {
      id: "nback", name: "Working memory (2-back)", icon: "cognition",
      domain: "Working memory",
      blurb: "Press match when a letter repeats from two back. Forty-eight letters.",
      science: "Scored with d′ rather than raw accuracy, so a person who presses match constantly cannot look good. d′ separates real sensitivity from response bias.",
      instructions: "Letters appear one at a time. Press match — or tap the button — whenever the current letter is the same as the one two letters ago. About one in three is a match.",
      run(arena, api) {
        return new Promise((resolve) => {
          const LETTERS = "BCDFGHKLMNPQRSTVZ".split("");
          const TRIALS = 48;
          const seq = [];
          for (let i = 0; i < TRIALS; i++) {
            if (i >= 2 && Math.random() < 0.32) seq.push(seq[i - 2]);
            else {
              let c;
              do { c = LETTERS[Math.floor(Math.random() * LETTERS.length)]; } while (i >= 2 && c === seq[i - 2]);
              seq.push(c);
            }
          }
          let idx = 0, shownAt = 0, responded = false, live = false;
          let hits = 0, falseAlarms = 0, misses = 0;
          const rts = [];
          const letterEl = h("div", { class: "arena__letter" }, "");
          const btn = h("button", { class: "choice-btn", type: "button", style: { minWidth: "180px" }, onclick: respond }, "Match");
          arena.appendChild(h("div", { class: "stack", style: { alignItems: "center" } },
            letterEl, h("p", { class: "muted tiny" }, "Same as two letters ago?"), btn));
          let t1 = null, t2 = null;

          function show() {
            if (idx >= seq.length) return done();
            api.progress(idx, seq.length);
            letterEl.textContent = seq[idx];
            shownAt = performance.now();
            responded = false;
            live = true;
            t1 = setTimeout(() => {
              letterEl.textContent = "+";
              t2 = setTimeout(() => {
                live = false;
                const isTarget = idx >= 2 && seq[idx] === seq[idx - 2];
                if (isTarget && !responded) misses++;
                idx++;
                show();
              }, 900);
            }, 700);
          }

          function respond() {
            if (!live || responded) return;
            responded = true;
            const isTarget = idx >= 2 && seq[idx] === seq[idx - 2];
            if (isTarget) { hits++; rts.push(performance.now() - shownAt); }
            else falseAlarms++;
          }

          const offKeys = keyResponder(respond);

          function done() {
            offKeys();
            const targets = seq.filter((c, i) => i >= 2 && c === seq[i - 2]).length;
            resolve({
              hits, falseAlarms, misses,
              dprime: S.dPrime(hits, targets, falseAlarms, seq.length - targets),
              medianRt: S.median(rts),
              accuracy: (hits + (seq.length - targets - falseAlarms)) / seq.length,
              trials: seq.length
            });
          }

          api.cleanup(() => { clearTimeout(t1); clearTimeout(t2); offKeys(); });
          setTimeout(show, 900);
        });
      }
    },

    pursuit: {
      id: "pursuit", name: "Visual tracking", icon: "eye",
      domain: "Oculomotor & visuomotor",
      blurb: "Follow the moving dot with your finger or cursor for 30 seconds.",
      science: "A pointer stands in for the eye: tracking error and response lag against a smooth predictable path capture the same visuomotor integration that smooth pursuit testing probes clinically.",
      instructions: "Keep your finger or cursor on the moving dot. It follows a smooth looping path for thirty seconds. This task involves on-screen motion — skip it if motion makes you feel worse.",
      motion: true,
      run(arena, api) {
        return new Promise((resolve) => {
          const DURATION = 30000;
          const target = h("div", { class: "pursuit-target" });
          const cursorDot = h("div", { class: "pursuit-cursor" });
          arena.appendChild(target); arena.appendChild(cursorDot);
          arena.style.cursor = "none";
          const samples = [];
          let pointer = null;
          let raf = null;
          const start = performance.now();

          function pos(t) {
            const r = arena.getBoundingClientRect();
            const cx = r.width / 2, cy = r.height / 2;
            const ax = r.width * 0.36, ay = r.height * 0.32;
            const s = t / 1000;
            return { x: cx + ax * Math.sin(s * 0.9), y: cy + ay * Math.sin(s * 1.4 + 0.6) };
          }

          function onMove(e) {
            const r = arena.getBoundingClientRect();
            pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
          }
          arena.addEventListener("pointermove", onMove);

          function frame(now) {
            const t = now - start;
            if (t >= DURATION) return done();
            const p = pos(t);
            target.style.left = p.x + "px";
            target.style.top = p.y + "px";
            if (pointer) {
              cursorDot.style.left = pointer.x + "px";
              cursorDot.style.top = pointer.y + "px";
              samples.push({ t, tx: p.x, ty: p.y, px: pointer.x, py: pointer.y });
            }
            api.progress(t, DURATION);
            raf = requestAnimationFrame(frame);
          }

          function errorAtLag(lagMs) {
            if (samples.length < 30) return Infinity;
            let sum = 0, n = 0;
            for (let i = 0; i < samples.length; i++) {
              const want = samples[i].t - lagMs;
              let j = i;
              while (j > 0 && samples[j].t > want) j--;
              const dx = samples[i].px - samples[j].tx;
              const dy = samples[i].py - samples[j].ty;
              sum += dx * dx + dy * dy; n++;
            }
            return n ? Math.sqrt(sum / n) : Infinity;
          }

          function done() {
            cancelAnimationFrame(raf);
            arena.removeEventListener("pointermove", onMove);
            arena.style.cursor = "";
            const r = arena.getBoundingClientRect();
            const diag = Math.sqrt(r.width * r.width + r.height * r.height) || 1;
            if (samples.length < 60) return resolve(null);
            let best = { lag: 0, err: errorAtLag(0) };
            for (let lag = 0; lag <= 500; lag += 20) {
              const e = errorAtLag(lag);
              if (e < best.err) best = { lag, err: e };
            }
            const raw = errorAtLag(0);
            const onTarget = samples.filter((s2) => Math.hypot(s2.px - s2.tx, s2.py - s2.ty) < 45).length / samples.length;
            resolve({
              rmseNorm: Number((raw / diag).toFixed(4)),
              rmsePx: Math.round(raw),
              lagMs: best.lag,
              residualNorm: Number((best.err / diag).toFixed(4)),
              onTarget: Number(onTarget.toFixed(3)),
              samples: samples.length
            });
          }

          api.cleanup(() => { cancelAnimationFrame(raf); arena.removeEventListener("pointermove", onMove); arena.style.cursor = ""; });
          raf = requestAnimationFrame(frame);
        });
      }
    },

    rapid: {
      id: "rapid", name: "Rapid number naming", icon: "trend",
      domain: "Saccadic speed",
      blurb: "Read three cards of numbers aloud as fast as you can, left to right.",
      science: "Adapted from the King–Devick paradigm: total reading time loads saccadic speed, attention and language together, and lengthens after concussion. Timing here is self-paced, so treat it as a trend, not a validated King–Devick score.",
      instructions: "Read every number out loud, left to right, top to bottom, as fast as you can without mistakes. Tap Done the instant you finish each card. You will enter any misread numbers at the end.",
      run(arena, api) {
        return new Promise((resolve) => {
          const cards = [];
          for (let c = 0; c < 3; c++) {
            const nums = [];
            for (let i = 0; i < 40; i++) nums.push(1 + Math.floor(Math.random() * 9));
            cards.push(nums);
          }
          let idx = 0, startedAt = 0;
          const times = [];
          const box = h("div", { class: "stack", style: { width: "100%", alignItems: "center" } });
          arena.appendChild(box);

          function showIntro() {
            box.innerHTML = "";
            box.appendChild(h("div", { class: "arena__msg" },
              h("h3", "Card " + (idx + 1) + " of 3"),
              h("p", "Read every number aloud, left to right. Tap Start, then Done when you finish."),
              h("button", { class: "btn btn--primary btn--lg", style: { marginTop: "14px" }, onclick: showCard }, CAD.icon("play"), "Start card " + (idx + 1))));
          }

          function showCard() {
            box.innerHTML = "";
            startedAt = performance.now();
            box.appendChild(h("div", { class: "kd-card" + (idx === 2 ? " kd-card--spaced" : "") }, cards[idx].map((n) => h("span", String(n)))));
            box.appendChild(h("button", { class: "btn btn--primary btn--lg", onclick: finishCard }, "Done reading card " + (idx + 1)));
            api.progress(idx, 3);
          }

          function finishCard() {
            times.push((performance.now() - startedAt) / 1000);
            idx++;
            if (idx >= 3) return askErrors();
            showIntro();
          }

          function askErrors() {
            box.innerHTML = "";
            const input = h("input", { class: "input", type: "number", min: "0", max: "40", value: "0", style: { maxWidth: "140px" } });
            box.appendChild(h("div", { class: "arena__msg stack" },
              h("h3", "Total " + times.reduce((a, b) => a + b, 0).toFixed(1) + " s"),
              h("p", "How many numbers did you misread or skip in total?"),
              input,
              h("button", {
                class: "btn btn--primary btn--lg", onclick: () => resolve({
                  totalSec: Number(times.reduce((a, b) => a + b, 0).toFixed(2)),
                  card1: Number(times[0].toFixed(2)),
                  card2: Number(times[1].toFixed(2)),
                  card3: Number(times[2].toFixed(2)),
                  errors: Number(input.value) || 0,
                  cards: 3
                })
              }, "Save result")));
          }

          api.cleanup(() => {});
          showIntro();
        });
      }
    }
  };

  const ORDER = ["srt", "gng", "stroop", "nback", "pursuit", "rapid"];

  function metricRows(task, metrics) {
    const defs = {
      srt: [["medianRt", "Median RT", "ms"], ["iqrRt", "Variability (IQR)", "ms"], ["lapses", "Lapses over 500 ms", ""], ["anticipations", "Early taps", ""]],
      gng: [["medianRt", "Median RT", "ms"], ["commissions", "Commission errors", ""], ["omissions", "Missed targets", ""], ["dprime", "d′", ""]],
      stroop: [["interference", "Interference cost", "ms"], ["congruentRt", "Congruent RT", "ms"], ["incongruentRt", "Incongruent RT", "ms"], ["accuracy", "Accuracy", "%"]],
      nback: [["dprime", "d′", ""], ["hits", "Hits", ""], ["falseAlarms", "False alarms", ""], ["medianRt", "Median RT", "ms"]],
      pursuit: [["rmseNorm", "Tracking error", ""], ["lagMs", "Response lag", "ms"], ["onTarget", "Time on target", "%"], ["residualNorm", "Error at best lag", ""]],
      rapid: [["totalSec", "Total time", "s"], ["errors", "Errors", ""], ["card1", "Card 1", "s"], ["card3", "Card 3", "s"]]
    }[task] || [];
    return defs.map(([k, label, unit]) => {
      let v = metrics[k];
      if (!isFinite(v)) return [label, "—"];
      if (unit === "%") return [label, CAD.fmt.pct(v)];
      if (unit === "ms") return [label, Math.round(v) + " ms"];
      if (unit === "s") return [label, CAD.fmt.n(v, 1) + " s"];
      return [label, CAD.fmt.n(v, Math.abs(v) < 1 ? 3 : 1)];
    });
  }

  function statusChip(res) {
    if (!res || res.status === "insufficient") return h("span", { class: "chip" }, "Needs a repeat run");
    const map = {
      improved: ["good", "Reliably better"], improving: ["good", "Trending better"],
      stable: ["", "Within test-retest noise"], declining: ["warning", "Trending worse"], declined: ["serious", "Reliably worse"]
    };
    const [tone, label] = map[res.status];
    return h("span", { class: "chip" + (tone ? " chip--" + tone : "") }, label + " · RCI " + CAD.fmt.n(res.rci, 2));
  }

  function hub() {
    const state = CAD.store.get();
    const rc = CAD.rci.summary(state);
    const byKey = {};
    rc.results.forEach((r) => { byKey[r.metric.key] = r; });

    const cards = ORDER.map((tid) => {
      const task = TASKS[tid];
      const runs = state.cognitionRuns.filter((r) => r.task === tid);
      const last = runs[runs.length - 1];
      const primary = CAD.rci.METRICS.find((m) => m.task === tid);
      const res = primary ? byKey[primary.key] : null;
      return h("div", { class: "card stack" },
        h("div", { class: "row row--between" },
          h("div", { class: "row", style: { gap: "10px" } },
            h("span", { class: "tile__ico" }, CAD.icon(task.icon)),
            h("div", null, h("strong", task.name), h("div", { class: "tiny muted" }, task.domain))),
          runs.length ? h("span", { class: "chip" }, CAD.fmt.plural(runs.length, "run")) : h("span", { class: "chip chip--accent" }, "Not run yet")),
        h("p", { class: "tiny muted", style: { margin: 0 } }, task.blurb),
        last ? h("div", { class: "row", style: { gap: "18px" } },
          metricRows(tid, last.metrics).slice(0, 2).map(([label, value]) =>
            h("div", null, h("div", { class: "tiny muted" }, label), h("b", { class: "mono" }, value)))) : null,
        last && res ? statusChip(res) : null,
        runs.length >= 3 && primary ? CAD.charts.spark(runs.map((r) => r.metrics[primary.field]).filter(isFinite), { color: "var(--series-1)" }) : null,
        h("div", { class: "row" },
          h("a", { class: "btn btn--primary btn--sm", href: "#/cognition/" + tid }, CAD.icon("play"), runs.length ? "Run again" : "Run task"),
          last ? h("span", { class: "tiny muted" }, "Last " + CAD.fmt.shortDate(last.ts)) : null));
    });

    const wrap = h("div", { class: "wrap stack" },
      h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "Assess"),
        h("h1", "Cognitive battery"),
        h("p", "Six short tasks covering the domains concussion actually slows: processing speed, inhibition, executive control, working memory, visuomotor tracking and saccadic speed. Every result is compared to your own baseline using a Reliable Change Index, so ordinary day-to-day noise is not read as decline.")),
      !state.baseline.capturedAt ? h("div", { class: "callout callout--accent" },
        h("span", { class: "callout__ico" }, CAD.icon("info")),
        h("div", h("strong", "Your first run of each task becomes its baseline."),
          h("p", { style: { margin: "4px 0 0" } }, "Ideally captured when you are as close to your normal as possible. Everything after is scored against it."))) : null,
      h("div", { class: "callout" },
        h("span", { class: "callout__ico" }, CAD.icon("shield")),
        h("div", h("strong", "Stop any task that makes symptoms climb more than a couple of points."),
          h("p", { style: { margin: "4px 0 0" } }, "Testing is information, not treatment. Pushing through a task that provokes symptoms slows recovery."))),
      h("div", { class: "grid grid--2" }, cards),
      h("div", { class: "card" },
        h("h3", "How change is judged"),
        h("p", { class: "tiny muted", style: { marginTop: "8px" } },
          "A Reliable Change Index divides the difference from baseline by the standard error of difference. Once you have five or more sessions on a task, Cadence swaps published test-retest constants for your own within-person variability, which is a fairer yardstick. An index beyond ±1.96 is change that would occur by chance less than 5% of the time."),
        CAD.refs.cite("jacobson")));
    return wrap;
  }

  function runner(taskId) {
    const task = TASKS[taskId];
    if (!task) return hub();
    const state = CAD.store.get();
    const isFirst = !state.cognitionRuns.some((r) => r.task === taskId);
    const reduceMotion = state.settings.reduceMotion;

    const arena = h("div", { class: "arena" });
    const progressBar = h("i", { style: { width: "0%" } });
    const hud = h("div", { class: "arena__hud" },
      h("span", task.name),
      h("div", { class: "arena__progress" }, progressBar),
      h("span", { class: "tiny" }, isFirst ? "Baseline run" : ""));
    const stage = h("div", { class: "card card--flush", style: { padding: "16px", position: "relative" } }, hud, arena);

    const api = {
      progress(i, total) { progressBar.style.width = CAD.clamp(i / total, 0, 1) * 100 + "%"; },
      cleanup(fn) { cleanup = fn; }
    };

    const wrap = h("div", { class: "wrap stack" });

    function intro() {
      arena.innerHTML = "";
      arena.appendChild(h("div", { class: "arena__msg stack" },
        h("h3", task.name),
        h("p", task.instructions),
        task.motion && reduceMotion ? h("div", { class: "callout callout--warn", style: { textAlign: "left" } },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", h("strong", "This task uses continuous motion."), h("p", { style: { margin: "4px 0 0" } }, "You have reduced motion turned on. Skip this one if moving targets provoke symptoms."))) : null,
        h("div", { class: "row", style: { justifyContent: "center", marginTop: "10px" } },
          h("button", { class: "btn btn--primary btn--lg", onclick: begin }, CAD.icon("play"), "Start"),
          CAD.speech.supported ? h("button", { class: "btn btn--ghost", onclick: () => CAD.speech.speak(task.instructions) }, CAD.icon("speaker"), "Read aloud") : null)));
    }

    function begin() {
      arena.innerHTML = "";
      arena.classList.add("arena--active");
      let count = 3;
      const c = h("div", { class: "arena__msg" }, h("div", { class: "hero-figure" }, "3"), h("p", "Get ready"));
      arena.appendChild(c);
      const iv = setInterval(() => {
        count--;
        if (count <= 0) {
          clearInterval(iv);
          arena.innerHTML = "";
          task.run(arena, api).then(showResult);
        } else c.firstChild.textContent = String(count);
      }, 800);
      cleanup = () => clearInterval(iv);
    }

    function showResult(metrics) {
      arena.classList.remove("arena--active");
      arena.innerHTML = "";
      cleanup = null;
      if (!metrics) {
        arena.appendChild(h("div", { class: "arena__msg" }, h("h3", "Not enough data"), h("p", "The task ended before it collected enough samples. Try again when you are ready."), h("a", { class: "btn btn--ghost", href: "#/cognition" }, "Back to battery")));
        return;
      }
      const run = CAD.store.addRun("cognitionRuns", { task: taskId, metrics, isBaseline: isFirst });
      if (isFirst) {
        CAD.store.update((s) => {
          s.baseline.cognition[taskId] = metrics;
          if (!s.baseline.capturedAt) s.baseline.capturedAt = Date.now();
        });
      }
      const fresh = CAD.store.get();
      const primary = CAD.rci.METRICS.find((m) => m.task === taskId);
      const res = primary ? CAD.rci.evaluate(fresh, primary) : null;
      const rows = metricRows(taskId, metrics);

      arena.appendChild(h("div", { class: "arena__msg stack", style: { maxWidth: "620px" } },
        h("h3", isFirst ? "Baseline captured" : "Result saved"),
        h("div", { class: "grid grid--2", style: { width: "100%" } }, rows.map(([label, value]) =>
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, label), h("span", { class: "stat__value", style: { fontSize: "1.4em" } }, value)))),
        res && res.status !== "insufficient" ? h("div", { class: "stack stack--s", style: { width: "100%" } },
          statusChip(res),
          h("p", { class: "tiny muted" }, "Compared with a baseline of " + CAD.fmt.n(res.baselineValue, res.metric.unit === "ms" ? 0 : 2) + " " + res.metric.unit + ", standard error of difference " + CAD.fmt.n(res.seDiff, 2) + " from " + (res.method === "personal" ? "your own repeat sessions" : "published test-retest estimates") + ".")) : null,
        h("div", { class: "row", style: { justifyContent: "center" } },
          h("a", { class: "btn btn--primary", href: "#/cognition" }, "Back to battery"),
          h("button", { class: "btn btn--ghost", onclick: () => { CAD.render(); } }, CAD.icon("refresh"), "Run again"))));
    }

    wrap.appendChild(h("div", { class: "row row--between" },
      h("div", null,
        h("p", { class: "eyebrow" }, task.domain),
        h("h1", task.name)),
      h("a", { class: "btn btn--ghost", href: "#/cognition" }, "Exit")));
    wrap.appendChild(stage);
    wrap.appendChild(h("div", { class: "card" },
      h("h3", "Why this task"),
      h("p", { class: "card__sub", style: { marginTop: "8px" } }, task.science)));

    intro();
    return wrap;
  }

  CAD.screens.cognition = function (params) {
    return params && params[0] ? runner(params[0]) : hub();
  };
  CAD.screens.cognition.leave = function () {
    if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  };
  CAD.screens.cognition.TASKS = TASKS;
})();
