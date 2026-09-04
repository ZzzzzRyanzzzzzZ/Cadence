(function () {
  const CAD = window.CAD;
  const h = CAD.h;

  const ROUTES = ["today", "checkin", "mind", "cognition", "oculomotor", "balance", "ladder", "plan", "chat", "insights", "caregiver", "report", "settings", "science"];
  let currentScreen = null;

  const NAV_ORDER = ["today", "checkin", "mind", "cognition", "oculomotor", "balance", "ladder", "plan", "chat", "insights", "caregiver", "report", "settings", "science"];
  function navOrder(name) {
    const i = NAV_ORDER.indexOf(name);
    return i < 0 ? NAV_ORDER.length : i;
  }
  let restTimer = null;
  let restStart = Date.now();

  function applySettings(s) {
    const html = document.documentElement;
    let theme = s.theme;
    if (theme === "auto") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    html.setAttribute("data-theme", theme);
    html.style.setProperty("--font-scale", String(s.fontScale || 1));
    html.setAttribute("data-contrast", s.highContrast ? "high" : "normal");
    html.setAttribute("data-dyslexic", s.dyslexic ? "on" : "off");
    html.setAttribute("data-motion", s.reduceMotion ? "reduced" : "full");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#141019" : "#fbf6ee");
  }

  function parseHash() {
    const raw = (location.hash || "#/today").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean);
    const name = parts[0] || "today";
    return { name: ROUTES.indexOf(name) >= 0 ? name : "today", params: parts.slice(1) };
  }

  function paintNav(routeName) {
    document.querySelectorAll("[data-route]").forEach((el) => {
      if (el.dataset.route === routeName) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    });
    document.querySelectorAll(".nav__ico, .tabbar__ico").forEach((el) => {
      if (el.dataset.painted) return;
      const name = el.dataset.ico;
      el.appendChild(CAD.icon(name === "more" ? "more" : name, 18));
      el.dataset.painted = "1";
    });
  }

  function paintChrome() {
    const state = CAD.store.get();
    const dsi = CAD.store.daysSinceInjury();
    const counter = document.getElementById("dayCounter");
    counter.textContent = dsi === null ? "" : "Day " + dsi + " since injury";
    counter.hidden = dsi === null;

    const avatar = document.getElementById("accountBtn");
    const account = CAD.api.state.account;
    if (account) {
      avatar.textContent = account.email.slice(0, 2).toUpperCase();
      avatar.title = "Signed in as " + account.email;
      avatar.hidden = false;
    } else if (CAD.api.isGuest()) {
      avatar.textContent = "•";
      avatar.title = "Using this device only";
      avatar.hidden = false;
    } else {
      avatar.hidden = true;
    }
  }

  function showRedFlags() {
    const picked = new Set();
    const list = h("div", { class: "flag-list" });
    const warn = h("div", { class: "callout callout--danger", hidden: true, style: { marginTop: "14px" } },
      h("span", { class: "callout__ico" }, CAD.icon("alert")),
      h("div", null,
        h("strong", "Seek emergency care now."),
        h("p", { style: { margin: "4px 0 0" } }, "Call your local emergency number or go to an emergency department. Do not drive yourself. Do not wait to see if it settles.")));

    CAD.pcss.RED_FLAGS.forEach((f) => {
      const btn = h("button", { class: "flag-item", type: "button", "aria-pressed": "false" },
        h("span", { class: "flag-item__box" }),
        h("span", null, h("strong", f.label), h("span", { class: "tiny muted", style: { display: "block" } }, f.note)));
      btn.addEventListener("click", () => {
        const on = btn.getAttribute("aria-pressed") === "true";
        btn.setAttribute("aria-pressed", String(!on));
        if (on) picked.delete(f.id); else picked.add(f.id);
        warn.hidden = picked.size === 0;
      });
      list.appendChild(btn);
    });

    CAD.modal({
      title: "Red-flag check",
      body: h("div", { class: "stack" },
        h("p", { class: "tiny muted" }, "From the 2023 consensus statement and the CDC danger signs. Check anything true right now."),
        list, warn),
      actions: [
        h("button", {
          class: "btn btn--ghost", onclick: () => {
            CAD.store.update((s) => { s.redFlagChecks.push({ ts: Date.now(), flags: Array.from(picked), clear: picked.size === 0 }); });
            CAD.closeModal();
            CAD.toast(picked.size ? "Logged. Please get seen now." : "Logged — no red flags.");
          }
        }, "Save this check"),
        h("button", { class: "btn btn--primary", onclick: CAD.closeModal }, "Close")
      ]
    });
  }

  function restReminder() {
    clearTimeout(restTimer);
    const mins = CAD.store.get().settings.restReminderMin;
    const banner = document.getElementById("restBanner");
    banner.hidden = true;
    if (!mins) return;
    restTimer = setTimeout(() => {
      banner.innerHTML = "";
      banner.appendChild(h("span", { style: { color: "var(--accent)" } }, CAD.icon("clock")));
      banner.appendChild(h("div", { style: { flex: 1 } },
        h("strong", "You have been on screen " + mins + " minutes."),
        h("div", { class: "tiny muted" }, "Look at something far away for 30 seconds. Screen tolerance is trainable, but only if you stop before symptoms climb.")));
      banner.appendChild(h("button", {
        class: "btn btn--ghost btn--sm", onclick: () => { banner.hidden = true; restStart = Date.now(); restReminder(); }
      }, "Done"));
      banner.hidden = false;
    }, mins * 60000);
  }

  let lastRenderAt = 0;
  let lastRenderHash = null;

  function render(force) {
    const now = Date.now();
    if (!force && location.hash === lastRenderHash && now - lastRenderAt < 60) return;
    lastRenderHash = location.hash;
    lastRenderAt = now;

    const state = CAD.store.get();
    applySettings(state.settings);

    if (currentScreen && CAD.screens[currentScreen] && typeof CAD.screens[currentScreen].leave === "function") {
      try { CAD.screens[currentScreen].leave(); } catch (e) {}
    }
    CAD.speech.stop();

    const app = document.getElementById("app");
    const main = document.getElementById("main");
    app.hidden = false;
    main.innerHTML = "";

    const needsAuth = CAD.api.state.online && !CAD.api.state.account && !CAD.api.isGuest();
    if (needsAuth) {
      app.classList.add("app--bare");
      currentScreen = "auth";
      CAD.tolerance.stop();
      CAD.comfortWidget.unmount();
      main.appendChild(CAD.screens.auth());
      paintChrome();
      return;
    }

    if (!state.settings.onboarded) {
      app.classList.add("app--bare");
      currentScreen = "onboarding";
      CAD.tolerance.stop();
      CAD.comfortWidget.unmount();
      main.appendChild(h("div", { style: { padding: "24px 16px 64px" } }, CAD.screens.onboarding()));
      paintChrome();
      return;
    }

    app.classList.remove("app--bare");
    if (CAD.tolerance.ensureState().enabled) {
      CAD.tolerance.start();
      CAD.comfortWidget.mount();
    } else {
      CAD.tolerance.stop();
      CAD.comfortWidget.unmount();
    }
    const route = parseHash();
    const previous = currentScreen;
    currentScreen = route.name;
    const screen = CAD.screens[route.name] || CAD.screens.today;
    try {
      const node = screen(route.params);
      if (previous && previous !== route.name) {
        node.classList.add(navOrder(route.name) < navOrder(previous) ? "enter-back" : "enter-fwd");
      } else if (!previous) {
        node.classList.add("enter-rise");
      }
      main.appendChild(node);
    } catch (err) {
      main.appendChild(h("div", { class: "wrap card stack" },
        h("h2", "Something went wrong on this screen"),
        h("p", { class: "tiny muted" }, String(err && err.message ? err.message : err)),
        h("a", { class: "btn btn--primary", href: "#/today", onclick: () => setTimeout(render, 0) }, "Back to today")));
    }
    paintNav(route.name);
    paintChrome();
    app.dataset.nav = "closed";
    document.getElementById("navScrim").hidden = true;
    restStart = Date.now();
    restReminder();
  }

  async function signOut() {
    CAD.closeModal();
    await CAD.api.logout();
    CAD.tolerance.stop();
    CAD.comfortWidget.unmount();
    location.hash = "";
    CAD.toast("Signed out. Everything on this device is untouched.");
    render();
  }

  function showAccountMenu() {
    const account = CAD.api.state.account;
    const guest = CAD.api.isGuest();
    const body = h("div", { class: "stack" });

    if (account) {
      body.appendChild(h("div", { class: "row", style: { gap: "12px" } },
        h("span", { class: "appbar__avatar", style: { width: "44px", height: "44px" } }, account.email.slice(0, 2).toUpperCase()),
        h("div", null,
          h("strong", account.email),
          h("div", { class: "tiny muted" }, "Signed in · member since " + CAD.fmt.shortDate(account.createdAt)))));
      body.appendChild(h("p", { class: "tiny muted" },
        "Signing out returns you to the landing page. Your check-ins, tests and journal stay in this browser — they are not tied to the account unless you switch on encrypted backup."));
    } else if (guest) {
      body.appendChild(h("div", { class: "row", style: { gap: "12px" } },
        h("span", { class: "appbar__avatar", style: { width: "44px", height: "44px" } }, CAD.icon("lock", 20)),
        h("div", null,
          h("strong", "Device-only mode"),
          h("div", { class: "tiny muted" }, "No account. Nothing has left this browser."))));
      body.appendChild(h("p", { class: "tiny muted" },
        "Leaving device-only mode takes you back to the landing page so you can sign in with an email code. Your local data stays exactly as it is."));
    } else {
      body.appendChild(h("p", "You are not signed in."));
    }

    const actions = [h("button", { class: "btn btn--ghost", onclick: CAD.closeModal }, "Close")];
    if (account || guest) {
      actions.push(h("a", {
        class: "btn btn--ghost",
        href: "#/settings",
        onclick: () => { CAD.closeModal(); setTimeout(render, 0); }
      }, CAD.icon("settings"), "Settings & data"));
      actions.push(h("button", { class: "btn btn--primary", onclick: signOut },
        CAD.icon("arrow"), account ? "Sign out" : "Back to sign-in"));
    }

    CAD.modal({ title: "Account", body, actions });
  }

  function wireChrome() {
    const app = document.getElementById("app");
    const scrim = document.getElementById("navScrim");
    const toggle = document.getElementById("navToggle");

    function setNav(open) {
      app.dataset.nav = open ? "open" : "closed";
      scrim.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", () => setNav(app.dataset.nav !== "open"));
    scrim.addEventListener("click", () => setNav(false));
    document.getElementById("nav").addEventListener("click", (e) => {
      if (e.target.closest(".nav__link")) setNav(false);
    });
    document.getElementById("tabMore").addEventListener("click", () => setNav(true));
    document.getElementById("redFlagBtn").addEventListener("click", showRedFlags);
    document.getElementById("accountBtn").addEventListener("click", showAccountMenu);

    window.addEventListener("hashchange", function () { render(); });
    document.addEventListener("click", (e) => {
      const link = e.target.closest && e.target.closest('a[href^="#/"]');
      if (link && link.getAttribute("href") === location.hash) { e.preventDefault(); render(); }
    });
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => { if (CAD.store.get().settings.theme === "auto") applySettings(CAD.store.get().settings); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
    }
  }

  async function boot() {
    applySettings(CAD.store.get().settings);
    wireChrome();
    await CAD.api.probe();
    if (CAD.api.state.online) await CAD.api.me();
    render();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  CAD.render = render;
  CAD.applySettings = applySettings;
  CAD.showRedFlags = showRedFlags;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
