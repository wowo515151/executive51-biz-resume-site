"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const site = path.resolve(__dirname, "..", "site");

test("managed AI directory preserves all providers and source evidence in the shared site shell", () => {
  const html = fs.readFileSync(path.join(site, "alberta-managed-ai-companies.html"), "utf8");
  const cards = [...html.matchAll(/<article class="directory-card managed-company-card" id="(company-[^"]+)" data-regions="[^"]+" data-model="(?:managed|implementation_support)" data-capabilities="[^"]+">/g)];
  assert.equal(cards.length, 100, "all 100 provider cards are present with filter metadata");
  assert.equal(new Set(cards.map((match) => match[1])).size, 100, "provider IDs remain unique");
  assert.equal((html.match(/<details class="directory-sources">/g) || []).length, 100, "each provider retains expandable source and scope evidence");
  assert.match(html, /78 providers with managed-operation evidence/);
  assert.match(html, /22 with implementation and ongoing-support evidence/);
  assert.match(html, /<site-nav current="managed-ai"><\/site-nav>/);
  assert.match(html, /<site-ad class="site-ad-slot managed-directory-top-ad"><\/site-ad>\s*<ol class="directory-list managed-company-list"/);
  assert.match(html, /<site-ad class="site-ad-slot"><\/site-ad>/);
  assert.equal((html.match(/<site-ad class="site-ad-slot/g) || []).length, 2, "the shared ad appears near the list and at the page end");
  assert.equal((html.match(/site-ad\.js/g) || []).length, 1);
  const scriptSources = [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/g)].map((match) => match[1]);
  assert.deepEqual(scriptSources, ["site-nav.js", "site-ad.js", "managed-ai-directory.js"]);
  assert.match(html, /href="site\.css"/);
  assert.match(html, /href="managed-ai-directory\.css"/);
  assert.match(html, /src="assets\/Executive51-420\.jpg"/);
  assert.ok(fs.existsSync(path.join(site, "assets", "Executive51-420.jpg")), "the directory hero uses a shared local image");
  assert.doesNotMatch(html, /alberta-managed-ai-assets\/|https:\/\/executive51\.biz\/site-ad\.js|save-company|compare-dialog|shortlist-bar/);
  const schema = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(schema, "the page retains its structured metadata");
  assert.equal(JSON.parse(schema)["@graph"].find((item) => item["@type"] === "ItemList").numberOfItems, 100);
  const homepage = fs.readFileSync(path.join(site, "index.html"), "utf8");
  const albertaPanel = homepage.match(/<section class="resume-section section-tinted" id="alberta-companies"[\s\S]*?<\/section>/)?.[0];
  assert.ok(albertaPanel, "the existing Alberta companies panel remains on the homepage");
  assert.match(albertaPanel, /href="alberta-managed-ai-companies\.html">Browse managed AI companies<\/a>/);
  const navigation = fs.readFileSync(path.join(site, "site-nav.js"), "utf8");
  assert.match(navigation, /\["managed-ai", "alberta-managed-ai-companies\.html", "Managed AI"\]/);
});

test("managed AI filters work locally and leave all listings available", () => {
  class Control {
    constructor() { this.value = ""; this.textContent = ""; this.listeners = {}; this.options = []; this.focused = false; }
    addEventListener(type, handler) { this.listeners[type] = handler; }
    append(option) { this.options.push(option); }
    focus() { this.focused = true; }
  }
  const makeCard = (regions, capabilities, model, text) => ({
    dataset: { regions, capabilities, model }, textContent: text, parentElement: { hidden: false }
  });
  const cards = [
    makeCard("Calgary", "Agents & workflows", "managed", "Alpha Calgary agents"),
    makeCard("Edmonton region", "Data & knowledge", "implementation_support", "Beta Edmonton data"),
    makeCard("Other Alberta", "Agents & workflows|Data & knowledge", "managed", "Gamma Red Deer workflow")
  ];
  const list = { querySelectorAll: () => cards };
  const controls = Object.fromEntries(["company-search", "region-filter", "capability-filter", "model-filter", "result-count", "clear-filters", "print-directory"].map((id) => [id, new Control()]));
  const document = {
    querySelector: () => list,
    getElementById: (id) => controls[id],
    createElement: () => ({ value: "", textContent: "" })
  };
  let printCalls = 0;
  vm.runInNewContext(fs.readFileSync(path.join(site, "managed-ai-directory.js"), "utf8"), { document, window: { print: () => printCalls += 1 } });

  assert.equal(controls["result-count"].textContent, "Showing 3 of 3 providers.");
  assert.deepEqual(controls["region-filter"].options.map((option) => option.value), ["Calgary", "Edmonton region", "Other Alberta"]);
  controls["company-search"].value = "edmonton";
  controls["company-search"].listeners.input();
  assert.deepEqual(cards.map((card) => card.parentElement.hidden), [true, false, true]);
  controls["company-search"].value = "";
  controls["region-filter"].value = "Calgary";
  controls["model-filter"].value = "managed";
  controls["region-filter"].listeners.change();
  assert.deepEqual(cards.map((card) => card.parentElement.hidden), [false, true, true]);
  controls["clear-filters"].listeners.click();
  assert.deepEqual(cards.map((card) => card.parentElement.hidden), [false, false, false]);
  assert.equal(controls["company-search"].focused, true);
  controls["print-directory"].listeners.click();
  assert.equal(printCalls, 1);
});
