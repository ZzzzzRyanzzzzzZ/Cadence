(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  const CRISIS = /\b(kill myself|killing myself|end my life|suicide|suicidal|want to die|better off dead|hurt myself|harm myself|self harm|cut myself)\b/i;
  const EMERGENCY = /\b(seizure|convulsion|vomit(ed|ing)? (again|repeatedly|a lot)|repeated vomiting|slurred speech|speech is slurred|slurring my words|slurring words|one pupil|pupils are different|uneven pupils|can'?t wake|cannot wake|won'?t wake|can'?t stay awake|cannot stay awake|passed out|blacked out|numb(ness)? in my (arm|leg)|weakness in my (arm|leg)|worst headache|headache is getting worse|getting more confused)\b/i;

  const SUGGESTIONS = [
    "What does my symptom trend actually mean?",
    "Why am I still tired three weeks in?",
    "How do I explain this to my teachers?",
    "What should I try next on my ladder?",
    "Is it normal to feel this low about it?"
  ];

  let history = [];

  function buildContext(state) {
    const latest = CAD.derive.latestCheckin(state);
    const traj = CAD.derive.trajectory(state);
    const r = CAD.protocol.readiness(state);
    const trig = CAD.derive.triggers(state);
    const rc = CAD.derive.rciSummary(state);
    const tol = CAD.tolerance.todayStats();
    const lines = [];
    const dsi = CAD.store.daysSinceInjury();

    lines.push("Days since injury: " + (dsi === null ? "not recorded" : dsi));
    if (state.profile.mechanism) lines.push("How it happened: " + state.profile.mechanism);
    if (state.profile.ageBand) lines.push("Age band: " + state.profile.ageBand);
    if (state.profile.migraineHistory) lines.push("Has a migraine history.");
    if (state.profile.priorProlonged) lines.push("A previous concussion took over a week to clear.");

    if (latest) {
      lines.push("Latest check-in (" + latest.day + "): " + latest.total + " out of 132, across " + latest.count + " of 22 symptoms.");
      lines.push("Symptom clusters — physical " + latest.clusters.somatic + "/54, cognitive " + latest.clusters.cognitive + "/36, sleep and fatigue " + latest.clusters.sleep + "/18, emotional " + latest.clusters.emotional + "/24.");
      const top = CAD.pcss.SYMPTOMS.map((s) => ({ label: s.label, v: latest.pcss[s.id] || 0 }))
        .filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
      if (top.length) lines.push("Worst symptoms right now: " + top.map((x) => x.label.toLowerCase() + " " + x.v + "/6").join(", ") + ".");
      if (isFinite(latest.sleepHours)) lines.push("Slept " + latest.sleepHours + " hours. Screen time " + latest.screenMinutes + " min. Exercise " + latest.exerciseMinutes + " min. Stress " + latest.stress + "/10.");
    } else {
      lines.push("No check-ins logged yet.");
    }

    const w = CAD.derive.weeklyDelta(state);
    if (w !== null) lines.push("Change against the previous week: " + CAD.fmt.signed(w, 1) + " points (negative is improving).");
    if (traj.ok) lines.push("Fitted recovery curve: decay constant " + CAD.fmt.n(traj.params.tau, 1) + " days, half-life " + CAD.fmt.n(traj.halfLife, 1) + " days, modelled floor " + CAD.fmt.n(traj.plateau, 1) + " points, fit quality " + traj.quality + ".");
    if (traj.ok && traj.recentSlope > 0.3) lines.push("Recent check-ins are trending upward, not down.");

    lines.push("Graded return: " + r.track.label + ", step " + r.stage.n + " of " + r.track.stages.length + " (" + r.stage.title + "). " + (r.ready ? "App criteria for the next step are met." : "Currently holding at this step."));
    if (!r.ready) {
      const blockers = r.reasons.filter((x) => !x.ok).map((x) => x.text);
      if (blockers.length) lines.push("Why it is holding: " + blockers.join(" "));
    }

    if (trig.findings.length) lines.push("Associations found in their own data: " + trig.findings.map((f) => f.title).join(" "));
    else lines.push("No behaviour associations have cleared the statistical bar yet.");

    if (rc.declines.length) lines.push("Cognitive measures below baseline: " + rc.declines.map((d) => d.metric.label).join(", ") + ".");
    if (rc.improves.length) lines.push("Cognitive measures recovered past baseline: " + rc.improves.map((d) => d.metric.label).join(", ") + ".");

    if (tol) lines.push("Screen strain today averaged " + Math.round(tol.mean) + " out of 100, peaking at " + Math.round(tol.peak) + ", over " + tol.minutesTracked + " minutes tracked.");

    const items = (state.ladder && state.ladder.items) || [];
    const attempts = [];
    items.forEach((i) => (i.attempts || []).forEach((a) => {
      if (isFinite(a.predicted) && isFinite(a.actual)) attempts.push(a.predicted - a.actual);
    }));
    if (attempts.length >= 3) {
      lines.push("Exposure ladder: " + items.length + " activities, " + attempts.length + " attempts, average gap between predicted and actual difficulty " + CAD.fmt.signed(CAD.stats.mean(attempts), 1) + " points (positive means they expect worse than they get).");
    }
    if (items.filter((i) => !(i.attempts || []).length).length) {
      lines.push("Untried activities on their ladder: " + items.filter((i) => !(i.attempts || []).length).map((i) => i.title).join(", ") + ".");
    }

    return lines.join("\n");
  }

  function bubble(role, text, pending) {
    return h("div", { class: "chat__row chat__row--" + role },
      h("div", { class: "chat__bubble chat__bubble--" + role + (pending ? " chat__bubble--pending" : "") },
        String(text).split("\n").filter((p) => p.trim()).map((p) => h("p", p))));
  }

  function safetyCard(kind) {
    if (kind === "crisis") {
      return h("div", { class: "callout callout--danger" },
        h("span", { class: "callout__ico" }, CAD.icon("heart")),
        h("div", null,
          h("strong", "Please talk to a person, not this app."),
          h("p", { style: { margin: "6px 0 0" } },
            "In the US and Canada, call or text ", h("b", "988"), ". In the UK and Ireland, call ", h("b", "116 123"), ". Elsewhere, findahelpline.com lists a service for your country. If you are in immediate danger, call your local emergency number."),
          h("p", { class: "tiny", style: { margin: "6px 0 0" } },
            "Your message was not sent anywhere. Low mood after a head injury is common and treatable, and telling one person you trust is the step that actually helps.")));
    }
    return h("div", { class: "callout callout--danger" },
      h("span", { class: "callout__ico" }, CAD.icon("alert")),
      h("div", null,
        h("strong", "That is a red flag. Stop and get seen now."),
        h("p", { style: { margin: "6px 0 0" } },
          "What you described is on the emergency list for head injuries. Call your local emergency number or go to an emergency department. Do not drive yourself, and do not wait to see if it settles."),
        h("p", { class: "tiny", style: { margin: "6px 0 0" } },
          "Your message was not sent to the model. No app should be answering this one.")));
  }

  CAD.screens.chat = function () {
    const state = CAD.store.get();
    const wrap = h("div", { class: "wrap stack" });

    wrap.appendChild(h("div", { class: "page-head" },
      h("p", { class: "eyebrow" }, "Support"),
      h("h1", "Ask about your recovery"),
      h("p", "A companion that can see the numbers you have been logging. It can explain what your data means, help you plan a week, or help you word something for a teacher or a coach. It cannot diagnose you, clear you to play, or tell you when you will be better.")));

    if (!CAD.api.state.online || !CAD.api.state.account) {
      wrap.appendChild(h("div", { class: "card stack" },
        h("h2", CAD.api.state.online ? "Sign in to use this" : "Not available on this build"),
        h("p", { class: "card__sub" }, CAD.api.state.online
          ? "This is the one feature that sends anything off your device, so it is tied to an account and rate limited. Everything else in Cadence works without one."
          : "This build has no server behind it, so there is no language model to talk to. Every other feature works exactly the same."),
        CAD.api.state.online ? h("div", { class: "row" },
          h("button", {
            class: "btn btn--primary",
            onclick: () => { CAD.api.setGuest(false); location.hash = ""; CAD.render(true); }
          }, CAD.icon("arrow"), "Sign in")) : null));
      return wrap;
    }

    if (!CAD.api.state.coach) {
      wrap.appendChild(h("div", { class: "card stack" },
        h("h2", "No language model configured"),
        h("p", { class: "card__sub" }, "This server has no model key set, so the chat is switched off. Everything else in Cadence is unaffected.")));
      return wrap;
    }

    const log = h("div", { class: "chat__log" });
    const input = h("textarea", {
      class: "textarea chat__input", rows: "1", placeholder: "Ask anything about your recovery…",
      "aria-label": "Your message"
    });
    const sendBtn = h("button", { class: "btn btn--primary" }, CAD.icon("arrow"), "Send");
    let busy = false;

    function paint() {
      log.innerHTML = "";
      if (!history.length) {
        log.appendChild(h("div", { class: "chat__empty" },
          h("p", { class: "muted" }, "It can see your check-ins, your recovery curve, your protocol step, your ladder and the associations found in your own data. Try one of these:"),
          h("div", { class: "chat__suggestions" }, SUGGESTIONS.map((s) =>
            h("button", { class: "chip chip--accent", onclick: () => { input.value = s; send(); } }, s)))));
      }
      history.forEach((m) => {
        if (m.safety) log.appendChild(safetyCard(m.safety));
        else log.appendChild(bubble(m.role, m.content, m.pending));
      });
      log.scrollTop = log.scrollHeight;
    }

    async function send() {
      if (busy) return;
      const text = input.value.trim();
      if (!text) return;

      if (CRISIS.test(text)) {
        history.push({ role: "user", content: text });
        history.push({ safety: "crisis" });
        input.value = "";
        paint();
        return;
      }
      if (EMERGENCY.test(text)) {
        history.push({ role: "user", content: text });
        history.push({ safety: "emergency" });
        input.value = "";
        paint();
        return;
      }

      history.push({ role: "user", content: text });
      history.push({ role: "assistant", content: "Thinking…", pending: true });
      input.value = "";
      busy = true;
      sendBtn.disabled = true;
      paint();

      try {
        const payload = history.filter((m) => !m.safety && !m.pending).map((m) => ({ role: m.role, content: m.content }));
        const res = await CAD.api.chat(payload, buildContext(CAD.store.get()));
        history = history.filter((m) => !m.pending);
        history.push({ role: "assistant", content: res.text || "No answer came back." });
      } catch (e) {
        history = history.filter((m) => !m.pending);
        history.push({ role: "assistant", content: e.message || "Could not reach the model." });
      }
      busy = false;
      sendBtn.disabled = false;
      paint();
      input.focus();
    }

    sendBtn.addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });

    wrap.appendChild(h("div", { class: "card chat" },
      log,
      h("div", { class: "chat__composer" }, input, sendBtn),
      h("p", { class: "tiny muted", style: { margin: "10px 0 0" } },
        "Enter sends, shift and enter makes a new line. Written by a language model, not a clinician.")));

    const ctx = buildContext(state);
    wrap.appendChild(h("details", { class: "card", style: { padding: "16px 20px" } },
      h("summary", { style: { cursor: "pointer", fontWeight: 600, fontSize: "0.92em" } }, "Exactly what gets sent"),
      h("div", { style: { marginTop: "12px" } },
        h("p", { class: "tiny muted" }, "Your journal entries, your notes, your name and your email are never included. This is the whole payload, regenerated fresh with every message:"),
        h("pre", { class: "chat__ctx" }, ctx),
        h("p", { class: "tiny muted", style: { marginTop: "10px" } },
          "Messages mentioning self harm or an emergency red flag are caught in your browser and answered with crisis or emergency information instead. Those never reach the model at all."))));

    wrap.appendChild(h("div", { class: "callout callout--warn" },
      h("span", { class: "callout__ico" }, CAD.icon("shield")),
      h("div", null,
        h("strong", "What it is not allowed to do"),
        h("p", { style: { margin: "4px 0 0" } },
          "It is instructed never to diagnose, never to say you are recovered or cleared to play or drive, never to predict a recovery date, never to contradict the graded protocol, never to suggest pushing through symptoms, and never to discuss medication. Ask it anything clinical and it should send you to your clinician. If it ever breaks one of those, stop trusting it and tell someone."))));

    paint();
    return wrap;
  };

  CAD.screens.chat.buildContext = buildContext;
})();
