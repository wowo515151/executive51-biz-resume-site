/* Shared lazy background picker for every Executive51 page. */
(() => {
  const choices = [
    ["particle-constellation", "Particle constellation"],
    ["fluid-ink", "Fluid ink"],
    ["vanta-net", "Vanta Net"],
    ["vanta-waves", "Vanta Waves"],
    ["vanta-globe", "Vanta Globe"],
    ["vanta-dots", "Vanta Dots"],
    ["vanta-rings", "Vanta Rings"],
    ["vanta-halo", "Vanta Halo"],
    ["gradient-drift", "Gradient drift"],
    ["canvas-nest", "Canvas nest"],
    ["polygon-surface", "Polygon surface"],
    ["star-nest", "Star Nest"],
    ["procedural-ocean", "Procedural Ocean"],
    ["topologica", "Topologica"],
    ["none", "No background"]
  ];
  const effects = {
    "particle-constellation": ["particles.js"],
    "fluid-ink": ["fluid.js"],
    "vanta-net": ["vendor/three.r134.min.js", "vanta.net.js"],
    "vanta-waves": ["vendor/three.r134.min.js", "vanta.waves.js"],
    "vanta-globe": ["vendor/three.r134.min.js", "vanta.globe.js"],
    "vanta-dots": ["vendor/three.r134.min.js", "vanta.dots.js"],
    "vanta-rings": ["vendor/three.r134.min.js", "vanta.rings.js"],
    "vanta-halo": ["vendor/three.r134.min.js", "vanta.halo.js"],
    "gradient-drift": ["granim.js"],
    "canvas-nest": ["canvas-nest.js"],
    "polygon-surface": ["fss.js"],
    "star-nest": ["shader-runtime.js", "star-nest.js"],
    "procedural-ocean": ["shader-runtime.js", "procedural-ocean.js"],
    "topologica": ["shader-runtime.js", "topologica.js"]
  };
  const isChoice = value => choices.some(([key]) => key === value);
  const defaultForProfile = ({width, coarsePointer, cores, memory}) => {
    if (width <= 600 || (width <= 820 && coarsePointer)) return "particle-constellation";
    if ((cores > 0 && cores <= 4) || (memory > 0 && memory <= 4)) return "particle-constellation";
    return "fluid-ink";
  };
  const profile = () => ({
    width: Math.min(innerWidth || 0, screen.width || innerWidth || 0),
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    cores: Number(navigator.hardwareConcurrency) || 0,
    memory: Number(navigator.deviceMemory) || 0
  });
  const defaultChoice = defaultForProfile(profile());
  document.documentElement.dataset.backgroundDefault = defaultChoice;
  // Keep the pure heuristic inspectable for device-profile QA.
  window.SiteBackgroundDefaultForProfile = defaultForProfile;

  const init = () => {
    document.querySelectorAll(".primary-nav, .graph-toolbar").forEach(nav => {
      if (nav.querySelector(".background-picker")) return;
      const label = document.createElement("label");
      label.className = "background-picker";
      label.append(document.createTextNode("Backgrounds"));
      const select = document.createElement("select");
      select.setAttribute("aria-label", "Backgrounds");
      for (const [value, title] of choices) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = title;
        select.append(option);
      }
      label.append(select);
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

    let stored = null;
    try { stored = localStorage.getItem("executive51-background"); } catch (_) {}
    // Migrate the removed Crystal option and invalid values to the device default.
    let selected = stored && stored !== "crystal" && isChoice(stored) ? stored : defaultChoice;
    const persist = value => { try { localStorage.setItem("executive51-background", value); } catch (_) {} };
    if (selected !== stored) persist(selected);

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let active = null;
    let generation = 0;
    let changing = false;
    const scriptLoads = new Map();
    const load = (file, repeat = false) => {
      if (!repeat && scriptLoads.has(file)) return scriptLoads.get(file);
      const promise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.async = false;
        script.src = `backgrounds/${file}`;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Could not load ${file}`));
        document.head.append(script);
      });
      if (!repeat) scriptLoads.set(file, promise);
      promise.catch(() => scriptLoads.delete(file));
      return promise;
    };
    const syncPicker = () => document.querySelectorAll(".background-picker select").forEach(select => {
      select.value = selected;
      select.disabled = changing;
    });
    const stop = () => {
      try { active?.destroy(); } catch (_) {}
      active = null;
      layer.replaceChildren(canvas);
      canvas.width = canvas.width;
    };
    const syncMotion = () => {
      if (!active) return;
      if (document.hidden || reducedMotion.matches) active.pause();
      else active.resume();
    };
    const activate = async (value, token) => {
      const files = effects[value] || [];
      for (const file of files) {
        await load(file, file === "fluid.js");
        if (token !== generation && value !== "fluid-ink") return;
      }
      await load("background-runtime.js");
      if (token !== generation) {
        if (value === "fluid-ink" && window.BGPack) {
          try { window.BGPack.start(value, {target: layer, canvas}).destroy(); } catch (_) {}
        }
        return;
      }
      active = window.BGPack.start(value, {target: layer, canvas});
      syncMotion();
    };
    function choose(value, save = true) {
      if (!isChoice(value)) return;
      selected = value;
      generation++;
      if (save) persist(value);
      document.body.dataset.background = value;
      stop();
      if (value === "none" || reducedMotion.matches) {
        changing = false;
        syncPicker();
        return;
      }
      const token = generation;
      changing = true;
      syncPicker();
      activate(value, token).catch(() => {
        if (token === generation) {
          document.body.dataset.background = "none";
          selected = "none";
          persist(selected);
        }
      }).finally(() => {
        if (token === generation) {
          changing = false;
          syncPicker();
        }
      });
    }
    document.addEventListener("visibilitychange", syncMotion);
    reducedMotion.addEventListener?.("change", () => {
      if (reducedMotion.matches) {
        generation++;
        changing = false;
        stop();
        syncPicker();
      }
      else choose(selected, false);
    });
    syncPicker();
    document.body.dataset.background = selected;
    if (selected !== "none" && !reducedMotion.matches) choose(selected, false);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once: true});
  else init();
})();
