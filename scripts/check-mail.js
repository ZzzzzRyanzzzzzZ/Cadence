const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");

function readEnv() {
  const out = {};
  let raw;
  try {
    raw = fs.readFileSync(ENV_PATH, "utf8");
  } catch (e) {
    return out;
  }
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eq = trimmed.indexOf("=");
    if (eq < 0) return;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  });
  return out;
}

function mask(key) {
  if (!key) return "(none)";
  if (key.length <= 10) return key.slice(0, 3) + "…";
  return key.slice(0, 6) + "…" + key.slice(-4) + "  (" + key.length + " chars)";
}

function line(symbol, text) {
  console.log("  " + symbol + " " + text);
}

function fromDomainOf(from) {
  return (from.match(/@([^>\s]+)/) || [])[1] || "";
}

async function checkResend(key, from) {
  let probe;
  try {
    probe = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: "{}"
    });
  } catch (e) {
    line("✗", "Could not reach api.resend.com: " + e.message);
    return 1;
  }

  if (probe.status === 401) {
    line("✗", "Resend rejected this key (401 invalid).");
    console.log("");
    console.log("  Create a new one at resend.com -> API Keys -> Create API Key.");
    console.log("  Copy it from the dialog immediately — it is shown only once — then test with:");
    console.log("    node scripts/check-mail.js re_yourNewKey");
    return 1;
  }

  line("✓", "Key authenticates with Resend.");

  const domain = fromDomainOf(from);
  let res;
  try {
    res = await fetch("https://api.resend.com/domains", { headers: { Authorization: "Bearer " + key } });
  } catch (e) {
    line("!", "Could not list domains: " + e.message);
    return 0;
  }

  if (/resend\.dev$/i.test(domain)) {
    console.log("");
    line("✗", "MAIL_FROM uses resend.dev, so Resend will ONLY deliver to the email address");
    line(" ", "on your own Resend account. Every other recipient is rejected with a 403.");
    line(" ", "To reach anyone: Resend -> Domains -> Add Domain, add the DNS records it gives");
    line(" ", "you, wait for Verified, then set MAIL_FROM to an address on that domain.");
    line(" ", "No domain to hand? Use Brevo instead — set BREVO_API_KEY and verify a single");
    line(" ", "sender address. See .env.example.");
    return 0;
  }

  if (res.status === 401 || res.status === 403) {
    line("!", "This key has sending access only, so it cannot list your domains.");
    line(" ", "Cannot confirm that '" + domain + "' is verified — send yourself a test code to be sure.");
    return 0;
  }

  if (!res.ok) {
    line("!", "Resend returned " + res.status + " when listing domains.");
    return 0;
  }

  let domains = [];
  try { domains = (JSON.parse(await res.text()).data) || []; } catch (e) { domains = []; }
  const verified = domains.filter((d) => d.status === "verified");

  if (verified.length) line("✓", "Verified domains: " + verified.map((d) => d.name).join(", "));
  else line("!", "No verified domains on this account yet.");

  if (verified.some((d) => domain.toLowerCase().endsWith(d.name.toLowerCase()))) {
    line("✓", "MAIL_FROM domain is verified — codes can reach any address.");
  } else {
    line("✗", "'" + domain + "' is not a verified domain here, so sends will be rejected.");
    line(" ", "Verify it in Resend -> Domains, or point MAIL_FROM at one that is.");
  }
  return 0;
}

