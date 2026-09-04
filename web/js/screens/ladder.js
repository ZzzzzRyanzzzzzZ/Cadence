(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  const S = CAD.stats;
  CAD.screens = CAD.screens || {};

  const CATEGORIES = [
    { id: "screen", label: "Screens", tint: "violet", examples: "Reading a chapter, 20 minutes of homework, watching an episode" },
    { id: "social", label: "People & noise", tint: "berry", examples: "A busy hallway, the cafeteria, a friend's house" },
    { id: "motion", label: "Movement", tint: "teal", examples: "A car ride, a walk outside, jogging, watching practice" },
    { id: "light", label: "Light", tint: "sun", examples: "Bright sunlight, supermarket lighting, a lit classroom" },
    { id: "load", label: "Thinking", tint: "accent", examples: "A test, a rehearsal, an hour of catching up" }
  ];

  const STARTERS = [
    { title: "Read for 10 minutes", category: "screen" },
    { title: "Walk outside for 15 minutes", category: "motion" },
    { title: "Sit in a busy room for 20 minutes", category: "social" },
    { title: "Ride in a car for 10 minutes", category: "motion" },
    { title: "Do 20 minutes of schoolwork", category: "load" },
    { title: "Go to a shop with bright lighting", category: "light" }
  ];

  function tint(name) {
    const map = {
      accent: ["var(--accent-soft)", "var(--accent)"],
      violet: ["var(--violet-soft)", "var(--violet)"],
      teal: ["var(--teal-soft)", "var(--teal)"],
      berry: ["var(--berry-soft)", "var(--berry)"],
      sun: ["var(--sun-soft)", "var(--sun)"]
    };
    const [bg, fg] = map[name] || map.accent;
    return { background: bg, color: fg };
  }

  function ensure(state) {
    if (!state.ladder) state.ladder = { items: [] };
    if (!state.ladder.items) state.ladder.items = [];
    return state.ladder;
  }

  function allAttempts(state) {
    const out = [];
    ensure(state).items.forEach((item) => {
      (item.attempts || []).forEach((a) => {
        if (isFinite(a.predicted) && isFinite(a.actual)) out.push(Object.assign({ item: item.title, category: item.category }, a));
      });
    });
    return out.sort((a, b) => a.ts - b.ts);
  }

  function calibration(state) {
    const attempts = allAttempts(state);
    if (attempts.length < 3) return { ok: false, n: attempts.length, attempts };
    const errors = attempts.map((a) => a.predicted - a.actual);
    const over = errors.filter((e) => e >= 1).length;
    const under = errors.filter((e) => e <= -1).length;
    const recent = errors.slice(-5);
    const early = errors.slice(0, Math.min(5, Math.max(1, errors.length - 5)));
    return {
      ok: true,
      n: attempts.length,
      attempts,
      errors,
      meanError: S.mean(errors),
      medianError: S.median(errors),
      over,
      under,
      accurate: attempts.length - over - under,
      overRate: over / attempts.length,
      trend: S.mean(recent) - S.mean(early),
      meanPredicted: S.mean(attempts.map((a) => a.predicted)),
      meanActual: S.mean(attempts.map((a) => a.actual))
    };
  }

  function headline(cal) {
    if (!cal.ok) return null;
    const m = cal.meanError;
    if (cal.overRate >= 0.6 && m >= 1) {
      return {
        tone: "good",
        title: "You are bracing for worse than you get",
        body: "On " + cal.over + " of your last " + cal.n + " attempts the thing was easier than you expected, by " + CAD.fmt.n(m, 1) + " points on average. That gap is the fear talking, and it is the part that shrinks fastest once you start testing it."
      };
    }
    if (m <= -1) {
      return {
        tone: "warning",
        title: "You are underestimating these",
        body: "Your attempts have cost " + CAD.fmt.n(Math.abs(m), 1) + " points more than you predicted on average. That usually means the steps are too big, not that you are doing it wrong. Try halving the next one."
      };
    }
    return {
      tone: "good",
      title: "Your predictions are close to reality",
      body: "Average gap between what you expected and what happened is " + CAD.fmt.n(Math.abs(m), 1) + " points. Knowing what something will actually cost you is what lets you plan a week again."
    };
  }

  CAD.screens.ladder = function () {
    const state = CAD.store.get();
    const ladder = ensure(state);
    const cal = calibration(state);
    const head = headline(cal);
    const wrap = h("div", { class: "wrap stack" });

    function save(fn) {
      CAD.store.update((s) => { ensure(s); fn(s.ladder); });
      CAD.render();
    }

    function addItem(title, category) {
      save((l) => {
        l.items.push({ id: CAD.uid(), title, category, createdAt: Date.now(), attempts: [] });
      });
      CAD.toast("Added to your ladder.");
    }

    function predictModal(item) {
      let predicted = 5;
      const out = h("output", { class: "mono", style: { fontWeight: 700, fontSize: "1.3em" } }, "5 / 10");
      CAD.modal({
        title: "Before you try it",
        body: h("div", { class: "stack" },
          h("p", { style: { fontWeight: 600 } }, item.title),
          h("p", { class: "tiny muted" }, "Guess first, then go and do it. Guessing before you find out is the whole point — the gap between the guess and the result is what you are training."),
          h("div", { class: "field" },
            h("div", { class: "row row--between" },
              h("label", { class: "field__label" }, "How bad do you think this will feel?"),
              out),
            h("input", {
              class: "range", type: "range", min: "0", max: "10", value: "5",
              "aria-label": "Predicted difficulty out of 10",
              oninput: (e) => { predicted = Number(e.target.value); out.textContent = predicted + " / 10"; }
            }),
            h("span", { class: "field__hint" }, "0 means no symptoms at all. 10 means the worst it has been."))),
        actions: [
          h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Cancel"),
          h("button", {
            class: "btn btn--primary",
            onclick: () => {
              save((l) => {
                const target = l.items.find((i) => i.id === item.id);
                target.pending = { predicted, startedAt: Date.now() };
              });
              CAD.closeModal();
              CAD.toast("Go and try it. Log the result when you are back.");
            }
          }, "Save my guess and go")
        ]
      });
    }

    function resultModal(item) {
      let actual = item.pending.predicted;
      const out = h("output", { class: "mono", style: { fontWeight: 700, fontSize: "1.3em" } }, actual + " / 10");
      const note = h("input", { class: "input", placeholder: "Anything worth remembering (optional)" });
      CAD.modal({
        title: "How did it actually go?",
        body: h("div", { class: "stack" },
          h("p", { style: { fontWeight: 600 } }, item.title),
          h("div", { class: "callout" },
            h("span", { class: "callout__ico" }, CAD.icon("info")),
            h("div", h("strong", "You guessed " + item.pending.predicted + " out of 10."),
              h("p", { style: { margin: "4px 0 0" } }, "Answer honestly before you look at that number again. Both numbers matter."))),
          h("div", { class: "field" },
            h("div", { class: "row row--between" },
              h("label", { class: "field__label" }, "How bad was it really?"),
              out),
            h("input", {
              class: "range", type: "range", min: "0", max: "10", value: String(actual),
              "aria-label": "Actual difficulty out of 10",
              oninput: (e) => { actual = Number(e.target.value); out.textContent = actual + " / 10"; }
            })),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Note"), note)),
        actions: [
          h("button", {
            class: "btn btn--ghost",
            onclick: () => {
              save((l) => { const t = l.items.find((i) => i.id === item.id); delete t.pending; });
              CAD.closeModal();
              CAD.toast("Attempt cancelled.");
            }
          }, "I did not do it"),
          h("button", {
            class: "btn btn--primary",
            onclick: () => {
              const predicted = item.pending.predicted;
              save((l) => {
                const t = l.items.find((i) => i.id === item.id);
                t.attempts = t.attempts || [];
                t.attempts.push({ ts: Date.now(), predicted, actual, note: note.value.trim() });
                delete t.pending;
              });
              CAD.closeModal();
              const gap = predicted - actual;
              CAD.toast(gap >= 2
                ? "Easier than you expected by " + gap + " points."
                : gap <= -2 ? "Harder than expected. Make the next step smaller."
                  : "Logged. Your guess was close.");
            }
          }, "Log it")
        ]
      });
    }

    function addModal() {
      let category = "screen";
      const title = h("input", { class: "input", placeholder: "Something you have been avoiding" });
      const grid = h("div", { class: "opt-grid" });
      function paint() {
        grid.innerHTML = "";
        CATEGORIES.forEach((c) => {
          grid.appendChild(h("button", {
            class: "opt", type: "button", "aria-pressed": String(category === c.id),
            onclick: () => { category = c.id; paint(); }
          }, h("strong", { style: { display: "block" } }, c.label), h("span", { class: "tiny muted" }, c.examples)));
        });
      }
      paint();
      CAD.modal({
        title: "Add a rung",
        body: h("div", { class: "stack" },
          h("p", { class: "tiny muted" }, "Something specific and small enough that you are about 80% sure you could manage it. Not the scariest thing on your list."),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "What is it?"), title),
          h("div", { class: "field" }, h("span", { class: "field__label" }, "What kind of thing?"), grid)),
        actions: [
          h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Cancel"),
          h("button", {
            class: "btn btn--primary",
            onclick: () => {
              if (!title.value.trim()) { CAD.toast("Give it a name first."); return; }
              addItem(title.value.trim(), category);
              CAD.closeModal();
            }
          }, "Add it")
        ]
      });
    }

    wrap.appendChild(h("div", { class: "page-head" },
      h("p", { class: "eyebrow" }, "Recover"),
      h("h1", "Exposure ladder"),
      h("p", "After a head injury the thing that holds people back longest is often not the injury. It is that a bad flare taught you to avoid something, so you never find out it got easier. This makes you guess the cost before you try, then shows you what it actually cost.")));

    if (head) {
      wrap.appendChild(h("div", { class: "callout callout--" + (head.tone === "good" ? "good" : "warn"), style: { alignItems: "flex-start" } },
        h("span", { class: "callout__ico" }, CAD.icon(head.tone === "good" ? "sparkle" : "info")),
        h("div", h("strong", head.title), h("p", { style: { margin: "6px 0 0" } }, head.body))));
    }

    if (cal.ok) {
      wrap.appendChild(h("section", { class: "card stack" },
        h("div", { class: "card__head" },
          h("div", null,
            h("h2", "Guess against reality"),
            h("p", { class: "card__sub" }, "Each pair is one attempt. When the orange line sits below the blue one, you expected worse than you got."))),
        h("div", { class: "grid grid--4" },
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Attempts"), h("span", { class: "stat__value" }, cal.n)),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Average guess"), h("span", { class: "stat__value" }, CAD.fmt.n(cal.meanPredicted, 1), h("small", " / 10"))),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Average reality"), h("span", { class: "stat__value" }, CAD.fmt.n(cal.meanActual, 1), h("small", " / 10"))),
          h("div", { class: "stat" },
            h("span", { class: "stat__label" }, "Overestimated"),
            h("span", { class: "stat__value" }, cal.over, h("small", " of " + cal.n)),
            h("span", { class: "stat__meta" }, CAD.fmt.pct(cal.overRate) + " of attempts"))),
        CAD.charts.line({
          series: [
            { name: "What you guessed", color: "var(--series-1)", values: cal.attempts.map((a, i) => ({ x: i + 1, y: a.predicted })) },
            { name: "What it cost", color: "var(--series-2)", values: cal.attempts.map((a, i) => ({ x: i + 1, y: a.actual })) }
          ],
          height: 260, yZero: true, yMax: 10,
          formatX: (x) => "#" + Math.round(x), formatY: (y) => String(Math.round(y)),
          ariaLabel: "Predicted versus actual difficulty for each attempt",
          tableHeaders: ["Attempt", "Activity", "Guessed", "Actual", "Gap"],
          tableRows: cal.attempts.map((a, i) => [String(i + 1), a.item, String(a.predicted), String(a.actual), CAD.fmt.signed(a.predicted - a.actual, 0)])
        }),
        h("p", { class: "tiny muted" }, cal.n >= 6
          ? "Your gap has moved by " + CAD.fmt.signed(cal.trend, 1) + " points since your first attempts. A gap that shrinks toward zero means your sense of what things cost is getting accurate, which is exactly what you want."
          : "A few more attempts and this will start showing whether your guesses are getting more accurate.")));
    }

    const items = ladder.items.slice().sort((a, b) => (b.attempts || []).length - (a.attempts || []).length);
    const list = h("div", { class: "stack enter-stagger" });

    items.forEach((item) => {
      const cat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
      const attempts = item.attempts || [];
      const last = attempts[attempts.length - 1];
      const gaps = attempts.filter((a) => isFinite(a.predicted) && isFinite(a.actual)).map((a) => a.predicted - a.actual);
      list.appendChild(h("div", { class: "card stack", style: { gap: "12px" } },
        h("div", { class: "row row--between" },
          h("div", { class: "row", style: { gap: "12px", minWidth: 0 } },
            h("span", { class: "feature__ico", style: Object.assign({ width: "40px", height: "40px", marginBottom: 0 }, tint(cat.tint)) }, CAD.icon("trend", 20)),
            h("div", { style: { minWidth: 0 } },
              h("strong", item.title),
              h("div", { class: "tiny muted" }, cat.label + (attempts.length ? " · " + CAD.fmt.plural(attempts.length, "attempt") : " · not tried yet")))),
          attempts.length ? h("span", { class: "chip" }, "last cost " + last.actual + "/10") : null),
        gaps.length >= 2 ? h("div", { class: "row", style: { gap: "10px" } },
          CAD.charts.spark(attempts.map((a) => a.actual), { color: "var(--series-2)" }),
          h("span", { class: "tiny muted" }, "average gap " + CAD.fmt.signed(S.mean(gaps), 1) + " points")) : null,
        last && last.note ? h("p", { class: "tiny muted", style: { margin: 0 } }, "“" + last.note + "”") : null,
        h("div", { class: "row" },
          item.pending
            ? h("button", { class: "btn btn--primary btn--sm", onclick: () => resultModal(item) }, CAD.icon("check"), "Log how it went")
            : h("button", { class: "btn btn--primary btn--sm", onclick: () => predictModal(item) }, CAD.icon("play"), "Try this"),
          item.pending ? h("span", { class: "chip chip--accent" }, "guessed " + item.pending.predicted + "/10") : null,
          h("button", {
            class: "btn btn--ghost btn--sm",
            onclick: () => save((l) => { l.items = l.items.filter((i) => i.id !== item.id); })
          }, "Remove"))));
    });

    wrap.appendChild(h("section", { class: "stack" },
      h("div", { class: "row row--between" },
        h("h2", "Your ladder"),
        h("button", { class: "btn btn--primary btn--sm", onclick: addModal }, CAD.icon("plus"), "Add a rung")),
      items.length ? list : h("div", { class: "card stack" },
        h("p", { style: { margin: 0 } }, "Nothing on your ladder yet. Start with something small enough that you are fairly sure you could do it today."),
        h("div", { class: "grid grid--3" }, STARTERS.map((s) =>
          h("button", { class: "tile", onclick: () => addItem(s.title, s.category) },
            h("span", { class: "tile__ico", style: tint((CATEGORIES.find((c) => c.id === s.category) || {}).tint || "accent") }, CAD.icon("plus")),
            h("span", { class: "tile__body" }, h("strong", s.title), h("span", (CATEGORIES.find((c) => c.id === s.category) || {}).label))))))));

    wrap.appendChild(h("div", { class: "card stack" },
      h("h3", "Why guessing first matters"),
      h("p", { class: "card__sub", style: { marginTop: "6px" } }, "Avoiding something because it hurt once is sensible for a day and harmful for a month. The fear stops updating, because you never collect new evidence. Writing the prediction down before you go turns each attempt into evidence you cannot argue with afterwards, and the gap between guess and reality is the thing that actually shifts."),
      h("p", { class: "tiny muted", style: { margin: 0 } }, "This is a self tracking tool built on the idea behind graded exposure. It is not therapy, and if avoidance is taking over your life a clinical psychologist will get you further than an app will."),
      CAD.refs.cite("iverson")));

    return wrap;
  };

  CAD.screens.ladder.CATEGORIES = CATEGORIES;
})();
