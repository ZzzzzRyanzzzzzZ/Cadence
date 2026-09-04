(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  function slider(opts) {
    const out = h("output", { class: "mono", style: { minWidth: "76px", textAlign: "right", color: "var(--ink-2)" } }, opts.format(opts.value));
    const input = h("input", {
      class: "range", type: "range", min: String(opts.min), max: String(opts.max), step: String(opts.step || 1),
      value: String(opts.value), "aria-label": opts.label,
      oninput: (e) => { const v = Number(e.target.value); out.textContent = opts.format(v); opts.onChange(v); }
    });
    return h("div", { class: "field" },
      h("div", { class: "row row--between" },
        h("label", { class: "field__label" }, opts.label),
        out),
      input,
      opts.hint ? h("span", { class: "field__hint" }, opts.hint) : null);
  }

  CAD.screens.checkin = function () {
    const state = CAD.store.get();
    const dayKey = CAD.store.todayKey();
    const existing = CAD.store.checkinFor(dayKey);
    const yesterday = state.checkins.filter((c) => c.day !== dayKey).slice(-1)[0] || null;

    const values = {};
    CAD.pcss.SYMPTOMS.forEach((s) => { values[s.id] = existing ? (existing.pcss[s.id] || 0) : 0; });
    const ctx = {
      sleepHours: existing ? existing.sleepHours : (yesterday ? yesterday.sleepHours : 8),
      screenMinutes: existing ? existing.screenMinutes : 90,
      exerciseMinutes: existing ? existing.exerciseMinutes : 0,
      cognitiveMinutes: existing ? existing.cognitiveMinutes : 0,
      stress: existing ? existing.stress : 4,
      exacerbation: existing ? existing.exacerbation : 0,
      notes: existing ? existing.notes : ""
    };

    const tolToday = CAD.tolerance.todayStats();
    if (tolToday && tolToday.windows >= 4) ctx.screenStrain = Math.round(tolToday.mean);
    else if (existing && isFinite(existing.screenStrain)) ctx.screenStrain = existing.screenStrain;

    const totalEl = h("b", { class: "mono" }, "0");
    const countEl = h("span", { class: "muted tiny" }, "0 of 22 symptoms");
    const bandEl = h("span", { class: "chip" }, "—");
    const meterEl = h("div", { class: "meter__fill", style: { width: "0%" } });

    function refresh() {
      const s = CAD.pcss.scorePcss(values);
      const band = CAD.pcss.severityBand(s.total);
      totalEl.textContent = String(s.total);
      countEl.textContent = s.count + " of 22 symptoms";
      bandEl.className = "chip chip--" + band.tone;
      bandEl.textContent = band.label;
      meterEl.style.width = CAD.clamp(s.total / 132, 0, 1) * 100 + "%";
      meterEl.className = "meter__fill meter__fill--" + band.tone;
    }

    function symptomRow(sym) {
      const valEl = h("span", { class: "symptom__val" }, CAD.pcss.SEVERITY[values[sym.id]] + " · " + values[sym.id]);
      const buttons = [];
      const row = h("div", { class: "symptom" },
        h("div", { class: "symptom__head" },
          h("span", { class: "symptom__name", id: "lbl-" + sym.id }, sym.label),
          valEl),
        h("div", { class: "scale", role: "group", "aria-labelledby": "lbl-" + sym.id },
          [0, 1, 2, 3, 4, 5, 6].map((n) => {
            const b = h("button", {
              class: "scale__btn", type: "button", "aria-pressed": String(values[sym.id] === n),
              "aria-label": sym.label + " " + n + " out of 6, " + CAD.pcss.SEVERITY[n],
              dataset: { sev: n === 0 ? "none" : "on" },
              onclick: () => {
                values[sym.id] = n;
                buttons.forEach((bb, i) => bb.setAttribute("aria-pressed", String(i === n)));
                valEl.textContent = CAD.pcss.SEVERITY[n] + " · " + n;
                refresh();
              }
            }, String(n));
            buttons.push(b);
            return b;
          })));
      return row;
    }

    const clusterOrder = ["somatic", "cognitive", "sleep", "emotional"];
    const symptomSection = h("div", { class: "card" },
      h("div", { class: "card__head" },
        h("div", null,
          h("h2", "Symptom scale"),
          h("p", { class: "card__sub" }, "Rate each symptom right now: 0 is none, 6 is severe. The 22-item Post-Concussion Symptom Scale used in the SCAT.")),
        CAD.speech.readButton("Rate each symptom from 0 for none to 6 for severe, based on how you feel right now.")),
      clusterOrder.map((ck) => h("div", null,
        h("p", { class: "cluster-head" }, CAD.pcss.CLUSTERS[ck].full),
        CAD.pcss.SYMPTOMS.filter((s) => s.cluster === ck).map(symptomRow))));

    const contextSection = h("div", { class: "card stack" },
      h("div", null,
        h("h2", "Today's inputs"),
        h("p", { class: "card__sub" }, "These are what the trigger finder correlates against your symptoms. They matter as much as the symptom scores.")),
      slider({ label: "Sleep last night", value: ctx.sleepHours, min: 0, max: 14, step: 0.5, format: (v) => v + " h", onChange: (v) => { ctx.sleepHours = v; } }),
      slider({ label: "Screen time today", value: ctx.screenMinutes, min: 0, max: 600, step: 10, format: (v) => v + " min", onChange: (v) => { ctx.screenMinutes = v; } }),
      slider({ label: "Study or work", value: ctx.cognitiveMinutes, min: 0, max: 600, step: 10, format: (v) => v + " min", onChange: (v) => { ctx.cognitiveMinutes = v; } }),
      slider({ label: "Light exercise", value: ctx.exerciseMinutes, min: 0, max: 240, step: 5, format: (v) => v + " min", onChange: (v) => { ctx.exerciseMinutes = v; } }),
      slider({ label: "Stress", value: ctx.stress, min: 0, max: 10, step: 1, format: (v) => v + " / 10", onChange: (v) => { ctx.stress = v; } }),
      slider({
        label: "How much did activity push symptoms up?", value: ctx.exacerbation, min: 0, max: 10, step: 1,
        hint: "The consensus rule: an increase of up to 2 points is acceptable. More than that means the step was too big.",
        format: (v) => v + " / 10", onChange: (v) => { ctx.exacerbation = v; }
      }),
      h("div", { class: "field" },
        h("label", { class: "field__label", for: "ciNotes" }, "Anything worth remembering"),
        h("textarea", { class: "textarea", id: "ciNotes", value: ctx.notes, placeholder: "What you did, what set things off, what helped…", oninput: (e) => { ctx.notes = e.target.value; } })));

    const summary = h("div", { class: "card sticky-card" },
      h("div", { class: "row row--between", style: { marginBottom: "10px" } },
        h("div", null,
          h("p", { class: "eyebrow" }, "Live score"),
          h("div", { class: "hero-figure" }, totalEl, h("span", { class: "muted", style: { fontSize: "0.3em", fontWeight: 500 } }, " / 132")),
          countEl),
        bandEl),
      h("div", { class: "meter" }, meterEl),
      h("div", { class: "row", style: { marginTop: "18px" } },
        h("button", { class: "btn btn--primary btn--block", onclick: save }, CAD.icon("check"), existing ? "Update check-in" : "Save check-in")),
      yesterday && !existing ? h("button", {
        class: "btn btn--ghost btn--block", style: { marginTop: "8px" },
        onclick: () => {
          CAD.pcss.SYMPTOMS.forEach((s) => { values[s.id] = yesterday.pcss[s.id] || 0; });
          CAD.render();
          CAD.toast("Copied yesterday's ratings — adjust what changed.");
        }
      }, CAD.icon("refresh"), "Start from yesterday") : null,
      h("p", { class: "tiny muted", style: { marginTop: "14px" } },
        "Saved on this device only. ", h("a", { href: "#/settings" }, "Export or erase"), "."));

    function save() {
      const scored = CAD.pcss.scorePcss(values);
      CAD.store.saveCheckin(Object.assign({
        day: dayKey,
        pcss: values,
        total: scored.total,
        count: scored.count,
        clusters: scored.clusters,
        counts: scored.counts
      }, ctx));
      CAD.toast("Check-in saved. " + scored.total + " / 132.");
      if (ctx.exacerbation > CAD.protocol.EXACERBATION_LIMIT) {
        CAD.modal({
          title: "That is more than a mild exacerbation",
          body: h("div", { class: "stack" },
            h("p", "You logged a symptom increase of " + ctx.exacerbation + " out of 10 from activity. The graded strategy treats an increase above 2 points as a signal that the step was too big."),
            h("p", { class: "muted tiny" }, "Recommended: hold at your current step, or drop back one step for 24 hours until symptoms settle, then try again.")),
          actions: [
            h("button", { class: "btn btn--ghost", onclick: () => { CAD.closeModal(); location.hash = "#/today"; CAD.render(); } }, "Hold at this step"),
            h("button", {
              class: "btn btn--primary",
              onclick: () => {
                CAD.store.update((s) => { CAD.protocol.regress(s, "Symptom exacerbation " + ctx.exacerbation + "/10 logged on " + dayKey); });
                CAD.closeModal();
                CAD.toast("Stepped back one level for 24 hours.");
                location.hash = "#/plan";
                CAD.render();
              }
            }, "Step back one level")
          ]
        });
      } else {
        location.hash = "#/today";
        CAD.render();
      }
    }

    refresh();

    return h("div", { class: "wrap stack" },
      h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, CAD.fmt.longDate(new Date())),
        h("h1", "Symptom check-in"),
        h("p", "One a day is enough. Rate how you feel right now, not how the whole day went.")),
      h("div", { class: "callout callout--danger" },
        h("span", { class: "callout__ico" }, CAD.icon("alert")),
        h("div", h("strong", "Worsening headache, repeated vomiting, seizure, weakness, slurred speech or unequal pupils?"),
          h("p", { style: { margin: "4px 0 0" } }, "Stop and seek emergency care. ",
            h("a", { href: "#", onclick: (e) => { e.preventDefault(); CAD.showRedFlags(); } }, "Open the red-flag check")))),
      h("div", { class: "split" },
        h("div", { class: "stack" }, symptomSection, contextSection),
        summary));
  };
})();
