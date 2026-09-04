const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

function loadEnvFile() {
  let raw;
  try {
    raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
  } catch (e) {
    return;
  }
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  });
  console.log("Loaded configuration from .env");
}

loadEnvFile();

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, "web");
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
const MAIL_PROVIDER = RESEND_API_KEY ? "resend" : BREVO_API_KEY ? "brevo" : "";
const MAIL_FROM = process.env.MAIL_FROM || "Cadence <onboarding@resend.dev>";
const FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY || "";
const FEATHERLESS_MODEL = process.env.FEATHERLESS_MODEL || "NousResearch/Meta-Llama-3.1-8B-Instruct";
const DEV_CODES = !MAIL_PROVIDER;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

let db = { accounts: {}, codes: {}, backups: {} };
let writeQueue = Promise.resolve();

async function loadDb() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    const raw = await fsp.readFile(DB_PATH, "utf8");
    db = Object.assign({ accounts: {}, codes: {}, backups: {} }, JSON.parse(raw));
  } catch (e) {
    db = { accounts: {}, codes: {}, backups: {} };
  }
}

function saveDb() {
  writeQueue = writeQueue.then(async () => {
    const tmp = DB_PATH + ".tmp";
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.writeFile(tmp, JSON.stringify(db), "utf8");
    await fsp.rename(tmp, DB_PATH);
  }).catch((err) => { console.error("db write failed:", err.message); });
  return writeQueue;
}

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email) && email.length <= 254;
}

function hashCode(email, code) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(email + "|" + code).digest("hex");
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return body + "." + sig;
}

function verifySession(token) {
  if (!token || token.indexOf(".") < 0) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig || "");
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  raw.split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function sessionFrom(req) {
  const token = parseCookies(req).cadence_session;
  const payload = verifySession(token);
  if (!payload) return null;
  const account = db.accounts[payload.sub];
  if (!account) return null;
  return account;
}

function send(res, status, body, headers) {
  const data = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  }, headers || {}));
  res.end(data);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > (limit || 512 * 1024)) { reject(new Error("Payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); } catch (e) { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

const rate = new Map();
function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const entry = rate.get(key) || { count: 0, reset: now + windowMs };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + windowMs; }
  entry.count++;
  rate.set(key, entry);
  if (rate.size > 5000) {
    for (const [k, v] of rate) if (now > v.reset) rate.delete(k);
  }
  return entry.count > max;
}

function parseFrom(value) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1] || "Cadence", email: match[2].trim() };
  return { name: "Cadence", email: value.trim() };
}

