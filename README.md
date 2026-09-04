# Cadence

**Recovery has a rhythm.**

A companion for the weeks after a concussion. Cadence tracks symptoms, tests the systems a concussion actually disrupts, and paces the return to school, work and sport using the graded strategy from the 2023 international consensus statement — with every model fitted to one person's own data, running in their own browser.

Built for Hack for Humanity. Entered in **Mental Health**, **Physical Health**, **Best Tech for Concussion Recovery**, **Best Use of AI/ML & Responsible AI**, **Best Design**, and **Best Use of Render**.

---

## Run it

```bash
npm start
```

Then open <http://localhost:3000>. No dependencies, no build step — Node 18+ and nothing else.

On the landing page, either sign in with an email code or choose **Continue on this device only**. Once inside, **Settings & data → Load sample data** fills the app with 28 days of a realistic recovery so every chart and model is populated.

> In local demo mode there is no mail provider, so the six-digit code is printed in the server console **and shown on screen**. Set `RESEND_API_KEY` and real email is sent instead.

To send real sign-in emails, copy `.env.example` to `.env` and configure one provider:

- **Resend** — set `RESEND_API_KEY`. Emailing anyone other than your own Resend account address requires verifying a domain you own (Resend → Domains → add the DNS records → set `MAIL_FROM` to an address on it).
- **Brevo** — set `BREVO_API_KEY`. No domain needed: verify a single sender address (a plain Gmail works), then `MAIL_FROM` uses that address. 300 emails/day free.

If both are set, Resend wins. Check whichever you chose before relying on it:

```bash
npm run check-mail
```

It authenticates the key, then tells you specifically why recipients would be rejected — an unverified `MAIL_FROM` domain on Resend, or an unconfirmed sender on Brevo.

---

## The problem

Most people leave a concussion assessment with a leaflet and an instruction to rest. What actually determines the next six weeks — how fast to add activity back, whether today's headache means the last step was too big, whether the fogginess is improving or you have just got used to it — happens at home, unmeasured, between appointments.

Two things go wrong in that gap. People do too much, flare, and lose a week. Or they do too little: prolonged rest past the first 24–48 hours is now known to *slow* recovery, and the isolation drives the anxiety and low mood that turn a three-week injury into a three-month one.

Cadence is the instrumentation for that gap.

## What it does

| Module | What happens |
|---|---|
| **Daily check-in** | The 22-item Post-Concussion Symptom Scale from the SCAT, 0–6 each, scored into four validated clusters, plus the day's sleep, screen time, study load, exercise and stress. |
| **Cognitive battery** | Six real timed tasks: simple reaction time, go/no-go, Stroop interference, 2-back working memory scored with *d′*, pointer-based visual tracking, and King–Devick-style rapid number naming. |
| **Oculomotor screen** | A seven-item vestibular/ocular-motor screen with on-screen pacing for pursuits, saccades, VOR and visual motion sensitivity, symptom provocation ratings before and after each, and a near-point-of-convergence measure. |
| **Balance** | Modified Balance Error Scoring System — three 20-second stances with error counting, plus true accelerometer sway measurement on phones. |
| **Return-to-activity** | The Amsterdam 2023 graded strategy as a working engine: 24-hour minimums per step, the mild-and-brief exacerbation rule, automatic step-back after a flare, and full-contact steps locked behind clinician clearance. |
| **Exposure ladder** | Predict how bad an avoided activity will feel, do it, log what it actually cost. Charts the gap between expectation and reality, which is the mechanism graded exposure works by. |
| **Caregiver page** | A printable page for the parent or coach: today in plain words, the emergency signs, what step they are on, what actually helps today, and a glossary of the jargon on their discharge notes. |
| **Mind & mood** | PHQ-2 and GAD-2 screens, emotional and sleep cluster trends, a paced-breathing tool, and a cognitive-reframing journal. Crisis resources are one tap from every screen. |
| **Insights** | Six models, each with a model card. See below. |
| **Clinician report** | One printable page: presentation, symptom burden and trajectory, protocol status, oculomotor and balance findings, cognitive change, risk panel, and a declaration of exactly what kind of data this is. |

