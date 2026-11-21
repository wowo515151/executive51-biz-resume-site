"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
require("../site/gridpull.js");

test("CSV parser handles quoted separators, escaped quotes, and blank cells", () => {
  const table = Gridpull.parseCSV('name,value,note\r\n"A, B",12,"x ""quoted"""\r\nC,,last');
  assert.deepEqual(table.columns, ["name", "value", "note"]);
  assert.deepEqual(table.rows, [["A, B", "12", 'x "quoted"'], ["C", "", "last"]]);
});

test("CSV parser removes a UTF-8 BOM from the first header", () => {
  const table = Gridpull.parseCSV("\uFEFFname,value\nQuébec,42");
  assert.deepEqual(table.columns, ["name", "value"]);
  assert.deepEqual(table.rows, [["Québec", "42"]]);
});

test("JSON normalizer unions record columns and fills missing cells", () => {
  const table = Gridpull.normalizeJSON([{ date: "2026-01", value: 2 }, { date: "2026-02", extra: 3 }]);
  assert.deepEqual(table.columns, ["date", "value", "extra"]);
  assert.deepEqual(table.rows[1], ["2026-02", "", "3"]);
});

test("JSON normalizer accepts the CNF result envelope", () => {
  const table = Gridpull.normalizeJSON({ result: [{ food_code: 109, nutrient_value: 12.5 }] });
  assert.deepEqual(table.columns, ["food_code", "nutrient_value"]);
  assert.deepEqual(table.rows, [["109", "12.5"]]);
});

test("JSON normalizer reads nested record results with field metadata", () => {
  const table = Gridpull.normalizeJSON({ success: true, result: { records: [{ date: "2026-01", value: 7 }], fields: [{ id: "date" }, { id: "value" }] } });
  assert.deepEqual(table.columns, ["date", "value"]);
  assert.deepEqual(table.rows, [["2026-01", "7"]]);
});

test("Statistics Canada WDS observations normalize dates and scale values", () => {
  const table = Gridpull.normalizeStatCanWDS([{ status: "SUCCESS", object: {
    productId: 14100287,
    vectorDataPoint: [
      { refPer: "2026-09-01", value: 21000.1, scalarFactorCode: 3 },
      { refPer: "2026-10-01", value: null, scalarFactorCode: 0 }
    ]
  } }], 14100287);
  assert.deepEqual(table.columns, ["Reference period", "Value"]);
  assert.deepEqual(table.rows, [["2026-09-01", "21000100"], ["2026-10-01", ""]]);
  assert.throws(() => Gridpull.normalizeStatCanWDS([{ status: "SUCCESS", object: { productId: 1, vectorDataPoint: [] } }], 14100287), /unexpected data series/);
});

test("JSON normalizer preserves cells in uneven array rows", () => {
  const table = Gridpull.normalizeJSON([["Jan", 10], ["Feb", 12, "revised"]]);
  assert.deepEqual(table.columns, ["Column 1", "Column 2", "Column 3"]);
  assert.deepEqual(table.rows, [["Jan", "10", ""], ["Feb", "12", "revised"]]);
});

test("JSON normalizer enforces row and column limits", () => {
  assert.throws(() => Gridpull.normalizeJSON(Array.from({ length: 20001 }, () => ({ value: 1 }))), /row limit/);
  assert.equal(Gridpull.normalizeJSON([[...Array(101).keys()] ]).columns.length, 100);
});

