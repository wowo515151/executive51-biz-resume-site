"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

function loadGraphHelpers() {
  const saved = { window: global.window, HTMLElement: global.HTMLElement, customElements: global.customElements };
  const testWindow = global.window || {};
  let registeredClass;
  global.window = testWindow;
  global.HTMLElement = global.HTMLElement || class {};
  global.customElements = { get: () => undefined, define(_name, definition) { registeredClass = definition; } };
  try {
    delete require.cache[require.resolve("../site/GridGraph.6bf43e7.js")];
    return { ...require("../site/GridGraph.6bf43e7.js"), testWindow, registeredClass: () => registeredClass };
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
}

test("GridGraph module initializes for its offline helper tests", () => {
  const { GridGraph } = loadGraphHelpers();
  assert.equal(typeof GridGraph, "function");
});

test("pie mode keeps positive values and omits zero or missing rows", () => {
  const { createPieTrace } = require("../site/GridGraph.6bf43e7.js");
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
  const { createPieTrace } = require("../site/GridGraph.6bf43e7.js");
  const result = createPieTrace([["positive", "5"], ["negative", "-2"]], 1, ["positive", "negative"]);
  assert.equal(result.trace, null);
  assert.equal(result.reason, "negative");
});

test("pie mode reports when there are no positive values", () => {
  const { createPieTrace } = require("../site/GridGraph.6bf43e7.js");
  const result = createPieTrace([["zero", "0"], ["missing", ""]], 1, ["zero", "missing"]);
  assert.equal(result.trace, null);
  assert.equal(result.reason, "empty");
});

test("Plotly text values escape HTML metacharacters before chart rendering", () => {
  const { safePlotlyText, createPieTrace } = require("../site/GridGraph.6bf43e7.js");
  const hostile = `<img src=x onerror="alert('x')"> &`;
  const safe = "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp;";
  assert.equal(safePlotlyText(hostile), safe);
  assert.equal(createPieTrace([["row", "1"]], 1, [hostile]).trace.labels[0], safe);
});

test("dense categorical bar labels use a readable horizontal layout", () => {
  const { shouldUseHorizontalBars } = require("../site/GridGraph.6bf43e7.js");
  const labels = Array.from({ length: 100 }, (_, index) => `Municipality ${index + 1}`);
  assert.equal(shouldUseHorizontalBars(labels), true);
});

test("date sequences retain a compact vertical bar layout", () => {
  const { shouldUseHorizontalBars } = require("../site/GridGraph.6bf43e7.js");
  const labels = Array.from({ length: 100 }, (_, index) => {
    const date = new Date(Date.UTC(2020, index, 1));
    return date.toISOString().slice(0, 10);
  });
  assert.equal(shouldUseHorizontalBars(labels), false);
});

test("time-series periods accept ISO day or month values for inclusive date filtering", () => {
  const { periodDate } = require("../site/GridGraph.6bf43e7.js");
  assert.equal(periodDate("2025-06-30"), "2025-06-30");
  assert.equal(periodDate("2025-06"), "2025-06-01");
  assert.equal(periodDate("2025"), "2025-01-01");
  assert.equal(periodDate("2024-02-29"), "2024-02-29");
  assert.equal(periodDate("2025-02-29"), null);
  assert.equal(periodDate("2025-02-30"), null);
  assert.equal(periodDate("2025-13"), null);
  assert.equal(periodDate("not a date"), null);
});

test("ISO timestamps preserve floating clock time and normalize explicit offsets by instant", () => {
  const { periodDate } = require("../site/GridGraph.6bf43e7.js");
  assert.equal(periodDate("2026-07-04 13:45"), "2026-07-04T13:45:00.000");
  assert.equal(periodDate("2026-07-04T13:45:00.25"), "2026-07-04T13:45:00.250");
  assert.equal(periodDate("2026-07-04T13:45:00-03:00"), "2026-07-04T16:45:00.000Z");
  assert.equal(periodDate("2026-07-04T16:45:00Z"), "2026-07-04T16:45:00.000Z");
  assert.equal(periodDate("2026-07-04T13:45:00.1234"), null, "precision finer than milliseconds is rejected rather than truncated");
  assert.equal(periodDate("2026-07-04T24:00:00"), null);
  assert.equal(periodDate("2026-07-04T13:45:00+14:01"), null);
});

test("time-series adapter builds one numeric trace and sorts periods chronologically", () => {
  const { createTimeSeriesTraces } = require("../site/GridGraph.6bf43e7.js");
  const traces = createTimeSeriesTraces(
    [["2026-03", "3"], ["2026-01", "1"], ["2026-02", "2"]],
    ["period", "value"], "period", ["value"]
  );
  assert.equal(traces.length, 1);
  assert.deepEqual(traces[0].x, ["2026-01-01", "2026-02-01", "2026-03-01"]);
  assert.deepEqual(traces[0].y, [1, 2, 3]);
});

test("inclusive time filters retain boundary periods and exclude out-of-range rows", () => {
  const { filterRowsByTimePeriod } = require("../site/GridGraph.6bf43e7.js");
  const columns = ["period", "value"];
  const rows = [["2026-03", "3"], ["2026-01", "1"], ["2026-02", "2"]];
  assert.deepEqual(filterRowsByTimePeriod(columns, rows, "period", "2026-01-01", "2026-02-01"), [rows[1], rows[2]]);
  assert.deepEqual(filterRowsByTimePeriod(columns, rows, "missing", "2026-01-01", "2026-02-01"), []);
});

test("inclusive date filters include every hourly timestamp on both selected calendar days", () => {
  const { filterRowsByTimePeriod } = require("../site/GridGraph.6bf43e7.js");
  const columns = ["period", "value"];
  const rows = [
    ["2026-07-03T23:59:59", "before"],
    ["2026-07-04T00:00:00", "start"],
    ["2026-07-04T23:59:59", "end"],
    ["2026-07-05T00:00:00", "after"]
  ];
  assert.deepEqual(filterRowsByTimePeriod(columns, rows, "period", "2026-07-04", "2026-07-04"), rows.slice(1, 3));
  const offsetRows = [["2026-01-01T00:30:00+02:00", "utc-previous-day"], ["2026-01-01T00:30:00Z", "utc-selected-day"]];
  assert.deepEqual(filterRowsByTimePeriod(columns, offsetRows, "period", "2025-12-31", "2025-12-31"), [offsetRows[0]]);
});

test("time series refuse duplicate periods after normalization rather than plotting ambiguous rows", () => {
  const { hasUniqueTimePeriods } = require("../site/GridGraph.6bf43e7.js");
  const columns = ["period", "value"];
  assert.equal(hasUniqueTimePeriods([["2025-01", "1"], ["2025-02", "2"]], columns, "period"), true);
  assert.equal(hasUniqueTimePeriods([["2025-01", "1"], ["2025-01-01", "2"]], columns, "period"), false);
  assert.equal(hasUniqueTimePeriods([["2025-01", "1"], ["2025-02", "2"]], columns, "missing"), false);
  assert.equal(hasUniqueTimePeriods([["2025-01-01T01:00:00+01:00", "1"], ["2025-01-01T00:00:00Z", "2"]], columns, "period"), false);
  assert.equal(hasUniqueTimePeriods([["2025-01-01T00:00:00", "1"], ["2025-01-01T01:00:00Z", "2"]], columns, "period"), false, "floating and offset times cannot be mixed in one series");
});

test("hourly traces retain time of day and never qualify for calendar heatmaps", () => {
  const { createTimeSeriesTraces, classifyTimeSeries, timeSeriesTypeReasons } = require("../site/GridGraph.6bf43e7.js");
  const rows = [
    ["2025-01-01T02:00:00", "3"],
    ["2025-01-01T00:00:00", "1"],
    ["2025-01-01T01:00:00", "2"]
  ];
  const traces = createTimeSeriesTraces(rows, ["period", "value"], "period", ["value"]);
  assert.deepEqual(traces[0].x, ["2025-01-01T00:00:00.000", "2025-01-01T01:00:00.000", "2025-01-01T02:00:00.000"]);
  assert.deepEqual(traces[0].y, [1, 2, 3]);
  const offsetRows = [["2026-01-02T00:30:00+02:00", "2"], ["2026-01-01T23:00:00Z", "1"]];
  const offsetTraces = createTimeSeriesTraces(offsetRows, ["period", "value"], "period", ["value"]);
  assert.deepEqual(offsetTraces[0].x, ["2026-01-01T23:00:00.000Z", "2026-01-01T22:30:00.000Z"].sort());
  const multiYearHourly = [["2024-01-01T00:00:00", "1"], ["2025-01-01T00:00:00", "2"], ["2026-01-01T00:00:00", "3"]];
  assert.equal(classifyTimeSeries(multiYearHourly, 0), null);
  const reasons = timeSeriesTypeReasons(multiYearHourly, ["period", "value"], "period", ["value"]);
  assert.match(reasons.heatmap, /regular annual, quarterly, or monthly periods/);
  assert.equal(Object.hasOwn(reasons, "scatter3d"), false);
});

test("time-series adapter supports multiple numeric measures and missing values", () => {
  const { createTimeSeriesTraces } = require("../site/GridGraph.6bf43e7.js");
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
  const { defaultMeasureNames } = require("../site/GridGraph.6bf43e7.js");
  assert.deepEqual(defaultMeasureNames([
    "nutrient_name_id", "nutrient_code", "nutrient_decimals", "nutrient_web_order", "nutrient_group_id"
  ]), []);
  assert.deepEqual(defaultMeasureNames(["population_total", "standard_error", "observation_count"]), ["population_total"]);
});

test("numeric graph series are restricted to each dataset's approved measure names", () => {
  const { graphableNumericIndexes } = require("../site/GridGraph.6bf43e7.js");
  const columns = ["population_id", "population_code", "population"];
  const rows = [["1", "10", "450"], ["2", "11", "780"]];
  assert.deepEqual(graphableNumericIndexes(columns, rows, ["population"]), [2]);
  assert.deepEqual(graphableNumericIndexes(columns, rows, []), []);
});

test("required series filters isolate one projection group and sort its years", () => {
  const { filterRowsByFields, hasRequiredFilters, sortRowsByField } = require("../site/GridGraph.6bf43e7.js");
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
    delete require.cache[require.resolve("../site/GridGraph.6bf43e7.js")];
    const { schedulePlotResize, cancelPlotResize } = require("../site/GridGraph.6bf43e7.js");
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
    delete require.cache[require.resolve("../site/GridGraph.6bf43e7.js")];
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
});

test("temporal heatmap arranges observed monthly values by year without aggregating", () => {
  const { classifyTimeSeries, createTemporalHeatmapTrace } = loadGraphHelpers();
  const rows = [];
  for (const year of [2024, 2025]) {
    for (let month = 1; month <= 12; month++) rows.push([`${year}-${String(month).padStart(2, "0")}`, String(year + month)]);
  }
  const classification = classifyTimeSeries(rows, 0);
  assert.equal(classification.granularity, "month");
  const trace = createTemporalHeatmapTrace(rows, ["period", "value"], "period", "value");
  assert.equal(trace.type, "heatmap");
  assert.deepEqual(trace.x, ["2024", "2025"]);
  assert.deepEqual(trace.y, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  assert.deepEqual(trace.z[0], [2025, 2026]);
  assert.deepEqual(trace.customdata[0], ["2024-01", "2025-01"]);
  assert.equal(trace.hoverongaps, false);
});

test("temporal heatmap supports annual and quarterly periods and rejects irregular or duplicate dates", () => {
  const { classifyTimeSeries, createTemporalHeatmapTrace } = loadGraphHelpers();
  const annual = [["2022", "10"], ["2023", "11"], ["2024", "12"]];
  const annualTrace = createTemporalHeatmapTrace(annual, ["year", "value"], "year", "value");
  assert.equal(classifyTimeSeries(annual, 0).granularity, "year");
  assert.deepEqual(annualTrace.y, ["Annual"]);
  assert.deepEqual(annualTrace.z, [[10, 11, 12]]);
  const quarters = [["2023-01-01", "1"], ["2023-04-01", "2"], ["2023-07-01", "3"], ["2023-10-01", "4"], ["2024-01-01", "5"]];
  assert.equal(classifyTimeSeries(quarters, 0).granularity, "quarter");
  assert.equal(createTemporalHeatmapTrace(quarters, ["period", "value"], "period", "value").z[0][1], 5);
  assert.equal(classifyTimeSeries([["2022", "1"], ["2024", "2"], ["2025", "3"]], 0), null);
  assert.equal(classifyTimeSeries([["2024-01", "1"], ["2024-01-01", "2"], ["2024-02", "3"]], 0), null);
});

test("GridGraph passes calendar heatmap traces to Plotly", () => {
  const { GridGraph, testWindow } = loadGraphHelpers();
  const originalPlotly = testWindow.Plotly;
  const results = [];
  testWindow.Plotly = { react(_plot, traces, layout) { results.push({ traces, layout }); }, purge() {} };
  function draw(type, rows) {
    const attributes = {
      "data-time-series": "true", "data-time-field": "period", "data-graphable-y": "value",
      "data-default-type": "line", "data-pie-additive-period-totals": "false"
    };
    const graph = Object.create(GridGraph.prototype);
    graph.type = type;
    graph.table = { columns: ["period", "value"], rows };
    graph.getAttribute = (name) => attributes[name] ?? null;
    graph._plot = { style: {}, querySelector: () => null, setAttribute() {} };
    graph._seriesOptions = { querySelectorAll: () => [{ value: "value" }] };
    graph._periodStart = { value: "" };
    graph._periodEnd = { value: "" };
    graph._unitSelect = null;
    graph._fieldNote = { textContent: "" };
    graph._defaultFieldNote = "";
    graph._typeButtons = new Map();
    graph.message = (text) => { graph.lastMessage = text; };
    graph.draw();
    assert.equal(graph.lastMessage, undefined);
    return graph;
  }
  try {
    const monthly = [];
    for (const year of [2023, 2024]) for (let month = 1; month <= 12; month++) monthly.push([`${year}-${String(month).padStart(2, "0")}`, String(year + month)]);
    draw("heatmap", monthly);
    assert.equal(results[0].traces[0].type, "heatmap");
    assert.deepEqual(results[0].traces[0].x, ["2023", "2024"]);
    assert.deepEqual(results[0].traces[0].z[0], [2024, 2025]);
  } finally {
    testWindow.Plotly = originalPlotly;
  }
});

test("temporal chart modes are gated by period semantics, regularity, and declared comparability", () => {
  const { timeSeriesTypeReasons } = loadGraphHelpers();
  const rows = [["2022", "10"], ["2023", "11"], ["2024", "12"], ["2025", "13"]];
  const single = timeSeriesTypeReasons(rows, ["year", "value"], "year", ["value"]);
  for (const type of ["line", "bar", "area", "scatter", "heatmap"]) assert.equal(single[type], null, `${type} is meaningful for one annual series`);
  assert.match(single.pie, /declares nonnegative period totals/);
  const monthly = [];
  for (const year of [2023, 2024]) for (let month = 1; month <= 12; month++) monthly.push([`${year}-${String(month).padStart(2, "0")}`, String(month)]);
  const additivePie = timeSeriesTypeReasons(rows, ["year", "value"], "year", ["value"], [], [], true);
  assert.equal(additivePie.pie, null);
  assert.match(timeSeriesTypeReasons([["2022", "-1"], ["2023", "2"]], ["year", "value"], "year", ["value"], [], [], true).pie, /negative values/);
  const multiColumns = ["year", "actual", "forecast"];
  const multiRows = [["2022", "10", "11"], ["2023", "12", "13"]];
  const undeclared = timeSeriesTypeReasons(multiRows, multiColumns, "year", ["actual", "forecast"]);
  assert.match(undeclared.line, /Select one measure/);
  assert.match(undeclared.area, /comparable and additive/);
  const declared = timeSeriesTypeReasons(multiRows, multiColumns, "year", ["actual", "forecast"], ["actual", "forecast"], ["actual", "forecast"]);
  assert.equal(declared.line, null);
  assert.equal(declared.area, null);
});

test("single-series area traces fill to zero and retain missing observations as gaps", () => {
  const { GridGraph, testWindow } = loadGraphHelpers();
  const originalPlotly = testWindow.Plotly;
  let plotted;
  testWindow.Plotly = { react(_plot, traces) { plotted = traces; }, purge() {} };
  const attributes = {
    "data-time-series": "true", "data-time-field": "period", "data-graphable-y": "value",
    "data-comparable-y": "", "data-stackable-y": "", "data-pie-additive-period-totals": "false"
  };
  const graph = Object.create(GridGraph.prototype);
  graph.type = "area";
  graph.table = { columns: ["period", "value"], rows: [["2024-01", "1"], ["2024-02", ""], ["2024-03", "3"]] };
  graph.getAttribute = (name) => attributes[name] ?? null;
  graph._typeButtons = new Map();
  graph._typeControls = { hidden: false };
  graph._seriesOptions = { querySelectorAll: () => [{ value: "value" }] };
  graph._periodStart = { value: "" };
  graph._periodEnd = { value: "" };
  graph._unitSelect = null;
  graph._fieldNote = { textContent: "" };
  graph._defaultFieldNote = "";
  graph._plot = { style: {}, querySelector: () => null, replaceChildren() {}, setAttribute() {} };
  graph.message = (text) => { graph.lastMessage = text; };
  try {
    graph.draw();
    assert.equal(graph.lastMessage, undefined);
    assert.equal(plotted[0].type, "scatter");
    assert.equal(plotted[0].fill, "tozeroy");
    assert.equal(plotted[0].stackgroup, undefined);
    assert.equal(plotted[0].connectgaps, false);
    assert.deepEqual(plotted[0].y, [1, null, 3]);
  } finally {
    testWindow.Plotly = originalPlotly;
  }
});

test("GridGraph rejects duplicate selected periods instead of drawing ambiguous observations", () => {
  const { GridGraph, testWindow } = loadGraphHelpers();
  const originalPlotly = testWindow.Plotly;
  let plotted = false;
  testWindow.Plotly = { react() { plotted = true; }, purge() {} };
  const attributes = {
    "data-time-series": "true", "data-time-field": "period", "data-graphable-y": "value",
    "data-required-filters": "series", "data-default-y": "value"
  };
  const graph = Object.create(GridGraph.prototype);
  graph.type = "line";
  graph.table = { columns: ["period", "series", "value"], rows: [["2025-01", "A", "1"], ["2025-01-01", "A", "2"]] };
  graph.getAttribute = (name) => attributes[name] ?? null;
  graph._plot = { style: {}, querySelector: () => null, replaceChildren() {}, setAttribute() {} };
  graph._filterFieldset = { querySelector: () => ({ value: "A" }) };
  graph._seriesOptions = { querySelectorAll: () => [{ value: "value" }] };
  graph._periodStart = { value: "" };
  graph._periodEnd = { value: "" };
  graph._unitSelect = null;
  graph._fieldNote = { textContent: "" };
  graph._defaultFieldNote = "";
  graph._typeButtons = new Map();
  graph._typeControls = { hidden: false };
  graph.message = (text, isError = false) => { graph.lastMessage = text; graph.lastError = isError; };
  try {
    graph.draw();
    assert.match(graph.lastMessage, /periods must be unique/);
    assert.equal(graph.lastError, true);
    assert.equal(plotted, false);
  } finally {
    testWindow.Plotly = originalPlotly;
  }
});

test("GridGraph explains when an inclusive date range contains no observations", () => {
  const { GridGraph, testWindow } = loadGraphHelpers();
  const originalPlotly = testWindow.Plotly;
  let plotted = false;
  testWindow.Plotly = { react() { plotted = true; }, purge() {} };
  const attributes = {
    "data-time-series": "true", "data-time-field": "period", "data-graphable-y": "value",
    "data-default-y": "value"
  };
  const graph = Object.create(GridGraph.prototype);
  graph.type = "line";
  graph.table = { columns: ["period", "value"], rows: [["2025-01-01T00:00:00Z", "1"], ["2025-01-03T00:00:00Z", "3"]] };
  graph.getAttribute = (name) => attributes[name] ?? null;
  graph._plot = { style: {}, querySelector: () => null, replaceChildren() {}, setAttribute() {} };
  graph._seriesOptions = { querySelectorAll: () => [{ value: "value" }] };
  graph._periodStart = { value: "2025-01-02" };
  graph._periodEnd = { value: "2025-01-02" };
  graph._unitSelect = null;
  graph._fieldNote = { textContent: "" };
  graph._defaultFieldNote = "";
  graph._typeButtons = new Map();
  graph._typeControls = { hidden: false };
  graph.message = (text, isError = false) => { graph.lastMessage = text; graph.lastError = isError; };
  try {
    graph.draw();
    assert.match(graph.lastMessage, /No observations fall within the selected dates/);
    assert.equal(graph.lastError, false);
    assert.equal(plotted, false);
  } finally {
    testWindow.Plotly = originalPlotly;
  }
});

test("date-range changes move from a supported heatmap to an available chart mode", () => {
  const { GridGraph, filterRowsByTimePeriod } = loadGraphHelpers();
  const types = ["line", "bar", "area", "scatter", "pie", "heatmap"];
  const buttons = new Map(types.map((type) => [type, {
    hidden: false, disabled: false, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }
  }]));
  const graph = Object.create(GridGraph.prototype);
  graph.type = "heatmap";
  graph._typeButtons = buttons;
  graph._typeControls = { hidden: false };
  graph.getAttribute = (name) => ({
    "data-time-field": "period", "data-comparable-y": "", "data-stackable-y": "",
    "data-pie-additive-period-totals": "false"
  })[name] ?? null;

  const fullSeries = [];
  for (const year of [2023, 2024]) {
    for (let month = 1; month <= 12; month++) {
      fullSeries.push([`${year}-${String(month).padStart(2, "0")}`, String(year + month)]);
    }
  }
  const reasons = graph.updateTypeControls(fullSeries, ["period", "value"], ["value"]);
  assert.equal(Object.hasOwn(reasons, "scatter3d"), false);
  assert.equal(reasons.heatmap, null);
  assert.equal(graph.type, "heatmap");
  assert.equal(buttons.get("heatmap").hidden, false);
  assert.equal(buttons.get("heatmap").attributes["aria-pressed"], "true");

  const narrowedRange = filterRowsByTimePeriod(["period", "value"], fullSeries, "period", "2024-01-01", "2024-12-01");
  const narrowedReasons = graph.updateTypeControls(narrowedRange, ["period", "value"], ["value"]);
  assert.match(narrowedReasons.heatmap, /two or more years/);
  assert.equal(graph.type, "line");
  assert.equal(buttons.get("heatmap").hidden, true);
  assert.equal(buttons.get("heatmap").disabled, true);
  assert.equal(buttons.get("line").hidden, false);
  assert.equal(buttons.get("line").attributes["aria-pressed"], "true");
  assert.equal(graph._typeControls.hidden, false);
});