## The exposure ladder

After a head injury the thing that holds people back longest is often not the injury. A bad flare teaches you to avoid something, you stop testing it, and the fear never updates because you never collect new evidence.

The ladder makes you write the prediction down first. You pick something you have been avoiding, guess how bad it will feel on a scale of 0 to 10, go and do it, then log what it actually cost. Cadence charts the two lines against each other and reports the gap.

On the sample data that reads: *you are bracing for worse than you get. On 13 of your last 13 attempts the thing was easier than you expected, by 2.2 points on average.* The gap closing toward zero is the measurable version of recovering confidence, and it goes into the clinician report as an expectancy error, because consistent overestimation is the signature of a fear avoidance pattern.

## Caregiver mode

When someone gets a concussion, a parent or a coach becomes a full time carer overnight, and what they get handed is a jargon sheet and "watch for cognitive fatigue". The caregiver page is built for them, not for the patient.

It answers four questions in plain language: how is today going compared to yesterday, what are the signs that mean call an ambulance, what step of the return plan are they on and what does that allow, and what actually helps today. The help list is not generic — the top items are pulled from that person's own trigger findings, deduplicated by topic so a carer never reads the same advice twice in different words. Underneath is a glossary translating the terms that appear on discharge notes: vestibular, oculomotor, convergence, exacerbation, and why "cognitive rest" is advice that has since been reversed.

Print it, copy it into a message, or save it as a file. No account needed on the carer's side, because nothing has to leave the device for a piece of paper to be useful.

## Motion, and knowing when to stop

Screen transitions slide, cards stagger in, onboarding steps move in the direction you are travelling. All of it is gated. With reduced motion on, which is the default here, every animation collapses to a 150 ms cross fade with no movement — feedback is preserved, motion is not. When the tolerance meter reaches its highest band, animation is switched off entirely. An animation an app cannot turn off is an accessibility failure in this population.

## Screen tolerance sensing

The old concussion advice was a dark room until symptoms stop. The current evidence says the opposite — stay engaged, but stay below the level that provokes you. That only works if you can see where your threshold is, and by the time a person notices they are over it, they are already paying for it.

Cadence infers the threshold from how you use the page. Six passive signals, sampled in 20-second windows, each robust-z scored against your own rolling median and MAD:

| Signal | What it measures | Why it moves |
|---|---|---|
| Pointer tortuosity | path length ÷ net displacement | motor noise rises with fatigue and vestibular symptoms |
| Scroll reversals | direction changes per minute | re-reading a line that did not land |
| Correction rate | backspaces ÷ keystrokes | climbs before people notice they are struggling |
| Refocus count | tab leaves and returns | behavioural marker of attentional fatigue |
| Long pauses | gaps over 8 seconds | micro-pauses lengthen as processing slows |
| Dwell | unbroken session minutes | exposure accumulates whether or not you feel it |

A weighted mean of the z scores maps to a 0–100 strain index. Above 56 the interface eases off — larger text, motion off, background flattened. Above 74, sustained for 40 seconds, everything decorative goes and it prompts a break. The daily mean is written to your check-in, so the trigger finder can test it against tomorrow's symptoms like any other behaviour.

It records event timings and geometry only — never keystroke content, never the camera, never the network. It changes nothing until three signals have four baseline samples each, the adaptation is disableable, and the collected baseline is erasable from Settings in one button.

## The models

Everything is implemented from scratch in plain JavaScript — no ML library, no server-side inference, no data leaving the device.

**1. Recovery trajectory.** Symptom resolution after concussion follows an exponential decay. Cadence fits `S(t) = C + A·exp(−t/τ)` to the check-in series with damped Gauss–Newton least squares (Levenberg damping, bounded parameters), then residual-bootstraps 240 refits to produce an 80% band and an interval on "days until under 5 points". It refuses to fit below four check-ins, and reports R² and its own fit quality.

