"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
require("../gridpull.js");

test("CSV parser handles quoted separators, escaped quotes, and blank cells", () => {
  const table = Gridpull.parseCSV('name,value,note\r\n"A, B",12,"x ""quoted"""\r\nC,,last');
  assert.deepEqual(table.columns, ["name", "value", "note"]);
  assert.deepEqual(table.rows, [["A, B", "12", 'x "quoted"'], ["C", "", "last"]]);
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
  const verifiedCNF = {
    foods: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?lang=en&type=json",
    nutrients: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientname/?lang=en&type=json",
    gouda: "https://food-nutrition.canada.ca/api/canadian-nutrient-file/nutrientamount/?id=109&lang=en&type=json"
  };
  for (const site of sites) {
    const datasets = Gridpull.listDatasets(site.id);
    assert.equal(datasets.length, 3);
    for (const dataset of datasets) {
      const expectedURL = site.id === "healthcanada" ? verifiedCNF[dataset.id] : null;
      assert.equal(dataset.verified, Boolean(expectedURL), `${site.id}/${dataset.id} verification state matches source evidence`);
      assert.equal(dataset.fetchURL, expectedURL, `${site.id}/${dataset.id} uses only its verified official endpoint`);
    }
  }
  assert.equal(Gridpull.getInfo("healthcanada", "gouda").dataset.name, "Nutrient amounts in Gouda cheese");
  assert.throws(() => Gridpull.getInfo("unknown", "dataset"), /Unknown data provider/);
});

test("unverified dataset cannot make a network request", async () => {
  await assert.rejects(Gridpull.load("statcan", "population", { fetch: () => { throw new Error("network should not be reached"); } }), /not been verified/);
});

test("verified Health Canada dataset loads a bounded JSON array without credentials", async () => {
  let request;
  const body = JSON.stringify([{ food_code: 571, food_description: "Chicken, broiler, giblets, raw" }]);
  const response = {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(body)); controller.close(); } })
  };
  const table = await Gridpull.load("healthcanada", "foods", { fetch: async (url, options) => { request = { url, options }; return response; } });
  assert.equal(request.url, "https://food-nutrition.canada.ca/api/canadian-nutrient-file/food/?lang=en&type=json");
  assert.equal(request.options.mode, "cors");
  assert.equal(request.options.credentials, "omit");
  assert.deepEqual(table.columns, ["food_code", "food_description"]);
  assert.deepEqual(table.rows, [["571", "Chicken, broiler, giblets, raw"]]);
});
