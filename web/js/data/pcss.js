(function () {
  const CAD = window.CAD;

  const SYMPTOMS = [
    { id: "headache", label: "Headache", cluster: "somatic" },
    { id: "pressure", label: "Pressure in head", cluster: "somatic" },
    { id: "neck", label: "Neck pain", cluster: "somatic" },
    { id: "nausea", label: "Nausea or vomiting", cluster: "somatic" },
    { id: "dizzy", label: "Dizziness", cluster: "somatic" },
    { id: "blurred", label: "Blurred vision", cluster: "somatic" },
    { id: "balance", label: "Balance problems", cluster: "somatic" },
    { id: "light", label: "Sensitivity to light", cluster: "somatic" },
    { id: "noise", label: "Sensitivity to noise", cluster: "somatic" },
    { id: "slowed", label: "Feeling slowed down", cluster: "cognitive" },
    { id: "fog", label: "Feeling like in a fog", cluster: "cognitive" },
    { id: "notright", label: "Don't feel right", cluster: "cognitive" },
    { id: "concentrate", label: "Difficulty concentrating", cluster: "cognitive" },
    { id: "remember", label: "Difficulty remembering", cluster: "cognitive" },
    { id: "confusion", label: "Confusion", cluster: "cognitive" },
    { id: "fatigue", label: "Fatigue or low energy", cluster: "sleep" },
    { id: "drowsy", label: "Drowsiness", cluster: "sleep" },
    { id: "sleeponset", label: "Trouble falling asleep", cluster: "sleep" },
    { id: "emotional", label: "More emotional than usual", cluster: "emotional" },
    { id: "irritable", label: "Irritability", cluster: "emotional" },
    { id: "sad", label: "Sadness", cluster: "emotional" },
    { id: "anxious", label: "Nervous or anxious", cluster: "emotional" }
  ];

  const CLUSTERS = {
    somatic: { label: "Physical", full: "Physical / vestibular-ocular", color: "var(--series-1)" },
    cognitive: { label: "Cognitive", full: "Cognitive / fogginess", color: "var(--series-2)" },
    sleep: { label: "Sleep", full: "Sleep & fatigue", color: "var(--series-3)" },
    emotional: { label: "Emotional", full: "Emotional / affective", color: "var(--series-4)" }
  };

  const SEVERITY = ["None", "Mild", "Mild", "Moderate", "Moderate", "Severe", "Severe"];

  const RED_FLAGS = [
    { id: "neckpain", label: "Neck pain or tenderness", note: "Possible cervical spine injury — do not move the person." },
    { id: "double", label: "Double vision", note: "New double vision after head injury needs urgent assessment." },
    { id: "weakness", label: "Weakness, numbness, tingling or burning in arms or legs", note: "Possible spinal cord or neurological involvement." },
    { id: "worsening", label: "Severe or increasing headache", note: "A headache that keeps getting worse can signal bleeding in or around the brain." },
    { id: "seizure", label: "Seizure or convulsion", note: "Call emergency services now." },
    { id: "loc", label: "Loss of consciousness", note: "Any loss of consciousness needs medical evaluation." },
    { id: "deteriorating", label: "Getting more confused, or hard to wake up", note: "A deteriorating level of consciousness is an emergency." },
    { id: "vomiting", label: "Repeated vomiting", note: "More than one episode of vomiting after head injury is a red flag." },
    { id: "agitated", label: "Increasingly restless, agitated or combative", note: "A sudden behaviour change is a red flag." },
    { id: "slurred", label: "Slurred speech", note: "New speech changes need urgent assessment." },
    { id: "pupil", label: "One pupil larger than the other", note: "Call emergency services now." }
  ];

  const PHQ2 = [
    { id: "phq1", label: "Little interest or pleasure in doing things" },
    { id: "phq2", label: "Feeling down, depressed, or hopeless" }
  ];
  const GAD2 = [
    { id: "gad1", label: "Feeling nervous, anxious, or on edge" },
    { id: "gad2", label: "Not being able to stop or control worrying" }
  ];
  const FREQ_SCALE = ["Not at all", "Several days", "More than half the days", "Nearly every day"];

  function scorePcss(values) {
    const clusters = { somatic: 0, cognitive: 0, sleep: 0, emotional: 0 };
    const counts = { somatic: 0, cognitive: 0, sleep: 0, emotional: 0 };
    let total = 0, count = 0;
    SYMPTOMS.forEach((sym) => {
      const v = Number(values[sym.id] || 0);
      total += v;
      if (v > 0) { count++; counts[sym.cluster]++; }
      clusters[sym.cluster] += v;
    });
    return { total, count, clusters, counts };
  }

  function severityBand(total) {
    if (total === 0) return { key: "good", label: "Symptom free", tone: "good" };
    if (total <= 12) return { key: "low", label: "Low burden", tone: "good" };
    if (total <= 30) return { key: "moderate", label: "Moderate burden", tone: "warning" };
    if (total <= 60) return { key: "high", label: "High burden", tone: "serious" };
    return { key: "veryhigh", label: "Very high burden", tone: "critical" };
  }

  CAD.pcss = { SYMPTOMS, CLUSTERS, SEVERITY, RED_FLAGS, PHQ2, GAD2, FREQ_SCALE, scorePcss, severityBand };
})();
