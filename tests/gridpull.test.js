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

test("selected registry exposes three reviewed sites and three datasets per site", () => {
  const sites = Gridpull.listSites();
  assert.equal(sites.length, 3);
  const verifiedCNF = { gouda: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientamount/?id=109&lang=en&type=json" };
  const verifiedStatCan = {
    population: { productId: 17100009, coordinate: "1.0.0.0.0.0.0.0.0.0", latestN: 100 },
    labour: { productId: 14100287, coordinate: "1.3.1.1.1.1.0.0.0.0", latestN: 100 },
    prices: { productId: 18100004, coordinate: "2.2.0.0.0.0.0.0.0.0", latestN: 100 }
  };
  const verifiedQuebec = {
    municipalities: { resourceId: "19385b4e-5503-4330-9e59-f998f5918363", limit: 100, fields: ["munnom", "mpopul", "msuperf", "regadm", "mrc"] },
    population: { resourceId: "05c3c53d-db97-4bc3-8221-d8af47b4b93e", limit: 100, fields: ["NiveauGeographique", "Territoire", "Annee", "TypeDonnees", "Sexe", "TousLesAges"] },
    finances: { resourceId: "15192f34-a635-47f5-aaf9-eb1621d65b2e", limit: 100, fields: ["nom_organisme", "population", "desc_cp", "FIALX01959", "FIALX01960", "FIALX01961", "FIALX01962", "FIALX01963", "FIALX01977", "FIALX02005", "FIALX02006", "FIALX02007", "FIALX02008", "FIALX02009", "FIALX02010", "FIALX02011", "FIALX02097"] }
  };
  for (const site of sites) {
    const datasets = Gridpull.listDatasets(site.id);
    assert.equal(datasets.length, site.id === "healthcanada" ? 1 : 3);
    for (const dataset of datasets) {
      const expectedURL = site.id === "healthcanada" ? verifiedCNF[dataset.id] : site.id === "statcan" && verifiedStatCan[dataset.id] ? "https://www150.statcan.gc.ca/t1/wds/rest/getDataFromCubePidCoordAndLatestNPeriods" : site.id === "quebec" ? "https://www.donneesquebec.ca/recherche/api/3/action/datastore_search" : null;
      assert.equal(dataset.verified, Boolean(expectedURL), `${site.id}/${dataset.id} verification state matches source evidence`);
      assert.equal(dataset.fetchURL, expectedURL, `${site.id}/${dataset.id} uses only its verified official endpoint`);
      assert.ok(dataset.graphableFields.length > 0, `${site.id}/${dataset.id} has an approved graph measure`);
      if (site.id === "statcan") assert.deepEqual(dataset.request, verifiedStatCan[dataset.id], `${dataset.id} uses the verified observation series`);
      if (site.id === "quebec") assert.deepEqual(dataset.request, verifiedQuebec[dataset.id], `${dataset.id} uses the reviewed resource and bounded field selection`);
    }
  }
  assert.equal(Gridpull.getInfo("healthcanada", "gouda").dataset.name, "Nutrient amounts in Gouda cheese");
  assert.deepEqual(Gridpull.listDatasets("healthcanada").map((dataset) => dataset.id), ["gouda"]);
  assert.deepEqual(Gridpull.getInfo("healthcanada", "foods").dataset.graphableFields, []);
  assert.throws(() => Gridpull.getInfo("unknown", "dataset"), /Unknown data provider/);
});

test("graphability requires an approved measure with a numeric observation", () => {
  assert.equal(Gridpull.isGraphableTable({ columns: ["food_code", "food_description"], rows: [["109", "Gouda"], ["110", "Cheddar"]] }, []), false);
  assert.equal(Gridpull.isGraphableTable({ columns: ["nutrient_code", "nutrient_decimals"], rows: [["1", "2"], ["2", "1"]] }, ["nutrient_value"]), false);
  assert.equal(Gridpull.isGraphableTable({ columns: ["nutrient_value"], rows: [["label"]] }, ["nutrient_value"]), false);
  assert.equal(Gridpull.isGraphableTable({ columns: ["nutrient_value"], rows: [["12.5"]] }, ["nutrient_value"]), true);
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

test("label-only food dataset is rejected before a provider request", async () => {
  await assert.rejects(Gridpull.load("healthcanada", "foods", { fetch: () => { throw new Error("network should not be reached"); } }), /no approved numeric measure/);
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

test("verified Données Québec source makes a bounded anonymous GET and keeps only requested fields", async () => {
  let request;
  const body = JSON.stringify({ success: true, result: { resource_id: "19385b4e-5503-4330-9e59-f998f5918363", records: [{ munnom: "Abercorn", mpopul: "368", private_email: "excluded" }] } });
  const response = {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } })
  };
  const table = await Gridpull.load("quebec", "municipalities", { fetch: async (url, options) => { request = { url, options }; return response; } });
  const parsed = new URL(request.url);
  assert.equal(parsed.origin, "https://www.donneesquebec.ca");
  assert.equal(parsed.searchParams.get("resource_id"), "19385b4e-5503-4330-9e59-f998f5918363");
  assert.equal(parsed.searchParams.get("limit"), "100");
  assert.equal(parsed.searchParams.get("fields"), "munnom,mpopul,msuperf,regadm,mrc");
  assert.equal(request.options.mode, "cors");
  assert.equal(request.options.credentials, "omit");
  assert.equal(request.options.method, undefined);
  assert.deepEqual(table.columns, ["munnom", "mpopul", "msuperf", "regadm", "mrc"]);
  assert.deepEqual(table.rows, [["Abercorn", "368", "", "", ""]]);
});
