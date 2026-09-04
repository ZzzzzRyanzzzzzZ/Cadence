(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  let stopGuide = null;

  function ratingRow(label, value, onChange) {
    const buttons = [];
    const out = h("span", { class: "symptom__val" }, String(value));
    const row = h("div", { class: "symptom" },
      h("div", { class: "symptom__head" }, h("span", { class: "symptom__name" }, label), out),
      h("div", { class: "scale scale--11", role: "group", "aria-label": label },
        Array.from({ length: 11 }, (_, n) => {
          const b = h("button", {
            class: "scale__btn", type: "button", "aria-pressed": String(value === n),
            "aria-label": label + " " + n + " out of 10",
            dataset: { sev: n === 0 ? "none" : "on" },
            onclick: () => { buttons.forEach((bb, i) => bb.setAttribute("aria-pressed", String(i === n))); out.textContent = String(n); onChange(n); }
          }, String(n));
          buttons.push(b);
          return b;
        })));
    return row;
  }

  function guide(kind, stageEl, seconds, onDone) {
    stageEl.innerHTML = "";
    const reduce = CAD.store.get().settings.reduceMotion;
    const dot = h("div", { class: "pursuit-target" });
    let raf = null, iv = null, audioCtx = null;
    const start = performance.now();
    const timerEl = h("div", { class: "arena__hud" }, h("span", ""), h("b", { class: "mono" }, seconds + "s"));
    stageEl.appendChild(timerEl);

    function tick() {
      const left = Math.max(0, seconds - Math.round((performance.now() - start) / 1000));
      timerEl.lastChild.textContent = left + "s";
      if (left <= 0) { finish(); return false; }
      return true;
    }

    function finish() {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
      stopGuide = null;
      onDone();
    }

    if (kind === "target") {
      stageEl.appendChild(dot);
      const loop = (now) => {
        if (!tick()) return;
        const r = stageEl.getBoundingClientRect();
        const t = (now - start) / 1000;
        const half = seconds / 2;
        let x, y;
        if (t < half) { x = r.width / 2 + Math.sin(t * 1.05) * r.width * 0.36; y = r.height / 2; }
        else { x = r.width / 2; y = r.height / 2 + Math.sin((t - half) * 1.05) * r.height * 0.34; }
        dot.style.left = x + "px"; dot.style.top = y + "px";
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    } else if (kind === "flip-h" || kind === "flip-v") {
      const a = h("div", { class: "pursuit-target" });
      const b = h("div", { class: "pursuit-target", style: { opacity: "0.25" } });
      stageEl.appendChild(a); stageEl.appendChild(b);
      const place = () => {
        const r = stageEl.getBoundingClientRect();
        if (kind === "flip-h") {
          a.style.left = (r.width * 0.18) + "px"; a.style.top = (r.height / 2) + "px";
          b.style.left = (r.width * 0.82) + "px"; b.style.top = (r.height / 2) + "px";
        } else {
          a.style.left = (r.width / 2) + "px"; a.style.top = (r.height * 0.16) + "px";
          b.style.left = (r.width / 2) + "px"; b.style.top = (r.height * 0.84) + "px";
        }
      };
      place();
      let on = true;
      iv = setInterval(() => {
        if (!tick()) return;
        on = !on;
        a.style.opacity = on ? "1" : "0.25";
        b.style.opacity = on ? "0.25" : "1";
      }, 600);
    } else if (kind === "metronome") {
      const centre = h("div", { class: "pursuit-target" });
      stageEl.appendChild(centre);
      const beat = h("div", { class: "breath__phase", style: { position: "absolute", bottom: "18px", left: "0", right: "0", textAlign: "center" } }, "Left");
      stageEl.appendChild(beat);
      const place = () => {
        const r = stageEl.getBoundingClientRect();
        centre.style.left = (r.width / 2) + "px"; centre.style.top = (r.height / 2) + "px";
      };
      place();
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
      let flip = true;
      iv = setInterval(() => {
        if (!tick()) return;
        flip = !flip;
        beat.textContent = kind === "metronome" ? (flip ? "◀ turn" : "turn ▶") : "";
        centre.style.transform = flip ? "scale(1.15)" : "scale(1)";
        if (audioCtx) {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.frequency.value = flip ? 660 : 520;
          gain.gain.value = 0.05;
          osc.connect(gain); gain.connect(audioCtx.destination);
          osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        }
      }, 666);
    } else if (kind === "optokinetic") {
      const stripes = h("div", {
        style: {
          position: "absolute", inset: "0",
          background: "repeating-linear-gradient(90deg, var(--surface-3) 0 28px, var(--surface-1) 28px 56px)",
          opacity: reduce ? "0.5" : "1"
        }
      });
      stageEl.appendChild(stripes);
      const centre = h("div", { class: "pursuit-target" });
      stageEl.appendChild(centre);
      const r0 = stageEl.getBoundingClientRect();
      centre.style.left = (r0.width / 2) + "px"; centre.style.top = (r0.height / 2) + "px";
      const loop = (now) => {
        if (!tick()) return;
        const t = (now - start) / 1000;
        stripes.style.backgroundPosition = (Math.sin(t * 0.9) * 120) + "px 0";
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    stopGuide = finish;
    return finish;
  }

  CAD.screens.oculomotor = function () {
    const state = CAD.store.get();
    const runs = state.oculomotorRuns;
    const last = runs[runs.length - 1];

    const wrap = h("div", { class: "wrap stack" });
    let mode = "intro";
    const draft = { baseline: { headache: 0, dizziness: 0, nausea: 0, fogginess: 0 }, items: {}, npcCm: null };
    let itemIndex = 0;
    let savedRun = null;

    function render() {
      wrap.innerHTML = "";
      wrap.appendChild(h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "Assess"),
        h("h1", "Oculomotor & vestibular screen"),
        h("p", "Seven guided movements adapted from the Vestibular/Ocular Motor Screening. You rate four symptoms before you start and again after each movement — what matters is not whether you can do it, but whether doing it provokes symptoms.")));
      if (mode === "intro") wrap.appendChild(intro());
      else if (mode === "baseline") wrap.appendChild(baselineStep());
      else if (mode === "item") wrap.appendChild(itemStep());
      else if (mode === "npc") wrap.appendChild(npcStep());
      else wrap.appendChild(summaryStep());
      window.scrollTo({ top: 0 });
    }

    function intro() {
      const box = h("div", { class: "stack" },
        h("div", { class: "callout callout--warn" },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", h("strong", "Sit down for this, and have someone nearby."),
            h("p", { style: { margin: "4px 0 0" } }, "Head-movement items can make you dizzy or unsteady. Stop immediately if symptoms climb sharply, and never do these standing at the top of stairs or alone if you have fallen before."))),
        h("div", { class: "card stack" },
          h("h2", "What you will do"),
          h("div", { class: "list" }, CAD.oculo.ITEMS.map((item) =>
            h("div", { class: "list__item" },
              h("span", { class: "tile__ico" }, CAD.icon(item.id.startsWith("vor") || item.id === "vms" ? "balance" : "eye")),
              h("div", { style: { flex: 1, minWidth: 0 } },
                h("strong", item.name),
                h("div", { class: "tiny muted" }, item.system + (item.seconds ? " · " + item.seconds + " s" : " · measured with a ruler")))))),
          h("div", { class: "row" },
            h("button", { class: "btn btn--primary btn--lg", onclick: () => { mode = "baseline"; render(); } }, CAD.icon("play"), "Start the screen"))),
        last ? h("div", { class: "card" },
          h("h3", "Last run — " + CAD.fmt.shortDate(last.ts)),
          resultBlock(CAD.oculo.scoreRun(last), last)) : null,
        h("div", { class: "card" },
          h("h3", "Why these seven"),
          h("p", { class: "card__sub", style: { marginTop: "8px" } }, "Roughly six in ten people with a concussion have at least one provocative finding on this screen, and a positive screen predicts a longer recovery. It is a screen, not a diagnosis — persistent findings belong with a clinician who does vestibular therapy."),
          CAD.refs.cite("voms")));
      return box;
    }

    function baselineStep() {
      return h("div", { class: "card stack" },
        h("div", null, h("h2", "Before you start"), h("p", { class: "card__sub" }, "Rate each symptom right now, 0 to 10. Everything after is measured against these four numbers.")),
        CAD.oculo.PROVOKED.map((p) => ratingRow(p.label, draft.baseline[p.id], (v) => { draft.baseline[p.id] = v; })),
        h("div", { class: "row row--end" },
          h("button", { class: "btn btn--primary", onclick: () => { itemIndex = 0; mode = "item"; render(); } }, "Begin", CAD.icon("arrow"))));
    }

    function itemStep() {
      const item = CAD.oculo.ITEMS[itemIndex];
      if (item.guide === "npc") { mode = "npc"; return npcStep(); }
      const stage = h("div", { class: "arena", style: { minHeight: "320px", position: "relative" } });
      const ratings = { headache: draft.baseline.headache, dizziness: draft.baseline.dizziness, nausea: draft.baseline.nausea, fogginess: draft.baseline.fogginess };
      const ratingBox = h("div", { class: "card stack", hidden: true },
        h("div", null, h("h3", "How do you feel now?"), h("p", { class: "card__sub" }, "Rate the same four symptoms after " + item.name.toLowerCase() + ".")),
        CAD.oculo.PROVOKED.map((p) => ratingRow(p.label, ratings[p.id], (v) => { ratings[p.id] = v; })),
        h("div", { class: "row row--end" },
          h("button", {
            class: "btn btn--primary", onclick: () => {
              draft.items[item.id] = Object.assign({}, ratings);
              itemIndex++;
              if (itemIndex >= CAD.oculo.ITEMS.length) mode = "summary";
              render();
            }
          }, itemIndex >= CAD.oculo.ITEMS.length - 1 ? "Finish" : "Next movement", CAD.icon("arrow"))));

      const startBtn = h("button", { class: "btn btn--primary btn--lg" }, CAD.icon("play"), "Start " + item.seconds + " seconds");
      startBtn.addEventListener("click", () => {
        startBtn.disabled = true;
        guide(item.guide, stage, item.seconds, () => {
          stage.innerHTML = "";
          stage.appendChild(h("div", { class: "arena__msg" }, h("h3", "Done"), h("p", "Rate your symptoms below.")));
          ratingBox.hidden = false;
          ratingBox.scrollIntoView({ behavior: CAD.store.get().settings.reduceMotion ? "auto" : "smooth", block: "start" });
        });
      });

      stage.appendChild(h("div", { class: "arena__msg" }, h("h3", item.name), h("p", item.instructions)));

      return h("div", { class: "stack" },
        h("div", { class: "row row--between" },
          h("span", { class: "chip chip--accent" }, "Movement " + (itemIndex + 1) + " of " + CAD.oculo.ITEMS.length),
          h("button", { class: "btn btn--ghost btn--sm", onclick: () => { if (stopGuide) stopGuide(); mode = "intro"; render(); } }, "Stop the screen")),
        h("div", { class: "card stack" },
          h("div", null, h("h2", item.name), h("p", { class: "card__sub" }, item.instructions)),
          stage,
          h("div", { class: "row" }, startBtn,
            CAD.speech.supported ? h("button", { class: "btn btn--ghost", onclick: () => CAD.speech.speak(item.instructions) }, CAD.icon("speaker"), "Read aloud") : null,
            h("button", { class: "btn btn--ghost", onclick: () => { if (stopGuide) stopGuide(); ratingBox.hidden = false; } }, "Skip to rating"))),
        ratingBox,
        h("div", { class: "card" }, h("h3", "Why this one"), h("p", { class: "card__sub", style: { marginTop: "8px" } }, item.why)));
    }

    function npcStep() {
      const item = CAD.oculo.ITEMS.find((i) => i.id === "convergence");
      const input = h("input", { class: "input", type: "number", min: "0", max: "60", step: "0.5", placeholder: "e.g. 7.5", style: { maxWidth: "180px" } });
      return h("div", { class: "stack" },
        h("div", { class: "card stack" },
          h("div", null, h("h2", "Near point of convergence"), h("p", { class: "card__sub" }, item.instructions)),
          h("div", { class: "callout" },
            h("span", { class: "callout__ico" }, CAD.icon("info")),
            h("div", h("strong", "6 cm or more is the usual abnormal cut-off."), h("p", { style: { margin: "4px 0 0" } }, "Measure three times from the tip of your nose and enter the average. If you have no ruler, skip it — the rest of the screen still scores."))),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Average distance in centimetres"), input),
          h("div", { class: "row row--end" },
            h("button", { class: "btn btn--ghost", onclick: () => { draft.npcCm = null; itemIndex++; mode = itemIndex >= CAD.oculo.ITEMS.length ? "summary" : "item"; render(); } }, "Skip"),
            h("button", {
              class: "btn btn--primary", onclick: () => {
                const v = Number(input.value);
                draft.npcCm = isFinite(v) && v > 0 ? v : null;
                itemIndex++;
                mode = itemIndex >= CAD.oculo.ITEMS.length ? "summary" : "item";
                render();
              }
            }, "Save", CAD.icon("arrow")))),
        h("div", { class: "card" }, h("h3", "Why this one"), h("p", { class: "card__sub", style: { marginTop: "8px" } }, item.why)));
    }

    function resultBlock(score, run) {
      const rows = score.perItem.map((it) =>
        h("div", { class: "list__item" },
          h("span", { class: "dot dot--" + (it.flagged ? "serious" : "good") }),
          h("span", { style: { flex: 1 } }, it.name),
          h("b", { class: "mono" }, CAD.fmt.signed(it.delta, 0))));
      return h("div", { class: "stack" },
        h("div", { class: "grid grid--3" },
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Provocative items"), h("span", { class: "stat__value" }, score.flaggedItems, h("small", " / 8"))),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Largest increase"), h("span", { class: "stat__value" }, score.maxDelta, h("small", " pts"))),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Convergence"), h("span", { class: "stat__value" }, score.npcCm ? CAD.fmt.n(score.npcCm, 1) : "—", h("small", " cm")))),
        h("div", { class: "list" }, rows,
          score.npcCm ? h("div", { class: "list__item" },
            h("span", { class: "dot dot--" + (score.npcFlag ? "serious" : "good") }),
            h("span", { style: { flex: 1 } }, "Near point of convergence"),
            h("b", { class: "mono" }, CAD.fmt.n(score.npcCm, 1) + " cm")) : null));
    }

    function summaryStep() {
      const run = { baseline: draft.baseline, items: draft.items, npcCm: draft.npcCm };
      const score = CAD.oculo.scoreRun(run);
      if (!savedRun) savedRun = CAD.store.addRun("oculomotorRuns", run);
      const saved = savedRun;
      const tone = score.flaggedItems >= 3 ? "serious" : score.flaggedItems >= 1 ? "warning" : "good";
      mode = "done";
      return h("div", { class: "stack" },
        h("div", { class: "card stack" },
          h("div", { class: "row row--between" },
            h("h2", "Screen complete"),
            h("span", { class: "chip chip--" + tone }, score.flaggedItems === 0 ? "No provocation" : CAD.fmt.plural(score.flaggedItems, "provocative item"))),
          resultBlock(score, saved),
          h("div", { class: "callout callout--" + (tone === "good" ? "good" : "warn") },
            h("span", { class: "callout__ico" }, CAD.icon(tone === "good" ? "check" : "info")),
            h("div",
              h("strong", score.flaggedItems === 0
                ? "Nothing here provoked symptoms today."
                : "Provocation on " + score.flaggedItems + " item" + (score.flaggedItems === 1 ? "" : "s") + "."),
              h("p", { style: { margin: "4px 0 0" } }, score.flaggedItems === 0
                ? "Re-run this after you step up your activity level — it often turns positive again when the load increases."
                : "A positive screen that persists past two weeks is the usual trigger for referral to vestibular or vision therapy. Bring this to your clinician; it prints on the report page."))),
          h("div", { class: "row" },
            h("a", { class: "btn btn--primary", href: "#/report" }, CAD.icon("report"), "Add to clinician report"),
            h("a", { class: "btn btn--ghost", href: "#/today" }, "Back to today"))));
    }

    render();
    return wrap;
  };

  CAD.screens.oculomotor.leave = function () {
    if (stopGuide) { try { stopGuide(); } catch (e) {} stopGuide = null; }
  };
})();