async function checkBrevo(key, from) {
  let res;
  try {
    res = await fetch("https://api.brevo.com/v3/account", { headers: { "api-key": key, accept: "application/json" } });
  } catch (e) {
    line("✗", "Could not reach api.brevo.com: " + e.message);
    return 1;
  }

  if (res.status === 401) {
    const text = await res.text();
    const ip = ((text.match(/IP address ([0-9a-fA-F.:]+)/) || [])[1] || "").replace(/[.:]+$/, "");
    if (/unrecognis|unrecogniz/i.test(text)) {
      line("✗", "Brevo is blocking this machine's IP address" + (ip ? " (" + ip + ")" : "") + ".");
      line(" ", "Your key is fine — Brevo restricts API calls to authorised IPs by default.");
      console.log("");
      console.log("  Fix it at https://app.brevo.com/security/authorised_ips");
      console.log("    - Add " + (ip || "this machine's IP") + ", or");
      console.log("    - Turn the IP restriction off entirely (simpler if your IP changes).");
      console.log("");
      console.log("  Deploying to Render later? Add Render's outbound IPs there too, or leave");
      console.log("  the restriction off — otherwise sign-in will work locally and fail in production.");
      return 1;
    }
    line("✗", "Brevo rejected this key (401 invalid).");
    console.log("");
    console.log("  Get one at brevo.com -> SMTP & API -> API Keys -> Generate a new API key.");
    return 1;
  }
  if (!res.ok) {
    line("✗", "Brevo returned " + res.status + ".");
    return 1;
  }

  line("✓", "Key authenticates with Brevo.");

  const address = (from.match(/<([^>]+)>/) || [null, from])[1].trim().toLowerCase();
  let senders = null;
  try {
    const sres = await fetch("https://api.brevo.com/v3/senders", { headers: { "api-key": key, accept: "application/json" } });
    const body = await sres.text();
    if (sres.ok) {
      senders = (JSON.parse(body).senders) || [];
    } else {
      line("!", "Could not read your sender list — Brevo returned " + sres.status + ".");
      line(" ", body.slice(0, 150));
      line(" ", "That is a lookup failure, not proof the sender is missing. Send yourself a code to be sure.");
      return 0;
    }
  } catch (e) {
    line("!", "Could not read your sender list: " + e.message);
    line(" ", "That is a lookup failure, not proof the sender is missing.");
    return 0;
  }

  if (!senders.length) {
    line("!", "Brevo returned an empty sender list for this account.");
    line(" ", "Brevo -> Senders, Domains & Dedicated IPs -> Senders -> Add a sender.");
    line(" ", "Brevo emails that address a confirmation link; click it and the sender goes active.");
    return 0;
  }

  const match = senders.find((s) => String(s.email || "").toLowerCase() === address);
  if (!match) {
    line("✗", "MAIL_FROM address '" + address + "' is not one of your Brevo senders.");
    line(" ", "Your senders: " + senders.map((s) => s.email).join(", "));
    return 0;
  }
  if (match.active === false) {
    line("✗", "Sender '" + address + "' exists but is not confirmed yet.");
    line(" ", "Check that inbox for Brevo's confirmation email and click the link.");
    return 0;
  }
  line("✓", "Sender '" + address + "' is verified — codes can reach any address.");
  return 0;
}

async function main() {
  const env = Object.assign({}, readEnv(), process.env);
  const argKey = (process.argv[2] || "").trim();
  const resendKey = argKey.startsWith("re_") ? argKey : (env.RESEND_API_KEY || "").trim();
  const brevoKey = argKey.startsWith("xkeysib") ? argKey : (env.BREVO_API_KEY || "").trim();
  const from = env.MAIL_FROM || "Cadence <onboarding@resend.dev>";

  console.log("\nCadence mail check\n");

  if (!resendKey && !brevoKey) {
    line("!", "No RESEND_API_KEY or BREVO_API_KEY found in .env or the environment.");
    line(" ", "Cadence runs in demo mode: sign-in codes appear on screen and in the server console.");
    console.log("");
    return;
  }

  const provider = resendKey ? "resend" : "brevo";
  line("·", "Provider: " + provider + (resendKey && brevoKey ? "  (RESEND_API_KEY wins when both are set)" : ""));
  line("·", "Key:      " + mask(resendKey || brevoKey));
  line("·", "From:     " + from);
  console.log("");

  const code = provider === "resend"
    ? await checkResend(resendKey, from)
    : await checkBrevo(brevoKey, from);

  console.log("");
  if (code) process.exitCode = code;
}

main().catch((e) => {
  console.error("check-mail failed:", e.message);
  process.exitCode = 1;
});
