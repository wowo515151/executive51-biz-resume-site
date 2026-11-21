/* Shared optional backgrounds for Executive51 pages. */
(() => {
  const choices = [
    ["crystal", "Crystal artwork"],
    ["particle-constellation", "Particle constellation"],
    ["gradient-drift", "Gradient drift"],
    ["canvas-nest", "Canvas nest"],
    ["polygon-surface", "Polygon surface"],
    ["none", "No background"]
  ];
  const pickerMarkup = () => {
    const label = document.createElement("label");
    label.className = "background-picker";
    label.append(document.createTextNode("Backgrounds"));
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Backgrounds");
    choices.forEach(([value, title]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = title;
      select.append(option);
    });
    label.append(select);
    return {label, select};
  };

  const init = () => {
    document.querySelectorAll(".primary-nav, .graph-toolbar").forEach(nav => {
      if (nav.querySelector(".background-picker")) return;
      const {label, select} = pickerMarkup();
      nav.append(label);
      select.addEventListener("change", () => choose(select.value));
    });

    const layer = document.createElement("div");
    layer.id = "background";
    layer.className = "site-background";
    layer.setAttribute("aria-hidden", "true");
    document.body.prepend(layer);
    const canvas = document.createElement("canvas");
    canvas.id = "effect-canvas";
    layer.append(canvas);

    let selected = "crystal";
    try { selected = localStorage.getItem("executive51-background") || selected; } catch (_) {}
    if (!choices.some(([value]) => value === selected)) selected = "crystal";
    document.querySelectorAll(".background-picker select").forEach(select => { select.value = selected; });
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let active = null;
    let loading = null;
    const scriptLoads = new Map();
    const scripts = {
      "particle-constellation": ["particles.js"],
      "gradient-drift": ["granim.js"],
      "canvas-nest": ["canvas-nest.js"],
      "polygon-surface": ["fss.js"]
    };
    const load = file => {
      if (scriptLoads.has(file)) return scriptLoads.get(file);
      const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `backgrounds/${file}`;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Could not load ${file}`));
        document.head.append(script);
      });
      scriptLoads.set(file, promise);
      return promise;
    };
    const stop = () => {
      if (active) active.destroy();
      active = null;
      layer.replaceChildren(canvas);
      canvas.width = canvas.width;
    };
    const syncMotion = () => {
      if (!active) return;
      if (document.hidden || reducedMotion.matches) active.pause();
      else active.resume();
    };
    const choose = value => {
      if (!choices.some(([key]) => key === value)) return;
      selected = value;
      document.body.dataset.background = value;
      try { localStorage.setItem("executive51-background", value); } catch (_) {}
      document.querySelectorAll(".background-picker select").forEach(select => { select.value = value; });
      stop();
      if (!scripts[value] || reducedMotion.matches) return;
      loading = (async () => {
        for (const file of scripts[value]) await load(file);
        await load("background-runtime.js");
        if (selected !== value) return;
        try {
          active = BGPack.start(value, {target: layer, canvas});
          syncMotion();
        } catch (_) {
          document.body.dataset.background = "none";
        }
      })();
      loading.catch(() => { if (selected === value) document.body.dataset.background = "none"; });
    };
    document.addEventListener("visibilitychange", syncMotion);
    reducedMotion.addEventListener?.("change", () => choose(selected));
    document.body.dataset.background = selected;
    if (selected !== "crystal" && selected !== "none") choose(selected);
    else if (selected === "none") choose(selected);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true});
  else init();
})();
