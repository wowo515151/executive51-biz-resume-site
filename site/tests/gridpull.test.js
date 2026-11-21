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
  for (const site of sites) {
    const datasets = Gridpull.listDatasets(site.id);
    assert.equal(datasets.length, 3);
    for (const dataset of datasets) {
      assert.equal(dataset.verified, false, `${site.id}/${dataset.id} remains disabled pending source verification`);
      assert.equal(dataset.fetchURL, null, `${site.id}/${dataset.id} has no active fetch URL`);
    }
  }
  assert.equal(Gridpull.getInfo("healthcanada", "gouda").dataset.name, "Nutrient amounts in Gouda cheese");
  assert.throws(() => Gridpull.getInfo("unknown", "dataset"), /Unknown data provider/);
});

test("unverified dataset cannot make a network request", async () => {
  await assert.rejects(Gridpull.load("statcan", "population", { fetch: () => { throw new Error("network should not be reached"); } }), /not been verified/);
});