test("public registry exposes only reviewed time-series datasets", () => {
  assert.deepEqual(Gridpull.listSites().map((site) => site.id), ["statcan", "quebec"]);
  assert.deepEqual(Gridpull.listDatasets("statcan").map((dataset) => dataset.id), ["population", "labour", "prices"]);
  assert.deepEqual(Gridpull.listDatasets("quebec").map((dataset) => dataset.id), ["population"]);
  const statcanSeries = {
    population: { productId: 17100009, coordinate: "1.0.0.0.0.0.0.0.0.0", latestN: 100 },
    labour: { productId: 14100287, coordinate: "1.3.1.1.1.1.0.0.0.0", latestN: 100 },
    prices: { productId: 18100004, coordinate: "2.2.0.0.0.0.0.0.0.0", latestN: 100 }
  };
  const statcan = Gridpull.listDatasets("statcan");
  for (const [id, request] of Object.entries(statcanSeries)) {
    const dataset = statcan.find((entry) => entry.id === id);
    assert.ok(dataset, `Statistics Canada ${id} remains an active time series`);
    assert.equal(dataset.fetchURL, "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods", `${id} uses the reviewed Statistics Canada endpoint`);
    assert.deepEqual(dataset.request, request, `${id} keeps its reviewed product, coordinate, and 100-observation request`);
  }
  for (const site of Gridpull.listSites()) {
    for (const dataset of Gridpull.listDatasets(site.id)) {
      assert.ok(dataset.timeSeries?.field, `${site.id}/${dataset.id} declares its time axis`);
      assert.ok(dataset.graphableFields.length > 0, `${site.id}/${dataset.id} declares numeric graph measures`);
    }
  }
  assert.equal(Gridpull.getInfo("healthcanada", "gouda").dataset.name, "Nutrient amounts in Gouda cheese");
  assert.throws(() => Gridpull.getInfo("unknown", "dataset"), /Unknown data provider/);
});

test("time-series validation requires a time axis and numeric measures while allowing declared filters", () => {
  const single = { columns: ["period", "value"], rows: [["2025", "4"], ["2026", "5"]] };
  const multi = { columns: ["period", "actual", "forecast"], rows: [["2025", "4", ""], ["2026", "5", "6"]] };
  const grouped = { columns: ["territory", "year", "value"], rows: [["North", "2025", "4"], ["North", "2026", "5"]] };
  assert.equal(Gridpull.isTimeSeriesTable(single, "period", ["value"]), true);
  assert.equal(Gridpull.isTimeSeriesTable(multi, "period", ["actual", "forecast"]), true);
  assert.equal(Gridpull.isTimeSeriesTable(grouped, "year", ["value"], ["territory"]), true);
  assert.equal(Gridpull.isTimeSeriesTable({ columns: ["category", "value"], rows: [["North", "4"], ["South", "5"]] }, "period", ["value"]), false);
  assert.equal(Gridpull.isTimeSeriesTable({ columns: ["period", "value", "label"], rows: [["2025", "4", "x"]] }, "period", ["value"]), false);
  assert.equal(Gridpull.isTimeSeriesTable({ columns: ["period", "value"], rows: [["2025", "4"], ["2026", "not numeric"]] }, "period", ["value"]), false);
  assert.equal(Gridpull.isTimeSeriesTable({ columns: ["period", "value"], rows: [["not a date", "4"]] }, "period", ["value"]), false);
  assert.equal(Gridpull.isTimeSeriesTable({ columns: ["period", "value"], rows: [["2026-13", "4"]] }, "period", ["value"]), false);
  assert.equal(Gridpull.isTimeSeriesTable({ columns: ["period", "value"], rows: [["2025-02-30", "4"]] }, "period", ["value"]), false);
});

test("generic graphability still requires an approved numeric observation", () => {
  assert.equal(Gridpull.isGraphableTable({ columns: ["food_code", "food_description"], rows: [["109", "Gouda"], ["110", "Cheddar"]] }, []), false);
  assert.equal(Gridpull.isGraphableTable({ columns: ["nutrient_value"], rows: [["label"]] }, ["nutrient_value"]), false);
  assert.equal(Gridpull.isGraphableTable({ columns: ["nutrient_value"], rows: [["12.5"], ["14.3"]] }, ["nutrient_value"]), true);
});

test("Données Québec DataStore normalizer validates the resource and requested columns", () => {
  const request = { resourceId: "resource-1", limit: 100, fields: ["name", "population"] };
  const table = Gridpull.normalizeCKANDatastore({ success: true, result: {
    resource_id: "resource-1", records: [{ name: "Québec", population: "549459", private_email: "excluded" }]
  } }, request);
  assert.deepEqual(table.columns, ["name", "population"]);
  assert.deepEqual(table.rows, [["Québec", "549459"]]);
  assert.throws(() => Gridpull.normalizeCKANDatastore({ success: true, result: { resource_id: "other", records: [] } }, request), /unexpected DataStore/);
  assert.throws(() => Gridpull.normalizeCKANDatastore({ success: true, result: { resource_id: "resource-1", records: Array.from({ length: 101 }, () => ({})) } }, request), /more rows than requested/);
});

