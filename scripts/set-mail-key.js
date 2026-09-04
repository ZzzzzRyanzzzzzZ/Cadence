const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env");
const EXAMPLE_PATH = path.join(__dirname, "..", ".env.example");

function log(symbol, text) {
  console.log("  " + symbol + " " + text);
}

function readEnvLines() {
  try {
    return fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  } catch (e) {
    try {
      return fs.readFileSync(EXAMPLE_PATH, "utf8").split(/\r?\n/);
    } catch (e2) {
      return [];
    }
  }
}

function setLine(lines, key, value) {
  const activeRe = new RegExp("^\\s*" + key + "\\s*=");
  const commentedRe = new RegExp("^\\s*#\\s*" + key + "\\s*=");
  let done = false;
  const out = lines.map((line) => {
    if (activeRe.test(line) || commentedRe.test(line)) {
      if (done) return null;
      done = true;
      return key + "=" + value;
    }
    return line;
  }).filter((l) => l !== null);
  if (!done) out.push(key + "=" + value);
  return out;
}

function commentOut(lines, key) {
  const activeRe = new RegExp("^\\s*" + key + "\\s*=");
  return lines.map((line) => (activeRe.test(line) ? "# " + line.trim() : line));
}

async function validateBrevo(key) {
  const res = await fetch("https://api.brevo.com/v3/account", {
    headers: { "api-key": key, accept: "application/json" }
  });
  if (res.status === 401) {
    const text = await res.text();
    if (/unrecognis|unrecogniz/i.test(text)) {
      const ip = ((text.match(/IP address ([0-9a-fA-F.:]+)/) || [])[1] || "").replace(/[.:]+$/, "");
      return {
        ok: false,
        ipBlocked: true,
        reason: "Brevo is blocking this machine's IP" + (ip ? " (" + ip + ")" : "") +
          ". The key itself is fine — authorise it at https://app.brevo.com/security/authorised_ips"
      };
    }
    return { ok: false, reason: "Brevo rejected this key (401). Copy it again from SMTP & API -> API Keys." };
  }
  if (!res.ok) return { ok: false, reason: "Brevo returned " + res.status + "." };
  return { ok: true };
}

async function validateResend(key) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: "{}"
  });
  if (res.status === 401) return { ok: false, reason: "Resend rejected this key (401). Create a new one at resend.com -> API Keys." };
  return { ok: true };
}

async function main() {
  const key = (process.argv[2] || "").trim();
  const sender = (process.argv[3] || "").trim();

  console.log("\nCadence mail key setup\n");

  if (!key) {
    log("!", "Usage: node scripts/set-mail-key.js <api-key> [sender-email]");
    console.log("");
    console.log("  Brevo:   node scripts/set-mail-key.js xkeysib-... you@gmail.com");
    console.log("  Resend:  node scripts/set-mail-key.js re_... codes@yourdomain.com");
    console.log("");
    console.log("  The key is validated with the provider before anything is written,");
    console.log("  and it only ever goes into .env, which is gitignored.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  if (/^xsmtpsib/i.test(key)) {
    log("✗", "That is a Brevo SMTP key, not an API key.");
    log(" ", "Go to https://app.brevo.com/settings/keys/api and use the API Keys tab,");
    log(" ", "not the SMTP tab. Nothing was written.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  const order = key.startsWith("re_") ? ["resend", "brevo"] : ["brevo", "resend"];
  log("·", "Validating the key with each provider before writing anything…");

  let provider = null;
  const failures = [];
  for (const candidate of order) {
    let result;
    try {
      result = candidate === "brevo" ? await validateBrevo(key) : await validateResend(key);
    } catch (e) {
      log("✗", "Could not reach " + candidate + ": " + e.message);
      console.log("");
      process.exitCode = 1;
      return;
    }
    if (result.ok) { provider = candidate; break; }
    failures.push("  · " + candidate + ": " + result.reason);
  }

  if (!provider) {
    log("✗", "Neither provider accepted this key.");
    failures.forEach((f) => console.log("  " + f));
    console.log("");
    console.log("  For Brevo, the key comes from the API Keys tab at");
    console.log("  https://app.brevo.com/settings/keys/api — not the SMTP tab, and not");
    console.log("  the key's name. Copy the whole value, including any prefix.");
    console.log("");
    log(" ", "Nothing was written. .env is unchanged.");
    console.log("");
    process.exitCode = 1;
    return;
  }

  const isBrevo = provider === "brevo";
  log("✓", "Key is valid — this is a " + provider + " key.");

  let lines = readEnvLines();
  if (isBrevo) {
    lines = setLine(lines, "BREVO_API_KEY", key);
    lines = commentOut(lines, "RESEND_API_KEY");
  } else {
    lines = setLine(lines, "RESEND_API_KEY", key);
    lines = commentOut(lines, "BREVO_API_KEY");
  }
  if (sender) {
    lines = setLine(lines, "MAIL_FROM", "Cadence <" + sender + ">");
  }

  fs.writeFileSync(ENV_PATH, lines.join("\n"), "utf8");
  log("✓", "Wrote .env" + (sender ? " (sender set to " + sender + ")" : ""));

  console.log("");
  console.log("  Next:");
  console.log("    npm run check-mail     confirm the sender is verified");
  console.log("    npm start              restart the server");
  console.log("");
}

main().catch((e) => {
  console.error("set-mail-key failed:", e.message);
  process.exitCode = 1;
});
