"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
require("../site/gridpull.js");
const gridpull = global.Gridpull;
const site = path.resolve(__dirname, "..", "site");
const read = (name) => fs.readFileSync(path.join(site, name), "utf8");
function loadGraphHelpers() {
  const saved = { window: global.window, HTMLElement: global.HTMLElement, customElements: global.customElements };
  global.window = global.window || {};
  global.HTMLElement = global.HTMLElement || class {};
  global.customElements = { get: () => undefined, define() {} };
  try {
    delete require.cache[require.resolve("../site/GridGraph.c389cb0.js")];
    return require("../site/GridGraph.c389cb0.js");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
}
const candidates = [
  ["sulphurDioxide", "DataNovaScotiaSulphurDioxide.html", "u5en-p4f5"],
  ["fineParticulate", "DataNovaScotiaPM25.html", "de89-3xrj"],
  ["ozone", "DataNovaScotiaOzone.html", "tfbp-itby"]
];

test("every site HTML reference to GridGraph resolves to an existing asset", () => {
  const htmlFiles = fs.readdirSync(site).filter((file) => file.endsWith(".html"));
  const references = htmlFiles.flatMap((htmlFile) => {
    const html = read(htmlFile);
    return [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)]
      .map((match) => ({ htmlFile, src: match[1].split("?")[0] }))
      .filter(({ src }) => /(?:^|\/)GridGraph\.[a-f0-9]+\.js$/.test(src));
  });
  assert.ok(references.length > 0, "site pages reference the graph asset");
  for (const { htmlFile, src } of references) assert.ok(fs.existsSync(path.resolve(site, src)), `${htmlFile} references existing ${src}`);
});

test("Nova Scotia candidate metadata stays hidden and disabled", async () => {
  assert.equal(gridpull.listSites().some((provider) => provider.id === "novaScotia"), false);
  assert.deepEqual(gridpull.listDatasets("novaScotia").map((dataset) => dataset.id), candidates.map(([id]) => id));
  for (const [id, page, resourceId] of candidates) {
    const { dataset } = gridpull.getInfo("novaScotia", id);
    assert.equal(dataset.schema, "socrata-soda2");
    assert.equal(dataset.request.resourceId, resourceId);
    assert.equal(dataset.verified, false);
    assert.equal(dataset.fetchURL, null);
    assert.equal(dataset.timeSeries.field, "date_time");
    assert.deepEqual(dataset.graphableFields, ["average"]);
    const html = read(page);
    assert.match(html, /data-disabled="true"/);
    assert.match(html, /button[^>]*disabled/);
    assert.match(html, /data-time-field="date_time"/);
    assert.match(html, /data-graphable-y="average"/);
  }
  const graphDirectory = read("graph.html");
  assert.doesNotMatch(graphDirectory, /SiteNovaScotia\.html|DataNovaScotia/);
  const provider = read("SiteNovaScotia.html");
  for (const [, page] of candidates) assert.ok(provider.includes(page));

  let requests = 0;
  for (const [id] of candidates) await assert.rejects(gridpull.load("novaScotia", id, { fetch: async () => { requests++; throw new Error("unexpected request"); } }), /direct public endpoint has not been verified/);
  assert.equal(requests, 0, "disabled source cannot invoke fetch");
});

test("Socrata adapter normalizes only configured synthetic fields", () => {
  const request = { fields: ["date_time", "average"], limit: 2 };
  const table = gridpull.normalizeSocrata([
    { date_time: "2025-01-01T01:00:00.000", average: "8.25", ignored: "not selected" },
    { date_time: "2025-01-01T02:00:00.000", average: null, ignored: "not selected" }
  ], request);
  assert.deepEqual(table.columns, ["date_time", "average"]);
  assert.deepEqual(table.rows, [["2025-01-01T01:00:00.000", "8.25"], ["2025-01-01T02:00:00.000", ""]]);
  assert.equal(gridpull.isTimeSeriesTable(table, "date_time", ["average"]), true);
  assert.throws(() => gridpull.normalizeSocrata({ records: [] }, request), /unexpected SODA response/);
  assert.throws(() => gridpull.normalizeSocrata([{}, {}, {}], request), /more rows than requested/);
  assert.throws(() => gridpull.normalizeSocrata([null], request), /non-record row/);
});