test("unverified dataset cannot make a network request", async () => {
  await assert.rejects(Gridpull.load("toronto", "indicators", { fetch: () => { throw new Error("network should not be reached"); } }), /not been verified/);
});

test("cross-sectional datasets are disabled before any provider request", async () => {
  let requests = 0;
  const fetch = () => { requests++; throw new Error("network should not be reached"); };
  await assert.rejects(Gridpull.load("healthcanada", "gouda", { fetch }), /disabled.*time-series/i);
  await assert.rejects(Gridpull.load("quebec", "municipalities", { fetch }), /disabled.*time-series/i);
  await assert.rejects(Gridpull.load("quebec", "finances", { fetch }), /disabled.*time-series/i);
  await assert.rejects(Gridpull.load("healthcanada", "foods", { fetch }), /disabled.*time-series/i);
  assert.equal(requests, 0);
});

test("malformed time-series observations are rejected after normalization", async () => {
  const body = JSON.stringify([{ status: "SUCCESS", object: {
    productId: 18100004, coordinate: "2.2.0.0.0.0.0.0.0.0",
    vectorDataPoint: [{ refPer: "2026-10-01", value: "not-a-number", scalarFactorCode: 0 }]
  } }]);
  const response = {
    ok: true, status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } })
  };
  await assert.rejects(Gridpull.load("statcan", "prices", { fetch: async () => response }), /invalid numeric value/);
});

test("verified Statistics Canada dataset uses anonymous WDS POST and normalizes observations", async () => {
  let request;
  const body = JSON.stringify([{ status: "SUCCESS", object: {
    productId: 18100004,
    coordinate: "2.2.0.0.0.0.0.0.0.0",
    vectorDataPoint: [{ refPer: "2026-10-01", value: 170.4, scalarFactorCode: 0 }]
  } }]);
  const response = {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } })
  };
  const table = await Gridpull.load("statcan", "prices", { fetch: async (url, options) => { request = { url, options }; return response; } });
  assert.equal(request.url, "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.options.body), [{ productId: 18100004, coordinate: "2.2.0.0.0.0.0.0.0.0", latestN: 100 }]);
  assert.deepEqual(table.columns, ["Reference period", "Value"]);
  assert.deepEqual(table.rows, [["2026-10-01", "170.4"]]);
});

test("verified Données Québec projection source makes a bounded GET and enforces time-series shape", async () => {
  let request;
  const body = JSON.stringify({ success: true, result: { resource_id: "05c3c53d-db97-4bc3-8221-d8af47b4b93e", records: [
    { NiveauGeographique: "Territory", Territoire: "North", Annee: "2025", TypeDonnees: "Estimate", Sexe: "Both", TousLesAges: "120" },
    { NiveauGeographique: "Territory", Territoire: "North", Annee: "2026", TypeDonnees: "Projection", Sexe: "Both", TousLesAges: "124" }
  ] } });
  const response = {
    ok: true, status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } })
  };
  const table = await Gridpull.load("quebec", "population", { fetch: async (url, options) => { request = { url, options }; return response; } });
  const parsed = new URL(request.url);
  assert.equal(parsed.origin, "https://www.donneesquebec.ca");
  assert.equal(parsed.searchParams.get("resource_id"), "05c3c53d-db97-4bc3-8221-d8af47b4b93e");
  assert.equal(parsed.searchParams.get("limit"), "100");
  assert.equal(parsed.searchParams.get("fields"), "NiveauGeographique,Territoire,Annee,TypeDonnees,Sexe,TousLesAges");
  assert.equal(request.options.mode, "cors");
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.method, undefined);
  assert.deepEqual(table.columns, ["NiveauGeographique", "Territoire", "Annee", "TypeDonnees", "Sexe", "TousLesAges"]);
  assert.equal(Gridpull.isTimeSeriesTable(table, "Annee", ["TousLesAges"], ["NiveauGeographique", "Territoire", "TypeDonnees", "Sexe"]), true);
});
