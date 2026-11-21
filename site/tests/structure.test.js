"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const site = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(site, name), "utf8");

test("graph entry links reviewed provider pages, each with three unique data pages", () => {
  const graph = read("graph.html");
  const providers = ["SiteStatisticsCanada.html", "SiteHealthCanada.html", "SiteTorontoOpenData.html"];
  for (const provider of providers) {
    assert.ok(graph.includes(`href="${provider}"`), `graph.html links ${provider}`);
    const html = read(provider);
    const links = [...html.matchAll(/href="(Data[^"]+\.html)"/g)].map((match) => match[1]);
    assert.equal(links.length, 3, `${provider} has three dataset links`);
    assert.equal(new Set(links).size, 3, `${provider} links are unique`);
    for (const link of links) {
      assert.ok(fs.existsSync(path.join(site, link)), `${provider} target ${link} exists`);
      const dataPage = read(link);
      const description = dataPage.match(/<p class="graph-description" data-dataset-description>(.*?)<\/p>/)?.[1];
      assert.ok(description && html.includes(description), `${provider} includes ${link}'s dataset description`);
      assert.match(dataPage, /data-dataset-source href="https:\/\//, `${link} links to its official source`);
      assert.match(dataPage, /<a class="graph-source-link" data-dataset-source href="https:\/\/[^\"]+" rel="noopener noreferrer">[^<]+<\/a>(?:\s*<a class="graph-source-link" href="https:\/\/[^\"]+" rel="noopener noreferrer">[^<]+<\/a>)?<p class="(?:graph-note|graph-attribution)">/, `${link} closes its source links before attribution`);
    }
  }
});

test("nine selected DataPages include the shared graph panel structure and no homepage link", () => {
  const pages = fs.readdirSync(site).filter((name) => /^Data.*\.html$/.test(name));
  assert.equal(pages.length, 9);
  for (const name of pages) {
    const html = read(name);
    for (const marker of ["data-site=", "data-dataset=", "data-dataset-description", "grid-graph", "graph-ad-panel", "data-load-dataset", "<footer"]) {
      assert.ok(html.includes(marker), `${name} includes ${marker}`);
    }
    if (html.includes('data-site="healthcanada"')) {
      assert.ok(html.includes("https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109"), `${name} links the official Health Canada CNF record`);
    }
  }
  assert.ok(read("SiteHealthCanada.html").includes("https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109"), "Health Canada SitePage links the official CNF record");
  const graphComponent = read("GridGraph.js");
  for (const mode of ["bar", "line", "area", "scatter", "pie", "heatmap", "surface3d"]) assert.ok(graphComponent.includes(`"${mode}"`), `GridGraph exposes ${mode}`);
  assert.equal(read("index.html").includes("graph.html"), false, "existing homepage remains unlinked until review");
  assert.equal(/\bgraph\.html\b/.test(read("site-nav.js")), false, "shared navigation remains free of a graph link");
});
