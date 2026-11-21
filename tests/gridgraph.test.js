"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("3D mode uses labeled points when a surface cannot be formed", () => {
  const saved = {
    window: global.window,
    HTMLElement: global.HTMLElement,
    customElements: global.customElements
  };
  let graphClass;
  global.window = {};
  global.HTMLElement = class {};
  global.customElements = {
    get: () => undefined,
    define: (_name, definition) => { graphClass = definition; }
  };
  try {
    delete require.cache[require.resolve("../site/GridGraph.d2f01c3.js")];
    require("../site/GridGraph.d2f01c3.js");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }

  const rows = [["Vitamin C", "5"], ["Calcium", "12"], ["Sodium", ""]];
  const result = graphClass && require("../site/GridGraph.d2f01c3.js").create3DTrace(
    rows, ["nutrient_web_name", "nutrient_value"], [1], rows.map((row) => row[0])
  );
  assert.equal(result.fallback, true);
  assert.equal(result.trace.type, "scatter3d");
  assert.deepEqual(result.trace.x, [1, 2]);
  assert.deepEqual(result.trace.y, [1, 1]);
  assert.deepEqual(result.trace.z, [5, 12]);
  assert.deepEqual(result.trace.customdata, [["Vitamin C", "nutrient_value"], ["Calcium", "nutrient_value"]]);
});

test("3D mode uses a surface when two measures and two rows are available", () => {
  const create3DTrace = require("../site/GridGraph.d2f01c3.js").create3DTrace;
  const result = create3DTrace(
    [["North", "10", "3"], ["South", "20", "7"]],
    ["region", "population", "area"], [1, 2], ["North", "South"]
  );
  assert.equal(result.fallback, false);
  assert.equal(result.trace.type, "surface");
  assert.deepEqual(result.trace.x, [0, 1]);
  assert.deepEqual(result.trace.y, ["population", "area"]);
  assert.deepEqual(result.trace.z, [[10, 20], [3, 7]]);
  assert.deepEqual(result.xTickValues, [0, 1]);
  assert.deepEqual(result.xTickText, ["North", "South"]);
  assert.deepEqual(result.trace.customdata, [["North", "South"], ["North", "South"]]);
  assert.match(result.trace.hovertemplate, /%\{customdata\}/);
});

test("3D surfaces thin dense category ticks without dropping hover labels or data", () => {
  const { create3DTrace } = require("../site/GridGraph.d2f01c3.js");
  const labels = Array.from({ length: 100 }, (_value, index) => `Municipality ${index + 1}`);
  const rows = labels.map((_label, index) => [String(index + 1), String((index + 1) * 2)]);
  const result = create3DTrace(rows, ["population", "area"], [0, 1], labels);
  assert.equal(result.trace.x.length, 100);
  assert.equal(result.trace.z[0].length, 100);
  assert.equal(result.trace.customdata[0].length, 100);
  assert.equal(result.xTickValues.length, 6);
  assert.equal(result.xTickValues[0], 0);
  assert.equal(result.xTickValues.at(-1), 99);
  assert.equal(result.xTickText.at(-1), "Municip…");
  assert.ok(result.xTickText.every((text) => Array.from(text).length <= 8));
  assert.equal(result.trace.customdata[0][50], "Municipality 51");
});

test("pie mode keeps positive values and omits zero or missing rows", () => {
  const { createPieTrace } = require("../site/GridGraph.d2f01c3.js");
  const result = createPieTrace(
    [["A", "5"], ["B", "0"], ["C", ""], ["D", "12"]],
    1,
    ["A", "B", "C", "D"]
  );
  assert.equal(result.reason, null);
  assert.deepEqual(result.trace.labels, ["A", "D"]);
  assert.deepEqual(result.trace.values, [5, 12]);
});

test("pie mode refuses negative values rather than silently converting them to zero", () => {
  const { createPieTrace } = require("../site/GridGraph.d2f01c3.js");
  const result = createPieTrace([["positive", "5"], ["negative", "-2"]], 1, ["positive", "negative"]);
  assert.equal(result.trace, null);
  assert.equal(result.reason, "negative");
});

test("pie mode reports when there are no positive values", () => {
  const { createPieTrace } = require("../site/GridGraph.d2f01c3.js");
  const result = createPieTrace([["zero", "0"], ["missing", ""]], 1, ["zero", "missing"]);
  assert.equal(result.trace, null);
  assert.equal(result.reason, "empty");
});