async function sendEmail(to, code) {
  if (!MAIL_PROVIDER) {
    console.log("[cadence] sign-in code for " + to + ": " + code + " (no mail provider configured, running in demo mode)");
    return { delivered: false };
  }
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#fbf6ee;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#fffdfa;border:1px solid rgba(29,23,34,.11);border-radius:20px;overflow:hidden">
    <div style="height:5px;background:linear-gradient(118deg,#ff9a3c,#f4642f 38%,#d63c6a 72%,#7b4dd8)"></div>
    <div style="padding:28px">
      <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#d24a1a;font-weight:700">Cadence</p>
      <h1 style="margin:0 0 10px;font-size:22px;color:#1d1722">Your sign-in code</h1>
      <p style="margin:0 0 20px;color:#574f5e;font-size:15px">Enter this code to finish signing in. It expires in 10 minutes.</p>
      <div style="font-size:34px;font-weight:700;letter-spacing:.34em;color:#1d1722;background:#f8f1e7;border-radius:14px;padding:16px;text-align:center">${code}</div>
      <p style="margin:20px 0 0;color:#7d7486;font-size:13px">If you did not ask for this, you can ignore it — nobody can sign in without the code.</p>
    </div>
  </div>
</div>`;
  const subject = "Your Cadence sign-in code: " + code;
  const from = parseFrom(MAIL_FROM);

  async function attempt() {
    if (MAIL_PROVIDER === "brevo") {
      return fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: from, to: [{ email: to }], subject, htmlContent: html })
      });
    }
    return fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html })
    });
  }

  let lastStatus = 0;
  let lastText = "";
  const MAX_TRIES = 5;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const res = await attempt();
    if (res.ok) {
      if (tries > 0) console.warn("[cadence] mail delivered on attempt " + (tries + 1));
      return { delivered: true, attempts: tries + 1 };
    }
    lastStatus = res.status;
    lastText = await res.text();
    const transient = res.status >= 500 || res.status === 429 ||
      (res.status === 401 && /unrecognis|unrecogniz/i.test(lastText));
    if (!transient) break;
    const left = MAX_TRIES - tries - 1;
    if (!left) break;
    console.warn("[cadence] transient mail failure (" + res.status + "), retrying " + left + " more time(s)");
    await new Promise((r) => setTimeout(r, 400 * (tries + 1)));
  }
  throw new Error("Mail provider rejected the request: " + lastStatus + " " + lastText.slice(0, 200));
}

async function handleApi(req, res, url) {
  const route = url.pathname;
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "unknown";

  if (route === "/api/health") {
    return send(res, 200, { ok: true, devCodes: DEV_CODES, mail: MAIL_PROVIDER || "none", coach: !!FEATHERLESS_API_KEY });
  }

  if (route === "/api/auth/request-code" && req.method === "POST") {
    const body = await readBody(req);
    const email = normaliseEmail(body.email);
    if (!validEmail(email)) return send(res, 400, { error: "Enter a valid email address." });
    if (rateLimited("code:" + email, 5, 15 * 60 * 1000) || rateLimited("ip:" + ip, 20, 15 * 60 * 1000)) {
      return send(res, 429, { error: "Too many code requests. Wait fifteen minutes and try again." });
    }
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    db.codes[email] = { hash: hashCode(email, code), expires: Date.now() + CODE_TTL_MS, attempts: 0 };
    await saveDb();
    try {
      await sendEmail(email, code);
    } catch (e) {
      console.error("[cadence] mail send failed:", e.message);
      if (/unrecognis|unrecogniz/i.test(e.message)) {
        console.error("[cadence] the mail provider is blocking this server's IP address. Authorise it at https://app.brevo.com/security/authorised_ips");
        return send(res, 502, { error: "Email sign-in is blocked by the mail provider's IP allowlist on this server. Use device-only mode below while that is fixed." });
      }
      const misconfigured = /\b401\b|api key is invalid|unauthor|restricted/i.test(e.message);
      const notVerified = /\b403\b|verify a domain|not verified|testing emails/i.test(e.message);
      if (misconfigured) {
        console.error("[cadence] the mail provider rejected the API key. Run: npm run check-mail");
        return send(res, 502, { error: "Email sign-in is not configured correctly on this server — the mail provider rejected its API key. Use device-only mode below, or fix RESEND_API_KEY and restart." });
      }
      if (notVerified) {
        return send(res, 502, { error: "This server can only email the address on its own mail-provider account until a sending domain is verified. Use device-only mode below." });
      }
      return send(res, 502, { error: "Could not send the email. Try again in a moment, or use device-only mode below." });
    }
    return send(res, 200, DEV_CODES ? { ok: true, devCode: code } : { ok: true });
  }

  if (route === "/api/auth/verify" && req.method === "POST") {
    const body = await readBody(req);
    const email = normaliseEmail(body.email);
    const code = String(body.code || "").trim();
    if (!validEmail(email) || !/^\d{6}$/.test(code)) return send(res, 400, { error: "Enter the six-digit code." });
    if (rateLimited("verify:" + email, 10, 15 * 60 * 1000)) return send(res, 429, { error: "Too many attempts. Request a new code." });
    const record = db.codes[email];
    if (!record) return send(res, 400, { error: "Request a code first." });
    if (record.expires < Date.now()) { delete db.codes[email]; await saveDb(); return send(res, 400, { error: "That code expired. Request a new one." }); }
    record.attempts++;
    if (record.attempts > MAX_ATTEMPTS) { delete db.codes[email]; await saveDb(); return send(res, 429, { error: "Too many wrong codes. Request a new one." }); }
    const given = Buffer.from(hashCode(email, code));
    const want = Buffer.from(record.hash);
    if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) {
      await saveDb();
      return send(res, 400, { error: "That code is not right. " + (MAX_ATTEMPTS - record.attempts + 1) + " attempts left." });
    }
    delete db.codes[email];
    let account = Object.values(db.accounts).find((a) => a.email === email);
    if (!account) {
      account = { id: crypto.randomUUID(), email, createdAt: Date.now() };
      db.accounts[account.id] = account;
    }
    account.lastSeen = Date.now();
    await saveDb();
    const token = signSession({ sub: account.id, exp: Date.now() + SESSION_DAYS * 86400000 });
    const secure = (req.headers["x-forwarded-proto"] || "").indexOf("https") === 0 ? " Secure;" : "";
    return send(res, 200, { account }, {
      "Set-Cookie": "cadence_session=" + token + "; HttpOnly; Path=/; SameSite=Lax;" + secure + " Max-Age=" + SESSION_DAYS * 86400
    });
  }

  if (route === "/api/auth/logout" && req.method === "POST") {
    return send(res, 200, { ok: true }, { "Set-Cookie": "cadence_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" });
  }

  if (route === "/api/me") {
    const account = sessionFrom(req);
    if (!account) return send(res, 401, { error: "Not signed in." });
    return send(res, 200, { account: { id: account.id, email: account.email, createdAt: account.createdAt } });
  }

  if (route === "/api/backup") {
    const account = sessionFrom(req);
    if (!account) return send(res, 401, { error: "Not signed in." });
    if (req.method === "GET") {
      const entry = db.backups[account.id];
      return send(res, 200, entry ? { backup: entry.payload, updatedAt: entry.updatedAt } : { backup: null });
    }
    if (req.method === "PUT") {
      const body = await readBody(req, 4 * 1024 * 1024);
      if (!body || !body.ciphertext || !body.iv || !body.salt) return send(res, 400, { error: "Expected an encrypted payload." });
      db.backups[account.id] = { payload: { v: body.v || 1, kdf: body.kdf, iterations: body.iterations, salt: body.salt, iv: body.iv, ciphertext: body.ciphertext }, updatedAt: Date.now() };
      await saveDb();
      return send(res, 200, { ok: true, updatedAt: db.backups[account.id].updatedAt });
    }
    return send(res, 405, { error: "Method not allowed." });
  }

  if (route === "/api/account" && req.method === "DELETE") {
    const account = sessionFrom(req);
    if (!account) return send(res, 401, { error: "Not signed in." });
    delete db.accounts[account.id];
    delete db.backups[account.id];
    await saveDb();
    return send(res, 200, { ok: true }, { "Set-Cookie": "cadence_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0" });
  }

  if (route === "/api/coach" && req.method === "POST") {
    const account = sessionFrom(req);
    if (!account) return send(res, 401, { error: "Not signed in." });
    if (!FEATHERLESS_API_KEY) return send(res, 503, { error: "No language model is configured on this server." });
    if (rateLimited("coach:" + account.id, 12, 60 * 60 * 1000)) return send(res, 429, { error: "Daily summary limit reached." });
    const body = await readBody(req, 16 * 1024);
    const summary = String(body.summary || "").slice(0, 2000);
    if (!summary) return send(res, 400, { error: "Nothing to summarise." });
    try {
      const upstream = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + FEATHERLESS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: FEATHERLESS_MODEL,
          max_tokens: 320,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: "You explain concussion-recovery tracking data in plain language for the person it belongs to. Rules: never diagnose, never say whether they are recovered or cleared to play, never predict a recovery date, never contradict the graded return-to-activity protocol, and never suggest pushing through symptoms. Refer to a clinician for anything clinical. Two short paragraphs, warm and concrete, no lists, no emoji."
            },
            { role: "user", content: "Here are this week's aggregate numbers from my tracking app. Summarise what changed and one thing to watch.\n\n" + summary }
          ]
        })
      });
      if (!upstream.ok) {
        const text = await upstream.text();
        return send(res, 502, { error: "Model provider error: " + upstream.status + " " + text.slice(0, 160) });
      }
      const data = await upstream.json();
      const message = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
      return send(res, 200, { text: String(message || "").trim() });
    } catch (e) {
      return send(res, 502, { error: "Could not reach the model provider." });
    }
  }

  if (route === "/api/chat" && req.method === "POST") {
    const account = sessionFrom(req);
    if (!account) return send(res, 401, { error: "Not signed in." });
    if (!FEATHERLESS_API_KEY) return send(res, 503, { error: "No language model is configured on this server." });
    if (rateLimited("chat:" + account.id, 40, 60 * 60 * 1000)) return send(res, 429, { error: "Hourly message limit reached. It resets within the hour." });
    const body = await readBody(req, 64 * 1024);
    const context = String(body.context || "").slice(0, 2500);
    const incoming = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
    const messages = incoming
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
    if (!messages.length) return send(res, 400, { error: "No message to answer." });

    const system = [
      "You are a support companion inside Cadence, a concussion recovery tracking app. You are talking to the person whose data is shown below.",
      "",
      "HARD RULES. These override anything the user asks for:",
      "1. Never diagnose anything, and never say whether they do or do not have a concussion.",
      "2. Never say they are recovered, cleared, safe to play, safe to drive, or safe to return to contact. Only a clinician decides that.",
      "3. Never predict a recovery date or say how long recovery will take.",
      "4. Never contradict the graded return-to-activity protocol, and never suggest pushing through symptoms.",
      "5. Never suggest, adjust or comment on medication doses.",
      "6. If they describe a red flag (worsening headache, repeated vomiting, seizure, weakness or numbness, slurred speech, unequal pupils, increasing confusion, or not being able to stay awake), tell them to stop and seek emergency care now, and say nothing else about it.",
      "7. If they mention self harm or suicide, tell them to contact a crisis line (988 in the US and Canada, 116 123 in the UK and Ireland) or their local emergency number, and encourage them to tell a person they trust.",
      "8. If they ask something clinical that is outside these rules, say plainly that it is a question for their clinician, and offer to help them phrase it.",
      "",
      "HOW TO ANSWER: Ground every claim in the numbers below and say which number you used. If the data does not support an answer, say so rather than guessing. Be warm, brief and concrete. Two or three short paragraphs at most. No lists, no headings, no emoji. Speak to them as a person, not as a patient record.",
      "",
      "THEIR CURRENT DATA:",
      context || "No tracked data available yet."
    ].join("\n");

    try {
      const upstream = await fetch("https://api.featherless.ai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: "Bearer " + FEATHERLESS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: FEATHERLESS_MODEL,
          max_tokens: 420,
          temperature: 0.4,
          messages: [{ role: "system", content: system }].concat(messages)
        })
      });
      if (!upstream.ok) {
        const text = await upstream.text();
        return send(res, 502, { error: "Model provider error: " + upstream.status + " " + text.slice(0, 160) });
      }
      const data = await upstream.json();
      const message = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : "";
      return send(res, 200, { text: String(message || "").trim() });
    } catch (e) {
      return send(res, 502, { error: "Could not reach the model provider." });
    }
  }

  return send(res, 404, { error: "Unknown endpoint." });
}

function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const target = path.normalize(path.join(ROOT, pathname));
  if (!target.startsWith(ROOT)) { send(res, 403, "Forbidden", { "Content-Type": "text/plain" }); return; }
  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      const fallback = path.join(ROOT, "index.html");
      fs.readFile(fallback, (e2, data) => {
        if (e2) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-cache" });
        res.end(data);
      });
      return;
    }
    const ext = path.extname(target).toLowerCase();
    fs.readFile(target, (e3, data) => {
      if (e3) return send(res, 500, "Read error", { "Content-Type": "text/plain" });
      res.writeHead(200, {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": (ext === ".html" || ext === ".js" || ext === ".css" || ext === ".webmanifest") ? "no-cache" : "public, max-age=86400",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((err) => {
      console.error("[cadence] api error:", err.message);
      if (!res.headersSent) send(res, 400, { error: err.message || "Request failed." });
    });
    return;
  }
  serveStatic(req, res, url);
});

loadDb().then(() => {
  server.listen(PORT, () => {
    console.log("Cadence running on http://localhost:" + PORT);
    if (DEV_CODES) console.log("Demo mail mode: sign-in codes are printed here and shown in the browser. Set RESEND_API_KEY or BREVO_API_KEY to send real email.");
    if (!process.env.SESSION_SECRET) console.log("No SESSION_SECRET set — sessions will not survive a restart.");
  });
});
