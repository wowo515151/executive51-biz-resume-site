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
    delete require.cache[require.resolve("../site/GridGraph.4af309a.js")];
    require("../site/GridGraph.4af309a.js");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }

  const rows = [["Vitamin C", "5"], ["Calcium", "12"], ["Sodium", ""]];
  const result = graphClass && require("../site/GridGraph.4af309a.js").create3DTrace(
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
  const create3DTrace = require("../site/GridGraph.4af309a.js").create3DTrace;
  const result = create3DTrace(
    [["North", "10", "3"], ["South", "20", "7"]],
    ["region", "population", "area"], [1, 2], ["North", "South"]
  );
  assert.equal(result.fallback, false);
  assert.equal(result.trace.type, "surface");
  assert.deepEqual(result.trace.x, ["North", "South"]);
  assert.deepEqual(result.trace.y, ["population", "area"]);
  assert.deepEqual(result.trace.z, [[10, 20], [3, 7]]);
});

test("pie mode keeps positive values and omits zero or missing rows", () => {
  const { createPieTrace } = require("../site/GridGraph.4af309a.js");
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
  const { createPieTrace } = require("../site/GridGraph.4af309a.js");
  const result = createPieTrace([["positive", "5"], ["negative", "-2"]], 1, ["positive", "negative"]);
  assert.equal(result.trace, null);
  assert.equal(result.reason, "negative");
});

test("pie mode reports when there are no positive values", () => {
  const { createPieTrace } = require("../site/GridGraph.4af309a.js");
  const result = createPieTrace([["zero", "0"], ["missing", ""]], 1, ["zero", "missing"]);
  assert.equal(result.trace, null);
  assert.equal(result.reason, "empty");
});

test("dense categorical bar labels use a readable horizontal layout", () => {
  const { shouldUseHorizontalBars } = require("../site/GridGraph.4af309a.js");
  const labels = Array.from({ length: 100 }, (_, index) => `Municipality ${index + 1}`);
  assert.equal(shouldUseHorizontalBars(labels), true);
});

test("date sequences retain a compact vertical bar layout", () => {
  const { shouldUseHorizontalBars } = require("../site/GridGraph.4af309a.js");
  const labels = Array.from({ length: 100 }, (_, index) => {
    const date = new Date(Date.UTC(2020, index, 1));
    return date.toISOString().slice(0, 10);
  });
  assert.equal(shouldUseHorizontalBars(labels), false);
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
    delete require.cache[require.resolve("../site/GridGraph.4af309a.js")];
    const { schedulePlotResize, cancelPlotResize } = require("../site/GridGraph.4af309a.js");
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
    delete require.cache[require.resolve("../site/GridGraph.4af309a.js")];
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }
});