test("Plotly text values escape HTML metacharacters before chart rendering", () => {
  const { safePlotlyText, createPieTrace, create3DTrace } = require("../site/GridGraph.d2f01c3.js");
  const hostile = `<img src=x onerror="alert('x')"> &`;
  const safe = "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;";
  assert.equal(safePlotlyText(hostile), safe);
  assert.equal(createPieTrace([["row", "1"]], 1, [hostile]).trace.labels[0], safe);
  const surface = create3DTrace([[hostile, "1"], ["second", "2"]], ["category", "<series>"], [1], [hostile]);
  assert.deepEqual(surface.trace.customdata[0], [safe, "&lt;series&gt;"]);
  const matrix = create3DTrace(
    [[hostile, "1", "3"], ["second", "2", "4"]],
    ["category", "<series>", "&amount"], [1, 2], [hostile, "second"]
  );
  assert.deepEqual(matrix.trace.x, [0, 1]);
  assert.equal(matrix.xTickText[0], safePlotlyText(`${hostile.slice(0, 7)}…`));
  assert.equal(matrix.xTickText[1], "second");
  assert.deepEqual(matrix.trace.customdata[0], [safe, "second"]);
  assert.deepEqual(matrix.trace.y, ["&lt;series&gt;", "&amp;amount"]);
});

test("dense categorical bar labels use a readable horizontal layout", () => {
  const { shouldUseHorizontalBars } = require("../site/GridGraph.d2f01c3.js");
  const labels = Array.from({ length: 100 }, (_, index) => `Municipality ${index + 1}`);
  assert.equal(shouldUseHorizontalBars(labels), true);
});

test("date sequences retain a compact vertical bar layout", () => {
  const { shouldUseHorizontalBars } = require("../site/GridGraph.d2f01c3.js");
  const labels = Array.from({ length: 100 }, (_, index) => {
    const date = new Date(Date.UTC(2020, index, 1));
    return date.toISOString().slice(0, 10);
  });
  assert.equal(shouldUseHorizontalBars(labels), false);
});

test("time-series periods accept ISO day or month values for inclusive date filtering", () => {
  const { periodDate } = require("../site/GridGraph.d2f01c3.js");
  assert.equal(periodDate("2025-06-30"), "2025-06-30");
  assert.equal(periodDate("2025-06"), "2025-06-01");
  assert.equal(periodDate("2025"), "2025-01-01");
  assert.equal(periodDate("2024-02-29"), "2024-02-29");
  assert.equal(periodDate("2025-02-29"), null);
  assert.equal(periodDate("2025-02-30"), null);
  assert.equal(periodDate("2025-13"), null);
  assert.equal(periodDate("not a date"), null);
});

test("time-series adapter builds one numeric trace and sorts periods chronologically", () => {
  const { createTimeSeriesTraces } = require("../site/GridGraph.d2f01c3.js");
  const traces = createTimeSeriesTraces(
    [["2026-03", "3"], ["2026-01", "1"], ["2026-02", "2"]],
    ["period", "value"], "period", ["value"]
  );
  assert.equal(traces.length, 1);
  assert.deepEqual(traces[0].x, ["2026-01-01", "2026-02-01", "2026-03-01"]);
  assert.deepEqual(traces[0].y, [1, 2, 3]);
});

test("inclusive time filters retain boundary periods and exclude out-of-range rows", () => {
  const { filterRowsByTimePeriod } = require("../site/GridGraph.d2f01c3.js");
  const columns = ["period", "value"];
  const rows = [["2026-03", "3"], ["2026-01", "1"], ["2026-02", "2"]];
  assert.deepEqual(filterRowsByTimePeriod(columns, rows, "period", "2026-01-01", "2026-02-01"), [rows[1], rows[2]]);
  assert.deepEqual(filterRowsByTimePeriod(columns, rows, "missing", "2026-01-01", "2026-02-01"), []);
});

