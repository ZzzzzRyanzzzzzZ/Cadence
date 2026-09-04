(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  const GLOSSARY = [
    ["Concussion", "A brain injury caused by a knock, jolt or blow. Scans usually look normal. That does not mean nothing is wrong."],
    ["Post concussion symptoms", "The headaches, tiredness, fogginess and mood changes that carry on after the injury. Common, and usually temporary."],
    ["Symptom score", "A number out of 132 from a list of 22 symptoms rated every day. Only useful compared to yesterday, not to other people."],
    ["Vestibular", "The balance system in the inner ear. When it is off, people feel dizzy or unsteady, especially when they move their head."],
    ["Oculomotor", "Eye movement. After a concussion the eyes often stop working together smoothly, which causes headaches when reading."],
    ["Convergence", "How close something can get to the nose before it goes double. Often worse after a concussion, and it makes reading hard."],
    ["Graded return", "Adding activity back in small steps, waiting at least a day at each step, and going back a step if symptoms flare."],
    ["Below the threshold", "Doing enough to keep going but stopping before symptoms climb. This is the target, not total rest."],
    ["Exacerbation", "Symptoms going up because of something they did. A small rise that settles quickly is fine. A big rise means the step was too big."],
    ["Cognitive rest", "The old advice to avoid all thinking and screens. Now known to be harmful past the first day or two."]
  ];

  const HELP_BASE = [
    "Ask how they are once, then let it go. Being asked every hour is exhausting.",
    "Keep one social thing in the day, even a short one. Isolation is what turns a short recovery into a long one.",
    "Protect the sleep window more than the sleep length. Same bedtime, same wake time."
  ];

  function plainScore(total) {
    if (total === 0) return "no symptoms at all today";
    if (total <= 12) return "a light day";
    if (total <= 30) return "a moderate day";
    if (total <= 60) return "a heavy day";
    return "a very heavy day";
  }

  function trendWord(delta) {
    if (delta === null) return "no comparison yet";
    if (delta <= -5) return "clearly better than yesterday";
    if (delta < 0) return "slightly better than yesterday";
    if (delta === 0) return "the same as yesterday";
    if (delta <= 5) return "slightly worse than yesterday";
    return "clearly worse than yesterday";
  }

  function buildHelp(state) {
    const out = [];
    const TOPIC = {
      screenMinutes: "screens", screenStrain: "screens", cognitiveMinutes: "study",
      exerciseMinutes: "exercise", sleepHours: "sleep", stress: "stress"
    };
    const PHRASE = {
      screens: "time on screens", study: "how much schoolwork they take on",
      exercise: "how much exercise they do", sleep: "how much they sleep", stress: "how stressed the day is"
    };
    const trig = CAD.derive.triggers(state);
    const usedTopics = {};
    trig.findings.forEach((f) => {
      if (f.direction !== "worse") return;
      const topic = TOPIC[f.behaviour.id] || f.behaviour.id;
      if (usedTopics[topic] || Object.keys(usedTopics).length >= 2) return;
      usedTopics[topic] = true;
      out.push("Keep an eye on " + (PHRASE[topic] || f.behaviour.label.toLowerCase()) +
        ". Their own logged data shows more of it is followed by worse symptoms " +
        (f.lag.lag === 0 ? "the same day" : "the next day") + ".");
    });
    const latest = CAD.derive.latestCheckin(state);
    if (latest) {
      const c = latest.clusters;
      const worst = ["somatic", "cognitive", "sleep", "emotional"]
        .map((k) => ({ k, v: c[k] / ({ somatic: 54, cognitive: 36, sleep: 18, emotional: 24 }[k]) }))
        .sort((a, b) => b.v - a.v)[0];
      const advice = {
        somatic: "Physical symptoms are the biggest part right now. Lower lighting and less noise will help more than anything you say.",
        cognitive: "Fogginess and concentration are the biggest part right now. Give them one thing at a time and do not expect them to remember plans.",
        sleep: "Tiredness is the biggest part right now. Let them nap before mid afternoon, and keep naps under half an hour.",
        emotional: "Mood is the biggest part right now. Irritability and tearfulness are symptoms of the injury, not attitude. Do not take it personally."
      }[worst.k];
      if (advice) out.push(advice);
    }
    if ((state.oculomotorRuns || []).length) {
      const last = state.oculomotorRuns[state.oculomotorRuns.length - 1];
      const score = CAD.oculo.scoreRun(last);
      if (score.flaggedItems >= 2) out.push("Eye and balance movements still bring on symptoms. Reading and busy places will be harder than they look.");
    }
    return out.concat(HELP_BASE).slice(0, 5);
  }

  function careText(state) {
    const latest = CAD.derive.latestCheckin(state);
    const r = CAD.protocol.readiness(state);
    const dsi = CAD.store.daysSinceInjury();
    const name = state.profile.name || "They";
    const lines = [];
    lines.push("CADENCE - NOTES FOR WHOEVER IS LOOKING AFTER " + name.toUpperCase());
    lines.push(CAD.fmt.longDate(new Date()));
    lines.push("");
    lines.push("Day " + (dsi === null ? "?" : dsi) + " since the injury.");
    if (latest) lines.push("Today is " + plainScore(latest.total) + " (" + latest.total + " out of 132), " + trendWord(latest && state.checkins.length > 1 ? latest.total - state.checkins[state.checkins.length - 2].total : null) + ".");
    lines.push("");
    lines.push("WHERE THEY ARE UP TO");
    lines.push(r.track.label + ", step " + r.stage.n + " of " + r.track.stages.length + ": " + r.stage.title);
    lines.push(r.stage.detail);
    lines.push(r.ready ? "They have met the conditions to try the next step." : "They should stay on this step for now.");
    lines.push("");
    lines.push("CALL EMERGENCY SERVICES IF ANY OF THESE HAPPEN");
    CAD.pcss.RED_FLAGS.forEach((f) => lines.push("  - " + f.label));
    lines.push("");
    lines.push("HOW TO HELP TODAY");
    buildHelp(state).forEach((x) => lines.push("  - " + x));
    lines.push("");
    lines.push("This is a self tracking app, not a medical record. It cannot diagnose anything or say when they are safe to play.");
    return lines.join("\n");
  }

  CAD.screens.caregiver = function () {
    const state = CAD.store.get();
    const latest = CAD.derive.latestCheckin(state);
    const prev = state.checkins.length > 1 ? state.checkins[state.checkins.length - 2] : null;
    const delta = latest && prev ? latest.total - prev.total : null;
    const r = CAD.protocol.readiness(state);
    const dsi = CAD.store.daysSinceInjury();
    const name = state.profile.name || "them";
    const help = buildHelp(state);

    const wrap = h("div", { class: "wrap stack" });

    wrap.appendChild(h("div", { class: "page-head no-print" },
      h("p", { class: "eyebrow" }, "Share"),
      h("h1", "For whoever is looking after " + name),
      h("p", "Nobody hands a parent or a coach anything useful. This is the page to print, or copy into a message, so the person looking after them knows what today looks like, what to watch for, and what actually helps.")));

    wrap.appendChild(h("div", { class: "row no-print" },
      h("button", { class: "btn btn--primary", onclick: () => window.print() }, CAD.icon("print"), "Print this page"),
      h("button", {
        class: "btn btn--ghost",
        onclick: () => {
          const text = careText(state);
          if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => CAD.toast("Copied. Paste it into a message.")).catch(() => CAD.toast("Copy blocked by the browser."));
          else CAD.toast("Clipboard not available here.");
        }
      }, "Copy as a message"),
      h("button", {
        class: "btn btn--ghost",
        onclick: () => {
          const text = careText(state);
          try {
            const blob = new Blob([text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = h("a", { href: url, download: "cadence-caregiver-notes.txt" });
            document.body.appendChild(a); a.click();
            setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
            CAD.toast("Saved.");
          } catch (e) { CAD.toast("Download blocked here."); }
        }
      }, CAD.icon("download"), "Save as a file")));

    wrap.appendChild(h("section", { class: "card stack" },
      h("div", { class: "row row--between" },
        h("div", null,
          h("p", { class: "eyebrow" }, dsi === null ? "" : "Day " + dsi + " since the injury"),
          h("h2", latest ? "Today is " + plainScore(latest.total) : "No check-in logged today")),
        latest ? h("span", { class: "chip chip--" + CAD.pcss.severityBand(latest.total).tone }, trendWord(delta)) : null),
      latest ? h("p", { class: "card__sub" },
        "They rated " + latest.count + " of 22 symptoms as present, adding up to " + latest.total + " out of a possible 132. That number is only meaningful next to their own previous days, never next to another person.")
        : h("p", { class: "card__sub" }, "Ask them to fill in the daily check-in. Everything on this page is built from it."),
      latest && state.checkins.length >= 4 ? CAD.charts.line({
        series: [{ name: "Symptom score", color: "var(--series-1)", values: state.checkins.slice(-21).map((c) => ({ x: CAD.derive.dayIndex(state, c.day), y: c.total })) }],
        height: 200, yZero: true,
        formatX: (x) => "day " + Math.round(x), formatY: (y) => String(Math.round(y)),
        ariaLabel: "Symptom score over the last three weeks"
      }) : null));

    wrap.appendChild(h("section", { class: "card stack" },
      h("div", null,
        h("h2", "Call emergency services if any of these happen"),
        h("p", { class: "card__sub" }, "These are the signs that mean something worse than a concussion. Do not wait to see if they settle, and do not let them drive.")),
      h("div", { class: "grid grid--2" }, CAD.pcss.RED_FLAGS.map((f) =>
        h("div", { class: "callout callout--danger", style: { padding: "12px 14px" } },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", null, h("strong", f.label), h("p", { class: "tiny", style: { margin: "3px 0 0" } }, f.note)))))));

    wrap.appendChild(h("section", { class: "card stack" },
      h("div", null,
        h("h2", "Where they are up to"),
        h("p", { class: "card__sub" }, r.track.label + ", step " + r.stage.n + " of " + r.track.stages.length + ".")),
      h("div", { class: "callout callout--accent" },
        h("span", { class: "callout__ico" }, CAD.icon("plan")),
        h("div", null,
          h("strong", r.stage.title),
          h("p", { style: { margin: "4px 0 0" } }, r.stage.detail))),
      h("div", { class: "list" },
        h("div", { class: "list__item" },
          h("span", { class: "dot dot--" + (r.ready ? "good" : "warning") }),
          h("div", null,
            h("strong", r.ready ? "Ready to try the next step" : "Should stay on this step for now"),
            h("div", { class: "tiny muted" }, r.ready
              ? "The app's conditions are met. That is not the same as medical clearance."
              : r.reasons.filter((x) => !x.ok).map((x) => x.text).join(" "))))),
      r.stage.requiresClearance ? h("div", { class: "callout callout--warn" },
        h("span", { class: "callout__ico" }, CAD.icon("lock")),
        h("div", null, h("strong", "This step needs a doctor's clearance first."),
          h("p", { style: { margin: "4px 0 0" } }, "No app can give that. Full contact without it is how second injuries happen."))) : null));

    wrap.appendChild(h("section", { class: "card stack" },
      h("div", null,
        h("h2", "How to help today"),
        h("p", { class: "card__sub" }, "The first few come from patterns in their own logged data. The rest hold for almost everyone.")),
      h("div", { class: "list" }, help.map((x) =>
        h("div", { class: "list__item" },
          h("span", { class: "tile__ico", style: { width: "34px", height: "34px", background: "var(--teal-soft)", color: "var(--teal)" } }, CAD.icon("check", 18)),
          h("div", null, x))))));

    wrap.appendChild(h("section", { class: "card stack" },
      h("div", null,
        h("h2", "What the words mean"),
        h("p", { class: "card__sub" }, "The terms that turn up on discharge notes and in appointments, in plain language.")),
      h("div", { class: "list" }, GLOSSARY.map((g) =>
        h("div", { class: "list__item" },
          h("div", null,
            h("strong", g[0]),
            h("div", { class: "tiny muted" }, g[1])))))));

    wrap.appendChild(h("div", { class: "callout callout--warn" },
      h("span", { class: "callout__ico" }, CAD.icon("info")),
      h("div", null,
        h("strong", "What this page is not"),
        h("p", { style: { margin: "4px 0 0" } }, "Everything here comes from what they typed into an app. It is not a medical record, it cannot diagnose anything, and it cannot tell you when they are safe to play or drive. Take it to an appointment; do not use it instead of one."))));

    return wrap;
  };

  CAD.screens.caregiver.careText = careText;
})();
