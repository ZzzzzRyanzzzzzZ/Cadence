(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  const S = CAD.stats;
  CAD.screens = CAD.screens || {};

  const STANCES = [
    { id: "double", name: "Double-leg stance", detail: "Feet together, hands on hips, eyes closed." },
    { id: "single", name: "Single-leg stance", detail: "Stand on your non-dominant leg, other knee bent to about 30 degrees, hands on hips, eyes closed." },
    { id: "tandem", name: "Tandem stance", detail: "Heel-to-toe, non-dominant foot behind, hands on hips, eyes closed." }
  ];

  const ERRORS = [
    "Hands lifted off the hips",
    "Opening the eyes",
    "A step, stumble or fall",
    "Hip moved more than 30 degrees",
    "Lifting the forefoot or heel",
    "Out of position for more than 5 seconds"
  ];

  let timerHandle = null;
  let motionHandler = null;

  CAD.screens.balance = function () {
    const state = CAD.store.get();
    const runs = state.balanceRuns;
    const last = runs[runs.length - 1];
    const wrap = h("div", { class: "wrap stack" });

    let mode = "intro";
    let stanceIndex = 0;
    const result = { double: 0, single: 0, tandem: 0, sway: {} };
    let savedRun = null;

    function render() {
      wrap.innerHTML = "";
      wrap.appendChild(h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "Assess"),
        h("h1", "Balance — modified BESS"),
        h("p", "Three twenty-second stances with your eyes closed. You count balance errors; if your device has motion sensors, Cadence also measures postural sway directly.")));
      if (mode === "intro") wrap.appendChild(intro());
      else if (mode === "stance") wrap.appendChild(stanceStep());
      else wrap.appendChild(summary());
      window.scrollTo({ top: 0 });
    }

    function intro() {
      return h("div", { class: "stack" },
        h("div", { class: "callout callout--warn" },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", h("strong", "Set up so a fall cannot hurt you."),
            h("p", { style: { margin: "4px 0 0" } }, "Stand on a firm, flat surface with a wall or chair within arm's reach, and have someone in the room. Skip this test entirely if you feel unsteady standing, or if you have already fallen since the injury."))),
        h("div", { class: "card stack" },
          h("h2", "The three stances"),
          h("div", { class: "list" }, STANCES.map((st, i) =>
            h("div", { class: "list__item" },
              h("span", { class: "ladder__num" }, String(i + 1)),
              h("div", null, h("strong", st.name), h("div", { class: "tiny muted" }, st.detail))))),
          h("h3", { style: { marginTop: "10px" } }, "What counts as an error"),
          h("ul", { class: "tiny muted", style: { margin: "6px 0 0", paddingLeft: "20px" } }, ERRORS.map((e) => h("li", e))),
          h("p", { class: "tiny muted", style: { marginTop: "10px" } }, "Each stance is capped at 10 errors, so the worst possible total is 30. Ask someone to watch and tap for you if you can — self-counting with your eyes closed is the weak point of this test."),
          h("div", { class: "row" },
            h("button", { class: "btn btn--primary btn--lg", onclick: () => { stanceIndex = 0; mode = "stance"; render(); } }, CAD.icon("play"), "Start the test"))),
        last ? h("div", { class: "card stack" },
          h("h3", "Last test — " + CAD.fmt.shortDate(last.ts)),
          h("div", { class: "grid grid--4" },
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Total errors"), h("span", { class: "stat__value" }, last.total, h("small", " / 30"))),
            STANCES.map((st) => h("div", { class: "stat" }, h("span", { class: "stat__label" }, st.name.split(" ")[0]), h("span", { class: "stat__value" }, last[st.id])))),
          runs.length >= 3 ? CAD.charts.line({
            series: [{ name: "Total errors", color: "var(--series-1)", values: runs.map((r) => ({ x: CAD.derive.dayIndex(state, CAD.fmt.dayKey(r.ts)), y: r.total })) }],
            height: 200, yZero: true, formatX: (x) => "d" + Math.round(x), formatY: (y) => String(Math.round(y)),
            ariaLabel: "Balance errors by day since injury"
          }) : null) : null,
        h("div", { class: "card" },
          h("h3", "About this test"),
          h("p", { class: "card__sub", style: { marginTop: "8px" } }, "The Balance Error Scoring System is quick and free, but it has a practice effect and a fatigue effect, and it is least reliable on the single-leg stance. Treat a change of fewer than three errors as noise. Four or more errors in tandem stance is one of the inputs to the risk panel."),
          CAD.refs.cite("bess")));
    }

    function stanceStep() {
      const st = STANCES[stanceIndex];
      let errors = 0;
      let remaining = 20;
      let running = false;
      const samples = [];

      const countEl = h("div", { class: "hero-figure" }, "0");
      const timeEl = h("b", { class: "mono", style: { fontSize: "1.4em" } }, "20s");
      const errBtn = h("button", { class: "btn btn--lg btn--block", style: { minHeight: "96px", fontSize: "1.1em" }, disabled: true, onclick: () => {
        if (!running) return;
        errors = Math.min(10, errors + 1);
        countEl.textContent = String(errors);
        if (navigator.vibrate) { try { navigator.vibrate(20); } catch (e) {} }
      } }, CAD.icon("plus"), "Count an error");

      const startBtn = h("button", { class: "btn btn--primary btn--lg" }, CAD.icon("play"), "Start 20 seconds");

      function startMotion() {
        if (typeof DeviceMotionEvent === "undefined") return;
        const attach = () => {
          motionHandler = (e) => {
            const a = e.accelerationIncludingGravity || e.acceleration;
            if (!a) return;
            samples.push({ x: a.x || 0, y: a.y || 0, z: a.z || 0 });
          };
          window.addEventListener("devicemotion", motionHandler);
        };
        if (typeof DeviceMotionEvent.requestPermission === "function") {
          DeviceMotionEvent.requestPermission().then((res) => { if (res === "granted") attach(); }).catch(() => {});
        } else attach();
      }

      function stopMotion() {
        if (motionHandler) { window.removeEventListener("devicemotion", motionHandler); motionHandler = null; }
      }

      function swayMetrics() {
        if (samples.length < 40) return null;
        const mag = samples.map((s2) => Math.sqrt(s2.x * s2.x + s2.y * s2.y + s2.z * s2.z));
        const detrended = mag.map((m) => m - S.mean(mag));
        let path = 0;
        for (let i = 1; i < detrended.length; i++) path += Math.abs(detrended[i] - detrended[i - 1]);
        return { rms: Number(S.sd(detrended).toFixed(3)), path: Number(path.toFixed(2)), n: samples.length };
      }

      startBtn.addEventListener("click", () => {
        if (running) return;
        running = true;
        startBtn.disabled = true;
        errBtn.disabled = false;
        startMotion();
        CAD.speech.speak("Close your eyes. Twenty seconds. Starting now.");
        timerHandle = setInterval(() => {
          remaining--;
          timeEl.textContent = remaining + "s";
          if (remaining <= 0) {
            clearInterval(timerHandle);
            timerHandle = null;
            running = false;
            stopMotion();
            const sway = swayMetrics();
            if (sway) result.sway[st.id] = sway;
            result[st.id] = errors;
            CAD.speech.speak("Stop. Open your eyes.");
            stanceIndex++;
            if (stanceIndex >= STANCES.length) mode = "summary";
            render();
          }
        }, 1000);
      });

      return h("div", { class: "stack" },
        h("div", { class: "row row--between" },
          h("span", { class: "chip chip--accent" }, "Stance " + (stanceIndex + 1) + " of 3"),
          h("button", { class: "btn btn--ghost btn--sm", onclick: () => { if (timerHandle) clearInterval(timerHandle); stopMotion(); mode = "intro"; render(); } }, "Stop")),
        h("div", { class: "card stack", style: { textAlign: "center", alignItems: "center" } },
          h("h2", st.name),
          h("p", { class: "card__sub", style: { maxWidth: "48ch" } }, st.detail),
          CAD.speech.supported ? h("button", { class: "btn btn--ghost btn--sm", onclick: () => CAD.speech.speak(st.name + ". " + st.detail + " Twenty seconds.") }, CAD.icon("speaker"), "Read aloud") : null,
          timeEl,
          h("div", null, h("div", { class: "tiny muted" }, "Errors this stance"), countEl),
          startBtn,
          errBtn,
          h("p", { class: "tiny muted" }, "Ten errors is the cap for one stance.")));
    }

    function summary() {
      const total = result.double + result.single + result.tandem;
      if (!savedRun) {
        savedRun = CAD.store.addRun("balanceRuns", {
          double: result.double, single: result.single, tandem: result.tandem,
          total, sway: result.sway, surface: "firm", footwear: "barefoot"
        });
      }
      const prev = runs.length ? runs[runs.length - 1] : null;
      const delta = prev ? total - prev.total : null;
      const swayKeys = Object.keys(result.sway);
      return h("div", { class: "stack" },
        h("div", { class: "card stack" },
          h("div", { class: "row row--between" },
            h("h2", "Balance result"),
            h("span", { class: "chip chip--" + (total <= 5 ? "good" : total <= 12 ? "warning" : "serious") }, total + " of 30 errors")),
          h("div", { class: "grid grid--4" },
            STANCES.map((st) => h("div", { class: "stat" },
              h("span", { class: "stat__label" }, st.name.replace(" stance", "")),
              h("span", { class: "stat__value" }, result[st.id], h("small", " / 10")))),
            h("div", { class: "stat" },
              h("span", { class: "stat__label" }, "Change"),
              h("span", { class: "stat__value" }, delta === null ? "—" : CAD.fmt.signed(delta, 0)),
              h("span", { class: "stat__meta" }, prev ? "vs " + CAD.fmt.shortDate(prev.ts) : "first test"))),
          swayKeys.length ? h("div", { class: "stack stack--s" },
            h("h3", "Measured sway"),
            h("p", { class: "tiny muted" }, "From your device's accelerometer during each stance — an objective companion to the error count."),
            CAD.charts.bars({
              items: swayKeys.map((k) => ({ label: STANCES.find((s2) => s2.id === k).name, value: result.sway[k].rms })),
              format: (v) => CAD.fmt.n(v, 2) + " m/s²"
            })) : h("p", { class: "tiny muted" }, "No motion sensor available on this device, so only the error count was recorded. On a phone, hold or pocket the device to add sway measurement."),
          result.tandem >= 4 ? h("div", { class: "callout callout--warn" },
            h("span", { class: "callout__ico" }, CAD.icon("info")),
            h("div", h("strong", "Four or more tandem-stance errors."),
              h("p", { style: { margin: "4px 0 0" } }, "This is one of the predictors in the risk panel, and it is worth repeating on a day when you are not tired."))) : null,
          h("div", { class: "row" },
            h("a", { class: "btn btn--primary", href: "#/insights" }, "See what changed"),
            h("a", { class: "btn btn--ghost", href: "#/today" }, "Back to today"))));
    }

    render();
    return wrap;
  };

  CAD.screens.balance.leave = function () {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
    if (motionHandler) { window.removeEventListener("devicemotion", motionHandler); motionHandler = null; }
  };
})();
