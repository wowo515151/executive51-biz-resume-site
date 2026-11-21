const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const site = path.join(root, "site");
const managerPath = path.join(site, "site-backgrounds.js");
const manager = fs.readFileSync(managerPath, "utf8");

function bootBackground({stored = null, reducedMotion = true, width = 1440, cores = 8, memory = 8} = {}) {
  const listeners = {};
  const selects = [];
  const nav = {querySelector: () => null, append() {}};
  const makeElement = tag => ({
    tagName: tag,
    children: [],
    dataset: {},
    append(child) { this.children.push(child); },
    setAttribute() {},
    addEventListener(type, callback) { this[`on${type}`] = callback; },
    replaceChildren(...children) { this.children = children; }
  });
  const document = {
    readyState: "loading",
    documentElement: {dataset: {}},
    body: {dataset: {}, prepend(layer) { this.layer = layer; }},
    head: {append() {}},
    hidden: false,
    addEventListener(type, callback) { listeners[type] = callback; },
    querySelectorAll(selector) {
      if (selector === ".primary-nav, .graph-toolbar") return [nav];
      if (selector === ".background-picker select") return selects;
      return [];
    },
    createElement(tag) {
      const element = makeElement(tag);
      if (tag === "select") selects.push(element);
      return element;
    },
    createTextNode: text => ({text})
  };
  const saved = {value: stored};
  const context = {
    document,
    window: {},
    navigator: {hardwareConcurrency: cores, deviceMemory: memory},
    screen: {width},
    innerWidth: width,
    localStorage: {
      getItem() { return saved.value; },
      setItem(_key, value) { saved.value = value; }
    },
    matchMedia(query) { return {matches: query.includes("prefers-reduced-motion") && reducedMotion, addEventListener() {}}; }
  };
  vm.runInNewContext(manager, context, {filename: managerPath, timeout: 1000});
  listeners.DOMContentLoaded();
  return {document, selects, saved};
}

test("particle constellation is the shared default on every device profile", () => {
  for (const profile of [
    {width: 390, cores: 8, memory: 8},
    {width: 800, cores: 4, memory: 4},
    {width: 1440, cores: 16, memory: 16},
    {width: 1440, cores: 0, memory: 0}
  ]) {
    const {document, selects, saved} = bootBackground(profile);
    assert.equal(document.documentElement.dataset.backgroundDefault, "particle-constellation");
    assert.equal(document.body.dataset.background, "particle-constellation");
    assert.equal(selects[0].value, "particle-constellation");
    assert.equal(saved.value, "particle-constellation");
  }
});

test("saved Crystal choice and artwork survive the default update", () => {
  const {document, selects, saved} = bootBackground({stored: "crystal"});
  assert.equal(document.body.dataset.background, "crystal");
  assert.equal(selects[0].value, "crystal");
  assert.equal(saved.value, "crystal");
  const css = fs.readFileSync(path.join(site, "site.css"), "utf8");
  assert.match(css, /body\[data-background="crystal"\][^{]*\{[^}]*background-image: url\("assets\/large2\.png"\)/);
});

test("the shared picker includes every pack effect and local dependency", () => {
  const block = manager.match(/const choices = \[([\s\S]*?)\n  \];/)?.[1];
  assert.ok(block, "choice list is present");
  const labels = [...block.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(labels, [
    ["particle-constellation", "Particle constellation"], ["crystal", "Crystal artwork"],
    ["fluid-ink", "Fluid ink"],
    ["vanta-net", "Vanta Net"], ["vanta-waves", "Vanta Waves"], ["vanta-globe", "Vanta Globe"],
    ["vanta-dots", "Vanta Dots"], ["vanta-rings", "Vanta Rings"], ["vanta-halo", "Vanta Halo"],
    ["gradient-drift", "Gradient drift"], ["canvas-nest", "Canvas nest"],
    ["polygon-surface", "Polygon surface"], ["star-nest", "Star Nest"],
    ["procedural-ocean", "Procedural Ocean"], ["topologica", "Topologica"], ["none", "No background"]
  ]);
  for (const asset of [
    "particles.js", "fluid.js", "vendor/three.r134.min.js", "vanta.net.js", "vanta.waves.js",
    "vanta.globe.js", "vanta.dots.js", "vanta.rings.js", "vanta.halo.js", "granim.js",
    "canvas-nest.js", "fss.js", "shader-runtime.js", "star-nest.js", "procedural-ocean.js", "topologica.js"
  ]) assert.ok(fs.existsSync(path.join(site, "backgrounds", asset)), `missing ${asset}`);
  assert.match(manager, /canvas = makeCanvas\(\)/, "each effect transition receives a fresh canvas");
  assert.match(manager, /value === "crystal" \|\| reducedMotion\.matches/, "Crystal remains selectable without starting an effect engine");
});

test("all site HTML stays on the shared navigation and stylesheet", () => {
  const pages = fs.readdirSync(site).filter(file => file.endsWith(".html"));
  for (const page of ["SiteStatisticsCanada.html", "SiteDonneesQuebec.html", "DataPopulationEstimates.html", "DataLabourForce.html", "DataConsumerPrices.html", "DataQuebecPopulationProjections.html"]) assert.ok(pages.includes(page), `${page} is included in the site HTML review`);
  assert.equal(pages.some((page) => /NovaScotia|CNFApple|CNFSalmon|CNFNutrientAmounts|QuebecMunicipal/.test(page)), false, "withheld datasets are outside the site upload folder");
  for (const page of pages) {
    const html = fs.readFileSync(path.join(site, page), "utf8");
    assert.match(html, /site-nav\.js/, `${page} imports the shared navigation`);
    assert.match(html, /site\.css/, `${page} imports shared styles`);
  }
});

test("shared and graph content panes retain alpha transparency", () => {
  const css = fs.readFileSync(path.join(site, "site.css"), "utf8");
  const graphCss = fs.readFileSync(path.join(site, "graph.css"), "utf8");
  const graphComponent = fs.readFileSync(path.join(site, "GridGraph.c254e31.js"), "utf8");
  assert.match(css, /--pane: rgba\(250, 253, 255, \.91\)/);
  assert.match(graphCss, /rgba\(250,253,255,\.91\)/);
  assert.match(graphComponent, /background:rgba\(255,255,255,\.91\)/);
  assert.match(css, /body\[data-background="crystal"\].*background-image: url\("assets\/large2\.png"\)/);
  assert.match(css, /body\[data-background\]:not\(\[data-background="none"\]\):not\(\[data-background="crystal"\]\)/);
});