test("Socrata SODA requests use a credential-free query GET without a JSON body", () => {
  const signal = new AbortController().signal;
  const options = gridpull.requestOptionsFor({ schema: "socrata-soda2", format: "json", request: { resourceId: "de89-3xrj" } }, signal);
  assert.equal(options.method, "GET");
  assert.equal(options.mode, "cors");
  assert.equal(options.credentials, "omit");
  assert.equal(options.signal, signal);
  assert.equal(options.headers.Accept, "application/json");
  assert.equal(Object.hasOwn(options, "body"), false);
});

test("Socrata query selects the latest bounded rows and validates query fields before construction", () => {
  const dataset = gridpull.getInfo("novaScotia", "fineParticulate").dataset;
  const endpoint = "https://data.novascotia.ca/resource/de89-3xrj.json";
  const url = gridpull.buildSocrataURL(endpoint, dataset);
  assert.equal(url.searchParams.get("$select"), "date_time,average");
  assert.equal(url.searchParams.get("$order"), "date_time DESC");
  assert.equal(url.searchParams.get("$limit"), "100");

  const badFields = { ...dataset, request: { ...dataset.request, fields: ["date_time;drop_table", "average"] } };
  assert.throws(() => gridpull.buildSocrataURL(endpoint, badFields), /fields or time axis are invalid/);
  const mismatchedTime = { ...dataset, timeSeries: { ...dataset.timeSeries, field: "event_time" } };
  assert.throws(() => gridpull.buildSocrataURL(endpoint, mismatchedTime), /fields or time axis are invalid/);
  const badMeasure = { ...dataset, graphableFields: ["value DESC"] };
  assert.throws(() => gridpull.buildSocrataURL(endpoint, badMeasure), /measures are invalid/);
  assert.throws(() => gridpull.buildSocrataURL("https://other.example/resource/de89-3xrj.json", dataset), /does not match its official HTTPS source/);
});

test("a descending Socrata response is plotted chronologically and scaffold copy explains the sample", () => {
  const graph = loadGraphHelpers();
  const descending = gridpull.normalizeSocrata([
    { date_time: "2025-01-01T02:00:00.000", average: "2" },
    { date_time: "2025-01-01T01:00:00.000", average: "1" }
  ], { fields: ["date_time", "average"], limit: 2 });
  const traces = graph.createTimeSeriesTraces(descending.rows, descending.columns, "date_time", ["average"]);
  assert.deepEqual(traces[0].x, ["2025-01-01T01:00:00.000", "2025-01-01T02:00:00.000"]);
  for (const [, page] of candidates) {
    const html = read(page);
    assert.match(html, /latest 100 hourly rows and display them chronologically/);
    assert.match(html, /remains disabled|remains disabled/);
  }
  assert.match(read("SiteNovaScotia.html"), /Planned graph sample if verified: up to the latest 100 readings, sorted chronologically for the chart/);
});

test("Statistics Canada keeps its WDS POST while CKAN uses a credential-free GET", () => {
  const statcanRequest = { productId: 123, coordinate: "1.0", latestN: 10 };
  const statcan = gridpull.requestOptionsFor({ schema: "statcan-wds", format: "json", request: statcanRequest });
  assert.equal(statcan.method, "POST");
  assert.deepEqual(JSON.parse(statcan.body), [statcanRequest]);
  assert.equal(statcan.credentials, "omit");
  const ckan = gridpull.requestOptionsFor({ schema: "ckan-datastore", format: "json", request: { resourceId: "abc" } });
  assert.equal(ckan.method, undefined, "the default fetch method is GET for CKAN");
  assert.equal(Object.hasOwn(ckan, "body"), false);
  assert.equal(ckan.credentials, "omit");
});

test("loader timestamp validation matches GridGraph's calendar and ISO timestamp grammar", () => {
  const validPeriod = (period) => gridpull.isTimeSeriesTable({ columns: ["date_time", "average"], rows: [[period, "1"]] }, "date_time", ["average"]);
  for (const period of [
    "0000", "0001", "0099", "0000-02-29", "0099-12-31",
    "2025-01-01T01:00", "2025-01-01 01:00:00.123", "2025-01-01T01:00:00z",
    "2025-01-01T01:00:00+14:00", "2025-01-01T01:00:00-14:00"
  ]) assert.equal(validPeriod(period), true, `${period} is accepted`);
  for (const period of [
    "0099-02-29", "1900-02-29", "2025-01-01T01:00:00.1234", "2025-01-01T01:00:00+1400",
    "2025-01-01T01:00:00+14:01", "2025-01-01T01:00:00+15:00", "2025-01-01T01:00:00+01:60",
    "2025-01-01T24:00", "2025-02-29T01:00"
  ]) assert.equal(validPeriod(period), false, `${period} is rejected`);
});
