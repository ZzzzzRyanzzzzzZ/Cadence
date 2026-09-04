(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  function optionRow(options, value, onPick) {
    return h("div", { class: "opt-grid" }, options.map((o) =>
      h("button", {
        class: "opt", type: "button",
        "aria-pressed": String(value === o.value),
        onclick: () => onPick(o.value)
      }, o.label)));
  }

  function toggleRow(label, sub, value, onChange) {
    return h("div", { class: "switch" },
      h("div", { class: "switch__text" }, h("strong", label), sub ? h("span", sub) : null),
      h("button", { class: "toggle", type: "button", "aria-pressed": String(!!value), "aria-label": label, onclick: () => onChange(!value) }));
  }

  CAD.screens.onboarding = function () {
    const state = CAD.store.get();
    const draft = JSON.parse(JSON.stringify(state.profile));
    const settings = JSON.parse(JSON.stringify(state.settings));
    let step = 0;
    const root = h("div", { class: "wrap wrap--narrow onboard" });

    const STEPS = [welcome, safety, injury, history, access, track];

    let direction = 0;

    function render() {
      root.innerHTML = "";
      root.appendChild(h("div", { class: "onboard__steps" },
        STEPS.map((_, i) => h("div", { class: "onboard__pip", dataset: { on: i <= step ? "1" : "0" } }))));
      const panel = STEPS[step]();
      panel.classList.add(direction < 0 ? "enter-back" : direction > 0 ? "enter-fwd" : "enter-rise");
      root.appendChild(panel);
      direction = 0;
      window.scrollTo({ top: 0 });
    }

    function nav(nextLabel, canNext, onNext) {
      return h("div", { class: "row row--between", style: { marginTop: "28px" } },
        step > 0 ? h("button", { class: "btn btn--ghost", onclick: () => { direction = -1; step--; render(); } }, "Back") : h("span"),
        h("button", {
          class: "btn btn--primary", disabled: !canNext,
          onclick: () => { if (onNext) onNext(); if (step < STEPS.length - 1) { direction = 1; step++; render(); } }
        }, nextLabel || "Continue", CAD.icon("arrow")));
    }

    function welcome() {
      return h("div", { class: "stack" },
        h("div", { class: "card" },
          h("p", { class: "eyebrow" }, "Cadence"),
          h("h1", "Recovery has a rhythm."),
          h("p", { style: { marginTop: "12px", color: "var(--ink-2)" } },
            "Cadence is a companion for the weeks after a concussion. It tracks your symptoms, tests the systems concussion actually disrupts, and paces your return to school, work and sport using the graded strategy from the 2023 international consensus statement."),
          h("div", { class: "grid grid--3", style: { marginTop: "20px" } },
            [["lock", "Your health data stays here", "Check-ins, tests and journal entries live in this browser. Your account holds an email address and nothing else, and backup is encrypted before it leaves."],
             ["shield", "Not a diagnosis", "Cadence cannot tell you whether you have a concussion or whether you are safe to play. It organises information for you and your clinician."],
             ["science", "Every number is sourced", "Each score, threshold and model is traced to a published method on the How this works page."]].map((row) =>
              h("div", { class: "stat" },
                h("div", { style: { color: "var(--accent)", marginBottom: "6px" } }, CAD.icon(row[0], 22)),
                h("strong", row[1]),
                h("span", { class: "tiny muted" }, row[2])))),
          h("div", { class: "callout callout--warn", style: { marginTop: "20px" } },
            h("span", { class: "callout__ico" }, CAD.icon("alert")),
            h("div", h("strong", "If this injury just happened, get assessed in person."),
              h("p", { style: { margin: "4px 0 0" } }, "Cadence is for the days and weeks after a clinician has seen you. It is not an emergency tool."))),
          nav("I understand", true, () => { settings.acknowledgedDisclaimer = true; })));
    }

    function safety() {
      const picked = new Set();
      const listEl = h("div", { class: "flag-list" });
      CAD.pcss.RED_FLAGS.forEach((f) => {
        const btn = h("button", { class: "flag-item", type: "button", "aria-pressed": "false" },
          h("span", { class: "flag-item__box" }),
          h("span", h("strong", f.label), h("span", { class: "tiny muted", style: { display: "block" } }, f.note)));
        btn.addEventListener("click", () => {
          const on = btn.getAttribute("aria-pressed") === "true";
          btn.setAttribute("aria-pressed", String(!on));
          if (on) picked.delete(f.id); else picked.add(f.id);
          warn.hidden = picked.size === 0;
        });
        listEl.appendChild(btn);
      });
      const warn = h("div", { class: "callout callout--danger", hidden: true, style: { marginTop: "16px" } },
        h("span", { class: "callout__ico" }, CAD.icon("alert")),
        h("div", h("strong", "Stop and seek emergency care now."),
          h("p", { style: { margin: "4px 0 0" } }, "These signs can mean a bleed, a spinal injury or a worsening brain injury. Call your local emergency number or go to an emergency department. Do not use an app to decide.")));

      return h("div", { class: "stack" },
        h("div", { class: "card" },
          h("p", { class: "eyebrow" }, "Step 1 · Safety first"),
          h("h1", "Any of these right now?"),
          h("p", { class: "card__sub" }, "From the red-flag list in the 2023 consensus statement and the CDC's danger signs. Check anything that is true today."),
          h("div", { style: { marginTop: "18px" } }, listEl),
          warn,
          nav("None of these", true, () => {
            CAD.store.update((s) => { s.redFlagChecks.push({ ts: Date.now(), flags: Array.from(picked), clear: picked.size === 0 }); });
          })));
    }

    function injury() {
      const dateInput = h("input", { class: "input", type: "date", value: draft.injuryDate || CAD.fmt.dayKey(), max: CAD.fmt.dayKey(), onchange: (e) => { draft.injuryDate = e.target.value; render(); } });
      return h("div", { class: "stack" },
        h("div", { class: "card stack" },
          h("div", null,
            h("p", { class: "eyebrow" }, "Step 2 · The injury"),
            h("h1", "When did it happen?")),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Date of injury"), dateInput,
            h("span", { class: "field__hint" }, "Every chart in Cadence is indexed to days since injury.")),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "How did it happen?"),
            h("input", { class: "input", value: draft.mechanism || "", placeholder: "Sport, fall, collision, assault…", oninput: (e) => { draft.mechanism = e.target.value; } })),
          h("div", { class: "field" }, h("span", { class: "field__label" }, "Age band"),
            optionRow([
              { value: "5-7", label: "5–7" }, { value: "8-12", label: "8–12" },
              { value: "13-17", label: "13–17" }, { value: "18-25", label: "18–25" }, { value: "26+", label: "26+" }
            ], draft.ageBand, (v) => { draft.ageBand = v; render(); })),
          h("div", { class: "field" }, h("span", { class: "field__label" }, "Sex at birth"),
            h("span", { class: "field__hint" }, "Used only by the risk panel, because it was one of the strongest predictors in the published model. You can skip it."),
            optionRow([{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "", label: "Prefer not to say" }], draft.sexAtBirth, (v) => { draft.sexAtBirth = v; render(); })),
          nav("Continue", !!draft.injuryDate)));
    }

    function history() {
      return h("div", { class: "stack" },
        h("div", { class: "card stack" },
          h("div", null,
            h("p", { class: "eyebrow" }, "Step 3 · Background"),
            h("h1", "A few things that change recovery"),
            h("p", { class: "card__sub" }, "These are the predictors used by the published paediatric risk score. Answer what you know; you can change any of it later.")),
          h("div", null,
            toggleRow("A previous concussion took more than a week to clear", "The strongest single predictor of a slower recovery.", draft.priorProlonged, (v) => { draft.priorProlonged = v; render(); }),
            toggleRow("Diagnosed migraine history", "Pre-existing migraine shares mechanisms with post-traumatic headache.", draft.migraineHistory, (v) => { draft.migraineHistory = v; render(); }),
            toggleRow("Anxiety, depression or mood history", "Used by the mood module, not by the risk score.", draft.anxietyOrMoodHistory, (v) => { draft.anxietyOrMoodHistory = v; render(); }),
            toggleRow("ADHD or a learning difference", "Changes what a fair return-to-learn plan looks like.", draft.learningOrAdhd, (v) => { draft.learningOrAdhd = v; render(); }),
            toggleRow("Lost consciousness", "", draft.lossOfConsciousness, (v) => { draft.lossOfConsciousness = v; render(); }),
            toggleRow("Memory gap around the injury", "", draft.amnesia, (v) => { draft.amnesia = v; render(); }),
            toggleRow("Answered questions slowly when assessed", "An observed sign of slowed processing at the time of injury.", draft.answeredSlowly, (v) => { draft.answeredSlowly = v; render(); }),
            toggleRow("A clinician has assessed this injury", "Full-contact steps stay locked until this is on.", draft.seenClinician, (v) => { draft.seenClinician = v; render(); })),
          nav("Continue", true)));
    }

    function access() {
      return h("div", { class: "stack" },
        h("div", { class: "card stack" },
          h("div", null,
            h("p", { class: "eyebrow" }, "Step 4 · Make it comfortable"),
            h("h1", "Set the screen so it doesn't hurt"),
            h("p", { class: "card__sub" }, "Light sensitivity and motion sensitivity are the two symptoms most likely to make an app unusable after a concussion. These defaults are chosen for that.")),
          h("div", { class: "field" }, h("span", { class: "field__label" }, "Theme"),
            optionRow([{ value: "light", label: "Warm light" }, { value: "dark", label: "Dim (easier on light sensitivity)" }, { value: "auto", label: "Match system" }], settings.theme, (v) => {
              settings.theme = v; CAD.applySettings(Object.assign({}, CAD.store.get().settings, settings)); render();
            })),
          h("div", { class: "field" }, h("label", { class: "field__label", for: "obScale" }, "Text size"),
            h("input", {
              class: "range", id: "obScale", type: "range", min: "0.85", max: "1.5", step: "0.05", value: String(settings.fontScale),
              oninput: (e) => { settings.fontScale = Number(e.target.value); CAD.applySettings(Object.assign({}, CAD.store.get().settings, settings)); }
            })),
          h("div", null,
            toggleRow("Reduce motion", "Removes animation from tests and transitions. On by default after a head injury.", settings.reduceMotion, (v) => { settings.reduceMotion = v; CAD.applySettings(Object.assign({}, CAD.store.get().settings, settings)); render(); }),
            toggleRow("High contrast", "Stronger borders and text.", settings.highContrast, (v) => { settings.highContrast = v; CAD.applySettings(Object.assign({}, CAD.store.get().settings, settings)); render(); }),
            toggleRow("Readable font", "Switches to a wider-spaced typeface.", settings.dyslexic, (v) => { settings.dyslexic = v; CAD.applySettings(Object.assign({}, CAD.store.get().settings, settings)); render(); }),
            CAD.speech.supported ? toggleRow("Read instructions aloud", "Uses your device's built-in voice so you can rest your eyes.", settings.speech, (v) => { settings.speech = v; render(); }) : null),
          h("div", { class: "field" }, h("span", { class: "field__label" }, "Rest reminder"),
            h("span", { class: "field__hint" }, "Cadence will nudge you to look away after this long on screen."),
            optionRow([{ value: 10, label: "10 min" }, { value: 15, label: "15 min" }, { value: 25, label: "25 min" }, { value: 0, label: "Off" }], settings.restReminderMin, (v) => { settings.restReminderMin = v; render(); })),
          nav("Continue", true)));
    }

    function track() {
      let chosen = CAD.store.get().protocol.track;
      const box = h("div", { class: "stack" });
      function paint() {
        box.innerHTML = "";
        box.appendChild(h("div", { class: "card stack" },
          h("div", null,
            h("p", { class: "eyebrow" }, "Step 5 · Your plan"),
            h("h1", "What are you returning to first?"),
            h("p", { class: "card__sub" }, "Return to learn comes before return to sport. You can run both — Cadence starts you on one.")),
          h("div", { class: "opt-grid" },
            [{ value: "learn", label: "School or work", sub: "Four graded steps" }, { value: "sport", label: "Sport or training", sub: "Six graded steps" }].map((o) =>
              h("button", { class: "opt", type: "button", "aria-pressed": String(chosen === o.value), onclick: () => { chosen = o.value; paint(); } },
                h("strong", { style: { display: "block" } }, o.label), h("span", { class: "tiny muted" }, o.sub)))),
          h("div", { class: "callout callout--accent" },
            h("span", { class: "callout__ico" }, CAD.icon("info")),
            h("div", h("strong", "Want to see it full?"),
              h("p", { style: { margin: "4px 0 0" } }, "Load 24 days of realistic sample data to explore every chart and model, then clear it whenever you like."))),
          h("div", { class: "row", style: { marginTop: "8px" } },
            h("button", { class: "btn btn--primary btn--lg", onclick: () => finish(chosen, false) }, "Start my recovery log", CAD.icon("arrow")),
            h("button", { class: "btn btn--ghost btn--lg", onclick: () => finish(chosen, true) }, CAD.icon("sparkle"), "Explore with sample data"))));
      }
      paint();
      return box;
    }

    function finish(chosenTrack, demo) {
      if (demo) {
        CAD.seed.load();
        CAD.store.update((s) => {
          s.settings = Object.assign(s.settings, settings, { onboarded: true, acknowledgedDisclaimer: true });
          s.protocol.track = chosenTrack;
        });
        CAD.toast("Sample recovery loaded — 24 days of data.");
      } else {
        CAD.store.update((s) => {
          s.profile = Object.assign(s.profile, draft);
          s.settings = Object.assign(s.settings, settings, { onboarded: true, acknowledgedDisclaimer: true });
          s.protocol.track = chosenTrack;
          s.protocol.stage = 1;
          s.protocol.stageStartedAt = Date.now();
          s.protocol.history.push({ ts: Date.now(), stage: 1, event: "started", track: chosenTrack });
        });
      }
      location.hash = "#/today";
      CAD.render();
    }

    render();
    return root;
  };
})();
