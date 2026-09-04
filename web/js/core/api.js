(function () {
  const CAD = window.CAD;
  const SESSION_KEY = "cadence.session.v1";

  const state = {
    online: location.protocol !== "file:",
    checked: false,
    account: null,
    devMode: false
  };

  function readLocal() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeLocal(value) {
    try {
      if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  async function call(path, options) {
    const opts = Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, options || {});
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(path, Object.assign({ signal: controller.signal }, opts));
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) { body = { error: text }; }
      if (!res.ok) throw Object.assign(new Error((body && body.error) || ("Request failed (" + res.status + ")")), { status: res.status, body });
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function probe() {
    state.checked = true;
    if (location.protocol === "file:") { state.online = false; return false; }
    try {
      const res = await call("/api/health");
      state.online = true;
      state.devMode = !!(res && res.devCodes);
      state.coach = !!(res && res.coach);
      return true;
    } catch (e) {
      state.online = false;
      state.staticHost = !!(e && e.status && e.status >= 400 && e.status < 500);
      return false;
    }
  }

  async function me() {
    if (!state.online) return null;
    try {
      const res = await call("/api/me");
      state.account = res.account || null;
      if (state.account) writeLocal({ email: state.account.email, id: state.account.id });
      return state.account;
    } catch (e) {
      state.account = null;
      writeLocal(null);
      return null;
    }
  }

  function requestCode(email) {
    return call("/api/auth/request-code", { method: "POST", body: JSON.stringify({ email }) });
  }

  async function verifyCode(email, code) {
    const res = await call("/api/auth/verify", { method: "POST", body: JSON.stringify({ email, code }) });
    state.account = res.account;
    writeLocal({ email: res.account.email, id: res.account.id });
    return res;
  }

  async function logout() {
    try { await call("/api/auth/logout", { method: "POST" }); } catch (e) {}
    state.account = null;
    writeLocal(null);
    setGuest(false);
  }

  function saveBackup(payload) {
    return call("/api/backup", { method: "PUT", body: JSON.stringify(payload) });
  }

  function loadBackup() {
    return call("/api/backup");
  }

  function deleteAccount() {
    return call("/api/account", { method: "DELETE" });
  }

  function coach(summary) {
    return call("/api/coach", { method: "POST", body: JSON.stringify({ summary }) });
  }

  function chat(messages, context) {
    return call("/api/chat", { method: "POST", body: JSON.stringify({ messages, context }) });
  }

  function localSession() { return readLocal(); }

  function isGuest() {
    try { return localStorage.getItem("cadence.guest") === "1"; } catch (e) { return false; }
  }
  function setGuest(on) {
    try {
      if (on) localStorage.setItem("cadence.guest", "1");
      else localStorage.removeItem("cadence.guest");
    } catch (e) {}
  }

  CAD.api = {
    state, probe, me, requestCode, verifyCode, logout,
    saveBackup, loadBackup, deleteAccount, coach, chat, localSession, isGuest, setGuest
  };
})();
