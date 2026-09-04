(function () {
  const CAD = window.CAD;

  const PROVOKED = [
    { id: "headache", label: "Headache" },
    { id: "dizziness", label: "Dizziness" },
    { id: "nausea", label: "Nausea" },
    { id: "fogginess", label: "Fogginess" }
  ];

  const ITEMS = [
    {
      id: "pursuit",
      name: "Smooth pursuit",
      system: "Ocular motor",
      seconds: 12,
      guide: "target",
      instructions: "Hold your head still. Follow the moving dot with your eyes only, keeping it in focus. Two slow passes left-to-right, then two up-and-down.",
      why: "Smooth pursuit asks the frontal and parietal eye fields plus the cerebellum to keep a moving image on the fovea. It is one of the systems most often disrupted after concussion."
    },
    {
      id: "saccade_h",
      name: "Horizontal saccades",
      system: "Ocular motor",
      seconds: 12,
      guide: "flip-h",
      instructions: "Hold your head still. Move your eyes quickly between the two dots, left and right, as each one lights up. Ten round trips.",
      why: "Rapid gaze shifts test saccadic accuracy and latency, driven by the superior colliculus and frontal eye fields."
    },
    {
      id: "saccade_v",
      name: "Vertical saccades",
      system: "Ocular motor",
      seconds: 12,
      guide: "flip-v",
      instructions: "Hold your head still. Move your eyes quickly between the top and bottom dots as each lights up. Ten round trips.",
      why: "Vertical saccades load a partly separate brainstem circuit (riMLF) and often provoke symptoms when horizontal saccades do not."
    },
    {
      id: "convergence",
      name: "Near point of convergence",
      system: "Ocular motor",
      seconds: 0,
      guide: "npc",
      instructions: "Hold a small printed letter at arm's length. Slowly bring it toward the tip of your nose. Stop when it becomes two images, or when your helper sees an eye drift outward. Measure the distance from your nose in centimetres. Repeat three times and enter the average.",
      why: "Convergence insufficiency is one of the most common and most persistent post-concussive vision findings. A near point of convergence of 6 cm or more is the usual cut-off for abnormal."
    },
    {
      id: "vor_h",
      name: "Vestibulo-ocular reflex — horizontal",
      system: "Vestibular",
      seconds: 12,
      guide: "metronome",
      instructions: "Keep your eyes fixed on the still dot. Turn your head left and right in time with the beat, about 20 degrees each way. Ten round trips. Stop if you feel unsteady.",
      why: "The VOR keeps vision stable while the head moves. It is a fast brainstem reflex, and gain errors after concussion produce blurred vision and dizziness with everyday head motion."
    },
    {
      id: "vor_v",
      name: "Vestibulo-ocular reflex — vertical",
      system: "Vestibular",
      seconds: 12,
      guide: "metronome",
      instructions: "Keep your eyes fixed on the still dot. Nod your head up and down in time with the beat, about 20 degrees each way. Ten round trips. Sit down for this one.",
      why: "Vertical VOR loads the anterior and posterior canals and is a frequent trigger of post-concussive dizziness."
    },
    {
      id: "vms",
      name: "Visual motion sensitivity",
      system: "Vestibular",
      seconds: 12,
      guide: "optokinetic",
      instructions: "Look at the moving pattern with your whole visual field. Turn your head and body together with the motion, slowly. Five round trips. Stop early if symptoms rise sharply.",
      why: "Visual motion sensitivity reflects how well the brain re-weights vestibular against visual input. High scores predict longer recovery and respond well to graded habituation."
    }
  ];

  const PROVOCATION_THRESHOLD = 2;
  const NPC_ABNORMAL_CM = 6;

  function scoreRun(run) {
    const base = run.baseline || {};
    let flaggedItems = 0;
    let maxDelta = 0;
    const perItem = [];
    ITEMS.forEach((item) => {
      const after = (run.items || {})[item.id];
      if (!after) return;
      let delta = 0;
      PROVOKED.forEach((p) => {
        delta = Math.max(delta, Number(after[p.id] || 0) - Number(base[p.id] || 0));
      });
      const flagged = delta >= PROVOCATION_THRESHOLD;
      if (flagged) flaggedItems++;
      maxDelta = Math.max(maxDelta, delta);
      perItem.push({ id: item.id, name: item.name, delta, flagged });
    });
    const npcFlag = run.npcCm !== null && run.npcCm !== undefined && Number(run.npcCm) >= NPC_ABNORMAL_CM;
    if (npcFlag) flaggedItems++;
    return { flaggedItems, maxDelta, perItem, npcFlag, npcCm: run.npcCm };
  }

  CAD.oculo = { ITEMS, PROVOKED, PROVOCATION_THRESHOLD, NPC_ABNORMAL_CM, scoreRun };
})();
