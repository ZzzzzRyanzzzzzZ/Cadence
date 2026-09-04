(function () {
  const CAD = window.CAD;
  const h = CAD.h;
  CAD.screens = CAD.screens || {};

  function toggleRow(label, sub, value, onChange) {
    return h("div", { class: "switch" },
      h("div", { class: "switch__text" }, h("strong", label), sub ? h("span", sub) : null),
      h("button", { class: "toggle", type: "button", "aria-pressed": String(!!value), "aria-label": label, onclick: () => onChange(!value) }));
  }

  function accountCard() {
    const account = CAD.api.state.account;
    const guest = CAD.api.isGuest();

    if (!CAD.api.state.online) {
      return h("div", { class: "card stack" },
        h("h2", "Account"),
        h("p", { class: "card__sub" }, location.protocol === "file:"
          ? "Cadence is running straight from a file, so there is no server to hold an account. Everything works — sync and email sign-in do not."
          : "The Cadence server is not reachable right now, so account features are paused. Nothing local is affected."));
    }

    if (!account) {
      return h("div", { class: "card stack" },
        h("h2", "Account"),
        h("p", { class: "card__sub" }, guest
          ? "You are using Cadence on this device only. An account adds encrypted backup and lets you move to a new phone without losing your history."
          : "Sign in to enable encrypted backup."),
        h("button", {
          class: "btn btn--primary",
          onclick: () => {
            CAD.api.setGuest(false);
            CAD.tolerance.stop();
            CAD.comfortWidget.unmount();
            location.hash = "";
            CAD.render();
          }
        }, CAD.icon("arrow"), "Create an account or sign in"),
        h("p", { class: "tiny muted" }, "This takes you back to the landing page. Your check-ins, tests and journal stay in this browser either way."));
    }

    const passInput = h("input", { class: "input", type: "password", placeholder: "Backup passphrase", autocomplete: "new-password" });
    const status = h("p", { class: "tiny muted" }, "");

    async function backup() {
      if (!CAD.crypto.supported()) { status.textContent = "This browser will not encrypt over an insecure connection. Use https or localhost."; return; }
      const pass = passInput.value;
      if (!pass || pass.length < 8) { status.textContent = "Use a passphrase of at least 8 characters. If you lose it, the backup is unrecoverable — that is the point."; return; }
      status.textContent = "Encrypting…";
      try {
        const payload = await CAD.crypto.encrypt(CAD.store.exportJSON(), pass);
        await CAD.api.saveBackup(payload);
        status.textContent = "Encrypted backup saved " + CAD.fmt.time(Date.now()) + ". The server holds ciphertext it cannot read.";
        CAD.toast("Backup saved.");
      } catch (e) {
        status.textContent = e.message || "Backup failed.";
      }
    }

    async function restore() {
      const pass = passInput.value;
      if (!pass) { status.textContent = "Enter the passphrase you used when you backed up."; return; }
      status.textContent = "Fetching…";
      try {
        const res = await CAD.api.loadBackup();
        if (!res || !res.backup) { status.textContent = "No backup stored for this account yet."; return; }
        const plain = await CAD.crypto.decrypt(res.backup, pass);
        CAD.store.importJSON(plain);
        status.textContent = "Restored from backup of " + CAD.fmt.longDate(res.updatedAt) + ".";
        CAD.toast("Restored.");
        CAD.render();
      } catch (e) {
        status.textContent = "Could not decrypt. Wrong passphrase, or the backup was written by another account.";
      }
    }

    return h("div", { class: "card stack" },
      h("div", { class: "row row--between" },
        h("div", null, h("h2", "Account"), h("p", { class: "card__sub" }, "Signed in as " + account.email)),
        h("span", { class: "chip chip--good" }, CAD.icon("check", 14), "Verified")),
      h("div", { class: "kv" },
        h("div", null, h("b", "Member since"), h("span", CAD.fmt.longDate(account.createdAt))),
        h("div", null, h("b", "Stored about you"), h("span", "Email address only"))),
      h("hr", { class: "divider" }),
      h("h3", "Encrypted backup"),
      h("p", { class: "tiny muted" }, "Your data is encrypted in this browser with AES-GCM, using a key derived from your passphrase through " + CAD.crypto.ITERATIONS.toLocaleString() + " rounds of PBKDF2. The passphrase never leaves this device, so the server stores a blob it has no way to read — and neither do we."),
      h("div", { class: "field" }, h("label", { class: "field__label" }, "Backup passphrase"), passInput),
      h("div", { class: "row" },
        h("button", { class: "btn btn--primary", onclick: backup }, CAD.icon("lock"), "Encrypt & back up"),
        h("button", { class: "btn btn--ghost", onclick: restore }, CAD.icon("download"), "Restore from backup")),
      status,
      h("hr", { class: "divider" }),
      h("div", { class: "row" },
        h("button", {
          class: "btn btn--ghost",
          onclick: async () => {
            await CAD.api.logout();
            CAD.tolerance.stop();
            CAD.comfortWidget.unmount();
            location.hash = "";
            CAD.toast("Signed out. Everything on this device is untouched.");
            CAD.render();
          }
        }, CAD.icon("arrow"), "Sign out"),
        h("button", {
          class: "btn btn--danger-ghost",
          onclick: () => CAD.modal({
            title: "Delete this account?",
            body: h("div", { class: "stack" },
              h("p", "This removes your email address and any encrypted backup from the server permanently."),
              h("p", { class: "tiny muted" }, "Data stored in this browser is not touched — use Erase everything below for that.")),
            actions: [
              h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Cancel"),
              h("button", {
                class: "btn btn--danger", onclick: async () => {
                  try { await CAD.api.deleteAccount(); } catch (e) {}
                  await CAD.api.logout();
                  CAD.closeModal();
                  CAD.toast("Account deleted.");
                  CAD.render();
                }
              }, "Delete account")
            ]
          })
        }, "Delete account")));
  }

  CAD.screens.settings = function () {
    const state = CAD.store.get();
    const s = state.settings;
    const p = state.profile;

    function set(path, value) { CAD.store.set(path, value); CAD.applySettings(CAD.store.get().settings); CAD.render(); }

    const fileInput = h("input", { type: "file", accept: "application/json", hidden: true, onchange: (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { CAD.store.importJSON(String(reader.result)); CAD.toast("Data imported."); CAD.render(); }
        catch (err) { CAD.toast("That file could not be read as a Cadence export."); }
      };
      reader.readAsText(file);
    } });

    return h("div", { class: "wrap stack" },
      h("div", { class: "page-head" },
        h("p", { class: "eyebrow" }, "App"),
        h("h1", "Settings & data"),
        h("p", "Comfort settings, your recovery details, and full control over everything Cadence has stored.")),

      accountCard(),

      h("div", { class: "card stack" },
        h("h2", "Comfort & accessibility"),
        h("div", { class: "field" },
          h("span", { class: "field__label" }, "Theme"),
          h("div", { class: "seg" }, [["light", "Warm light"], ["dark", "Dim"], ["auto", "Match system"]].map(([v, label]) =>
            h("button", { class: "seg__btn", type: "button", "aria-pressed": String(s.theme === v), onclick: () => set("settings.theme", v) }, label))),
          h("span", { class: "field__hint" }, "Dim mode uses a low-blue palette that is easier with light sensitivity.")),
        h("div", { class: "field" },
          h("div", { class: "row row--between" },
            h("label", { class: "field__label", for: "setScale" }, "Text size"),
            h("output", { class: "mono" }, Math.round(s.fontScale * 100) + "%")),
          h("input", {
            class: "range", id: "setScale", type: "range", min: "0.85", max: "1.5", step: "0.05", value: String(s.fontScale),
            oninput: (e) => { CAD.store.set("settings.fontScale", Number(e.target.value)); CAD.applySettings(CAD.store.get().settings); }
          })),
        toggleRow("Reduce motion", "Removes animation across the app. Recommended after a head injury.", s.reduceMotion, (v) => set("settings.reduceMotion", v)),
        toggleRow("High contrast", "Stronger borders and text.", s.highContrast, (v) => set("settings.highContrast", v)),
        toggleRow("Readable font", "Wider letter and word spacing.", s.dyslexic, (v) => set("settings.dyslexic", v)),
        CAD.speech.supported ? toggleRow("Read instructions aloud", "Uses your device's built-in voice.", s.speech, (v) => set("settings.speech", v)) : null,
        h("div", { class: "field" },
          h("span", { class: "field__label" }, "Rest reminder"),
          h("div", { class: "seg" }, [10, 15, 25, 0].map((v) =>
            h("button", { class: "seg__btn", type: "button", "aria-pressed": String(s.restReminderMin === v), onclick: () => set("settings.restReminderMin", v) }, v ? v + " min" : "Off"))),
          h("span", { class: "field__hint" }, "A gentle prompt to look away after this long in the app."))),

      (function () {
        const t = CAD.tolerance.ensureState();
        const stats = CAD.tolerance.todayStats();
        function setTol(key, value) {
          CAD.store.update((st) => { st.tolerance[key] = value; });
          CAD.render();
        }
        return h("div", { class: "card stack" },
          h("div", null,
            h("h2", "Screen tolerance sensing"),
            h("p", { class: "card__sub" }, "Cadence can watch how you interact with the page and quietly ease the interface off when you are struggling, before you notice you are. It is the part of concussion care that the 'sit in a dark room' advice gets wrong: you need a screen you can tolerate, not no screen at all.")),
          toggleRow("Sense my screen tolerance", "Measures cursor steadiness, scroll re-reading, typing corrections, tab switches, pauses and time on screen.", t.enabled, (v) => setTol("enabled", v)),
          t.enabled ? toggleRow("Let it adapt the interface", "At moderate strain: larger text, no motion, flat background. At high strain: full decoration off and a prompt to stop.", t.adapt, (v) => setTol("adapt", v)) : null,
          stats ? h("div", { class: "grid grid--3" },
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Today's mean strain"), h("span", { class: "stat__value" }, Math.round(stats.mean), h("small", " / 100"))),
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Peak"), h("span", { class: "stat__value" }, Math.round(stats.peak), h("small", " / 100"))),
            h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Tracked"), h("span", { class: "stat__value" }, stats.minutesTracked, h("small", " min")))) : null,
          h("div", { class: "callout callout--good" },
            h("span", { class: "callout__ico" }, CAD.icon("lock")),
            h("div",
              h("strong", "What this never does"),
              h("p", { style: { margin: "4px 0 0" } }, "It records event timings and distances only — never the characters you type, never the pages you visit outside Cadence, never the camera or microphone. Nothing is transmitted. Turning it off erases the collected baseline."))),
          h("div", { class: "row" },
            h("button", {
              class: "btn btn--ghost btn--sm",
              onclick: () => {
                CAD.store.update((st) => { st.tolerance.baseline = {}; st.tolerance.log = []; });
                CAD.toast("Tolerance baseline cleared — it will relearn from scratch.");
                CAD.render();
              }
            }, CAD.icon("refresh"), "Reset what it has learned")));
      })(),

      h("div", { class: "card stack" },
        h("h2", "Your recovery details"),
        h("div", { class: "grid grid--2" },
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Name on the report"),
            h("input", { class: "input", value: p.name, oninput: (e) => CAD.store.set("profile.name", e.target.value) })),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Date of injury"),
            h("input", { class: "input", type: "date", value: p.injuryDate, max: CAD.fmt.dayKey(), onchange: (e) => { CAD.store.set("profile.injuryDate", e.target.value); CAD.render(); } })),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Mechanism"),
            h("input", { class: "input", value: p.mechanism, oninput: (e) => CAD.store.set("profile.mechanism", e.target.value) })),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Age band"),
            h("select", { class: "select", onchange: (e) => { CAD.store.set("profile.ageBand", e.target.value); CAD.render(); } },
              ["", "5-7", "8-12", "13-17", "18-25", "26+"].map((v) => h("option", { value: v, selected: p.ageBand === v }, v || "Not set")))),
          h("div", { class: "field" }, h("label", { class: "field__label" }, "Sex at birth"),
            h("select", { class: "select", onchange: (e) => { CAD.store.set("profile.sexAtBirth", e.target.value); CAD.render(); } },
              [["", "Prefer not to say"], ["female", "Female"], ["male", "Male"]].map(([v, label]) => h("option", { value: v, selected: p.sexAtBirth === v }, label))))),
        toggleRow("A previous concussion took over a week to clear", "", p.priorProlonged, (v) => set("profile.priorProlonged", v)),
        toggleRow("Migraine history", "", p.migraineHistory, (v) => set("profile.migraineHistory", v)),
        toggleRow("Mood or anxiety history", "", p.anxietyOrMoodHistory, (v) => set("profile.anxietyOrMoodHistory", v)),
        toggleRow("ADHD or learning difference", "", p.learningOrAdhd, (v) => set("profile.learningOrAdhd", v)),
        toggleRow("Answered questions slowly when assessed", "", p.answeredSlowly, (v) => set("profile.answeredSlowly", v)),
        toggleRow("Cleared by a clinician", "Unlocks the full-contact step of the return-to-sport strategy.", p.seenClinician, (v) => set("profile.seenClinician", v))),

      h("div", { class: "card stack" },
        h("h2", "Your data"),
        h("div", { class: "grid grid--4" },
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Check-ins"), h("span", { class: "stat__value" }, state.checkins.length)),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Cognitive runs"), h("span", { class: "stat__value" }, state.cognitionRuns.length)),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Screens & balance"), h("span", { class: "stat__value" }, state.oculomotorRuns.length + state.balanceRuns.length)),
          h("div", { class: "stat" }, h("span", { class: "stat__label" }, "Journal entries"), h("span", { class: "stat__value" }, state.journal.length))),
        h("div", { class: "row" },
          h("a", { class: "btn btn--ghost", href: "#/report" }, CAD.icon("download"), "Export from the report page"),
          h("button", { class: "btn btn--ghost", onclick: () => fileInput.click() }, CAD.icon("refresh"), "Import a Cadence file"),
          fileInput,
          h("button", {
            class: "btn btn--ghost",
            onclick: () => CAD.modal({
              title: "Load 24 days of sample data?",
              body: h("p", "This replaces everything currently stored on this device with a realistic worked example, so you can see every chart and model populated."),
              actions: [
                h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Cancel"),
                h("button", { class: "btn btn--primary", onclick: () => { CAD.seed.load(); CAD.closeModal(); CAD.toast("Sample recovery loaded."); location.hash = "#/today"; CAD.render(); } }, "Load sample data")
              ]
            })
          }, CAD.icon("sparkle"), "Load sample data")),
        h("hr", { class: "divider" }),
        h("div", { class: "callout callout--danger" },
          h("span", { class: "callout__ico" }, CAD.icon("trash")),
          h("div", null,
            h("strong", "Erase everything on this device"),
            h("p", { style: { margin: "4px 0 8px" } }, "Deletes every check-in, test result and journal entry stored in this browser. There is no undo, and no copy anywhere else unless you exported one."),
            h("button", {
              class: "btn btn--danger btn--sm",
              onclick: () => CAD.modal({
                title: "Erase all local data?",
                body: h("p", "Every check-in, test result and journal entry in this browser will be deleted permanently."),
                actions: [
                  h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Keep my data"),
                  h("button", { class: "btn btn--danger", onclick: () => { CAD.store.wipe(); CAD.closeModal(); CAD.toast("Erased."); location.hash = "#/today"; CAD.render(); } }, "Erase everything")
                ]
              })
            }, "Erase everything")))),

      h("p", { class: "attrib" }, "Cadence stores data using your browser's local storage. Clearing site data in your browser settings also erases it. Nothing is uploaded unless you explicitly create an encrypted backup."));
  };
})();
