"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const site = path.resolve(__dirname, "..", "site");
const read = (name) => fs.readFileSync(path.join(site, name), "utf8");

test("graph entry links reviewed provider pages, each with eligible unique data pages", () => {
  const graph = read("graph.html");
  const providers = ["SiteStatisticsCanada.html", "SiteHealthCanada.html", "SiteDonneesQuebec.html"];
  for (const provider of providers) {
    assert.ok(graph.includes(`href="${provider}"`), `graph.html links ${provider}`);
    const html = read(provider);
    const links = [...html.matchAll(/href="(Data[^"]+\.html)"/g)].map((match) => match[1]);
    const expectedLinks = 3;
    assert.equal(links.length, expectedLinks, `${provider} lists only graphable datasets`);
    assert.equal(new Set(links).size, expectedLinks, `${provider} links are unique`);
    for (const link of links) {
      assert.ok(fs.existsSync(path.join(site, link)), `${provider} target ${link} exists`);
      const dataPage = read(link);
      const description = dataPage.match(/<p class="graph-description" data-dataset-description>(.*?)<\/p>/)?.[1];
      assert.ok(description && html.includes(description), `${provider} includes ${link}'s dataset description`);
      assert.match(dataPage, /data-dataset-source href="https:\/\//, `${link} links to its official source`);
      assert.match(dataPage, /<a class="graph-source-link" data-dataset-source href="https:\/\/[^\"]+" rel="noopener noreferrer">[^<]+<\/a>(?:\s*<a class="graph-source-link" href="https:\/\/[^\"]+" rel="noopener noreferrer">[^<]+<\/a>){0,2}<p class="(?:graph-note|graph-attribution)">/, `${link} closes its source links before attribution`);
    }
  }
});

test("nine graphable DataPages use shared panels and the homepage links only to the graph entry", () => {
  const providers = ["SiteStatisticsCanada.html", "SiteHealthCanada.html", "SiteDonneesQuebec.html"];
  const pages = providers.flatMap((provider) => [...read(provider).matchAll(/href="(Data[^"]+\.html)"/g)].map((match) => match[1]));
  assert.equal(new Set(pages).size, 9, "selected providers link nine graphable datasets");
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
  assert.ok(read("DataCNFNutrientAmounts.html").includes("https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientname/?lang=en&amp;type=json"), "nutrient graph links the official unit definitions it joins");
  const graphComponent = read("GridGraph.c254e31.js");
  assert.ok(graphComponent.includes("graphableNumericIndexes"), "the graph component admits only explicitly approved numeric measures");
  assert.ok(graphComponent.includes('getAttribute("data-graphable-y")'), "the measure whitelist is set per dataset");
  for (const mode of ["bar", "line", "area", "scatter", "pie", "heatmap", "surface3d"]) assert.ok(graphComponent.includes(`"${mode}"`), `GridGraph exposes ${mode}`);
  assert.match(graphComponent, /const TYPES = \["line", "bar"/, "Line precedes Bar in the graph mode selector");
  for (const page of ["DataPopulationEstimates.html", "DataLabourForce.html", "DataConsumerPrices.html"]) {
    assert.match(read(page), /<grid-graph data-time-series="true"[^>]*data-graphable-y="Value"/, `${page} enables graphable two-column time-series controls`);
  }
  assert.ok(graphComponent.includes('setAttribute("aria-label", "Start date")'), "time-series ranges expose an accessible start date");
  assert.ok(graphComponent.includes('setAttribute("aria-label", "End date")'), "time-series ranges expose an accessible end date");
  assert.ok(read("DataPopulationEstimates.html").includes('data-default-type="line"'), "time-series graphs default to Line");
  assert.match(read("DataPopulationEstimates.html"), /data-time-series="true"[^>]*data-graph-types="line,bar,area,scatter"/, "time-series charts expose sequential chart types only");
  assert.match(read("DataQuebecMunicipalPopulation.html"), /data-graph-types="bar"/, "municipality categories expose categorical bar charts only");
  assert.ok(graphComponent.includes("categories may not be continuous and measures may not share units"), "3D surfaces explain categorical and unit interpretation limits");
  assert.ok(graphComponent.includes("Dense x-axis labels are sampled and shortened; hover for full category names"), "dense 3D axes disclose shortened labels and full hover names");
  assert.ok(graphComponent.includes("Area mode stacks selected measures cumulatively"), "stacked area charts disclose cumulative behavior and unit limits");
  assert.ok(graphComponent.includes("Pie charts cannot represent negative values"), "pie charts explain when values cannot be represented faithfully");
  assert.match(read("index.html"), /href="graph\.html">Explore data graphs/, "homepage exposes the reviewed graph entry");
  assert.equal(/href="Data[^\"]+\.html"/.test(read("index.html")), false, "homepage does not link directly to dataset pages");
  assert.equal(/\bgraph\.html\b/.test(read("site-nav.js")), false, "shared navigation remains free of a graph link");
});

test("GridGraph exposes accessible field selectors and avoids defaulting to identifier-like measures", () => {
  const graphComponent = read("GridGraph.c254e31.js");
  assert.ok(graphComponent.includes('aria-label", "Category or X axis"'), "the category axis selector has an accessible label");
  assert.ok(graphComponent.includes('className = "series"'), "numeric series choices are grouped accessibly");
  assert.ok(graphComponent.includes("const MEASURE_HINT"), "identifier-like numeric columns are not selected by default");
  assert.ok(graphComponent.includes('this._resize = () => schedulePlotResize(this)'), "container changes schedule a Plotly resize without rebuilding traces");
  assert.equal(graphComponent.includes("this._resize = () => this.draw()"), false, "container changes do not redraw chart data");
  assert.ok(graphComponent.includes('this._plot.style.height = `${layout.height}px`'), "the responsive plot has a fixed height to prevent autosize feedback");
  assert.ok(graphComponent.includes("safePlotlyText(String(row[xIndex] ?? index + 1).slice(0, 100))"), "provider category labels are escaped before reaching Plotly");
  assert.ok(graphComponent.includes("name: safePlotlyText(columns[index])"), "provider field names are escaped before reaching Plotly");
  assert.ok(read("DataCNFNutrientAmounts.html").includes('data-default-x="nutrient_web_name" data-default-y="nutrient_value"'), "nutrient chart defaults to the named nutrient value series");
  assert.ok(graphComponent.includes('getAttribute("data-unit-field")'), "nutrient charts can filter plotted observations by official units");
  assert.ok(graphComponent.includes("Measurement unit"), "unit selector explains its control purpose");
  assert.ok(read("DataCNFNutrientAmounts.html").includes('data-default-unit="g"'), "nutrient chart defaults to grams per 100 grams");
});

test("all dataset pages request the current versioned GridGraph asset", () => {
  const dataPages = fs.readdirSync(site).filter((name) => /^Data.*\.html$/.test(name));
  assert.equal(dataPages.length, 9);
  for (const page of dataPages) {
    assert.match(read(page), /<script src="GridGraph\.[a-f0-9]{7}\.js" defer><\/script>/, `${page} requests a versioned chart component`);
    assert.match(read(page), /data-graphable-y="[A-Za-z0-9_,]+"/, `${page} configures approved numeric graph measures`);
    assert.match(read(page), /data-graph-types="(bar|line,bar,area,scatter)"/, `${page} declares only suitable graph types`);
  }
  assert.ok(fs.existsSync(path.resolve(site, "..", "GraphTypeGuidance.md")), "the graph type usage guide is available with the project source");
});

test("label-only CNF datasets are excluded from the public graph directory", () => {
  const health = read("SiteHealthCanada.html");
  assert.equal(health.includes("DataCNFFood.html"), false);
  assert.equal(health.includes("DataCNFNutrientNames.html"), false);
  assert.equal(fs.existsSync(path.join(site, "DataCNFFood.html")), false);
  assert.equal(fs.existsSync(path.join(site, "DataCNFNutrientNames.html")), false);
});

test("Azure deployment pins checkout immutably and does not persist its token", () => {
  const workflow = fs.readFileSync(path.resolve(site, "..", ".github", "workflows", "azure-static-web-apps.yml"), "utf8");
  assert.match(workflow, /uses: actions\/checkout@[a-f0-9]{40}/, "checkout uses a full commit SHA");
  assert.match(workflow, /persist-credentials: false/, "the deployment job does not retain the checkout token");
});
