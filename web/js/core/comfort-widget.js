(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  const s = CAD.svgEl;

  let root = null;
  let panel = null;
  let open = false;
  let unsub = null;

  const TONE = { ok: "var(--good)", soft: "var(--warning)", rest: "var(--serious)" };

  function gauge(strain) {
    const svg = s("svg", { class: "comfort__gauge", viewBox: "0 0 26 26", "aria-hidden": "true" });
    const r = 10.5;
    const c = 2 * Math.PI * r;
    const frac = CAD.clamp((strain === null ? 0 : strain) / 100, 0, 1);
    svg.appendChild(s("circle", { cx: 13, cy: 13, r, "stroke-width": 3.5, stroke: "var(--surface-3)" }));
    const bar = s("circle", {
      cx: 13, cy: 13, r, "stroke-width": 3.5,
      stroke: TONE[CAD.tolerance.levelFor(strain || 0).id],
      "stroke-dasharray": c, "stroke-dashoffset": c * (1 - frac),
      transform: "rotate(-90 13 13)"
    });
    svg.appendChild(bar);
    return svg;
  }

  function signalRows(snap) {
    return CAD.tolerance.SIGNALS.map((sig) => {
      const z = snap.zs[sig.id] || 0;
      const pct = CAD.clamp((z + 2) / 6, 0, 1) * 100;
      return h("div", { class: "comfort__sig" },
        h("div", null,
          h("div", null, sig.label),
          h("div", { class: "comfort__track" },
            h("i", { style: { width: pct + "%", background: z > 1.2 ? "var(--serious)" : z > 0.5 ? "var(--warning)" : "var(--good)" } }))),
        h("b", { class: "mono", style: { textAlign: "right", fontSize: "0.92em" } }, CAD.fmt.signed(z, 1)));
    });
  }

  function renderPanel(snap) {
    if (!panel) return;
    panel.innerHTML = "";
    const level = CAD.tolerance.levelFor(snap.strain || 0);
    const store = CAD.tolerance.ensureState();

    panel.appendChild(h("div", { class: "row row--between", style: { marginBottom: "8px" } },
      h("h3", "Screen tolerance"),
      h("span", { class: "chip chip--" + level.tone }, level.label)));

    if (snap.calibrating) {
      panel.appendChild(h("p", { class: "tiny muted" },
        "Still learning your normal. Cadence needs a few minutes of ordinary use before the number means anything — until then it sits near the middle and changes nothing."));
    } else {
      panel.appendChild(h("p", { class: "tiny muted" },
        "Strain " + Math.round(snap.strain) + " out of 100, against your own baseline. " +
        (snap.level === "ok"
          ? "Nothing has been changed."
          : snap.level === "soft"
            ? "Text is slightly larger, motion is off and the background has been flattened."
            : "Text is larger, all decoration is off. This is the point where most people should stop for ten minutes.")));
    }

    panel.appendChild(h("div", { style: { margin: "10px 0" } }, signalRows(snap)));

    panel.appendChild(h("p", { class: "tiny muted" },
      Math.round(snap.sessionMinutes) + " min in this session. Bars show how far each signal is from your own median, in robust z units."));

    panel.appendChild(h("div", { class: "row", style: { marginTop: "12px" } },
      h("button", {
        class: "btn btn--primary btn--sm",
        onclick: () => { CAD.tolerance.resetSession(); CAD.toast("Break logged — session timer reset."); }
      }, CAD.icon("check"), "I took a break"),
      h("button", {
        class: "btn btn--ghost btn--sm",
        onclick: () => { CAD.tolerance.overrideFor(20); CAD.toast("Adaptation paused for 20 minutes."); renderPanel(CAD.tolerance.snapshot()); }
      }, "Pause changes"),
      h("a", { class: "btn btn--ghost btn--sm", href: "#/settings" }, "Settings")));

    panel.appendChild(h("p", { class: "tiny muted", style: { marginTop: "10px" } },
      "Measured from cursor, scroll, keyboard and tab events on this page only. Never the content you type, never the camera, never sent anywhere."));

    if (!store.acknowledged) {
      store.acknowledged = true;
      CAD.store.save();
    }
  }

  function update(snap) {
    if (!root) return;
    const level = CAD.tolerance.levelFor(snap.strain || 0);
    const pill = root.querySelector(".comfort__pill");
    if (!pill) return;
    pill.innerHTML = "";
    pill.appendChild(gauge(snap.strain));
    pill.appendChild(h("span", { class: "comfort__label" },
      snap.calibrating ? "Calibrating" : level.label));
    pill.setAttribute("aria-label", "Screen tolerance: " + (snap.calibrating ? "calibrating" : level.label + ", strain " + Math.round(snap.strain) + " of 100") + ". Open details.");
    if (open) renderPanel(snap);
  }

  function mount() {
    const store = CAD.tolerance.ensureState();
    if (!store.enabled) { unmount(); return; }
    if (root) return;

    panel = h("div", { class: "comfort__panel", hidden: true, role: "dialog", "aria-label": "Screen tolerance details" });
    const pill = h("button", { class: "comfort__pill", type: "button", "aria-expanded": "false" });
    pill.addEventListener("click", () => {
      open = !open;
      panel.hidden = !open;
      pill.setAttribute("aria-expanded", String(open));
      if (open) renderPanel(CAD.tolerance.snapshot());
    });

    root = h("div", { class: "comfort" }, panel, pill);
    document.body.appendChild(root);
    update(CAD.tolerance.snapshot());
    unsub = CAD.tolerance.subscribe(update);
  }

  function unmount() {
    if (unsub) { unsub(); unsub = null; }
    if (root) { root.remove(); root = null; }
    panel = null;
    open = false;
  }

  CAD.comfortWidget = { mount, unmount, update };
})();
