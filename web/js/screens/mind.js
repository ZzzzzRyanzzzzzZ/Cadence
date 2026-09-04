(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  const PROMPTS = [
    "What did today ask of me that I could not give?",
    "What is the thought, and what is the evidence for and against it?",
    "One thing that went better than last week",
    "Who have I not told how this actually feels?",
    "If a teammate said this about themselves, what would I say back?",
    "What did I do today that was for recovery, not for other people?"
  ];

  const PACERS = [
    { id: "box", label: "Box breathing", phases: [["Breathe in", 4], ["Hold", 4], ["Breathe out", 4], ["Hold", 4]] },
    { id: "478", label: "4–7–8", phases: [["Breathe in", 4], ["Hold", 7], ["Breathe out", 8]] },
    { id: "long", label: "Long exhale", phases: [["Breathe in", 4], ["Breathe out", 6]] }
  ];

  let pacerTimer = null;

  function breathPacer() {
    let pattern = PACERS[0];
    let phase = 0, count = pattern.phases[0][1], running = false;
    const orb = h("div", { class: "breath__orb" });
    const phaseEl = h("div", { class: "breath__phase" }, "Ready");
    const countEl = h("div", { class: "breath__count" }, "—");
    const btn = h("button", { class: "btn btn--primary btn--lg" }, CAD.icon("play"), "Start");

    function setOrb() {
      const label = pattern.phases[phase][0];
      const reduce = CAD.store.get().settings.reduceMotion;
      if (reduce) { orb.style.transform = "none"; orb.style.opacity = label === "Breathe out" ? "0.6" : "1"; return; }
      orb.style.transform = label === "Breathe in" ? "scale(1.22)" : label === "Breathe out" ? "scale(0.78)" : "scale(1)";
    }

    function tick() {
      count--;
      if (count <= 0) {
        phase = (phase + 1) % pattern.phases.length;
        count = pattern.phases[phase][1];
        phaseEl.textContent = pattern.phases[phase][0];
        setOrb();
        CAD.speech.speak(pattern.phases[phase][0]);
      }
      countEl.textContent = String(count);
    }

    function toggle() {
      running = !running;
      if (running) {
        phase = 0; count = pattern.phases[0][1];
        phaseEl.textContent = pattern.phases[0][0];
        countEl.textContent = String(count);
        setOrb();
        pacerTimer = setInterval(tick, 1000);
        btn.innerHTML = "";
        btn.appendChild(CAD.icon("pause"));
        btn.appendChild(document.createTextNode("Stop"));
      } else {
        clearInterval(pacerTimer); pacerTimer = null;
        phaseEl.textContent = "Ready"; countEl.textContent = "—";
        orb.style.transform = "none";
        btn.innerHTML = "";
        btn.appendChild(CAD.icon("play"));
        btn.appendChild(document.createTextNode("Start"));
      }
    }
    btn.addEventListener("click", toggle);

    return h("div", { class: "card stack" },
      h("div", null,
        h("h2", "Paced breathing"),
        h("p", { class: "card__sub" }, "A slow exhale is the fastest lever on an over-firing autonomic system, and autonomic dysfunction is part of why concussion makes you feel wired and exhausted at once. Two minutes is enough.")),
      h("div", { class: "seg" }, PACERS.map((p) =>
        h("button", {
          class: "seg__btn", type: "button", "aria-pressed": String(p.id === pattern.id),
          onclick: (e) => {
            pattern = p;
            Array.from(e.target.parentNode.children).forEach((c) => c.setAttribute("aria-pressed", String(c === e.target)));
            if (running) { toggle(); }
          }
        }, p.label))),
      h("div", { class: "breath" }, orb, phaseEl, countEl, btn),
      h("p", { class: "tiny muted" }, "Stop if you feel light-headed. With reduced motion on, the circle holds still and the count leads instead."));
  }

  function screener(state) {
    const latest = state.checkins.slice().reverse().find((c) => c.phq || c.gad);
    const values = { phq1: 0, phq2: 0, gad1: 0, gad2: 0 };
    const phqOut = h("b", { class: "mono" }, "0");
    const gadOut = h("b", { class: "mono" }, "0");
    const verdict = h("div", { class: "callout", hidden: true });

    function refresh() {
      const phq = values.phq1 + values.phq2;
      const gad = values.gad1 + values.gad2;
      phqOut.textContent = phq + " / 6";
      gadOut.textContent = gad + " / 6";
      verdict.hidden = false;
      verdict.innerHTML = "";
      const positive = phq >= 3 || gad >= 3;
      verdict.className = "callout callout--" + (positive ? "warn" : "good");
      verdict.appendChild(h("span", { class: "callout__ico" }, CAD.icon(positive ? "info" : "check")));
      verdict.appendChild(h("div", null,
        h("strong", positive
          ? "This screen is positive — worth telling someone."
          : "This screen is negative today."),
        h("p", { style: { margin: "4px 0 0" } }, positive
          ? "A score of 3 or more on either two-item screen is the usual threshold for a fuller assessment. Mood symptoms after concussion are common, treatable, and not a character failure — tell your clinician, and tell one person who is not a clinician."
          : "Keep checking. Low mood and anxiety often arrive in week two or three, when the initial support fades and the missing-out sets in.")));
    }

    function itemRow(item, key) {
      const buttons = [];
      return h("div", { class: "symptom" },
        h("div", { class: "symptom__head" }, h("span", { class: "symptom__name" }, item.label), h("span", { class: "symptom__val" }, "Over the last 2 weeks")),
        h("div", { class: "scale", style: { gridTemplateColumns: "repeat(4, minmax(0,1fr))" }, role: "group", "aria-label": item.label },
          CAD.pcss.FREQ_SCALE.map((label, n) => {
            const b = h("button", {
              class: "scale__btn", type: "button", "aria-pressed": String(values[key] === n),
              style: { fontSize: "0.78em", fontWeight: 560, padding: "6px" },
              dataset: { sev: n === 0 ? "none" : "on" },
              onclick: () => { values[key] = n; buttons.forEach((bb, i) => bb.setAttribute("aria-pressed", String(i === n))); refresh(); }
            }, label);
            buttons.push(b);
            return b;
          })));
    }

    return h("div", { class: "card stack" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Mood check"),
          h("p", { class: "card__sub" }, "The two-item depression and anxiety screens used in primary care. Four questions, and they belong in a concussion app: mood symptoms are among the strongest predictors of a slow recovery, and among the most treatable.")),
        latest ? h("span", { class: "chip" }, "Last run " + CAD.fmt.shortDate(latest.ts)) : null),
      h("p", { class: "cluster-head" }, "Depression screen (PHQ-2)"),
      CAD.pcss.PHQ2.map((item, i) => itemRow(item, "phq" + (i + 1))),
      h("p", { class: "cluster-head" }, "Anxiety screen (GAD-2)"),
      CAD.pcss.GAD2.map((item, i) => itemRow(item, "gad" + (i + 1))),
      h("div", { class: "row row--between" },
        h("div", { class: "row", style: { gap: "18px" } },
          h("span", null, h("span", { class: "tiny muted" }, "PHQ-2 "), phqOut),
          h("span", null, h("span", { class: "tiny muted" }, "GAD-2 "), gadOut)),
        h("button", {
          class: "btn btn--primary",
          onclick: () => {
            const day = CAD.store.todayKey();
            const existing = CAD.store.checkinFor(day);
            if (!existing) {
              CAD.toast("Log today's symptom check-in first so this attaches to a day.");
              location.hash = "#/checkin";
              CAD.render();
              return;
            }
            CAD.store.saveCheckin(Object.assign({}, existing, {
              phq: { phq1: values.phq1, phq2: values.phq2 },
              gad: { gad1: values.gad1, gad2: values.gad2 }
            }));
            CAD.toast("Mood screen saved to today's check-in.");
            CAD.render();
          }
        }, CAD.icon("check"), "Save to today")),
      verdict,
      h("p", { class: "attrib" }, "PHQ-2: Kroenke, Spitzer & Williams, Medical Care 2003. GAD-2: Kroenke et al., Annals of Internal Medicine 2007. Both are free to use. Neither is a diagnosis."));
  }

  function crisisCard() {
    return h("div", { class: "callout callout--danger" },
      h("span", { class: "callout__ico" }, CAD.icon("heart")),
      h("div", null,
        h("strong", "If you are thinking about hurting yourself, tell someone now."),
        h("p", { style: { margin: "6px 0 0" } },
          "In the US and Canada, call or text ", h("b", "988"), ". In the UK and Ireland, call ", h("b", "116 123"), " for Samaritans. Elsewhere, findahelpline.com lists a service for your country. If you are in immediate danger, call your local emergency number."),
        h("p", { class: "tiny", style: { margin: "6px 0 0" } }, "Cadence has no way to contact anyone for you. It cannot see this screen, and it cannot help in a crisis — a person can.")));
  }

  function journal(state) {
    const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];
    const ta = h("textarea", { class: "textarea", placeholder: "Write as much or as little as you want. Nothing here leaves your device." });
    let mood = 5;
    const moodOut = h("output", { class: "mono" }, "5 / 10");
    return h("div", { class: "card stack" },
      h("div", null,
        h("h2", "Reframe & write"),
        h("p", { class: "card__sub" }, "Concussion recovery is boring, isolating and invisible to everyone around you. Naming a thought and testing it against evidence is the core move of cognitive behavioural therapy, and it works on paper too.")),
      h("div", { class: "callout callout--accent" },
        h("span", { class: "callout__ico" }, CAD.icon("sparkle")),
        h("div", h("strong", "Today's prompt"), h("p", { style: { margin: "4px 0 0" } }, prompt))),
      ta,
      h("div", { class: "field" },
        h("div", { class: "row row--between" }, h("label", { class: "field__label" }, "How is your mood right now?"), moodOut),
        h("input", { class: "range", type: "range", min: "0", max: "10", value: "5", "aria-label": "Mood right now", oninput: (e) => { mood = Number(e.target.value); moodOut.textContent = mood + " / 10"; } })),
      h("div", { class: "row row--end" },
        h("button", {
          class: "btn btn--primary",
          onclick: () => {
            if (!ta.value.trim()) { CAD.toast("Nothing to save yet."); return; }
            CAD.store.update((s) => { s.journal.push({ id: CAD.uid(), ts: Date.now(), prompt, text: ta.value.trim(), mood }); });
            CAD.toast("Entry saved on this device.");
            CAD.render();
          }
        }, CAD.icon("check"), "Save entry")),
      state.journal.length ? h("div", { class: "stack" },
        h("p", { class: "cluster-head" }, "Earlier entries"),
        state.journal.slice().reverse().slice(0, 4).map((e) =>
          h("div", { class: "journal-entry" },
            h("time", CAD.fmt.shortDate(e.ts) + " · mood " + e.mood + "/10"),
            h("p", { class: "tiny muted", style: { margin: "4px 0" } }, e.prompt),
            h("p", { style: { margin: 0 } }, e.text)))) : null);
  }

  CAD.screens.mind = function () {
    const state = CAD.store.get();
    const emotional = state.checkins.map((c) => ({ x: CAD.derive.dayIndex(state, c.day), y: c.clusters.emotional }));
    const sleepCluster = state.checkins.map((c) => ({ x: CAD.derive.dayIndex(state, c.day), y: c.clusters.sleep }));

    return h("div", { class: "wrap stack" },
      h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "Daily"),
        h("h1", "Mind & mood"),
        h("p", "A concussion is a physical injury with a psychological aftermath. Irritability, low mood and anxiety are part of the injury, not a separate failing — and they are the part most likely to keep going after the headaches stop.")),

      crisisCard(),

      state.checkins.length >= 3 ? h("section", { class: "card stack" },
        h("div", { class: "card__head" }, h("div", null,
          h("h2", "Emotional and sleep symptoms over time"),
          h("p", { class: "card__sub" }, "Pulled from the emotional and sleep clusters of your daily check-in. These two often move together, and both tend to lag behind the physical symptoms."))),
        CAD.charts.line({
          series: [
            { name: "Emotional", color: "var(--series-4)", values: emotional },
            { name: "Sleep & fatigue", color: "var(--series-3)", values: sleepCluster }
          ],
          height: 240, yZero: true,
          formatX: (x) => "day " + Math.round(x), formatY: (y) => String(Math.round(y)),
          ariaLabel: "Emotional and sleep cluster scores by day since injury",
          tableHeaders: ["Day", "Emotional", "Sleep & fatigue"],
          tableRows: state.checkins.slice(-30).map((c) => [String(CAD.derive.dayIndex(state, c.day)), String(c.clusters.emotional), String(c.clusters.sleep)])
        })) : null,

      screener(state),
      breathPacer(),
      journal(state),

      h("div", { class: "card stack" },
        h("h2", "What usually helps"),
        h("div", { class: "list" }, [
          ["Keep one anchor", "One social contact and one small routine each day does more for mood than a perfect rest schedule."],
          ["Name the loss", "Missing a season, a term or a job matters. Grief that gets named stops leaking into everything else."],
          ["Sleep window before sleep length", "A consistent bedtime and wake time beats chasing extra hours. Naps before 3pm, under 30 minutes."],
          ["Light activity is treatment", "Gentle movement below your symptom threshold improves mood and speeds recovery. Total rest past the first two days does not."],
          ["Tell people what you need", "'I can do 20 minutes then I need to stop' is more useful to everyone than 'I'm fine'."]
        ].map((row) => h("div", { class: "list__item" },
          h("span", { class: "tile__ico" }, CAD.icon("check")),
          h("div", null, h("strong", row[0]), h("div", { class: "tiny muted" }, row[1])))))));
  };

  CAD.screens.mind.leave = function () {
    if (pacerTimer) { clearInterval(pacerTimer); pacerTimer = null; }
  };
})();
