const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const site = path.join(root, "site");
const managerPath = path.join(site, "site-backgrounds.js");
const manager = fs.readFileSync(managerPath, "utf8");

function defaultForProfile(profile) {
  const document = {
    readyState: "loading",
    documentElement: {dataset: {}},
    addEventListener() {}
  };
  const context = {
    document,
    window: {},
    navigator: {hardwareConcurrency: profile.cores, deviceMemory: profile.memory},
    screen: {width: profile.width},
    innerWidth: profile.width,
    matchMedia: () => ({matches: profile.coarsePointer}),
  };
  vm.runInNewContext(manager, context, {filename: managerPath, timeout: 1000});
  return context.window.SiteBackgroundDefaultForProfile(profile);
}

test("background defaults favor phones and low-end devices", () => {
  assert.equal(defaultForProfile({width: 390, coarsePointer: false, cores: 8, memory: 8}), "particle-constellation");
  assert.equal(defaultForProfile({width: 800, coarsePointer: true, cores: 8, memory: 8}), "particle-constellation");
  assert.equal(defaultForProfile({width: 1440, coarsePointer: false, cores: 4, memory: 8}), "particle-constellation");
  assert.equal(defaultForProfile({width: 1440, coarsePointer: false, cores: 8, memory: 4}), "particle-constellation");
  assert.equal(defaultForProfile({width: 1440, coarsePointer: false, cores: 8, memory: 8}), "fluid-ink");
  assert.equal(defaultForProfile({width: 1440, coarsePointer: false, cores: 8, memory: 0}), "fluid-ink");
  assert.equal(defaultForProfile({width: 1440, coarsePointer: false, cores: 0, memory: 8}), "particle-constellation");
  assert.equal(defaultForProfile({width: 1440, coarsePointer: false, cores: 0, memory: 0}), "particle-constellation");
});

test("the shared picker includes every pack effect and local dependency", () => {
  const block = manager.match(/const choices = \[([\s\S]*?)\n  \];/)?.[1];
  assert.ok(block, "choice list is present");
  const labels = [...block.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(match => [match[1], match[2]]);
  assert.deepEqual(labels, [
    ["particle-constellation", "Particle constellation"], ["fluid-ink", "Fluid ink"],
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
  assert.doesNotMatch(block, /crystal/i, "removed Crystal choice is not exposed");
});

test("all site HTML stays on the shared navigation and stylesheet", () => {
  const pages = fs.readdirSync(site).filter(file => file.endsWith(".html"));
  assert.equal(pages.length, 17);
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
  assert.doesNotMatch(css, /background-image: url\("assets\/large2\.png"\)/);
});
