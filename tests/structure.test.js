"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const site = path.resolve(__dirname, "..", "site");
const read = (name) => fs.readFileSync(path.join(site, name), "utf8");
const activePages = ["DataPopulationEstimates.html", "DataLabourForce.html", "DataConsumerPrices.html", "DataQuebecPopulationProjections.html"];

test("graph directory links only providers with reviewed time-series datasets", () => {
  const graph = read("graph.html");
  assert.deepEqual([...graph.matchAll(/href="(Site[^\"]+\.html)"/g)].map((match) => match[1]), ["SiteStatisticsCanada.html", "SiteDonneesQuebec.html"]);
  for (const [provider, expectedPages] of [["SiteStatisticsCanada.html", activePages.slice(0, 3)], ["SiteDonneesQuebec.html", [activePages[3]]]]) {
    const html = read(provider);
    const links = [...html.matchAll(/href="(Data[^\"]+\.html)"/g)].map((match) => match[1]);
    assert.deepEqual(links, expectedPages, `${provider} lists only eligible time-series pages`);
    for (const name of links) {
      const dataPage = read(name);
      const description = dataPage.match(/<p class="graph-description" data-dataset-description>(.*?)<\/p>/)?.[1];
      assert.ok(description && html.includes(description), `${provider} includes ${name}'s page description`);
      assert.match(dataPage, /data-dataset-source href="https:\/\//, `${name} links to its official source`);
    }
  }
  assert.equal(read("SiteHealthCanada.html").includes("href=\"Data"), false, "cross-sectional Health Canada records are not navigable graph pages");
});

test("all public graph pages declare a time axis and numeric measures", () => {
  const pages = ["SiteStatisticsCanada.html", "SiteDonneesQuebec.html"].flatMap((name) => [...read(name).matchAll(/href="(Data[^\"]+\.html)"/g)].map((match) => match[1]));
  assert.deepEqual(pages, activePages);
  for (const name of activePages) {
    const html = read(name);
    for (const marker of ["data-site=", "data-dataset=", "data-dataset-description", "grid-graph data-time-series=\"true\"", "data-time-field=", "graph-ad-panel", "data-load-dataset", "<footer"]) assert.ok(html.includes(marker), `${name} includes ${marker}`);
    assert.match(html, /data-graphable-y="[A-Za-z0-9_,]+"/);
    assert.match(html, /data-graph-types="line,bar,area,scatter"/, `${name} exposes only time-series chart choices`);
    assert.match(html, /data-default-type="line"/, `${name} defaults to a line chart`);
    assert.match(html, /GridGraph\.[a-f0-9]{7}\.js/, `${name} uses the revised versioned graph component`);
    assert.match(html, /gridpull\.js\?v=timeseries-20261121/, `${name} cache-busts the strict loader`);
    assert.match(html, /graph-data\.js\?v=timeseries-20261121/, `${name} cache-busts the page controller`);
  }
  const projection = read("DataQuebecPopulationProjections.html");
  assert.match(projection, /data-time-field="Annee"/);
  assert.match(projection, /data-required-filters="NiveauGeographique,Territoire,TypeDonnees,Sexe"/);
  assert.match(projection, /estimates for 2001–2025 and projections for 2026–2051/i, "the source description distinguishes estimates from projections");
  assert.match(read("DataPopulationEstimates.html"), /data-time-field="Reference period"/);
  assert.equal(/href="Data[^\"]+\.html"/.test(read("index.html")), false, "homepage does not link directly to dataset pages");
  assert.equal(/graph\.html/.test(read("site-nav.js")), false, "shared navigation remains free of a graph link");
});

test("cross-sectional direct pages and loader paths are disabled", () => {
  const graphData = read("graph-data.js");
  const loader = read("gridpull.js");
  const component = read("GridGraph.d2f01c3.js");
  assert.ok(graphData.includes("This page is disabled because its dataset does not meet the reviewed time-series requirements."));
  assert.ok(loader.includes("Only reviewed time-series datasets can be graphed"));
  assert.ok(loader.includes("isTimeSeriesTable(table"));
  assert.ok(component.includes('this.getAttribute("data-time-series") !== "true"'));
  assert.ok(component.includes("TIME_SERIES_TYPES"));
  for (const name of fs.readdirSync(site).filter((file) => /^Data.*\.html$/.test(file) && !activePages.includes(file))) {
    assert.match(read(name), /gridpull\.js\?v=timeseries-20261121/);
    assert.match(read(name), /graph-data\.js\?v=timeseries-20261121/);
  }
});

test("GridGraph retains seven implementations while exposing only time-series options", () => {
  const graphComponent = read("GridGraph.d2f01c3.js");
  for (const mode of ["line", "bar", "area", "scatter", "pie", "heatmap", "surface3d"]) assert.ok(graphComponent.includes(`"${mode}"`), `GridGraph retains ${mode}`);
  assert.ok(graphComponent.includes('const TIME_SERIES_TYPES = ["line", "bar", "area", "scatter"]'));
  assert.ok(graphComponent.includes('setAttribute("aria-label", "Start date")'));
  assert.ok(graphComponent.includes('setAttribute("aria-label", "End date")'));
  assert.ok(graphComponent.includes("createTimeSeriesTraces"), "GridGraph supports multiple numeric time-series traces");
  assert.ok(graphComponent.includes("safePlotlyText(columns[index])"), "provider field names are escaped before reaching Plotly");
  assert.ok(graphComponent.includes('this._resize = () => schedulePlotResize(this)'));
  assert.equal(graphComponent.includes("this._resize = () => this.draw()"), false);
});

test("Azure deployment pins checkout immutably and does not persist its token", () => {
  const workflow = fs.readFileSync(path.resolve(site, "..", ".github", "workflows", "azure-static-web-apps.yml"), "utf8");
  assert.match(workflow, /uses: actions\/checkout@[a-f0-9]{40}/, "checkout uses a full commit SHA");
  assert.match(workflow, /persist-credentials: false/, "the deployment job does not retain the checkout token");
});