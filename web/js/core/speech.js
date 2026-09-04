(function () {
  const CAD = window.CAD;
  const supported = typeof window.speechSynthesis !== "undefined";

  function enabled() {
    return supported && CAD.store.get().settings.speech;
  }

  function speak(text) {
    if (!enabled() || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.rate = 0.95;
      u.pitch = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function stop() {
    if (supported) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  function readButton(getText) {
    if (!supported) return null;
    return CAD.h("button", {
      class: "btn btn--ghost btn--sm",
      title: "Read this aloud",
      onclick: () => {
        const t = typeof getText === "function" ? getText() : getText;
        if (!CAD.store.get().settings.speech) {
          CAD.store.set("settings.speech", true);
          CAD.toast("Read-aloud turned on.");
        }
        speak(t);
      }
    }, CAD.icon("speaker"), "Listen");
  }

  CAD.speech = { supported, speak, stop, readButton, enabled };
})();