**2. Reliable Change Index.** Every cognitive score is compared to the person's own baseline, divided by the standard error of difference. Below five sessions it uses published test–retest constants; above five it switches to that person's own within-session variability, which is a fairer yardstick and absorbs practice effects. Change is only called real beyond ±1.96.

**3. Persistent-symptom risk panel.** An educational implementation of the 5P predictor set (age, sex, prior prolonged concussion, migraine history, slow answering, tandem-stance errors, headache, noise sensitivity, fatigue), with a logistic link and **every feature's contribution displayed** — separated into fixed characteristics and factors you can act on. The screen states plainly that this is not the validated clinician-administered score.

**4. Off-trend detection.** Each input gets an exponentially weighted forecast from that person's own history; today is scored against it with a median-absolute-deviation z-score, so one bad day cannot inflate the scale. Once twelve complete days exist, a Mahalanobis distance with shrinkage covariance (λ = clamp(d/n, 0.15, 0.8)) watches the joint vector.

**5. Trigger finder.** Rank correlations between behaviour and symptoms at same-day and next-day lags. Both series are **rank-transformed and detrended against day index first**, so the fact that someone is gradually recovering *and* gradually doing more cannot masquerade as cause and effect. Survivors are permutation-tested (1,500 iterations) and corrected with Benjamini–Hochberg at FDR 10%, then filtered again at |ρ| ≥ 0.35.

On the 28-day sample recovery this correctly recovers the one causal effect built into the data (screen time → next-day symptoms, ρ = 0.62, p = 0.001) and correctly rejects the nine confounded or noise associations — including the tempting, backwards "more studying means fewer symptoms" that the undetrended version reports.

**6. Symptom cluster profile.** The revised four-factor structure of the symptom scale, scaled per cluster so a 3-item cluster is not dwarfed by a 9-item one.

## Responsible AI, concretely

Not a checklist — these are enforced in code:

- **Every model has a data gate** and stays silent below it, rather than guessing from three data points.
- **Every model shows uncertainty** — bootstrap bands, reliable-change thresholds, permutation p-values, FDR correction.
- **Every model shows its inputs.** The risk panel displays each feature's contribution; nothing is hidden inside a score.
- **No model diagnoses, clears anyone to play, or predicts a recovery date.** The trajectory is labelled a projection of the person's own curve, not a prognosis.
- **Population limits are stated on the same screen as the score** — the 5P set was derived on children aged 5–17 in emergency departments, and the app says so next to the number.
- **Red flags override everything**, from a button present on every screen.
- **The optional language-model summary** (see below) is constrained by a system prompt that forbids diagnosis, clearance, recovery-date prediction and any suggestion to push through symptoms — and it is sent aggregate numbers only, never journal text.

## Privacy

- Check-ins, test results and journal entries live in the browser's local storage. The analysis runs there too.
- An account stores **an email address and nothing else**. No password to breach, no profile, no analytics, no third-party scripts, no trackers.
- Backup is **end-to-end encrypted**: AES-GCM with a key derived by PBKDF2-SHA256 over 250,000 rounds from a passphrase that never leaves the device. The server stores ciphertext it cannot read.
- Export as JSON or print a report at any time. Erase everything in one tap. Delete the account and its backup from the server in one tap.

## Accessibility

Designed for people who cannot tolerate the average app right now.

- **Reduced motion on by default** — motion sensitivity is one of the most common post-concussive symptoms. The one task that needs motion warns first and can be skipped.
- **A dim, low-blue theme** alongside the warm light one; neither uses pure white or pure black.
- **Read-aloud on every instruction**, because reading itself provokes symptoms for many people.
- **Rest reminders** — the app prompts you to look away, because a recovery app that keeps you on a screen is working against you.
- **Adjustable text size, high-contrast mode, and a wider-spaced readable font.**
- **Every chart has a table view**, direct series labels, and a colour-blind-validated palette (checked with a CVD ΔE validator against both light and dark surfaces).
- Full keyboard navigation, visible focus, labelled control groups, live regions, and a skip link.

