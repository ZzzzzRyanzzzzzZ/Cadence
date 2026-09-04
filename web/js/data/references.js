(function () {
  const CAD = window.CAD;

  const REFS = [
    { id: "amsterdam", title: "Consensus statement on concussion in sport: the 6th International Conference on Concussion in Sport, Amsterdam, October 2022", authors: "Patricios JS, Schneider KJ, Dvorak J, et al.", source: "British Journal of Sports Medicine 57(11):695–711", year: 2023, used: "Graded return-to-learn and return-to-sport strategies, the 24-hour minimum per step, the mild-and-brief symptom exacerbation rule, and the red-flag list." },
    { id: "zemek", title: "Clinical Risk Score for Persistent Postconcussion Symptoms Among Children With Acute Concussion in the Emergency Department", authors: "Zemek R, Barrowman N, Freedman SB, et al.", source: "JAMA 315(10):1014–1025", year: 2016, used: "The predictor set behind the risk panel: age, sex, prior concussion with symptoms beyond a week, migraine history, slowed answering, tandem-stance errors, headache, noise sensitivity and fatigue." },
    { id: "voms", title: "A brief vestibular/ocular motor screening (VOMS) assessment to evaluate concussions", authors: "Mucha A, Collins MW, Elbin RJ, et al.", source: "American Journal of Sports Medicine 42(10):2479–2486", year: 2014, used: "The seven-item oculomotor and vestibular screen, the 0–10 provocation ratings, the 2-point provocation threshold and the 6 cm near-point-of-convergence cut-off." },
    { id: "leddy", title: "Early subthreshold aerobic exercise for sport-related concussion: a randomized clinical trial", authors: "Leddy JJ, Haider MN, Ellis MJ, et al.", source: "JAMA Pediatrics 173(4):319–325", year: 2019, used: "Sub-symptom-threshold aerobic exercise as an active recovery strategy rather than extended rest." },
    { id: "lovell", title: "Neuropsychological assessment of the college football player (Post-Concussion Symptom Scale)", authors: "Lovell MR, Collins MW", source: "Journal of Head Trauma Rehabilitation 13(2):9–26", year: 1998, used: "The 22-item, 0–6 symptom inventory used for the daily check-in." },
    { id: "kontos", title: "A revised factor structure for the post-concussion symptom scale: baseline and postconcussion factors", authors: "Kontos AP, Elbin RJ, Schatz P, et al.", source: "American Journal of Sports Medicine 40(10):2375–2384", year: 2012, used: "Grouping the 22 symptoms into physical, cognitive, sleep-fatigue and emotional clusters." },
    { id: "kingdevick", title: "The King-Devick test as a determinant of head trauma and concussion in boxers and MMA fighters", authors: "Galetta KM, Barrett J, Allen M, et al.", source: "Neurology 76(17):1456–1462", year: 2011, used: "The rapid number-naming paradigm adapted for the saccadic timing task." },
    { id: "bess", title: "Assessment of postural stability following sport-related concussion", authors: "Guskiewicz KM", source: "Current Sports Medicine Reports 2(1):24–30", year: 2003, used: "The modified Balance Error Scoring System: three 20-second stances, standardised error definitions, 10-error ceiling per stance." },
    { id: "jacobson", title: "Clinical significance: a statistical approach to defining meaningful change in psychotherapy research", authors: "Jacobson NS, Truax P", source: "Journal of Consulting and Clinical Psychology 59(1):12–19", year: 1991, used: "The Reliable Change Index that separates real change on the cognitive tasks from ordinary test-retest noise." },
    { id: "phq2", title: "The Patient Health Questionnaire-2: validity of a two-item depression screener", authors: "Kroenke K, Spitzer RL, Williams JBW", source: "Medical Care 41(11):1284–1292", year: 2003, used: "The two-item depression screen in the mood module." },
    { id: "gad2", title: "Anxiety disorders in primary care: prevalence, impairment, comorbidity, and detection", authors: "Kroenke K, Spitzer RL, Williams JBW, et al.", source: "Annals of Internal Medicine 146(5):317–325", year: 2007, used: "The two-item anxiety screen in the mood module." },
    { id: "iverson", title: "Predictors of clinical recovery from concussion: a systematic review", authors: "Iverson GL, Gardner AJ, Terry DP, et al.", source: "British Journal of Sports Medicine 51(12):941–948", year: 2017, used: "Which baseline and early factors actually carry prognostic weight, and which do not." },
    { id: "ledoux", title: "Natural progression of symptom change and recovery from concussion in a pediatric population", authors: "Ledoux AA, Tang K, Yeates KO, et al.", source: "JAMA Pediatrics 173(1):e183820", year: 2019, used: "The exponential shape of symptom resolution that the trajectory model fits." },
    { id: "master", title: "Vision diagnoses are common after concussion in adolescents", authors: "Master CL, Scheiman M, Gallaway M, et al.", source: "Clinical Pediatrics 55(3):260–267", year: 2016, used: "Why convergence and accommodation deserve their own screen after concussion." },
    { id: "bh", title: "Controlling the false discovery rate: a practical and powerful approach to multiple testing", authors: "Benjamini Y, Hochberg Y", source: "Journal of the Royal Statistical Society B 57(1):289–300", year: 1995, used: "False-discovery-rate correction so the trigger finder does not hand you a coincidence." },
    { id: "schneider", title: "Cervicovestibular rehabilitation in sport-related concussion: a randomised controlled trial", authors: "Schneider KJ, Meeuwisse WH, Nettel-Aguirre A, et al.", source: "British Journal of Sports Medicine 48(17):1294–1298", year: 2014, used: "Why persistent oculomotor and cervical findings are referred on rather than trained away alone." }
  ];

  function url(ref) {
    return "https://pubmed.ncbi.nlm.nih.gov/?term=" + encodeURIComponent(ref.title);
  }

  function byId(id) { return REFS.find((r) => r.id === id); }

  function cite(id) {
    const r = byId(id);
    if (!r) return null;
    return CAD.h("a", { href: url(r), target: "_blank", rel: "noopener noreferrer", class: "tiny", style: { color: "var(--ink-3)" } },
      r.authors.split(",")[0] + " et al., " + r.year);
  }

  CAD.refs = { REFS, url, byId, cite };
})();
