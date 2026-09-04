(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  const FEATURES = [
    { icon: "checkin", tint: "accent", title: "A 90-second daily check-in", body: "The same 22-item symptom scale clinicians use in the SCAT, scored into four validated clusters so you can see which part of the injury is actually moving." },
    { icon: "cognition", tint: "violet", title: "Six real cognitive tasks", body: "Reaction time, inhibition, Stroop interference, working-memory d′, visual tracking and rapid naming — scored against your own baseline with a Reliable Change Index." },
    { icon: "eye", tint: "teal", title: "Guided oculomotor screen", body: "A seven-item vestibular and ocular-motor screen with on-screen pacing, symptom provocation ratings and a convergence measure." },
    { icon: "plan", tint: "berry", title: "The graded return, enforced", body: "The 2023 Amsterdam consensus strategy as a working engine: 24-hour minimums, the 2-point exacerbation rule, automatic step-backs after a flare." },
    { icon: "insights", tint: "sun", title: "Models that show their work", body: "A bootstrapped recovery curve, off-trend detection, and a trigger finder with permutation tests and false-discovery correction. Each one refuses to answer without enough data." },
    { icon: "report", tint: "accent", title: "One page for your clinician", body: "Everything printable on a single sheet, with the difference between the published instrument and this adaptation stated on the page." }
  ];

  function tintStyle(name) {
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

  function codeInput(onComplete) {
    const boxes = [];
    const wrap = h("div", { class: "code-input" });
    for (let i = 0; i < 6; i++) {
      const box = h("input", {
        class: "code-input__box", type: "text", inputmode: "numeric", autocomplete: i === 0 ? "one-time-code" : "off",
        maxlength: "1", "aria-label": "Digit " + (i + 1) + " of 6"
      });
      box.addEventListener("input", () => {
        const digits = box.value.replace(/\D/g, "");
        box.value = digits.slice(0, 1);
        let next = i;
        for (let k = 1; k < digits.length && i + k < 6; k++) {
          boxes[i + k].value = digits[k];
          next = i + k;
        }
        if (box.value && next < 5) boxes[next + 1].focus();
        const code = boxes.map((b) => b.value).join("");
        if (code.length === 6) onComplete(code);
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && i > 0) boxes[i - 1].focus();
        if (e.key === "ArrowLeft" && i > 0) boxes[i - 1].focus();
        if (e.key === "ArrowRight" && i < 5) boxes[i + 1].focus();
      });
      box.addEventListener("paste", (e) => {
        const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        e.preventDefault();
        text.split("").forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
        boxes[Math.min(text.length, 5)].focus();
        if (text.length === 6) onComplete(text);
      });
      boxes.push(box);
      wrap.appendChild(box);
    }
    wrap.focusFirst = () => setTimeout(() => boxes[0].focus(), 60);
    wrap.clear = () => { boxes.forEach((b) => { b.value = ""; }); boxes[0].focus(); };
    return wrap;
  }

  function startDemo() {
    CAD.seed.load();
    CAD.store.update((s) => {
      s.settings.onboarded = true;
      s.settings.acknowledgedDisclaimer = true;
    });
    CAD.api.setGuest(true);
    location.hash = "#/today";
    CAD.toast("Demo loaded — 28 days of a realistic recovery.");
    CAD.render(true);
  }

  CAD.screens.auth = function () {
    let mode = "landing";
    let email = "";
    let devCode = null;
    let busy = false;
    let error = "";
    let resendAt = 0;
    const root = h("div", { class: "landing" });

    function render() {
      root.innerHTML = "";
      root.appendChild(hero());
      root.appendChild(featureStrip());
      root.appendChild(trustStrip());
      root.appendChild(footer());
      window.scrollTo({ top: 0 });
    }

    function authPanel() {
      if (mode === "code") return codePanel();
      return emailPanel();
    }

    function emailPanel() {
      const input = h("input", {
        class: "input", type: "email", value: email, placeholder: "you@example.com",
        autocomplete: "email", "aria-label": "Email address", id: "authEmail",
        oninput: (e) => { email = e.target.value.trim(); }
      });
      const btn = h("button", { class: "btn btn--primary btn--lg btn--block", disabled: busy },
        busy ? "Sending…" : "Email me a sign-in code");

      async function submit(e) {
        if (e) e.preventDefault();
        if (busy) return;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          error = "That does not look like an email address.";
          return render();
        }
        busy = true; error = ""; render();
        try {
          const res = await CAD.api.requestCode(email);
          devCode = res && res.devCode ? res.devCode : null;
          resendAt = Date.now() + 30000;
          mode = "code";
        } catch (err) {
          error = err.message || "Could not reach the sign-in service.";
        }
        busy = false;
        render();
        if (mode === "code") {
          const cw = document.querySelector(".code-input");
          if (cw && cw.focusFirst) cw.focusFirst();
        }
      }

      btn.addEventListener("click", submit);

      return h("form", { class: "auth-card", onsubmit: submit },
        h("p", { class: "eyebrow" }, "Create your account"),
        h("h2", "Start with your email"),
        h("p", { class: "tiny muted" }, "No password to forget. We send a six-digit code and sign you in — the same way your bank does it."),
        h("div", { class: "field", style: { marginTop: "16px" } },
          h("label", { class: "field__label", for: "authEmail" }, "Email address"),
          input),
        error ? h("p", { class: "auth-error" }, CAD.icon("alert", 16), error) : null,
        btn,
        h("button", {
          type: "button", class: "btn btn--block demo-btn", style: { marginTop: "10px" },
          onclick: startDemo
        }, CAD.icon("sparkle"), "Try the demo — 28 days of data"),
        h("button", {
          type: "button", class: "btn btn--ghost btn--block", style: { marginTop: "8px" },
          onclick: () => {
            CAD.api.setGuest(true);
            CAD.toast("Using Cadence on this device only.");
            CAD.render();
          }
        }, CAD.icon("lock"), "Start empty on this device"),
        h("p", { class: "tiny muted", style: { marginTop: "14px" } },
          "Your account stores your email address and nothing else. Health data stays on your device unless you switch on encrypted backup, which encrypts it with a passphrase we never receive."));
    }

    function codePanel() {
      const status = h("p", { class: "tiny muted" }, "");
      const boxes = codeInput(async (code) => {
        if (busy) return;
        busy = true; error = "";
        status.textContent = "Checking…";
        try {
          await CAD.api.verifyCode(email, code);
          CAD.api.setGuest(false);
          CAD.toast("Signed in as " + email);
          CAD.render();
        } catch (err) {
          busy = false;
          error = err.message || "That code did not work.";
          render();
          const cw = document.querySelector(".code-input");
          if (cw && cw.clear) cw.clear();
        }
      });

      const secondsLeft = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
      const resend = h("button", {
        type: "button", class: "btn btn--ghost btn--sm", disabled: secondsLeft > 0,
        onclick: async () => {
          try {
            const res = await CAD.api.requestCode(email);
            devCode = res && res.devCode ? res.devCode : null;
            resendAt = Date.now() + 30000;
            CAD.toast("New code sent.");
            render();
          } catch (err) { error = err.message; render(); }
        }
      }, secondsLeft > 0 ? "Resend in " + secondsLeft + "s" : "Resend code");

      if (secondsLeft > 0) {
        const iv = setInterval(() => {
          const left = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
          if (left <= 0) { clearInterval(iv); resend.disabled = false; resend.textContent = "Resend code"; }
          else resend.textContent = "Resend in " + left + "s";
        }, 1000);
      }

      const panel = h("div", { class: "auth-card" },
        h("p", { class: "eyebrow" }, "Check your inbox"),
        h("h2", "Enter your six-digit code"),
        h("p", { class: "tiny muted" }, "Sent to " + email + ". It expires in 10 minutes."),
        boxes,
        error ? h("p", { class: "auth-error" }, CAD.icon("alert", 16), error) : null,
        status,
        devCode ? h("div", { class: "callout callout--warn", style: { marginTop: "4px" } },
          h("span", { class: "callout__ico" }, CAD.icon("info")),
          h("div", h("strong", "Demo mode — code: " + devCode),
            h("p", { style: { margin: "4px 0 0" } }, "No mail provider is configured on this server, so the code appears here instead of in your inbox. Set RESEND_API_KEY in the environment and real email is sent."))) : null,
        h("div", { class: "row", style: { marginTop: "12px" } },
          resend,
          h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { mode = "landing"; error = ""; devCode = null; render(); } }, "Use a different email")));
      setTimeout(() => { if (boxes.focusFirst) boxes.focusFirst(); }, 30);
      return panel;
    }

    function offlinePanel() {
      const isStatic = CAD.api.state.staticHost;
      return h("div", { class: "auth-card" },
        h("p", { class: "eyebrow" }, isStatic ? "Private build" : "Offline"),
        h("h2", isStatic ? "Runs entirely in your browser" : "No sign-in service reachable"),
        h("p", { class: "tiny muted" }, location.protocol === "file:"
          ? "You opened Cadence straight from the file system, so accounts and email codes are not available. Run npm start and open http://localhost:3000 for the full site."
          : isStatic
            ? "This build has no server behind it, so there is no account to create and nothing to sign in to. Every check-in, test, model and chart works exactly the same — all of it was always computed on your own device. Nothing you enter here can leave it."
            : "The Cadence server did not respond. You can still use everything locally — accounts only add encrypted backup across devices."),
        h("button", {
          class: "btn btn--primary btn--lg btn--block", style: { marginTop: "16px" },
          onclick: startDemo
        }, CAD.icon("sparkle"), "Try the demo — 28 days of data"),
        h("button", {
          class: "btn btn--ghost btn--block", style: { marginTop: "8px" },
          onclick: () => { CAD.api.setGuest(true); CAD.render(); }
        }, CAD.icon("arrow"), CAD.api.state.staticHost ? "Start empty" : "Continue on this device"));
    }

    function hero() {
      return h("header", { class: "landing__hero" },
        h("div", { class: "landing__nav" },
          h("span", { class: "brand" },
            h("svg", { class: "brand__mark", viewBox: "0 0 40 24", "aria-hidden": "true", html: '<path d="M2 15h5.5l3.5-10 4.5 17 3.5-11 2.4 4H38"/>' }),
            h("span", { class: "brand__word" }, "Cadence")),
          h("span", { class: "spacer" }),
          h("span", { class: "chip chip--good" }, h("i", { class: "dot dot--good" }), "Runs on your device")),
        h("div", { class: "landing__grid" },
          h("div", { class: "stack" },
            h("p", { class: "eyebrow" }, "Concussion recovery, day by day"),
            h("h1", { class: "landing__title" }, "Recovery has a ", h("span", { class: "gradient-text" }, "rhythm"), "."),
            h("p", { class: "landing__lede" },
              "Most people leave the clinic with a leaflet and a vague instruction to rest. Cadence gives you the actual protocol — a daily symptom scale, real cognitive tests, an oculomotor screen, and a graded return plan that holds you back when your own data says it should."),
            h("div", { class: "badge-row" },
              ["22-item symptom scale", "6 cognitive tasks", "7-item oculomotor screen", "Amsterdam 2023 protocol", "16 cited sources"].map((t) => h("span", { class: "chip" }, t)))),
          CAD.api.state.online ? authPanel() : offlinePanel()));
    }

    function featureStrip() {
      return h("section", { class: "landing__section" },
        h("div", { class: "landing__sectionhead" },
          h("h2", "Everything the leaflet left out"),
          h("p", "Six modules, each traceable to a published method — and each one honest about where the published version ends and this adaptation begins.")),
        h("div", { class: "grid grid--3" }, FEATURES.map((f) =>
          h("article", { class: "feature" },
            h("span", { class: "feature__ico", style: tintStyle(f.tint) }, CAD.icon(f.icon, 22)),
            h("h3", f.title),
            h("p", f.body)))));
    }

    function trustStrip() {
      return h("section", { class: "landing__section" },
        h("div", { class: "trust" },
          h("div", { class: "trust__main" },
            h("h2", "Your health data does not leave your device"),
            h("p", "Check-ins, test results and journal entries are stored in your browser. Your account holds an email address and nothing more. If you turn on backup, the file is encrypted in your browser with a passphrase that is never sent to the server — so the server holds ciphertext it cannot read."),
            h("div", { class: "row" },
              h("span", { class: "chip chip--good" }, CAD.icon("lock", 14), "AES-GCM, PBKDF2 250k"),
              h("span", { class: "chip chip--good" }, CAD.icon("shield", 14), "No analytics, no trackers"),
              h("span", { class: "chip chip--good" }, CAD.icon("download", 14), "Export or erase in one tap"))),
          h("div", { class: "trust__stats" },
            [["4", "check-ins before the curve model will speak"],
             ["±1.96", "reliable-change threshold on every cognitive score"],
             ["10%", "false-discovery rate on every association it reports"]].map((s) =>
              h("div", { class: "trust__stat" }, h("b", s[0]), h("span", s[1]))))));
    }

    function footer() {
      return h("footer", { class: "site-footer" },
        h("div", { class: "callout callout--warn" },
          h("span", { class: "callout__ico" }, CAD.icon("alert")),
          h("div", h("strong", "Cadence is not a medical device and cannot diagnose a concussion or clear you to play."),
            h("p", { style: { margin: "4px 0 0" } }, "If you have a worsening headache, repeated vomiting, a seizure, weakness, slurred speech or unequal pupils, seek emergency care now."))),
        h("p", { class: "tiny muted", style: { marginTop: "18px" } },
          "Built for Hack for Humanity. Instruments adapted from published work by Lovell & Collins, Mucha et al., Guskiewicz, Galetta et al., Zemek et al., Kroenke et al. and the 2023 Amsterdam consensus statement — all cited in full inside the app."));
    }

    render();
    return root;
  };
})();