## Deploying to Render

`render.yaml` is a Render Blueprint. Point Render at the repo and it builds a Node web service, mounts a 1 GB disk at `/var/data` for the account database, generates `SESSION_SECRET`, and health-checks `/api/health`.

Environment variables:

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC key for session cookies. Generated by the blueprint. |
| `DATA_DIR` | Where the account database lives. `/var/data` on Render. |
| `RESEND_API_KEY` | Optional. Sends real sign-in emails. Without it the app runs in demo mode and shows the code on screen. |
| `MAIL_FROM` | Optional. Sender identity for those emails. |
| `FEATHERLESS_API_KEY` | Optional. Enables the plain-language weekly summary at `POST /api/coach`. |
| `FEATHERLESS_MODEL` | Optional. Defaults to Llama 3.1 8B Instruct. |

To use a custom domain, add it in the Render dashboard and point a CNAME at the service.

On Render's free tier, remove the `disk:` block — accounts will then reset on each deploy. Local health data is unaffected either way, since it never lived on the server.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Liveness, plus whether mail and the model provider are configured. |
| `POST /api/auth/request-code` | Issues a 6-digit code. Rate limited per email and per IP. Only a keyed hash of the code is stored, with a 10-minute expiry. |
| `POST /api/auth/verify` | Verifies in constant time, max 5 attempts, then sets an HttpOnly, SameSite=Lax session cookie. |
| `GET /api/me` · `POST /api/auth/logout` | Session identity and sign-out. |
| `GET/PUT /api/backup` | Stores and returns the encrypted blob. The server never sees a key. |
| `DELETE /api/account` | Removes the account and its backup. |
| `POST /api/coach` | Optional plain-language summary of aggregate numbers, rate limited. |

## Layout

```
server.js              Zero-dependency Node server: static hosting + auth + encrypted backup
render.yaml            Render Blueprint
web/
  index.html
  css/                 tokens · base · components · screens
  js/
    core/              dom, store, api, crypto, charts, derive, seed, speech
    data/              symptom scale, oculomotor items, protocol stages, references
    ml/                stats, trajectory, rci, risk, anomaly, triggers
    screens/           auth, onboarding, today, checkin, cognition, oculomotor,
                       balance, plan, insights, mind, report, settings, science
```

## Sources

Sixteen, listed in full inside the app under **How this works**, each with what it is used for and a link. The load-bearing ones:

- Patricios et al., *BJSM* 2023 — Amsterdam consensus statement; graded return strategies, red flags, the exacerbation rule.
- Zemek et al., *JAMA* 2016 — the 5P risk predictor set.
- Mucha et al., *AJSM* 2014 — VOMS; the seven items, provocation threshold, 6 cm convergence cut-off.
- Lovell & Collins 1998; Kontos et al., *AJSM* 2012 — the symptom scale and its four-factor structure.
- Leddy et al., *JAMA Pediatrics* 2019 — sub-symptom-threshold aerobic exercise.
- Guskiewicz 2003 — the Balance Error Scoring System.
- Jacobson & Truax 1991 — the Reliable Change Index.
- Ledoux et al., *JAMA Pediatrics* 2019 — exponential symptom resolution.
- Benjamini & Hochberg 1995 — false discovery rate control.

## What this is not

Cadence is not a medical device. It cannot diagnose a concussion, tell anyone they have recovered, or clear anyone to return to play. The tests are self-administered on consumer hardware without supervision or a normative population; they track a person against themselves and nothing more. Anyone with a worsening headache, repeated vomiting, a seizure, weakness or numbness, slurred speech, unequal pupils or increasing confusion needs emergency care, not an app.

MIT licensed.
