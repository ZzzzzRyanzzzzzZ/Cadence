(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  const PRINCIPLES = [
    ["It refuses to guess", "Every model states a minimum amount of data and stays silent below it. The recovery curve needs four check-ins, off-trend detection needs six, the trigger finder needs eight day pairs per association."],
    ["It shows uncertainty", "Intervals, not point estimates. The recovery projection carries a bootstrap band; cognitive change carries a reliable-change threshold; associations carry a permutation p-value."],
    ["It shows its inputs", "The risk panel displays every feature's contribution, and marks which factors are fixed and which you can act on. Nothing is hidden inside a score."],
    ["It never diagnoses or clears", "No output says whether you have a concussion, whether you are recovered, or whether you can play. Those are clinical decisions made by people."],
    ["It stays on your device", "Analysis runs in your browser. Health data is uploaded only if you switch on backup, and then only as ciphertext encrypted with a passphrase the server never sees."],
    ["It names the gap", "Where Cadence adapts a clinical instrument, the difference from the published version is stated on the same screen as the score."]
  ];

  const MODELS = [
    ["Recovery trajectory", "Damped Gauss–Newton fit of S(t) = C + A·exp(−t/τ) with a 240-sample residual bootstrap for the 80% band.", "ledoux"],
    ["Reliable Change Index", "Difference from baseline divided by the standard error of difference; within-person variability replaces published constants once you have five sessions on a task.", "jacobson"],
    ["Risk panel", "The 5P predictor set, integer-weighted and passed through a logistic link, with per-feature attributions.", "zemek"],
    ["Off-trend detection", "Per-feature EWMA forecasting with MAD-robust z-scoring, plus a shrinkage-covariance Mahalanobis distance on the joint vector.", null],
    ["Trigger finder", "Spearman correlations at 0- and 1-day lags, permutation-tested and corrected for false discovery at 10%.", "bh"],
    ["Symptom clusters", "Four-factor grouping of the 22-item scale into physical, cognitive, sleep-fatigue and emotional.", "kontos"]
  ];

  CAD.screens.science = function () {
    return h("div", { class: "wrap stack" },
      h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "App"),
        h("h1", "How this works"),
        h("p", "Cadence is built on published instruments and published methods. This page lists all of them, what each one is used for here, and where this version differs from the original.")),

      h("div", { class: "card stack" },
        h("h2", "The rules these models follow"),
        h("div", { class: "grid grid--2" }, PRINCIPLES.map((p) =>
          h("div", { class: "insight" },
            h("div", { class: "insight__ico", style: { background: "var(--teal-soft)", color: "var(--teal)" } }, CAD.icon("shield", 18)),
            h("div", null, h("strong", p[0]), h("p", p[1])))))),

      h("div", { class: "card stack" },
        h("h2", "The models"),
        h("div", { class: "table-wrap" },
          h("table", null,
            h("thead", h("tr", ["Model", "Method", "Source"].map((t) => h("th", t)))),
            h("tbody", MODELS.map((m) => h("tr", [
              h("td", { style: { whiteSpace: "normal", fontWeight: 600 } }, m[0]),
              h("td", { style: { whiteSpace: "normal" } }, m[1]),
              h("td", m[2] ? CAD.refs.cite(m[2]) : h("span", { class: "muted" }, "standard method"))
            ]))))),
        h("p", { class: "tiny muted" }, "Each model also carries a model card inside the Insights page, listing its estimator, its data gate, and its known failure mode.")),

      h("div", { class: "card stack" },
        h("h2", "What Cadence is not"),
        h("div", { class: "callout callout--warn" },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", null,
            h("strong", "Not a diagnostic tool, not a clearance tool, not a medical device."),
            h("p", { style: { margin: "6px 0 0" } }, "The tests here are self-administered on consumer hardware, unsupervised, with no normative population behind them. They track you against yourself and nothing else. A clinician's assessment is not replaceable by an app, and no score on this screen should delay getting one."))),
        h("div", { class: "callout callout--danger" },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", null,
            h("strong", "Red flags always override everything in this app."),
            h("p", { style: { margin: "6px 0 0" } }, "Worsening headache, repeated vomiting, seizure, weakness or numbness, slurred speech, unequal pupils, increasing confusion, or not being able to wake someone: emergency care, immediately.")))),

      h("div", { class: "card stack" },
        h("h2", "Sources"),
        h("p", { class: "card__sub" }, "Every instrument, threshold and method used in Cadence, with what it is used for. Titles link to PubMed."),
        h("div", { class: "ref-list" }, CAD.refs.REFS.map((r) =>
          h("div", { class: "ref" },
            h("strong", h("a", { href: CAD.refs.url(r), target: "_blank", rel: "noopener noreferrer" }, r.title)),
            h("span", r.authors + " · " + r.source + " · " + r.year),
            h("p", { style: { margin: "6px 0 0", color: "var(--ink-2)" } }, r.used))))),

      h("div", { class: "card stack" },
        h("h2", "Accessibility choices"),
        h("div", { class: "list" }, [
          ["Reduced motion by default", "Motion sensitivity is one of the most common post-concussive symptoms. Animation is off unless you turn it on, and the one task that requires motion warns you first."],
          ["A dim, low-blue theme", "Photophobia makes bright interfaces unusable. Both themes avoid pure white and pure black."],
          ["Read-aloud on every instruction", "Reading provokes symptoms for many people. Instructions can be spoken by your device instead."],
          ["Rest reminders", "Cadence prompts you to look away after a set time in the app, because a recovery app that keeps you on a screen is working against you."],
          ["Every chart has a table", "Colour is never the only channel. Series are directly labelled and each chart can be read as numbers."],
          ["Keyboard and screen reader support", "Every control is reachable by keyboard, with visible focus and labelled groups."]
        ].map((row) => h("div", { class: "list__item" },
          h("span", { class: "tile__ico" }, CAD.icon("check")),
          h("div", null, h("strong", row[0]), h("div", { class: "tiny muted" }, row[1])))))));
  };
})();
