(function () {
  const CAD = window.CAD;

  const TRACKS = {
    learn: {
      label: "Return to learn",
      short: "school / work",
      stages: [
        { n: 1, title: "Daily activities that don't provoke symptoms", detail: "Reading, texting, screen time in short blocks. Start with about 5–15 minutes and stop before symptoms climb.", goal: "Gradual return to typical activities." },
        { n: 2, title: "School or work activities at home", detail: "Homework, reading or planning outside the classroom. Keep sessions short with real breaks between them.", goal: "Increase tolerance to cognitive work." },
        { n: 3, title: "Part-time return, with supports", detail: "Partial days or a reduced load. Ask for extended deadlines, quieter rooms, reduced screen brightness and rest breaks.", goal: "Increase academic activities." },
        { n: 4, title: "Full return", detail: "Full days without accommodations, then catching up on missed work.", goal: "Return to full academic or work activities." }
      ]
    },
    sport: {
      label: "Return to sport",
      short: "training / play",
      stages: [
        { n: 1, title: "Symptom-limited activity", detail: "Daily activities that do not more than mildly provoke symptoms. Walking is fine.", goal: "Gradual reintroduction of activity." },
        { n: 2, title: "Light aerobic exercise", detail: "Walking or stationary cycling at a slow to medium pace, 10–15 minutes. No resistance training.", goal: "Increase heart rate below the symptom threshold." },
        { n: 3, title: "Sport-specific exercise", detail: "Running or skating drills in one plane. No head-impact activities. Light resistance training may start.", goal: "Add movement." },
        { n: 4, title: "Non-contact training drills", detail: "Harder training drills such as passing drills, plus progressive resistance training.", goal: "Exercise, coordination and increased thinking." },
        { n: 5, title: "Full-contact practice", detail: "Requires medical clearance first. Normal training activities.", goal: "Restore confidence and let coaching staff assess skills.", requiresClearance: true },
        { n: 6, title: "Return to sport", detail: "Normal game play.", goal: "Full return." }
      ]
    }
  };

  const MIN_STAGE_HOURS = 24;
  const EXACERBATION_LIMIT = 2;

  function currentStage(protocol) {
    const track = TRACKS[protocol.track] || TRACKS.learn;
    return track.stages[Math.min(track.stages.length, Math.max(1, protocol.stage)) - 1];
  }

  function hoursInStage(protocol) {
    if (!protocol.stageStartedAt) return 0;
    return (Date.now() - protocol.stageStartedAt) / 3600000;
  }

  function readiness(state) {
    const p = state.protocol;
    const track = TRACKS[p.track] || TRACKS.learn;
    const stage = currentStage(p);
    const hrs = hoursInStage(p);
    const reasons = [];
    let ready = true;

    if (hrs < MIN_STAGE_HOURS) {
      ready = false;
      reasons.push({
        ok: false,
        text: "At least 24 hours at this step — " + Math.floor(hrs) + " h so far.",
        detail: "Each step of the graded strategy takes a minimum of 24 hours."
      });
    } else {
      reasons.push({ ok: true, text: "24 hours completed at this step (" + Math.floor(hrs) + " h).", detail: "" });
    }

    const recent = state.checkins.slice(-2);
    if (!recent.length) {
      ready = false;
      reasons.push({ ok: false, text: "No symptom check-in logged yet.", detail: "Progression decisions need a recent symptom score." });
    } else {
      const latest = recent[recent.length - 1];
      const prev = recent.length > 1 ? recent[recent.length - 2] : null;
      const rise = prev ? latest.total - prev.total : 0;
      if (prev && rise > EXACERBATION_LIMIT * 2) {
        ready = false;
        reasons.push({ ok: false, text: "Symptom score rose by " + rise + " points since your last check-in.", detail: "A clear symptom flare means holding at this step, or stepping back for 24 hours." });
      } else {
        reasons.push({ ok: true, text: prev ? "Symptoms stable or improving since the last check-in." : "First check-in logged.", detail: "" });
      }
      if (latest.exacerbation !== undefined && latest.exacerbation > EXACERBATION_LIMIT) {
        ready = false;
        reasons.push({ ok: false, text: "Activity pushed symptoms up by more than 2 points yesterday.", detail: "Mild and brief symptom increase (up to 2 points) is acceptable. More than that means the step was too big." });
      }
    }

    if (stage.requiresClearance && !state.profile.seenClinician) {
      ready = false;
      reasons.push({ ok: false, text: "Medical clearance is required before full-contact practice.", detail: "Mark clinician clearance in Settings once you have it." });
    }

    if (p.stage >= track.stages.length) {
      ready = false;
      reasons.push({ ok: true, text: "You are at the final step of this strategy.", detail: "" });
    }

    return { ready, reasons, stage, track, hoursInStage: hrs };
  }

  function advance(state) {
    const track = TRACKS[state.protocol.track] || TRACKS.learn;
    if (state.protocol.stage >= track.stages.length) return false;
    state.protocol.stage += 1;
    state.protocol.stageStartedAt = Date.now();
    state.protocol.history.push({ ts: Date.now(), stage: state.protocol.stage, event: "advanced", track: state.protocol.track });
    return true;
  }

  function regress(state, reason) {
    if (state.protocol.stage <= 1) {
      state.protocol.stageStartedAt = Date.now();
      state.protocol.history.push({ ts: Date.now(), stage: 1, event: "held", track: state.protocol.track, reason: reason || "" });
      return false;
    }
    state.protocol.stage -= 1;
    state.protocol.stageStartedAt = Date.now();
    state.protocol.history.push({ ts: Date.now(), stage: state.protocol.stage, event: "stepped back", track: state.protocol.track, reason: reason || "" });
    return true;
  }

  CAD.protocol = { TRACKS, MIN_STAGE_HOURS, EXACERBATION_LIMIT, currentStage, hoursInStage, readiness, advance, regress };
})();
