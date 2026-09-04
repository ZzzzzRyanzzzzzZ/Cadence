window.CAD = window.CAD || {};

(function () {
  const CAD = window.CAD;
  const SVG_NS = "http://www.w3.org/2000/svg";

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    if (props && (typeof props !== "object" || Array.isArray(props) || props instanceof Node)) {
      kids.unshift(props);
      props = null;
    }
    if (props) {
      for (const key in props) {
        const val = props[key];
        if (val === null || val === undefined || val === false) continue;
        if (key === "class") node.className = val;
        else if (key === "html") node.innerHTML = val;
        else if (key === "text") node.textContent = val;
        else if (key === "style" && typeof val === "object") Object.assign(node.style, val);
        else if (key === "dataset") Object.assign(node.dataset, val);
        else if (key.startsWith("on") && typeof val === "function") node.addEventListener(key.slice(2).toLowerCase(), val);
        else if (key in node && key !== "list" && typeof val !== "object") {
          try { node[key] = val; } catch (e) { node.setAttribute(key, val); }
        } else node.setAttribute(key, val === true ? "" : val);
      }
    }
    append(node, kids);
    return node;
  }

  function append(node, kids) {
    for (const kid of kids) {
      if (kid === null || kid === undefined || kid === false) continue;
      if (Array.isArray(kid)) append(node, kid);
      else if (kid instanceof Node) node.appendChild(kid);
      else node.appendChild(document.createTextNode(String(kid)));
    }
  }

  function frag(...kids) {
    const f = document.createDocumentFragment();
    append(f, kids);
    return f;
  }

  const PATHS = {
    today: "M12 3v2M4.2 6.2l1.4 1.4M3 14h2M19 14h2M18.4 7.6l1.4-1.4M8.5 19h7M9.5 22h5M8 16a5.5 5.5 0 1 1 8 0z",
    checkin: "M9 4h6a1 1 0 0 1 1 1v1h2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2V5a1 1 0 0 1 1-1zM9 13l2 2 4-4",
    mind: "M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z",
    cognition: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8A3 3 0 0 0 8 18a3 3 0 0 0 4 1.7V4.5A2.5 2.5 0 0 0 9 4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8A3 3 0 0 1 16 18a3 3 0 0 1-4 1.7",
    eye: "M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12zM12 14.6A2.6 2.6 0 1 0 12 9.4a2.6 2.6 0 0 0 0 5.2z",
    balance: "M12 3v18M5 21h14M12 7l-7 6a4 4 0 0 0 7 0zM12 7l7 6a4 4 0 0 1-7 0z",
    plan: "M4 20V9l5-4 5 4v11M14 20V13h6v7M7 12h2M7 16h2",
    insights: "M4 19V5M4 19h16M8 16l3.5-5 3 3L20 7",
    report: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
    settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5l1.8 1.1-2 3.4-2.1-.7a7.6 7.6 0 0 1-1.8 1l-.4 2.2h-4l-.4-2.2a7.6 7.6 0 0 1-1.8-1l-2.1.7-2-3.4 1.8-1.1a7.4 7.4 0 0 1 0-2.1L4.6 10.5l2-3.4 2.1.7a7.6 7.6 0 0 1 1.8-1l.4-2.2h4l.4 2.2c.64.26 1.24.6 1.8 1l2.1-.7 2 3.4-1.8 1.1a7.4 7.4 0 0 1 0 2.1z",
    science: "M9 3h6M10 3v6.2L5.4 18A2 2 0 0 0 7.2 21h9.6a2 2 0 0 0 1.8-3L14 9.2V3M8.2 14h7.6",
    more: "M6 12h.01M12 12h.01M18 12h.01",
    check: "M4.5 12.5l5 5 10-11",
    alert: "M12 8v5M12 16.5v.01M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
    arrow: "M5 12h14M13 6l6 6-6 6",
    download: "M12 4v11M7.5 11 12 15.5 16.5 11M5 19h14",
    print: "M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z",
    play: "M8 5.5 19 12 8 18.5z",
    refresh: "M20 11a8 8 0 1 0-.6 4M20 5v6h-6",
    info: "M12 11v6M12 7.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
    trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6",
    shield: "M12 3l7.5 3v5.4c0 4.5-3.1 8.3-7.5 9.6-4.4-1.3-7.5-5.1-7.5-9.6V6z",
    clock: "M12 7v5.2l3.2 1.9M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    flag: "M6 3v18M6 4h11l-2.6 4.2L17 12.5H6",
    heart: "M12 20s-7-4.4-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7 2.8C19 15.6 12 20 12 20z",
    plus: "M12 5v14M5 12h14",
    x: "M6 6l12 12M18 6 6 18",
    pause: "M9 5v14M15 5v14",
    speaker: "M5 9.5h3l4-3.5v12l-4-3.5H5zM16 9.4a3.6 3.6 0 0 1 0 5.2M18.6 6.8a7.2 7.2 0 0 1 0 10.4",
    lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
    trend: "M4 17l5.5-6 3.5 3.4L20 7M20 7h-4.5M20 7v4.5"
  };

  function icon(name, size) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    if (size) { svg.setAttribute("width", size); svg.setAttribute("height", size); }
    svg.style.fill = "none";
    svg.style.stroke = "currentColor";
    svg.style.strokeWidth = "1.8";
    svg.style.strokeLinecap = "round";
    svg.style.strokeLinejoin = "round";
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", PATHS[name] || PATHS.info);
    svg.appendChild(p);
    return svg;
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined) continue;
      node.setAttribute(k, attrs[k]);
    }
    return node;
  }

  let toastTimer = null;
  function toast(message, ms) {
    const root = document.getElementById("toastRoot");
    const node = h("div", { class: "toast" }, message);
    root.appendChild(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.remove(); }, ms || 3200);
  }

  let lastFocus = null;
  function modal(opts) {
    const root = document.getElementById("modalRoot");
    root.innerHTML = "";
    root.hidden = false;
    lastFocus = document.activeElement;
    const box = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Dialog" });
    if (opts.title) box.appendChild(h("h2", { style: { marginBottom: "10px" } }, opts.title));
    if (opts.body) box.appendChild(opts.body);
    if (opts.actions) box.appendChild(h("div", { class: "row row--end", style: { marginTop: "24px" } }, opts.actions));
    root.appendChild(box);
    const focusable = box.querySelector("button, a[href], input, select, textarea");
    if (focusable) focusable.focus(); else box.focus();
    root.onclick = (e) => { if (e.target === root && opts.dismissible !== false) closeModal(); };
    document.addEventListener("keydown", escHandler);
    return box;
  }

  function escHandler(e) {
    if (e.key === "Escape") closeModal();
    if (e.key === "Tab") {
      const root = document.getElementById("modalRoot");
      if (root.hidden) return;
      const items = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function closeModal() {
    const root = document.getElementById("modalRoot");
    root.hidden = true;
    root.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  const DAY = 86400000;

  const fmt = {
    dayKey(d) {
      const dt = d ? new Date(d) : new Date();
      return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    },
    fromKey(key) {
      const [y, m, d] = key.split("-").map(Number);
      return new Date(y, m - 1, d);
    },
    daysBetween(a, b) {
      const A = fmt.fromKey(fmt.dayKey(a)).getTime();
      const B = fmt.fromKey(fmt.dayKey(b)).getTime();
      return Math.round((B - A) / DAY);
    },
    shortDate(d) {
      return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    },
    longDate(d) {
      return new Date(d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    },
    time(d) {
      return new Date(d).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    },
    ms(v) {
      if (v === null || v === undefined || !isFinite(v)) return "—";
      return Math.round(v) + " ms";
    },
    n(v, digits) {
      if (v === null || v === undefined || !isFinite(v)) return "—";
      const d = digits === undefined ? 1 : digits;
      return Number(v).toFixed(d).replace(/\.0+$/, d ? "" : "");
    },
    pct(v, digits) {
      if (v === null || v === undefined || !isFinite(v)) return "—";
      return (v * 100).toFixed(digits === undefined ? 0 : digits) + "%";
    },
    plural(n, one, many) {
      return n + " " + (n === 1 ? one : (many || one + "s"));
    },
    signed(v, digits) {
      if (!isFinite(v)) return "—";
      const s = Number(v).toFixed(digits === undefined ? 1 : digits);
      return (v > 0 ? "+" : "") + s;
    }
  };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

  Object.assign(CAD, { h, frag, icon, svgEl, toast, modal, closeModal, fmt, clamp, uid, shuffle, sleep, DAY, SVG_NS });
})();
