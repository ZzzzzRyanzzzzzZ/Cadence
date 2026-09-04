(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  const ACCOMMODATIONS = [
    "Shorter school or work day, with a scheduled rest block",
    "Extended deadlines instead of catch-up piles",
    "No high-stakes tests during the first symptomatic week",
    "Printed material or reduced screen brightness instead of long screen work",
    "Permission to leave a noisy room early — hallways and cafeterias are the usual triggers",
    "Sunglasses or a cap indoors for light sensitivity",
    "A written plan shared with every teacher or manager, not just one"
  ];

  CAD.screens.plan = function () {
    const state = CAD.store.get();
    const r = CAD.protocol.readiness(state);
    const track = r.track;
    const stage = r.stage;

    function switchTrack(next) {
      CAD.store.update((s) => {
        s.protocol.track = next;
        s.protocol.stage = 1;
        s.protocol.stageStartedAt = Date.now();
        s.protocol.history.push({ ts: Date.now(), stage: 1, event: "switched to " + next, track: next });
      });
      CAD.render();
    }

    function advance() {
      CAD.modal({
        title: "Move to step " + (stage.n + 1) + "?",
        body: h("div", { class: "stack" },
          h("p", track.stages[stage.n] ? track.stages[stage.n].title : ""),
          h("p", { class: "tiny muted" }, "The rule for every step: mild and brief symptom increase — up to 2 points on a 10-point scale — is acceptable. Anything more means you drop back for 24 hours.")),
        actions: [
          h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Not yet"),
          h("button", {
            class: "btn btn--primary", onclick: () => {
              CAD.store.update((s) => CAD.protocol.advance(s));
              CAD.closeModal();
              CAD.toast("Moved to step " + (stage.n + 1) + ".");
              CAD.render();
            }
          }, "Move up a step")
        ]
      });
    }

    function stepBack() {
      CAD.store.update((s) => CAD.protocol.regress(s, "Manual step back"));
      CAD.toast("Stepped back. Give it 24 symptom-stable hours.");
      CAD.render();
    }

    const hrThreshold = state.protocol.hrThreshold || null;
    const hrInput = h("input", { class: "input", type: "number", min: "60", max: "220", placeholder: "e.g. 145", value: hrThreshold || "", style: { maxWidth: "160px" } });

    const ladder = h("div", { class: "ladder" }, track.stages.map((st) =>
      h("div", { class: "ladder__step", dataset: { state: st.n < stage.n ? "done" : st.n === stage.n ? "current" : "todo" } },
        h("div", { class: "ladder__num" }, st.n < stage.n ? CAD.icon("check", 18) : String(st.n)),
        h("div", { class: "ladder__body" },
          h("strong", st.title),
          h("p", st.detail),
          h("p", { class: "tiny muted", style: { marginTop: "4px" } }, "Goal: " + st.goal),
          st.requiresClearance ? h("span", { class: "chip chip--warning", style: { marginTop: "8px" } }, CAD.icon("lock", 14), "Needs medical clearance") : null))));

    const history = state.protocol.history.slice().reverse().slice(0, 8);

    return h("div", { class: "wrap stack" },
      h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "Recover"),
        h("h1", "Graded return to activity"),
        h("p", "The strategy from the 2023 Amsterdam consensus statement: a minimum of 24 hours at each step, progress only while symptoms stay within a mild and brief increase, and drop back a step when they do not.")),

      h("div", { class: "row" },
        h("div", { class: "seg", role: "group", "aria-label": "Which return are you working on" },
          Object.keys(CAD.protocol.TRACKS).map((k) =>
            h("button", {
              class: "seg__btn", type: "button", "aria-pressed": String(state.protocol.track === k),
              onclick: () => { if (state.protocol.track !== k) switchTrack(k); }
            }, CAD.protocol.TRACKS[k].label)))),

      h("div", { class: "split" },
        h("div", { class: "stack" },
          h("div", { class: "card stack" },
            h("div", { class: "row row--between" },
              h("div", null,
                h("p", { class: "eyebrow" }, "Step " + stage.n + " of " + track.stages.length),
                h("h2", stage.title)),
              h("span", { class: "chip chip--" + (r.ready ? "good" : "warning") }, r.ready ? "Ready" : "Hold")),
            h("p", { class: "card__sub" }, stage.detail),
            h("div", { class: "list" }, r.reasons.map((reason) =>
              h("div", { class: "list__item" },
                h("span", { class: "dot dot--" + (reason.ok ? "good" : "warning") }),
                h("div", null,
                  h("div", null, reason.text),
                  reason.detail ? h("div", { class: "tiny muted" }, reason.detail) : null)))),
            h("div", { class: "row" },
              h("button", { class: "btn btn--primary", disabled: !r.ready, onclick: advance }, CAD.icon("arrow"), "Move up a step"),
              h("button", { class: "btn btn--ghost", onclick: stepBack }, "Step back"),
              h("a", { class: "btn btn--ghost", href: "#/checkin" }, "Log today first"))),

          h("div", { class: "card stack" },
            h("h2", "The full strategy"),
            ladder),

          state.protocol.track === "sport" ? h("div", { class: "card stack" },
            h("h2", "Sub-symptom-threshold aerobic exercise"),
            h("p", { class: "card__sub" }, "Early, carefully dosed aerobic exercise below the heart rate that provokes symptoms speeds recovery compared with rest. If a clinician has given you a symptom-threshold heart rate from a treadmill or bike test, enter it and Cadence will hold your target zone at 80–90% of it."),
            h("div", { class: "field" },
              h("label", { class: "field__label" }, "Symptom-threshold heart rate (bpm)"),
              h("div", { class: "row" }, hrInput,
                h("button", {
                  class: "btn btn--ghost", onclick: () => {
                    const v = Number(hrInput.value);
                    CAD.store.update((s) => { s.protocol.hrThreshold = isFinite(v) && v > 40 ? v : null; });
                    CAD.render();
                  }
                }, "Save"))),
            hrThreshold ? h("div", { class: "grid grid--3" },
              h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Target zone"), h("span", { class: "stat__value" }, Math.round(hrThreshold * 0.8) + "–" + Math.round(hrThreshold * 0.9), h("small", " bpm"))),
              h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Session length"), h("span", { class: "stat__value" }, "20", h("small", " min"))),
              h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Stop if symptoms rise"), h("span", { class: "stat__value" }, "+3", h("small", " / 10")))) : null,
            CAD.refs.cite("leddy")) : null,

          state.protocol.track === "learn" ? h("div", { class: "card stack" },
            h("h2", "Accommodations worth asking for"),
            h("p", { class: "card__sub" }, "Return to learn fails more often on logistics than on symptoms. Print this list into the clinician report and hand it to whoever writes your plan."),
            h("ul", { style: { margin: 0, paddingLeft: "20px", color: "var(--ink-2)" } }, ACCOMMODATIONS.map((a) => h("li", { style: { marginBottom: "6px" } }, a)))) : null),

        h("div", { class: "stack" },
          h("div", { class: "card sticky-card stack" },
            h("h3", "Time at this step"),
            h("div", { class: "hero-figure" }, Math.floor(r.hoursInStage), h("span", { style: { fontSize: "0.3em", fontWeight: 500 } }, " h")),
            h("div", { class: "meter" }, h("div", { class: "meter__fill", style: { width: CAD.clamp(r.hoursInStage / 24, 0, 1) * 100 + "%" } })),
            h("p", { class: "tiny muted" }, "Minimum 24 hours per step. There is no maximum — steps take as long as they take."),
            h("hr", { class: "divider", style: { margin: "6px 0" } }),
            h("h3", "Recent moves"),
            history.length ? h("div", { class: "list" }, history.map((ev) =>
              h("div", { class: "list__item" },
                h("span", { class: "dot dot--" + (ev.event === "advanced" ? "good" : ev.event === "stepped back" ? "warning" : "") }),
                h("div", { style: { minWidth: 0 } },
                  h("div", { class: "tiny" }, "Step " + ev.stage + " · " + ev.event),
                  h("div", { class: "tiny muted" }, CAD.fmt.shortDate(ev.ts) + (ev.reason ? " · " + ev.reason : "")))))) : h("p", { class: "tiny muted" }, "No moves recorded yet."))))
    );
  };
})();
