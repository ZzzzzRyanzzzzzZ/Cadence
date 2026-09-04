(function () {
  const CAD = window.CAD;

  const B0 = -2.30;
  const B1 = 0.285;

  function latestCheckin(state) {
    return state.checkins.length ? state.checkins[state.checkins.length - 1] : null;
  }
  function latestBalance(state) {
    return state.balanceRuns.length ? state.balanceRuns[state.balanceRuns.length - 1] : null;
  }

  function assess(state) {
    const p = state.profile;
    const c = latestCheckin(state);
    const b = latestBalance(state);
    const gaps = [];
    const features = [];

    let agePoints = 0;
    if (p.ageBand === "13-17") agePoints = 2;
    else if (p.ageBand === "8-12") agePoints = 1;
    else if (p.ageBand === "18-25") agePoints = 1;
    else if (p.ageBand === "26+") agePoints = 0;
    else gaps.push("age band");
    features.push({ id: "age", label: "Age band", points: agePoints, max: 2, modifiable: false, detail: p.ageBand || "not set", why: "Adolescents recover more slowly than younger children and adults in the cohorts this score came from." });

    const femalePoints = p.sexAtBirth === "female" ? 2 : 0;
    if (!p.sexAtBirth) gaps.push("sex at birth");
    features.push({ id: "sex", label: "Sex at birth", points: femalePoints, max: 2, modifiable: false, detail: p.sexAtBirth || "not set", why: "Female sex was one of the strongest predictors of persistent symptoms in the derivation cohort." });

    const priorPoints = p.priorProlonged ? 1 : 0;
    features.push({ id: "prior", label: "Prior concussion lasting over a week", points: priorPoints, max: 1, modifiable: false, detail: p.priorProlonged ? "yes" : "no", why: "A previous slow recovery is the best single predictor of another one." });

    const migrainePoints = p.migraineHistory ? 1 : 0;
    features.push({ id: "migraine", label: "Migraine history", points: migrainePoints, max: 1, modifiable: false, detail: p.migraineHistory ? "yes" : "no", why: "Pre-existing migraine shares mechanisms with post-traumatic headache." });

    const slowPoints = p.answeredSlowly ? 1 : 0;
    features.push({ id: "slow", label: "Answered questions slowly at assessment", points: slowPoints, max: 1, modifiable: false, detail: p.answeredSlowly ? "yes" : "no", why: "An observed sign of slowed processing at the time of injury." });

    let tandemPoints = 0;
    if (b && isFinite(b.tandem)) tandemPoints = b.tandem >= 4 ? 1 : 0;
    else gaps.push("balance test");
    features.push({ id: "tandem", label: "Tandem stance errors (4 or more)", points: tandemPoints, max: 1, modifiable: true, detail: b && isFinite(b.tandem) ? b.tandem + " errors" : "not tested", why: "Postural control errors index vestibular and cerebellar involvement." });

    let headachePoints = 0, noisePoints = 0, fatiguePoints = 0;
    if (c) {
      headachePoints = (c.pcss.headache || 0) > 0 ? 1 : 0;
      noisePoints = (c.pcss.noise || 0) > 0 ? 1 : 0;
      fatiguePoints = (c.pcss.fatigue || 0) > 0 ? 2 : 0;
    } else gaps.push("symptom check-in");
    features.push({ id: "headache", label: "Headache present", points: headachePoints, max: 1, modifiable: true, detail: c ? (c.pcss.headache || 0) + "/6" : "no check-in", why: "Current headache is the highest-frequency persistent symptom." });
    features.push({ id: "noise", label: "Sensitivity to noise", points: noisePoints, max: 1, modifiable: true, detail: c ? (c.pcss.noise || 0) + "/6" : "no check-in", why: "Sensory hypersensitivity tracks with slower symptom resolution." });
    features.push({ id: "fatigue", label: "Fatigue", points: fatiguePoints, max: 2, modifiable: true, detail: c ? (c.pcss.fatigue || 0) + "/6" : "no check-in", why: "Fatigue carried the heaviest weight of the symptom items in the original model." });

    const score = features.reduce((s, f) => s + f.points, 0);
    const maxScore = features.reduce((s, f) => s + f.max, 0);
    const probability = 1 / (1 + Math.exp(-(B0 + B1 * score)));

    let band, tone;
    if (score <= 3) { band = "Lower"; tone = "good"; }
    else if (score <= 8) { band = "Intermediate"; tone = "warning"; }
    else { band = "Higher"; tone = "serious"; }

    const drivers = features.filter((f) => f.points > 0).sort((a, b2) => b2.points - a.points);
    const modifiable = drivers.filter((f) => f.modifiable);

    return {
      score, maxScore, probability, band, tone, features, drivers, modifiable, gaps,
      complete: gaps.length === 0,
      confidence: gaps.length === 0 ? "complete inputs" : gaps.length <= 2 ? "partial inputs" : "sparse inputs"
    };
  }

  CAD.risk = { assess };
})();
