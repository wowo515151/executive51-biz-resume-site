"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const site = path.resolve(__dirname, "..", "site");
const read = (name) => fs.readFileSync(path.join(site, name), "utf8");
require("../site/gridpull.js");
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
  assert.equal(fs.readdirSync(site).some((name) => /^(?:SiteHealthCanada|SiteNovaScotia)\.html$/.test(name)), false, "withheld providers are not shipped");
});

test("all public graph pages declare a time axis and numeric measures", () => {
  const pages = ["SiteStatisticsCanada.html", "SiteDonneesQuebec.html"].flatMap((name) => [...read(name).matchAll(/href="(Data[^\"]+\.html)"/g)].map((match) => match[1]));
  assert.deepEqual(pages, activePages);
  for (const name of activePages) {
    const html = read(name);
    for (const marker of ["data-site=", "data-dataset=", "data-dataset-description", "grid-graph data-time-series=\"true\"", "data-time-field=", "graph-ad-panel", "data-load-dataset", "<footer"]) assert.ok(html.includes(marker), `${name} includes ${marker}`);
    assert.match(html, /data-graphable-y="[A-Za-z0-9_,]+"/);
    const expectedTypes = name === "DataQuebecPopulationProjections.html"
      ? "line,bar,area,scatter,heatmap"
      : "line,bar,area,scatter,heatmap,scatter3d";
    assert.ok(html.includes(`data-graph-types="${expectedTypes}"`), `${name} exposes only chart choices supported by its time cadence`);
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
  assert.equal(/href="graph\.html"/.test(read("index.html")), false, "homepage does not link to the graph section before review and visual verification");
  assert.match(read("index.html"), /Interactive views of selected Canadian public data are coming soon\./, "homepage accurately describes graph availability to visitors");
  assert.doesNotMatch(read("index.html"), /Browse public datasets from Statistics Canada, Health Canada, and Données Québec/, "homepage does not imply unavailable provider coverage");
  assert.equal(/href="Data[^\"]+\.html"/.test(read("index.html")), false, "homepage does not link directly to dataset pages");
  assert.equal(/graph\.html/.test(read("site-nav.js")), false, "shared navigation remains free of a graph link");
});

test("withheld cross-sectional and unverified pages and loader routes are absent", () => {
  const graphData = read("graph-data.js");
  const loader = read("gridpull.js");
  const component = read("GridGraph.c389cb0.js");
  assert.ok(graphData.includes("This page is disabled because its dataset does not meet the reviewed time-series requirements."));
  assert.ok(loader.includes("Only reviewed time-series datasets can be graphed"));
  assert.ok(loader.includes("isTimeSeriesTable(table"));
  assert.ok(component.includes('this.getAttribute("data-time-series") !== "true"'));
  assert.ok(component.includes("TIME_SERIES_TYPES"));
  const expectedFiles = new Set([...activePages, "SiteStatisticsCanada.html", "SiteDonneesQuebec.html"]);
  const dataAndProviderPages = fs.readdirSync(site).filter((file) => /^(?:Data|Site).*\.html$/.test(file));
  assert.deepEqual(dataAndProviderPages.sort(), [...expectedFiles].sort(), "only reviewed providers and datasets ship");
  for (const [siteId, datasetId] of [["healthcanada", "gouda"], ["quebec", "municipalities"], ["quebec", "finances"], ["novaScotia", "ozone"], ["toronto", "indicators"]]) {
  assert.throws(() => global.Gridpull.getInfo(siteId, datasetId), /Unknown data provider|Unknown dataset/, `${siteId}/${datasetId} has no public loader route`);
  }
  assert.ok(fs.existsSync(path.resolve(site, "..", "archive", "withheld-graph-routes-20261121", "gridpull-before-route-cleanup.js")), "the retired route definitions are preserved outside the upload folder");
});

test("GridGraph exposes only suitable time-series modes and documents safe dimensional encodings", () => {
  const graphComponent = read("GridGraph.c389cb0.js");
  for (const mode of ["line", "bar", "area", "scatter", "pie", "heatmap", "scatter3d"]) assert.ok(graphComponent.includes(`"${mode}"`), `GridGraph supports ${mode} when declared`);
  assert.ok(graphComponent.includes("const TIME_SERIES_TYPES = TYPES"));
  assert.ok(graphComponent.includes('data-pie-additive-period-totals'), "pie requires explicit additive period-total semantics");
  assert.ok(graphComponent.includes('data-comparable-y') && graphComponent.includes('data-stackable-y'), "multi-measure comparisons and stacking require dataset declarations");
  assert.ok(graphComponent.includes("createTemporalHeatmapTrace"), "heatmap maps only observed regular calendar periods");
  assert.ok(graphComponent.includes("createTemporal3DTrace"), "3D calendar scatter uses actual temporal dimensions");
  assert.ok(graphComponent.includes("no values or series are interpolated"));
  assert.ok(graphComponent.includes('setAttribute("aria-label", "Start date")'));
  assert.ok(graphComponent.includes('setAttribute("aria-label", "End date")'));
  assert.ok(graphComponent.includes('this._plot.setAttribute("role", "region")'), "interactive chart contents remain exposed to assistive technology");
  assert.ok(graphComponent.includes('this._plot.setAttribute("aria-label", "Interactive graph")'), "chart region has an accessible name before data loads");
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
