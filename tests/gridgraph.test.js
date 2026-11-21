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
    delete require.cache[require.resolve("../site/GridGraph.js")];
    require("../site/GridGraph.js");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  }

  const rows = [["Vitamin C", "5"], ["Calcium", "12"], ["Sodium", ""]];
  const result = graphClass && require("../site/GridGraph.js").create3DTrace(
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
  const create3DTrace = require("../site/GridGraph.js").create3DTrace;
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