test("time-series adapter supports multiple numeric measures and missing values", () => {
  const { createTimeSeriesTraces } = require("../site/GridGraph.d2f01c3.js");
  const traces = createTimeSeriesTraces(
    [["2025", "10", ""], ["2026", "12", "15"]],
    ["year", "actual", "forecast"], "year", ["actual", "forecast"]
  );
  assert.equal(traces.length, 2);
  assert.deepEqual(traces[0].x, ["2025-01-01", "2026-01-01"]);
  assert.deepEqual(traces[0].y, [10, 12]);
  assert.deepEqual(traces[1].y, [null, 15]);
  assert.deepEqual(createTimeSeriesTraces([["2025", "1"]], ["year", "value"], "missing", ["value"]), []);
});

test("identifier, order, and decimal fields are not selected as default measures", () => {
  const { defaultMeasureNames } = require("../site/GridGraph.d2f01c3.js");
  assert.deepEqual(defaultMeasureNames([
    "nutrient_name_id", "nutrient_code", "nutrient_decimals", "nutrient_web_order", "nutrient_group_id"
  ]), []);
  assert.deepEqual(defaultMeasureNames(["population_total", "standard_error", "observation_count"]), ["population_total"]);
});

test("numeric graph series are restricted to each dataset's approved measure names", () => {
  const { graphableNumericIndexes } = require("../site/GridGraph.d2f01c3.js");
  const columns = ["population_id", "population_code", "population"];
  const rows = [["1", "10", "450"], ["2", "11", "780"]];
  assert.deepEqual(graphableNumericIndexes(columns, rows, ["population"]), [2]);
  assert.deepEqual(graphableNumericIndexes(columns, rows, []), []);
});

test("required series filters isolate one projection group and sort its years", () => {
  const { filterRowsByFields, hasRequiredFilters, sortRowsByField } = require("../site/GridGraph.d2f01c3.js");
  const columns = ["Territoire", "TypeDonnees", "Sexe", "Annee", "TousLesAges"];
  const rows = [
    ["Territory A", "Estimate", "Both sexes", "2031", "120"],
    ["Territory B", "Estimate", "Both sexes", "2026", "900"],
    ["Territory A", "Projection", "Both sexes", "2026", "130"],
    ["Territory A", "Estimate", "Women", "2026", "70"],
    ["Territory A", "Estimate", "Both sexes", "2026", "110"]
  ];
  const selected = filterRowsByFields(columns, rows, {
    Territoire: "Territory A", TypeDonnees: "Estimate", Sexe: "Both sexes"
  });
  assert.equal(hasRequiredFilters(["Territoire", "TypeDonnees", "Sexe"], { Territoire: "Territory A", TypeDonnees: "Estimate", Sexe: "" }), false);
  assert.equal(hasRequiredFilters(["Territoire", "TypeDonnees", "Sexe"], { Territoire: "Territory A", TypeDonnees: "Estimate", Sexe: "Both sexes" }), true);
  assert.deepEqual(sortRowsByField(columns, selected, "Annee").map((row) => row.slice(3)), [["2026", "110"], ["2031", "120"]]);
  assert.deepEqual(filterRowsByFields(columns, rows, { Territoire: "Territory A", Unknown: "x" }), []);
});

test("container resize coalesces Plotly size updates and cancels when disconnected", () => {
  const saved = { window: global.window, HTMLElement: global.HTMLElement, customElements: global.customElements };
  const frames = new Map();
  let nextFrame = 1, resized = 0, cancelled = 0;
  const root = {
    requestAnimationFrame(callback) { const id = nextFrame++; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { if (frames.delete(id)) cancelled++; },
    Plotly: { Plots: { resize: () => { resized++; } } }
  };
  global.window = root;
  global.HTMLElement = class {};
  global.customElements = { get: () => undefined, define: () => {} };
  try {
    delete require.cache[require.resolve("../site/GridGraph.d2f01c3.js")];
    const { schedulePlotResize, cancelPlotResize } = require("../site/GridGraph.d2f01c3.js");
    const component = { _resizeFrame: null, _hasDrawn: true, _plot: {}, isConnected: true };
    schedulePlotResize(component);
    schedulePlotResize(component);
    assert.equal(frames.size, 1);
    const [frameId, callback] = frames.entries().next().value;
    frames.delete(frameId);
    callback();
    assert.equal(resized, 1);
    assert.equal(component._resizeFrame, null);
    schedulePlotResize(component);
    cancelPlotResize(component);
    assert.equal(cancelled, 1);
    assert.equal(frames.size, 0);
    assert.equal(resized, 1);
  } finally {
    delete require.cache[require.resolve("../site/GridGraph.d2f01c3.js")];
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
});
